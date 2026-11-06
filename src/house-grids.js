import { visibleItems } from "./area-cache.js";
import { escapeHtml } from "./base.js";
import { CzPage, editWrap } from "./grids.js";
import { areasOrder } from "./hidden.js";
import { ICONS } from "./icons.js";
import {
  KIND, coverIsOpen, friendlyName, isUnavailable, looseItems, maintenanceReport, sensorTypeGroups, sortedAreas,
} from "./model.js";
import { readPrefs, writePrefs } from "./prefs.js";
import { WEATHER_ICON } from "./weather-grid.js";
import { pickWeather } from "./weather-model.js";

/** House-wide pages (ControlZ system rooms): which tile kinds each lists. */
export const HOUSE_PAGES = Object.freeze({
  coverings: { title: "Window Coverings", kinds: [KIND.COVER], icon: ICONS.blinds },
  cameras: { title: "Cameras", kinds: [KIND.CAMERA], icon: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>` },
  sensors: { title: "Sensors", kinds: [KIND.SENSOR, KIND.MOTION], icon: ICONS.walk },
});

const SENSOR_TABS = [
  { id: "rooms", label: "By room" },
  { id: "types", label: "By type" },
  { id: "battery", label: "Batteries & offline" },
];

/** Room groups of a house page's kinds (dashboard room order), then "No room"; hidden rooms and devices left out. */
export function houseGroups(hass, config, kinds, hidden) {
  const wanted = new Set(kinds);
  const groups = sortedAreas(hass, { order: areasOrder(config) })
    .filter((a) => !hidden.areas.has(a.area_id))
    .map((a) => ({ id: a.area_id, name: a.name, items: visibleItems(hass, a.area_id, config).filter((i) => wanted.has(i.kind)) }))
    .filter((g) => g.items.length);
  const loose = looseItems(hass, kinds, hidden.entities);
  if (loose.length) groups.push({ id: "", name: "No room", items: loose });
  return groups;
}

/**
 * House pages with something to show, unless turned off (`coverings_view` / `cameras_view` /
 * `sensors_view` / `weather_view: false`). Weather needs a weather entity.
 */
export function availableHousePages(hass, config) {
  const hidden = { areas: new Set(config.hide_areas || []), entities: new Set(config.hide_entities || []) };
  const pages = Object.entries(HOUSE_PAGES)
    .filter(([id, p]) => config[`${id}_view`] !== false && houseGroups(hass, config, p.kinds, hidden).length > 0)
    .map(([id, p]) => ({ id, ...p }));
  if (config.weather_view !== false && pickWeather(hass, config.weather_entity)) pages.push({ id: "weather", title: "Weather", icon: WEATHER_ICON, kinds: [] });
  return pages;
}

/**
 * House-wide page (ControlZ Window Coverings / Cameras / Sensors system rooms): every device of
 * one kind, by room. Coverings add Open all / Stop / Close all; Sensors switch between rooms,
 * types (ControlZ Sensor Report) and batteries & offline devices.
 */
export class HouseGrid extends CzPage {
  static getStubConfig() {
    return { page: "coverings" };
  }

  constructor() {
    super();
    this.shadowRoot.addEventListener("click", (ev) => {
      const hit = ev.composedPath().find((el) => el instanceof HTMLElement && el.matches?.("[data-cover-all], [data-sensor-tab], [data-list-entity]"));
      if (!hit) return;
      if (hit.dataset.coverAll) this._allCovers(hit.dataset.coverAll);
      else if (hit.dataset.sensorTab) writePrefs({ sensors_tab: hit.dataset.sensorTab === "rooms" ? null : hit.dataset.sensorTab });
      else this.moreInfo(hit.dataset.listEntity);
    });
  }

  normalizeConfig(config) {
    if (!HOUSE_PAGES[config.page]) throw new Error("controlz-house-grid: `page` is coverings, cameras or sensors");
    return { battery_threshold: 20, ...config };
  }

  get _page() {
    return HOUSE_PAGES[this._config.page];
  }

  get _tab() {
    const tab = readPrefs().sensors_tab;
    return this._config.page === "sensors" && SENSOR_TABS.some((t) => t.id === tab) ? tab : "rooms";
  }

  prefsChangeStructure() {
    return this._config.page === "sensors" && this._builtTab !== this._tab;
  }

  _groups() {
    return houseGroups(this._hass, this._config, this._page.kinds, this._editMode ? { areas: new Set(), entities: new Set() } : this._hiddenSets);
  }

  _covers() {
    return this._groups().flatMap((g) => g.items).map((i) => i.entity_id).filter((id) => !isUnavailable(this._hass.states[id]));
  }

  structureKey() {
    return `${this._config.page}|${this._tab}|${this._groups().map((g) => `${g.id}:${g.name}:${g.items.map((i) => i.entity_id)}`).join("|")}`;
  }

  _tiles(grid, items) {
    const hidden = this._hiddenSets.entities;
    for (const item of items) {
      const tile = this.tile(item.kind, { entity: item.entity_id });
      grid.append(this._editMode
        ? editWrap(tile, { kind: "entity", id: item.entity_id, name: friendlyName(this._hass, item.entity_id), hidden: hidden.has(item.entity_id), canHide: this._isAdmin })
        : tile);
    }
  }

  _section(page, title, items) {
    const section = document.createElement("section");
    section.innerHTML = `<h2>${escapeHtml(title)} (${items.length})</h2><div class="grid"></div>`;
    this._tiles(section.querySelector(".grid"), items);
    page.append(section);
  }

  build(page) {
    const { title, icon } = this._page;
    const name = this._config.title || title;
    this.header(page, `<h1 class="page-title"><span class="title-icon">${icon}</span>${escapeHtml(name)}<span class="readings-inline"></span></h1>`,
      { id: this._config.page, name });
    this._builtTab = this._tab;
    this._rowHtml = null;
    if (this._config.page !== "cameras") page.insertAdjacentHTML("beforeend", `<div class="filter-row"></div>`);
    if (this._tab === "battery") {
      page.insertAdjacentHTML("beforeend", `<div class="list-rows"></div>`);
      return;
    }
    const groups = this._groups();
    if (!groups.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">No ${escapeHtml(title.toLowerCase())} in Home Assistant yet.</div>`);
      return;
    }
    if (this._tab === "types") {
      for (const g of sensorTypeGroups(this._hass, groups.flatMap((x) => x.items))) this._section(page, g.title, g.items);
      return;
    }
    for (const g of groups) this._section(page, g.name, g.items);
  }

  update() {
    const row = this.shadowRoot.querySelector(".filter-row");
    if (row) {
      const html = this._config.page === "coverings" ? this._coverRow() : this._sensorRow();
      if (html !== this._rowHtml) {
        this._rowHtml = html;
        row.innerHTML = html;
      }
    }
    const list = this.shadowRoot.querySelector(".list-rows");
    if (list) {
      const html = this._batteryList();
      if (html !== this._listHtml) {
        this._listHtml = html;
        list.innerHTML = html;
      }
    }
    const readings = this.shadowRoot.querySelector(".readings-inline");
    if (readings && this._config.page === "coverings") {
      const ids = this._covers();
      const text = ids.length ? `${ids.filter((id) => coverIsOpen(this._hass.states[id])).length} of ${ids.length} open` : "";
      if (readings.textContent !== text) readings.textContent = text;
    }
  }

  _coverRow() {
    const ids = this._covers();
    if (!ids.length || this._editMode) return "";
    const open = ids.filter((id) => coverIsOpen(this._hass.states[id])).length;
    return `
      <button type="button" class="pill" data-cover-all="open_cover" title="Open every covering on this page">⬆ Open all (${ids.length - open})</button>
      <button type="button" class="pill" data-cover-all="stop_cover">■ Stop all</button>
      <button type="button" class="pill" data-cover-all="close_cover" title="Close every covering on this page">⬇ Close all (${open})</button>`;
  }

  _sensorRow() {
    if (this._editMode) return "";
    const tab = this._tab;
    return `<div class="seg" role="group" aria-label="Show sensors">${SENSOR_TABS.map((t) =>
      `<button type="button" data-sensor-tab="${t.id}" aria-pressed="${t.id === tab}">${t.label}</button>`).join("")}</div>`;
  }

  _batteryList() {
    const m = maintenanceReport(this._hass, { threshold: Number(this._config.battery_threshold) || 20, exclude: this._config.hide_entities });
    const levels = [];
    for (const [entityId, entry] of Object.entries(this._hass.entities || {})) {
      const s = this._hass.states[entityId];
      if (entry.disabled_by || entry.hidden || entry.hidden_by || s?.attributes?.device_class !== "battery" || entityId.split(".")[0] !== "sensor") continue;
      if (isUnavailable(s) || !Number.isFinite(Number(s.state))) continue;
      const device = entry.device_id ? this._hass.devices?.[entry.device_id] : null;
      levels.push({ entity_id: entityId, name: device?.name_by_user || device?.name || friendlyName(this._hass, entityId), level: Math.round(Number(s.state)) });
    }
    levels.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const row = (i, right, cls = "") => `<button type="button" class="list-row" data-list-entity="${escapeHtml(i.entity_id)}">
      <span>${escapeHtml(i.name)}${i.area ? ` <span class="what">· ${escapeHtml(i.area)}</span>` : ""}</span><span class="level ${cls}">${escapeHtml(right)}</span></button>`;
    return `
      ${m.unavailable.length ? `<h2>Offline (${m.unavailable.length})</h2>${m.unavailable.map((i) => row(i, "offline", "off")).join("")}` : ""}
      <h2>Batteries (${levels.length})</h2>
      ${levels.length ? levels.map((i) => row(i, `${i.level}%`, i.level < m.threshold ? "low" : "")).join("") : `<p class="hint">No battery sensors.</p>`}
      <p class="hint">Under ${m.threshold}% counts as low (battery_threshold).</p>`;
  }

  _allCovers(service) {
    const ids = this._covers();
    if (!ids.length) return;
    const verb = { open_cover: "Open", close_cover: "Close", stop_cover: "Stop" }[service];
    if (service !== "stop_cover" && !this.confirmAction(`${verb} ${ids.length} covering${ids.length === 1 ? "" : "s"}?`)) return;
    this._hass.callService("cover", service, { entity_id: ids });
  }

  confirmAction(message) {
    return window.confirm(message);
  }
}
