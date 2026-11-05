/**
 * Pure ControlZ room / tile model over the Home Assistant `hass` object.
 * No DOM access — unit tested in test/model.test.js.
 */

export const KIND = Object.freeze({
  LIGHT: "light",
  SWITCH: "switch",
  OUTLET: "outlet",
  COVER: "cover",
  MOTION: "motion",
  SENSOR: "sensor",
  SECURITY: "security",
  SCENE: "scene",
  AUTOMATION: "automation",
  CLIMATE: "climate",
  FAN: "fan",
  CAMERA: "camera",
  OTHER: "other",
});

/** Room grid sections, in ControlZ order (scenes header first, then device groups). */
export const SECTIONS = Object.freeze([
  { id: "scenes", title: "Scenes", kinds: [KIND.SCENE] },
  { id: "lights", title: "Lights", kinds: [KIND.LIGHT, KIND.SWITCH, KIND.OUTLET] },
  { id: "coverings", title: "Window Coverings", kinds: [KIND.COVER] },
  { id: "climate", title: "Climate", kinds: [KIND.CLIMATE, KIND.FAN] },
  { id: "security", title: "Security", kinds: [KIND.SECURITY] },
  { id: "cameras", title: "Cameras", kinds: [KIND.CAMERA] },
  { id: "sensors", title: "Sensors", kinds: [KIND.MOTION, KIND.SENSOR] },
  { id: "automations", title: "Automations", kinds: [KIND.AUTOMATION] },
  { id: "other", title: "Other", kinds: [KIND.OTHER] },
]);

const SECURITY_COVER_CLASSES = new Set(["garage", "gate"]);
const OPENING_CLASSES = new Set(["door", "window", "opening", "garage_door"]);
const HAZARD_LABELS = {
  smoke: "SMOKE",
  gas: "GAS",
  carbon_monoxide: "CO",
  moisture: "WET",
  safety: "UNSAFE",
  tamper: "TAMPER",
};
const MOTION_CLASSES = new Set(["motion", "occupancy", "presence", "moving"]);
const SENSOR_CLASSES = new Set([
  "temperature",
  "humidity",
  "illuminance",
  "pressure",
  "carbon_dioxide",
  "pm25",
  "pm10",
  "volatile_organic_compounds",
  "aqi",
  "power",
]);
const SENSOR_BADGES = {
  temperature: "TEMP",
  humidity: "HUMIDITY",
  illuminance: "LIGHT LEVEL",
  pressure: "PRESSURE",
  carbon_dioxide: "CO₂",
  pm25: "PM2.5",
  pm10: "PM10",
  volatile_organic_compounds: "VOC",
  aqi: "AQI",
  power: "POWER",
};
const OTHER_DOMAINS = new Set([
  "media_player",
  "humidifier",
  "vacuum",
  "valve",
  "water_heater",
]);
const COLOR_MODES = new Set(["hs", "rgb", "rgbw", "rgbww", "xy"]);

const COVER_SET_POSITION = 4;

export const domainOf = (entityId) => entityId.slice(0, entityId.indexOf("."));

export const isUnavailable = (stateObj) =>
  !stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown";

export const isOn = (stateObj) => stateObj?.state === "on";

export function friendlyName(hass, entityId) {
  const stateObj = hass?.states?.[entityId];
  return stateObj?.attributes?.friendly_name || hass?.entities?.[entityId]?.name || entityId;
}

/**
 * Map an entity to a ControlZ tile kind, or `null` when it should not get a tile
 * (hidden, config/diagnostic, or a domain/device class ControlZ does not surface).
 */
export function classifyEntity(entityId, stateObj, entry) {
  if (!stateObj) return null;
  if (entry?.hidden || entry?.hidden_by || entry?.entity_category) return null;
  const domain = domainOf(entityId);
  const dc = stateObj.attributes?.device_class;
  switch (domain) {
    case "light":
      return KIND.LIGHT;
    case "switch":
      return dc === "outlet" ? KIND.OUTLET : KIND.SWITCH;
    case "cover":
      return SECURITY_COVER_CLASSES.has(dc) ? KIND.SECURITY : KIND.COVER;
    case "lock":
    case "alarm_control_panel":
      return KIND.SECURITY;
    case "binary_sensor":
      if (OPENING_CLASSES.has(dc) || dc === "lock" || dc in HAZARD_LABELS) return KIND.SECURITY;
      if (MOTION_CLASSES.has(dc)) return KIND.MOTION;
      return null;
    case "sensor":
      return SENSOR_CLASSES.has(dc) ? KIND.SENSOR : null;
    case "scene":
    case "script":
      return KIND.SCENE;
    case "automation":
      return KIND.AUTOMATION;
    case "climate":
      return KIND.CLIMATE;
    case "fan":
      return KIND.FAN;
    case "camera":
      return KIND.CAMERA;
    default:
      return OTHER_DOMAINS.has(domain) ? KIND.OTHER : null;
  }
}

