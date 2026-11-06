import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../dev/fixture.js";
import { captureCandidates, captureProblem, captureSceneConfig, captureState, recaptureScene } from "../src/scene-model.js";
import { entitiesForArea } from "../src/model.js";

const hass = makeFixture();

test("capture keeps the attributes Home Assistant scenes restore", () => {
  assert.deepEqual(captureState("light.office_colour_light", hass.states["light.office_colour_light"]),
    { state: "on", brightness: 255, color_mode: "rgb", rgb_color: [249, 115, 22] });
  const ct = { state: "on", attributes: { brightness: 100, color_mode: "color_temp", color_temp_kelvin: 3000, rgb_color: [1, 2, 3] } };
  assert.deepEqual(captureState("light.a", ct), { state: "on", brightness: 100, color_mode: "color_temp", color_temp_kelvin: 3000 });
  const hs = { state: "on", attributes: { brightness: 9, color_mode: "hs", hs_color: [30, 80] } };
  assert.deepEqual(captureState("light.a", hs), { state: "on", brightness: 9, color_mode: "hs", hs_color: [30, 80] });
  assert.deepEqual(captureState("light.kitchen_sink_light", hass.states["light.kitchen_sink_light"]), { state: "off" });
  assert.deepEqual(captureState("cover.office_roller_blind", hass.states["cover.office_roller_blind"]), { state: "open", current_position: 35 });
  assert.deepEqual(captureState("fan.bedroom_1_ceiling_fan", hass.states["fan.bedroom_1_ceiling_fan"]),
    { state: "on", percentage: 50, oscillating: false, direction: "forward" });
  assert.deepEqual(captureState("climate.living_room_thermostat", hass.states["climate.living_room_thermostat"]),
    { state: "heat", temperature: 21, preset_mode: "home", fan_mode: "auto" });
  assert.equal(captureState("light.mums_bedside_lamp", hass.states["light.mums_bedside_lamp"]), null);
  assert.equal(captureState("lock.front_door", hass.states["lock.front_door"]), null);
});

test("room candidates: lights, switches and coverings ticked; outlets, fans and offline devices not", () => {
  const office = captureCandidates(hass, entitiesForArea(hass, "office"));
  assert.deepEqual(office.map((c) => [c.entity_id, c.ticked]), [
    ["light.office_colour_light", true], ["light.office_desk_lamp", true], ["switch.office_light_switch", true], ["cover.office_roller_blind", true],
  ]);
  const kitchen = captureCandidates(hass, entitiesForArea(hass, "kitchen"));
  assert.equal(kitchen.find((c) => c.entity_id === "switch.kitchen_kettle").ticked, false);
  const bedroom = captureCandidates(hass, entitiesForArea(hass, "bedroom_1"));
  assert.ok(!bedroom.some((c) => c.entity_id === "light.mums_bedside_lamp"));
  assert.equal(bedroom.find((c) => c.entity_id === "fan.bedroom_1_ceiling_fan").ticked, false);
});

test("scene config: name, optional icon, entities as they are now", () => {
  const config = captureSceneConfig(hass, ["light.office_desk_lamp", "light.mums_bedside_lamp"], { id: "9", name: " Desk ", icon: "" });
  assert.deepEqual(config, {
    id: "9", name: "Desk", entities: { "light.office_desk_lamp": { state: "on", brightness: 140 } }, metadata: {},
  });
  assert.equal(captureSceneConfig(hass, [], { id: "1", name: "x", icon: "mdi:movie" }).icon, "mdi:movie");
});

test("recapture updates the scene's devices and keeps offline ones", () => {
  const next = recaptureScene(hass, { id: "1", name: "A", entities: { "light.kitchen_sink_light": { state: "on" }, "light.mums_bedside_lamp": { state: "on", brightness: 9 } } });
  assert.deepEqual(next.entities, { "light.kitchen_sink_light": { state: "off" }, "light.mums_bedside_lamp": { state: "on", brightness: 9 } });
  assert.equal(next.name, "A");
});

test("capture problems", () => {
  assert.equal(captureProblem({ name: " ", entityIds: ["a"] }), "Give the scene a name.");
  assert.equal(captureProblem({ name: "x", entityIds: [] }), "Tick at least one device.");
  assert.equal(captureProblem({ name: "x", entityIds: ["a"] }), null);
});
