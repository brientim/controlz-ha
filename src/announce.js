import { escapeHtml } from "./base.js";
import { areasOrder, hiddenLists } from "./hidden.js";
import { areaOfEntity, domainOf, friendlyName, isUnavailable, sortedAreas } from "./model.js";
import { readPrefs, writePrefs } from "./prefs.js";
import { sheetFrame } from "./sheet.js";

const MAX_PHRASES = 20;

/** Saved phrases on this device (ControlZ Sonos / AirPlay phrase library). */
export const savedPhrases = () => (Array.isArray(readPrefs().phrases) ? readPrefs().phrases.filter((p) => typeof p === "string") : []);

export function savePhrase(text) {
  const phrase = String(text || "").trim();
  if (!phrase) return savedPhrases();
  const next = [phrase, ...savedPhrases().filter((p) => p !== phrase)].slice(0, MAX_PHRASES);
  writePrefs({ phrases: next });
  return next;
}

export function forgetPhrase(text) {
  const next = savedPhrases().filter((p) => p !== text);
  writePrefs({ phrases: next.length ? next : null });
  return next;
}

/** Text-to-speech voices (`tts.*` entities). */
export const voices = (hass) => Object.keys(hass?.states || {}).filter((id) => domainOf(id) === "tts").sort();

/**
 * Announce (ControlZ AirPlay / Sonos text to speech): pick speakers, type or pick a saved phrase,
 * and Home Assistant speaks it with `tts.speak`.
 */
class AnnounceSheet {
  constructor(host, players) {
    this._host = host;
    this._players = new Set(players);
    this._message = "";
    this._voice = voices(host.hass).includes(readPrefs().tts_voice) ? readPrefs().tts_voice : voices(host.hass)[0] || "";
    this._status = "";
    this._busy = false;
  }

  get hass() {
    return this._host.hass;
  }

  moreInfo() {}

  sheetDetailsEntity() {
    return null;
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  /** Media players by room in dashboard order, then the rest; hidden ones left out. */
  _speakers() {
    const config = this._host._config || {};
    const hidden = hiddenLists(config);
    const ids = Object.keys(this.hass.states).filter((id) => domainOf(id) === "media_player" && !hidden.entities.has(id));
    const rank = new Map(sortedAreas(this.hass, { order: areasOrder(config) }).map((a, i) => [a.area_id, i]));
    return ids
      .map((id) => ({ id, name: friendlyName(this.hass, id), area: areaOfEntity(this.hass, id), offline: isUnavailable(this.hass.states[id]) }))
      .sort((a, b) => (rank.get(a.area) ?? 1e9) - (rank.get(b.area) ?? 1e9) || a.name.localeCompare(b.name));
  }

  sheetBody() {
    const speakers = this._speakers();
    const allVoices = voices(this.hass);
    const phrases = savedPhrases();
    const room = (id) => (id ? this.hass.areas?.[id]?.name || id : "");
    const body = `
      <div class="sheet-section">
        <div class="section-label">Speakers</div>
        <div class="check-list">${speakers.map((s) => `
          <label class="check-row"><input type="checkbox" data-action="an-player" value="${escapeHtml(s.id)}" ${this._players.has(s.id) ? "checked" : ""} ${s.offline ? "disabled" : ""} />
            <span>${escapeHtml(s.name)}${s.area ? ` <span class="note">· ${escapeHtml(room(s.area))}</span>` : ""}</span></label>`).join("")}</div>
        ${allVoices.length > 1 ? `<label class="field"><span>Voice</span><select data-action="an-voice" aria-label="Voice">
          ${allVoices.map((v) => `<option value="${escapeHtml(v)}" ${v === this._voice ? "selected" : ""}>${escapeHtml(friendlyName(this.hass, v))}</option>`).join("")}</select></label>` : ""}
      </div>
      <div class="sheet-section">
        <label class="field"><span>Say</span>
          <input type="text" data-action="an-message" value="${escapeHtml(this._message)}" placeholder="Dinner is ready" autofocus /></label>
        ${phrases.length ? `<div class="lines-label">Saved phrases</div><div class="btn-wrap">${phrases.map((p, i) => `
          <span class="phrase"><button type="button" class="btn secondary" data-action="an-phrase" data-index="${i}">${escapeHtml(p)}</button><button
            type="button" class="phrase-x" data-action="an-forget" data-index="${i}" aria-label="Forget ${escapeHtml(p)}">✕</button></span>`).join("")}</div>` : ""}
        <button type="button" class="btn ghost" data-action="an-save">☆ Save this phrase</button>
        ${allVoices.length ? "" : `<p class="error">Home Assistant has no text-to-speech voice. Add one under Settings → Voice assistants.</p>`}
        ${this._status ? `<p class="note" role="status">${escapeHtml(this._status)}</p>` : ""}
      </div>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="sheet-close">Close</button>
      <button type="button" class="btn" data-action="an-speak" ${this._busy || !allVoices.length ? "disabled" : ""}>📢 Announce</button>`;
    return sheetFrame({ title: "Announce", subtitle: "Speak a message on your speakers", body, footer });
  }

  _messageNow() {
    return this._host._sheet?.shadowRoot?.querySelector("[data-action=an-message]")?.value ?? this._message;
  }

  async _speak() {
    this._message = this._messageNow();
    const players = [...this._players].filter((id) => this.hass.states[id]);
    if (!String(this._message).trim()) this._status = "Type what to say.";
    else if (!players.length) this._status = "Tick at least one speaker.";
    else {
      this._busy = true;
      this._status = "Speaking…";
      this._rerender();
      try {
        await this.hass.callService("tts", "speak", { entity_id: this._voice, media_player_entity_id: players, message: this._message.trim() });
        this._status = `Said on ${players.length} speaker${players.length === 1 ? "" : "s"}.`;
      } catch (err) {
        this._status = err?.message || "Home Assistant could not speak that.";
      }
      this._busy = false;
    }
    this._rerender();
  }

  get actions() {
    return {
      "change:an-player": (input) => {
        if (input.checked) this._players.add(input.value);
        else this._players.delete(input.value);
      },
      "change:an-voice": (select) => {
        this._voice = select.value;
        writePrefs({ tts_voice: select.value });
      },
      "input:an-message": (input) => {
        this._message = input.value;
      },
      "an-phrase": (button) => {
        this._message = savedPhrases()[Number(button.dataset.index)] || "";
        this._status = "";
        this._rerender();
      },
      "an-forget": (button) => {
        forgetPhrase(savedPhrases()[Number(button.dataset.index)]);
        this._rerender();
      },
      "an-save": () => {
        this._message = this._messageNow();
        if (!this._message.trim()) return;
        savePhrase(this._message);
        this._status = "Saved on this device.";
        this._rerender();
      },
      "an-speak": () => this._speak(),
    };
  }
}

/** Open Announce in the host's sheet, with `players` ticked. */
export function openAnnounce(host, players = []) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new AnnounceSheet(host, players));
}
