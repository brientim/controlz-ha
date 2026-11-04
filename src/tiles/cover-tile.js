import { CzElement, escapeHtml } from "../base.js";
import { rangeRow, syncRange } from "../controls.js";
import {
  coverPosition,
  coverSupportsPosition,
  friendlyName,
  isUnavailable,
} from "../model.js";
import { TILE_STYLES } from "../styles.js";

export function oscRow(action = "osc", trailing = "") {
  return `<div class="row osc">
    <button type="button" class="btn" data-action="${action}" data-service="open_cover">Open</button>
    <button type="button" class="btn" data-action="${action}" data-service="stop_cover">Stop</button>
    <button type="button" class="btn" data-action="${action}" data-service="close_cover">Close</button>
    ${trailing}
  </div>`;
}

export function positionRow(position, action = "position") {
  return rangeRow({ kind: "position", action, value: position, label: "Position (100 is open)", extraClass: "large-only" });
}

/** Window covering tile: Open / Stop / Close; Large adds the position slider (HA: 100 = open). */
export class CoverTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const position = coverPosition(stateObj);
    const offline = isUnavailable(stateObj);
    const moving = stateObj?.state === "opening" || stateObj?.state === "closing";
    const model = {
      name: this._config.name || friendlyName(this._hass, entityId),
      offline,
      badge: offline
        ? "OFFLINE"
        : moving
          ? stateObj.state.toUpperCase()
          : position == null
            ? String(stateObj.state).toUpperCase()
            : `${position}%${this.size === "compact" ? "" : " open"}`,
      position: position ?? 0,
      positionable: coverSupportsPosition(stateObj),
    };
    const html = `
      <article class="tile${offline ? " offline" : ""}">
        <div class="header">
          <span class="icon" aria-hidden="true">🪟</span>
          <div class="name-block">
            <div class="name">${escapeHtml(model.name)}</div>
            <span class="badge">${model.badge}</span>
          </div>
        </div>
        <div class="controls">
          ${model.positionable ? positionRow(model.position) : ""}
          ${oscRow()}
        </div>
      </article>`;
    return { model, html };
  }

  get actions() {
    const entityId = this._config.entity;
    return {
      osc: (button) => this.callService("cover", button.dataset.service, { entity_id: entityId }),
      "input:position": syncRange,
      "change:position": (input) =>
        this.callService("cover", "set_cover_position", { entity_id: entityId, position: Number(input.value) }),
    };
  }

  onTileClick() {
    this.moreInfo(this._config.entity);
  }
}
