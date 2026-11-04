import {
  automationEditorPath, automationTracePath, deleteAutomationConfig, duplicateAutomation, fetchAutomationConfig, openAutomationEditor,
} from "../automation-editor.js";
import { automationConfigId, describeAutomation, simpleDraft } from "../automation-model.js";
import { CzElement, escapeHtml, navigate } from "../base.js";
import { friendlyName, isUnavailable, relativeTime } from "../model.js";
import { sheetFrame } from "../sheet.js";
import { SCENE_STYLES, TILE_STYLES } from "../styles.js";

/**
 * ControlZ automation tile for a Home Assistant automation: Run (conditions are checked, unlike
 * a bare `automation.trigger`), enable / disable, and for admins edit and delete. Tapping the tile
 * or "What this will do" opens the details sheet (triggers, conditions, actions; duplicate, traces).
 */
export class AutomationTile extends CzElement {
  styles() {
    return TILE_STYLES + SCENE_STYLES;
  }

  _facts() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const enabled = stateObj?.state === "on";
    const running = (stateObj?.attributes?.current ?? 0) > 0;
    const last = stateObj?.attributes?.last_triggered;
    const ago = last ? relativeTime(last) : "";
    return {
      name: this._config.name || friendlyName(this._hass, entityId),
      enabled,
      running,
      offline: isUnavailable(stateObj),
      configId: automationConfigId(stateObj),
      admin: !!this._hass.user?.is_admin,
      meta: [enabled ? "Enabled" : "Disabled", running && "Running", ago ? `Last run ${ago}` : "Never run"].filter(Boolean).join(" · "),
    };
  }

  view() {
    const m = this._facts();
    const canEdit = m.admin && m.configId;
    const html = `
      <article class="tile scene${m.running ? " active" : ""}${m.enabled ? "" : " disabled"}${m.offline ? " offline" : ""}">
        <div class="header">
          <span class="icon scene-icon" aria-hidden="true">⚙️</span>
          <div class="name-block"><div class="name">${escapeHtml(m.name)}</div></div>
        </div>
        <p class="meta">${escapeHtml(m.meta)}</p>
        <button type="button" class="what-btn large-only" data-action="details">What this will do ›</button>
        <div class="footer">
          <button type="button" class="run-btn" data-action="run" ${m.offline ? "disabled" : ""}>▶ Run</button>
          <button type="button" class="icon-btn${m.enabled ? "" : " is-off"}" data-action="enable"
            title="${m.enabled ? "Disable" : "Enable"}" aria-label="${m.enabled ? "Disable" : "Enable"} ${escapeHtml(m.name)}" aria-pressed="${m.enabled}">⏻</button>
          ${canEdit ? `<button type="button" class="icon-btn hide-compact" data-action="edit" title="Edit" aria-label="Edit ${escapeHtml(m.name)}">✎</button>
          <button type="button" class="icon-btn hide-compact" data-action="delete" title="Delete" aria-label="Delete ${escapeHtml(m.name)}">🗑</button>` : ""}
        </div>
      </article>`;
    return { model: m, html };
  }

  _run(skipConditions) {
    const { name } = this._facts();
    const question = skipConditions
      ? `Run "${name}" now, skipping its conditions?`
      : `Run "${name}" now? Its conditions are checked first.`;
    if (!this.confirmAction(question)) return;
    this.callService("automation", "trigger", { entity_id: this._config.entity, skip_condition: !!skipConditions });
  }

  async _loadConfig() {
    const { configId, admin } = this._facts();
    if (!admin || !configId) {
      this._details = { config: null, error: admin ? "This automation is defined in YAML without an id, so it can only be read in Home Assistant." : null };
      this._sheet?.refresh(true);
      return null;
    }
    this._details = { loading: true };
    this._sheet?.refresh(true);
    try {
      const config = await fetchAutomationConfig(this._hass, configId);
      this._details = { config };
    } catch (err) {
      this._details = { error: err?.body?.message || err?.message || "Could not read the automation." };
    }
    this._sheet?.refresh(true);
    return this._details.config || null;
  }

  _openDetails() {
    this._details = null;
    this.openSheet();
    this._loadConfig();
  }

  async _edit() {
    const { configId } = this._facts();
    if (!configId) return;
    let config = this._details?.config;
    try {
      config ||= await fetchAutomationConfig(this._hass, configId);
    } catch {
      config = null;
    }
    const draft = simpleDraft(config);
    if (!draft) {
      this.closeSheet();
      navigate(automationEditorPath(configId));
      return;
    }
    openAutomationEditor(this, { configId, entityId: this._config.entity, draft, baseConfig: config });
  }

  async _delete() {
    const { configId, name } = this._facts();
    if (!configId || !this.confirmAction(`Delete "${name}"? This removes it from Home Assistant.`)) return;
    try {
      await deleteAutomationConfig(this._hass, configId);
      this.closeSheet();
    } catch (err) {
      this._details = { ...(this._details || {}), error: err?.body?.message || err?.message || "Could not delete the automation." };
      this._sheet?.refresh(true);
    }
  }

  async _duplicate() {
    const { configId } = this._facts();
    if (!configId) return;
    this._details = { ...(this._details || {}), busy: "Duplicating…" };
    this._sheet?.refresh(true);
    try {
      await duplicateAutomation(() => this._hass, this._config.entity, configId);
      this.closeSheet();
    } catch (err) {
      this._details = { ...(this._details || {}), busy: null, error: err?.body?.message || err?.message || "Could not duplicate the automation." };
      this._sheet?.refresh(true);
    }
  }

  sheetBody() {
    const m = this._facts();
    const d = this._details || {};
    const nameOf = (id) => (typeof id === "string" && this._hass.states[id] ? friendlyName(this._hass, id) : String(id));
    const lines = (label, items) => (items.length
      ? `<div class="lines-label">${label}</div><ul class="lines">${items.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
      : "");
    let what;
    if (d.loading) what = `<p class="note">Loading…</p>`;
    else if (d.config) {
      const w = describeAutomation(d.config, nameOf);
      what = `${lines("When", w.triggers)}${lines("Only if", w.conditions)}${lines("Then", w.actions)}`
        || `<p class="note">This automation has no triggers or actions yet.</p>`;
    } else if (!m.admin) what = `<p class="note">Only Home Assistant admins can see what an automation does.</p>`;
    else what = "";
    const admin = m.admin && m.configId
      ? `<div class="sheet-section"><div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="edit">Edit</button>
          <button type="button" class="btn secondary" data-action="ha-edit">Open in Home Assistant</button>
          <button type="button" class="btn secondary" data-action="traces">Traces</button>
          <button type="button" class="btn secondary" data-action="duplicate" ${d.busy ? "disabled" : ""}>${d.busy || "Duplicate"}</button>
          <button type="button" class="btn danger" data-action="delete">Delete</button>
        </div></div>`
      : "";
    return sheetFrame({
      title: m.name,
      subtitle: m.meta,
      favorite: this.favoriteOn,
      detailsEntity: this._config.entity,
      body: `
        <div class="sheet-section"><div class="btn-wrap">
          <button type="button" class="btn" data-action="run" ${m.offline ? "disabled" : ""}>▶ Run</button>
          <button type="button" class="btn secondary" data-action="run-skip" ${m.offline ? "disabled" : ""}>Run, skip conditions</button>
          <button type="button" class="btn secondary" data-action="enable">${m.enabled ? "Disable" : "Enable"}</button>
        </div></div>
        ${what || d.error ? `<div class="sheet-section"><div class="section-label">What this will do</div>${what}
          ${d.error ? `<p class="error">${escapeHtml(d.error)}</p>` : ""}</div>` : ""}
        ${admin}`,
    });
  }

  get actions() {
    const entityId = this._config.entity;
    return {
      run: () => this._run(false),
      "run-skip": () => this._run(true),
      enable: () => this.callService("automation", this._facts().enabled ? "turn_off" : "turn_on", { entity_id: entityId }),
      details: () => this._openDetails(),
      edit: () => this._edit(),
      delete: () => this._delete(),
      duplicate: () => this._duplicate(),
      "ha-edit": () => {
        this.closeSheet();
        navigate(automationEditorPath(this._facts().configId));
      },
      traces: () => {
        this.closeSheet();
        navigate(automationTracePath(this._facts().configId));
      },
    };
  }

  onTileClick() {
    this._openDetails();
  }
}
