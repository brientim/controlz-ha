import { test } from "node:test";
import assert from "node:assert/strict";
import {
  automationConfigId,
  describeAutomation,
  draftProblems,
  draftToConfig,
  duplicateConfig,
  emptyAction,
  emptyDraft,
  roomServices,
  simpleDraft,
} from "../src/automation-model.js";

const step = (patch = {}) => ({ ...emptyAction(patch.kind), ...patch });
const draft = (patch = {}) => {
  const d = emptyDraft();
  return {
    ...d, alias: "Evening", ...patch,
    trigger: { ...d.trigger, ...patch.trigger },
    actions: (patch.actions || [{}]).map(step),
  };
};

test("simple drafts become Home Assistant configs (triggers / actions keys)", () => {
  assert.deepEqual(draftToConfig(draft({ trigger: { kind: "time", at: "7:30" }, actions: [{ kind: "scene", entity_id: "scene.relax" }] })), {
    alias: "Evening",
    description: "",
    mode: "single",
    triggers: [{ trigger: "time", at: "07:30:00" }],
    conditions: [],
    actions: [{ action: "scene.turn_on", target: { entity_id: "scene.relax" } }],
  });
  const state = draftToConfig(draft({ trigger: { kind: "state", entity_id: "binary_sensor.door", to: "on" }, actions: [{ kind: "service", entity_id: "light.hall", service: "turn_on" }] }));
  assert.deepEqual(state.triggers, [{ trigger: "state", entity_id: "binary_sensor.door", to: "on" }]);
  assert.deepEqual(state.actions, [{ action: "light.turn_on", target: { entity_id: "light.hall" } }]);
  const sun = draftToConfig(draft({ trigger: { kind: "sun", event: "sunrise", offset: "-00:30" }, actions: [{ kind: "script", entity_id: "script.wake" }] }));
  assert.deepEqual(sun.triggers, [{ trigger: "sun", event: "sunrise", offset: "-00:30" }]);
});

test("several actions, including a room, run in order", () => {
  const config = draftToConfig(draft({ actions: [
    { kind: "room", area_id: "kitchen", domain: "light", service: "turn_off" },
    { kind: "service", entity_id: "lock.front", service: "lock" },
    { kind: "scene", entity_id: "scene.night" },
  ] }));
  assert.deepEqual(config.actions, [
    { action: "light.turn_off", target: { area_id: "kitchen" } },
    { action: "lock.lock", target: { entity_id: "lock.front" } },
    { action: "scene.turn_on", target: { entity_id: "scene.night" } },
  ]);
});

test("editing keeps the rest of the config but replaces triggers, conditions and actions", () => {
  const base = { id: "1", alias: "Old", mode: "restart", variables: { a: 1 }, trigger: [{ platform: "time", at: "06:00" }], condition: [] };
  const config = draftToConfig(draft({ actions: [{ kind: "scene", entity_id: "scene.x" }] }), base);
  assert.equal(config.mode, "restart");
  assert.deepEqual(config.variables, { a: 1 });
  assert.equal("trigger" in config, false);
  assert.equal("condition" in config, false);
  assert.equal(config.alias, "Evening");
});

test("simple editor round-trips, and reads the pre-2024.10 keys", () => {
  for (const d of [
    draft({ trigger: { kind: "time", at: "22:15" }, actions: [{ kind: "scene", entity_id: "scene.night" }] }),
    draft({ trigger: { kind: "state", entity_id: "lock.front", to: "unlocked" }, actions: [{ kind: "service", entity_id: "cover.blind", service: "close_cover" }] }),
    draft({ trigger: { kind: "sun", event: "sunset", offset: "" }, actions: [{ kind: "script", entity_id: "script.evening" }] }),
    draft({ actions: [{ kind: "room", area_id: "office", domain: "cover", service: "close_cover" }, { kind: "script", entity_id: "script.evening" }] }),
  ]) {
    const back = simpleDraft(draftToConfig(d));
    assert.deepEqual({ t: back.trigger.kind, a: back.actions }, { t: d.trigger.kind, a: d.actions });
  }
  const legacy = simpleDraft({ alias: "L", trigger: { platform: "state", entity_id: ["light.a"] }, action: [{ service: "light.turn_off", entity_id: "light.a" }] });
  assert.equal(legacy.trigger.entity_id, "light.a");
  assert.deepEqual(legacy.actions, [step({ kind: "service", entity_id: "light.a", service: "turn_off" })]);
  assert.deepEqual(simpleDraft({ alias: "R", triggers: [{ trigger: "time", at: "07:00" }], actions: [{ action: "light.turn_on", target: { area_id: ["office"] } }] }).actions,
    [step({ kind: "room", area_id: "office", domain: "light", service: "turn_on" })]);
});

