import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configKind, describeScene, exportFileName, importConfig, parseImport, serializeConfig,
} from "../src/transfer-model.js";

const scene = {
  id: "1700000000101", name: "Movie night",
  entities: { "light.lounge_lamp": { state: "on", brightness: 51 }, "cover.lounge_blind": { state: "closed", current_position: 0 } },
  metadata: {},
};
const automation = {
  id: "1700000000001", alias: "Porch at sunset", description: "", mode: "single",
  triggers: [{ trigger: "sun", event: "sunset", offset: "-00:15:00" }], conditions: [],
  actions: [{ action: "light.turn_on", target: { area_id: "porch" } }],
};

test("kinds: automations have triggers and actions, scenes have an entities map", () => {
  assert.equal(configKind(scene), "scene");
  assert.equal(configKind(automation), "automation");
  assert.equal(configKind({ alias: "old", trigger: [], action: [] }), "automation");
  assert.equal(configKind({ entities: ["light.a"] }), null);
  assert.equal(configKind({ sequence: [] }), null);
  assert.equal(configKind([scene]), null);
  assert.equal(configKind("scene"), null);
});

test("YAML and JSON exports round-trip through import", () => {
  for (const format of ["yaml", "json"]) {
    for (const config of [scene, automation]) {
      const { items, error } = parseImport(serializeConfig(config, format));
      assert.equal(error, null);
      assert.deepEqual(items[0].config, config);
    }
  }
  assert.ok(serializeConfig(automation, "json").endsWith("}\n"));
});

test("YAML export quotes on / off so Home Assistant's YAML 1.1 loader keeps them as text", () => {
  const yaml = serializeConfig({ ...scene, entities: { "switch.a": { state: "off" }, "light.b": { state: "on" } } }, "yaml");
  assert.match(yaml, /state: 'off'/);
  assert.match(yaml, /state: 'on'/);
});

test("time strings and dates stay text on import", () => {
  const { items } = parseImport("alias: T\ntriggers:\n  - trigger: time\n    at: 07:30:00\nactions:\n  - action: scene.turn_on\n    target:\n      entity_id: scene.x\ndescription: 2026-11-05\n");
  assert.equal(items[0].config.triggers[0].at, "07:30:00");
  assert.equal(items[0].config.description, "2026-11-05");
});

test("lists import every item; problems name the item", () => {
  const { items } = parseImport(serializeConfig([scene, automation], "yaml"));
  assert.deepEqual(items.map((i) => [i.kind, i.name]), [["scene", "Movie night"], ["automation", "Porch at sunset"]]);
  assert.equal(parseImport(JSON.stringify([scene, { sequence: [] }])).error, "Item 2 is not a scene or an automation.");
  assert.equal(parseImport(JSON.stringify({ ...scene, name: " " })).error, "This scene needs a name.");
  assert.equal(parseImport(JSON.stringify({ ...scene, entities: {} })).error, "This scene has no devices.");
  assert.equal(parseImport("  ").error, "Paste YAML or JSON, or choose a file.");
  assert.equal(parseImport("[]").error, "There is nothing to import.");
  assert.match(parseImport("name: x\nentities: {light.a: on\n").error, /^That is not valid YAML or JSON \(line \d+\)\.$/);
  assert.match(parseImport("name: x\nentities:\n  light.a:\n    state: !secret porch\n").error, /YAML tag !secret/);
  assert.equal(parseImport(JSON.stringify({ triggers: [], actions: [] })).items[0].name, "Imported automation");
});

test("imports get a new id and never keep the old one", () => {
  const [item] = parseImport(JSON.stringify(scene)).items;
  assert.deepEqual(importConfig(item, "42"), { ...scene, id: "42" });
  const [unnamed] = parseImport(JSON.stringify({ triggers: [], actions: [] })).items;
  assert.deepEqual(importConfig(unnamed, "43"), { id: "43", triggers: [], actions: [], alias: "Imported automation" });
});

test("file names and scene descriptions", () => {
  assert.equal(exportFileName("scene", "Movie Night!", "yaml"), "scene-movie-night.yaml");
  assert.equal(exportFileName("automation", "", "json"), "automation-export.json");
  const names = { "light.lounge_lamp": "Lounge Lamp" };
  assert.deepEqual(describeScene(scene, (id) => names[id] || id), ["Lounge Lamp: on, 20%", "cover.lounge_blind: 0% open"]);
  assert.deepEqual(describeScene({ entities: { "switch.kettle": "off", "light.x": {} } }), ["switch.kettle: off", "light.x: set"]);
});
