/**
 * Minimal stand-in for the Home Assistant frontend `hass` object: applies common
 * service calls to the fixture states and pushes a fresh `hass` to listeners.
 */
import { makeFixture } from "./fixture.js";

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

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
    automation: (service, _data, id) => patch(id, (s) => {
      if (service === "toggle") s.state = s.state === "on" ? "off" : "on";
    }),
    scene: (_service, _data, id) => patch(id, (s) => { s.state = new Date().toISOString(); }),
    script: (_service, _data, id) => patch(id, (_s, a) => { a.last_triggered = new Date().toISOString(); }),
  };

  const build = () => ({
    ...fixture,
    states: { ...fixture.states },
    language: "en",
    themes: { darkMode: false },
    callService: async (domain, service, data = {}) => {
      calls.push({ domain, service, data });
      hass = { ...hass, states: { ...hass.states } };
      for (const id of toArray(data.entity_id)) handlers[domain]?.(service, data, id);
      onChange?.(hass, calls);
    },
    user: { is_admin: true, name: "Harness" },
    // Dashboard config for "Hide rooms & devices", kept for the browser session.
    callWS: async (msg) => {
      const key = "controlz-harness-dashboard";
      if (msg.type === "lovelace/config") {
        return JSON.parse(sessionStorage.getItem(key) || '{"strategy":{"type":"custom:controlz-rooms"}}');
      }
      if (msg.type === "lovelace/config/save") {
        sessionStorage.setItem(key, JSON.stringify(msg.config));
        return null;
      }
      return [];
    },
  });

  hass = build();
  return { get hass() { return hass; }, calls };
}
