import { CzElement, escapeHtml } from "../base.js";
import { runScene } from "../hidden.js";
import { domainOf, friendlyName, relativeTime } from "../model.js";
import { openScriptSheet } from "../preset-editor.js";
import { openSceneSheet } from "../scene-sheet.js";
import { SCENE_STYLES, TILE_STYLES } from "../styles.js";

const KINDS = {
  scene: { icon: "🎬", label: "Scene" },
  script: { icon: "📜", label: "Script" },
};

/**
 * Scene / script tile in the ControlZ automation-tile style (Run). Tapping a scene opens the scene
 * sheet (export for admins); a script opens the preset sheet. Automations have their own tile.
 */
export class SceneTile extends CzElement {
  styles() {
    return TILE_STYLES + SCENE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const domain = domainOf(entityId);
    const kind = KINDS[domain] || KINDS.script;
    const lastRun = domain === "scene" ? stateObj?.state : stateObj?.attributes?.last_triggered;
    const ago = lastRun ? relativeTime(lastRun) : "";
    const model = {
      name: this._config.name || friendlyName(this._hass, entityId),
      domain,
      running: domain === "script" && stateObj?.state === "on",
      meta: [kind.label, ago && `Last run ${ago}`].filter(Boolean).join(" · "),
    };
    const html = `
      <article class="tile scene${model.running ? " active" : ""}">
        <div class="header">
          <span class="icon scene-icon" aria-hidden="true">${kind.icon}</span>
          <div class="name-block"><div class="name">${escapeHtml(model.name)}</div></div>
        </div>
        <p class="meta">${escapeHtml(model.meta)}</p>
        <div class="footer">
          <button type="button" class="run-btn" data-action="run">▶ Run</button>
        </div>
      </article>`;
    return { model, html };
  }

  get actions() {
    const entityId = this._config.entity;
    return {
      run: () => runScene(this._hass, this._config, entityId, friendlyName(this._hass, entityId)),
    };
  }

  onTileClick() {
    if (domainOf(this._config.entity) === "scene") openSceneSheet(this, this._config.entity);
    else openScriptSheet(this, this._config.entity);
  }
}
