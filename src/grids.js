import { areaItems, itemsKey } from "./area-cache.js";
import { escapeHtml, fireEvent } from "./base.js";
import { groupBySection, securityReport, sortedAreas } from "./model.js";
import { PREFS_EVENT, effectiveScale, effectiveSize } from "./prefs.js";
import { resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { GRID_STYLES, SHEET_STYLES } from "./styles.js";
import { createTile } from "./tile-factory.js";

export const iconOptions = (config) => ({
  ...(config.icon ? { icon: config.icon } : {}),
  ...(config.room_icons ? { room_icons: config.room_icons } : {}),
  ...(config.icon_source ? { icon_source: config.icon_source } : {}),
});

export const viewMenuHtml = (config) =>
  config.show_menu === false
    ? ""
    : `<controlz-view-menu default-size="${escapeHtml(config.tile_size || "large")}"
        default-nav="${escapeHtml(config.room_nav || "tabs")}" default-scale="${escapeHtml(String(config.tile_scale ?? 1))}"
        ${config.show_nav_menu ? "show-nav" : ""}></controlz-view-menu>`;

/**
 * Shared shell for page-level cards: rebuilds child tiles only when the set of entities or the
 * tile size changes, otherwise just forwards `hass` (children diff their own render).
 */
class CzPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._children = [];
    this._key = null;
    this._onPrefs = () => {
      if (!this._config) return;
      this._key = null;
      this._sync();
    };
    this._resize = new ResizeObserver(() => this._applyScale());
  }

  connectedCallback() {
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    this._resize.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    this._resize.disconnect();
  }

  /** Zoom the content below the header by the tile scale, keeping it full width. */
  _applyScale() {
    const page = this.shadowRoot.querySelector(".page");
    if (!page || !this._config) return;
    const scale = effectiveScale(this._config.tile_scale);
    page.classList.toggle("scaled", scale !== 1);
    if (scale === 1) return;
    const style = getComputedStyle(page);
    const inner = page.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    page.style.setProperty("--cz-scale", String(scale));
    page.style.setProperty("--cz-inner", `${Math.max(0, Math.floor(inner))}px`);
  }

  setConfig(config) {
    this._config = this.normalizeConfig(config || {});
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
    this._size = effectiveSize(this._config.tile_size);
    this.setAttribute("size", this._size);
    const key = `${this._size}|${this.structureKey()}`;
    if (key !== this._key) {
      this._key = key;
      this._children = [];
      this.shadowRoot.innerHTML = `<style>${GRID_STYLES}${SHEET_STYLES}${this.styles()}</style><div class="page"></div>`;
      this.build(this.shadowRoot.querySelector(".page"));
    }
    this._applyScale();
    this.update();
    for (const child of this._children) child.hass = this._hass;
  }

  /** Header row: `left` markup grows; the View menu sits on the right. */
  header(page, left) {
    const menu = viewMenuHtml(this._config);
    if (!left && !menu) return;
    page.insertAdjacentHTML("beforeend", `<div class="page-head">${left || "<span></span>"}${menu}</div>`);
  }

  tile(kind, config) {
    const el = createTile(kind, { tile_size: this._size, ...config });
    this._children.push(el);
    return el;
  }

  styles() {
    return "";
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
    const { icon } = resolveAreaIcon(this._hass, area, this._config);
    this.header(page, show_title
      ? `<h1 class="page-title"><span class="title-icon">${roomIconSvg(icon)}</span>${escapeHtml(name)}</h1>`
      : "");
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

const SECURITY_GROUPS = [
  { key: "insecure", title: "Insecure", dot: "#dc2626" },
  { key: "warning", title: "Check", dot: "#ea580c" },
  { key: "motion", title: "Motion", dot: "#ca8a04" },
];

/**
 * All Rooms: security banner (tap for the device list) + one ControlZ room tile per area.
 * Tapping a room opens its view, or selects it when hosted by the sidebar app (`select_rooms`).
 */
export class HomeGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
  }

  normalizeConfig(config) {
    return { show_banner: true, navigation: true, view_path_prefix: "room-", ...config };
  }

  styles() {
    return `
      .sec-group { display: flex; flex-direction: column; gap: 6px; }
      .sec-group h4 { margin: 0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); }
      .sec-row {
        display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
        padding: 8px 10px; border-radius: 10px; border: 1px solid var(--cz-border);
        background: var(--cz-bg-secondary); color: var(--cz-text); font: inherit; cursor: pointer;
      }
      .sec-row .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .sec-row .what { margin-left: auto; font-size: 0.8rem; color: var(--cz-text-secondary); }
      .sec-empty { color: var(--cz-text-secondary); font-size: 0.9rem; margin: 0; }
      .sec-scope { font-size: 0.75rem; color: var(--cz-text-secondary); margin: 0; }
    `;
  }

  _areas() {
    return sortedAreas(this._hass, { order: this._config.areas_order, hide: this._config.hide_areas })
      .filter((a) => areaItems(this._hass, a.area_id).some((i) => i.kind === "light" || i.kind === "cover"));
  }

  _report() {
    return securityReport(this._hass, { include: this._config.security_include, exclude: this._config.security_exclude });
  }

  structureKey() {
    return this._areas().map((a) => `${a.area_id}:${a.name}:${a.icon || ""}`).join(",");
  }

  build(page) {
    const title = this._config.title ? `<h1 class="page-title">${escapeHtml(this._config.title)}</h1>` : "";
    const banner = this._config.show_banner
      ? `<button type="button" class="banner" data-banner aria-haspopup="dialog">
          <span aria-hidden="true">🛡</span><span class="banner-text"></span><span class="banner-more" aria-hidden="true">›</span>
        </button>`
      : "";
    this.header(page, banner || title);
    if (banner && title) page.insertAdjacentHTML("afterbegin", title);
    page.insertAdjacentHTML("beforeend", `<div class="sheet-host"></div>`);
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
      if (this._config.select_rooms) config.select_area = true;
      else if (this._config.navigation) config.navigation_path = `${base}/${this._config.view_path_prefix}${a.area_id}`;
      grid.append(this.tile("room", config));
    }
    page.append(grid);
  }

  update() {
    const banner = this.shadowRoot.querySelector(".banner");
    if (!banner) return;
    const report = this._report();
    banner.className = `banner ${report.level}`;
    const label = banner.querySelector(".banner-text");
    if (label.textContent !== report.text) label.textContent = report.text;
    if (this._sheetOpen) this._renderSheet(report);
  }

  _renderSheet(report) {
    const host = this.shadowRoot.querySelector(".sheet-host");
    if (!host) return;
    if (!this._sheetOpen) {
      host.innerHTML = "";
      return;
    }
    const groups = SECURITY_GROUPS.filter((g) => report[g.key].length).map((g) => `
      <div class="sec-group">
        <h4>${g.title} (${report[g.key].length})</h4>
        ${report[g.key].map((i) => `<button type="button" class="sec-row" data-entity="${escapeHtml(i.entity_id)}">
          <span class="dot" style="background:${g.dot}"></span><span>${escapeHtml(i.name)}</span>
          <span class="what">${escapeHtml(i.phrase || "motion")}</span></button>`).join("")}
      </div>`).join("");
    const scoped = this._config.security_include?.length
      ? `Only the ${this._config.security_include.length} devices in security_include count.`
      : "All doors, locks, windows, garage doors, alarms and smoke / gas / CO / leak sensors in Home Assistant count"
        + (this._config.security_exclude?.length ? `, except ${this._config.security_exclude.length} excluded.` : ".");
    const html = `<div class="sheet-backdrop" data-sheet-close>
      <div class="sheet" role="dialog" aria-label="Security">
        <h3>Security</h3>
        ${groups || `<p class="sec-empty">All doors and locks secure. No motion.</p>`}
        <p class="sec-scope">${scoped}</p>
        <button type="button" class="btn close" data-sheet-close>Done</button>
      </div>
    </div>`;
    if (host.innerHTML !== html) host.innerHTML = html;
  }

  _onClick(ev) {
    const path = ev.composedPath();
    const hit = (pred) => path.find((el) => el instanceof HTMLElement && pred(el));
    if (hit((el) => el.hasAttribute("data-banner"))) {
      this._sheetOpen = true;
      this._renderSheet(this._report());
      return;
    }
    const row = hit((el) => el.classList.contains("sec-row"));
    if (row) {
      fireEvent(this, "hass-more-info", { entityId: row.dataset.entity });
      return;
    }
    const close = hit((el) => el.hasAttribute("data-sheet-close"));
    const inside = hit((el) => el.classList.contains("sheet"));
    if (close && (!inside || close !== hit((el) => el.classList.contains("sheet-backdrop")))) {
      this._sheetOpen = false;
      this._renderSheet(this._report());
    }
  }
}
