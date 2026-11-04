import { areaItems, visibleItems } from "./area-cache.js";
import { escapeHtml } from "./base.js";
import { hiddenOptions, iconOptions, viewMenuHtml } from "./grids.js";
import { EDIT_EVENT, HIDDEN_EVENT, hiddenLists, isEditing, setHidden } from "./hidden.js";
import { ICONS } from "./icons.js";
import { roomSummary, securityReport, sortedAreas } from "./model.js";
import { DEFAULT_ROOM_ICON, resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { TOKENS } from "./styles.js";

const ALL = "__all";
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
  .room-item[aria-current="page"] { background: rgba(79,70,229,0.12); border-color: rgba(79,70,229,0.35); }
  .room-item:focus-visible { outline: 2px solid var(--cz-primary); outline-offset: 1px; }
  .ri-icon {
    width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
    background: var(--cz-bg-secondary); border: 1px solid var(--cz-border); color: var(--cz-text);
  }
  .ri-icon svg { width: 18px; height: 18px; }
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
  :host([narrow]) .ri-row { flex-direction: column; }

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

const readHashRoom = () => {
  const match = /(?:^|[#&])room=([^&]+)/.exec(location.hash);
  return match ? decodeURIComponent(match[1]) : null;
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
    this._structure = null;
    this._sideSig = null;
    this._page = null;
    this._pageKey = null;
    this.shadowRoot.addEventListener("click", async (ev) => {
      const eye = ev.target.closest?.(".ri-eye");
      if (eye) {
        eye.disabled = true;
        try {
          await setHidden(this._hass, "area", eye.dataset.area, eye.dataset.hide === "1");
        } catch (err) {
          eye.disabled = false;
          eye.title = err?.message || "Could not save the dashboard.";
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
    this._resize.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener("popstate", this._onPop);
    window.removeEventListener("hashchange", this._onPop);
    window.removeEventListener(HIDDEN_EVENT, this._onStructure);
    window.removeEventListener(EDIT_EVENT, this._onStructure);
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
    return sortedAreas(this._hass, { order: this._config.areas_order })
      .filter((a) => this._editing || !hidden.has(a.area_id))
      .filter((a) => areaItems(this._hass, a.area_id).length > 0);
  }

  _select(area) {
    if (area === this._selected) return;
    this._selected = area;
    const hash = area ? `#room=${encodeURIComponent(area)}` : "";
    history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
    this._sync();
    this.shadowRoot.querySelector(".content")?.scrollIntoView?.({ block: "start" });
  }

  _sync() {
    if (!this._hass || !this._config) return;
    const areas = this._areas();
    if (this._selected && !areas.some((a) => a.area_id === this._selected)) this._selected = null;
    const structure = `${this._editing}|${areas.map((a) => `${a.area_id}:${a.name}`).join(",")}`;
    if (structure !== this._structure) {
      this._structure = structure;
      this._sideSig = null;
      this._pageKey = null;
      this.shadowRoot.innerHTML = `<style>${STYLES}</style>
        <div class="app">
          <nav class="sidebar" aria-label="Rooms">
            <div class="side-head"><span class="brand">${escapeHtml(this._config.title || "ControlZ")}</span>${viewMenuHtml(this._config, this._hass)}</div>
            <div class="rooms" role="list"></div>
          </nav>
          <main class="content"></main>
        </div>`;
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
      chips: report.level === "secure" ? "" : `<span class="chip sec-${report.level}" title="${escapeHtml(report.text)}">${ICONS.shield}${secCount}</span>`,
    }];
    const hiddenAreas = hiddenLists(this._config).areas;
    for (const a of areas) {
      const s = roomSummary(this._hass, visibleItems(this._hass, a.area_id, this._config));
      const { icon } = resolveAreaIcon(this._hass, a.area_id, iconOptions(this._config), { coverOnly: !s.lights.length && !!s.covers.length });
      rows.push({ id: a.area_id, name: a.name, icon: roomIconSvg(icon), on: s.lightsOn > 0, chips: this._chips(s), hidden: hiddenAreas.has(a.area_id) });
    }
    const selected = this._selected || ALL;
    const editing = this._editing;
    const sig = JSON.stringify([selected, editing, rows]);
    if (sig === this._sideSig) return;
    this._sideSig = sig;
    const eye = (r) => editing && r.id !== ALL
      ? `<button type="button" class="ri-eye" data-area="${escapeHtml(r.id)}" data-hide="${r.hidden ? "0" : "1"}"
          aria-pressed="${!!r.hidden}" aria-label="${r.hidden ? "Show" : "Hide"} ${escapeHtml(r.name)}"
          title="${r.hidden ? "Show" : "Hide"} ${escapeHtml(r.name)}">${r.hidden ? EYE_OFF : EYE}</button>`
      : "";
    this.shadowRoot.querySelector(".rooms").innerHTML = rows.map((r) => `
      <div role="listitem" class="ri-row${r.hidden ? " is-hidden" : ""}"><button type="button" class="room-item${r.on ? " on" : ""}" data-area="${escapeHtml(r.id)}"
        ${r.id === selected ? 'aria-current="page"' : ""} title="${escapeHtml(r.name)}">
        <span class="ri-icon" aria-hidden="true">${r.icon}</span>
        <span class="ri-name">${escapeHtml(r.name)}</span>
        <span class="ri-chips">${r.chips}</span>
      </button>${eye(r)}</div>`).join("");
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
        show_menu: false,
        ...iconOptions(this._config),
      };
      const page = this._selected
        ? document.createElement("controlz-room-grid")
        : document.createElement("controlz-home-grid");
      page.setConfig(this._selected
        ? { ...shared, area: this._selected, scenes_style: this._config.scenes_style || "chips" }
        : {
            ...shared,
            select_rooms: true,
            areas_order: this._config.areas_order,
            hide_areas: this._config.hide_areas,
            security_include: this._config.security_include,
            security_exclude: this._config.security_exclude,
          });
      this._page = page;
      this.shadowRoot.querySelector(".content").replaceChildren(page);
    }
    this._page.hass = this._hass;
  }
}
