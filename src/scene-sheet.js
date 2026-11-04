import { automationConfigId } from "./automation-model.js";
import { escapeHtml, navigate } from "./base.js";
import { isFavorite } from "./favorites.js";
import { friendlyName, isUnavailable, relativeTime } from "./model.js";
import { sheetFrame } from "./sheet.js";
import { describeScene } from "./transfer-model.js";
import { editorPath, fetchConfig, openExportSheet } from "./transfer.js";

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
    const admin = m.admin && m.configId
      ? `<div class="sheet-section"><div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="scene-export" ${d.config ? "" : "disabled"}>Export</button>
          <button type="button" class="btn secondary" data-action="scene-ha-edit">Open in Home Assistant</button>
        </div></div>`
      : "";
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
      "scene-run": () => this.hass.callService("scene", "turn_on", { entity_id: this._entityId }),
      "scene-export": () => {
        if (!this._details?.config) return;
        openExportSheet(this._host, { kind: "scene", name: this._facts().name, config: this._details.config });
      },
      "scene-ha-edit": () => {
        const { configId } = this._facts();
        this._host._sheet?.close();
        navigate(editorPath("scene", configId));
      },
    };
  }
}

/** Open the scene sheet for `entityId` in the host's sheet. */
export function openSceneSheet(host, entityId) {
  host._sheet ||= document.createElement("controlz-sheet");
  const sheet = new SceneSheet(host, entityId);
  host._sheet.show(sheet);
  sheet.load();
}
