/**
 * Presets (ControlZ Home / Away / Bedtime preset sequences): an ordered list of steps (scenes,
 * scripts, devices, rooms, notifications, announcements, waits) saved as a Home Assistant script.
 * Pure: unit tested in test/preset-model.test.js. The steps are the simple automation editor's
 * "Then" list; anything richer stays in Home Assistant's script editor.
 */
import { actionProblems, actionToConfig, emptyAction, parseAction } from "./automation-model.js";

export function emptyPreset() {
  return { alias: "", description: "", icon: "", area_id: "", actions: [emptyAction("scene")] };
}

/** Home Assistant script config (`config/script/config/<key>`) for a preset draft. */
export function presetToConfig(draft, base = {}) {
  const { sequence: _s, alias: _a, icon: _i, ...rest } = base;
  const icon = String(draft.icon || "").trim();
  return {
    ...rest,
    alias: String(draft.alias).trim(),
    ...(String(draft.description || "").trim() ? { description: String(draft.description).trim() } : rest.description ? { description: "" } : {}),
    ...(icon ? { icon } : {}),
    mode: rest.mode || "single",
    sequence: draft.actions.map(actionToConfig),
  };
}

const SIMPLE_KEYS = ["alias", "description", "icon", "mode", "sequence", "fields"];

/** The preset draft for a script config, or null when the script does more than a preset can show. */
export function presetDraft(config) {
  if (!config || typeof config !== "object" || Object.keys(config).some((k) => !SIMPLE_KEYS.includes(k))) return null;
  if (config.fields && Object.keys(config.fields).length) return null;
  const sequence = Array.isArray(config.sequence) ? config.sequence : config.sequence ? [config.sequence] : [];
  if (!sequence.length) return null;
  const actions = sequence.map(parseAction);
  if (!actions.every(Boolean)) return null;
  return { ...emptyPreset(), alias: config.alias || "", description: config.description || "", icon: config.icon || "", actions };
}

/** Problems that stop a preset saving, in form order. */
export function presetProblems(draft) {
  const problems = [];
  if (!String(draft.alias || "").trim()) problems.push("Give the preset a name.");
  const actions = draft.actions || [];
  if (!actions.length) problems.push("Add a step.");
  actions.forEach((a, i) => {
    for (const p of actionProblems(a)) problems.push(`${actions.length > 1 ? `Step ${i + 1}: ` : ""}${p}`);
  });
  return problems;
}

/** Script key for a new preset: its name as an object id, unique among `existing` script entity ids. */
export function newScriptKey(alias, existing = []) {
  const base = String(alias || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "preset";
  const taken = new Set(existing.map((id) => id.replace(/^script\./, "")));
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
  return key;
}

/** Script config key for a script entity (Home Assistant uses the object id). */
export const scriptKey = (entityId) => String(entityId || "").replace(/^script\./, "");
