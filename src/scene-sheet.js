import { visibleItems } from "./area-cache.js";
import { assignArea, waitForConfigEntity } from "./automation-editor.js";
import { automationConfigId, newAutomationId } from "./automation-model.js";
import { escapeHtml, navigate } from "./base.js";
import { isFavorite } from "./favorites.js";
import { confirmScenes, runScene, setSceneConfirm } from "./hidden.js";
import { friendlyName, isUnavailable, relativeTime } from "./model.js";
import { CAPTURE_KINDS, captureCandidates, captureProblem, captureSceneConfig, recaptureScene } from "./scene-model.js";
import { sheetFrame } from "./sheet.js";
import { describeScene } from "./transfer-model.js";
import { editorPath, fetchConfig, openExportSheet, saveConfig } from "./transfer.js";

/**
 * Scene sheet (scene tiles and chips): Run, what the scene sets, and for admins Export and
 * Home Assistant's scene editor. More details opens Home Assistant's own dialog.
 */
class SceneSheet {
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

  _facts() {
    const stateObj = this.hass?.states?.[this._entityId];
    const ran = stateObj?.state && !isUnavailable(stateObj) ? relativeTime(stateObj.state) : "";
    return {
      name: friendlyName(this.hass, this._entityId),
      configId: automationConfigId(stateObj),
      admin: !!this.hass?.user?.is_admin,
      offline: !stateObj || stateObj.state === "unavailable",
      meta: ["Scene", ran && `Last run ${ran}`].filter(Boolean).join(" · "),
    };
  }

  async load() {
    const { configId, admin } = this._facts();
    if (!admin || !configId) return;
    this._details = { loading: true };
    this._host._sheet?.refresh(true);
    try {
      this._details = { config: await fetchConfig(this.hass, "scene", configId) };
    } catch (err) {
      this._details = { error: err?.body?.message || err?.message || "Could not read the scene." };
    }
    this._host._sheet?.refresh(true);
  }

  sheetBody() {
    const m = this._facts();
    const d = this._details || {};
    const nameOf = (id) => (this.hass.states[id] ? friendlyName(this.hass, id) : id);
    let what = "";
    if (d.loading) what = `<p class="note">Loading…</p>`;
    else if (d.config) {
      const lines = describeScene(d.config, nameOf);
      what = lines.length ? `<div class="lines-label">Sets</div><ul class="lines">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : "";
    } else if (m.admin && !m.configId) {
      what = `<p class="note">This scene is defined in Home Assistant's YAML files without an id, so it can only be exported from there.</p>`;
    }
    const asks = confirmScenes(this._host._config || {}).has(this._entityId);
    const confirmRow = m.admin
      ? `<label class="check-row"><input type="checkbox" data-action="scene-confirm" ${asks ? "checked" : ""} ${d.confirmBusy ? "disabled" : ""} />
          <span>Ask before running (everyone on this dashboard)</span></label>`
      : "";
    const admin = m.admin && m.configId
      ? `<div class="sheet-section">${confirmRow}<div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="scene-recapture" ${d.config && !d.busy ? "" : "disabled"}
            title="Save how these devices are right now into this scene">${d.busy || "Update to how it is now"}</button>
          <button type="button" class="btn secondary" data-action="scene-export" ${d.config ? "" : "disabled"}>Export</button>
          <button type="button" class="btn secondary" data-action="scene-ha-edit">Open in Home Assistant</button>
        </div></div>`
      : confirmRow ? `<div class="sheet-section">${confirmRow}</div>` : "";
    return sheetFrame({
      title: m.name,
      subtitle: m.meta,
      favorite: isFavorite("entity", this._entityId),
      detailsEntity: this._entityId,
      body: `
        <div class="sheet-section"><div class="btn-wrap">
          <button type="button" class="btn" data-action="scene-run" ${m.offline ? "disabled" : ""}>▶ Run</button>
        </div></div>
        ${what || d.error ? `<div class="sheet-section">${what}${d.error ? `<p class="error">${escapeHtml(d.error)}</p>` : ""}</div>` : ""}
        ${admin}`,
    });
  }

  get actions() {
    return {
      "scene-run": () => runScene(this.hass, this._host._config || {}, this._entityId, this._facts().name),
      "change:scene-confirm": async (input) => {
        this._details = { ...(this._details || {}), confirmBusy: true, error: null };
        this._host._sheet?.refresh(true);
        try {
          await setSceneConfirm(this.hass, this._entityId, input.checked);
          this._details = { ...this._details, confirmBusy: false };
        } catch (err) {
          this._details = { ...this._details, confirmBusy: false, error: err?.message || "Could not save the dashboard." };
        }
        this._host._sheet?.refresh(true);
      },
      "scene-export": () => {
        if (!this._details?.config) return;
        openExportSheet(this._host, { kind: "scene", name: this._facts().name, config: this._details.config });
      },
      "scene-ha-edit": () => {
        const { configId } = this._facts();
        this._host._sheet?.close();
        navigate(editorPath("scene", configId));
      },
      "scene-recapture": () => this._recapture(),
    };
  }

