import { areaItems, itemsKey } from "./area-cache.js";
import { escapeHtml, fireEvent } from "./base.js";
import {
  EDIT_EVENT, HIDDEN_EVENT, hiddenAreasChangedThisSession, hiddenLists, isEditing, setEditing, setHidden,
} from "./hidden.js";
import { groupBySection, securityReport, sortedAreas } from "./model.js";
import { PREFS_EVENT, effectiveNav, effectiveScale, effectiveSize } from "./prefs.js";
import { resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { sheetFrame } from "./sheet.js";
import { GRID_STYLES } from "./styles.js";
import { createTile } from "./tile-factory.js";

export const iconOptions = (config) => ({
  ...(config.icon ? { icon: config.icon } : {}),
  ...(config.room_icons ? { room_icons: config.room_icons } : {}),
  ...(config.icon_source ? { icon_source: config.icon_source } : {}),
});

/** Hidden lists forwarded to child cards so room tiles leave hidden devices out of their counts. */
export const hiddenOptions = (config) => ({
  ...(config.hide_areas ? { hide_areas: config.hide_areas } : {}),
  ...(config.hide_entities ? { hide_entities: config.hide_entities } : {}),
});

export const viewMenuHtml = (config, hass) =>
  config.show_menu === false
    ? ""
    : `<controlz-view-menu default-size="${escapeHtml(config.tile_size || "large")}"
        default-nav="${escapeHtml(config.room_nav || "tabs")}" default-scale="${escapeHtml(String(config.tile_scale ?? 1))}"
        ${config.show_nav_menu ? "show-nav" : ""} ${config.editable && hass?.user?.is_admin ? "editable" : ""}></controlz-view-menu>`;

const EYE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 7a5 5 0 015 5c0 .65-.13 1.26-.36 1.83l2.92 2.92A11.82 11.82 0 0023 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16A4.85 4.85 0 0112 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55A2.82 2.82 0 009 12a3 3 0 003 3c.22 0 .44-.03.65-.08l1.55 1.55A4.97 4.97 0 017 12c0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16a3 3 0 00-3-3l-.17.01z"/></svg>`;

/** Edit-mode wrapper: the tile plus a show / hide button that keeps its on-screen size at any scale. */
function hideWrap(el, kind, id, name, hidden) {
  const wrap = document.createElement("div");
  wrap.className = `tile-wrap${hidden ? " is-hidden" : ""}`;
  wrap.append(el);
  wrap.insertAdjacentHTML("beforeend", `<button type="button" class="hide-toggle" data-hide-kind="${kind}"
    data-hide-id="${escapeHtml(id)}" data-hide="${hidden ? "0" : "1"}" aria-pressed="${hidden}"
    title="${hidden ? "Show" : "Hide"} ${escapeHtml(name)}" aria-label="${hidden ? "Show" : "Hide"} ${escapeHtml(name)}">${hidden ? EYE_OFF : EYE}</button>`);
  return wrap;
}

/**
 * Shared shell for page-level cards: rebuilds child tiles only when the set of entities, the
 * tile size, the hidden lists or edit mode change; otherwise just forwards `hass`.
 */
class CzPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._children = [];
    this._key = null;
    this._onPrefs = () => {
      if (!this._config) return;
      if (effectiveSize(this._config.tile_size) === this._size) {
        this._applyScale();
        return;
      }
      this._key = null;
      this._sync();
    };
    this._onStructure = () => {
      this._key = null;
      this._sync();
    };
    this._resize = new ResizeObserver(() => this._applyScale());
    this.shadowRoot.addEventListener("click", (ev) => this._onEditClick(ev));
  }

  connectedCallback() {
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    window.addEventListener(HIDDEN_EVENT, this._onStructure);
    window.addEventListener(EDIT_EVENT, this._onStructure);
    this._resize.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    window.removeEventListener(HIDDEN_EVENT, this._onStructure);
    window.removeEventListener(EDIT_EVENT, this._onStructure);
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

  // Not `hidden` / `editing`: Home Assistant's card wrapper reads `element.hidden` to hide cards.
  get _editMode() {
    return isEditing() && !!this._config?.editable;
  }

  get _hiddenSets() {
    return hiddenLists(this._config);
  }

  _sync() {
    if (!this._hass || !this._config) return;
    this._size = effectiveSize(this._config.tile_size);
    this.setAttribute("size", this._size);
    const { areas, entities } = this._hiddenSets;
    const key = `${this._size}|${this._editMode}|${[...areas]}|${[...entities]}|${this.structureKey()}`;
    if (key !== this._key) {
      this._key = key;
      this._children = [];
      this.shadowRoot.innerHTML = `<style>${GRID_STYLES}${this.styles()}</style><div class="page"></div>`;
      const page = this.shadowRoot.querySelector(".page");
      this.build(page);
      if (this._editMode) this._editBanner(page);
    }
    this._applyScale();
    this.update();
    for (const child of this._children) child.hass = this._hass;
  }

  /** Header row: `left` markup grows; the View menu sits on the right. */
  header(page, left) {
    const menu = viewMenuHtml(this._config, this._hass);
    if (!left && !menu) return;
    page.insertAdjacentHTML("beforeend", `<div class="page-head">${left || "<span></span>"}${menu}</div>`);
  }

  _editBanner(page) {
    const head = page.querySelector(".page-head");
    const html = `<div class="edit-banner" role="status">
      <span>Hide rooms &amp; devices — tap <span class="eye-inline">${EYE}</span> to hide or show. Hidden items are dimmed here and hidden everywhere else, on every device.</span>
      <span class="edit-error" hidden></span>
      <button type="button" class="btn" data-edit-done>Done</button>
    </div>`;
    if (head) head.insertAdjacentHTML("afterend", html);
    else page.insertAdjacentHTML("afterbegin", html);
  }

  async _onEditClick(ev) {
    const target = ev.composedPath().find((el) => el instanceof HTMLElement && (el.dataset?.hideKind || el.hasAttribute?.("data-edit-done")));
    if (!target) return;
    ev.stopPropagation();
    if (target.hasAttribute("data-edit-done")) {
      setEditing(false);
      if (hiddenAreasChangedThisSession() && effectiveNav(this._config.room_nav) === "tabs") location.reload();
      return;
    }
    target.disabled = true;
    try {
      await setHidden(this._hass, target.dataset.hideKind, target.dataset.hideId, target.dataset.hide === "1");
    } catch (err) {
      target.disabled = false;
      const error = this.shadowRoot.querySelector(".edit-error");
      if (error) {
        error.hidden = false;
        error.textContent = err?.message || "Could not save the dashboard.";
      }
    }
  }

  tile(kind, config) {
    const el = createTile(kind, { tile_size: this._size, ...hiddenOptions(this._config), ...config });
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
    const hiddenEntities = this._hiddenSets.entities;
    const editing = this._editMode;
    const all = areaItems(this._hass, area);
    const items = editing ? all : all.filter((i) => !hiddenEntities.has(i.entity_id));
    const name = this._config.title || this._hass.areas?.[area]?.name || area;
    const { icon } = resolveAreaIcon(this._hass, area, this._config);
    this.header(page, show_title
      ? `<h1 class="page-title"><span class="title-icon">${roomIconSvg(icon)}</span>${escapeHtml(name)}</h1>`
      : "");
    if (!items.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">${all.length ? "Every device in this room is hidden." : "No supported devices in this area."}</div>`);
      return;
    }
    const visible = items.filter((i) => !hiddenEntities.has(i.entity_id));
    if (show_room_tile && visible.some((i) => ["light", "cover"].includes(i.kind))) {
      const master = document.createElement("div");
      master.className = "master";
      master.append(this.tile("room", { area, ...iconOptions(this._config) }));
      page.append(master);
    }
    for (const section of groupBySection(items)) {
      const el = document.createElement("section");
      if (section.id === "scenes" && this._config.scenes_style !== "tiles" && !editing) {
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
      for (const item of section.items) {
        const tile = this.tile(item.kind, { entity: item.entity_id });
        if (!editing) {
          grid.append(tile);
          continue;
        }
        const label = this._hass.states[item.entity_id]?.attributes?.friendly_name || item.entity_id;
        grid.append(hideWrap(tile, "entity", item.entity_id, label, hiddenEntities.has(item.entity_id)));
      }
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
    this.shadowRoot.addEventListener("click", (ev) => {
      if (ev.composedPath().some((el) => el instanceof HTMLElement && el.hasAttribute("data-banner"))) this._openSecurity();
    });
  }

  normalizeConfig(config) {
    return { show_banner: true, navigation: true, view_path_prefix: "room-", ...config };
  }

  styles() {
    return `
      .sec-group { display: flex; flex-direction: column; gap: 6px; }
      .sec-group h4 { margin: 0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); }
      .sec-empty, .sec-scope { margin: 0; }
    `;
  }

  /** Areas with lights or coverings; hidden ones only while editing. */
  _areas() {
    const hiddenAreas = this._hiddenSets.areas;
    const editing = this._editMode;
    return sortedAreas(this._hass, { order: this._config.areas_order })
      .filter((a) => editing || !hiddenAreas.has(a.area_id))
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
    const areas = this._areas();
    if (!areas.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">No areas with lights or window coverings yet. Assign devices to areas in Home Assistant.</div>`);
      return;
    }
    const hiddenAreas = this._hiddenSets.areas;
    const base = location.pathname.split("/").slice(0, 2).join("/");
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const a of areas) {
      const config = { area: a.area_id, ...iconOptions({ ...this._config, icon: undefined }) };
      if (this._config.select_rooms) config.select_area = true;
      else if (this._config.navigation) config.navigation_path = `${base}/${this._config.view_path_prefix}${a.area_id}`;
      const tile = this.tile("room", config);
      grid.append(this._editMode ? hideWrap(tile, "area", a.area_id, a.name, hiddenAreas.has(a.area_id)) : tile);
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
    if (this._sheet?.isConnected) this._sheet.refresh();
  }

  // Owner interface for the shared <controlz-sheet> (security list).
  _openSecurity() {
    this._sheet ||= document.createElement("controlz-sheet");
    this._sheet.show(this);
  }

  sheetBody() {
    const report = this._report();
    const groups = SECURITY_GROUPS.filter((g) => report[g.key].length).map((g) => `
      <div class="sheet-section">
        <div class="section-label">${g.title} (${report[g.key].length})</div>
        ${report[g.key].map((i) => `<button type="button" class="sec-row" data-action="sec-row" data-entity="${escapeHtml(i.entity_id)}">
          <span class="dot" style="background:${g.dot}"></span><span>${escapeHtml(i.name)}</span>
          <span class="what">${escapeHtml(i.phrase || "motion")}</span></button>`).join("")}
      </div>`).join("");
    const scoped = this._config.security_include?.length
      ? `Only the ${this._config.security_include.length} devices in security_include count.`
      : "All doors, locks, windows, garage doors, alarms and smoke / gas / CO / leak sensors in Home Assistant count"
        + (this._config.security_exclude?.length ? `, except ${this._config.security_exclude.length} excluded.` : ".");
    return sheetFrame({
      title: "Security",
      subtitle: report.text,
      body: `${groups || `<p class="sec-empty">All doors and locks secure. No motion.</p>`}<p class="sec-scope">${scoped}</p>`,
    });
  }

  get actions() {
    return {
      "sec-row": (row) => {
        this._sheet?.close();
        this.moreInfo(row.dataset.entity);
      },
    };
  }

  moreInfo(entityId) {
    fireEvent(this, "hass-more-info", { entityId });
  }

  sheetDetailsEntity() {
    return null;
  }
}
