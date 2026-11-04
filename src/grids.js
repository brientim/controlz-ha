import { areaItems, itemsKey } from "./area-cache.js";
import { SIZES, escapeHtml } from "./base.js";
import { groupBySection, securityBanner, sortedAreas } from "./model.js";
import { resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { GRID_STYLES } from "./styles.js";
import { createTile } from "./tile-factory.js";

/**
 * Shared shell for page-level cards: rebuilds child tiles only when the set of
 * entities changes, otherwise just forwards `hass` (children diff their own render).
 */
const iconOptions = (config) => ({
  ...(config.icon ? { icon: config.icon } : {}),
  ...(config.room_icons ? { room_icons: config.room_icons } : {}),
  ...(config.icon_source ? { icon_source: config.icon_source } : {}),
});

class CzPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._children = [];
    this._key = null;
  }

  setConfig(config) {
    this._config = this.normalizeConfig(config || {});
    this._size = SIZES.includes(this._config.tile_size) ? this._config.tile_size : "large";
    this.setAttribute("size", this._size);
    this._key = null;
    this._sync();
  }

  normalizeConfig(config) {
    return { ...config };
  }

  set hass(hass) {
    this._hass = hass;
    this._sync();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  _sync() {
    if (!this._hass || !this._config) return;
    const key = `${this._size}|${this.structureKey()}`;
    if (key !== this._key) {
      this._key = key;
      this._children = [];
      this.shadowRoot.innerHTML = `<style>${GRID_STYLES}</style><div class="page"></div>`;
      this.build(this.shadowRoot.querySelector(".page"));
    }
    this.update();
    for (const child of this._children) child.hass = this._hass;
  }

  tile(kind, config) {
    const el = createTile(kind, { tile_size: this._size, ...config });
    this._children.push(el);
    return el;
  }

  structureKey() {
    return "";
  }

  build() {}

  update() {}
}

/** One room: master tile, then Scenes / Lights / Coverings / Security / Sensors / Other sections. */
export class RoomGrid extends CzPage {
  static getStubConfig(hass) {
    return { area: Object.keys(hass?.areas || {})[0] || "living_room" };
  }

  normalizeConfig(config) {
    if (!config.area) throw new Error("controlz-room-grid: `area` (area_id) is required");
    return { show_title: true, show_room_tile: true, scenes_style: "chips", ...config };
  }

  structureKey() {
    return `${this._config.area}|${itemsKey(areaItems(this._hass, this._config.area))}`;
  }

  build(page) {
    const { area, show_title, show_room_tile } = this._config;
    const items = areaItems(this._hass, area);
    const name = this._config.title || this._hass.areas?.[area]?.name || area;
    if (show_title) {
      const { icon } = resolveAreaIcon(this._hass, area, this._config);
      page.insertAdjacentHTML("beforeend", `<h1 class="page-title"><span class="title-icon">${roomIconSvg(icon)}</span>${escapeHtml(name)}</h1>`);
    }
    if (!items.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">No supported devices in this area.</div>`);
      return;
    }
    if (show_room_tile && items.some((i) => ["light", "cover"].includes(i.kind))) {
      const master = document.createElement("div");
      master.className = "master";
      master.append(this.tile("room", { area, ...iconOptions(this._config) }));
      page.append(master);
    }
    for (const section of groupBySection(items)) {
      const el = document.createElement("section");
      if (section.id === "scenes" && this._config.scenes_style !== "tiles") {
        el.innerHTML = `<h2>${section.title}</h2>`;
        const strip = document.createElement("controlz-scene-strip");
        strip.setConfig({ tile_size: this._size, area_name: name, entities: section.items.map((i) => i.entity_id) });
        this._children.push(strip);
        el.append(strip);
        page.append(el);
        continue;
      }
      el.innerHTML = `<h2>${section.title}</h2><div class="grid"></div>`;
      const grid = el.querySelector(".grid");
      for (const item of section.items) grid.append(this.tile(item.kind, { entity: item.entity_id }));
      page.append(el);
    }
  }
}

/** All Rooms: security banner + one ControlZ room tile per area; tapping a tile opens that room's view. */
export class HomeGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  normalizeConfig(config) {
    return { show_banner: true, navigation: true, view_path_prefix: "room-", ...config };
  }

  _areas() {
    return sortedAreas(this._hass, { order: this._config.areas_order, hide: this._config.hide_areas })
      .filter((a) => areaItems(this._hass, a.area_id).some((i) => i.kind === "light" || i.kind === "cover"));
  }

  structureKey() {
    return this._areas().map((a) => `${a.area_id}:${a.name}:${a.icon || ""}`).join(",");
  }

  build(page) {
    if (this._config.title) page.insertAdjacentHTML("beforeend", `<h1 class="page-title">${escapeHtml(this._config.title)}</h1>`);
    if (this._config.show_banner) {
      page.insertAdjacentHTML("beforeend", `<div class="banner" role="status"><span aria-hidden="true">🛡</span><span class="banner-text"></span></div>`);
    }
    const areas = this._areas();
    if (!areas.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">No areas with lights or window coverings yet. Assign devices to areas in Home Assistant.</div>`);
      return;
    }
    const base = location.pathname.split("/").slice(0, 2).join("/");
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const a of areas) {
      const config = { area: a.area_id, ...iconOptions({ ...this._config, icon: undefined }) };
      if (this._config.navigation) config.navigation_path = `${base}/${this._config.view_path_prefix}${a.area_id}`;
      grid.append(this.tile("room", config));
    }
    page.append(grid);
  }

  update() {
    const banner = this.shadowRoot.querySelector(".banner");
    if (!banner) return;
    const { level, text } = securityBanner(this._hass);
    banner.className = `banner ${level}`;
    const label = banner.querySelector(".banner-text");
    if (label.textContent !== text) label.textContent = text;
  }
}
