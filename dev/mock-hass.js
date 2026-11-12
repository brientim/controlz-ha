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

const SCRIPTS_KEY = "controlz-harness-scripts";
const SEED_SCRIPTS = {
  evening_wind_down: {
    alias: "Evening Wind Down", mode: "single",
    sequence: [
      { action: "scene.turn_on", target: { entity_id: "scene.office_relax" } },
      { delay: "00:10:00" },
      { action: "light.turn_off", target: { area_id: "living_room" } },
    ],
  },
  good_morning: {
    alias: "Good Morning", icon: "mdi:weather-sunny", mode: "single",
    sequence: [
      { action: "cover.open_cover", target: { area_id: "living_room" } },
      { action: "scene.turn_on", target: { entity_id: "scene.office_focus" } },
      { action: "tts.speak", target: { entity_id: "tts.google_translate_en_com" }, data: { media_player_entity_id: "media_player.kitchen_speaker", message: "Good morning" } },
    ],
  },
};

/** Config stores the mock config API serves: `config/<domain>/config/<id>`. */
const CONFIG_STORES = {
  script: {
    key: SCRIPTS_KEY, seed: SEED_SCRIPTS, name: (c) => c.alias, state: "off", entityId: (id) => `script.${id}`,
    attributes: (c) => ({ last_triggered: null, mode: c.mode || "single", ...(c.icon ? { icon: c.icon } : {}) }),
  },
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

/** Seeded random numbers per entity, so the harness history looks the same on every load. */
const seeded = (text) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};

