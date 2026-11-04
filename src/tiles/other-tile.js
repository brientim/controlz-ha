import { CzElement, escapeHtml } from "../base.js";
import { domainOf, friendlyName, isOn, isUnavailable } from "../model.js";
import { TILE_STYLES } from "../styles.js";

const EMOJI = {
  fan: "🌀",
  climate: "🌡️",
  media_player: "📺",
  humidifier: "💨",
  vacuum: "🧹",
  valve: "🚰",
  water_heater: "♨️",
};
const TOGGLEABLE = new Set(["fan", "humidifier"]);

/** Fallback for fans, climate, media players, etc.: state chip, optional toggle, tap for more-info. */
export class OtherTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const domain = domainOf(entityId);
    const offline = isUnavailable(stateObj);
    const active = !offline && !["off", "idle", "standby", "closed", "docked"].includes(stateObj?.state);
    const model = {
      name: this._config.name || friendlyName(this._hass, entityId),
      state: offline ? "OFFLINE" : String(stateObj.state).replace(/_/g, " "),
      active,
      offline,
      toggle: TOGGLEABLE.has(domain),
      on: isOn(stateObj),
    };
    const toggle = model.toggle
      ? `<label class="toggle"><input type="checkbox" data-action="toggle" ${model.on ? "checked" : ""} ${offline ? "disabled" : ""}
          aria-label="${escapeHtml(model.name)} power" /><span class="slider"></span></label>`
      : "";
    const html = `
      <article class="tile${active && model.toggle ? " on" : ""}${offline ? " offline" : ""}">
        <div class="header">
          <span class="icon" aria-hidden="true">${EMOJI[domain] || "🔘"}</span>
          <div class="name-block"><div class="name">${escapeHtml(model.name)}</div></div>
        </div>
        <div class="controls"><div class="row">${toggle}<span class="badge">${escapeHtml(model.state)}</span></div></div>
      </article>`;
    return { model, html };
  }

  get actions() {
    const entityId = this._config.entity;
    return {
      "change:toggle": (input) =>
        this.callService(domainOf(entityId), input.checked ? "turn_on" : "turn_off", { entity_id: entityId }),
    };
  }

  onTileClick() {
    this.moreInfo(this._config.entity);
  }
}
