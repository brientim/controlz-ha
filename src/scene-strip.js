import { CzElement, escapeHtml } from "./base.js";
import { domainOf, friendlyName, sceneLabel } from "./model.js";
import { TOKENS } from "./styles.js";

const RUN = {
  scene: ["scene", "turn_on", "🎬"],
  script: ["script", "turn_on", "📜"],
};
const RAN_FLASH_MS = 1200;

const STYLES = `
  ${TOKENS}
  .strip { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    min-height: 36px; padding: 6px 12px; border-radius: 999px;
    border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-text);
    box-shadow: var(--cz-shadow); font: inherit; font-size: 0.85rem; font-weight: 600;
    cursor: pointer; max-width: 100%;
  }
  .chip:hover { border-color: #22c55e; }
  .chip:active { transform: scale(0.97); }
  .chip:focus-visible { outline: 2px solid var(--cz-primary); outline-offset: 2px; }
  .chip .glyph { font-size: 0.95rem; line-height: 1; }
  .chip .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip .play { color: #22c55e; font-size: 0.75rem; }
  .chip.running, .chip.ran { background: #22c55e; border-color: #22c55e; color: #fff; }
  .chip.running .play, .chip.ran .play { color: #fff; }
  .chip.disabled { opacity: 0.55; }
  :host([size="compact"]) .chip { min-height: 30px; padding: 4px 10px; font-size: 0.78rem; }
`;

/**
 * Compact scene row for a room page (ControlZ scene header): one chip per scene / script;
 * tap runs it, right-click (long-press on Android) opens Home Assistant's more-info.
 */
export class SceneStrip extends CzElement {
  styles() {
    return STYLES;
  }

  view() {
    const areaName = this._config.area_name || "";
    const items = (this._config.entities || []).map((entityId) => {
      const stateObj = this._hass.states[entityId];
      const domain = domainOf(entityId);
      return {
        id: entityId,
        label: sceneLabel(friendlyName(this._hass, entityId), areaName),
        glyph: (RUN[domain] || RUN.script)[2],
        running: domain === "script" && stateObj?.state === "on",
        ran: this._ran === entityId,
      };
    });
    const html = `<div class="strip" role="group" aria-label="Scenes">${items.map((i) => `
      <button type="button" class="chip${i.running ? " running" : ""}${i.ran ? " ran" : ""}"
        data-action="run" data-entity="${escapeHtml(i.id)}" title="Run ${escapeHtml(i.label)} (right-click for details)">
        <span class="glyph" aria-hidden="true">${i.glyph}</span>
        <span class="label">${escapeHtml(i.label)}</span>
        <span class="play" aria-hidden="true">▶</span>
      </button>`).join("")}</div>`;
    return { model: items, html };
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._onContext) return;
    this._onContext = (ev) => {
      const chip = ev.target.closest?.(".chip");
      if (!chip) return;
      ev.preventDefault();
      this.moreInfo(chip.dataset.entity);
    };
    this.shadowRoot.addEventListener("contextmenu", this._onContext);
  }

  get actions() {
    return {
      run: (chip) => {
        const entityId = chip.dataset.entity;
        const [domain, service] = RUN[domainOf(entityId)] || RUN.script;
        this.callService(domain, service, { entity_id: entityId });
        this._ran = entityId;
        this.requestRender(true);
        clearTimeout(this._ranTimer);
        this._ranTimer = setTimeout(() => {
          this._ran = null;
          this.requestRender(true);
        }, RAN_FLASH_MS);
      },
    };
  }
}