/** Fake calendar events around today (local times), as `/api/calendars/<entity>` returns them. */
function mockCalendar(entityId) {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const at = (days, h, m = 0) => new Date(day.getTime() + days * 86_400_000 + (h * 60 + m) * 60_000);
  const date = (days) => {
    const d = at(days, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const soon = new Date(Date.now() + 40 * 60_000);
  soon.setSeconds(0, 0);
  const timed = (summary, start, minutes, location = "") => ({
    summary, location, start: { dateTime: start.toISOString() }, end: { dateTime: new Date(start.getTime() + minutes * 60_000).toISOString() },
  });
  const allDay = (summary, days, length = 1) => ({ summary, start: { date: date(days) }, end: { date: date(days + length) } });
  if (entityId === "calendar.work") {
    return [timed("Team sync", at(0, 9, 30), 30, "Teams"), timed("Planning", at(1, 9), 60), timed("1:1 with Sam", at(3, 15), 30), timed("Release review", at(4, 11), 45)];
  }
  return [
    allDay("Bin night", 0), timed("School pickup", soon, 30, "Primary school"), timed("Dinner with Alex", at(1, 18, 30), 120, "Bistro"),
    allDay("Mum's birthday", 2), timed("Swimming lesson", at(2, 8), 45), timed("Car service", at(4, 10), 90, "Garage"), allDay("Long weekend", 5, 2),
  ];
}

const TODOS_KEY = "controlz-harness-todos";
const SEED_TODOS = {
  "todo.shopping_list": [
    { uid: "1", summary: "Milk", status: "needs_action" }, { uid: "2", summary: "Coffee beans", status: "needs_action" },
    { uid: "3", summary: "Batteries (AA)", status: "needs_action", due: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) },
    { uid: "4", summary: "Bread", status: "completed" },
  ],
  "todo.chores": [{ uid: "1", summary: "Water the plants", status: "needs_action" }, { uid: "2", summary: "Take the bins out", status: "needs_action" }],
};

/** Fake `weather/subscribe_forecast` data: 48 hours or 7 days from now. */
function mockForecast(type) {
  const rnd = seeded(type);
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const conditions = ["sunny", "partlycloudy", "cloudy", "rainy", "partlycloudy", "sunny", "lightning-rainy"];
  if (type === "hourly") {
    return Array.from({ length: 48 }, (_, i) => {
      const t = new Date(start.getTime() + i * 3_600_000);
      const h = t.getHours();
      return {
        datetime: t.toISOString(), condition: h < 6 || h > 19 ? "clear-night" : conditions[Math.floor(i / 7) % conditions.length],
        temperature: Math.round((18 + 6 * Math.sin(((h - 9) / 24) * Math.PI * 2) + (rnd() - 0.5) * 2) * 10) / 10,
        precipitation_probability: Math.round(rnd() * (i > 20 && i < 30 ? 80 : 20)),
      };
    });
  }
  return Array.from({ length: 7 }, (_, i) => ({
    datetime: new Date(start.getTime() + i * 86_400_000).toISOString(), condition: conditions[i % conditions.length],
    temperature: Math.round(20 + rnd() * 8), templow: Math.round(9 + rnd() * 6), precipitation_probability: Math.round(rnd() * 70),
    precipitation: Math.round(rnd() * 80) / 10,
  }));
}

/** Fake recorder history (compressed format, seconds) ending in each entity's current state. */
function mockHistory(states, { start_time, end_time, entity_ids = [] }) {
  const start = Date.parse(start_time);
  const end = Date.parse(end_time) || Date.now();
  const out = {};
  for (const id of entity_ids) {
    const s = states[id];
    if (!s) continue;
    const rnd = seeded(id);
    const entries = [];
    const add = (t, state) => entries.push({ s: String(state), lu: t / 1000 });
    const domain = id.split(".")[0];
    const dc = s.attributes?.device_class;
    if (domain === "sensor" && Number.isFinite(Number(s.state))) {
      const now = Number(s.state);
      const amp = { temperature: 2.2, humidity: 7, illuminance: 180, battery: 0 }[dc] ?? now * 0.1;
      const step = 15 * 60_000;
      for (let t = start; t < end; t += step) {
        const day = Math.sin(((t / 3_600_000) % 24) / 24 * Math.PI * 2 - Math.PI / 2);
        const v = dc === "battery" ? now : now + amp * day + (rnd() - 0.5) * amp * 0.3 - amp * Math.sin(((end / 3_600_000) % 24) / 24 * Math.PI * 2 - Math.PI / 2);
        add(t, Math.round(Math.max(0, v) * 10) / 10);
      }
      add(end - 1000, s.state);
    } else {
      const states2 = domain === "lock" ? ["locked", "unlocked"] : domain === "cover" ? ["closed", "open"]
        : domain === "alarm_control_panel" ? ["disarmed", "armed_away"] : ["off", "on"];
      const motion = ["motion", "occupancy", "presence"].includes(dc);
      const hazard = ["smoke", "gas", "carbon_monoxide", "moisture", "safety", "tamper"].includes(dc);
      const gap = motion ? [25, 120] : domain === "alarm_control_panel" ? [400, 700] : [150, 420];
      const hold = motion ? [2, 12] : domain === "alarm_control_panel" ? [200, 400] : [1, 25];
      add(start, states2[0]);
      let t = start + rnd() * gap[1] * 60_000;
      while (!hazard && t < end - 30 * 60_000) {
        add(t, states2[1]);
        t += (hold[0] + rnd() * (hold[1] - hold[0])) * 60_000;
        add(t, states2[0]);
        t += (gap[0] + rnd() * (gap[1] - gap[0])) * 60_000;
      }
      if (String(entries.at(-1).s) !== String(s.state)) add(Math.min(end - 1000, Math.max(entries.at(-1).lu * 1000 + 60_000, Date.parse(s.last_changed) || 0)), s.state);
    }
    out[id] = entries.filter((e, i) => i === 0 || e.lu * 1000 >= start);
  }
  return out;
}

export function createMockHass(onChange) {
  const fixture = makeFixture();
  const calls = [];
  const todoItems = () => session.get(TODOS_KEY, structuredClone(SEED_TODOS));
  const scriptTimers = {};
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
    todo: (service, data, id) => {
      const all = todoItems();
      const list = all[id] || [];
      if (service === "add_item") list.push({ uid: String(Date.now()), summary: data.item, status: "needs_action" });
      if (service === "update_item") {
        const hit = list.find((i) => i.uid === data.item || i.summary === data.item);
        if (hit && data.status) hit.status = data.status;
      }
      all[id] = list;
      session.set(TODOS_KEY, all);
      patch(id, (s) => { s.state = String(list.filter((i) => i.status !== "completed").length); });
    },
    media_player: (service, data, id) => patch(id, (s, a) => {
      if (service === "media_play_pause") s.state = s.state === "playing" ? "paused" : "playing";
      if (service === "turn_off") s.state = "off";
      if (service === "turn_on") s.state = "idle";
      if (service === "volume_set") a.volume_level = data.volume_level;
      if (service === "volume_mute") a.is_volume_muted = data.is_volume_muted;
      if (service === "select_source") a.source = data.source;
      if (service === "media_next_track" || service === "media_previous_track") a.media_title = service === "media_next_track" ? "Heart of Gold" : "Old Man";
    }),
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
    script: (service, _data, id) => {
      patch(id, (s, a) => {
        s.state = service === "turn_off" ? "off" : "on";
        if (service !== "turn_off") a.last_triggered = new Date().toISOString();
      });
      clearTimeout(scriptTimers[id]);
      if (service !== "turn_off") {
        scriptTimers[id] = setTimeout(() => {
          hass = { ...hass, states: { ...hass.states } };
          patch(id, (s) => { s.state = "off"; });
          push();
        }, Number(new URLSearchParams(globalThis.location?.search || "").get("script_ms") || 6000));
      }
    },
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
          entityId = store.entityId ? store.entityId(id) : `${domain}.${slug(store.name(config))}`;
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
    const calendar = /^calendars\/([^?]+)/.exec(path);
    if (calendar) {
      await new Promise((r) => setTimeout(r, 60));
      return mockCalendar(decodeURIComponent(calendar[1]));
    }
    const match = /^config\/(automation|scene|script)\/config\/(.+)$/.exec(path);
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
    if (method === "POST") stored[id] = domain === "script" ? { ...body, __area: stored[id]?.__area } : { ...stored[id], ...body, id };
    if (method === "DELETE") stored[id] = null;
    session.set(key, stored);
    await new Promise((r) => setTimeout(r, 150));
    syncConfigs();
    push();
    return { result: "ok" };
  };

  const callWS = async (msg) => {
    if (msg.type === "todo/item/list") return { items: structuredClone(todoItems()[msg.entity_id] || []) };
    if (msg.type === "history/history_during_period") {
      calls.push({ domain: "ws", service: msg.type, data: { entity_ids: msg.entity_ids.length } });
      await new Promise((r) => setTimeout(r, 80));
      return mockHistory(hass.states, msg);
    }
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
    connection: {
      subscribeMessage: (cb, msg) => {
        calls.push({ domain: "ws", service: `subscribe ${msg.type}`, data: { forecast_type: msg.forecast_type } });
        const timer = setTimeout(() => cb({ type: msg.forecast_type, forecast: mockForecast(msg.forecast_type) }), 60);
        return Promise.resolve(() => clearTimeout(timer));
      },
    },
    user: { is_admin: new URLSearchParams(globalThis.location?.search || "").get("admin") !== "0", name: "Harness" },
  });

  hass = build();
  syncConfigs();
  return { get hass() { return hass; }, calls };
}
