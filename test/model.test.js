import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../dev/fixture.js";
import {
  KIND,
  areaOfEntity,
  classifyEntity,
  entitiesForArea,
  followColor,
  formatSensorValue,
  groupBySection,
  lightBadge,
  relativeTime,
  roomSummary,
  sceneLabel,
  bannerSeverity,
  securityBanner,
  securityReport,
  securityView,
  siblingSensor,
  sortedAreas,
} from "../src/model.js";

const hass = makeFixture();
const kindOf = (id) => classifyEntity(id, hass.states[id], hass.entities[id]);

test("classifies entities into ControlZ tile kinds", () => {
  assert.equal(kindOf("light.kitchen_sink_light"), KIND.LIGHT);
  assert.equal(kindOf("switch.kitchen_kettle"), KIND.OUTLET);
  assert.equal(kindOf("switch.office_light_switch"), KIND.SWITCH);
  assert.equal(kindOf("cover.office_roller_blind"), KIND.COVER);
  assert.equal(kindOf("cover.garage_door"), KIND.SECURITY);
  assert.equal(kindOf("lock.front_door"), KIND.SECURITY);
  assert.equal(kindOf("binary_sensor.office_window"), KIND.SECURITY);
  assert.equal(kindOf("binary_sensor.smoke_kitchen"), KIND.SECURITY);
  assert.equal(kindOf("binary_sensor.lounge_motion"), KIND.MOTION);
  assert.equal(kindOf("sensor.kitchen_humidity"), KIND.SENSOR);
  assert.equal(kindOf("scene.office_focus"), KIND.SCENE);
  assert.equal(kindOf("media_player.lounge_tv"), KIND.OTHER);
});

test("skips hidden and diagnostic entities", () => {
  assert.equal(kindOf("sensor.office_motion_battery"), null);
  assert.equal(kindOf("sensor.lounge_motion_temperature"), null);
});

test("entity area overrides device area; device area is inherited", () => {
  assert.equal(areaOfEntity(hass, "light.kitchen_sink_light"), "kitchen");
  assert.equal(areaOfEntity(hass, "light.kitchen_bench_light"), "kitchen");
  assert.equal(areaOfEntity(hass, "light.unassigned"), null);
  const overridden = {
    ...hass,
    entities: { ...hass.entities, "light.kitchen_bench_light": { device_id: "dev_kitchen_hue", area_id: "office" } },
  };
  assert.equal(areaOfEntity(overridden, "light.kitchen_bench_light"), "office");
});

test("areas sort by floor level, then name, with explicit order first", () => {
  assert.deepEqual(
    sortedAreas(hass).map((a) => a.area_id),
    ["entrance", "garage", "kitchen", "living_room", "office", "bedroom_1"]
  );
  assert.deepEqual(
    sortedAreas(hass, { order: ["office"], hide: ["garage"] }).map((a) => a.area_id),
    ["office", "entrance", "kitchen", "living_room", "bedroom_1"]
  );
});

test("room sections follow ControlZ order", () => {
  const sections = groupBySection(entitiesForArea(hass, "office"));
  assert.deepEqual(sections.map((s) => s.id), ["scenes", "lights", "coverings", "security", "sensors"]);
});

test("green badge counts illumination only; outlets are orange", () => {
  const kitchen = roomSummary(hass, entitiesForArea(hass, "kitchen"));
  assert.equal(kitchen.lights.length, 3);
  assert.equal(kitchen.lightsOn, 2);
  assert.equal(kitchen.allLightsOn, false);
  assert.equal(kitchen.outletsOn, 1);
  assert.equal(kitchen.avgBrightness, 67);
});

test("switches do not count towards the illumination badge", () => {
  const office = roomSummary(hass, entitiesForArea(hass, "office"));
  assert.equal(office.lights.length, 2);
  assert.equal(office.allLightsOn, true);
  assert.deepEqual(office.followColor, [249, 115, 22]);
});

test("mixed room reports coverings open and average position", () => {
  const lounge = roomSummary(hass, entitiesForArea(hass, "living_room"));
  assert.equal(lounge.covers.length, 2);
  assert.equal(lounge.coversOpen, 1);
  assert.equal(lounge.avgCoverPosition, 30);
  assert.equal(lounge.lightsOn, 0);
});

test("unavailable lights are excluded from room master", () => {
  const bedroom = roomSummary(hass, entitiesForArea(hass, "bedroom_1"));
  assert.deepEqual(bedroom.lights, ["light.bedroom_1_light"]);
});

test("light badge text", () => {
  assert.equal(lightBadge(hass.states["light.kitchen_bench_light"]), "ON · 85%");
  assert.equal(lightBadge(hass.states["light.kitchen_sink_light"]), "OFF");
  assert.equal(lightBadge(hass.states["light.mums_bedside_lamp"]), "OFFLINE");
  assert.equal(lightBadge(hass.states["switch.office_light_switch"]), "ON");
});

test("follow colour only for colour modes", () => {
  assert.deepEqual(followColor(hass.states["light.office_colour_light"]), [249, 115, 22]);
  assert.equal(followColor(hass.states["light.office_desk_lamp"]), null);
});

