import { areaItems } from "./area-cache.js";
import { CzElement, escapeHtml, fireEvent, navigate } from "./base.js";
import { rangeRow, syncRange } from "./controls.js";
import { ICONS } from "./icons.js";
import { followGradient, roomSummary } from "./model.js";
import { resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { coverControls, lightControls, sheetFrame } from "./sheet.js";
import { TILE_STYLES } from "./styles.js";
import { oscRow } from "./tiles/cover-tile.js";

/**
 * ControlZ room master tile for a Home Assistant area.
 * Badges: green = lights on (illumination only), orange = outlets on, blue = coverings open.
 *
 * Tiles keep the fixed ControlZ heights; per size the face shows what fits:
 *   Large   — brightness + power row, covering position + Open/Stop/Close (mixed rooms stack both)
 *   Thin    — one row: power (or Open/Stop/Close for covering-only rooms)
 *   Compact — power row, plus Open/Stop/Close for mixed rooms; chips sit under the name
 * Everything else lives in the room controls sheet (controls button, or tap the tile inside a room view).
 */
export class RoomCard extends CzElement {
  static getStubConfig(hass) {
    const area = Object.keys(hass?.areas || {})[0] || "living_room";
    return { area };
  }

  normalizeConfig(config) {
    if (!config.area) throw new Error("controlz-room-card: `area` (area_id) is required");
    return { ...config };
  }

  styles() {
    return TILE_STYLES;
  }

  _summary() {
    return roomSummary(this._hass, areaItems(this._hass, this._config.area));
  }

  view() {
    const model = this._model();
    return { model, html: this._html(model) };
  }

  _model() {
    const area = this._hass.areas?.[this._config.area];
    const s = this._summary();
    const hasLights = s.lights.length > 0;
    const hasCovers = s.covers.length > 0;
    const on = s.lightsOn > 0;
    const compact = this.size === "compact";
    const { icon } = resolveAreaIcon(this._hass, this._config.area, this._config, { coverOnly: !hasLights && hasCovers });
    const model = {
      name: this._config.name || area?.name || this._config.area,
      icon: icon.mdi,
      iconSvg: roomIconSvg(icon),
      on,
      mixed: hasLights && hasCovers,
      coverOnly: !hasLights && hasCovers,
      hasLights,
      hasCovers,
      follow: on && s.followColor ? followGradient(s.followColor) : null,
      lightStatus: !on ? "OFF" : s.avgBrightness == null ? "ON" : compact ? `${s.avgBrightness}%` : `ON · ${s.avgBrightness}%`,
      coverStatus: s.avgCoverPosition != null
        ? `${s.avgCoverPosition}%${compact ? "" : " open"}`
        : `${s.coversOpen}/${s.covers.length}${compact ? "" : " open"}`,
      lightsOn: s.lightsOn,
      allLightsOn: s.allLightsOn,
      outletsOn: s.outletsOn,
      coversOpen: s.coversOpen,
      brightness: s.avgBrightness ?? 0,
      coverPosition: s.avgCoverPosition ?? 0,
      dimmable: s.dimmableLights.length > 0,
      colorable: s.colorLights.length > 0,
      ctable: s.ctLights.length > 0,
      positionable: s.positionableCovers.length > 0,
      navigable: !!this._config.navigation_path || !!this._config.select_area,
    };
    return model;
  }

  _chips(m, placement) {
    const chips = [];
    if (m.lightsOn > 0)
      chips.push(`<span class="chip green" title="Lights on">${ICONS.bulb}${m.allLightsOn ? ICONS.check : m.lightsOn}</span>`);
    if (m.outletsOn > 0) chips.push(`<span class="chip orange" title="Outlets on">${ICONS.outlet}${m.outletsOn}</span>`);
    if (m.hasCovers && m.coversOpen > 0)
      chips.push(`<span class="chip blue" title="Coverings open">${ICONS.blinds}${m.coversOpen}</span>`);
    return chips.length ? `<span class="chips ${placement}">${chips.join("")}</span>` : "";
  }

  _sheetButton(m) {
    const icon = m.colorable || m.ctable ? ICONS.color : ICONS.tune;
    return `<button type="button" class="color-btn" data-action="sheet-open" title="Room controls"
      aria-label="${escapeHtml(m.name)} controls">${icon}</button>`;
  }

  _slider(action, value, label) {
    return rangeRow({ kind: action === "bri" ? "brightness" : "position", action, value, label });
  }

  _powerRow(m, withSheetButton) {
    return `<div class="row">
      <label class="toggle">
        <input type="checkbox" data-action="toggle" ${m.on ? "checked" : ""} aria-label="${escapeHtml(m.name)} lights" />
        <span class="slider"></span>
      </label>
      <span class="badge">${m.lightStatus}</span>
      ${withSheetButton ? this._sheetButton(m) : ""}
    </div>`;
  }

  _coverStatusRow(m) {
    return `<div class="row">
      <span class="badge">${m.coverStatus}</span>
      ${this._sheetButton(m)}
    </div>`;
  }

  _controls(m) {
    const rows = [];
    if (this.size === "large") {
      if (m.hasLights) {
        if (m.dimmable) rows.push(this._slider("bri", m.brightness, "Room brightness"));
        rows.push(this._powerRow(m, true));
      }
      if (m.mixed) rows.push(`<div class="divider"></div>`);
      if (m.hasCovers) {
        if (m.positionable) rows.push(this._slider("cover-position", m.coverPosition, "Coverings position (100 is open)"));
        else if (m.coverOnly) rows.push(this._coverStatusRow(m));
        rows.push(oscRow("cover-osc"));
      }
    } else if (this.size === "thin") {
      rows.push(m.hasLights ? this._powerRow(m, true) : m.hasCovers ? oscRow("cover-osc", this._sheetButton(m)) : "");
    } else {
      if (m.hasLights) rows.push(this._powerRow(m, true));
      else if (m.hasCovers) rows.push(this._coverStatusRow(m));
      if (m.hasCovers) rows.push(oscRow("cover-osc"));
    }
    return rows.length ? `<div class="controls">${rows.join("")}</div>` : "";
  }

  sheetBody() {
    const m = this._model();
    const body = [
      m.hasLights && lightControls({ label: "Lights", dimmable: m.dimmable, brightness: m.brightness, ct: m.ctable, color: m.colorable }),
      m.hasCovers && coverControls({ label: `Coverings · ${m.coverStatus}`, positionable: m.positionable, position: m.coverPosition }),
    ].filter(Boolean).join("");
    return sheetFrame({ title: m.name, subtitle: m.hasLights ? `Lights ${m.lightStatus}` : "", body });
  }

  sheetDetailsEntity() {
    return null;
  }

  _html(m) {
    const classes = ["tile", m.on && "on", m.follow && "follows"].filter(Boolean).join(" ");
    const style = m.follow ? ` style="--follow-bg:${m.follow}"` : "";
    const compact = this.size === "compact";
    return `
      <article class="${classes}"${style} ${m.navigable ? `role="link" tabindex="0" aria-label="Open ${escapeHtml(m.name)}"` : ""}>
        <div class="header">
          <span class="icon room-icon" aria-hidden="true">${m.iconSvg}</span>
          <div class="name-block">
            <div class="name">${escapeHtml(m.name)}</div>
            ${compact ? this._chips(m, "under") : ""}
          </div>
          ${compact ? "" : this._chips(m, "trailing")}
        </div>
        ${this._controls(m)}
      </article>`;
  }

  get actions() {
    const s = () => this._summary();
    return {
      "change:toggle": (input) => {
        const ids = s().lights;
        if (ids.length) this.callService("light", input.checked ? "turn_on" : "turn_off", { entity_id: ids });
      },
      power: (button) => {
        const ids = s().lights;
        if (ids.length) this.callService("light", button.dataset.on === "1" ? "turn_on" : "turn_off", { entity_id: ids });
      },
      "input:bri": syncRange,
      "change:bri": (input) => {
        const ids = s().dimmableLights;
        if (ids.length) this.callService("light", "turn_on", { entity_id: ids, brightness_pct: Number(input.value) });
      },
      "sheet-open": () => this.openSheet(),
      ct: (button) => {
        const ids = s().ctLights;
        if (ids.length) this.callService("light", "turn_on", { entity_id: ids, color_temp_kelvin: Number(button.dataset.kelvin) });
      },
      swatch: (button) => {
        const ids = s().colorLights;
        if (ids.length) this.callService("light", "turn_on", { entity_id: ids, rgb_color: button.dataset.rgb.split(",").map(Number) });
      },
      "cover-osc": (button) => {
        const ids = s().covers;
        if (ids.length) this.callService("cover", button.dataset.service, { entity_id: ids });
      },
      "input:cover-position": syncRange,
      "change:cover-position": (input) => {
        const ids = s().positionableCovers;
        if (ids.length) this.callService("cover", "set_cover_position", { entity_id: ids, position: Number(input.value) });
      },
    };
  }

  onTileClick() {
    if (this._config.select_area) fireEvent(this, "controlz-select-area", { area: this._config.area });
    else if (this._config.navigation_path) navigate(this._config.navigation_path);
    else this.openSheet();
  }
}
