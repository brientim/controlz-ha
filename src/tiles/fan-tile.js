import { CzElement, escapeHtml } from "../base.js";
import { rangeRow, syncRange } from "../controls.js";
import { ICONS } from "../icons.js";
import { fanView, friendlyName } from "../model.js";
import { sheetFrame } from "../sheet.js";
import { TILE_STYLES } from "../styles.js";

const pretty = (s) => String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * ControlZ fan tile: power toggle + status chip (teal when on, never the light amber);
 * Large adds the speed slider. Presets, oscillation and direction live in the sheet.
 */
export class FanTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const f = fanView(this._hass.states[entityId]);
    const name = this._config.name || friendlyName(this._hass, entityId);
    const more = f.speed || f.presets.length || f.oscillate || f.direction;
    const model = { name, ...f, more: !!more };
    const html = `
      <article class="tile${f.on ? " fan-on" : ""}${f.offline ? " offline" : ""}">
        <div class="header">
          <span class="icon" aria-hidden="true">${ICONS.fan}</span>
          <div class="name-block"><div class="name">${escapeHtml(name)}</div></div>
        </div>
        <div class="controls">
          <div class="row">
            <label class="toggle">
              <input type="checkbox" data-action="toggle" ${f.on ? "checked" : ""} ${f.offline ? "disabled" : ""} aria-label="${escapeHtml(name)} power" />
              <span class="slider"></span>
            </label>
            <span class="badge">${this.size === "compact" ? f.badge.replace("ON · ", "") : f.badge}</span>
            ${more ? `<button type="button" class="color-btn" data-action="sheet-open" title="Fan settings" aria-label="${escapeHtml(name)} settings">${ICONS.tune}</button>` : ""}
          </div>
          ${f.speed ? rangeRow({ kind: "speed", action: "speed", value: f.percentage, label: "Fan speed", extraClass: "large-only", disabled: f.offline }) : ""}
        </div>
      </article>`;
    return { model, html };
  }

  sheetBody() {
    const entityId = this._config.entity;
    const f = fanView(this._hass.states[entityId]);
    const body = `
      <div class="sheet-section">
        <div class="row osc">
          <button type="button" class="btn" data-action="power" data-on="1">On</button>
          <button type="button" class="btn" data-action="power" data-on="0">Off</button>
        </div>
        ${f.speed ? rangeRow({ kind: "speed", action: "speed", value: f.percentage, label: "Fan speed", disabled: f.offline }) : ""}
      </div>
      ${f.presets.length ? `<div class="sheet-section"><div class="section-label">Preset</div><div class="btn-wrap">${f.presets.map((p) =>
        `<button type="button" class="btn secondary" data-action="preset" data-value="${escapeHtml(p)}" aria-pressed="${p === f.preset}">${escapeHtml(pretty(p))}</button>`).join("")}</div></div>` : ""}
      ${f.oscillate || f.direction ? `<div class="sheet-section"><div class="btn-wrap">
        ${f.oscillate ? `<button type="button" class="btn secondary" data-action="oscillate" aria-pressed="${f.oscillating}">Oscillate</button>` : ""}
        ${f.direction ? `<button type="button" class="btn secondary" data-action="direction" data-value="forward" aria-pressed="${f.direction === "forward"}">Forward</button>
          <button type="button" class="btn secondary" data-action="direction" data-value="reverse" aria-pressed="${f.direction === "reverse"}">Reverse</button>` : ""}
      </div></div>` : ""}`;
    return sheetFrame({
      title: this._config.name || friendlyName(this._hass, entityId),
      subtitle: f.badge,
      body,
      detailsEntity: entityId,
      favorite: this.favoriteOn,
    });
  }

  get actions() {
    const entity_id = this._config.entity;
    return {
      "change:toggle": (input) => this.callService("fan", input.checked ? "turn_on" : "turn_off", { entity_id }),
      power: (button) => this.callService("fan", button.dataset.on === "1" ? "turn_on" : "turn_off", { entity_id }),
      "input:speed": syncRange,
      "change:speed": (input) => this.callService("fan", "set_percentage", { entity_id, percentage: Number(input.value) }),
      preset: (button) => this.callService("fan", "set_preset_mode", { entity_id, preset_mode: button.dataset.value }),
      oscillate: () => this.callService("fan", "oscillate", { entity_id, oscillating: !fanView(this._hass.states[entity_id]).oscillating }),
      direction: (button) => this.callService("fan", "set_direction", { entity_id, direction: button.dataset.value }),
      "sheet-open": () => this.openSheet(),
    };
  }

  onTileClick() {
    this.openSheet();
  }
}
