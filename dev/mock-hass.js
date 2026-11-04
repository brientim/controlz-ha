/**
 * Minimal stand-in for the Home Assistant frontend `hass` object: applies common
 * service calls to the fixture states and pushes a fresh `hass` to listeners. Also fakes the
 * automation and scene config APIs, frontend user data (favorites) and entity registry area updates.
 */
import { makeFixture } from "./fixture.js";

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const DASHBOARD_KEY = "controlz-harness-dashboard";
const USER_DATA_KEY = "controlz-harness-user-data";
const AUTOMATIONS_KEY = "controlz-harness-automations";
const DEFAULT_FAVORITES = {
  areas: ["office", "kitchen"],
  entities: ["light.office_desk_lamp", "lock.front_door", "scene.office_relax", "climate.living_room_thermostat", "automation.office_lights_at_sunset"],
};
const SEED_AUTOMATIONS = {
  1700000000001: {
    id: "1700000000001", alias: "Office Lights at Sunset", description: "", mode: "single",
    triggers: [{ trigger: "sun", event: "sunset", offset: "-00:15:00" }],
    conditions: [], actions: [{ action: "light.turn_on", target: { entity_id: "light.office_desk_lamp" } }],
  },
  1700000000002: {
    id: "1700000000002", alias: "Morning Blinds", description: "", mode: "single",
    triggers: [{ trigger: "time", at: "07:00:00" }],
    conditions: [], actions: [{ action: "cover.open_cover", target: { entity_id: "cover.lounge_left_roller_blind" } }],
  },
  1700000000003: {
    id: "1700000000003", alias: "Leak Alert", description: "", mode: "single",
    triggers: [{ trigger: "state", entity_id: "binary_sensor.smoke_kitchen", to: "on" }],
    conditions: [{ condition: "time", after: "06:00:00", before: "23:00:00" }],
    actions: [{ action: "notify.notify", data: { message: "Check the kitchen" } }, { delay: "00:01:00" }, { action: "light.turn_on", target: { entity_id: "light.kitchen_bench_light" } }],
  },
};

const SCENES_KEY = "controlz-harness-scenes";
const SEED_SCENES = {
  1700000000101: {
    id: "1700000000101", name: "Office Focus",
    entities: {
      "light.office_desk_lamp": { state: "on", brightness: 255, color_mode: "color_temp", color_temp_kelvin: 5000 },
      "light.office_colour_light": { state: "off" },
      "cover.office_roller_blind": { state: "open", current_position: 60 },
    },
    metadata: {},
  },
  1700000000102: {
    id: "1700000000102", name: "Office Relax",
    entities: { "light.office_desk_lamp": { state: "on", brightness: 102 }, "light.office_colour_light": { state: "on", brightness: 64, rgb_color: [255, 140, 60] } },
    metadata: {},
  },
};

/** Config stores the mock config API serves: `config/<domain>/config/<id>`. */
const CONFIG_STORES = {
  automation: {
    key: AUTOMATIONS_KEY, seed: SEED_AUTOMATIONS, name: (c) => c.alias, state: "on",
    attributes: (c) => ({ last_triggered: null, mode: c.mode || "single", current: 0 }),
  },
  scene: {
    key: SCENES_KEY, seed: SEED_SCENES, name: (c) => c.name, state: "unknown",
    attributes: (c) => ({ entity_id: Object.keys(c.entities || {}) }),
  },
};