  async _recapture() {
    const { configId, name } = this._facts();
    const config = this._details?.config;
    if (!config || !window.confirm(`Save how ${Object.keys(config.entities || {}).length} devices are right now into "${name}"?`)) return;
    this._details = { ...this._details, busy: "Saving…", error: null };
    this._host._sheet?.refresh(true);
    try {
      const next = recaptureScene(this.hass, config);
      await saveConfig(this.hass, "scene", configId, next);
      this._details = { config: next };
    } catch (err) {
      this._details = { config, error: err?.body?.message || err?.message || "Home Assistant did not save the scene." };
    }
    this._host._sheet?.refresh(true);
  }
}

/**
 * New scene from a room (admins): tick devices, name it, and it is saved as a Home Assistant scene
 * set to how those devices are right now, in this room.
 */
class SceneCapture {
  constructor(host, areaId) {
    this._host = host;
    this._areaId = areaId;
    this._name = "";
    this._icon = "";
    const candidates = captureCandidates(host.hass, visibleItems(host.hass, areaId, host._config || {}));
    this._ticked = new Set(candidates.filter((c) => c.ticked).map((c) => c.entity_id));
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

  _candidates() {
    return captureCandidates(this.hass, visibleItems(this.hass, this._areaId, this._host._config || {}));
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  sheetBody() {
    const candidates = this._candidates();
    const ids = candidates.filter((c) => this._ticked.has(c.entity_id)).map((c) => c.entity_id);
    const preview = describeScene(captureSceneConfig(this.hass, ids, { name: this._name }), (id) => friendlyName(this.hass, id));
    const groups = Object.entries(CAPTURE_KINDS).map(([kind, k]) => {
      const list = candidates.filter((c) => c.kind === kind);
      if (!list.length) return "";
      return `<div class="lines-label">${k.label}</div><div class="check-list">${list.map((c) => `
        <label class="check-row"><input type="checkbox" data-action="cap-tick" value="${escapeHtml(c.entity_id)}" ${this._ticked.has(c.entity_id) ? "checked" : ""} />
          <span>${escapeHtml(c.name)}</span></label>`).join("")}</div>`;
    }).join("");
    const room = this.hass.areas?.[this._areaId]?.name || this._areaId;
    const body = `
      <div class="sheet-section">
        <label class="field"><span>Name</span>
          <input type="text" data-action="cap-name" value="${escapeHtml(this._name)}" placeholder="e.g. ${escapeHtml(room)} Movie night" autofocus /></label>
        <label class="field"><span>Icon (optional, e.g. mdi:movie)</span>
          <input type="text" data-action="cap-icon" value="${escapeHtml(this._icon)}" placeholder="mdi:palette" /></label>
      </div>
      <div class="sheet-section">
        <div class="section-label">Devices</div>
        ${groups || `<p class="note">This room has no lights, switches, coverings, fans or thermostats to capture.</p>`}
      </div>
      ${preview.length ? `<div class="sheet-section"><div class="lines-label">Will set (how it is right now)</div>
        <ul class="lines">${preview.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul></div>` : ""}
      ${this._error ? `<div class="sheet-section"><p class="error">${escapeHtml(this._error)}</p></div>` : ""}
      <p class="note">Set the room the way you want it first. The scene is saved in Home Assistant, in ${escapeHtml(room)}.</p>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="cap-save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save scene"}</button>`;
    return sheetFrame({ title: "New scene", subtitle: `From ${room}, as it is now`, body, footer });
  }

  async _save() {
    const ids = this._candidates().filter((c) => this._ticked.has(c.entity_id)).map((c) => c.entity_id);
    this._error = captureProblem({ name: this._name, entityIds: ids });
    if (this._error) {
      this._rerender();
      return;
    }
    this._saving = true;
    this._rerender();
    const getHass = () => this._host.hass;
    try {
      const id = newAutomationId();
      await saveConfig(this.hass, "scene", id, captureSceneConfig(this.hass, ids, { id, name: this._name, icon: this._icon }));
      const entityId = await waitForConfigEntity(getHass, "scene", id);
      if (entityId) await assignArea(getHass, entityId, this._areaId);
      this._host._sheet?.close();
    } catch (err) {
      this._saving = false;
      this._error = err?.body?.message || err?.message || "Home Assistant did not save the scene.";
      this._rerender();
    }
  }

  get actions() {
    return {
      "input:cap-name": (input) => {
        this._name = input.value;
      },
      "input:cap-icon": (input) => {
        this._icon = input.value;
      },
      "change:cap-tick": (input) => {
        if (input.checked) this._ticked.add(input.value);
        else this._ticked.delete(input.value);
        this._rerender();
      },
      "cap-save": () => this._save(),
    };
  }
}

/** Open "New scene" for a room in the host's sheet (admins). */
export function openSceneCapture(host, areaId) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new SceneCapture(host, areaId));
}

/** Open the scene sheet for `entityId` in the host's sheet. */
export function openSceneSheet(host, entityId) {
  host._sheet ||= document.createElement("controlz-sheet");
  const sheet = new SceneSheet(host, entityId);
  host._sheet.show(sheet);
  sheet.load();
}
