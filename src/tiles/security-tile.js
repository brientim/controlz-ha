import { CzElement, escapeHtml } from "../base.js";
import { ICONS } from "../icons.js";
import {
  formatSensorValue,
  friendlyName,
  relativeTime,
  securityView,
  siblingSensor,
} from "../model.js";
import { TILE_STYLES } from "../styles.js";

/** Locks, alarm panels, garage doors, door/window contacts and smoke/CO/leak sensors. */
export class SecurityTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  view() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const sec = securityView(entityId, stateObj);
    const batteryId = siblingSensor(this._hass, entityId, "battery");
    const model = {
      name: this._config.name || friendlyName(this._hass, entityId),
      ...sec,
      battery: batteryId ? formatSensorValue(this._hass.states[batteryId]) : null,
      ago: relativeTime(stateObj?.last_changed),
    };
    const classes = ["tile", sec.insecure && "insecure", sec.offline && "offline"].filter(Boolean).join(" ");
    const badgeClass = sec.insecure ? "badge warn" : sec.secure ? "badge secure" : "badge";
    const action = sec.action
      ? `<button type="button" class="btn" data-action="primary" ${sec.offline ? "disabled" : ""}>${sec.action.label}</button>`
      : "";
    const info = [model.battery && `🔋 ${model.battery}`, model.ago].filter(Boolean).join(" · ");
    const html = `
      <article class="${classes}">
        <div class="header">
          <span class="icon">${ICONS[sec.icon] || ICONS.shield}</span>
          <div class="name-block">
            <div class="name">${escapeHtml(model.name)}</div>
            <span class="${badgeClass}">${sec.badge}</span>
          </div>
        </div>
        <div class="info hide-thin">${info}</div>
        ${action ? `<div class="controls"><div class="row">${action}</div></div>` : ""}
      </article>`;
    return { model, html };
  }

  get actions() {
    const entityId = this._config.entity;
    return {
      primary: () => {
        const sec = securityView(entityId, this._hass.states[entityId]);
        const action = sec.action;
        if (!action) return;
        if (action.moreInfo) {
          this.moreInfo(entityId);
          return;
        }
        const name = friendlyName(this._hass, entityId);
        if (action.confirm && !this.confirmAction(`${action.label} ${name}?`)) return;
        this.callService(action.domain, action.service, { entity_id: entityId, ...(action.data || {}) });
      },
    };
  }

  onTileClick() {
    this.moreInfo(this._config.entity);
  }
}
