import { visibleItems } from "./area-cache.js";
import { escapeHtml } from "./base.js";
import { isFavorite } from "./favorites.js";
import {
  HISTORY_RANGES, SECURITY_EVENT_TYPES, countTurnsOn, eventsCsv, filterEvents, historyItems, historyPoints, numericSeries,
  onPeriods, rangeHours, securityEvents, securityHistoryIds, seriesStats, sparkline,
} from "./history-model.js";
import { areasOrder, hiddenLists } from "./hidden.js";
import { domainOf, formatSensorValue, friendlyName, isUnavailable, sortedAreas } from "./model.js";
import { sheetFrame } from "./sheet.js";

const HOUR_MS = 3_600_000;
const MAX_ROWS = 400;

/** Home Assistant recorder history for `entityIds` over `[start, end]` (compressed, no attributes). */
export function fetchHistory(hass, entityIds, start, end = Date.now()) {
  if (!entityIds.length) return Promise.resolve({});
  return hass.callWS({
    type: "history/history_during_period",
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    entity_ids: entityIds,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
}

const CHART_COLORS = {
  temperature: "#ea580c", humidity: "#2563eb", illuminance: "#d97706", carbon_dioxide: "#0d9488", power: "#7c3aed",
};
const ON_COLORS = { motion: "#dc2626", door: "#ea580c", window: "#ea580c", lock: "#b91c1c", alarm: "#b91c1c" };

const timeLabel = (t, hours) => new Date(t).toLocaleString([], hours > 24
  ? { weekday: "short", hour: "2-digit", minute: "2-digit" }
  : { hour: "2-digit", minute: "2-digit" });

function duration(ms) {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

const isBinary = (entityId) => ["binary_sensor", "lock", "cover", "alarm_control_panel"].includes(domainOf(entityId));
const binaryOn = (entityId) => (domainOf(entityId) === "lock"
  ? (s) => s === "unlocked" || s === "open" || s === "jammed"
  : domainOf(entityId) === "cover" ? (s) => s === "open" || s === "opening"
    : domainOf(entityId) === "alarm_control_panel" ? (s) => s === "triggered" : (s) => s === "on");

/** Chart for one entity: a step line for numbers, an on/off bar for sensors, doors and locks. */
function chartHtml(hass, entityId, entries, { start, end, hours, small = false }) {
  const points = historyPoints(entries);
  const stateObj = hass.states[entityId];
  const dc = stateObj?.attributes?.device_class;
  const axis = small ? "" : `<div class="hist-axis"><span>${escapeHtml(timeLabel(start, hours))}</span><span>Now</span></div>`;
  if (isBinary(entityId)) {
    const on = binaryOn(entityId);
    const periods = onPeriods(points, { start, end, isOn: on });
    const color = ON_COLORS[dc === "motion" || dc === "occupancy" || dc === "presence" ? "motion" : domainOf(entityId) === "lock" ? "lock" : "door"];
    const bars = periods.map((p) => `<span style="left:${((p.from - start) / (end - start)) * 100}%;width:${Math.max(0.4, ((p.to - p.from) / (end - start)) * 100)}%;background:${color}"></span>`).join("");
    const total = periods.reduce((a, p) => a + p.to - p.from, 0);
    const times = countTurnsOn(points, start, on);
    const word = domainOf(entityId) === "lock" ? "Unlocked" : dc === "motion" || dc === "occupancy" || dc === "presence" ? "Motion" : "Open";
    return {
      html: `<div class="hist-bar${small ? " small" : ""}" role="img" aria-label="${word} ${times} times">${bars}</div>${axis}`,
      stats: points.length ? `${word} ${times} time${times === 1 ? "" : "s"}${total ? ` · ${duration(total)} in all` : ""}` : "No history recorded",
    };
  }
  const series = numericSeries(points);
  const stats = seriesStats(series, start, end);
  if (!stats) return { html: `<p class="note">No history recorded for this time.</p>`, stats: "" };
  const height = small ? 44 : 110;
  const { line, fill } = sparkline(series, { start, end, width: 300, height });
  const color = CHART_COLORS[dc] || "#4f46e5";
  const unit = stateObj?.attributes?.unit_of_measurement || "";
  const fmt = (v) => formatSensorValue({ state: String(v), attributes: { unit_of_measurement: unit } });
  return {
    html: `<div class="hist-chart${small ? " small" : ""}">
      <svg viewBox="0 0 300 ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`From ${fmt(stats.min)} to ${fmt(stats.max)}`)}">
        <path d="${fill}" fill="${color}" fill-opacity="0.14" stroke="none"></path>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></path>
      </svg>
      ${small ? "" : `<span class="hist-max">${escapeHtml(fmt(stats.max))}</span><span class="hist-min">${escapeHtml(fmt(stats.min))}</span>`}
    </div>${axis}`,
    stats: `Low ${fmt(stats.min)} · High ${fmt(stats.max)} · Average ${fmt(stats.avg)}`,
  };
}

/** Sheet owners that are not tiles: the host keeps pushing `hass`, so the sheet re-renders through it. */
class HistorySheet {
  constructor(host) {
    this._host = host;
    this._range = "24h";
    this._data = null;
    this._error = null;
    this._loading = false;
    this._token = 0;
  }

  get hass() {
    return this._host.hass;
  }

  moreInfo(entityId) {
    this._host.moreInfo(entityId);
  }

  sheetDetailsEntity() {
    return null;
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  ids() {
    return [];
  }

  get _window() {
    const end = this._end || Date.now();
    return { start: end - rangeHours(this._range) * HOUR_MS, end, hours: rangeHours(this._range) };
  }

  async load() {
    const token = ++this._token;
    this._end = Date.now();
    const { start, end } = this._window;
    this._loading = true;
    this._error = null;
    this._rerender();
    try {
      const data = await fetchHistory(this.hass, this.ids(), start, end);
      if (token !== this._token) return;
      this._data = data || {};
    } catch (err) {
      if (token !== this._token) return;
      this._error = err?.message || "Home Assistant did not return any history. Is the recorder on?";
    }
    this._loading = false;
    this._rerender();
  }

  _rangeSeg() {
    return `<div class="btn-wrap" role="group" aria-label="Time range">${HISTORY_RANGES.map((r) =>
      `<button type="button" class="btn secondary" data-action="hist-range" data-range="${r.id}" aria-pressed="${r.id === this._range}">${r.label}</button>`).join("")}</div>`;
  }

  _status() {
    if (this._error) return `<p class="error">${escapeHtml(this._error)}</p>`;
    if (this._loading && !this._data) return `<p class="note">Loading history…</p>`;
    return "";
  }

  get actions() {
    return {
      "hist-range": (button) => {
        this._range = button.dataset.range;
        this.load();
      },
    };
  }
}

/** One sensor's history (ControlZ Sensor History chart): range, chart, low / high / average. */
class EntityHistory extends HistorySheet {
  constructor(host, entityId) {
    super(host);
    this._entityId = entityId;
  }

  ids() {
    return [this._entityId];
  }

  sheetDetailsEntity() {
    return this._entityId;
  }

  favoriteTarget() {
    return { kind: "entity", id: this._entityId };
  }

  sheetBody() {
    const stateObj = this.hass.states[this._entityId];
    const now = isUnavailable(stateObj) ? "Offline"
      : isBinary(this._entityId) ? String(stateObj.state).replace(/_/g, " ") : formatSensorValue(stateObj);
    const chart = this._data ? chartHtml(this.hass, this._entityId, this._data[this._entityId], this._window) : null;
    const body = `
      <div class="sheet-section">${this._rangeSeg()}${this._status()}
        ${chart ? `${chart.html}${chart.stats ? `<p class="hist-stats">${escapeHtml(chart.stats)}</p>` : ""}` : ""}
      </div>`;
    return sheetFrame({
      title: friendlyName(this.hass, this._entityId),
      subtitle: `Now ${now}`,
      body,
      detailsEntity: this._entityId,
      favorite: isFavorite("entity", this._entityId),
    });
  }
}

/** Every sensor in a room on one sheet: a small chart and the low / high for each (ControlZ Sensor State Report). */
class RoomHistory extends HistorySheet {
  constructor(host, areaId) {
    super(host);
    this._areaId = areaId;
  }

  _items() {
    return historyItems(visibleItems(this.hass, this._areaId, this._host._config || {}));
  }

  ids() {
    return this._items().map((i) => i.entity_id);
  }

  sheetBody() {
    const items = this._items();
    const rows = this._data ? items.map((i) => {
      const chart = chartHtml(this.hass, i.entity_id, this._data[i.entity_id], { ...this._window, small: true });
      const stateObj = this.hass.states[i.entity_id];
      const now = isUnavailable(stateObj) ? "Offline" : isBinary(i.entity_id) ? (stateObj.state === "on" ? "Motion" : "Clear") : formatSensorValue(stateObj);
      return `<button type="button" class="hist-row" data-action="hist-entity" data-entity="${escapeHtml(i.entity_id)}">
        <span class="hist-row-head"><span class="hist-name">${escapeHtml(friendlyName(this.hass, i.entity_id))}</span><span class="hist-now">${escapeHtml(now)}</span></span>
        ${chart.html}
        ${chart.stats ? `<span class="hist-stats">${escapeHtml(chart.stats)}</span>` : ""}
      </button>`;
    }).join("") : "";
    const name = this.hass.areas?.[this._areaId]?.name || this._areaId;
    return sheetFrame({
      title: `${name} history`,
      subtitle: items.length ? `${items.length} sensor${items.length === 1 ? "" : "s"}` : "",
      body: `<div class="sheet-section">${this._rangeSeg()}${this._status()}</div>
        ${items.length ? `<div class="sheet-section hist-list">${rows}</div>` : `<p class="note">This room has no temperature, humidity, light or motion sensors.</p>`}`,
    });
  }

  get actions() {
    return {
      ...super.actions,
      "hist-entity": (row) => openEntityHistory(this._host, row.dataset.entity, this._range),
    };
  }
}

/**
 * Security Trigger History (ControlZ): doors, windows, locks, alarms and motion changes, filtered
 * by time, type, room and a search, with CSV export.
 */
class SecurityHistory extends HistorySheet {
  constructor(host) {
    super(host);
    this._type = "all";
    this._area = "";
    this._query = "";
  }

  ids() {
    const config = this._host._config || {};
    const ids = securityHistoryIds(this.hass, { exclude: [...(config.security_exclude || []), ...hiddenLists(config).entities] });
    const only = new Set(config.security_include || []);
    return only.size ? ids.filter((id) => only.has(id)) : ids;
  }

  _events() {
    if (!this._data) return [];
    return securityEvents(this.hass, this._data, this._window);
  }

  _filtered() {
    return filterEvents(this._events(), { type: this._type, area: this._area, query: this._query });
  }

  _listHtml() {
    const events = this._filtered();
    if (!this._data) return "";
    if (!events.length) return `<p class="note">Nothing happened${this._type !== "all" || this._area || this._query ? " that matches" : ""} in the last ${HISTORY_RANGES.find((r) => r.id === this._range).label}.</p>`;
    let day = "";
    const rows = [];
    for (const e of events.slice(0, MAX_ROWS)) {
      const d = new Date(e.t).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
      if (d !== day) {
        day = d;
        rows.push(`<div class="section-label hist-day">${escapeHtml(d)}</div>`);
      }
      const dot = e.alert ? "#dc2626" : e.type === "motion" && e.state === "on" ? "#ca8a04" : "#16a34a";
      rows.push(`<button type="button" class="sec-row" data-action="hist-open" data-entity="${escapeHtml(e.entity_id)}">
        <span class="hist-time">${escapeHtml(new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span>
        <span class="dot" style="background:${dot}"></span>
        <span>${escapeHtml(e.name)}${e.area ? ` <span class="what">· ${escapeHtml(e.area)}</span>` : ""}</span>
        <span class="what">${escapeHtml(e.label)}</span></button>`);
    }
    if (events.length > MAX_ROWS) rows.push(`<p class="note">Showing the newest ${MAX_ROWS} of ${events.length}. Export has them all.</p>`);
    return rows.join("");
  }

  _rooms() {
    const config = this._host._config || {};
    const hidden = hiddenLists(config).areas;
    return sortedAreas(this.hass, { order: areasOrder(config) }).filter((a) => !hidden.has(a.area_id) || a.area_id === this._area);
  }

  sheetBody() {
    const count = this._data ? this._filtered().length : null;
    const body = `
      <div class="sheet-section">
        ${this._rangeSeg()}
        <div class="btn-wrap" role="group" aria-label="Type">${SECURITY_EVENT_TYPES.map((t) =>
          `<button type="button" class="btn secondary" data-action="hist-type" data-type="${t.id}" aria-pressed="${t.id === this._type}">${t.label}</button>`).join("")}</div>
        <div class="field-row">
          <label class="field"><span>Room</span><select data-action="hist-area" aria-label="Room">
            <option value="" ${this._area ? "" : "selected"}>Every room</option>
            ${this._rooms().map((a) => `<option value="${escapeHtml(a.area_id)}" ${a.area_id === this._area ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}
          </select></label>
          <label class="field"><span>Search</span><input type="search" data-action="hist-query" value="${escapeHtml(this._query)}" placeholder="Front door…" /></label>
        </div>
        ${this._status()}
      </div>
      <div class="sheet-section hist-events">${this._listHtml()}</div>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="hist-csv" ${count ? "" : "disabled"}>Export CSV</button>
      <button type="button" class="btn" data-action="sheet-close">Done</button>`;
    return sheetFrame({
      title: "Security history",
      subtitle: count == null ? "Doors, windows, locks, alarms and motion" : `${count} change${count === 1 ? "" : "s"}`,
      body,
      footer,
      wide: true,
    });
  }

  _updateList() {
    const root = this._host._sheet?.shadowRoot;
    const list = root?.querySelector(".hist-events");
    if (list) list.innerHTML = this._listHtml();
    const sub = root?.querySelector(".sheet-sub");
    if (sub && this._data) sub.textContent = `${this._filtered().length} changes`;
  }

  _download() {
    const csv = eventsCsv(this._filtered());
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `security-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  get actions() {
    return {
      ...super.actions,
      "hist-type": (button) => {
        this._type = button.dataset.type;
        this._rerender();
      },
      "change:hist-area": (select) => {
        this._area = select.value;
        this._rerender();
      },
      "input:hist-query": (input) => {
        this._query = input.value;
        this._updateList();
      },
      "hist-open": (row) => {
        this._host._sheet?.close();
        this.moreInfo(row.dataset.entity);
      },
      "hist-csv": () => this._download(),
    };
  }
}

function show(host, owner) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(owner);
  owner.load();
}

/** History chart for one entity in the host's sheet. */
export function openEntityHistory(host, entityId, range = "24h") {
  const owner = new EntityHistory(host, entityId);
  owner._range = range;
  show(host, owner);
}

/** Every sensor in a room. */
export const openRoomHistory = (host, areaId) => show(host, new RoomHistory(host, areaId));

/** Security trigger history for the whole house (security scope from the host's config). */
export const openSecurityHistory = (host) => show(host, new SecurityHistory(host));
