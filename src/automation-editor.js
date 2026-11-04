import {
  ACTION_KINDS, DEVICE_SERVICES, TRIGGER_KINDS, draftProblems, draftToConfig, duplicateConfig, emptyDraft, newAutomationId,
} from "./automation-model.js";
import { escapeHtml, navigate } from "./base.js";
import { domainOf, friendlyName, sortedAreas } from "./model.js";
import { sheetFrame } from "./sheet.js";

/**
 * Home Assistant automation config API (admins only), the same endpoints Home Assistant's own
 * automation editor uses. Saving reloads automations in Home Assistant.
 */
export const fetchAutomationConfig = (hass, id) => hass.callApi("GET", `config/automation/config/${id}`);
export const saveAutomationConfig = (hass, id, config) => hass.callApi("POST", `config/automation/config/${id}`, config);
export const deleteAutomationConfig = (hass, id) => hass.callApi("DELETE", `config/automation/config/${id}`);
export const automationEditorPath = (id) => `/config/automation/edit/${encodeURIComponent(id)}`;
export const automationTracePath = (id) => `/config/automation/trace/${encodeURIComponent(id)}`;
export const newAutomationPath = () => "/config/automation/edit/new";

const TRIGGER_DOMAINS = [
  "binary_sensor", "sensor", "light", "switch", "lock", "cover", "person", "device_tracker", "input_boolean",
  "alarm_control_panel", "climate", "fan", "media_player",
];
const DOMAIN_LABELS = {
  binary_sensor: "Sensors (on / off)", sensor: "Sensors", light: "Lights", switch: "Switches", lock: "Locks", cover: "Coverings",
  person: "People", device_tracker: "Device trackers", input_boolean: "Toggles", alarm_control_panel: "Alarms", climate: "Thermostats",
  fan: "Fans", media_player: "Media players", humidifier: "Humidifiers", vacuum: "Vacuums", valve: "Valves",
};
const KNOWN_STATES = {
  binary_sensor: ["on", "off"], light: ["on", "off"], switch: ["on", "off"], fan: ["on", "off"], input_boolean: ["on", "off"],
  lock: ["locked", "unlocked", "jammed"], cover: ["open", "closed"], person: ["home", "not_home"], device_tracker: ["home", "not_home"],
  alarm_control_panel: ["disarmed", "armed_home", "armed_away", "armed_night", "triggered"],
  media_player: ["playing", "paused", "idle", "off"],
};

const WAIT_STEP_MS = 250;
const WAIT_MAX_MS = 10_000;

