import { test } from "node:test";
import assert from "node:assert/strict";
import {
  automationConfigId,
  describeAutomation,
  draftProblems,
  draftToConfig,
  duplicateConfig,
  emptyDraft,
  simpleDraft,
} from "../src/automation-model.js";

const draft = (patch = {}) => {
  const d = emptyDraft();
  return { ...d, alias: "Evening", ...patch, trigger: { ...d.trigger, ...patch.trigger }, action: { ...d.action, ...patch.action } };
};

test("simple drafts become Home Assistant configs (triggers / actions keys)", () => {
  assert.deepEqual(draftToConfig(draft({ trigger: { kind: "time", at: "7:30" }, action: { kind: "scene", entity_id: "scene.relax" } })), {
    alias: "Evening",
    description: "",
    mode: "single",
    triggers: [{ trigger: "time", at: "07:30:00" }],
    conditions: [],
    actions: [{ action: "scene.turn_on", target: { entity_id: "scene.relax" } }],
  });
  const state = draftToConfig(draft({ trigger: { kind: "state", entity_id: "binary_sensor.door", to: "on" }, action: { kind: "service", entity_id: "light.hall", service: "turn_on" } }));
  assert.deepEqual(state.triggers, [{ trigger: "state", entity_id: "binary_sensor.door", to: "on" }]);
  assert.deepEqual(state.actions, [{ action: "light.turn_on", target: { entity_id: "light.hall" } }]);
  const sun = draftToConfig(draft({ trigger: { kind: "sun", event: "sunrise", offset: "-00:30" }, action: { kind: "script", entity_id: "script.wake" } }));
  assert.deepEqual(sun.triggers, [{ trigger: "sun", event: "sunrise", offset: "-00:30" }]);
});

test("editing keeps the rest of the config but replaces triggers, conditions and actions", () => {
  const base = { id: "1", alias: "Old", mode: "restart", variables: { a: 1 }, trigger: [{ platform: "time", at: "06:00" }], condition: [] };
  const config = draftToConfig(draft({ action: { kind: "scene", entity_id: "scene.x" } }), base);
  assert.equal(config.mode, "restart");
  assert.deepEqual(config.variables, { a: 1 });
  assert.equal("trigger" in config, false);
  assert.equal("condition" in config, false);
  assert.equal(config.alias, "Evening");
});

test("simple editor round-trips, and reads the pre-2024.10 keys", () => {
  for (const d of [
    draft({ trigger: { kind: "time", at: "22:15" }, action: { kind: "scene", entity_id: "scene.night" } }),
    draft({ trigger: { kind: "state", entity_id: "lock.front", to: "unlocked" }, action: { kind: "service", entity_id: "cover.blind", service: "close_cover" } }),
    draft({ trigger: { kind: "sun", event: "sunset", offset: "" }, action: { kind: "script", entity_id: "script.evening" } }),
  ]) {
    const back = simpleDraft(draftToConfig(d));
    assert.deepEqual({ t: back.trigger.kind, a: back.action }, { t: d.trigger.kind, a: d.action });
  }
  const legacy = simpleDraft({ alias: "L", trigger: { platform: "state", entity_id: ["light.a"] }, action: [{ service: "light.turn_off", entity_id: "light.a" }] });
  assert.equal(legacy.trigger.entity_id, "light.a");
  assert.deepEqual(legacy.action, { kind: "service", entity_id: "light.a", service: "turn_off" });
});

test("anything the simple editor cannot show is left to Home Assistant's editor", () => {
  const base = { alias: "x", triggers: [{ trigger: "time", at: "07:00" }], actions: [{ action: "light.turn_on", target: { entity_id: "light.a" } }] };
  assert.ok(simpleDraft(base));
  assert.equal(simpleDraft({ ...base, conditions: [{ condition: "state", entity_id: "x", state: "on" }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [...base.triggers, { trigger: "sun", event: "sunset" }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "light.turn_on", target: { entity_id: "light.a" }, data: { brightness_pct: 50 } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "light.turn_on", target: { area_id: "office" } }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [{ trigger: "state", entity_id: "light.a", for: "00:05:00" }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "notify.mobile", data: { message: "hi" } }] }), null);
  assert.equal(simpleDraft(null), null);
});

test("draft problems name what is missing", () => {
  assert.deepEqual(draftProblems(draft({ alias: " ", trigger: { kind: "time", at: "25:00" } })), [
    "Give the automation a name.", "Enter a time like 07:30.", "Choose a scene.",
  ]);
  assert.deepEqual(draftProblems(draft({ action: { kind: "service", entity_id: "lock.front", service: "turn_on" } })), ["Choose what to do with the device."]);
  assert.deepEqual(draftProblems(draft({ action: { kind: "scene", entity_id: "scene.a" } })), []);
});

test("what this will do", () => {
  const names = { "binary_sensor.door": "Front Door", "light.hall": "Hall Light", "scene.relax": "Relax" };
  const nameOf = (id) => names[id] || id;
  const d = describeAutomation({
    triggers: [{ trigger: "state", entity_id: "binary_sensor.door", to: "on" }, { trigger: "sun", event: "sunset", offset: "-00:15:00" }],
    conditions: [{ condition: "time", after: "18:00:00", before: "23:00:00" }],
    actions: [{ action: "light.turn_on", target: { entity_id: "light.hall" } }, { delay: "00:05:00" }, { action: "scene.turn_on", target: { entity_id: "scene.relax" } }],
  }, nameOf);
  assert.deepEqual(d.triggers, ["When Front Door changes to on", "At sunset (-00:15:00)"]);
  assert.deepEqual(d.conditions, ["Time is after 18:00 and before 23:00"]);
  assert.deepEqual(d.actions, ["Turn on Hall Light", "Wait 00:05:00", "Activate Relax"]);
  assert.deepEqual(describeAutomation({ trigger: { platform: "time", at: "07:00:00" }, action: { service: "notify.notify" } }).actions, ["Send a notification"]);
});

test("config ids and duplicates", () => {
  assert.equal(automationConfigId({ attributes: { id: 17 } }), "17");
  assert.equal(automationConfigId({ attributes: {} }), null);
  assert.deepEqual(duplicateConfig({ id: "1", alias: "Night", mode: "single" }, "2"), { id: "2", alias: "Night (copy)", mode: "single" });
});
