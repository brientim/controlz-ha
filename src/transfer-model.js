/**
 * Export and import of scene / automation configs as YAML or JSON (pure, unit tested in
 * test/transfer-model.test.js). Exports are the config exactly as Home Assistant's config API
 * returns it, so the text also pastes into Home Assistant's "Edit in YAML". Imports are always
 * added as new items with new ids; nothing existing is replaced.
 */
import { CORE_SCHEMA, dump, load } from "js-yaml";

export const FORMATS = [
  { id: "yaml", label: "YAML" },
  { id: "json", label: "JSON" },
];

export const TRANSFER_KINDS = {
  automation: { label: "Automation", domain: "automation", api: "config/automation/config", editor: "/config/automation/edit" },
  scene: { label: "Scene", domain: "scene", api: "config/scene/config", editor: "/config/scene/edit" },
};

export const MAX_IMPORT_CHARS = 1_000_000;

const isObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);

/** `scene` / `automation` for a config object, or null when it is neither. */
export function configKind(config) {
  if (!isObject(config)) return null;
  const hasAutomationShape = ["triggers", "trigger"].some((k) => k in config) && ["actions", "action"].some((k) => k in config);
  if (hasAutomationShape) return "automation";
  if (isObject(config.entities) && !("triggers" in config || "trigger" in config)) return "scene";
  return null;
}

export const configName = (kind, config) => String((kind === "scene" ? config?.name : config?.alias) || "").trim();

/** YAML or JSON text for a config (2-space indent, ends with a newline). */
export function serializeConfig(config, format) {
  if (format === "json") return `${JSON.stringify(config, null, 2)}\n`;
  return dump(config, { lineWidth: -1, noRefs: true });
}

/** `scene-movie-night.yaml` */
export function exportFileName(kind, name, format) {
  const slug = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
  return `${kind}-${slug}.${format === "json" ? "json" : "yaml"}`;
}

export const mimeType = (format) => (format === "json" ? "application/json" : "application/yaml");

/**
 * Parse pasted or loaded text (YAML or JSON; one item or a list) into
 * `{ items: [{ kind, name, config }], error }`. `error` is a sentence for the user.
 */
export function parseImport(text) {
  const source = String(text ?? "").trim();
  if (!source) return { items: [], error: "Paste YAML or JSON, or choose a file." };
  if (source.length > MAX_IMPORT_CHARS) return { items: [], error: "That is too large to import here." };
  let data;
  try {
    data = load(source, { schema: CORE_SCHEMA });
  } catch (err) {
    const tag = /unknown tag !<?!?(\w+)/i.exec(String(err?.message || ""));
    if (tag) return { items: [], error: `It uses the Home Assistant YAML tag !${tag[1]}, which only works in Home Assistant's own files.` };
    const where = err?.mark ? ` (line ${err.mark.line + 1})` : "";
    return { items: [], error: `That is not valid YAML or JSON${where}.` };
  }
  const list = Array.isArray(data) ? data : [data];
  if (!list.length) return { items: [], error: "There is nothing to import." };
  const items = [];
  for (const [i, config] of list.entries()) {
    const which = list.length > 1 ? `Item ${i + 1}` : "This";
    const kind = configKind(config);
    if (!kind) return { items: [], error: `${which} is not a scene or an automation.` };
    const name = configName(kind, config);
    if (kind === "scene" && !name) return { items: [], error: `${which} scene needs a name.` };
    if (kind === "scene" && !Object.keys(config.entities).length) return { items: [], error: `${which} scene has no devices.` };
    items.push({ kind, name: name || "Imported automation", config });
  }
  return { items, error: null };
}

/** The config to save for an imported item: a new `id`, and a name for automations without one. */
export function importConfig({ kind, name, config }, id) {
  const { id: _old, ...rest } = config;
  return kind === "automation" && !rest.alias ? { id, ...rest, alias: name } : { id, ...rest };
}

/** "Office Desk Lamp: on, 80%" — one line per device a scene sets. */
export function describeScene(config, nameOf = (id) => id) {
  return Object.entries(config?.entities || {}).map(([entityId, value]) => {
    const v = isObject(value) ? value : { state: value };
    const positioned = typeof v.current_position === "number";
    const parts = [!positioned && v.state != null && String(v.state).replace(/_/g, " ")];
    if (typeof v.brightness === "number") parts.push(`${Math.round((v.brightness / 255) * 100)}%`);
    if (positioned) parts.push(`${v.current_position}% open`);
    if (typeof v.temperature === "number") parts.push(`${v.temperature}°`);
    return `${nameOf(entityId)}: ${parts.filter(Boolean).join(", ") || "set"}`;
  });
}
