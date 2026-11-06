import { CzElement, escapeHtml } from "../base.js";
import { openEntityHistory } from "../history.js";
import { ICONS, SENSOR_EMOJI } from "../icons.js";
import {
  domainOf,
  formatSensorValue,
  friendlyName,
  isOn,
  isUnavailable,
  relativeTime,
  sensorBadge,
  siblingSensor,
} from "../model.js";
import { TILE_STYLES } from "../styles.js";

const TICK_MS = 30_000;

/**
 * Motion sensors (MOTION / CLEAR, red when active, temperature from the same device)
 * and numeric sensors (temperature, humidity, lux, …). Tap for the sensor's history chart.
 */
export class SensorTile extends CzElement {
  connectedCallback() {
    super.connectedCallback();
    this._tick = setInterval(() => this.requestRender(), TICK_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._tick);
  }

  styles() {
    return TILE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const name = this._config.name || friendlyName(this._hass, entityId);
    const offline = isUnavailable(stateObj);
    const ago = relativeTime(stateObj?.last_changed);
    return domainOf(entityId) === "binary_sensor"
      ? this._motionView(entityId, stateObj, name, offline, ago)
      : this._numericView(stateObj, name, offline, ago);
  }

  _motionView(entityId, stateObj, name, offline, ago) {
    const tempId = siblingSensor(this._hass, entityId, "temperature");
    const model = {
      name,
      offline,
      active: isOn(stateObj),
      ago,
      temp: tempId ? formatSensorValue(this._hass.states[tempId]) : null,
    };
    const classes = ["tile", model.active && "motion-active", offline && "offline"].filter(Boolean).join(" ");
    const html = `
      <article class="${classes}">
        <div class="header">
          <span class="icon">${model.active ? ICONS.walk : ICONS.stand}</span>
          <div class="name-block">
            <div class="name">${escapeHtml(name)}</div>
            <span class="badge">${offline ? "OFFLINE" : model.active ? "MOTION" : "CLEAR"}</span>
          </div>
        </div>
        <div class="info bottom">
          ${model.temp ? `<div class="hide-thin" style="font-weight:600">${model.temp}</div>` : ""}
          <div class="ago${model.active && ago === "Now" ? " fresh" : ""}">${ago}</div>
        </div>
      </article>`;
    return { model, html };
  }

  _numericView(stateObj, name, offline, ago) {
    const dc = stateObj?.attributes?.device_class;
    const model = { name, offline, value: formatSensorValue(stateObj), badge: sensorBadge(stateObj), ago };
    const html = `
      <article class="tile${offline ? " offline" : ""}">
        <div class="header">
          <span class="icon" aria-hidden="true">${SENSOR_EMOJI[dc] || "📈"}</span>
          <div class="name-block">
            <div class="name">${escapeHtml(name)}</div>
            <span class="badge hide-thin">${model.badge}</span>
          </div>
        </div>
        <div class="info bottom">
          <div class="big-value">${model.value}</div>
          <div class="ago hide-thin">${ago}</div>
        </div>
      </article>`;
    return { model, html };
  }

  onTileClick() {
    openEntityHistory(this, this._config.entity);
  }
}