/** Entity area wins over its device's area (Home Assistant semantics). */
export function areaOfEntity(hass, entityId) {
  const entry = hass?.entities?.[entityId];
  if (!entry) return null;
  if (entry.area_id) return entry.area_id;
  if (entry.device_id) return hass.devices?.[entry.device_id]?.area_id ?? null;
  return null;
}

/** Areas sorted by floor level (when floors exist), then name. */
export function sortedAreas(hass, { order = [], hide = [] } = {}) {
  const hidden = new Set(hide);
  const areas = Object.values(hass?.areas || {}).filter((a) => !hidden.has(a.area_id));
  const explicit = new Map(order.map((id, i) => [id, i]));
  const floorLevel = (a) => {
    const floor = a.floor_id ? hass.floors?.[a.floor_id] : null;
    return typeof floor?.level === "number" ? floor.level : Number.MAX_SAFE_INTEGER;
  };
  return areas.sort((a, b) => {
    const ea = explicit.has(a.area_id) ? explicit.get(a.area_id) : Infinity;
    const eb = explicit.has(b.area_id) ? explicit.get(b.area_id) : Infinity;
    if (ea !== eb) return ea - eb;
    const fa = floorLevel(a);
    const fb = floorLevel(b);
    if (fa !== fb) return fa - fb;
    return (a.name || "").localeCompare(b.name || "");
  });
}

/** `{ entity_id, kind }[]` for every tile-worthy entity in an area, sorted by name. */
export function entitiesForArea(hass, areaId) {
  const out = [];
  for (const entityId of Object.keys(hass?.entities || {})) {
    if (areaOfEntity(hass, entityId) !== areaId) continue;
    const kind = classifyEntity(entityId, hass.states?.[entityId], hass.entities[entityId]);
    if (kind) out.push({ entity_id: entityId, kind });
  }
  return out.sort((a, b) =>
    friendlyName(hass, a.entity_id).localeCompare(friendlyName(hass, b.entity_id))
  );
}

export function groupBySection(items) {
  return SECTIONS.map((section) => ({
    ...section,
    items: items.filter((i) => section.kinds.includes(i.kind)),
  })).filter((s) => s.items.length > 0);
}

export function lightCapabilities(stateObj) {
  const modes = stateObj?.attributes?.supported_color_modes || [];
  const color = modes.some((m) => COLOR_MODES.has(m));
  const ct = modes.includes("color_temp");
  const dimmable = color || ct || modes.includes("brightness");
  return { color, ct, dimmable };
}

export const brightnessPct = (stateObj) => {
  const b = stateObj?.attributes?.brightness;
  return typeof b === "number" ? Math.round((b / 255) * 100) : null;
};

/** Light colour the tile background should follow, or null (CT / white modes keep the default amber). */
export function followColor(stateObj) {
  if (!isOn(stateObj)) return null;
  const mode = stateObj.attributes?.color_mode;
  const rgb = stateObj.attributes?.rgb_color;
  if (!COLOR_MODES.has(mode) || !Array.isArray(rgb) || rgb.length < 3) return null;
  return rgb.slice(0, 3);
}

export function followGradient(rgb) {
  const mix = (c) => Math.round(c + (255 - c) * 0.45);
  const [r, g, b] = rgb;
  return `linear-gradient(135deg, rgb(${mix(r)},${mix(g)},${mix(b)}) 0%, rgb(${r},${g},${b}) 100%)`;
}

export function coverPosition(stateObj) {
  const p = stateObj?.attributes?.current_position;
  if (typeof p === "number") return p;
  if (stateObj?.state === "open") return 100;
  if (stateObj?.state === "closed") return 0;
  return null;
}

