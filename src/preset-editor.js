import { AutomationEditor, assignArea } from "./automation-editor.js";
import { describeAutomation, emptyAction } from "./automation-model.js";
import { escapeHtml, navigate } from "./base.js";
import { isFavorite } from "./favorites.js";
import { confirmScenes, runScene, setSceneConfirm } from "./hidden.js";
import { friendlyName, isUnavailable, relativeTime } from "./model.js";
import { emptyPreset, newScriptKey, presetDraft, presetProblems, presetToConfig, scriptKey } from "./preset-model.js";
import { sheetFrame } from "./sheet.js";

/** Script config API (admins only), the endpoints Home Assistant's script editor uses; the key is the script's object id. */
export const fetchScriptConfig = (hass, key) => hass.callApi("GET", `config/script/config/${encodeURIComponent(key)}`);
export const saveScriptConfig = (hass, key, config) => hass.callApi("POST", `config/script/config/${encodeURIComponent(key)}`, config);
export const deleteScriptConfig = (hass, key) => hass.callApi("DELETE", `config/script/config/${encodeURIComponent(key)}`);
export const scriptEditorPath = (key) => (key ? `/config/script/edit/${encodeURIComponent(key)}` : "/config/script/edit/new");

const WAIT_STEP_MS = 250;
const WAIT_MAX_MS = 10_000;

async function waitForScript(getHass, key) {
  for (let waited = 0; waited <= WAIT_MAX_MS; waited += WAIT_STEP_MS) {
    if (getHass()?.states?.[`script.${key}`]) return `script.${key}`;
    await new Promise((r) => setTimeout(r, WAIT_STEP_MS));
  }
  return null;
}

/**
 * Preset editor (ControlZ preset sequences): a name, an icon, a room, then steps run in order.
 * Saved as an ordinary Home Assistant script, so it also runs from Home Assistant, voice and automations.
 */
class PresetEditor extends AutomationEditor {
  constructor(host, { key = null, entityId = null, draft = null, baseConfig = null, areaId = "" } = {}) {
    super(host, { configId: key, entityId, draft: draft || emptyPreset(), baseConfig, areaId });
  }

  get stepWord() {
    return "Step";
  }

  sheetBody() {
    const d = this._draft;
    const body = `
      <div class="sheet-section">
        <label class="field"><span>Name</span>
          <input type="text" data-action="ed-field" data-field="alias" value="${escapeHtml(d.alias)}" placeholder="e.g. Bedtime" ${this._configId ? "" : "autofocus"} /></label>
        <div class="field-row">
          <label class="field"><span>Icon (optional)</span>
            <input type="text" data-action="ed-field" data-field="icon" value="${escapeHtml(d.icon)}" placeholder="mdi:bed" /></label>
          <label class="field"><span>Room</span><select data-action="ed-field" data-field="area_id" aria-label="Room">
            ${this._roomOptions(d.area_id, "House-wide (All Rooms)")}</select></label>
        </div>
      </div>
      <div class="sheet-section">
        <div class="section-label">Steps, in order</div>
        ${d.actions.map((a, i) => this._actionBlock(a, i, d.actions.length)).join("")}
        <div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="pr-add" data-kind="scene">+ Scene</button>
          <button type="button" class="btn secondary" data-action="pr-add" data-kind="delay">+ Wait</button>
          <button type="button" class="btn secondary" data-action="ed-add-action">+ Other step</button>
        </div>
      </div>
      ${this._problems.length || this._error ? `<div class="sheet-section">
        ${this._problems.map((p) => `<p class="error">${escapeHtml(p)}</p>`).join("")}
        ${this._error ? `<p class="error">${escapeHtml(this._error)}</p>` : ""}</div>` : ""}
      <p class="note">Saved as a Home Assistant script. For choices, repeats or fields, use Home Assistant's script editor.</p>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="ed-advanced">Home Assistant editor</button>
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="ed-save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save"}</button>`;
    return sheetFrame({ title: this._configId ? "Edit preset" : "New preset", subtitle: "Scenes and steps in order, with waits between", body, footer });
  }

  get actions() {
    return {
      ...super.actions,
      "pr-add": (button) => {
        this._draft.actions = [...this._draft.actions, emptyAction(button.dataset.kind)];
        this._rerender();
      },
      "ed-advanced": () => {
        this._host._sheet?.close();
        navigate(scriptEditorPath(this._configId));
      },
    };
  }

  async _save() {
    this._problems = presetProblems(this._draft);
    this._error = null;
    if (this._problems.length) {
      this._rerender();
      return;
    }
    this._saving = true;
    this._rerender();
    const getHass = () => this._host.hass;
    try {
      const key = this._configId || newScriptKey(this._draft.alias, Object.keys(this.hass.states).filter((id) => id.startsWith("script.")));
      await saveScriptConfig(this.hass, key, presetToConfig(this._draft, this._base || {}));
      const entityId = this._entityId || await waitForScript(getHass, key);
      if (entityId) await assignArea(getHass, entityId, this._draft.area_id);
      this._host._sheet?.close();
    } catch (err) {
      this._saving = false;
      this._error = err?.body?.message || err?.message || "Home Assistant did not save the preset.";
      this._rerender();
    }
  }
}

/** Open the preset editor (new, or `opts` for an existing script) in the host's sheet. */
export function openPresetEditor(host, opts = {}) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new PresetEditor(host, opts));
}

