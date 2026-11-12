/**
 * Per-device view preferences (this browser only), chosen from the View menu:
 * tile size and room navigation override the dashboard config, so a wall tablet can
 * use Compact + Sidebar while a phone keeps Large + Tabs.
 */
export const SIZES = ["large", "thin", "compact"];
export const NAVS = ["tabs", "sidebar"];
/** View menu slider range (%); `tile_scale` in YAML accepts any value from 0.4 to 1.5. */
export const SCALE_MIN = 50;
export const SCALE_MAX = 120;
export const SCALE_STEP = 5;
export const PREFS_EVENT = "controlz-ha-prefs";

const KEY = "controlz-ha.prefs";

export function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function writePrefs(patch) {
  const next = { ...readPrefs(), ...patch };
  for (const key of Object.keys(next)) if (next[key] == null) delete next[key];
  try {
    if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode / storage disabled: the choice lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: next }));
  return next;
}

export function effectiveSize(configSize) {
  const pref = readPrefs().tile_size;
  if (SIZES.includes(pref)) return pref;
  return SIZES.includes(configSize) ? configSize : "large";
}

/** Low-battery level (%) on this device (Needs Attention), else the dashboard's `battery_threshold`, else 20. */
export const BATTERY_MIN = 5;
export const BATTERY_MAX = 95;
const validThreshold = (v) => Number.isFinite(Number(v)) && Number(v) >= BATTERY_MIN && Number(v) <= BATTERY_MAX && v !== null && v !== "";

/** `value` as a low-battery level when it is one (5–95), else `fallback`. */
export const batteryThresholdOr = (value, fallback = 20) => (validThreshold(value) ? Number(value) : fallback);

export function effectiveBatteryThreshold(configThreshold) {
  return batteryThresholdOr(readPrefs().battery_threshold, batteryThresholdOr(configThreshold));
}

/** Event the View menu fires (admins) to save a room's tile size for everyone: `{ area, size }` (size null = clear). */
export const ROOM_SIZE_EVENT = "controlz-room-size";

/** This device's tile size per room (`room_sizes: { office: "compact" }`), from the room page's View menu. */
export function deviceRoomSizes() {
  const sizes = readPrefs().room_sizes;
  if (!sizes || typeof sizes !== "object") return {};
  return Object.fromEntries(Object.entries(sizes).filter(([, s]) => SIZES.includes(s)));
}

export function setDeviceRoomSize(areaId, size) {
  const next = { ...deviceRoomSizes() };
  if (SIZES.includes(size)) next[areaId] = size;
  else delete next[areaId];
  return writePrefs({ room_sizes: Object.keys(next).length ? next : null });
}

/**
 * Tile size on a room's page (ControlZ per-room tile size): this device's choice for the room,
 * then the dashboard's size for the room (`room_tile_sizes`), then the usual tile size.
 */
export function effectiveRoomSize(configSize, areaId, dashboardRoomSizes = {}) {
  const device = deviceRoomSizes()[areaId];
  if (SIZES.includes(device)) return device;
  const dashboard = dashboardRoomSizes?.[areaId];
  if (SIZES.includes(dashboard)) return dashboard;
  return effectiveSize(configSize);
}

/**
 * Page zoom for tiles (1 = ControlZ size). Everything inside a page scales together, so tiles
 * keep their look and controls keep fitting; more tiles fit on screen at smaller scales.
 */
export function effectiveScale(configScale) {
  const valid = (v) => typeof v === "number" && v >= 0.4 && v <= 1.5;
  const pref = readPrefs().tile_scale;
  if (valid(pref)) return pref;
  const config = Number(configScale);
  return valid(config) ? config : 1;
}

export function effectiveNav(configNav) {
  const pref = readPrefs().room_nav;
  if (NAVS.includes(pref)) return pref;
  return NAVS.includes(configNav) ? configNav : "tabs";
}

/** All Rooms filter (ControlZ LightFilter): every room, rooms with something on, or rooms that are off. */
export const HOME_FILTERS = ["all", "on", "off"];
export const homeFilter = () => (HOME_FILTERS.includes(readPrefs().home_filter) ? readPrefs().home_filter : "all");

/**
 * What a lock tile's button does on this device (ControlZ lock / door tap mode): ask before
 * unlocking (default), act straight away, or open the lock controls.
 */
export const LOCK_TAPS = [
  { id: "confirm", label: "Ask first" },
  { id: "immediate", label: "Instant" },
  { id: "sheet", label: "Controls" },
];
export const lockTap = () => (LOCK_TAPS.some((t) => t.id === readPrefs().lock_tap) ? readPrefs().lock_tap : "confirm");

/** Collapsed scene rows on this device (`scenes:<area id>`, `scenes:__home`, `scenes:__favorites`). */
export const collapsedSections = () => (Array.isArray(readPrefs().collapsed) ? readPrefs().collapsed.filter((k) => typeof k === "string") : []);
export const isCollapsed = (key) => collapsedSections().includes(key);

export function toggleCollapsed(key) {
  const next = new Set(collapsedSections());
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return writePrefs({ collapsed: next.size ? [...next].sort() : null });
}

/** Room page filter on this device (all / on / off / favorites) and section (null = every type); shared by every room. */
export const ROOM_FILTER_IDS = ["all", "on", "off", "favorites"];
export const roomFilter = () => (ROOM_FILTER_IDS.includes(readPrefs().room_filter) ? readPrefs().room_filter : "all");
export const roomSection = () => (typeof readPrefs().room_section === "string" ? readPrefs().room_section : null);

/**
 * Start page on this device (ControlZ Startup Room): a view path such as `room-office`,
 * `favorites` or `automations`; null = All Rooms.
 */
export const startPage = () => (typeof readPrefs().start_page === "string" ? readPrefs().start_page : null);

let startTaken = false;

/**
 * The start page, once per page load: only the first ControlZ page that opens may jump to it,
 * so later visits to All Rooms (and deep links) are left alone.
 */
export function takeStartPage() {
  if (startTaken) return null;
  startTaken = true;
  return startPage();
}
