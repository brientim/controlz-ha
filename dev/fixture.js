/**
 * Fixture Home Assistant registry + states, shaped like the real `hass` object.
 * Shared by unit tests (node) and the visual harness (browser).
 */

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const area = (area_id, name, icon, floor_id = "ground") => ({ area_id, name, icon, floor_id });

const light = (name, { on = false, bri = 200, modes = ["brightness"], mode, rgb, unavailable } = {}) => ({
  state: unavailable ? "unavailable" : on ? "on" : "off",
  attributes: {
    friendly_name: name,
    supported_color_modes: modes,
    ...(on ? { brightness: bri, color_mode: mode || modes[0] } : {}),
    ...(on && rgb ? { rgb_color: rgb } : {}),
  },
});

const cover = (name, position, extra = {}) => ({
  state: position > 0 ? "open" : "closed",
  attributes: { friendly_name: name, current_position: position, supported_features: 15, ...extra },
});

export function makeFixture() {
  const areas = {
    office: area("office", "Office", "mdi:desk"),
    kitchen: area("kitchen", "Kitchen", "mdi:countertop"),
    living_room: area("living_room", "Living Room", "mdi:sofa"),
    bedroom_1: area("bedroom_1", "Bedroom 1", "mdi:bed", "upstairs"),
    garage: area("garage", "Garage", "mdi:garage"),
    entrance: area("entrance", "Entrance", "mdi:door"),
  };
  const floors = {
    ground: { floor_id: "ground", name: "Ground", level: 0 },
    upstairs: { floor_id: "upstairs", name: "Upstairs", level: 1 },
  };

  const devices = {
    dev_office_motion: { id: "dev_office_motion", area_id: "office", name: "Office Motion Sensor" },
    dev_lounge_motion: { id: "dev_lounge_motion", area_id: "living_room", name: "Lounge Motion Sensor" },
    dev_front_lock: { id: "dev_front_lock", area_id: "entrance", name: "Front Door Lock" },
    dev_kitchen_hue: { id: "dev_kitchen_hue", area_id: "kitchen", name: "Kitchen Bench" },
    dev_garage_lock: { id: "dev_garage_lock", area_id: "garage", name: "Garage Side Lock" },
  };
  const cameraSvg = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#64748b"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="250" y="90" width="140" height="230" fill="#334155" stroke="#94a3b8" stroke-width="6"/><circle cx="365" cy="210" r="8" fill="#e2e8f0"/><rect x="0" y="320" width="640" height="40" fill="#0f172a"/></svg>`
  )}`;

  const states = {
    "light.office_colour_light": light("Office Colour Light", {
      on: true, bri: 255, modes: ["hs", "color_temp"], mode: "hs", rgb: [249, 115, 22],
    }),
    "light.office_desk_lamp": light("Office Desk Lamp", { on: true, bri: 140, modes: ["color_temp"] }),
    "switch.office_light_switch": { state: "on", attributes: { friendly_name: "Office Light Switch" } },
    "cover.office_roller_blind": cover("Office Roller Blind", 35),
    "binary_sensor.office_motion": {
      state: "off", last_changed: ago(8), attributes: { friendly_name: "Office Motion Sensor", device_class: "motion" },
    },
    "sensor.office_motion_temperature": {
      state: "22.43", attributes: { friendly_name: "Office Temperature", device_class: "temperature", unit_of_measurement: "°C" },
    },
    "sensor.office_motion_battery": {
      state: "88", attributes: { friendly_name: "Office Motion Battery", device_class: "battery", unit_of_measurement: "%" },
    },
    "binary_sensor.office_window": {
      state: "on", last_changed: ago(3), attributes: { friendly_name: "Office Window", device_class: "window" },
    },
    "scene.office_focus": { state: "2026-11-04T01:00:00+00:00", attributes: { friendly_name: "Office Focus", id: "1700000000101" } },
    "scene.office_bright": { state: "unknown", attributes: { friendly_name: "Office Bright Office" } },
    "scene.office_relax": { state: "unknown", attributes: { friendly_name: "Office Relax", id: "1700000000102" } },
    "scene.office_natural_light": { state: "unknown", attributes: { friendly_name: "Office Natural light Office" } },
    "scene.office_nightlight": { state: "unknown", attributes: { friendly_name: "Office Nightlight Office" } },
    "automation.office_lights_at_sunset": {
      state: "on", attributes: { friendly_name: "Office Lights at Sunset", id: "1700000000001", last_triggered: ago(1440), mode: "single", current: 0 },
    },

    "light.kitchen_bench_light": light("Kitchen Bench Light", { on: true, bri: 217 }),
    "light.kitchen_sink_light": light("Kitchen Sink Light"),
    "light.kitchen_stove_light": light("Kitchen Stove Light", { on: true, bri: 122 }),
    "switch.kitchen_kettle": {
      state: "on", attributes: { friendly_name: "Kitchen Kettle", device_class: "outlet" },
    },
    "binary_sensor.smoke_kitchen": {
      state: "off", attributes: { friendly_name: "Smoke Kitchen", device_class: "smoke" },
    },
    "sensor.kitchen_humidity": {
      state: "54", attributes: { friendly_name: "Kitchen Humidity", device_class: "humidity", unit_of_measurement: "%" },
    },

    "light.lounge_lamp": light("Lounge Lamp", { modes: ["hs"] }),
    "light.tv_white_lamp": light("TV White Lamp", { modes: ["color_temp"] }),
    "cover.lounge_left_roller_blind": cover("Lounge Left Roller Blind", 60),
    "cover.lounge_right_roller_blind": cover("Lounge Right Roller Blind", 0),
    "binary_sensor.lounge_motion": {
      state: "on", last_changed: ago(0.2), attributes: { friendly_name: "Lounge Motion Sensor", device_class: "motion" },
    },
    "sensor.lounge_motion_temperature": {
      state: "21.0", attributes: { friendly_name: "Lounge Temperature", device_class: "temperature", unit_of_measurement: "°C" },
    },
    "script.evening_wind_down": {
      state: "off", attributes: { friendly_name: "Evening Wind Down", last_triggered: ago(600), id: "evening_wind_down" },
    },
    "media_player.lounge_tv": {
      state: "playing",
      attributes: {
        friendly_name: "Lounge TV", device_class: "tv", app_name: "Netflix", volume_level: 0.2, is_volume_muted: false,
        source: "Netflix", source_list: ["Netflix", "YouTube", "HDMI 1"], supported_features: 18829,
      },
    },
    "climate.living_room_thermostat": {
      state: "heat",
      attributes: {
        friendly_name: "Living Room Thermostat", hvac_modes: ["off", "heat", "cool", "heat_cool"], hvac_action: "heating",
        current_temperature: 19.5, temperature: 21, min_temp: 7, max_temp: 35, target_temp_step: 0.5,
        preset_modes: ["home", "eco", "away"], preset_mode: "home", fan_modes: ["auto", "low", "high"], fan_mode: "auto", supported_features: 409,
      },
    },
    "automation.morning_blinds": {
      state: "off", attributes: { friendly_name: "Morning Blinds", id: "1700000000002", last_triggered: null, mode: "single", current: 0 },
    },

    "light.bedroom_1_light": light("Bedroom 1 Light"),
    "cover.bedroom_1_curtains": cover("Bedroom 1 Curtains", 50),
    "light.mums_bedside_lamp": light("Mum's Bedside Lamp", { unavailable: true }),
    "fan.bedroom_1_ceiling_fan": {
      state: "on",
      attributes: {
        friendly_name: "Bedroom 1 Ceiling Fan", percentage: 50, percentage_step: 25, oscillating: false, direction: "forward",
        preset_modes: ["breeze", "sleep"], preset_mode: null, supported_features: 15,
      },
    },

    "light.garage_entrance_downlight": light("Garage Entrance Downlight", { on: true, bri: 178 }),
    "cover.garage_door": cover("Garage Door", 0, { device_class: "garage", supported_features: 3 }),
    "lock.garage_side_lock": { state: "unlocked", attributes: { friendly_name: "Garage Side Lock" } },
    "sensor.garage_side_lock_battery": {
      state: "12", attributes: { friendly_name: "Garage Side Lock Battery", device_class: "battery", unit_of_measurement: "%" },
    },

    "lock.front_door": { state: "locked", attributes: { friendly_name: "Front Door Lock" } },
    "sensor.front_door_lock_battery": {
      state: "86", attributes: { friendly_name: "Front Door Lock Battery", device_class: "battery", unit_of_measurement: "%" },
    },
    "binary_sensor.front_door": {
      state: "off", last_changed: ago(45), attributes: { friendly_name: "Front Door Sensor", device_class: "door" },
    },
    "alarm_control_panel.house": { state: "disarmed", attributes: { friendly_name: "House Alarm", code_format: null } },
    "light.front_door_outside_light": light("Front Door Outside Light", { on: true, bri: 255, modes: ["onoff"] }),
    "camera.front_door": {
      state: "idle", attributes: { friendly_name: "Front Door Camera", entity_picture: cameraSvg, access_token: "harness" },
    },

    "light.unassigned": light("Unassigned Lamp"),
    "automation.leak_alert": {
      state: "on", attributes: { friendly_name: "Leak Alert", id: "1700000000003", last_triggered: ago(4320), mode: "single", current: 0 },
    },

    "media_player.kitchen_speaker": {
      state: "playing",
      attributes: {
        friendly_name: "Kitchen Speaker", device_class: "speaker", volume_level: 0.35, is_volume_muted: false, media_title: "Harvest Moon",
        media_artist: "Neil Young", media_content_type: "music", source: "Radio", source_list: ["Radio", "Spotify", "TV"], supported_features: 23485,
      },
    },
    "script.good_morning": { state: "off", attributes: { friendly_name: "Good Morning", last_triggered: ago(1500), id: "good_morning", icon: "mdi:weather-sunny" } },
    "scene.house_all_off": { state: "unknown", attributes: { friendly_name: "All Off", id: "1700000000103" } },
    "person.tim": { state: "home", attributes: { friendly_name: "Tim" } },
    "zone.home": { state: "1", attributes: { friendly_name: "Home", latitude: 37.3349, longitude: -122.009, radius: 100 } },
    "zone.work": { state: "0", attributes: { friendly_name: "Work", latitude: 37.3318, longitude: -122.0312, radius: 200 } },
    "tts.google_translate_en_com": { state: "unknown", attributes: { friendly_name: "Google Translate en com" } },
    "sun.sun": {
      state: "above_horizon",
      attributes: { friendly_name: "Sun", elevation: 42.1, azimuth: 61.3, rising: true, next_rising: ago(-1150), next_setting: ago(-470), next_dawn: ago(-1125), next_dusk: ago(-445) },
    },
    "weather.home": {
      state: "partlycloudy",
      attributes: {
        friendly_name: "Home", temperature: 23.4, apparent_temperature: 24.1, humidity: 58, pressure: 1016, wind_speed: 14, wind_bearing: 135,
        uv_index: 6, temperature_unit: "°C", wind_speed_unit: "km/h", pressure_unit: "hPa", supported_features: 3,
      },
    },
  };

  const e = (area_id, extra = {}) => ({ area_id, device_id: null, hidden: false, entity_category: null, ...extra });
  const onDevice = (device_id, extra = {}) => ({ area_id: null, device_id, hidden: false, entity_category: null, ...extra });

  const entities = {
    "light.office_colour_light": e("office"),
    "light.office_desk_lamp": e("office"),
    "switch.office_light_switch": e("office"),
    "cover.office_roller_blind": e("office"),
    "binary_sensor.office_motion": onDevice("dev_office_motion"),
    "sensor.office_motion_temperature": onDevice("dev_office_motion"),
    "sensor.office_motion_battery": onDevice("dev_office_motion", { entity_category: "diagnostic" }),
    "binary_sensor.office_window": e("office"),
    "scene.office_focus": e("office"),
    "scene.office_bright": e("office"),
    "scene.office_relax": e("office"),
    "scene.office_natural_light": e("office"),
    "scene.office_nightlight": e("office"),
    "automation.office_lights_at_sunset": e("office"),

    "light.kitchen_bench_light": onDevice("dev_kitchen_hue"),
    "light.kitchen_sink_light": e("kitchen"),
    "light.kitchen_stove_light": e("kitchen"),
    "switch.kitchen_kettle": e("kitchen"),
    "binary_sensor.smoke_kitchen": e("kitchen"),
    "sensor.kitchen_humidity": e("kitchen"),

    "light.lounge_lamp": e("living_room"),
    "light.tv_white_lamp": e("living_room"),
    "cover.lounge_left_roller_blind": e("living_room"),
    "cover.lounge_right_roller_blind": e("living_room"),
    "binary_sensor.lounge_motion": onDevice("dev_lounge_motion"),
    "sensor.lounge_motion_temperature": onDevice("dev_lounge_motion", { hidden: true }),
    "script.evening_wind_down": e("living_room"),
    "media_player.lounge_tv": e("living_room"),
    "climate.living_room_thermostat": e("living_room"),
    "automation.morning_blinds": e("living_room"),

    "light.bedroom_1_light": e("bedroom_1"),
    "cover.bedroom_1_curtains": e("bedroom_1"),
    "light.mums_bedside_lamp": e("bedroom_1"),
    "fan.bedroom_1_ceiling_fan": e("bedroom_1"),

    "light.garage_entrance_downlight": e("garage"),
    "cover.garage_door": e("garage"),
    "lock.garage_side_lock": onDevice("dev_garage_lock"),
    "sensor.garage_side_lock_battery": onDevice("dev_garage_lock", { entity_category: "diagnostic" }),

    "lock.front_door": onDevice("dev_front_lock"),
    "sensor.front_door_lock_battery": onDevice("dev_front_lock"),
    "binary_sensor.front_door": e("entrance"),
    "alarm_control_panel.house": e("entrance"),
    "light.front_door_outside_light": e("entrance"),
    "camera.front_door": e("entrance"),

    "light.unassigned": e(null),
    "automation.leak_alert": e(null),

    "media_player.kitchen_speaker": e("kitchen"),
    "script.good_morning": e(null),
    "scene.house_all_off": e(null),
    "person.tim": e(null),
    "tts.google_translate_en_com": e(null),
    "weather.home": e(null),
  };

  for (const [id, s] of Object.entries(states)) {
    s.entity_id = id;
    s.last_changed ??= ago(30);
    s.last_updated ??= s.last_changed;
  }
  const config = { unit_system: { temperature: "°C" } };
  const services = {
    notify: { notify: {}, mobile_app_tims_phone: {}, send_message: {} },
    tts: { speak: {} },
    media_player: { volume_set: {}, media_play_pause: {}, media_next_track: {}, media_previous_track: {}, select_source: {} },
  };
  return { areas, floors, devices, entities, states, config, services };
}