export const coverIsOpen = (stateObj) => {
  const p = stateObj?.attributes?.current_position;
  if (typeof p === "number") return p > 0;
  return stateObj?.state === "open" || stateObj?.state === "opening";
};

export const coverSupportsPosition = (stateObj) =>
  ((stateObj?.attributes?.supported_features ?? 0) & COVER_SET_POSITION) !== 0;

/** Text for the light / switch status chip: `ON · 85%`, `ON`, `OFF`, `OFFLINE`. */
export function lightBadge(stateObj) {
  if (isUnavailable(stateObj)) return "OFFLINE";
  if (!isOn(stateObj)) return "OFF";
  const pct = brightnessPct(stateObj);
  return pct == null ? "ON" : `ON · ${pct}%`;
}

/**
 * Room master summary, mirroring ControlZ `RoomTile` badges:
 * green = illumination (lights only), orange = outlets on, blue = coverings open.
 */
export function roomSummary(hass, items) {
  const states = hass?.states || {};
  const ids = (kind) => items.filter((i) => i.kind === kind).map((i) => i.entity_id);
  const lights = ids(KIND.LIGHT).filter((id) => !isUnavailable(states[id]));
  const outlets = ids(KIND.OUTLET);
  const covers = ids(KIND.COVER).filter((id) => !isUnavailable(states[id]));

  const lightsOnIds = lights.filter((id) => isOn(states[id]));
  const brightness = lightsOnIds.map((id) => brightnessPct(states[id])).filter((v) => v != null);
  const positions = covers.map((id) => coverPosition(states[id])).filter((v) => v != null);
  const firstColor = lightsOnIds.map((id) => followColor(states[id])).find(Boolean) || null;

  return {
    lights,
    lightsOn: lightsOnIds.length,
    allLightsOn: lights.length > 0 && lightsOnIds.length === lights.length,
    colorLights: lights.filter((id) => lightCapabilities(states[id]).color),
    ctLights: lights.filter((id) => lightCapabilities(states[id]).ct),
    dimmableLights: lights.filter((id) => lightCapabilities(states[id]).dimmable),
    avgBrightness: brightness.length
      ? Math.round(brightness.reduce((a, b) => a + b, 0) / brightness.length)
      : null,
    followColor: firstColor,
    outlets,
    outletsOn: outlets.filter((id) => isOn(states[id])).length,
    covers,
    coversOpen: covers.filter((id) => coverIsOpen(states[id])).length,
    positionableCovers: covers.filter((id) => coverSupportsPosition(states[id])),
    avgCoverPosition: positions.length
      ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length)
      : null,
    hasScenes: items.some((i) => i.kind === KIND.SCENE),
  };
}

/**
 * Short scene label for a room's scene chips: drops the room name Hue adds at the start
 * and/or end ("Kitchen Bright Kitchen" → "Bright"). Keeps the full name if nothing would remain.
 */
export function sceneLabel(name, areaName) {
  const full = String(name ?? "").trim();
  const room = String(areaName ?? "").trim();
  if (!room) return full;
  const escaped = room.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const short = full
    .replace(new RegExp(`^${escaped}(\\s*[-–:]\\s*|\\s+)`, "i"), "")
    .replace(new RegExp(`(\\s*[-–:]\\s*|\\s+)${escaped}$`, "i"), "")
    .trim();
  return short || full;
}

/** `Now`, `8m ago`, `2h ago`, `3d ago`. */
export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "Now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Another entity on the same device matching a device class (e.g. motion sensor → its temperature). */
export function siblingSensor(hass, entityId, deviceClass) {
  const deviceId = hass?.entities?.[entityId]?.device_id;
  if (!deviceId) return null;
  for (const [id, entry] of Object.entries(hass.entities)) {
    if (id === entityId || entry.device_id !== deviceId || domainOf(id) !== "sensor") continue;
    if (hass.states?.[id]?.attributes?.device_class === deviceClass) return id;
  }
  return null;
}

export function formatSensorValue(stateObj) {
  if (isUnavailable(stateObj)) return "—";
  const n = Number(stateObj.state);
  const unit = stateObj.attributes?.unit_of_measurement || "";
  const value = Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : stateObj.state;
  return unit ? `${value}${unit.startsWith("°") || unit === "%" ? "" : " "}${unit}` : value;
}

