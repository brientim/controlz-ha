import { CzElement, escapeHtml } from "../base.js";
import { ICONS } from "../icons.js";
import { climateView, formatTemp, friendlyName, stepTarget } from "../model.js";
import { sheetFrame } from "../sheet.js";
import { TILE_STYLES } from "../styles.js";

const SEND_AFTER_MS = 700;
const PENDING_MAX_MS = 4000;
const MODE_LABELS = { off: "Off", heat: "Heat", cool: "Cool", heat_cool: "Auto", auto: "Schedule", dry: "Dry", fan_only: "Fan" };
const pretty = (s) => String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const modeLabel = (s) => MODE_LABELS[s] || pretty(s);

/**
 * ControlZ thermostat tile: mode / action chip, current temperature, and a −  setpoint  + row
 * (orange while heating, blue while cooling). Presses within 0.7 s are sent as one setpoint.
 * Modes, presets, fan modes and low / high ranges live in the sheet.
 */
export class ClimateTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  get _unit() {
    return this._hass?.config?.unit_system?.temperature || "°C";
  }

  _view() {
    const c = climateView(this._hass.states[this._config.entity], this._unit);
    const pending = this._pending;
    if (pending && (Date.now() - pending.at > PENDING_MAX_MS || (pending.field === "temperature" && c.target === pending.value && !pending.timer))) {
      this._pending = null;
    }
    return c;
  }

  _shown(c, field) {
    return this._pending?.field === field ? this._pending.value : c[field === "temperature" ? "target" : field === "target_temp_low" ? "low" : "high"];
  }

  view() {
    const c = this._view();
    const name = this._config.name || friendlyName(this._hass, this._config.entity);
    const target = this._shown(c, "temperature");
    const classes = ["tile", c.heating && "heat", c.cooling && "cool", c.offline && "offline"].filter(Boolean).join(" ");
    const setpoint = c.range ? `${formatTemp(c.low)}–${formatTemp(c.high)}` : c.off ? "OFF" : formatTemp(target);
    const canStep = !c.offline && !c.range && !c.off && target != null;
    const model = { name, ...c, target, setpoint, canStep, pending: !!this._pending };
    const html = `
      <article class="${classes}">
        <div class="header">
          <span class="icon" aria-hidden="true">🌡️</span>
          <div class="name-block">
            <div class="name">${escapeHtml(name)}</div>
            <span class="badge">${c.badge}</span>
          </div>
        </div>
        <div class="temps hide-thin">
          <span class="big-value">${formatTemp(c.current)}</span>
          <span class="info hide-compact">${c.humidity != null ? `${Math.round(c.humidity)}% humidity` : "now"}</span>
        </div>
        <div class="controls"><div class="row">
          <button type="button" class="step-btn" data-action="step" data-delta="-1" ${canStep ? "" : "disabled"} aria-label="Lower ${escapeHtml(name)}">−</button>
          <span class="setpoint${model.pending ? " pending" : ""}" aria-live="polite" title="Target">${setpoint}</span>
          <button type="button" class="step-btn" data-action="step" data-delta="1" ${canStep ? "" : "disabled"} aria-label="Raise ${escapeHtml(name)}">+</button>
          <button type="button" class="color-btn hide-compact" data-action="sheet-open" title="Thermostat" aria-label="${escapeHtml(name)} settings">${ICONS.tune}</button>
        </div></div>
      </article>`;
    return { model, html };
  }

  _step(field, delta) {
    const c = this._view();
    const base = this._shown(c, field);
    const value = stepTarget(base, delta, c);
    clearTimeout(this._pending?.timer);
    const timer = setTimeout(() => {
      this._pending = { ...this._pending, timer: null, at: Date.now() };
      const data = { entity_id: this._config.entity };
      if (field === "temperature") data.temperature = value;
      else {
        data.target_temp_low = field === "target_temp_low" ? value : c.low;
        data.target_temp_high = field === "target_temp_high" ? value : c.high;
      }
      this.callService("climate", "set_temperature", data);
    }, SEND_AFTER_MS);
    this._pending = { field, value, timer, at: Date.now() };
    this.requestRender(true);
    this._sheet?.refresh(true);
  }

  sheetBody() {
    const c = this._view();
    const name = this._config.name || friendlyName(this._hass, this._config.entity);
    const stepRow = (field, title) => `
      <div class="big-row">
        <button type="button" class="step-btn" data-action="sheet-step" data-field="${field}" data-delta="-1" aria-label="Lower ${title}" ${c.offline ? "disabled" : ""}>−</button>
        <span class="setpoint${this._pending?.field === field ? " pending" : ""}">${formatTemp(this._shown(c, field), c.unit)}</span>
        <button type="button" class="step-btn" data-action="sheet-step" data-field="${field}" data-delta="1" aria-label="Raise ${title}" ${c.offline ? "disabled" : ""}>+</button>
      </div>`;
    const buttons = (action, values, current, label = pretty) => `<div class="btn-wrap">${values.map((v) =>
      `<button type="button" class="btn secondary" data-action="${action}" data-value="${escapeHtml(v)}" aria-pressed="${v === current}">${escapeHtml(label(v))}</button>`).join("")}</div>`;
    const setpoints = c.off
      ? `<p class="note">The thermostat is off. Choose a mode to set a temperature.</p>`
      : c.range
        ? `<div class="section-label">Heat to</div>${stepRow("target_temp_low", "heat to")}<div class="section-label">Cool to</div>${stepRow("target_temp_high", "cool to")}`
        : c.target != null || this._pending ? `<div class="section-label">Target</div>${stepRow("temperature", "target")}` : "";
    const body = `
      <div class="sheet-section">
        <p class="note">Now ${formatTemp(c.current, c.unit)}${c.humidity != null ? ` · ${Math.round(c.humidity)}% humidity` : ""}${c.action ? ` · ${pretty(c.action)}` : ""}</p>
        ${setpoints}
      </div>
      ${c.modes.length ? `<div class="sheet-section"><div class="section-label">Mode</div>${buttons("mode", c.modes, c.mode, modeLabel)}</div>` : ""}
      ${c.presets.length ? `<div class="sheet-section"><div class="section-label">Preset</div>${buttons("preset", c.presets, c.preset)}</div>` : ""}
      ${c.fanModes.length ? `<div class="sheet-section"><div class="section-label">Fan</div>${buttons("fan-mode", c.fanModes, c.fanMode)}</div>` : ""}`;
    return sheetFrame({ title: name, subtitle: c.badge, body, detailsEntity: this._config.entity, favorite: this.favoriteOn });
  }

  get actions() {
    const entity_id = this._config.entity;
    return {
      step: (button) => this._step("temperature", Number(button.dataset.delta)),
      "sheet-step": (button) => this._step(button.dataset.field, Number(button.dataset.delta)),
      "sheet-open": () => this.openSheet(),
      mode: (button) => this.callService("climate", "set_hvac_mode", { entity_id, hvac_mode: button.dataset.value }),
      preset: (button) => this.callService("climate", "set_preset_mode", { entity_id, preset_mode: button.dataset.value }),
      "fan-mode": (button) => this.callService("climate", "set_fan_mode", { entity_id, fan_mode: button.dataset.value }),
    };
  }

  onTileClick() {
    this.openSheet();
  }
}
