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
  OTHER: "other",
});

/** Room grid sections, in ControlZ order (scenes header first, then device groups). */
export const SECTIONS = Object.freeze([
  { id: "scenes", title: "Scenes", kinds: [KIND.SCENE] },
  { id: "lights", title: "Lights", kinds: [KIND.LIGHT, KIND.SWITCH, KIND.OUTLET] },
  { id: "coverings", title: "Window Coverings", kinds: [KIND.COVER] },
  { id: "security", title: "Security", kinds: [KIND.SECURITY] },
  { id: "sensors", title: "Sensors", kinds: [KIND.MOTION, KIND.SENSOR] },
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
  "fan",
  "climate",
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
    case "automation":
      return KIND.SCENE;
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
    const needsCode = !!stateObj.attributes?.code_format;
    if (state === "disarmed")
      return { badge: "DISARMED", secure: false, insecure: false, icon: "shield",
        action: needsCode
          ? { label: "ARM", moreInfo: true }
          : { label: "ARM AWAY", domain: "alarm_control_panel", service: "alarm_arm_away" } };
    if (state === "triggered")
      return { badge: "TRIGGERED", secure: false, insecure: true, icon: "bell",
        action: needsCode
          ? { label: "DISARM", moreInfo: true }
          : { label: "DISARM", domain: "alarm_control_panel", service: "alarm_disarm" } };
    if (state.startsWith("armed"))
      return { badge: upper(state), secure: true, insecure: false, icon: "shield",
        action: needsCode
          ? { label: "DISARM", moreInfo: true }
          : { label: "DISARM", domain: "alarm_control_panel", service: "alarm_disarm", confirm: true } };
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
