import {
  ACTION_KINDS, DEVICE_SERVICES, INTERVAL_UNITS, ROOM_DOMAINS, TRIGGER_KINDS, draftProblems, draftToConfig, duplicateConfig, emptyAction,
  emptyDraft, newAutomationId, roomServices,
} from "./automation-model.js";
import { escapeHtml, navigate } from "./base.js";
import { areasOrder, hiddenLists } from "./hidden.js";
import { areaOfEntity, domainOf, friendlyName, sortedAreas } from "./model.js";
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
  binary_sensor: "Sensor", sensor: "Sensor", light: "Light", switch: "Switch", lock: "Lock", cover: "Covering",
  person: "Person", device_tracker: "Tracker", input_boolean: "Toggle", alarm_control_panel: "Alarm", climate: "Thermostat",
  fan: "Fan", media_player: "Media player", humidifier: "Humidifier", vacuum: "Vacuum", valve: "Valve",
};
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const KNOWN_STATES = {
  binary_sensor: ["on", "off"], light: ["on", "off"], switch: ["on", "off"], fan: ["on", "off"], input_boolean: ["on", "off"],
  lock: ["locked", "unlocked", "jammed"], cover: ["open", "closed"], person: ["home", "not_home"], device_tracker: ["home", "not_home"],
  alarm_control_panel: ["disarmed", "armed_home", "armed_away", "armed_night", "triggered"],
  media_player: ["playing", "paused", "idle", "off"],
};

const WAIT_STEP_MS = 250;
const WAIT_MAX_MS = 10_000;

