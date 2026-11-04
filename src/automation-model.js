/**
 * Home Assistant automation configs for the ControlZ Automations view (pure, unit tested in
 * test/automation-model.test.js). Based on ControlZ `CreateHomeAssistantAutomationView`: one
 * trigger (time, state change or sun) and one or more actions (scene, script, a device service or
 * one kind of device across a room). Anything richer is edited in Home Assistant's own editor,
 * never rewritten here.
 */

export const TRIGGER_KINDS = [
  { id: "time", label: "At a time" },
  { id: "state", label: "When a device changes" },
  { id: "sun", label: "Sunrise / sunset" },
];

export const ACTION_KINDS = [
  { id: "scene", label: "Activate a scene" },
  { id: "script", label: "Run a script" },
  { id: "service", label: "Control a device" },
  { id: "room", label: "Control a room" },
];

/** Services offered for "Control a device", per entity domain. */
export const DEVICE_SERVICES = {
  light: [["turn_on", "Turn on"], ["turn_off", "Turn off"], ["toggle", "Toggle"]],
  switch: [["turn_on", "Turn on"], ["turn_off", "Turn off"], ["toggle", "Toggle"]],
  fan: [["turn_on", "Turn on"], ["turn_off", "Turn off"], ["toggle", "Toggle"]],
  cover: [["open_cover", "Open"], ["close_cover", "Close"], ["stop_cover", "Stop"]],
  lock: [["lock", "Lock"], ["unlock", "Unlock"]],
  climate: [["turn_on", "Turn on"], ["turn_off", "Turn off"]],
  media_player: [["media_play", "Play"], ["media_pause", "Pause"], ["turn_off", "Turn off"]],
  humidifier: [["turn_on", "Turn on"], ["turn_off", "Turn off"]],
  vacuum: [["start", "Start"], ["return_to_base", "Return to base"]],
  valve: [["open_valve", "Open"], ["close_valve", "Close"]],
};

/** Device kinds "Control a room" can target (`target: { area_id }`), with their plural names. */
export const ROOM_DOMAINS = {
  light: "lights", switch: "switches", fan: "fans", cover: "coverings", climate: "thermostats",
  media_player: "media players", lock: "locks", humidifier: "humidifiers", valve: "valves",
};

/** Services for every device of `domain` in a room (no toggle: it would flip each device separately). */
export const roomServices = (domain) => (ROOM_DOMAINS[domain] ? DEVICE_SERVICES[domain].filter(([s]) => s !== "toggle") : []);

const domainOf = (id) => String(id || "").split(".")[0];
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const single = (v) => {
  const list = asList(v);
  return list.length === 1 && typeof list[0] === "string" ? list[0] : null;
};

/** Config id the automation editor and config API use (`attributes.id`), or null for YAML-only automations. */
export const automationConfigId = (stateObj) => {
  const id = stateObj?.attributes?.id;
  return id == null || id === "" ? null : String(id);
};

/** New config id, the same shape Home Assistant's editor uses (milliseconds since epoch). */
export const newAutomationId = (now = Date.now()) => String(now);

/** One step of the simple editor's "Then" list. `area_id` / `domain` are used by the room kind. */
export const emptyAction = (kind = "scene") => ({
  kind, entity_id: "", area_id: "", domain: "", service: kind === "scene" || kind === "script" ? "turn_on" : "",
});

export function emptyDraft() {
  return {
    alias: "",
    description: "",
    trigger: { kind: "time", at: "07:00", entity_id: "", to: "", event: "sunset", offset: "" },
    actions: [emptyAction()],
    area_id: "",
  };
}

const normalizeTime = (at) => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(at || "").trim());
  if (!m) return null;
  const [h, min, s = "00"] = [Number(m[1]), m[2], m[3]];
  if (h > 23 || Number(min) > 59 || Number(s) > 59) return null;
  return `${String(h).padStart(2, "0")}:${min}:${s}`;
};

