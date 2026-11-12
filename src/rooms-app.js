import { areaItems, masterItems } from "./area-cache.js";
import { escapeHtml } from "./base.js";
import { FAVORITES_EVENT, isFavorite, loadFavorites, toggleFavorite } from "./favorites.js";
import { hiddenOptions, iconOptions, saveRoomSizeForEveryone, securityOptions, viewMenuHtml } from "./grids.js";
import { HOUSE_PAGES, availableHousePages } from "./house-pages.js";
import {
  EDIT_EVENT, HIDDEN_EVENT, areasOrder, attentionIgnored, dashboardBatteryThreshold, hiddenLists, isEditing, movedOrder, roomTileSizes,
  setAreasOrder, setHidden,
} from "./hidden.js";
import { ICONS } from "./icons.js";
import { attentionReport, automationGroups, roomSummary, securityReport, sortedAreas } from "./model.js";
import { PREFS_EVENT, ROOM_SIZE_EVENT, effectiveBatteryThreshold, takeStartPage } from "./prefs.js";
import { DEFAULT_ROOM_ICON, resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { SECURITY_SETTINGS_EVENT, openSecuritySettings } from "./security-settings.js";
import { TOKENS } from "./styles.js";

const ALL = "__all";
const FAV = "__favorites";
const AUTO = "__automations";
const PAGE_INFO = {
  attention: { title: "Needs Attention", icon: ICONS.alert }, ...HOUSE_PAGES, weather: { title: "Weather", icon: ICONS.weather },
};
const HOUSE = Object.fromEntries(Object.keys(PAGE_INFO).map((id) => [id, `__${id}`]));
const DASH = "__dashtop";
const PAGES = { dashtop: DASH, favorites: FAV, automations: AUTO, ...HOUSE };
const pageOf = (selected) => Object.keys(PAGES).find((id) => PAGES[id] === selected) || null;
const EYE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 4.27L3.27 3 21 20.73 19.73 22l-3.08-3.08A11.6 11.6 0 0112 19.5c-5 0-9.27-3.11-11-7.5a11.9 11.9 0 014.35-5.39L2 4.27zM12 7a5 5 0 015 5c0 .65-.13 1.26-.36 1.83l2.92 2.92A11.82 11.82 0 0023 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16A4.85 4.85 0 0112 7z"/></svg>`;
const NARROW_PX = 700;

const STYLES = `
  ${TOKENS}
  :host { display: block; }
  .app { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100%; }
  .sidebar {
    position: sticky; top: var(--header-height, 56px); align-self: start;
    max-height: calc(100vh - var(--header-height, 56px)); overflow-y: auto;
    padding: 12px 8px 16px 12px; border-right: 1px solid var(--cz-border);
    background: var(--cz-card-bg);
  }
  .side-head { display: flex; align-items: center; gap: 8px; padding: 4px 4px 12px; }
  .brand { font-weight: 800; font-size: 1.05rem; flex: 1; }
  .rooms { display: flex; flex-direction: column; gap: 4px; list-style: none; margin: 0; padding: 0; }
  .room-item {
    display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px;
    width: 100%; padding: 7px 8px; border-radius: 12px; border: 1px solid transparent;
    background: transparent; color: var(--cz-text); font: inherit; text-align: left; cursor: pointer;
  }
  .room-item:hover { background: var(--cz-bg-secondary); }
  .room-item[aria-current="page"] {
    background: color-mix(in srgb, var(--cz-primary) 12%, transparent); border-color: color-mix(in srgb, var(--cz-primary) 35%, transparent);
  }
  .room-item:focus-visible { outline: 2px solid var(--cz-primary); outline-offset: 1px; }
  .ri-icon {
    width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
    background: var(--cz-bg-secondary); border: 1px solid var(--cz-border); color: var(--cz-text);
  }
  .ri-icon svg { width: 18px; height: 18px; }
  .ri-icon.fav svg { width: 16px; height: 16px; }
  .ri-icon ha-icon { --mdc-icon-size: 18px; }
  .room-item.on .ri-icon { background: linear-gradient(135deg, #ffdc64, #ffc850); color: #3f2a00; border-color: rgba(0,0,0,0.08); }
  .ri-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ri-chips { display: inline-flex; gap: 3px; }
  .chip { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; color: #fff; }
  .chip svg { width: 11px; height: 11px; }
  .chip.green { background: #22c55e; } .chip.orange { background: #f97316; } .chip.blue { background: #3b82f6; }
  .chip.sec-insecure { background: #dc2626; } .chip.sec-warning { background: #ea580c; } .chip.sec-motion { background: #ca8a04; }
  .content { min-width: 0; }
  .ri-row { display: flex; align-items: center; gap: 4px; }
  .ri-row .room-item { flex: 1; min-width: 0; }
  .ri-row.is-hidden .room-item { opacity: 0.4; }
  .ri-eye {
    width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; border: none; cursor: pointer;
    background: rgba(17,24,39,0.88); color: #fff; display: inline-flex; align-items: center; justify-content: center;
  }
  .ri-row.is-hidden .ri-eye { background: #6b7280; }
  .ri-eye svg { width: 17px; height: 17px; }
  .ri-eye.fav[aria-pressed="true"] { background: #e11d48; }
  .ri-row:has(.ri-eye) .ri-chips { display: none; }
  .ri-row:has(.ri-eye) .room-item { grid-template-columns: 34px minmax(0, 1fr); }
  .ri-move { display: flex; flex-direction: column; gap: 2px; }
  .ri-move .ri-eye { width: 24px; height: 14px; border-radius: 6px; }
  .ri-move .ri-eye svg { width: 12px; height: 12px; }
  .ri-eye:disabled { opacity: 0.5; cursor: wait; }
  .ri-sep { height: 1px; background: var(--cz-border); margin: 6px 8px; }
  .ri-icon.fav { color: #e11d48; }
  :host([narrow]) .ri-row { flex-direction: column; }
  :host([narrow]) .ri-move { flex-direction: row; }
  :host([narrow]) .ri-sep { display: none; }
  .side-error { color: #b91c1c; font-size: 0.78rem; font-weight: 600; padding: 4px 8px; }

  /* Narrow: ControlZ iPhone room strip across the top. */
  :host([narrow]) .app { grid-template-columns: minmax(0, 1fr); }
  :host([narrow]) .sidebar {
    position: sticky; z-index: 2; max-height: none; overflow: visible;
    border-right: none; border-bottom: 1px solid var(--cz-border); padding: 8px 8px 6px;
  }
  :host([narrow]) .side-head { padding: 0 4px 6px; }
  :host([narrow]) .rooms { flex-direction: row; overflow-x: auto; gap: 6px; scrollbar-width: none; padding-bottom: 2px; }
  :host([narrow]) .room-item {
    grid-template-columns: 1fr; justify-items: center; gap: 4px; width: 76px; min-width: 76px;
    padding: 6px 4px; text-align: center; position: relative;
  }
  :host([narrow]) .ri-name { font-size: 0.7rem; width: 100%; }
  :host([narrow]) .ri-chips { position: absolute; top: 2px; right: 2px; }
  :host([narrow]) .ri-chips .chip:not(:first-child) { display: none; }
`;

/** Selection from the URL hash: `#room=office`, `#page=favorites`, `#page=automations`; null = All Rooms. */
const readHashRoom = () => {
  const page = /(?:^|[#&])page=([^&]+)/.exec(location.hash);
  if (page && PAGES[page[1]]) return PAGES[page[1]];
  const match = /(?:^|[#&])room=([^&]+)/.exec(location.hash);
  return match ? decodeURIComponent(match[1]) : null;
};

const hashFor = (selected) => {
  if (!selected) return "";
  if (pageOf(selected)) return `#page=${pageOf(selected)}`;
  return `#room=${encodeURIComponent(selected)}`;
};

/** Start page pref (`room-office`, `favorites`, `automations`) → sidebar selection. */
const startSelection = (start) => {
  if (!start || start === "rooms") return null;
  if (PAGES[start]) return PAGES[start];
  return start.startsWith("room-") ? start.slice(5) : null;
};

/**
 * Sidebar layout (`room_nav: sidebar`): ControlZ-style room sidebar with badges on the left,
 * the selected room (or All Rooms) on the right. Selection lives in the URL hash (`#room=office`)
 * so back / forward and deep links work. Becomes a horizontal room strip below 700 px.
 */
export class RoomsApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._selected = readHashRoom();
    if (!this._selected && !location.hash) this._selected = startSelection(takeStartPage());
    else takeStartPage();
    this._structure = null;
    this._sideSig = null;
    this._page = null;
    this._pageKey = null;
    this.shadowRoot.addEventListener("click", async (ev) => {
      const eye = ev.target.closest?.(".ri-eye");
      if (eye) {
        eye.disabled = true;
        try {
          if (eye.dataset.fav) await toggleFavorite(this._hass, "area", eye.dataset.area);
          else if (eye.dataset.move) {
            const shown = this._areas().map((a) => a.area_id);
            await setAreasOrder(this._hass, movedOrder(shown, eye.dataset.area, { delta: Number(eye.dataset.move) }));
          } else await setHidden(this._hass, "area", eye.dataset.area, eye.dataset.hide === "1");
        } catch (err) {
          eye.disabled = false;
          const error = this.shadowRoot.querySelector(".side-error");
          if (error) {
            error.hidden = false;
            error.textContent = err?.message || "Could not save the dashboard.";
          }
        }
        return;
      }
      const item = ev.target.closest?.(".room-item");
      if (item) this._select(item.dataset.area === ALL ? null : item.dataset.area);
    });
    this._onStructure = () => {
      this._structure = null;
      this._sync();
    };
    this._onFavorites = () => {
      this._sideSig = null;
      this._sync();
    };
    this.shadowRoot.addEventListener(SECURITY_SETTINGS_EVENT, (ev) => {
      ev.stopPropagation();
      openSecuritySettings(this);
    });
    this.shadowRoot.addEventListener(ROOM_SIZE_EVENT, (ev) => {
      ev.stopPropagation();
      saveRoomSizeForEveryone(this, ev.detail);
    });
    this.shadowRoot.addEventListener("controlz-select-area", (ev) => {
      ev.stopPropagation();
      this._select(ev.detail.area);
    });
    this._onPop = () => {
      this._selected = readHashRoom();
      this._sync();
    };
    this._resize = new ResizeObserver(([entry]) => {
      this.toggleAttribute("narrow", entry.contentRect.width < NARROW_PX);
    });
  }

  static getStubConfig() {
    return {};
  }

  connectedCallback() {
    window.addEventListener("popstate", this._onPop);
    window.addEventListener("hashchange", this._onPop);
    window.addEventListener(HIDDEN_EVENT, this._onStructure);
    window.addEventListener(EDIT_EVENT, this._onStructure);
    window.addEventListener(FAVORITES_EVENT, this._onFavorites);
    window.addEventListener(PREFS_EVENT, this._onFavorites);
    this._resize.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener("popstate", this._onPop);
    window.removeEventListener("hashchange", this._onPop);
    window.removeEventListener(HIDDEN_EVENT, this._onStructure);
    window.removeEventListener(EDIT_EVENT, this._onStructure);
    window.removeEventListener(FAVORITES_EVENT, this._onFavorites);
    window.removeEventListener(PREFS_EVENT, this._onFavorites);
    this._resize.disconnect();
  }

  setConfig(config) {
    this._config = { ...(config || {}) };
    this._structure = null;
    this._sync();
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

  get _editing() {
    return isEditing() && !!this._config.editable;
  }

  /** Rooms with devices; hidden rooms only while editing. */
  _areas() {
    const hidden = hiddenLists(this._config).areas;
    return sortedAreas(this._hass, { order: areasOrder(this._config) })
      .filter((a) => this._editing || !hidden.has(a.area_id))
      .filter((a) => areaItems(this._hass, a.area_id).length > 0);
  }

  get _showFavorites() {
    return this._config.favorites_view !== false;
  }

  get _showAutomations() {
    if (this._config.automations_view === false) return false;
    const count = Object.keys(this._hass.states || {}).length;
    if (this._autoCache?.entities !== this._hass.entities || this._autoCache.count !== count) {
      this._autoCache = { entities: this._hass.entities, count, any: automationGroups(this._hass).length > 0 };
    }
    return this._autoCache.any;
  }

  _select(area) {
    if (area === this._selected) return;
    this._selected = area;
    history.pushState(null, "", `${location.pathname}${location.search}${hashFor(area)}`);
    this._sync();
    this.shadowRoot.querySelector(".content")?.scrollIntoView?.({ block: "start" });
  }

  /** Page id / name for the View menu's "Start on this page". */
  _pageInfo(areas) {
    if (this._selected === DASH) return { id: "dashtop", name: "Dashtop" };
    if (this._selected === FAV) return { id: "favorites", name: "Favorites" };
    if (this._selected === AUTO) return { id: "automations", name: "Automations" };
    const page = pageOf(this._selected);
    if (page) return { id: page, name: PAGE_INFO[page].title };
    if (this._selected) return { id: `room-${this._selected}`, name: areas.find((a) => a.area_id === this._selected)?.name || this._selected };
    return { id: "rooms", name: "All Rooms" };
  }

  /** Needs Attention count for the sidebar badge (same rules as the page). */
  _attentionCount() {
    return attentionReport(this._hass, {
      threshold: effectiveBatteryThreshold(dashboardBatteryThreshold(this._config)),
      exclude: [...hiddenLists(this._config).entities],
      ignore: [...attentionIgnored(this._config)],
    }).count;
  }

  /** House pages with something to show (cached per registry / states change). */
  get _housePages() {
    const count = Object.keys(this._hass.states || {}).length;
    if (this._houseCache?.entities !== this._hass.entities || this._houseCache.count !== count) {
      this._houseCache = { entities: this._hass.entities, count, pages: availableHousePages(this._hass, this._config).map((p) => p.id) };
    }
    return this._houseCache.pages;
  }

  _sync() {
    if (!this._hass || !this._config) return;
    loadFavorites(this._hass);
    const areas = this._areas();
    const house = this._housePages;
    const special = (this._selected === FAV && this._showFavorites) || (this._selected === AUTO && this._showAutomations)
      || (this._selected === DASH && this._config.dashtop_view !== false) || house.includes(pageOf(this._selected));
    if (this._selected && !special && !areas.some((a) => a.area_id === this._selected)) this._selected = null;
    const structure = `${this._editing}|${this._showFavorites}|${this._showAutomations}|${house}|${areas.map((a) => `${a.area_id}:${a.name}`).join(",")}`;
    if (structure !== this._structure) {
      this._structure = structure;
      this._sideSig = null;
      this._pageKey = null;
      this.shadowRoot.innerHTML = `<style>${STYLES}</style>
        <div class="app">
          <nav class="sidebar" aria-label="Rooms">
            <div class="side-head"><span class="brand">${escapeHtml(this._config.title || "ControlZ")}</span>${viewMenuHtml(this._config, this._hass, this._pageInfo(areas))}</div>
            <div class="side-error" hidden></div>
            <div class="rooms" role="list"></div>
          </nav>
          <main class="content"></main>
        </div>`;
    }
    const menu = this.shadowRoot.querySelector("controlz-view-menu");
    const info = this._pageInfo(areas);
    if (menu && menu.getAttribute("page-id") !== info.id && this._config.editable) {
      menu.setAttribute("page-id", info.id);
      menu.setAttribute("page-name", info.name);
    }
    if (menu) {
      const area = info.id.startsWith("room-") ? info.id.slice("room-".length) : null;
      const everyone = area ? roomTileSizes(this._config)[area] || "" : "";
      if (!area) menu.removeAttribute("room-area");
      else if (menu.getAttribute("room-area") !== area) menu.setAttribute("room-area", area);
      if (area && menu.getAttribute("room-everyone") !== everyone) menu.setAttribute("room-everyone", everyone);
    }
    this._renderSidebar(areas);
    this._renderPage();
  }

  _chips(s) {
    const chips = [];
    if (s.lightsOn > 0) chips.push(`<span class="chip green">${ICONS.bulb}${s.allLightsOn ? ICONS.check : s.lightsOn}</span>`);
    if (s.outletsOn > 0) chips.push(`<span class="chip orange">${ICONS.outlet}${s.outletsOn}</span>`);
    if (s.covers.length && s.coversOpen > 0) chips.push(`<span class="chip blue">${ICONS.blinds}${s.coversOpen}</span>`);
    return chips.join("");
  }

  _renderSidebar(areas) {
    const report = securityReport(this._hass, { include: this._config.security_include, exclude: this._config.security_exclude });
    const secCount = report.insecure.length || report.warning.length || report.motion.length;
    const rows = [{
      id: ALL,
      name: "All Rooms",
      icon: roomIconSvg(DEFAULT_ROOM_ICON),
      on: false,
      special: true,
      chips: report.level === "secure" ? "" : `<span class="chip sec-${report.level}" title="${escapeHtml(report.text)}">${ICONS.shield}${secCount}</span>`,
    }];
    if (this._config.dashtop_view !== false) rows.push({ id: DASH, name: "Dashtop", icon: ICONS.desktop, on: false, special: true, chips: "" });
    if (this._showFavorites) rows.push({ id: FAV, name: "Favorites", icon: ICONS.heart, iconClass: "fav", on: false, special: true, chips: "" });
    if (this._showAutomations) rows.push({ id: AUTO, name: "Automations", icon: ICONS.gear, on: false, special: true, chips: "" });
    for (const id of this._housePages) {
      const attention = id === "attention" ? this._attentionCount() : 0;
      rows.push({
        id: HOUSE[id], name: PAGE_INFO[id].title, icon: PAGE_INFO[id].icon, on: false, special: true,
        chips: attention ? `<span class="chip sec-insecure" title="${attention} need attention">${ICONS.alert}${attention}</span>` : "",
      });
    }
    rows.at(-1).sep = true;
    const hiddenAreas = hiddenLists(this._config).areas;
    for (const a of areas) {
      const s = roomSummary(this._hass, masterItems(this._hass, a.area_id, this._config));
      const { icon } = resolveAreaIcon(this._hass, a.area_id, iconOptions(this._config), { coverOnly: !s.lights.length && !!s.covers.length });
      rows.push({
        id: a.area_id, name: a.name, icon: roomIconSvg(icon), on: s.lightsOn > 0, chips: this._chips(s),
        hidden: hiddenAreas.has(a.area_id), fav: isFavorite("area", a.area_id),
      });
    }
    const selected = this._selected || ALL;
    const editing = this._editing;
    const admin = !!this._hass.user?.is_admin;
    const sig = JSON.stringify([selected, editing, admin, rows]);
    if (sig === this._sideSig) return;
    this._sideSig = sig;
    const n = (r) => escapeHtml(r.name);
    const tools = (r) => (!editing || r.special ? "" : `
      <button type="button" class="ri-eye fav" data-area="${escapeHtml(r.id)}" data-fav="1" aria-pressed="${!!r.fav}"
        aria-label="${r.fav ? "Remove" : "Add"} ${n(r)} ${r.fav ? "from" : "to"} favorites" title="${r.fav ? "Remove from" : "Add to"} favorites">${r.fav ? ICONS.heart : ICONS.heartOutline}</button>
      ${admin ? `<button type="button" class="ri-eye" data-area="${escapeHtml(r.id)}" data-hide="${r.hidden ? "0" : "1"}"
          aria-pressed="${!!r.hidden}" aria-label="${r.hidden ? "Show" : "Hide"} ${n(r)}"
          title="${r.hidden ? "Show" : "Hide"} ${n(r)}">${r.hidden ? EYE_OFF : EYE}</button>
        <span class="ri-move">
          <button type="button" class="ri-eye" data-area="${escapeHtml(r.id)}" data-move="-1" aria-label="Move ${n(r)} up" title="Move up">${ICONS.chevronUp}</button>
          <button type="button" class="ri-eye" data-area="${escapeHtml(r.id)}" data-move="1" aria-label="Move ${n(r)} down" title="Move down">${ICONS.chevronDown}</button>
        </span>` : ""}`);
    this.shadowRoot.querySelector(".rooms").innerHTML = rows.map((r) => `
      <div role="listitem" class="ri-row${r.hidden ? " is-hidden" : ""}"><button type="button" class="room-item${r.on ? " on" : ""}" data-area="${escapeHtml(r.id)}"
        ${r.id === selected ? 'aria-current="page"' : ""} title="${n(r)}">
        <span class="ri-icon${r.iconClass ? ` ${r.iconClass}` : ""}" aria-hidden="true">${r.icon}</span>
        <span class="ri-name">${n(r)}</span>
        <span class="ri-chips">${r.chips}</span>
      </button>${tools(r)}</div>${r.sep ? `<div class="ri-sep" role="presentation"></div>` : ""}`).join("");
    this.shadowRoot.querySelector('.room-item[aria-current="page"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  _renderPage() {
    const key = this._selected || ALL;
    if (key !== this._pageKey) {
      this._pageKey = key;
      const shared = {
        tile_size: this._config.tile_size,
        tile_scale: this._config.tile_scale,
        editable: this._config.editable,
        room_nav: this._config.room_nav,
        ...hiddenOptions(this._config),
        ...securityOptions(this._config),
        show_menu: false,
        ...iconOptions(this._config),
      };
      let page;
      if (this._selected === DASH) {
        page = document.createElement("controlz-dashtop");
        page.setConfig({
          ...shared, select_rooms: true, areas_order: this._config.areas_order,
          ...(this._config.battery_threshold != null ? { battery_threshold: this._config.battery_threshold } : {}),
        });
      } else if (this._selected === FAV) {
        page = document.createElement("controlz-favorites-grid");
        page.setConfig({ ...shared, select_rooms: true, areas_order: this._config.areas_order, scenes_style: this._config.scenes_style || "chips" });
      } else if (this._selected === AUTO) {
        page = document.createElement("controlz-automations-grid");
        page.setConfig({ ...shared, areas_order: this._config.areas_order });
      } else if (pageOf(this._selected) === "attention") {
        page = document.createElement("controlz-attention-grid");
        page.setConfig({ ...shared, ...(this._config.battery_threshold != null ? { battery_threshold: this._config.battery_threshold } : {}) });
      } else if (pageOf(this._selected) === "weather") {
        page = document.createElement("controlz-weather-grid");
        page.setConfig({ ...shared, ...(this._config.weather_entity ? { weather_entity: this._config.weather_entity } : {}) });
      } else if (pageOf(this._selected)) {
        page = document.createElement("controlz-house-grid");
        page.setConfig({
          ...shared, page: pageOf(this._selected), areas_order: this._config.areas_order, hide_areas: this._config.hide_areas,
          ...(this._config.battery_threshold != null ? { battery_threshold: this._config.battery_threshold } : {}),
        });
      } else if (this._selected) {
        page = document.createElement("controlz-room-grid");
        page.setConfig({ ...shared, ...securityOptions(this._config), area: this._selected, scenes_style: this._config.scenes_style || "chips" });
      } else {
        page = document.createElement("controlz-home-grid");
        page.setConfig({
          ...shared,
          select_rooms: true,
          areas_order: this._config.areas_order,
          hide_areas: this._config.hide_areas,
          ...securityOptions(this._config),
          ...(this._config.battery_threshold != null ? { battery_threshold: this._config.battery_threshold } : {}),
          ...(this._config.show_maintenance != null ? { show_maintenance: this._config.show_maintenance } : {}),
        });
      }
      this._page = page;
      this.shadowRoot.querySelector(".content").replaceChildren(page);
    }
    this._page.hass = this._hass;
  }
}