/** Entity id of the `domain` entity with config `id`, once Home Assistant has reloaded it (null on timeout). */
export async function waitForConfigEntity(getHass, domain, id, { stepMs = WAIT_STEP_MS, maxMs = WAIT_MAX_MS } = {}) {
  for (let waited = 0; waited <= maxMs; waited += stepMs) {
    const states = getHass()?.states || {};
    const hit = Object.keys(states).find((e) => e.startsWith(`${domain}.`) && String(states[e]?.attributes?.id) === String(id));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}

export const waitForAutomation = (getHass, id, opts) => waitForConfigEntity(getHass, "automation", id, opts);

/** `<option>`s for a room picker: ControlZ dashboard order, hidden rooms left out unless `value` is one. */
export function roomOptionsHtml(hass, dashboardConfig, value, placeholder) {
  const hidden = hiddenLists(dashboardConfig).areas;
  const rooms = sortedAreas(hass, { order: areasOrder(dashboardConfig) }).filter((a) => !hidden.has(a.area_id) || a.area_id === value);
  return `${option("", placeholder, !value)}${rooms.map((a) => option(a.area_id, a.name, a.area_id === value)).join("")}`;
}

export async function assignArea(getHass, entityId, areaId) {
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
 * Simple automation editor (ControlZ Create HA Automation / Events V4): name, room, one trigger, then actions in order.
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

  get _dashboardConfig() {
    return this._host._config || {};
  }

  _roomOptions(value, placeholder) {
    return roomOptionsHtml(this.hass, this._dashboardConfig, value, placeholder);
  }

  /** Entities Home Assistant includes when a service targets a room (not hidden, no entity category). */
  _targetable(id) {
    const entry = this.hass.entities?.[id];
    return !entry?.hidden && !entry?.hidden_by && !entry?.entity_category;
  }

  /** Entities of `domains` grouped by room (dashboard order, hidden rooms too), "No room" last. */
  _entities(domains) {
    const byArea = new Map();
    for (const id of Object.keys(this.hass?.states || {})) {
      if (!domains.includes(domainOf(id)) || !this._targetable(id)) continue;
      const area = areaOfEntity(this.hass, id) || "";
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push({ id, name: friendlyName(this.hass, id) });
    }
    const rooms = sortedAreas(this.hass, { order: areasOrder(this._dashboardConfig) });
    const known = new Set(rooms.map((a) => a.area_id));
    const loose = [...byArea].filter(([area]) => !known.has(area)).flatMap(([, items]) => items);
    return [...rooms.map((a) => ({ label: a.name, items: byArea.get(a.area_id) || [] })), { label: "No room", items: loose }]
      .filter((g) => g.items.length)
      .map((g) => ({ ...g, items: g.items.sort((a, b) => a.name.localeCompare(b.name)) }));
  }

  _entitySelect(field, domains, value, placeholder) {
    const groups = this._entities(domains);
    const label = (i) => (domains.length > 1 ? `${i.name} · ${DOMAIN_LABELS[domainOf(i.id)] || domainOf(i.id)}` : i.name);
    const options = groups.map((g) => {
      const opts = g.items.map((i) => option(i.id, label(i), i.id === value)).join("");
      return groups.length > 1 ? `<optgroup label="${escapeHtml(g.label)}">${opts}</optgroup>` : opts;
    }).join("");
    return `<select data-action="ed-field" data-field="${field}" aria-label="${escapeHtml(placeholder)}">
      ${option("", placeholder, !value)}${options}</select>`;
  }

  /** Device kinds "Control a room" can target in `areaId` (plus `keep`, the one already chosen). */
  _roomDomains(areaId, keep = "") {
    const present = new Set(Object.keys(this.hass?.states || {})
      .filter((id) => areaOfEntity(this.hass, id) === areaId && this._targetable(id))
      .map(domainOf));
    return Object.keys(ROOM_DOMAINS).filter((d) => present.has(d) || d === keep);
  }

  _seg(action, items, current, index = null) {
    const at = index == null ? "" : ` data-index="${index}"`;
    return `<div class="btn-wrap" role="group">${items.map((k) =>
      `<button type="button" class="btn secondary" data-action="${action}" data-kind="${k.id}"${at} aria-pressed="${k.id === current}">${escapeHtml(k.label)}</button>`).join("")}</div>`;
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
    if (t.kind === "interval") {
      return `<div class="field-row">
        <label class="field"><span>Every</span>
          <input type="number" min="1" max="${(INTERVAL_UNITS.find((u) => u.id === t.unit) || INTERVAL_UNITS[0]).max}" step="1"
            data-action="ed-field" data-field="trigger.every" value="${escapeHtml(t.every)}" /></label>
        <label class="field"><span>Unit</span><select data-action="ed-field" data-field="trigger.unit" aria-label="Unit">
          ${INTERVAL_UNITS.map((u) => option(u.id, u.label, u.id === t.unit)).join("")}</select></label></div>
        <p class="note">Hours run on the hour (every 2 hours: 00:00, 02:00, …).</p>`;
    }
    if (t.kind === "zone") {
      const zones = Object.keys(this.hass?.states || {}).filter((id) => domainOf(id) === "zone")
        .map((id) => ({ id, name: friendlyName(this.hass, id) })).sort((a, b) => a.name.localeCompare(b.name));
      return `<label class="field"><span>Who</span>${this._entitySelect("trigger.person", ["person", "device_tracker"], t.person, "Choose a person…")}</label>
        ${this._seg("ed-zone-event", [{ id: "enter", label: "Arrives at" }, { id: "leave", label: "Leaves" }], t.zone_event)}
        <label class="field"><span>Place</span><select data-action="ed-field" data-field="trigger.zone" aria-label="Place">
          ${option("", "Choose a place…", !t.zone)}${zones.map((z) => option(z.id, z.name, z.id === t.zone)).join("")}</select></label>
        <p class="note">Places are Home Assistant zones; phones report them through the Home Assistant app.</p>`;
    }
    if (t.kind === "elevation") {
      return `${this._seg("ed-direction", [{ id: "below", label: "Sun goes below" }, { id: "above", label: "Sun rises above" }], t.direction)}
        <label class="field"><span>Height (degrees)</span>
          <input type="number" min="-90" max="90" step="0.5" data-action="ed-field" data-field="trigger.degrees" value="${escapeHtml(t.degrees)}" /></label>
        <p class="note">0° is the horizon, -6° is dusk or dawn, 10° is well after sunrise.</p>`;
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

  _serviceSelect(field, services, value) {
    return `<label class="field"><span>Do</span><select data-action="ed-field" data-field="${field}" aria-label="Do">
      ${value ? "" : option("", "Choose…", true)}${services.map(([s, label]) => option(s, label, s === value)).join("")}</select></label>`;
  }

  /** Notify services Home Assistant offers (`notify.mobile_app_…`, `notify.notify`, …), `send_message` left out. */
  _notifyOptions(value) {
    const names = Object.keys(this.hass?.services?.notify || {}).filter((s) => s !== "send_message").sort();
    if (value && !names.includes(value)) names.unshift(value);
    const label = (s) => (s === "notify" ? "Everyone (notify.notify)" : s.replace(/^mobile_app_/, "Phone: ").replace(/_/g, " "));
    return `${option("", "Choose…", !value)}${names.map((s) => option(s, label(s), s === value)).join("")}`;
  }

  _text(field, value, label, placeholder = "") {
    return `<label class="field"><span>${label}</span>
      <input type="text" data-action="ed-field" data-field="${field}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></label>`;
  }

  _actionFields(a, i) {
    const f = (key) => `actions.${i}.${key}`;
    if (a.kind === "notify") {
      return `<label class="field"><span>Send to</span><select data-action="ed-field" data-field="${f("service")}" aria-label="Send to">
        ${this._notifyOptions(a.service)}</select></label>
        ${this._text(f("title"), a.title, "Title (optional)")}${this._text(f("message"), a.message, "Message", "The front door is open")}`;
    }
    if (a.kind === "announce") {
      const voices = Object.keys(this.hass?.states || {}).filter((id) => domainOf(id) === "tts");
      return `<div class="field-row">
        <label class="field"><span>Speaker</span>${this._entitySelect(f("player"), ["media_player"], a.player, "Choose a speaker…")}</label>
        <label class="field"><span>Voice</span>${this._entitySelect(f("entity_id"), ["tts"], a.entity_id, "Choose…")}</label></div>
        ${this._text(f("message"), a.message, "Say", "Dinner is ready")}
        ${voices.length ? "" : `<p class="note">Add a text-to-speech service in Home Assistant (Settings → Voice assistants) to announce.</p>`}`;
    }
    if (a.kind === "delay") {
      return `<div class="field-row">
        <label class="field"><span>Minutes</span><input type="number" min="0" max="1439" step="1" data-action="ed-field" data-field="${f("minutes")}" value="${escapeHtml(a.minutes)}" /></label>
        <label class="field"><span>Seconds</span><input type="number" min="0" max="59" step="1" data-action="ed-field" data-field="${f("seconds")}" value="${escapeHtml(a.seconds)}" /></label></div>`;
    }
    if (a.kind === "scene") return `<label class="field"><span>Scene</span>${this._entitySelect(f("entity_id"), ["scene"], a.entity_id, "Choose a scene…")}</label>`;
    if (a.kind === "script") return `<label class="field"><span>Script</span>${this._entitySelect(f("entity_id"), ["script"], a.entity_id, "Choose a script…")}</label>`;
    if (a.kind === "room") {
      const room = `<label class="field"><span>Room</span><select data-action="ed-field" data-field="${f("area_id")}" aria-label="Room">
        ${this._roomOptions(a.area_id, "Choose a room…")}</select></label>`;
      if (!a.area_id) return room;
      const domains = this._roomDomains(a.area_id, a.domain);
      if (!domains.length) return `${room}<p class="note">This room has no lights, switches, coverings or other devices to control.</p>`;
      const services = roomServices(a.domain);
      return `${room}<div class="field-row">
        <label class="field"><span>Devices</span><select data-action="ed-field" data-field="${f("domain")}" aria-label="Devices">
          ${option("", "Choose…", !a.domain)}${domains.map((d) => option(d, `All ${ROOM_DOMAINS[d]}`, d === a.domain)).join("")}</select></label>
        ${services.length ? this._serviceSelect(f("service"), services, a.service) : ""}</div>`;
    }
    const services = DEVICE_SERVICES[domainOf(a.entity_id)] || [];
    return `<label class="field"><span>Device</span>${this._entitySelect(f("entity_id"), Object.keys(DEVICE_SERVICES), a.entity_id, "Choose a device…")}</label>
      ${services.length ? this._serviceSelect(f("service"), services, a.service) : ""}`;
  }

  /** Word for one entry of the "Then" list ("Action"; presets say "Step"). */
  get stepWord() {
    return "Action";
  }

  _actionBlock(a, i, count) {
    const word = this.stepWord;
    const head = count > 1
      ? `<div class="ed-step-head"><span>${word} ${i + 1}</span>
          <button type="button" class="btn ghost" data-action="ed-remove-action" data-index="${i}" aria-label="Remove ${word.toLowerCase()} ${i + 1}">Remove</button></div>`
      : "";
    return `<div class="ed-step${count > 1 ? " boxed" : ""}">${head}${this._seg("ed-action", ACTION_KINDS, a.kind, i)}${this._actionFields(a, i)}</div>`;
  }

  sheetBody() {
    const d = this._draft;
    const body = `
      <div class="sheet-section">
        <label class="field"><span>Name</span>
          <input type="text" data-action="ed-field" data-field="alias" value="${escapeHtml(d.alias)}" placeholder="e.g. Porch light at sunset" ${this._configId ? "" : "autofocus"} /></label>
        <label class="field"><span>Room</span>
          <select data-action="ed-field" data-field="area_id" aria-label="Room">
            ${this._roomOptions(d.area_id, "No room")}
          </select></label>
      </div>
      <div class="sheet-section">
        <div class="section-label">When</div>
        ${this._seg("ed-trigger", TRIGGER_KINDS, d.trigger.kind)}
        ${this._triggerFields()}
      </div>
      <div class="sheet-section">
        <div class="section-label">Then</div>
        ${d.actions.map((a, i) => this._actionBlock(a, i, d.actions.length)).join("")}
        <button type="button" class="btn secondary" data-action="ed-add-action">+ Add action</button>
      </div>
      ${this._problems.length || this._error ? `<div class="sheet-section">
        ${this._problems.map((p) => `<p class="error">${escapeHtml(p)}</p>`).join("")}
        ${this._error ? `<p class="error">${escapeHtml(this._error)}</p>` : ""}</div>` : ""}
      <p class="note">For conditions, choices, waiting for something to happen or anything else, use Home Assistant's automation editor.</p>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="ed-advanced">Home Assistant editor</button>
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="ed-save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save"}</button>`;
    return sheetFrame({ title: this._configId ? "Edit automation" : "New automation", subtitle: "", body, footer });
  }

  _set(path, value) {
    const step = /^actions\.(\d+)\.(\w+)$/.exec(path);
    if (step) {
      this._patchAction(Number(step[1]), { [step[2]]: value });
      return;
    }
    const [head, tail] = path.split(".");
    if (tail) this._draft[head] = { ...this._draft[head], [tail]: value };
    else this._draft[head] = value;
  }

  _patchAction(index, patch) {
    this._draft.actions = this._draft.actions.map((a, i) => (i === index ? { ...a, ...patch } : a));
  }

  /** Keep an action's later choices valid after its device or room changes. */
  _actionChanged(index, key) {
    const a = this._draft.actions[index];
    if (!a) return;
    if (a.kind === "service" && key === "entity_id") {
      const services = DEVICE_SERVICES[domainOf(a.entity_id)] || [];
      if (!services.some(([s]) => s === a.service)) this._patchAction(index, { service: services[0]?.[0] || "" });
    }
    if (a.kind === "room" && (key === "area_id" || key === "domain")) {
      let { domain } = a;
      if (key === "area_id") {
        const domains = this._roomDomains(a.area_id);
        if (!domains.includes(domain)) domain = domains.includes("light") ? "light" : domains[0] || "";
      }
      const services = roomServices(domain);
      const service = services.some(([s]) => s === a.service) ? a.service : services[0]?.[0] || "";
      this._patchAction(index, { domain, service });
    }
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  get actions() {
    return {
      "input:ed-field": (input) => this._set(input.dataset.field, input.value),
      "change:ed-field": (input) => {
        this._set(input.dataset.field, input.value);
        const step = /^actions\.(\d+)\.(\w+)$/.exec(input.dataset.field);
        if (step && step[2] !== "service") {
          this._actionChanged(Number(step[1]), step[2]);
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
      "ed-zone-event": (button) => {
        this._set("trigger.zone_event", button.dataset.kind);
        this._rerender();
      },
      "ed-direction": (button) => {
        this._set("trigger.direction", button.dataset.kind);
        this._rerender();
      },
      "ed-action": (button) => {
        const index = Number(button.dataset.index);
        if (this._draft.actions[index]?.kind === button.dataset.kind) return;
        this._draft.actions = this._draft.actions.map((a, i) => (i === index ? emptyAction(button.dataset.kind) : a));
        this._rerender();
      },
      "ed-add-action": () => {
        this._draft.actions = [...this._draft.actions, emptyAction("service")];
        this._rerender();
      },
      "ed-remove-action": (button) => {
        const index = Number(button.dataset.index);
        this._draft.actions = this._draft.actions.filter((_, i) => i !== index);
        if (!this._draft.actions.length) this._draft.actions = [emptyAction()];
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