export const sensorBadge = (stateObj) =>
  SENSOR_BADGES[stateObj?.attributes?.device_class] || "SENSOR";

/**
 * Security tile face: status chip, whether it is insecure (red), the icon key,
 * and an optional primary action (`{ label, domain, service, data?, confirm? }`
 * or `{ label, moreInfo: true }` when a code is required).
 */
export function securityView(entityId, stateObj) {
  const domain = domainOf(entityId);
  const state = stateObj?.state;
  const dc = stateObj?.attributes?.device_class;
  if (isUnavailable(stateObj)) {
    return { badge: "OFFLINE", insecure: false, secure: false, offline: true, icon: "shield", action: null };
  }
  const upper = (s) => String(s).replace(/_/g, " ").toUpperCase();

  if (domain === "lock") {
    if (state === "locked")
      return { badge: "LOCKED", secure: true, insecure: false, icon: "lockClosed",
        action: { label: "UNLOCK", domain: "lock", service: "unlock", confirm: true } };
    if (state === "unlocked" || state === "open")
      return { badge: upper(state), secure: false, insecure: true, icon: "lockOpen",
        action: { label: "LOCK", domain: "lock", service: "lock" } };
    return { badge: upper(state), secure: false, insecure: state === "jammed", icon: "lockOpen", action: null };
  }

  if (domain === "alarm_control_panel") {
    const alarm = alarmView(stateObj);
    const disarm = alarm.disarmNeedsCode
      ? { label: "DISARM", keypad: true }
      : { label: "DISARM", domain: "alarm_control_panel", service: "alarm_disarm", confirm: state !== "triggered" };
    if (state === "disarmed") {
      const away = alarm.modes.find((m) => m.service === "alarm_arm_away") || alarm.modes[0];
      return { badge: "DISARMED", secure: false, insecure: false, icon: "shield",
        action: alarm.armNeedsCode || !away
          ? { label: "ARM", keypad: true }
          : { label: `ARM ${away.label.toUpperCase()}`, domain: "alarm_control_panel", service: away.service } };
    }
    if (state === "triggered")
      return { badge: "TRIGGERED", secure: false, insecure: true, icon: "bell", action: disarm };
    if (state.startsWith("armed") || state === "arming" || state === "pending")
      return { badge: upper(state), secure: state.startsWith("armed"), insecure: false, icon: "shield", action: disarm };
    return { badge: upper(state), secure: false, insecure: false, icon: "shield", action: null };
  }

  if (domain === "cover") {
    const open = coverIsOpen(stateObj);
    return {
      badge: open ? "OPEN" : "CLOSED",
      secure: !open,
      insecure: open,
      icon: "garage",
      action: open
        ? { label: "CLOSE", domain: "cover", service: "close_cover" }
        : { label: "OPEN", domain: "cover", service: "open_cover", confirm: true },
    };
  }

  // binary_sensor
  const on = state === "on";
  if (dc === "lock")
    return { badge: on ? "UNLOCKED" : "LOCKED", secure: !on, insecure: on, icon: on ? "lockOpen" : "lockClosed", action: null };
  if (dc in HAZARD_LABELS)
    return { badge: on ? HAZARD_LABELS[dc] : "CLEAR", secure: !on, insecure: on, icon: "bell", action: null };
  const isDoor = dc === "door" || dc === "garage_door";
  return {
    badge: on ? "OPEN" : "CLOSED",
    secure: !on,
    insecure: on,
    icon: isDoor ? "door" : on ? "contactOpen" : "contactClosed",
    action: null,
  };
}

const ALARM_MODES = [
  { bit: 2, service: "alarm_arm_away", label: "Away" },
  { bit: 1, service: "alarm_arm_home", label: "Home" },
  { bit: 4, service: "alarm_arm_night", label: "Night" },
  { bit: 32, service: "alarm_arm_vacation", label: "Vacation" },
  { bit: 16, service: "alarm_arm_custom_bypass", label: "Bypass" },
];

/**
 * Alarm panel keypad model: arm modes from `supported_features` (Home and Away when the panel
 * does not say), and whether arming / disarming needs a code (`code_format`, `code_arm_required`).
 */
