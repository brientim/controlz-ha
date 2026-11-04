import { CzElement, escapeHtml } from "../base.js";
import { ICONS } from "../icons.js";
import {
  alarmView,
  domainOf,
  formatSensorValue,
  friendlyName,
  relativeTime,
  securityView,
  siblingSensor,
} from "../model.js";
import { sheetFrame } from "../sheet.js";
import { TILE_STYLES } from "../styles.js";

const MAX_CODE = 12;

/** Locks, alarm panels, garage doors, door/window contacts and smoke/CO/leak sensors. */
export class SecurityTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  get _isAlarm() {
    return domainOf(this._config.entity) === "alarm_control_panel";
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

  /** Alarm keypad sheet (ControlZ Security room arm / disarm): code entry, then a mode or Disarm. */
  sheetBody() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];
    const alarm = alarmView(stateObj);
    const sec = securityView(entityId, stateObj);
    const code = this._code || "";
    const needsCode = alarm.armed ? alarm.disarmNeedsCode : alarm.armNeedsCode;
    const entry = !alarm.codeFormat
      ? ""
      : alarm.codeFormat === "number"
        ? `<div class="code-dots" aria-label="${code.length} digits entered">${"•".repeat(code.length) || "&nbsp;"}</div>
          <div class="keypad" role="group" aria-label="Keypad">
            ${["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => `<button type="button" class="btn secondary" data-action="digit" data-digit="${d}">${d}</button>`).join("")}
            <button type="button" class="btn secondary" data-action="clear" aria-label="Clear code">C</button>
            <button type="button" class="btn secondary" data-action="digit" data-digit="0">0</button>
            <button type="button" class="btn secondary" data-action="backspace" aria-label="Delete last digit">⌫</button>
          </div>`
        : `<input type="password" class="code-input" data-action="code" autocomplete="off" placeholder="Code" value="${escapeHtml(code)}" aria-label="Alarm code" />`;
    const ready = !needsCode || code.length > 0;
    const buttons = alarm.armed
      ? `<button type="button" class="btn" data-action="alarm" data-service="alarm_disarm" ${ready ? "" : "disabled"}>Disarm</button>`
      : alarm.modes.map((m) => `<button type="button" class="btn" data-action="alarm" data-service="${m.service}" ${ready ? "" : "disabled"}>Arm ${escapeHtml(m.label)}</button>`).join("");
    const body = `
      ${entry ? `<div class="sheet-section">${entry}${needsCode ? "" : `<p class="note">No code needed to arm.</p>`}</div>` : ""}
      <div class="sheet-section"><div class="btn-wrap">${buttons || `<p class="note">This panel has no arm modes.</p>`}</div></div>
      ${this._alarmError ? `<p class="error">${escapeHtml(this._alarmError)}</p>` : ""}`;
    return sheetFrame({
      title: this._config.name || friendlyName(this._hass, entityId),
      subtitle: sec.badge,
      body,
      detailsEntity: entityId,
      favorite: this.favoriteOn,
    });
  }

  sheetClosed() {
    this._code = "";
    this._alarmError = null;
  }

  _openKeypad() {
    this._code = "";
    this._alarmError = null;
    this.openSheet();
  }

  get actions() {
    const entityId = this._config.entity;
    return {
      primary: () => {
        const sec = securityView(entityId, this._hass.states[entityId]);
        const action = sec.action;
        if (!action) return;
        if (action.keypad) {
          this._openKeypad();
          return;
        }
        const name = friendlyName(this._hass, entityId);
        if (action.confirm && !this.confirmAction(`${action.label} ${name}?`)) return;
        this.callService(action.domain, action.service, { entity_id: entityId, ...(action.data || {}) });
      },
      digit: (button) => {
        if ((this._code || "").length >= MAX_CODE) return;
        this._code = `${this._code || ""}${button.dataset.digit}`;
        this._sheet?.refresh(true);
      },
      backspace: () => {
        this._code = (this._code || "").slice(0, -1);
        this._sheet?.refresh(true);
      },
      clear: () => {
        this._code = "";
        this._sheet?.refresh(true);
      },
      "input:code": (input) => {
        this._code = input.value;
        const alarm = alarmView(this._hass.states[entityId]);
        const needsCode = alarm.armed ? alarm.disarmNeedsCode : alarm.armNeedsCode;
        for (const b of this._sheet?.shadowRoot.querySelectorAll('[data-action="alarm"]') || []) b.disabled = needsCode && !this._code;
      },
      alarm: async (button) => {
        const data = { entity_id: entityId };
        if (this._code) data.code = this._code;
        this._code = "";
        try {
          await this.callService("alarm_control_panel", button.dataset.service, data);
          this.closeSheet();
        } catch (err) {
          this._alarmError = err?.message || "The alarm panel did not accept that.";
          this._sheet?.refresh(true);
        }
      },
    };
  }

  onTileClick() {
    if (this._isAlarm) this._openKeypad();
    else this.moreInfo(this._config.entity);
  }
}
