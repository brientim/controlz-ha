/**
 * Capture a room as a scene (ControlZ scene editor "add lights capture their live state", and the
 * "Snapshot current states" option of its Home Assistant scene view). Pure: unit tested in
 * test/scene-model.test.js. The result is an ordinary Home Assistant scene config.
 */
import { KIND, domainOf, friendlyName, isUnavailable } from "./model.js";

/** Tile kinds a captured scene can set, and whether they start ticked (outlets such as a kettle do not). */
export const CAPTURE_KINDS = Object.freeze({
  [KIND.LIGHT]: { label: "Lights", ticked: true },
  [KIND.SWITCH]: { label: "Switches", ticked: true },
  [KIND.COVER]: { label: "Coverings", ticked: true },
  [KIND.FAN]: { label: "Fans", ticked: false },
  [KIND.CLIMATE]: { label: "Thermostats", ticked: false },
  [KIND.OUTLET]: { label: "Outlets", ticked: false },
});

const COLOR_ATTRS = { hs: "hs_color", xy: "xy_color", rgb: "rgb_color", rgbw: "rgbw_color", rgbww: "rgbww_color" };
const has = (v) => v != null && !(typeof v === "number" && !Number.isFinite(v));
const pick = (attrs, keys) => Object.fromEntries(keys.filter((k) => has(attrs[k])).map((k) => [k, attrs[k]]));

/**
 * Colour of a lit light. Home Assistant restores a scene's colour from the attribute matching its
 * `color_mode`, so the mode is changed to match when only another colour attribute is reported.
 */
function lightColor(a) {
  const mode = a.color_mode;
  if (mode === "color_temp") return has(a.color_temp_kelvin) ? { color_mode: mode, color_temp_kelvin: a.color_temp_kelvin } : {};
  if (!COLOR_ATTRS[mode]) return {};
  const found = [mode, "hs", "rgb", "xy"].find((m) => has(a[COLOR_ATTRS[m]]));
  return found ? { color_mode: found, [COLOR_ATTRS[found]]: a[COLOR_ATTRS[found]] } : {};
}

/** What a scene stores for one entity, from its current state (the attributes Home Assistant scenes restore). */
export function captureState(entityId, stateObj) {
  if (!stateObj || isUnavailable(stateObj)) return null;
  const a = stateObj.attributes || {};
  const state = stateObj.state;
  switch (domainOf(entityId)) {
    case "light": {
      if (state !== "on") return { state: "off" };
      return { state: "on", ...pick(a, ["brightness"]), ...lightColor(a) };
    }
    case "cover":
      return { state, ...pick(a, ["current_position", "current_tilt_position"]) };
    case "fan":
      return state === "on" ? { state, ...pick(a, ["percentage", "preset_mode", "oscillating", "direction"]) } : { state };
    case "climate":
      return { state, ...pick(a, ["temperature", "target_temp_low", "target_temp_high", "preset_mode", "fan_mode"]) };
    case "switch":
      return { state };
    default:
      return null;
  }
}

/** Devices a room scene can capture, in room order, with whether each starts ticked. */
export function captureCandidates(hass, items) {
  return items
    .filter((i) => CAPTURE_KINDS[i.kind] && captureState(i.entity_id, hass?.states?.[i.entity_id]))
    .map((i) => ({ entity_id: i.entity_id, kind: i.kind, name: friendlyName(hass, i.entity_id), ticked: CAPTURE_KINDS[i.kind].ticked }));
}

/** Scene config (`config/scene/config/<id>`) setting each of `entityIds` to how it is now. */
export function captureSceneConfig(hass, entityIds, { id, name, icon = "" }) {
  const entities = {};
  for (const entityId of entityIds) {
    const value = captureState(entityId, hass?.states?.[entityId]);
    if (value) entities[entityId] = value;
  }
  return {
    id,
    name: String(name || "").trim(),
    ...(String(icon || "").trim() ? { icon: String(icon).trim() } : {}),
    entities,
    metadata: {},
  };
}

/** An existing scene with each of its devices set to how it is now (devices that are offline keep their old values). */
export function recaptureScene(hass, config) {
  const entities = { ...(config?.entities || {}) };
  for (const entityId of Object.keys(entities)) {
    const value = captureState(entityId, hass?.states?.[entityId]);
    if (value) entities[entityId] = value;
  }
  return { ...config, entities };
}

/** Why a capture cannot be saved yet, or null. */
export function captureProblem({ name, entityIds }) {
  if (!String(name || "").trim()) return "Give the scene a name.";
  if (!entityIds.length) return "Tick at least one device.";
  return null;
}
