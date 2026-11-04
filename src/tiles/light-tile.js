import { CzElement, escapeHtml } from "../base.js";
import { rangeRow, syncRange } from "../controls.js";
import { ICONS } from "../icons.js";
import {
  brightnessPct,
  domainOf,
  followColor,
  followGradient,
  friendlyName,
  isOn,
  isUnavailable,
  lightBadge,
  lightCapabilities,
} from "../model.js";
import { TILE_STYLES } from "../styles.js";

/** Light, wall switch and outlet tile: toggle + status chip + colour icon; Large adds the dimmer. */
export class LightTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const domain = domainOf(entityId);
    const caps = domain === "light" ? lightCapabilities(stateObj) : { color: false, ct: false, dimmable: false };
    const model = {
      name: this._config.name || friendlyName(this._hass, entityId),
      on: isOn(stateObj),
      offline: isUnavailable(stateObj),
      badge: this.size === "compact" ? lightBadge(stateObj).replace("ON · ", "") : lightBadge(stateObj),
      bri: brightnessPct(stateObj) ?? 0,
      caps,
      rgb: followColor(stateObj),
      icon: domain === "switch" ? (stateObj?.attributes?.device_class === "outlet" ? "🔌" : "🎚️") : "💡",
    };
    const classes = ["tile", model.on && "on", model.rgb && "follows", model.offline && "offline"].filter(Boolean).join(" ");
    const style = model.rgb ? ` style="--follow-bg:${followGradient(model.rgb)}"` : "";
    const colorBtn = model.caps.color || model.caps.ct
      ? `<button type="button" class="color-btn" data-action="color" title="Colour" aria-label="Colour and temperature">${ICONS.color}</button>`
      : "";
    const dimmer = model.caps.dimmable
      ? rangeRow({ kind: "brightness", action: "bri", value: model.bri, label: "Brightness", extraClass: "large-only", disabled: model.offline })
      : "";
    const html = `
      <article class="${classes}"${style}>
        <div class="header">
          <span class="icon" aria-hidden="true">${model.icon}</span>
          <div class="name-block"><div class="name">${escapeHtml(model.name)}</div></div>
        </div>
        <div class="controls">
          <div class="row">
            <label class="toggle">
              <input type="checkbox" data-action="toggle" ${model.on ? "checked" : ""} ${model.offline ? "disabled" : ""}
                aria-label="${escapeHtml(model.name)} power" />
              <span class="slider"></span>
            </label>
            <span class="badge">${model.badge}</span>
            ${colorBtn}
          </div>
          ${dimmer}
        </div>
      </article>`;
    return { model, html };
  }

  get actions() {
    const entityId = this._config.entity;
    const domain = domainOf(entityId);
    return {
      "change:toggle": (input) =>
        this.callService(domain, input.checked ? "turn_on" : "turn_off", { entity_id: entityId }),
      "input:bri": syncRange,
      "change:bri": (input) =>
        this.callService("light", "turn_on", { entity_id: entityId, brightness_pct: Number(input.value) }),
      color: () => this.moreInfo(entityId),
    };
  }

  onTileClick() {
    this.moreInfo(this._config.entity);
  }
}