export function alarmView(stateObj) {
  const attrs = stateObj?.attributes || {};
  const features = attrs.supported_features;
  const modes = typeof features === "number"
    ? ALARM_MODES.filter((m) => features & m.bit)
    : ALARM_MODES.filter((m) => m.bit <= 2);
  const codeFormat = attrs.code_format === "number" || attrs.code_format === "text" ? attrs.code_format : null;
  return {
    state: stateObj?.state,
    modes: modes.map(({ service, label }) => ({ service, label })),
    codeFormat,
    armNeedsCode: !!codeFormat && attrs.code_arm_required !== false,
    disarmNeedsCode: !!codeFormat,
    armed: !!stateObj?.state?.startsWith("armed") || ["arming", "pending", "triggered"].includes(stateObj?.state),
  };
}

const HAZARD_PHRASES = {
  smoke: "smoke detected",
  gas: "gas detected",
  carbon_monoxide: "CO detected",
  moisture: "leak detected",
  safety: "unsafe",
  tamper: "tampered",
};

/**
 * How one security entity affects the banner, mirroring ControlZ `SecurityStateCalculator`:
 * doors, locks, garage/gate, alarms and hazards are red (`insecure`); open windows and
 * jammed locks are amber (`warning`). Offline devices never raise the banner.
 */
export function bannerSeverity(entityId, stateObj) {
  if (isUnavailable(stateObj)) return null;
  const domain = domainOf(entityId);
  const state = stateObj.state;
  const dc = stateObj.attributes?.device_class;
  if (domain === "lock") {
    if (state === "unlocked" || state === "open") return { severity: "insecure", phrase: state };
    if (state === "jammed") return { severity: "warning", phrase: "jammed" };
    return null;
  }
  if (domain === "alarm_control_panel")
    return state === "triggered" ? { severity: "insecure", phrase: "alarm triggered" } : null;
  if (domain === "cover") return coverIsOpen(stateObj) ? { severity: "insecure", phrase: "open" } : null;
  if (state !== "on") return null;
  if (dc === "lock") return { severity: "insecure", phrase: "unlocked" };
  if (dc in HAZARD_PHRASES) return { severity: "insecure", phrase: HAZARD_PHRASES[dc] };
  if (dc === "window") return { severity: "warning", phrase: "open" };
  return { severity: "insecure", phrase: "open" };
}

const nameList = (items) => {
  const shown = items.slice(0, 2).map((i) => (i.phrase ? `${i.name} ${i.phrase}` : i.name)).join(", ");
  return items.length > 2 ? `${shown} +${items.length - 2} more` : shown;
};

/**
 * Whole-house security report for the banner. `include` (entity ids) limits the banner to
 * those devices, like ControlZ's Security membership; `exclude` drops devices. Hidden and
 * config/diagnostic entities are never counted.
 */
