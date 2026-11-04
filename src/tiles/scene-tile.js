import { CzElement, escapeHtml } from "../base.js";
import { domainOf, friendlyName, relativeTime } from "../model.js";
import { SCENE_STYLES, TILE_STYLES } from "../styles.js";

const KINDS = {
  scene: { icon: "🎬", label: "Scene", run: ["scene", "turn_on"] },
  script: { icon: "📜", label: "Script", run: ["script", "turn_on"] },
  automation: { icon: "⚙️", label: "Automation", run: ["automation", "trigger"] },
};

/** Scene / script / automation tile in the ControlZ automation-tile style (Run + enable). */
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
      enabled: domain === "automation" ? stateObj?.state === "on" : null,
      meta: [kind.label, domain === "automation" && (stateObj?.state === "on" ? "Enabled" : "Disabled"), ago && `Last run ${ago}`]
        .filter(Boolean)
        .join(" · "),
    };
    const enableBtn = domain === "automation"
      ? `<button type="button" class="icon-btn${model.enabled ? "" : " is-off"}" data-action="enable"
          title="${model.enabled ? "Disable" : "Enable"}" aria-label="${model.enabled ? "Disable" : "Enable"}" aria-pressed="${model.enabled}">⏻</button>`
      : "";
    const html = `
      <article class="tile scene${model.running ? " active" : ""}">
        <div class="header">
          <span class="icon scene-icon" aria-hidden="true">${kind.icon}</span>
          <div class="name-block"><div class="name">${escapeHtml(model.name)}</div></div>
        </div>
        <p class="meta">${escapeHtml(model.meta)}</p>
        <div class="footer">
          <button type="button" class="run-btn" data-action="run">▶ Run</button>
          ${enableBtn}
        </div>
      </article>`;
    return { model, html };
  }

  get actions() {
    const entityId = this._config.entity;
    const domain = domainOf(entityId);
    return {
      run: () => {
        const [d, service] = (KINDS[domain] || KINDS.script).run;
        this.callService(d, service, { entity_id: entityId });
      },
      enable: () => this.callService("automation", "toggle", { entity_id: entityId }),
    };
  }

  onTileClick() {
    this.moreInfo(this._config.entity);
  }
}
