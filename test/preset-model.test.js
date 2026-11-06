import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyAction } from "../src/automation-model.js";
import { emptyPreset, newScriptKey, presetDraft, presetProblems, presetToConfig, scriptKey } from "../src/preset-model.js";

const step = (patch) => ({ ...emptyAction(patch.kind), ...patch });

test("a preset is a script: scenes and waits in order", () => {
  const draft = {
    ...emptyPreset(), alias: " Bedtime ", icon: "mdi:bed",
    actions: [step({ kind: "scene", entity_id: "scene.dim" }), step({ kind: "delay", minutes: 10, seconds: 0 }), step({ kind: "room", area_id: "lounge", domain: "light", service: "turn_off" })],
  };
  const config = presetToConfig(draft);
  assert.deepEqual(config, {
    alias: "Bedtime", icon: "mdi:bed", mode: "single",
    sequence: [
      { action: "scene.turn_on", target: { entity_id: "scene.dim" } },
      { delay: "00:10:00" },
      { action: "light.turn_off", target: { area_id: "lounge" } },
    ],
  });
  assert.deepEqual(presetDraft(config).actions, draft.actions);
  assert.equal(presetDraft(config).icon, "mdi:bed");
});

test("editing keeps the mode and replaces the sequence", () => {
  const config = presetToConfig({ ...emptyPreset(), alias: "A", actions: [step({ kind: "scene", entity_id: "scene.a" })] }, { alias: "Old", mode: "restart", sequence: [{ delay: 1 }], icon: "mdi:x" });
  assert.equal(config.mode, "restart");
  assert.equal("icon" in config, false);
  assert.deepEqual(config.sequence, [{ action: "scene.turn_on", target: { entity_id: "scene.a" } }]);
});

test("scripts a preset cannot show go to Home Assistant's editor", () => {
  const ok = { alias: "x", sequence: [{ action: "scene.turn_on", target: { entity_id: "scene.a" } }] };
  assert.ok(presetDraft(ok));
  assert.ok(presetDraft({ ...ok, fields: {} }));
  assert.equal(presetDraft({ ...ok, fields: { who: { selector: { text: null } } } }), null);
  assert.equal(presetDraft({ ...ok, variables: { a: 1 } }), null);
  assert.equal(presetDraft({ ...ok, sequence: [{ choose: [] }] }), null);
  assert.equal(presetDraft({ ...ok, sequence: [] }), null);
  assert.equal(presetDraft(null), null);
});

test("preset problems and script keys", () => {
  assert.deepEqual(presetProblems({ ...emptyPreset(), alias: "" }), ["Give the preset a name.", "Choose a scene."]);
  assert.deepEqual(presetProblems({ ...emptyPreset(), alias: "a", actions: [step({ kind: "scene", entity_id: "scene.a" }), step({ kind: "delay", minutes: 0, seconds: 0 })] }),
    ["Step 2: Wait at least a second."]);
  assert.equal(newScriptKey("Good Morning!", ["script.good_morning"]), "good_morning_2");
  assert.equal(newScriptKey("Café Nuit"), "cafe_nuit");
  assert.equal(newScriptKey("!!!"), "preset");
  assert.equal(scriptKey("script.good_morning"), "good_morning");
});
