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
  };

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
    "scene.office_focus": { state: "2026-11-04T01:00:00+00:00", attributes: { friendly_name: "Office Focus" } },
    "scene.office_bright": { state: "unknown", attributes: { friendly_name: "Office Bright Office" } },
    "scene.office_relax": { state: "unknown", attributes: { friendly_name: "Office Relax" } },
    "scene.office_natural_light": { state: "unknown", attributes: { friendly_name: "Office Natural light Office" } },
    "scene.office_nightlight": { state: "unknown", attributes: { friendly_name: "Office Nightlight Office" } },

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
      state: "off", attributes: { friendly_name: "Evening Wind Down", last_triggered: ago(600) },
    },
    "media_player.lounge_tv": { state: "playing", attributes: { friendly_name: "Lounge TV" } },

    "light.bedroom_1_light": light("Bedroom 1 Light"),
    "cover.bedroom_1_curtains": cover("Bedroom 1 Curtains", 50),
    "light.mums_bedside_lamp": light("Mum's Bedside Lamp", { unavailable: true }),

    "light.garage_entrance_downlight": light("Garage Entrance Downlight", { on: true, bri: 178 }),
    "cover.garage_door": cover("Garage Door", 0, { device_class: "garage", supported_features: 3 }),
    "lock.garage_side_lock": { state: "unlocked", attributes: { friendly_name: "Garage Side Lock" } },

    "lock.front_door": { state: "locked", attributes: { friendly_name: "Front Door Lock" } },
    "sensor.front_door_lock_battery": {
      state: "86", attributes: { friendly_name: "Front Door Lock Battery", device_class: "battery", unit_of_measurement: "%" },
    },
    "binary_sensor.front_door": {
      state: "off", last_changed: ago(45), attributes: { friendly_name: "Front Door Sensor", device_class: "door" },
    },
    "alarm_control_panel.house": { state: "disarmed", attributes: { friendly_name: "House Alarm", code_format: null } },
    "light.front_door_outside_light": light("Front Door Outside Light", { on: true, bri: 255, modes: ["onoff"] }),

    "light.unassigned": light("Unassigned Lamp"),
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

    "light.bedroom_1_light": e("bedroom_1"),
    "cover.bedroom_1_curtains": e("bedroom_1"),
    "light.mums_bedside_lamp": e("bedroom_1"),

    "light.garage_entrance_downlight": e("garage"),
    "cover.garage_door": e("garage"),
    "lock.garage_side_lock": e("garage"),

    "lock.front_door": onDevice("dev_front_lock"),
    "sensor.front_door_lock_battery": onDevice("dev_front_lock"),
    "binary_sensor.front_door": e("entrance"),
    "alarm_control_panel.house": e("entrance"),
    "light.front_door_outside_light": e("entrance"),

    "light.unassigned": e(null),
  };

  for (const [id, s] of Object.entries(states)) {
    s.entity_id = id;
    s.last_changed ??= ago(30);
    s.last_updated ??= s.last_changed;
  }
  return { areas, floors, devices, entities, states };
}
