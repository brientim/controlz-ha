import { NAVS, PREFS_EVENT, SCALES, SIZES, effectiveNav, effectiveScale, effectiveSize, readPrefs, writePrefs } from "./prefs.js";
import { TOKENS } from "./styles.js";

const LABELS = { large: "Large", thin: "Thin", compact: "Compact", tabs: "Tabs", sidebar: "Sidebar", 1: "100%", 0.8: "80%", 0.6: "60%" };

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
  }
  :host([align="left"]) .menu { left: 0; right: auto; }
  .label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); margin: 4px 4px 6px; }
  .seg { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--cz-bg-secondary); margin-bottom: 10px; }
  .seg button {
    flex: 1; border: none; background: transparent; color: var(--cz-text); padding: 7px 8px; border-radius: 8px;
    font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }
  .seg button[aria-pressed="true"] { background: var(--cz-primary); color: #fff; }
  .reset { width: 100%; border: none; background: none; color: var(--cz-text-secondary); font: inherit; font-size: 0.78rem; padding: 6px; cursor: pointer; text-decoration: underline; }
  .note { font-size: 0.72rem; color: var(--cz-text-secondary); margin: 0 4px 6px; }
`;

const ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>`;

/**
 * "View" menu: tile size (applies live) and room navigation (reloads, because the dashboard
 * strategy picks the layout). Choices are stored per device; attributes give the dashboard defaults.
 *   <controlz-view-menu default-size="large" default-nav="tabs" show-nav></controlz-view-menu>
 */
export class ViewMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = false;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    this._onPrefs = () => this._render();
    this._onOutside = (ev) => {
      if (this._open && !ev.composedPath().includes(this)) {
        this._open = false;
        this._render();
      }
    };
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
    const scale = effectiveScale(this.getAttribute("default-scale"));
    const custom = Object.keys(readPrefs()).length > 0;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <button type="button" class="trigger" aria-haspopup="true" aria-expanded="${this._open}" data-toggle>
        ${ICON}<span>View</span>
      </button>
      ${this._open ? `<div class="menu" role="menu">
        <div class="label">Tile size</div>
        ${this._segment("size", SIZES, size)}
        <div class="label">Scale</div>
        ${this._segment("scale", SCALES, scale)}
        ${this.hasAttribute("show-nav") ? `<div class="label">Rooms</div>${this._segment("nav", NAVS, nav)}` : ""}
        <p class="note">Saved on this device only.</p>
        ${custom ? `<button type="button" class="reset" data-reset>Use dashboard defaults</button>` : ""}
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
    const navBefore = effectiveNav(this.getAttribute("default-nav"));
    if (target.dataset.size) writePrefs({ tile_size: target.dataset.size });
    if (target.dataset.scale) writePrefs({ tile_scale: Number(target.dataset.scale) });
    if (target.dataset.nav) writePrefs({ room_nav: target.dataset.nav });
    if (target.hasAttribute("data-reset")) writePrefs({ tile_size: null, room_nav: null, tile_scale: null });
    if (effectiveNav(this.getAttribute("default-nav")) !== navBefore) {
      location.reload();
    }
  }
}