const session = {
  get: (key, fallback) => {
    try {
      return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => sessionStorage.setItem(key, JSON.stringify(value)),
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "automation";

export function createMockHass(onChange) {
  const fixture = makeFixture();
  const calls = [];
  let hass;

  const patch = (entityId, fn) => {
    const prev = hass.states[entityId];
    if (!prev) return;
    const next = structuredClone(prev);
    fn(next, next.attributes);
    next.last_changed = next.state !== prev.state ? new Date().toISOString() : prev.last_changed;
    next.last_updated = new Date().toISOString();
    hass.states[entityId] = next;
  };

  const handlers = {
    light: (service, data, id) => patch(id, (s, a) => {
      const on = service === "turn_on" || (service === "toggle" && s.state !== "on");
      s.state = on ? "on" : "off";
      if (!on) {
        delete a.brightness; delete a.color_mode; delete a.rgb_color;
        return;
      }
      a.brightness = data.brightness_pct != null ? Math.round((data.brightness_pct / 100) * 255) : (a.brightness ?? 255);
      if (data.rgb_color) { a.rgb_color = data.rgb_color; a.color_mode = "hs"; }
      else if (data.color_temp_kelvin) { delete a.rgb_color; a.color_mode = "color_temp"; a.color_temp_kelvin = data.color_temp_kelvin; }
      else a.color_mode ??= a.supported_color_modes?.[0];
    }),
    switch: (service, _data, id) => patch(id, (s) => {
      s.state = service === "turn_on" || (service === "toggle" && s.state !== "on") ? "on" : "off";
    }),
    fan: (service, data, id) => patch(id, (s, a) => {
      if (service === "turn_on" || service === "turn_off" || service === "toggle") {
        s.state = service === "turn_on" || (service === "toggle" && s.state !== "on") ? "on" : "off";
      }
      if (service === "set_percentage") { a.percentage = data.percentage; s.state = data.percentage > 0 ? "on" : "off"; }
      if (service === "set_preset_mode") { a.preset_mode = data.preset_mode; s.state = "on"; }
      if (service === "oscillate") a.oscillating = data.oscillating;
      if (service === "set_direction") a.direction = data.direction;
    }),
    climate: (service, data, id) => patch(id, (s, a) => {
      if (service === "set_temperature") {
        if (data.temperature != null) a.temperature = data.temperature;
        if (data.target_temp_low != null) { a.target_temp_low = data.target_temp_low; a.target_temp_high = data.target_temp_high; }
      }
      if (service === "set_hvac_mode") {
        s.state = data.hvac_mode;
        a.hvac_action = data.hvac_mode === "off" ? "off" : data.hvac_mode === "cool" ? "cooling" : data.hvac_mode === "heat" ? "heating" : "idle";
        if (data.hvac_mode === "heat_cool") { a.target_temp_low = a.temperature - 1; a.target_temp_high = a.temperature + 2; delete a.temperature; }
        else if (a.temperature == null) a.temperature = a.target_temp_low ?? 21;
      }
      if (service === "set_preset_mode") a.preset_mode = data.preset_mode;
      if (service === "set_fan_mode") a.fan_mode = data.fan_mode;
    }),
    cover: (service, data, id) => patch(id, (s, a) => {
      if (service === "open_cover") a.current_position = 100;
      if (service === "close_cover") a.current_position = 0;
      if (service === "set_cover_position") a.current_position = data.position;
      s.state = (a.current_position ?? 0) > 0 ? "open" : "closed";
    }),
    lock: (service, _data, id) => patch(id, (s) => { s.state = service === "lock" ? "locked" : "unlocked"; }),
    alarm_control_panel: (service, _data, id) => patch(id, (s) => {
      s.state = service === "alarm_disarm" ? "disarmed" : service.replace("alarm_arm_", "armed_");
    }),
    automation: (service, _data, id) => patch(id, (s, a) => {
      if (service === "toggle") s.state = s.state === "on" ? "off" : "on";
      if (service === "turn_on") s.state = "on";
      if (service === "turn_off") s.state = "off";
      if (service === "trigger") a.last_triggered = new Date().toISOString();
    }),
    scene: (_service, _data, id) => patch(id, (s) => { s.state = new Date().toISOString(); }),
    script: (_service, _data, id) => patch(id, (_s, a) => { a.last_triggered = new Date().toISOString(); }),
  };

  const push = () => {
    hass = { ...hass, states: { ...hass.states }, entities: { ...hass.entities } };
    onChange?.(hass, calls);
  };

  const configs = (domain) => ({ ...CONFIG_STORES[domain].seed, ...session.get(CONFIG_STORES[domain].key, {}) });

  /** Apply stored automation / scene configs (harness session) to states and the entity registry. */
  const syncConfigs = () => {
    for (const [domain, store] of Object.entries(CONFIG_STORES)) {
      for (const [id, config] of Object.entries(session.get(store.key, {}))) {
        let entityId = Object.keys(hass.states).find((e) => e.startsWith(`${domain}.`) && String(hass.states[e].attributes.id) === id);
        if (config === null) {
          if (entityId) { delete hass.states[entityId]; delete hass.entities[entityId]; }
          continue;
        }
        if (!entityId) {
          entityId = `${domain}.${slug(store.name(config))}`;
          while (hass.states[entityId]) entityId += "_2";
          hass.states[entityId] = {
            entity_id: entityId, state: store.state, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(),
            attributes: { friendly_name: store.name(config), id, ...store.attributes(config) },
          };
          hass.entities[entityId] = { area_id: config.__area ?? null, device_id: null, hidden: false, entity_category: null };
        } else {
          hass.states[entityId] = { ...hass.states[entityId], attributes: { ...hass.states[entityId].attributes, friendly_name: store.name(config) } };
          if (config.__area !== undefined) hass.entities[entityId] = { ...hass.entities[entityId], area_id: config.__area };
        }
      }
    }
  };

  const callApi = async (method, path, body) => {
    calls.push({ domain: "api", service: `${method} ${path}`, data: body ?? {} });
    const match = /^config\/(automation|scene)\/config\/(.+)$/.exec(path);
    if (!match) throw new Error(`mock: unsupported API ${method} ${path}`);
    const [, domain] = match;
    const id = decodeURIComponent(match[2]);
    const { key } = CONFIG_STORES[domain];
    const stored = session.get(key, {});
    if (method === "GET") {
      const config = configs(domain)[id];
      if (!config) throw Object.assign(new Error("Resource not found"), { status_code: 404 });
      const { __area, ...clean } = config;
      return structuredClone(clean);
    }
    if (method === "POST") stored[id] = { ...stored[id], ...body, id };
    if (method === "DELETE") stored[id] = null;
    session.set(key, stored);
    await new Promise((r) => setTimeout(r, 150));
    syncConfigs();
    push();
    return { result: "ok" };
  };

  const callWS = async (msg) => {
    if (msg.type === "lovelace/config") return session.get(DASHBOARD_KEY, { strategy: { type: "custom:controlz-rooms" } });
    if (msg.type === "lovelace/config/save") {
      session.set(DASHBOARD_KEY, msg.config);
      return null;
    }
    if (msg.type === "frontend/get_user_data") return { value: session.get(USER_DATA_KEY, {})[msg.key] ?? (msg.key === "controlz-ha-favorites" ? DEFAULT_FAVORITES : null) };
    if (msg.type === "frontend/set_user_data") {
      session.set(USER_DATA_KEY, { ...session.get(USER_DATA_KEY, {}), [msg.key]: msg.value });
      return null;
    }
    if (msg.type === "config/entity_registry/update") {
      calls.push({ domain: "registry", service: "update", data: msg });
      hass.entities[msg.entity_id] = { ...hass.entities[msg.entity_id], area_id: msg.area_id };
      const id = hass.states[msg.entity_id]?.attributes?.id;
      const store = CONFIG_STORES[msg.entity_id.split(".")[0]];
      if (id && store) {
        const stored = session.get(store.key, {});
        stored[id] = { ...(stored[id] || configs(msg.entity_id.split(".")[0])[id]), __area: msg.area_id };
        session.set(store.key, stored);
      }
      push();
      return { entity_entry: hass.entities[msg.entity_id] };
    }
    return [];
  };

  const build = () => ({
    ...fixture,
    states: { ...fixture.states },
    entities: { ...fixture.entities },
    language: "en",
    themes: { darkMode: false },
    hassUrl: (path) => path,
    callService: async (domain, service, data = {}) => {
      calls.push({ domain, service, data });
      hass = { ...hass, states: { ...hass.states } };
      for (const id of toArray(data.entity_id)) handlers[domain]?.(service, data, id);
      onChange?.(hass, calls);
    },
    callApi,
    callWS,
    user: { is_admin: new URLSearchParams(globalThis.location?.search || "").get("admin") !== "0", name: "Harness" },
  });

  hass = build();
  syncConfigs();
  return { get hass() { return hass; }, calls };
}
