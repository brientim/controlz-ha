/**
 * Sensor history and security trigger history (ControlZ `SensorHistory` / `SecurityTriggerHistory`),
 * over Home Assistant's recorder (`history/history_during_period`). Pure: unit tested in
 * test/history-model.test.js.
 */
import { KIND, areaOfEntity, classifyEntity, domainOf, friendlyName } from "./model.js";

export const HISTORY_RANGES = Object.freeze([
  { id: "6h", label: "6 h", hours: 6 },
  { id: "24h", label: "24 h", hours: 24 },
  { id: "7d", label: "7 days", hours: 168 },
]);

export const rangeHours = (id) => (HISTORY_RANGES.find((r) => r.id === id) || HISTORY_RANGES[1]).hours;

const OFFLINE = new Set(["unavailable", "unknown"]);

/**
 * `[{ t, s }]` (t in ms, oldest first) from one entity's history. Reads the compressed format
 * (`s`, `lc` / `lu` in seconds) and the older long format (`state`, `last_changed`).
 */
export function historyPoints(entries) {
  const out = [];
  for (const e of entries || []) {
    const s = e?.s ?? e?.state;
    const seconds = e?.lc ?? e?.lu;
    const t = typeof seconds === "number" ? seconds * 1000 : Date.parse(e?.last_changed ?? e?.last_updated);
    if (s == null || !Number.isFinite(t)) continue;
    out.push({ t, s: String(s) });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Numeric readings only (offline and text states dropped). */
export const numericSeries = (points) =>
  points.filter((p) => !OFFLINE.has(p.s) && Number.isFinite(Number(p.s))).map((p) => ({ t: p.t, v: Number(p.s) }));

const round1 = (n) => Math.round(n * 10) / 10;

/** Lowest, highest and time-weighted average over `[start, end]`, or null without readings. */
export function seriesStats(series, start, end) {
  if (!series.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let weighted = 0;
  let span = 0;
  series.forEach((p, i) => {
    min = Math.min(min, p.v);
    max = Math.max(max, p.v);
    const from = Math.max(p.t, start);
    const to = Math.min(series[i + 1]?.t ?? end, end);
    if (to > from) {
      weighted += p.v * (to - from);
      span += to - from;
    }
  });
  const avg = span ? weighted / span : series.reduce((a, p) => a + p.v, 0) / series.length;
  return { min: round1(min), max: round1(max), avg: round1(avg), last: round1(series.at(-1).v), count: series.length };
}

/**
 * SVG step line for a numeric series in a `width` × `height` box over `[start, end]`
 * (each reading holds until the next, like Home Assistant's history graph). `fill` closes it for an area.
 */
export function sparkline(series, { start, end, width = 300, height = 80, pad = 4 }) {
  if (!series.length || end <= start) return { line: "", fill: "", min: null, max: null };
  const values = series.map((p) => p.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    min -= 1;
    max += 1;
  }
  const x = (t) => round1(((Math.min(Math.max(t, start), end) - start) / (end - start)) * width);
  const y = (v) => round1(pad + (1 - (v - min) / (max - min)) * (height - pad * 2));
  const parts = [];
  series.forEach((p, i) => {
    const px = x(p.t);
    const py = y(p.v);
    if (i === 0) parts.push(`M${px} ${py}`);
    else parts.push(`H${px}`, `V${py}`);
  });
  parts.push(`H${width}`);
  const line = parts.join(" ");
  return { line, fill: `${line} V${height} H${x(series[0].t)} Z`, min: round1(min), max: round1(max) };
}

/** Periods (`{ from, to }`, ms) where an on/off entity was on, clipped to `[start, end]`. */
export function onPeriods(points, { start, end, isOn = (s) => s === "on" }) {
  const out = [];
  points.forEach((p, i) => {
    if (!isOn(p.s)) return;
    const from = Math.max(p.t, start);
    const to = Math.min(points[i + 1]?.t ?? end, end);
    if (to > from) out.push({ from, to });
  });
  return out;
}

/** How often an on/off entity turned on inside `[start, end]`. */
export function countTurnsOn(points, start, isOn = (s) => s === "on") {
  let n = 0;
  points.forEach((p, i) => {
    if (p.t >= start && isOn(p.s) && !isOn(points[i - 1]?.s ?? "")) n += 1;
  });
  return n;
}

/** Security trigger history filter (ControlZ SecurityTriggerHistoryFilter types). */
export const SECURITY_EVENT_TYPES = Object.freeze([
  { id: "all", label: "All" },
  { id: "door", label: "Doors" },
  { id: "window", label: "Windows" },
  { id: "lock", label: "Locks" },
  { id: "motion", label: "Motion" },
  { id: "alarm", label: "Alarms" },
]);

const HAZARD = {
  smoke: "Smoke detected", gas: "Gas detected", carbon_monoxide: "CO detected", moisture: "Leak detected", safety: "Unsafe", tamper: "Tampered",
};

/** Event type and the words for a state, for one security or motion entity. */
export function eventKind(entityId, stateObj) {
  const domain = domainOf(entityId);
  const dc = stateObj?.attributes?.device_class;
  if (domain === "lock" || (domain === "binary_sensor" && dc === "lock")) {
    const binary = domain === "binary_sensor";
    return { type: "lock", label: (s) => (binary ? (s === "on" ? "Unlocked" : "Locked") : ({ locked: "Locked", unlocked: "Unlocked", open: "Opened", jammed: "Jammed", locking: "Locking", unlocking: "Unlocking" }[s] || s)) };
  }
  if (domain === "alarm_control_panel") {
    return { type: "alarm", label: (s) => (s === "triggered" ? "Alarm triggered" : s === "disarmed" ? "Disarmed" : String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())) };
  }
  if (domain === "cover") return { type: "door", label: (s) => ({ open: "Opened", closed: "Closed", opening: "Opening", closing: "Closing" }[s] || s) };
  if (dc in HAZARD) return { type: "alarm", label: (s) => (s === "on" ? HAZARD[dc] : "Clear") };
  if (["motion", "occupancy", "presence", "moving"].includes(dc)) return { type: "motion", label: (s) => (s === "on" ? "Motion" : "Clear") };
  return { type: dc === "window" ? "window" : "door", label: (s) => (s === "on" ? "Opened" : "Closed") };
}

/** Entities the security trigger history follows: every security and motion tile, minus `exclude`. */
export function securityHistoryIds(hass, { exclude = [] } = {}) {
  const skip = new Set(exclude || []);
  return Object.keys(hass?.entities || {}).filter((id) => {
    if (skip.has(id)) return false;
    const kind = classifyEntity(id, hass.states?.[id], hass.entities[id]);
    return kind === KIND.SECURITY || kind === KIND.MOTION;
  }).sort();
}

/**
 * Newest-first state changes inside `(start, end]` (ControlZ Security Trigger History). Home Assistant
 * stamps the state the window opened with at `start`, so that one is not an event.
 * Offline / unknown states are skipped.
 */
export function securityEvents(hass, history, { start, end = Infinity }) {
  const events = [];
  for (const [entityId, entries] of Object.entries(history || {})) {
    const stateObj = hass?.states?.[entityId];
    const kind = eventKind(entityId, stateObj);
    const areaId = areaOfEntity(hass, entityId) || "";
    const name = friendlyName(hass, entityId);
    let previous = null;
    for (const p of historyPoints(entries)) {
      if (OFFLINE.has(p.s)) continue;
      if (p.t > start && p.t <= end && p.s !== previous) {
        events.push({
          entity_id: entityId, name, area_id: areaId, area: areaId ? hass.areas?.[areaId]?.name || areaId : "",
          t: p.t, state: p.s, type: kind.type, label: kind.label(p.s), alert: isAlert(entityId, p.s, kind.type),
        });
      }
      previous = p.s;
    }
  }
  return events.sort((a, b) => b.t - a.t || a.name.localeCompare(b.name));
}

function isAlert(entityId, state, type) {
  if (type === "motion") return false;
  if (domainOf(entityId) === "lock") return state === "unlocked" || state === "open" || state === "jammed";
  if (domainOf(entityId) === "alarm_control_panel") return state === "triggered";
  if (domainOf(entityId) === "cover") return state === "open";
  return state === "on";
}

/** Events matching a type (`all` for every type), a room (`""` for every room) and a search text. */
export function filterEvents(events, { type = "all", area = "", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return events.filter((e) => (type === "all" || e.type === type)
    && (!area || e.area_id === area)
    && (!q || `${e.name} ${e.area} ${e.label}`.toLowerCase().includes(q)));
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV for the events (ISO time, so spreadsheets sort it), oldest first. */
export function eventsCsv(events) {
  const rows = [["Time", "Room", "Device", "Type", "Event", "Entity"]];
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    rows.push([new Date(e.t).toISOString(), e.area, e.name, e.type, e.label, e.entity_id]);
  }
  return `${rows.map((r) => r.map(csvCell).join(",")).join("\n")}\n`;
}

/** Sensors with a chart in a room's history sheet: numeric sensors first, then motion. */
export function historyItems(items) {
  return [...items.filter((i) => i.kind === KIND.SENSOR), ...items.filter((i) => i.kind === KIND.MOTION)];
}