/** Problems that stop the simple editor saving, in the order the form shows them. */
export function draftProblems(draft) {
  const problems = [];
  if (!String(draft.alias || "").trim()) problems.push("Give the automation a name.");
  const t = draft.trigger || {};
  if (t.kind === "time" && !normalizeTime(t.at)) problems.push("Enter a time like 07:30.");
  if (t.kind === "state" && !t.entity_id) problems.push("Choose the device that starts it.");
  if (t.kind === "sun" && !["sunrise", "sunset"].includes(t.event)) problems.push("Choose sunrise or sunset.");
  if (t.kind === "sun" && t.offset && !/^-?\d{1,2}:\d{2}(:\d{2})?$/.test(t.offset)) problems.push("Offset looks like -00:30 or 01:00.");
  const actions = draft.actions || [];
  if (!actions.length) problems.push("Add something for it to do.");
  actions.forEach((a, i) => {
    const prefix = actions.length > 1 ? `Action ${i + 1}: ` : "";
    for (const p of actionProblems(a)) problems.push(prefix + p);
  });
  return problems;
}

function actionProblems(a) {
  if (a.kind === "room") {
    if (!a.area_id) return ["Choose a room."];
    if (!ROOM_DOMAINS[a.domain]) return ["Choose which devices in the room."];
    return roomServices(a.domain).some(([s]) => s === a.service) ? [] : ["Choose what to do with them."];
  }
  if (!a.entity_id) return [a.kind === "scene" ? "Choose a scene." : a.kind === "script" ? "Choose a script." : "Choose a device to control."];
  if (a.kind === "service" && !(DEVICE_SERVICES[domainOf(a.entity_id)] || []).some(([s]) => s === a.service)) {
    return ["Choose what to do with the device."];
  }
  return [];
}

function actionToConfig(a) {
  if (a.kind === "room") return { action: `${a.domain}.${a.service}`, target: { area_id: a.area_id } };
  const service = a.kind === "scene" ? "scene.turn_on" : a.kind === "script" ? "script.turn_on" : `${domainOf(a.entity_id)}.${a.service}`;
  return { action: service, target: { entity_id: a.entity_id } };
}

/** Home Assistant automation config (2024.10+ `triggers` / `actions` keys) for a simple draft. */
export function draftToConfig(draft, base = {}) {
  const t = draft.trigger;
  const trigger = t.kind === "time"
    ? { trigger: "time", at: normalizeTime(t.at) }
    : t.kind === "state"
      ? { trigger: "state", entity_id: t.entity_id, ...(String(t.to || "").trim() ? { to: String(t.to).trim() } : {}) }
      : { trigger: "sun", event: t.event, ...(t.offset ? { offset: t.offset } : {}) };
  const { trigger: _t, triggers: _ts, condition: _c, conditions: _cs, action: _a, actions: _as, ...rest } = base;
  return {
    ...rest,
    alias: String(draft.alias).trim(),
    description: String(draft.description || "").trim(),
    mode: rest.mode || "single",
    triggers: [trigger],
    conditions: [],
    actions: draft.actions.map(actionToConfig),
  };
}

/** Simple-editor action for one config action, or null when it needs Home Assistant's editor. */
function parseAction(a) {
  if (!a || typeof a !== "object") return null;
  const service = a.action ?? a.service;
  if (typeof service !== "string" || Object.keys(a).some((k) => !["action", "service", "target", "entity_id", "metadata"].includes(k))) return null;
  if (a.metadata && Object.keys(a.metadata).length) return null;
  const target = a.target ?? (a.entity_id ? { entity_id: a.entity_id } : null);
  if (!target || Object.keys(target).length !== 1) return null;
  const [domain, name] = service.split(".");
  if ("area_id" in target) {
    const areaId = single(target.area_id);
    if (!areaId || !roomServices(domain).some(([s]) => s === name)) return null;
    return { ...emptyAction("room"), area_id: areaId, domain, service: name };
  }
  const entityId = single(target.entity_id);
  if (!entityId) return null;
  if (service === "scene.turn_on" && domainOf(entityId) === "scene") return { ...emptyAction("scene"), entity_id: entityId };
  if (service === "script.turn_on" && domainOf(entityId) === "script") return { ...emptyAction("script"), entity_id: entityId };
  if (domain === domainOf(entityId) && (DEVICE_SERVICES[domain] || []).some(([s]) => s === name)) {
    return { ...emptyAction("service"), entity_id: entityId, service: name };
  }
  return null;
}