/**
 * Script / preset sheet (script tiles and chips): Run, Cancel while running, its steps, and for
 * admins Edit (the preset editor when it can show the whole script), Open in Home Assistant, Delete.
 */
class ScriptSheet {
  constructor(host, entityId) {
    this._host = host;
    this._entityId = entityId;
    this._details = null;
  }

  get hass() {
    return this._host.hass;
  }

  moreInfo(entityId) {
    this._host.moreInfo(entityId);
  }

  sheetDetailsEntity() {
    return this._entityId;
  }

  favoriteTarget() {
    return { kind: "entity", id: this._entityId };
  }

  _refresh() {
    this._host._sheet?.refresh(true);
  }

  async load() {
    if (!this.hass?.user?.is_admin) return;
    this._details = { loading: true };
    this._refresh();
    try {
      this._details = { config: await fetchScriptConfig(this.hass, scriptKey(this._entityId)) };
    } catch (err) {
      this._details = { error: err?.status_code === 404 || /not found/i.test(err?.message || "")
        ? "This script is in Home Assistant's YAML files, so it is edited there."
        : err?.body?.message || err?.message || "Could not read the script." };
    }
    this._refresh();
  }

  sheetBody() {
    const s = this.hass.states[this._entityId];
    const name = friendlyName(this.hass, this._entityId);
    const running = s?.state === "on";
    const ran = s?.attributes?.last_triggered ? relativeTime(s.attributes.last_triggered) : "";
    const d = this._details || {};
    const admin = !!this.hass.user?.is_admin;
    const nameOf = (id) => (typeof id !== "string" ? String(id) : this.hass.states[id] ? friendlyName(this.hass, id) : this.hass.areas?.[id]?.name || id);
    let steps = "";
    if (d.loading) steps = `<p class="note">Loading…</p>`;
    else if (d.config) {
      const lines = describeAutomation({ actions: d.config.sequence }, nameOf).actions;
      steps = lines.length ? `<div class="lines-label">Steps</div><ol class="lines">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ol>` : "";
    } else if (!admin) steps = `<p class="note">Only Home Assistant admins can see a script's steps.</p>`;
    const asks = confirmScenes(this._host._config || {}).has(this._entityId);
    const adminButtons = admin ? `<div class="sheet-section">
        <label class="check-row"><input type="checkbox" data-action="sc-confirm" ${asks ? "checked" : ""} />
          <span>Ask before running (everyone on this dashboard)</span></label>
        <div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="sc-edit" ${d.loading ? "disabled" : ""}>Edit</button>
          <button type="button" class="btn secondary" data-action="sc-ha">Open in Home Assistant</button>
          ${d.config ? `<button type="button" class="btn danger" data-action="sc-delete">Delete</button>` : ""}
        </div></div>` : "";
    return sheetFrame({
      title: name,
      subtitle: [running ? "Running" : "Preset", ran && `Last run ${ran}`].filter(Boolean).join(" · "),
      favorite: isFavorite("entity", this._entityId),
      detailsEntity: this._entityId,
      body: `
        <div class="sheet-section"><div class="btn-wrap">
          <button type="button" class="btn" data-action="sc-run" ${isUnavailable(s) ? "disabled" : ""}>▶ Run</button>
          ${running ? `<button type="button" class="btn secondary" data-action="sc-stop">■ Cancel</button>` : ""}
        </div></div>
        ${steps || d.error ? `<div class="sheet-section">${steps}${d.error ? `<p class="note">${escapeHtml(d.error)}</p>` : ""}</div>` : ""}
        ${adminButtons}`,
    });
  }

  get actions() {
    return {
      "sc-run": () => runScene(this.hass, this._host._config || {}, this._entityId, friendlyName(this.hass, this._entityId)),
      "sc-stop": () => this.hass.callService("script", "turn_off", { entity_id: this._entityId }),
      "change:sc-confirm": (input) => setSceneConfirm(this.hass, this._entityId, input.checked).catch((err) => {
        this._details = { ...(this._details || {}), error: err?.message || "Could not save the dashboard." };
        this._refresh();
      }),
      "sc-edit": () => {
        const key = scriptKey(this._entityId);
        const draft = presetDraft(this._details?.config);
        if (!draft) {
          this._host._sheet?.close();
          navigate(scriptEditorPath(this._details?.config ? key : null));
          return;
        }
        openPresetEditor(this._host, { key, entityId: this._entityId, draft, baseConfig: this._details.config });
      },
      "sc-ha": () => {
        this._host._sheet?.close();
        navigate(scriptEditorPath(scriptKey(this._entityId)));
      },
      "sc-delete": async () => {
        const name = friendlyName(this.hass, this._entityId);
        if (!window.confirm(`Delete "${name}"? This removes the script from Home Assistant.`)) return;
        try {
          await deleteScriptConfig(this.hass, scriptKey(this._entityId));
          this._host._sheet?.close();
        } catch (err) {
          this._details = { ...(this._details || {}), error: err?.body?.message || err?.message || "Could not delete the script." };
          this._refresh();
        }
      },
    };
  }
}

/** Open the script / preset sheet for `entityId` in the host's sheet. */
export function openScriptSheet(host, entityId) {
  host._sheet ||= document.createElement("controlz-sheet");
  const sheet = new ScriptSheet(host, entityId);
  host._sheet.show(sheet);
  sheet.load();
}