test("anything the simple editor cannot show is left to Home Assistant's editor", () => {
  const base = { alias: "x", triggers: [{ trigger: "time", at: "07:00" }], actions: [{ action: "light.turn_on", target: { entity_id: "light.a" } }] };
  assert.ok(simpleDraft(base));
  assert.equal(simpleDraft({ ...base, conditions: [{ condition: "state", entity_id: "x", state: "on" }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [...base.triggers, { trigger: "sun", event: "sunset" }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "light.turn_on", target: { entity_id: "light.a" }, data: { brightness_pct: 50 } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [...base.actions, { delay: "{{ states('input_number.wait') }}" }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ delay: { days: 1 } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ delay: "00:05:00", enabled: false }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "notify.mobile", data: { message: "hi", data: { push: { sound: "x" } } } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "notify.send_message", target: { entity_id: "notify.x" }, data: { message: "hi" } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "tts.speak", target: { entity_id: "tts.a" }, data: { media_player_entity_id: "media_player.b", message: "hi", cache: false } }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [{ trigger: "time_pattern", minutes: "/5", seconds: 0 }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [{ trigger: "time_pattern", minutes: "5" }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [{ trigger: "numeric_state", entity_id: "sun.sun", attribute: "elevation", above: 1, below: 5 }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [{ trigger: "numeric_state", entity_id: "sensor.t", below: 5 }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "light.turn_on", target: { area_id: ["office", "kitchen"] } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "light.turn_on", target: { area_id: "office", entity_id: "light.a" } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "light.toggle", target: { area_id: "office" } }] }), null);
  assert.equal(simpleDraft({ ...base, actions: [{ action: "homeassistant.turn_off", target: { area_id: "office" } }] }), null);
  assert.equal(simpleDraft({ ...base, triggers: [{ trigger: "state", entity_id: "light.a", for: "00:05:00" }] }), null);
  assert.equal(simpleDraft(null), null);
});

test("intervals, arriving / leaving and sun height round-trip", () => {
  const cases = [
    [{ kind: "interval", every: 15, unit: "minutes" }, { trigger: "time_pattern", minutes: "/15" }],
    [{ kind: "interval", every: 2, unit: "hours" }, { trigger: "time_pattern", hours: "/2" }],
    [{ kind: "zone", person: "person.tim", zone: "zone.home", zone_event: "leave" }, { trigger: "zone", entity_id: "person.tim", zone: "zone.home", event: "leave" }],
    [{ kind: "elevation", direction: "below", degrees: -6 }, { trigger: "numeric_state", entity_id: "sun.sun", attribute: "elevation", below: -6 }],
    [{ kind: "elevation", direction: "above", degrees: 10 }, { trigger: "numeric_state", entity_id: "sun.sun", attribute: "elevation", above: 10 }],
  ];
  for (const [trigger, config] of cases) {
    const d = draft({ trigger, actions: [{ kind: "scene", entity_id: "scene.a" }] });
    assert.deepEqual(draftToConfig(d).triggers, [config]);
    const back = simpleDraft(draftToConfig(d)).trigger;
    for (const [k, v] of Object.entries(trigger)) assert.equal(back[k], v, `${trigger.kind}.${k}`);
  }
  assert.deepEqual(describeAutomation({ triggers: [cases[3][1]] }).triggers, ["When the sun goes below -6°"]);
  assert.deepEqual(describeAutomation({ triggers: [cases[0][1], cases[1][1], { trigger: "time_pattern", minutes: 5 }] }).triggers,
    ["Every 15 min", "Every 2 h", "On a time pattern"]);
});

test("notifications, announcements and waits round-trip", () => {
  const actions = [
    { kind: "notify", service: "mobile_app_phone", message: "Door open", title: "Home" },
    { kind: "delay", minutes: 90, seconds: 5 },
    { kind: "announce", entity_id: "tts.google", player: "media_player.kitchen", message: "Dinner is ready" },
    { kind: "notify", service: "notify", message: "No title" },
  ];
  const config = draftToConfig(draft({ actions }));
  assert.deepEqual(config.actions, [
    { action: "notify.mobile_app_phone", data: { message: "Door open", title: "Home" } },
    { delay: "01:30:05" },
    { action: "tts.speak", target: { entity_id: "tts.google" }, data: { media_player_entity_id: "media_player.kitchen", message: "Dinner is ready" } },
    { action: "notify.notify", data: { message: "No title" } },
  ]);
  assert.deepEqual(simpleDraft(config).actions, actions.map(step));
  assert.deepEqual(simpleDraft({ alias: "w", triggers: [{ trigger: "time", at: "07:00" }], actions: [{ delay: { minutes: 2, seconds: 30 } }] }).actions,
    [step({ kind: "delay", minutes: 2, seconds: 30 })]);
  assert.deepEqual(simpleDraft({ alias: "w", triggers: [{ trigger: "time", at: "07:00" }], actions: [{ delay: "05:00" }] }).actions,
    [step({ kind: "delay", minutes: 5, seconds: 0 })]);
  assert.deepEqual(describeAutomation(config, (id) => (id === "media_player.kitchen" ? "Kitchen speaker" : id)).actions[2], 'Announce "Dinner is ready" on Kitchen speaker');
});

test("problems for the new triggers and actions", () => {
  const p = (trigger, actions = [{ kind: "scene", entity_id: "scene.a" }]) => draftProblems(draft({ trigger, actions }));
  assert.deepEqual(p({ kind: "interval", every: 0, unit: "minutes" }), ["Every 1 to 59 minutes."]);
  assert.deepEqual(p({ kind: "interval", every: 30, unit: "hours" }), ["Every 1 to 23 hours."]);
  assert.deepEqual(p({ kind: "zone", person: "", zone: "" }), ["Choose who arrives or leaves.", "Choose the place."]);
  assert.deepEqual(p({ kind: "elevation", degrees: "" }), ["Sun height is between -90° and 90°."]);
  assert.deepEqual(p({ kind: "time", at: "07:00" }, [{ kind: "notify" }, { kind: "announce" }, { kind: "delay", minutes: 0, seconds: 0 }]), [
    "Action 1: Choose who gets the notification.", "Action 1: Write the notification.",
    "Action 2: Choose a text-to-speech voice.", "Action 2: Choose the speaker.", "Action 2: Write what to say.",
    "Action 3: Wait at least a second.",
  ]);
});

test("draft problems name what is missing", () => {
  assert.deepEqual(draftProblems(draft({ alias: " ", trigger: { kind: "time", at: "25:00" } })), [
    "Give the automation a name.", "Enter a time like 07:30.", "Choose a scene.",
  ]);
  assert.deepEqual(draftProblems(draft({ actions: [{ kind: "service", entity_id: "lock.front", service: "turn_on" }] })), ["Choose what to do with the device."]);
  assert.deepEqual(draftProblems(draft({ actions: [{ kind: "scene", entity_id: "scene.a" }] })), []);
  assert.deepEqual(draftProblems(draft({ actions: [{ kind: "scene", entity_id: "scene.a" }, { kind: "room" }, { kind: "room", area_id: "office" }] })), [
    "Action 2: Choose a room.", "Action 3: Choose which devices in the room.",
  ]);
  assert.deepEqual(draftProblems(draft({ actions: [{ kind: "room", area_id: "office", domain: "light", service: "toggle" }] })), ["Choose what to do with them."]);
  assert.deepEqual(draftProblems({ ...draft(), actions: [] }), ["Add something for it to do."]);
});

test("room services leave out toggle", () => {
  assert.deepEqual(roomServices("light").map(([s]) => s), ["turn_on", "turn_off"]);
  assert.deepEqual(roomServices("vacuum"), []);
});

test("what this will do", () => {
  const names = { "binary_sensor.door": "Front Door", "light.hall": "Hall Light", "scene.relax": "Relax", kitchen: "Kitchen" };
  const nameOf = (id) => names[id] || id;
  const d = describeAutomation({
    triggers: [{ trigger: "state", entity_id: "binary_sensor.door", to: "on" }, { trigger: "sun", event: "sunset", offset: "-00:15:00" }],
    conditions: [{ condition: "time", after: "18:00:00", before: "23:00:00" }],
    actions: [
      { action: "light.turn_on", target: { entity_id: "light.hall" } }, { delay: "00:05:00" },
      { action: "scene.turn_on", target: { entity_id: "scene.relax" } }, { action: "light.turn_off", target: { area_id: "kitchen" } },
    ],
  }, nameOf);
  assert.deepEqual(d.triggers, ["When Front Door changes to on", "At sunset (-00:15:00)"]);
  assert.deepEqual(d.conditions, ["Time is after 18:00 and before 23:00"]);
  assert.deepEqual(d.actions, ["Turn on Hall Light", "Wait 00:05:00", "Activate Relax", "Turn off lights in Kitchen"]);
  assert.deepEqual(describeAutomation({ trigger: { platform: "time", at: "07:00:00" }, action: { service: "notify.notify" } }).actions, ["Send a notification"]);
});

test("config ids and duplicates", () => {
  assert.equal(automationConfigId({ attributes: { id: 17 } }), "17");
  assert.equal(automationConfigId({ attributes: {} }), null);
  assert.deepEqual(duplicateConfig({ id: "1", alias: "Night", mode: "single" }, "2"), { id: "2", alias: "Night (copy)", mode: "single" });
});