export function securityReport(hass, { include = [], exclude = [] } = {}) {
  const only = new Set(include || []);
  const skip = new Set(exclude || []);
  const insecure = [];
  const warning = [];
  const motion = [];
  for (const entityId of Object.keys(hass?.entities || {})) {
    if ((only.size && !only.has(entityId)) || skip.has(entityId)) continue;
    const stateObj = hass.states?.[entityId];
    const kind = classifyEntity(entityId, stateObj, hass.entities[entityId]);
    const name = friendlyName(hass, entityId);
    if (kind === KIND.SECURITY) {
      const hit = bannerSeverity(entityId, stateObj);
      if (hit) (hit.severity === "insecure" ? insecure : warning).push({ entity_id: entityId, name, phrase: hit.phrase });
    } else if (kind === KIND.MOTION && isOn(stateObj)) {
      motion.push({ entity_id: entityId, name, phrase: "" });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  insecure.sort(byName);
  warning.sort(byName);
  motion.sort(byName);
  let level = "secure";
  let text = "SECURE — All doors and locks secure. No motion.";
  if (insecure.length) {
    level = "insecure";
    text = `INSECURE — ${nameList(insecure)}`;
  } else if (warning.length) {
    level = "warning";
    text = `CHECK — ${nameList(warning)}`;
  } else if (motion.length) {
    level = "motion";
    text = `MOTION — ${nameList(motion)}`;
  }
  return { level, text, insecure, warning, motion };
}

/** Home banner summary: INSECURE beats CHECK (warning) beats MOTION beats SECURE. */
export function securityBanner(hass, options) {
  const { level, text } = securityReport(hass, options);
  return { level, text };
}

/**
 * Where the security banner shows (`security_banner`): All Rooms only (default), All Rooms and
 * every room page, All Rooms and the rooms in `security_banner_rooms`, or nowhere.
 */
export const SECURITY_BANNER_MODES = Object.freeze([
  { id: "all_rooms", label: "All Rooms only" },
  { id: "every_room", label: "Every room" },
  { id: "rooms", label: "Chosen rooms" },
  { id: "off", label: "Off" },
]);

/** Whether the banner shows on All Rooms (`areaId` null) or on the room page of `areaId`. */
export function showsSecurityBanner({ mode, rooms } = {}, areaId = null) {
  const known = SECURITY_BANNER_MODES.some((m) => m.id === mode) ? mode : "all_rooms";
  if (known === "off") return false;
  if (!areaId) return true;
  if (known === "every_room") return true;
  return known === "rooms" && (rooms || []).includes(areaId);
}

const upperWords = (s) => String(s ?? "").replace(/_/g, " ").toUpperCase();
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** `21.5°` (unit symbol dropped on tiles, where space is tight) or `—`. */
export function formatTemp(value, unit = "") {
  const n = num(value);
  if (n == null) return "—";
  return `${Math.round(n * 10) / 10}°${unit.replace("°", "")}`;
}

/**
 * Thermostat tile face (ControlZ thermostat tiles): HVAC mode / action badge, current and
 * target temperatures (single target or a low–high range), step and limits for the +/− buttons.
 */
export function climateView(stateObj, unit = "°C") {
  const a = stateObj?.attributes || {};
  const offline = isUnavailable(stateObj);
  const mode = stateObj?.state;
  const action = a.hvac_action;
  const fahrenheit = /F/.test(unit);
  const step = num(a.target_temp_step) || (fahrenheit ? 1 : 0.5);
  const active = !offline && ["heating", "cooling", "drying", "fan", "preheating", "defrosting"].includes(action);
  const badge = offline
    ? "OFFLINE"
    : action && !["idle", "off"].includes(action) ? upperWords(action)
    : mode === "heat_cool" ? "AUTO" : upperWords(mode);
  const range = num(a.target_temp_low) != null && num(a.target_temp_high) != null && num(a.temperature) == null;
  return {
    offline,
    mode,
    action: action || null,
    active,
    heating: action === "heating" || action === "preheating",
    cooling: action === "cooling",
    off: mode === "off",
    badge,
    current: num(a.current_temperature),
    target: num(a.temperature),
    low: num(a.target_temp_low),
    high: num(a.target_temp_high),
    range,
    step,
    min: num(a.min_temp) ?? (fahrenheit ? 45 : 7),
    max: num(a.max_temp) ?? (fahrenheit ? 95 : 35),
    modes: Array.isArray(a.hvac_modes) ? a.hvac_modes : [],
    presets: Array.isArray(a.preset_modes) ? a.preset_modes : [],
    preset: a.preset_mode ?? null,
    fanModes: Array.isArray(a.fan_modes) ? a.fan_modes : [],
    fanMode: a.fan_mode ?? null,
    humidity: num(a.current_humidity),
    unit,
  };
}

/** Next setpoint after a +/− press: snapped to the step, clamped to the thermostat's limits. */
export function stepTarget(value, delta, { step = 0.5, min = 7, max = 35 } = {}) {
  const base = num(value) ?? (min + max) / 2;
  const next = Math.round((base + delta * step) / step) * step;
  return Math.round(Math.min(max, Math.max(min, next)) * 100) / 100;
}

const FAN_SET_SPEED = 1;
const FAN_OSCILLATE = 2;
const FAN_DIRECTION = 4;
const FAN_PRESET = 8;

/** Fan tile face: on/off, speed percentage (when supported), presets, oscillation, direction. */
export function fanView(stateObj) {
  const a = stateObj?.attributes || {};
  const features = a.supported_features ?? 0;
  const on = isOn(stateObj);
  const pct = num(a.percentage);
  const offline = isUnavailable(stateObj);
  return {
    on,
    offline,
    percentage: pct ?? 0,
    step: num(a.percentage_step) || 1,
    speed: (features & FAN_SET_SPEED) !== 0,
    oscillate: (features & FAN_OSCILLATE) !== 0,
    oscillating: !!a.oscillating,
    direction: (features & FAN_DIRECTION) !== 0 ? a.direction || "forward" : null,
    presets: (features & FAN_PRESET) !== 0 && Array.isArray(a.preset_modes) ? a.preset_modes : [],
    preset: a.preset_mode ?? null,
    badge: offline ? "OFFLINE" : !on ? "OFF" : pct != null && (features & FAN_SET_SPEED) ? `ON · ${pct}%` : a.preset_mode ? `ON · ${upperWords(a.preset_mode)}` : "ON",
  };
}

/** Camera tile face: snapshot path (Home Assistant camera proxy, token included) and state chip. */
export function cameraView(stateObj) {
  const offline = isUnavailable(stateObj);
  return {
    offline,
    picture: offline ? null : stateObj?.attributes?.entity_picture || null,
    badge: offline ? "OFFLINE" : upperWords(stateObj?.state || "idle"),
    live: stateObj?.state === "streaming" || stateObj?.state === "recording",
  };
}

/**
 * Items in a saved tile order (entity ids): listed ones first in that order, the rest keep their
 * current order (by name). Sections are grouped afterwards, so the order applies within each section.
 */
export function orderItems(items, order = []) {
  if (!order?.length) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.has(item.entity_id) ? rank.get(item.entity_id) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}

/** Favorite devices that still get a tile, minus hidden ones, in the user's favorites order. */
export function favoriteItems(hass, entityIds = [], hiddenEntities = new Set()) {
  const out = [];
  for (const entityId of new Set(entityIds)) {
    if (hiddenEntities.has(entityId)) continue;
    const kind = classifyEntity(entityId, hass?.states?.[entityId], hass?.entities?.[entityId]);
    if (kind) out.push({ entity_id: entityId, kind });
  }
  return out;
}

/** Favorite rooms that still exist and are not hidden, in the user's favorites order. */
export function favoriteAreas(hass, areaIds = [], { hide = [] } = {}) {
  const hidden = new Set(hide);
  return [...new Set(areaIds)].map((id) => hass?.areas?.[id]).filter((a) => a && !hidden.has(a.area_id));
}

const ON_KINDS = new Set([KIND.LIGHT, KIND.SWITCH, KIND.OUTLET, KIND.FAN]);

/** ControlZ "All On" filter: lights, switches, outlets and fans that are on right now. */
export function itemsOn(hass, items) {
  return items.filter((i) => ON_KINDS.has(i.kind) && isOn(hass?.states?.[i.entity_id]));
}

/** "All lights off": lights and wall switches that are on (outlets such as a kettle are left alone). */
export function lightsOffTargets(hass, items) {
  const on = items.filter((i) => (i.kind === KIND.LIGHT || i.kind === KIND.SWITCH) && isOn(hass?.states?.[i.entity_id]));
  return {
    light: on.filter((i) => i.kind === KIND.LIGHT).map((i) => i.entity_id),
    switch: on.filter((i) => i.kind === KIND.SWITCH).map((i) => i.entity_id),
    count: on.length,
  };
}

/** Room "on" for the All Rooms filter: illumination or outlets on (open coverings do not count). */
export const roomIsOn = (summary) => summary.lightsOn > 0 || summary.outletsOn > 0;

/**
 * Maintenance report (ControlZ Low Battery Report): batteries under `threshold` % (or a battery
 * binary sensor reporting low) and devices that would get a tile but are unavailable.
 * Battery sensors are usually diagnostic entities, so those are included; hidden and disabled ones are not.
 */
export function maintenanceReport(hass, { threshold = 20, exclude = [] } = {}) {
  const skip = new Set(exclude || []);
  const lowBattery = [];
  const unavailable = [];
  for (const [entityId, entry] of Object.entries(hass?.entities || {})) {
    if (skip.has(entityId) || entry.hidden || entry.hidden_by || entry.disabled_by) continue;
    const stateObj = hass.states?.[entityId];
    if (!stateObj) continue;
    const areaId = areaOfEntity(hass, entityId);
    const where = areaId ? hass.areas?.[areaId]?.name || areaId : "";
    const deviceName = entry.device_id ? hass.devices?.[entry.device_id]?.name_by_user || hass.devices?.[entry.device_id]?.name : null;
    const dc = stateObj.attributes?.device_class;
    const domain = domainOf(entityId);
    if (dc === "battery" && domain === "sensor" && !isUnavailable(stateObj)) {
      const level = Number(stateObj.state);
      if (Number.isFinite(level) && level < threshold) {
        lowBattery.push({ entity_id: entityId, name: deviceName || friendlyName(hass, entityId), level: Math.round(level), area: where });
      }
      continue;
    }
    if (dc === "battery" && domain === "binary_sensor") {
      if (stateObj.state === "on") lowBattery.push({ entity_id: entityId, name: deviceName || friendlyName(hass, entityId), level: null, area: where });
      continue;
    }
    if (stateObj.state === "unavailable" && classifyEntity(entityId, stateObj, entry)) {
      unavailable.push({ entity_id: entityId, name: friendlyName(hass, entityId), area: where });
    }
  }
  lowBattery.sort((a, b) => (a.level ?? -1) - (b.level ?? -1) || a.name.localeCompare(b.name));
  unavailable.sort((a, b) => a.name.localeCompare(b.name));
  return { lowBattery, unavailable, count: lowBattery.length + unavailable.length, threshold };
}

const average = (values) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Room readings for the room tile and header (ControlZ room sensor banner): average temperature
 * and humidity from the room's sensors, motion sensors' own thermometers, then thermostats.
 */
export function roomReadings(hass, items, unit = "°C") {
  const states = hass?.states || {};
  const temps = [];
  const hums = [];
  let tempUnit = null;
  const addTemp = (id) => {
    const s = states[id];
    const n = Number(s?.state);
    if (isUnavailable(s) || !Number.isFinite(n)) return;
    temps.push(n);
    tempUnit ||= s.attributes?.unit_of_measurement || unit;
  };
  for (const item of items) {
    const s = states[item.entity_id];
    const dc = s?.attributes?.device_class;
    if (item.kind === KIND.SENSOR && dc === "temperature") addTemp(item.entity_id);
    if (item.kind === KIND.SENSOR && dc === "humidity" && Number.isFinite(Number(s.state)) && !isUnavailable(s)) hums.push(Number(s.state));
  }
  if (!temps.length) {
    for (const item of items.filter((i) => i.kind === KIND.MOTION)) {
      const sibling = siblingSensor(hass, item.entity_id, "temperature");
      if (sibling) addTemp(sibling);
    }
  }
  if (!temps.length) {
    for (const item of items.filter((i) => i.kind === KIND.CLIMATE)) {
      const current = num(states[item.entity_id]?.attributes?.current_temperature);
      if (current != null) {
        temps.push(current);
        tempUnit ||= unit;
      }
    }
  }
  const temperature = temps.length ? `${Math.round(average(temps) * 10) / 10}${tempUnit || unit}` : null;
  const humidity = hums.length ? `${Math.round(average(hums))}%` : null;
  return { temperature, humidity, text: [temperature, humidity && `💧${humidity}`].filter(Boolean).join(" · ") };
}

/**
 * Automations grouped by room for the Automations view: one group per area (dashboard room
 * order), then "No room". Hidden automations are left out unless `includeHidden`.
 */
export function automationGroups(hass, { order = [], hideEntities = new Set(), includeHidden = false } = {}) {
  const byArea = new Map();
  // YAML automations without an `id` have no registry entry, so states are scanned as well.
  const ids = new Set([...Object.keys(hass?.entities || {}), ...Object.keys(hass?.states || {}).filter((id) => id.startsWith("automation."))]);
  for (const entityId of ids) {
    const entry = hass.entities?.[entityId];
    if (classifyEntity(entityId, hass.states?.[entityId], entry) !== KIND.AUTOMATION) continue;
    if (!includeHidden && hideEntities.has(entityId)) continue;
    const areaId = areaOfEntity(hass, entityId) || "";
    if (!byArea.has(areaId)) byArea.set(areaId, []);
    byArea.get(areaId).push({ entity_id: entityId, kind: KIND.AUTOMATION });
  }
  const byName = (a, b) => friendlyName(hass, a.entity_id).localeCompare(friendlyName(hass, b.entity_id));
  const groups = sortedAreas(hass, { order })
    .filter((a) => byArea.has(a.area_id))
    .map((a) => ({ area_id: a.area_id, name: a.name, items: byArea.get(a.area_id).sort(byName) }));
  if (byArea.has("")) groups.push({ area_id: "", name: "No room", items: byArea.get("").sort(byName) });
  return groups;
}