test("security views", () => {
  const front = securityView("lock.front_door", hass.states["lock.front_door"]);
  assert.equal(front.badge, "LOCKED");
  assert.equal(front.action.service, "unlock");
  assert.equal(front.action.confirm, true);

  const side = securityView("lock.garage_side_lock", hass.states["lock.garage_side_lock"]);
  assert.equal(side.insecure, true);
  assert.equal(side.action.service, "lock");

  assert.equal(securityView("binary_sensor.office_window", hass.states["binary_sensor.office_window"]).badge, "OPEN");
  assert.equal(securityView("binary_sensor.smoke_kitchen", hass.states["binary_sensor.smoke_kitchen"]).badge, "CLEAR");
  assert.equal(securityView("cover.garage_door", hass.states["cover.garage_door"]).action.service, "open_cover");

  const alarm = securityView("alarm_control_panel.house", hass.states["alarm_control_panel.house"]);
  assert.equal(alarm.action.service, "alarm_arm_away");
  const coded = securityView("alarm_control_panel.house", {
    state: "armed_away",
    attributes: { code_format: "number" },
  });
  assert.equal(coded.action.moreInfo, true);
});

test("security banner names devices: red beats amber beats motion beats secure", () => {
  const report = securityReport(hass);
  assert.equal(report.level, "insecure");
  assert.equal(report.text, "INSECURE — Garage Side Lock unlocked");
  assert.deepEqual(report.warning.map((i) => i.name), ["Office Window"]);
  assert.deepEqual(report.motion.map((i) => i.name), ["Lounge Motion Sensor"]);

  const calm = structuredClone(hass);
  calm.states["lock.garage_side_lock"].state = "locked";
  assert.equal(securityBanner(calm).level, "warning");
  assert.equal(securityBanner(calm).text, "CHECK — Office Window open");
  calm.states["binary_sensor.office_window"].state = "off";
  assert.equal(securityBanner(calm).text, "MOTION — Lounge Motion Sensor");
  calm.states["binary_sensor.lounge_motion"].state = "off";
  assert.equal(securityBanner(calm).level, "secure");
});

test("security banner severity mirrors ControlZ", () => {
  const sev = (id, state, attributes = {}) => bannerSeverity(id, { state, attributes })?.severity ?? null;
  assert.equal(sev("lock.a", "unlocked"), "insecure");
  assert.equal(sev("lock.a", "jammed"), "warning");
  assert.equal(sev("lock.a", "locked"), null);
  assert.equal(sev("lock.a", "unavailable"), null);
  assert.equal(sev("binary_sensor.a", "on", { device_class: "window" }), "warning");
  assert.equal(sev("binary_sensor.a", "on", { device_class: "door" }), "insecure");
  assert.equal(sev("binary_sensor.a", "on", { device_class: "smoke" }), "insecure");
  assert.equal(sev("alarm_control_panel.a", "triggered"), "insecure");
  assert.equal(sev("cover.a", "open", { device_class: "garage", current_position: 100 }), "insecure");
});

test("security banner include / exclude scope", () => {
  assert.equal(securityReport(hass, { exclude: ["lock.garage_side_lock"] }).level, "warning");
  assert.equal(securityReport(hass, { include: ["lock.front_door", "binary_sensor.front_door"] }).level, "secure");
  const many = structuredClone(hass);
  many.states["lock.front_door"].state = "unlocked";
  many.states["binary_sensor.front_door"].state = "on";
  assert.equal(
    securityReport(many).text,
    "INSECURE — Front Door Lock unlocked, Front Door Sensor open +1 more"
  );
});

test("motion sensor finds its sibling temperature sensor on the same device", () => {
  assert.equal(siblingSensor(hass, "binary_sensor.office_motion", "temperature"), "sensor.office_motion_temperature");
  assert.equal(siblingSensor(hass, "lock.front_door", "battery"), "sensor.front_door_lock_battery");
  assert.equal(siblingSensor(hass, "light.kitchen_sink_light", "temperature"), null);
});

test("scene chip labels drop the room name Hue adds", () => {
  assert.equal(sceneLabel("Kitchen Bright Kitchen", "Kitchen"), "Bright");
  assert.equal(sceneLabel("Kitchen Natural light Kitchen", "Kitchen"), "Natural light");
  assert.equal(sceneLabel("Kitchen Relax", "Kitchen"), "Relax");
  assert.equal(sceneLabel("Lounge Room - Movie", "Lounge Room"), "Movie");
  assert.equal(sceneLabel("Kitchen", "Kitchen"), "Kitchen");
  assert.equal(sceneLabel("Kitchenette Glow", "Kitchen"), "Kitchenette Glow");
  assert.equal(sceneLabel("Evening Wind Down", "Living Room"), "Evening Wind Down");
});

test("tile scale: config value within 0.4–1.5, otherwise 100%", async () => {
  const { effectiveScale } = await import("../src/prefs.js");
  assert.equal(effectiveScale(0.6), 0.6);
  assert.equal(effectiveScale("0.8"), 0.8);
  assert.equal(effectiveScale(undefined), 1);
  assert.equal(effectiveScale(0.1), 1);
  assert.equal(effectiveScale(3), 1);
});

test("formatting helpers", () => {
  assert.equal(formatSensorValue(hass.states["sensor.office_motion_temperature"]), "22.4°C");
  assert.equal(formatSensorValue(hass.states["sensor.kitchen_humidity"]), "54%");
  const now = Date.parse("2026-11-04T03:00:00Z");
  assert.equal(relativeTime("2026-11-04T02:59:30Z", now), "Now");
  assert.equal(relativeTime("2026-11-04T02:52:00Z", now), "8m ago");
  assert.equal(relativeTime("2026-11-04T01:00:00Z", now), "2h ago");
});