/**
 * The simple-editor draft for a config, or null when the config does more than the simple
 * editor can show (several triggers, conditions, data, templates, waits, …).
 */
export function simpleDraft(config) {
  if (!config || typeof config !== "object") return null;
  const triggers = asList(config.triggers ?? config.trigger);
  const conditions = asList(config.conditions ?? config.condition);
  const actions = asList(config.actions ?? config.action);
  if (triggers.length !== 1 || !actions.length || conditions.length) return null;
  const draft = emptyDraft();
  draft.alias = config.alias || "";
  draft.description = config.description || "";

  const t = triggers[0];
  const platform = t.trigger ?? t.platform;
  const extra = (allowed) => Object.keys(t).some((k) => !["trigger", "platform", "id", ...allowed].includes(k));
  if (platform === "time" && typeof t.at === "string" && normalizeTime(t.at) && !extra(["at"])) {
    draft.trigger = { ...draft.trigger, kind: "time", at: normalizeTime(t.at).slice(0, 5) };
  } else if (platform === "state" && single(t.entity_id) && (t.to == null || typeof t.to === "string") && !extra(["entity_id", "to"])) {
    draft.trigger = { ...draft.trigger, kind: "state", entity_id: single(t.entity_id), to: t.to ?? "" };
  } else if (platform === "sun" && ["sunrise", "sunset"].includes(t.event) && (t.offset == null || typeof t.offset === "string") && !extra(["event", "offset"])) {
    draft.trigger = { ...draft.trigger, kind: "sun", event: t.event, offset: t.offset || "" };
  } else {
    return null;
  }

  draft.actions = actions.map(parseAction);
  return draft.actions.every(Boolean) ? draft : null;
}

/** Copy of a config for Duplicate: same behaviour, "(copy)" name, the new config id. */
export function duplicateConfig(config, id) {
  const { id: _old, ...rest } = config || {};
  return { ...rest, id, alias: `${config?.alias || "Automation"} (copy)` };
}

const SERVICE_VERBS = {
  turn_on: "Turn on", turn_off: "Turn off", toggle: "Toggle", open_cover: "Open", close_cover: "Close", stop_cover: "Stop",
  lock: "Lock", unlock: "Unlock", media_play: "Play", media_pause: "Pause", start: "Start", return_to_base: "Send home",
  open_valve: "Open", close_valve: "Close", trigger: "Run",
};

const names = (value, nameOf) => asList(value).map((id) => nameOf(id)).join(", ");

function describeTrigger(t, nameOf) {
  const platform = t.trigger ?? t.platform;
  switch (platform) {
    case "time": return `At ${asList(t.at).map((at) => (typeof at === "string" && /^\d/.test(at) ? at.slice(0, 5) : nameOf(at))).join(", ")}`;
    case "state": {
      const who = names(t.entity_id, nameOf) || "a device";
      if (t.to != null && t.to !== "") return `When ${who} changes to ${asList(t.to).join(" / ")}`;
      return `When ${who} changes`;
    }
    case "numeric_state": {
      const parts = [t.above != null && `above ${t.above}`, t.below != null && `below ${t.below}`].filter(Boolean).join(" and ");
      return `When ${names(t.entity_id, nameOf)} goes ${parts}`;
    }
    case "sun": return `At ${t.event}${t.offset ? ` (${t.offset})` : ""}`;
    case "time_pattern": return `Every ${[t.hours && `${t.hours} h`, t.minutes && `${t.minutes} min`, t.seconds && `${t.seconds} s`].filter(Boolean).join(" ") || "time pattern"}`;
    case "homeassistant": return t.event === "shutdown" ? "When Home Assistant stops" : "When Home Assistant starts";
    case "zone": return `When ${names(t.entity_id, nameOf)} ${t.event === "leave" ? "leaves" : "enters"} ${nameOf(t.zone)}`;
    case "device": return `Device trigger${t.type ? ` (${String(t.type).replace(/_/g, " ")})` : ""}`;
    case "event": return `On event ${t.event_type}`;
    case "mqtt": return `On MQTT ${t.topic}`;
    case "webhook": return "When a webhook is called";
    case "template": return "When a template becomes true";
    default: return `${platform || "Custom"} trigger`;
  }
}

