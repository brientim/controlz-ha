import { areaItems } from "./area-cache.js";
import { escapeHtml } from "./base.js";
import { areasOrder, hiddenLists, securityBannerSettings, setSecurityBanner } from "./hidden.js";
import { bannerPages } from "./house-pages.js";
import { SECURITY_BANNER_MODES, sortedAreas } from "./model.js";
import { sheetFrame } from "./sheet.js";

/** Event the View menu fires (admins) to ask the page it sits on to open these settings. */
export const SECURITY_SETTINGS_EVENT = "controlz-security-settings";

/**
 * Where the security banner shows (View → Security banner…, admins): All Rooms only, every room
 * and page, chosen rooms and pages (`page:<id>` entries), or off. Saved in the ControlZ dashboard
 * config, so it applies on every device.
 */
class SecuritySettingsSheet {
  constructor(host) {
    this._host = host;
    const current = securityBannerSettings(host._config || {});
    this._mode = current.mode;
    this._rooms = new Set(current.rooms);
    this._saving = false;
    this._error = null;
  }

  get hass() {
    return this._host.hass;
  }

  moreInfo() {}

  sheetDetailsEntity() {
    return null;
  }

  /** Rooms with devices in dashboard order; hidden rooms only when already chosen. */
  _roomList() {
    const config = this._host._config || {};
    const hidden = hiddenLists(config).areas;
    return sortedAreas(this.hass, { order: areasOrder(config) })
      .filter((a) => areaItems(this.hass, a.area_id).length > 0)
      .filter((a) => !hidden.has(a.area_id) || this._rooms.has(a.area_id));
  }

  /** Favorites, Automations and the house pages, plus any page already chosen. */
  _pageList() {
    const pages = bannerPages(this.hass, this._host._config || {});
    const known = new Set(pages.map((p) => p.id));
    const extra = [...this._rooms].filter((id) => id.startsWith("page:") && !known.has(id)).map((id) => ({ id, name: id.slice(5) }));
    return [...pages, ...extra];
  }

  sheetBody() {
    const check = (id, name) => `
      <label class="check-row"><input type="checkbox" data-action="sb-room" value="${escapeHtml(id)}" ${this._rooms.has(id) ? "checked" : ""} />
        <span>${escapeHtml(name)}</span></label>`;
    const pages = this._pageList();
    const rooms = this._mode === "rooms"
      ? `<div class="sheet-section">
          <div class="section-label">Rooms and pages that show it (${this._rooms.size})</div>
          <div class="lines-label">Rooms</div>
          <div class="check-list">${this._roomList().map((a) => check(a.area_id, a.name)).join("")}</div>
          ${pages.length ? `<div class="lines-label">Pages</div><div class="check-list">${pages.map((p) => check(p.id, p.name)).join("")}</div>` : ""}
        </div>`
      : "";
    const where = {
      all_rooms: "Shown on All Rooms only.",
      every_room: "Shown on All Rooms and at the top of every room and page (Favorites, Automations, Window Coverings, Cameras, Sensors, Weather).",
      rooms: "Shown on All Rooms and at the top of the rooms and pages you tick.",
      off: "Not shown anywhere. The sidebar's All Rooms badge still shows the security state.",
    }[this._mode];
    const body = `
      <div class="sheet-section">
        <div class="btn-wrap" role="group" aria-label="Where the security banner shows">${SECURITY_BANNER_MODES.map((m) =>
          `<button type="button" class="btn secondary" data-action="sb-mode" data-mode="${m.id}" aria-pressed="${m.id === this._mode}">${m.label}</button>`).join("")}</div>
        <p class="note">${where} Every banner shows the whole house; tap it for the list.</p>
      </div>
      ${rooms}
      ${this._error ? `<div class="sheet-section"><p class="error">${escapeHtml(this._error)}</p></div>` : ""}`;
    const footer = `
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="sb-save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save"}</button>`;
    return sheetFrame({ title: "Security banner", subtitle: "For everyone on this dashboard", body, footer });
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  async _save() {
    if (this._mode === "rooms" && !this._rooms.size) {
      this._error = "Tick at least one room or page, or choose All Rooms only.";
      this._rerender();
      return;
    }
    this._saving = true;
    this._error = null;
    this._rerender();
    try {
      await setSecurityBanner(this.hass, { mode: this._mode, rooms: [...this._rooms] });
      this._host._sheet?.close();
    } catch (err) {
      this._saving = false;
      this._error = err?.message || "Could not save the dashboard.";
      this._rerender();
    }
  }

  get actions() {
    return {
      "sb-mode": (button) => {
        this._mode = button.dataset.mode;
        this._error = null;
        this._rerender();
      },
      "change:sb-room": (input) => {
        if (input.checked) this._rooms.add(input.value);
        else this._rooms.delete(input.value);
        this._rerender();
      },
      "sb-save": () => this._save(),
    };
  }
}

/** Open the banner settings in the host's sheet (host: a ControlZ page or the sidebar app). */
export function openSecuritySettings(host) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new SecuritySettingsSheet(host));
}
