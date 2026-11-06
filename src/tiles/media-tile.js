import { openAnnounce } from "../announce.js";
import { CzElement, escapeHtml } from "../base.js";
import { rangeRow, syncRange } from "../controls.js";
import { ICONS } from "../icons.js";
import { friendlyName, mediaView } from "../model.js";
import { sheetFrame } from "../sheet.js";
import { TILE_STYLES } from "../styles.js";

/**
 * Media player tile (ControlZ Sonos player): what is playing, previous / play-pause / next, and a
 * volume slider on Large (violet, so it never looks like brightness, position or fan speed).
 * The sheet adds mute, source, power and Announce.
 */
export class MediaTile extends CzElement {
  styles() {
    return TILE_STYLES;
  }

  _model() {
    const entityId = this._config.entity;
    return { name: this._config.name || friendlyName(this._hass, entityId), ...mediaView(this._hass.states[entityId]) };
  }

  _transport(m) {
    const btn = (action, icon, label, show, cls = "") => (show
      ? `<button type="button" class="step-btn${cls}" data-action="${action}" aria-label="${label} ${escapeHtml(m.name)}" title="${label}">${icon}</button>`
      : "");
    return `${btn("previous", ICONS.previous, "Previous", m.previous, " hide-compact")}
      ${btn("play-pause", m.playing ? ICONS.pause : ICONS.play, m.playing ? "Pause" : "Play", m.playPause)}
      ${btn("next", ICONS.next, "Next", m.next, " hide-compact")}`;
  }

  view() {
    const m = this._model();
    const playing = m.title ? `<div class="now-playing hide-thin">${escapeHtml(m.title)}${m.artist ? ` <span class="artist">· ${escapeHtml(m.artist)}</span>` : ""}</div>` : "";
    const html = `
      <article class="tile${m.playing ? " media-on" : ""}${m.offline ? " offline" : ""}">
        <div class="header">
          <span class="icon" aria-hidden="true">${m.speaker ? "🔊" : "📺"}</span>
          <div class="name-block">
            <div class="name">${escapeHtml(m.name)}</div>
            <span class="badge">${m.badge}</span>
          </div>
        </div>
        ${playing}
        <div class="controls">
          <div class="row transport">${this._transport(m)}
            <button type="button" class="color-btn" data-action="sheet-open" title="Player controls" aria-label="${escapeHtml(m.name)} controls">${ICONS.tune}</button>
          </div>
          ${m.volumeSet ? rangeRow({ kind: "volume", action: "volume", value: m.volume, label: "Volume", extraClass: "large-only" }) : ""}
        </div>
      </article>`;
    return { model: m, html };
  }

  sheetBody() {
    const m = this._model();
    const entityId = this._config.entity;
    const body = `
      ${m.title ? `<div class="sheet-section"><div class="now-playing">${escapeHtml(m.title)}${m.artist ? ` <span class="artist">· ${escapeHtml(m.artist)}</span>` : ""}</div></div>` : ""}
      <div class="sheet-section">
        ${m.playPause || m.previous || m.next ? `<div class="row transport">${this._transport(m)}</div>` : ""}
        ${m.volumeSet ? rangeRow({ kind: "volume", action: "volume", value: m.volume, label: "Volume" }) : ""}
        <div class="btn-wrap">
          ${m.mute ? `<button type="button" class="btn secondary" data-action="mute" aria-pressed="${m.muted}">${m.muted ? "Unmute" : "Mute"}</button>` : ""}
          ${m.power ? `<button type="button" class="btn secondary" data-action="power">${m.off ? "Turn on" : "Turn off"}</button>` : ""}
        </div>
        ${m.sources.length ? `<label class="field"><span>Source</span><select data-action="source" aria-label="Source">
          ${m.source && !m.sources.includes(m.source) ? `<option selected>${escapeHtml(m.source)}</option>` : ""}
          ${m.sources.map((s) => `<option value="${escapeHtml(s)}" ${s === m.source ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>` : ""}
      </div>
      <div class="sheet-section"><div class="btn-wrap">
        <button type="button" class="btn secondary" data-action="announce">📢 Announce on ${escapeHtml(m.name)}</button>
      </div></div>`;
    return sheetFrame({ title: m.name, subtitle: m.badge, body, detailsEntity: entityId, favorite: this.favoriteOn });
  }

  get actions() {
    const entityId = this._config.entity;
    const call = (service, data = {}) => this.callService("media_player", service, { entity_id: entityId, ...data });
    return {
      "play-pause": () => call("media_play_pause"),
      previous: () => call("media_previous_track"),
      next: () => call("media_next_track"),
      "input:volume": syncRange,
      "change:volume": (input) => call("volume_set", { volume_level: Number(input.value) / 100 }),
      mute: () => call("volume_mute", { is_volume_muted: !this._model().muted }),
      power: () => call(this._model().off ? "turn_on" : "turn_off"),
      "change:source": (select) => call("select_source", { source: select.value }),
      "sheet-open": () => this.openSheet(),
      announce: () => openAnnounce(this, [entityId]),
    };
  }

  onTileClick() {
    this.openSheet();
  }
}
