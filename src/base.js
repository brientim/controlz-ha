import { HIDDEN_EVENT } from "./hidden.js";
import { PREFS_EVENT, SIZES, effectiveSize } from "./prefs.js";

export { SIZES };

export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function fireEvent(node, type, detail = {}) {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

export function navigate(path) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

/**
 * Base for ControlZ tiles: shadow DOM, signature-diffed re-render (HA pushes `hass`
 * on every state change in the house), and delegated `data-action` handling.
 * Re-render is held while a slider is being dragged so the thumb does not jump.
 */
export class CzElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._signature = null;
    this._dragging = false;
    this.shadowRoot.addEventListener("click", (ev) => this._dispatch(ev, "click"));
    this.shadowRoot.addEventListener("change", (ev) => this._dispatch(ev, "change"));
    this.shadowRoot.addEventListener("input", (ev) => this._dispatch(ev, "input"));
    this.shadowRoot.addEventListener("pointerdown", (ev) => {
      if (ev.target instanceof HTMLInputElement && ev.target.type === "range") this._dragging = true;
    });
    this._onPointerUp = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this.requestRender();
    };
    this._onHidden = () => this.requestRender(true);
    this._onPrefs = () => {
      if (!this._config) return;
      const before = this.getAttribute("size");
      this._applySize();
      if (this.getAttribute("size") !== before) this.requestRender(true);
    };
  }

  connectedCallback() {
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    window.addEventListener(HIDDEN_EVENT, this._onHidden);
  }

  disconnectedCallback() {
    window.removeEventListener(HIDDEN_EVENT, this._onHidden);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    this.closeSheet();
  }

  _applySize() {
    this.setAttribute("size", effectiveSize(this._config.tile_size));
    const scale = Number(this._config.tile_scale);
    this.style.zoom = scale >= 0.4 && scale <= 1.5 && scale !== 1 ? String(scale) : "";
  }

  setConfig(config) {
    this._config = this.normalizeConfig(config || {});
    this._applySize();
    this.requestRender(true);
  }

  normalizeConfig(config) {
    return { ...config };
  }

  set hass(hass) {
    this._hass = hass;
    this.requestRender();
    if (this._sheet?.isConnected) this._sheet.refresh();
  }

  /** Open this tile's controls sheet (`sheetBody()` markup; buttons run this tile's `actions`). */
  openSheet() {
    if (!this._hass || !this._config) return;
    this._sheet ||= document.createElement("controlz-sheet");
    this._sheet.show(this);
  }

  closeSheet() {
    if (this._sheet?.isConnected) this._sheet.close();
  }

  sheetBody() {
    return "";
  }

  /** Entity whose Home Assistant dialog "More details" opens. */
  sheetDetailsEntity() {
    return this._config?.entity;
  }

  get hass() {
    return this._hass;
  }

  get size() {
    return this.getAttribute("size") || "large";
  }

  getCardSize() {
    return this.size === "thin" ? 2 : 4;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: "auto" };
  }

  /** Subclasses return `{ model, html }`; `model` is diffed to skip redundant renders. */
  view() {
    return { model: null, html: "" };
  }

  styles() {
    return "";
  }

  requestRender(force = false) {
    if (!this._hass || !this._config || this._dragging) return;
    const { model, html } = this.view();
    const signature = JSON.stringify([this.size, model]);
    if (!force && signature === this._signature) return;
    this._signature = signature;
    this.shadowRoot.innerHTML = `<style>${this.styles()}</style>${html}`;
  }

  callService(domain, service, data = {}) {
    return this._hass?.callService(domain, service, data);
  }

  moreInfo(entityId) {
    fireEvent(this, "hass-more-info", { entityId });
  }

  confirmAction(message) {
    return window.confirm(message);
  }

  _dispatch(ev, type) {
    const target = ev.target.closest?.("[data-action]");
    if (!target) {
      const onControl = ev.target.closest?.(".controls, .footer, .trail, button, input, label, .sheet-backdrop");
      if (type === "click" && !onControl) this.onTileClick(ev);
      return;
    }
    const action = target.dataset.action;
    const handler = this.actions?.[`${type}:${action}`] || (type === "click" ? this.actions?.[action] : null);
    if (!handler) return;
    ev.stopPropagation();
    handler.call(this, target, ev);
  }

  /** Click on the tile body (not a control). */
  onTileClick() {}
}