function describeCondition(c, nameOf) {
  if (typeof c === "string") return "Template condition";
  switch (c.condition) {
    case "state": return `${names(c.entity_id, nameOf)} is ${asList(c.state).join(" / ")}`;
    case "numeric_state": return `${names(c.entity_id, nameOf)} is ${[c.above != null && `above ${c.above}`, c.below != null && `below ${c.below}`].filter(Boolean).join(" and ")}`;
    case "time": return `Time is ${[c.after && `after ${String(c.after).slice(0, 5)}`, c.before && `before ${String(c.before).slice(0, 5)}`].filter(Boolean).join(" and ") || "in range"}`;
    case "sun": return `Sun is ${[c.after && `after ${c.after}`, c.before && `before ${c.before}`].filter(Boolean).join(" and ")}`;
    case "zone": return `${names(c.entity_id, nameOf)} is in ${nameOf(c.zone)}`;
    case "and": case "or": case "not": return `${c.condition.toUpperCase()} of ${asList(c.conditions).length} conditions`;
    default: return `${c.condition || "Custom"} condition`;
  }
}

function describeAction(a, nameOf) {
  const service = a.action ?? a.service;
  if (typeof service === "string") {
    const [domain, verb] = service.split(".");
    const target = names(a.target?.entity_id ?? a.entity_id ?? a.data?.entity_id, nameOf);
    if (domain === "scene" && verb === "turn_on") return `Activate ${target || "a scene"}`;
    if (domain === "script" && verb !== "turn_on" && verb !== "turn_off") return `Run ${nameOf(service)}`;
    if (domain === "notify") return `Send a notification${verb && verb !== "notify" ? ` (${verb.replace(/_/g, " ")})` : ""}`;
    const what = SERVICE_VERBS[verb] || `${domain}.${verb}`;
    const rooms = names(a.target?.area_id, nameOf);
    if (!target && rooms) return `${what} ${ROOM_DOMAINS[domain] || "devices"} in ${rooms}`;
    return target ? `${what} ${target}` : what;
  }
  if (a.scene) return `Activate ${nameOf(a.scene)}`;
  if (a.delay != null) return `Wait ${typeof a.delay === "string" ? a.delay : JSON.stringify(a.delay)}`;
  if (a.wait_template || a.wait_for_trigger) return "Wait for something to happen";
  if (a.choose) return `Choose between ${asList(a.choose).length} options`;
  if (a.if) return "If / then";
  if (a.repeat) return "Repeat actions";
  if (a.parallel) return "Run actions in parallel";
  if (a.condition) return `Continue only if ${describeCondition(a, nameOf)}`;
  if (a.event) return `Fire event ${a.event}`;
  if (a.device_id) return `Device action${a.type ? ` (${String(a.type).replace(/_/g, " ")})` : ""}`;
  if (a.stop) return `Stop: ${a.stop}`;
  return "Custom action";
}

/** "What this will do" (ControlZ automation tile): one line per trigger, condition and action. */
export function describeAutomation(config, nameOf = (id) => id) {
  return {
    triggers: asList(config?.triggers ?? config?.trigger).map((t) => describeTrigger(t, nameOf)),
    conditions: asList(config?.conditions ?? config?.condition).map((c) => describeCondition(c, nameOf)),
    actions: asList(config?.actions ?? config?.action).map((a) => describeAction(a, nameOf)),
    mode: config?.mode || "single",
  };
}
