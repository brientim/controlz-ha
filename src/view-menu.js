import {
  NAVS, PREFS_EVENT, SCALE_MAX, SCALE_MIN, SCALE_STEP, SIZES,
  effectiveNav, effectiveScale, effectiveSize, readPrefs, startPage, writePrefs,
} from "./prefs.js";

const escapeAttr = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
import { openHelpSheet } from "./help.js";
import { setEditing } from "./hidden.js";
import { SECURITY_SETTINGS_EVENT } from "./security-settings.js";
import { TOKENS } from "./styles.js";
import { VERSION } from "./version.js";

const LABELS = { large: "Large", thin: "Thin", compact: "Compact", tabs: "Tabs", sidebar: "Sidebar" };

const STYLES = `
  ${TOKENS}
  :host { display: inline-block; position: relative; }
  .trigger {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; min-height: 34px;
    border-radius: 999px; border: 1px solid var(--cz-border); background: var(--cz-card-bg);
    color: var(--cz-text); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
  }
  .trigger svg { width: 16px; height: 16px; }
  .menu {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 220px;
    background: var(--cz-card-bg); color: var(--cz-text); border: 1px solid var(--cz-border);
    border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.2); padding: 10px;
    max-height: calc(100vh - 120px); max-height: calc(100dvh - 120px); overflow-y: auto;
  }
  :host([align="left"]) .menu { left: 0; right: auto; }
  .label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); margin: 4px 4px 6px; }
  .seg { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--cz-bg-secondary); margin-bottom: 10px; }
  .seg button {
    flex: 1; border: none; background: transparent; color: var(--cz-text); padding: 7px 8px; border-radius: 8px;
    font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }
  .seg button[aria-pressed="true"] { background: var(--cz-primary); color: #fff; }
  .scale-row { display: flex; align-items: center; gap: 8px; margin: 0 4px 6px; }
  .scale-row input { flex: 1; min-width: 0; accent-color: var(--cz-primary); }
  .scale-value { font-size: 0.8rem; font-weight: 700; min-width: 3rem; text-align: right; }
  .presets { display: flex; gap: 4px; margin: 0 4px 10px; }
  .presets button {
    flex: 1; border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-text);
    border-radius: 8px; padding: 4px 0; font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer;
  }
  .presets button[aria-pressed="true"] { background: var(--cz-primary); color: #fff; border-color: var(--cz-primary); }
  .edit-btn {
    width: 100%; margin: 2px 0 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--cz-border);
    background: var(--cz-bg-secondary); color: var(--cz-text); font: inherit; font-size: 0.82rem; font-weight: 600;
    cursor: pointer; text-align: left;
  }
  .reset { width: 100%; border: none; background: none; color: var(--cz-text-secondary); font: inherit; font-size: 0.78rem; padding: 6px; cursor: pointer; text-decoration: underline; }
  .note { font-size: 0.72rem; color: var(--cz-text-secondary); margin: 0 4px 6px; }
  .about {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin: 4px -10px -10px; padding: 8px 14px; border-top: 1px solid var(--cz-border);
    font-size: 0.75rem; color: var(--cz-text-secondary);
  }
  .help-btn {
    border: 1px solid var(--cz-border); background: var(--cz-bg-secondary); color: var(--cz-text); border-radius: 999px;
    padding: 4px 12px; font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer;
  }
`;

const ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>`;

/**
 * "View" menu: tile size (applies live), room navigation (reloads, because the dashboard
 * strategy picks the layout), start page, and edit mode (favorites for everyone; hide and
 * reorder for admins), the security banner placement (admins; the page it sits on opens the
 * settings), then the version and Help. Choices are stored per device; attributes give
 * the dashboard defaults.
 *   <controlz-view-menu default-size="large" default-nav="tabs" show-nav editable admin page-id="room-office" page-name="Office">
 */
export class ViewMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = false;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    this._onPrefs = () => {
      if (!this._sliding) this._render();
    };
    this.shadowRoot.addEventListener("input", (ev) => {
      if (ev.target.dataset.scaleSlider === undefined) return;
      this._sliding = true;
      this.shadowRoot.querySelector(".scale-value").textContent = `${ev.target.value}%`;
      writePrefs({ tile_scale: Number(ev.target.value) / 100 });
    });
    this.shadowRoot.addEventListener("change", (ev) => {
      if (ev.target.dataset.scaleSlider === undefined) return;
      this._sliding = false;
      this._render();
    });
    this._onOutside = (ev) => {
      if (this._open && !ev.composedPath().includes(this)) {
        this._open = false;
        this._render();
      }
    };
  }

  static get observedAttributes() {
    return ["page-id", "page-name"];
  }

  attributeChangedCallback() {
    if (this.isConnected && this._open) this._render();
  }

  connectedCallback() {
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    document.addEventListener("click", this._onOutside, true);
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    document.removeEventListener("click", this._onOutside, true);
  }

  _segment(name, values, current) {
    const label = { size: "Tile size", nav: "Rooms", scale: "Scale" }[name];
    return `<div class="seg" role="group" aria-label="${label}">${values.map((v) =>
      `<button type="button" data-${name}="${v}" aria-pressed="${v === current}">${LABELS[v]}</button>`).join("")}</div>`;
  }

  _render() {
    const size = effectiveSize(this.getAttribute("default-size"));
    const nav = effectiveNav(this.getAttribute("default-nav"));
    const scale = Math.round(effectiveScale(this.getAttribute("default-scale")) * 100);
    const prefs = readPrefs();
    const custom = ["tile_size", "room_nav", "tile_scale"].some((k) => prefs[k] != null);
    const pageId = this.getAttribute("page-id");
    const start = startPage();
    const startName = start ? prefs.start_name || start : "All Rooms";
    const here = pageId && (pageId === start || (pageId === "rooms" && !start));
    const startHtml = pageId
      ? `<div class="label">Start page</div>
        <p class="note">This device opens on <strong>${escapeAttr(startName)}</strong>.</p>
        ${here ? "" : `<button type="button" class="edit-btn" data-start>⌂ Start on ${escapeAttr(this.getAttribute("page-name") || "this page")}</button>`}
        ${start && pageId !== "rooms" && here ? `<button type="button" class="reset" data-start-clear>Start on All Rooms</button>` : ""}`
      : "";
    const admin = this.hasAttribute("admin");
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <button type="button" class="trigger" aria-haspopup="true" aria-expanded="${this._open}" data-toggle>
        ${ICON}<span>View</span>
      </button>
      ${this._open ? `<div class="menu" role="menu">
        <div class="label">Tile size</div>
        ${this._segment("size", SIZES, size)}
        <div class="label">Scale</div>
        <div class="scale-row">
          <input type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" step="${SCALE_STEP}" value="${scale}"
            data-scale-slider aria-label="Tile scale percent" />
          <span class="scale-value">${scale}%</span>
        </div>
        <div class="presets" role="group" aria-label="Scale presets">${[50, 60, 80, 100].map((p) =>
          `<button type="button" data-scale="${p / 100}" aria-pressed="${p === scale}">${p}%</button>`).join("")}</div>
        ${this.hasAttribute("show-nav") ? `<div class="label">Rooms</div>${this._segment("nav", NAVS, nav)}` : ""}
        <p class="note">Saved on this device only.</p>
        ${custom ? `<button type="button" class="reset" data-reset>Use dashboard defaults</button>` : ""}
        ${startHtml}
        ${this.hasAttribute("editable") ? `<button type="button" class="edit-btn" data-edit>${admin ? "♥ 👁 Edit rooms &amp; favorites…" : "♥ Edit favorites…"}</button>` : ""}
        ${this.hasAttribute("editable") && admin ? `<button type="button" class="edit-btn" data-security>🛡 Security banner…</button>` : ""}
        <div class="about"><span>ControlZ HA ${escapeAttr(VERSION)}</span><button type="button" class="help-btn" data-help>? Help</button></div>
      </div>` : ""}`;
  }

  _onClick(ev) {
    const target = ev.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-toggle")) {
      this._open = !this._open;
      this._render();
      return;
    }
    if (target.hasAttribute("data-edit")) {
      this._open = false;
      this._render();
      setEditing(true);
      return;
    }
    if (target.hasAttribute("data-security")) {
      this._open = false;
      this._render();
      this.dispatchEvent(new CustomEvent(SECURITY_SETTINGS_EVENT, { bubbles: true, composed: true }));
      return;
    }
    if (target.hasAttribute("data-help")) {
      this._open = false;
      this._render();
      openHelpSheet(this);
      return;
    }
    const navBefore = effectiveNav(this.getAttribute("default-nav"));
    if (target.dataset.size) writePrefs({ tile_size: target.dataset.size });
    if (target.dataset.scale) writePrefs({ tile_scale: Number(target.dataset.scale) });
    if (target.dataset.nav) writePrefs({ room_nav: target.dataset.nav });
    if (target.hasAttribute("data-reset")) writePrefs({ tile_size: null, room_nav: null, tile_scale: null });
    if (target.hasAttribute("data-start")) {
      const id = this.getAttribute("page-id");
      writePrefs(id === "rooms" ? { start_page: null, start_name: null } : { start_page: id, start_name: this.getAttribute("page-name") });
    }
    if (target.hasAttribute("data-start-clear")) writePrefs({ start_page: null, start_name: null });
    if (effectiveNav(this.getAttribute("default-nav")) !== navBefore) {
      location.reload();
    }
  }
}
