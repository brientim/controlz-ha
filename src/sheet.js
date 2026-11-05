import { escapeHtml } from "./base.js";
import { rangeRow, syncRange } from "./controls.js";
import { FAVORITES_EVENT, toggleFavorite } from "./favorites.js";
import { ICONS } from "./icons.js";
import { SHEET_STYLES, TILE_STYLES } from "./styles.js";
import { oscRow } from "./tiles/cover-tile.js";

export const SWATCHES = [
  [255, 147, 41], [255, 214, 102], [255, 255, 255], [249, 115, 22],
  [236, 72, 153], [168, 85, 247], [59, 130, 246], [34, 197, 94], [239, 68, 68],
];
export const CT_PRESETS = [
  { label: "Warm", kelvin: 2700, bg: "#ffd7a1" },
  { label: "Neutral", kelvin: 4000, bg: "#fff1dc" },
  { label: "Cool", kelvin: 6500, bg: "#dbe9ff" },
];

/** Lights section: On / Off, brightness, Warm / Neutral / Cool, colour swatches (each only when supported). */
export function lightControls({ label, dimmable, brightness, ct, color }) {
  return `<div class="sheet-section">
    ${label ? `<div class="section-label">${escapeHtml(label)}</div>` : ""}
    <div class="row osc">
      <button type="button" class="btn" data-action="power" data-on="1">On</button>
      <button type="button" class="btn" data-action="power" data-on="0">Off</button>
    </div>
    ${dimmable ? rangeRow({ kind: "brightness", action: "bri", value: brightness, label: "Brightness" }) : ""}
    ${ct ? `<div class="ct-row">${CT_PRESETS.map((p) =>
      `<button type="button" class="ct-btn" data-action="ct" data-kelvin="${p.kelvin}" style="background:${p.bg}">${p.label}</button>`).join("")}</div>` : ""}
    ${color ? `<div class="swatches">${SWATCHES.map((rgb) =>
      `<button type="button" class="swatch" data-action="swatch" data-rgb="${rgb.join(",")}"
         style="background:rgb(${rgb.join(",")})" aria-label="Colour rgb ${rgb.join(" ")}"></button>`).join("")}</div>` : ""}
  </div>`;
}

/** Coverings section: position (when supported) and Open / Stop / Close. */
export function coverControls({ label, positionable, position }) {
  return `<div class="sheet-section">
    ${label ? `<div class="section-label">${escapeHtml(label)}</div>` : ""}
    ${positionable ? rangeRow({ kind: "position", action: "cover-position", value: position, label: "Position (100 is open)" }) : ""}
    ${oscRow("cover-osc")}
  </div>`;
}

/**
 * Sheet chrome: title + favorite heart (when `favorite` is a boolean) + close, body, then
 * More details (Home Assistant dialog) and Done — or the owner's own `footer` buttons.
 * `wide` is for reading content (help, exported YAML), not controls.
 */
export function sheetFrame({ title, subtitle, body, detailsEntity, favorite, footer, wide = false }) {
  const heart = typeof favorite === "boolean"
    ? `<button type="button" class="sheet-fav" data-action="sheet-favorite" aria-pressed="${favorite}"
        title="${favorite ? "Remove from favorites" : "Add to favorites"}" aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}">${favorite ? ICONS.heart : ICONS.heartOutline}</button>`
    : "";
  return `<div class="sheet-backdrop" data-action="sheet-close">
    <div class="sheet${wide ? " wide" : ""}" data-action="sheet-stay" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="sheet-head">
        <div class="sheet-titles"><h3>${escapeHtml(title)}</h3>${subtitle ? `<div class="sheet-sub">${escapeHtml(subtitle)}</div>` : ""}</div>
        ${heart}
        <button type="button" class="sheet-x" data-action="sheet-close" aria-label="Close">✕</button>
      </div>
      <div class="sheet-body">${body}</div>
      <div class="sheet-foot">
        ${footer ?? `${detailsEntity ? `<button type="button" class="btn ghost" data-action="sheet-details">More details</button>` : ""}
        <button type="button" class="btn" data-action="sheet-close">Done</button>`}
      </div>
    </div>
  </div>`;
}

const TYPING = 'input:not([type="range"]):not([type="checkbox"]), select, textarea';

/**
 * ControlZ controls sheet, attached to <body> so no card layout or the Home Assistant header can
 * clip it. Its buttons call the owning tile's `actions`; More details asks the owner to open
 * Home Assistant's own dialog (that event has to come from inside Home Assistant's element tree).
 */
export class CzSheet extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._dragging = false;
    for (const type of ["click", "input", "change"]) {
      this.shadowRoot.addEventListener(type, (ev) => this._dispatch(ev, type));
    }
    this.shadowRoot.addEventListener("pointerdown", (ev) => {
      if (ev.target instanceof HTMLInputElement && ev.target.type === "range") this._dragging = true;
    });
    this._onPointerUp = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this.refresh();
    };
    this._onKey = (ev) => {
      if (ev.key === "Escape") this.close();
    };
    this._onFavorites = () => this.refresh();
    // A field being typed in is never re-rendered under the user; catch up once focus leaves the fields.
    this.shadowRoot.addEventListener("focusout", () => setTimeout(() => this.refresh(), 0));
  }

  connectedCallback() {
    this.setAttribute("size", "large");
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("keydown", this._onKey);
    window.addEventListener(FAVORITES_EVENT, this._onFavorites);
  }

  disconnectedCallback() {
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("keydown", this._onKey);
    window.removeEventListener(FAVORITES_EVENT, this._onFavorites);
  }

  get owner() {
    return this._owner;
  }

  show(owner) {
    this._owner = owner;
    this._html = null;
    if (!this.isConnected) document.body.append(this);
    this.refresh(true);
    (this.shadowRoot.querySelector("[autofocus]") || this.shadowRoot.querySelector(".sheet-x"))?.focus();
  }

  /** Re-render from the owner's `sheetBody()`; `force` also re-renders over a focused field. */
  refresh(force = false) {
    if (!this._owner || this._dragging || !this.isConnected) return;
    if (!force && this.shadowRoot.activeElement?.matches?.(TYPING)) return;
    const html = this._owner.sheetBody();
    if (html === this._html) return;
    const scroll = this.shadowRoot.querySelector(".sheet-body")?.scrollTop ?? 0;
    this._html = html;
    this.shadowRoot.innerHTML = `<style>${TILE_STYLES}${SHEET_STYLES}</style>${html}`;
    const body = this.shadowRoot.querySelector(".sheet-body");
    if (body) body.scrollTop = scroll;
  }

  close() {
    this.remove();
    const owner = this._owner;
    this._owner = null;
    owner?.sheetClosed?.();
  }

  _dispatch(ev, type) {
    const target = ev.target.closest?.("[data-action]");
    if (!target || !this._owner) return;
    const action = target.dataset.action;
    if (type === "click" && action === "sheet-close") {
      this.close();
      return;
    }
    if (type === "click" && action === "sheet-details") {
      const owner = this._owner;
      this.close();
      owner.moreInfo(owner.sheetDetailsEntity());
      return;
    }
    if (type === "click" && action === "sheet-favorite") {
      const fav = this._owner.favoriteTarget?.();
      if (fav) toggleFavorite(this._owner.hass, fav.kind, fav.id).catch(() => {});
      return;
    }
    if (type === "input" && target.type === "range") {
      syncRange(target);
      return;
    }
    const actions = this._owner.actions || {};
    const handler = actions[`${type}:${action}`] || (type === "click" ? actions[action] : null);
    if (handler) handler.call(this._owner, target, ev);
  }
}
