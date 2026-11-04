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