/** Entity id of the automation with config `id`, once Home Assistant has reloaded it (null on timeout). */
export async function waitForAutomation(getHass, id, { stepMs = WAIT_STEP_MS, maxMs = WAIT_MAX_MS } = {}) {
  for (let waited = 0; waited <= maxMs; waited += stepMs) {
    const states = getHass()?.states || {};
    const hit = Object.keys(states).find((e) => e.startsWith("automation.") && String(states[e]?.attributes?.id) === String(id));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}

async function assignArea(getHass, entityId, areaId) {
  const hass = getHass();
  const current = hass.entities?.[entityId]?.area_id ?? null;
  const wanted = areaId || null;
  if (current === wanted) return;
  await hass.callWS({ type: "config/entity_registry/update", entity_id: entityId, area_id: wanted });
}

/** Duplicate an automation (same room); returns the new config id. */
export async function duplicateAutomation(getHass, entityId, configId) {
  const hass = getHass();
  const config = await fetchAutomationConfig(hass, configId);
  const id = newAutomationId();
  await saveAutomationConfig(hass, id, duplicateConfig(config, id));
  const areaId = hass.entities?.[entityId]?.area_id;
  if (areaId) {
    const copy = await waitForAutomation(getHass, id);
    if (copy) await assignArea(getHass, copy, areaId);
  }
  return id;
}

const option = (value, label, selected) =>
  `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;

/**
 * Simple automation editor (ControlZ Create HA Automation): name, room, one trigger, one action.
 * It is a sheet owner: the host element keeps pushing `hass`, so the sheet re-renders through it.
 */
export class AutomationEditor {
  /**
   * @param host element that owns the sheet (has `hass`, `_sheet`)
   * @param opts `{ configId?, entityId?, draft?, baseConfig?, areaId? }`
   */
  constructor(host, { configId = null, entityId = null, draft = null, baseConfig = null, areaId = "" } = {}) {
    this._host = host;
    this._configId = configId;
    this._entityId = entityId;
    this._base = baseConfig;
    this._draft = draft ? structuredClone(draft) : emptyDraft();
    this._draft.area_id = entityId ? host.hass?.entities?.[entityId]?.area_id || "" : areaId || this._draft.area_id || "";
    this._problems = [];
    this._error = null;
    this._saving = false;
  }

  get hass() {
    return this._host.hass;
  }

  moreInfo() {}

  sheetDetailsEntity() {
    return null;
  }

  _entities(domains) {
    const states = this.hass?.states || {};
    const groups = new Map();
    for (const id of Object.keys(states)) {
      const domain = domainOf(id);
      if (!domains.includes(domain)) continue;
      if (this.hass.entities?.[id]?.hidden || this.hass.entities?.[id]?.entity_category === "config") continue;
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push({ id, name: friendlyName(this.hass, id) });
    }
    return domains.filter((d) => groups.has(d)).map((d) => ({
      domain: d,
      items: groups.get(d).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }

  _entitySelect(field, domains, value, placeholder) {
    const groups = this._entities(domains);
    const options = groups.map((g) => {
      const opts = g.items.map((i) => option(i.id, i.name, i.id === value)).join("");
      return groups.length > 1 ? `<optgroup label="${escapeHtml(DOMAIN_LABELS[g.domain] || g.domain)}">${opts}</optgroup>` : opts;
    }).join("");
    return `<select data-action="ed-field" data-field="${field}" aria-label="${escapeHtml(placeholder)}">
      ${option("", placeholder, !value)}${options}</select>`;
  }

  _seg(action, items, current) {
    return `<div class="btn-wrap" role="group">${items.map((k) =>
      `<button type="button" class="btn secondary" data-action="${action}" data-kind="${k.id}" aria-pressed="${k.id === current}">${escapeHtml(k.label)}</button>`).join("")}</div>`;
  }

  _triggerFields() {
    const t = this._draft.trigger;
    if (t.kind === "time") {
      return `<label class="field"><span>Time</span>
        <input type="time" data-action="ed-field" data-field="trigger.at" value="${escapeHtml(t.at)}" step="60" /></label>`;
    }
    if (t.kind === "sun") {
      return `${this._seg("ed-sun", [{ id: "sunrise", label: "Sunrise" }, { id: "sunset", label: "Sunset" }], t.event)}
        <label class="field"><span>Offset (optional, e.g. -00:30 for 30 minutes before)</span>
        <input type="text" data-action="ed-field" data-field="trigger.offset" value="${escapeHtml(t.offset)}" placeholder="00:00" /></label>`;
    }
    const domain = domainOf(t.entity_id);
    const known = KNOWN_STATES[domain];
    const to = known
      ? `<select data-action="ed-field" data-field="trigger.to" aria-label="Changes to">
          ${option("", "Any change", !t.to)}${known.map((s) => option(s, s.replace(/_/g, " "), s === t.to)).join("")}
          ${t.to && !known.includes(t.to) ? option(t.to, t.to, true) : ""}</select>`
      : `<input type="text" data-action="ed-field" data-field="trigger.to" value="${escapeHtml(t.to)}" placeholder="Any change" />`;
    return `<label class="field"><span>Device</span>${this._entitySelect("trigger.entity_id", TRIGGER_DOMAINS, t.entity_id, "Choose a device…")}</label>
      <label class="field"><span>Changes to</span>${to}</label>`;
  }

  _actionFields() {
    const a = this._draft.action;
    if (a.kind === "scene") return `<label class="field"><span>Scene</span>${this._entitySelect("action.entity_id", ["scene"], a.entity_id, "Choose a scene…")}</label>`;
    if (a.kind === "script") return `<label class="field"><span>Script</span>${this._entitySelect("action.entity_id", ["script"], a.entity_id, "Choose a script…")}</label>`;
    const services = DEVICE_SERVICES[domainOf(a.entity_id)] || [];
    return `<label class="field"><span>Device</span>${this._entitySelect("action.entity_id", Object.keys(DEVICE_SERVICES), a.entity_id, "Choose a device…")}</label>
      ${services.length ? `<label class="field"><span>Do</span><select data-action="ed-field" data-field="action.service" aria-label="Do">
        ${services.map(([s, label]) => option(s, label, s === a.service)).join("")}</select></label>` : ""}`;
  }

  sheetBody() {
    const d = this._draft;
    const areas = sortedAreas(this.hass);
    const body = `
      <div class="sheet-section">
        <label class="field"><span>Name</span>
          <input type="text" data-action="ed-field" data-field="alias" value="${escapeHtml(d.alias)}" placeholder="e.g. Porch light at sunset" ${this._configId ? "" : "autofocus"} /></label>
        <label class="field"><span>Room</span>
          <select data-action="ed-field" data-field="area_id" aria-label="Room">
            ${option("", "No room", !d.area_id)}${areas.map((a) => option(a.area_id, a.name, a.area_id === d.area_id)).join("")}
          </select></label>
      </div>
      <div class="sheet-section">
        <div class="section-label">When</div>
        ${this._seg("ed-trigger", TRIGGER_KINDS, d.trigger.kind)}
        ${this._triggerFields()}
      </div>
      <div class="sheet-section">
        <div class="section-label">Then</div>
        ${this._seg("ed-action", ACTION_KINDS, d.action.kind)}
        ${this._actionFields()}
      </div>
      ${this._problems.length || this._error ? `<div class="sheet-section">
        ${this._problems.map((p) => `<p class="error">${escapeHtml(p)}</p>`).join("")}
        ${this._error ? `<p class="error">${escapeHtml(this._error)}</p>` : ""}</div>` : ""}
      <p class="note">For conditions, several steps or anything else, use Home Assistant's automation editor.</p>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="ed-advanced">Home Assistant editor</button>
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="ed-save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save"}</button>`;
    return sheetFrame({ title: this._configId ? "Edit automation" : "New automation", subtitle: "", body, footer });
  }

  _set(path, value) {
    const [head, tail] = path.split(".");
    if (tail) this._draft[head] = { ...this._draft[head], [tail]: value };
    else this._draft[head] = value;
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  get actions() {
    return {
      "input:ed-field": (input) => this._set(input.dataset.field, input.value),
      "change:ed-field": (input) => {
        this._set(input.dataset.field, input.value);
        if (input.dataset.field === "action.entity_id") {
          const services = DEVICE_SERVICES[domainOf(input.value)] || [];
          if (!services.some(([s]) => s === this._draft.action.service)) this._set("action.service", services[0]?.[0] || "");
          this._rerender();
        }
        if (input.dataset.field === "trigger.entity_id") {
          this._set("trigger.to", "");
          this._rerender();
        }
      },
      "ed-trigger": (button) => {
        this._set("trigger.kind", button.dataset.kind);
        this._rerender();
      },
      "ed-sun": (button) => {
        this._set("trigger.event", button.dataset.kind);
        this._rerender();
      },
      "ed-action": (button) => {
        this._draft.action = { kind: button.dataset.kind, entity_id: "", service: button.dataset.kind === "service" ? "" : "turn_on" };
        this._rerender();
      },
      "ed-advanced": () => {
        this._host._sheet?.close();
        navigate(this._configId ? automationEditorPath(this._configId) : newAutomationPath());
      },
      "ed-save": () => this._save(),
    };
  }

  async _save() {
    this._problems = draftProblems(this._draft);
    this._error = null;
    if (this._problems.length) {
      this._rerender();
      return;
    }
    this._saving = true;
    this._rerender();
    const getHass = () => this._host.hass;
    try {
      const id = this._configId || newAutomationId();
      await saveAutomationConfig(this.hass, id, draftToConfig(this._draft, this._base || {}));
      const entityId = this._entityId || await waitForAutomation(getHass, id);
      if (entityId) await assignArea(getHass, entityId, this._draft.area_id);
      this._host._sheet?.close();
    } catch (err) {
      this._saving = false;
      this._error = err?.body?.message || err?.message || "Home Assistant did not save the automation.";
      this._rerender();
    }
  }
}

/** Open the simple editor in the host's sheet (new automation, or `opts` for an existing one). */
export function openAutomationEditor(host, opts = {}) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new AutomationEditor(host, opts));
}
