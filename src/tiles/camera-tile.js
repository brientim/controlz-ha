import { CzElement, escapeHtml } from "../base.js";
import { cameraView, friendlyName } from "../model.js";
import { TILE_STYLES } from "../styles.js";

const REFRESH_MS = 10_000;

/**
 * Camera snapshot tile (ControlZ security camera grid): the latest still fills the tile and
 * refreshes every 10 s while the page is visible; tap opens Home Assistant's live view.
 */
export class CameraTile extends CzElement {
  connectedCallback() {
    super.connectedCallback();
    this._timer = setInterval(() => this._refreshSnapshot(), REFRESH_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timer);
  }

  styles() {
    return TILE_STYLES;
  }

  _url(picture) {
    if (!picture) return null;
    return picture.startsWith("/") && this._hass.hassUrl ? this._hass.hassUrl(picture) : picture;
  }

  _refreshSnapshot() {
    if (document.hidden) return;
    const img = this.shadowRoot.querySelector("img.snap");
    const base = this._url(cameraView(this._hass?.states?.[this._config.entity]).picture);
    if (!img || !base || base.startsWith("data:")) return;
    img.src = `${base}${base.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }

  view() {
    const entityId = this._config.entity;
    const cam = cameraView(this._hass.states[entityId]);
    const name = this._config.name || friendlyName(this._hass, entityId);
    const model = { name, ...cam, picture: this._url(cam.picture) };
    const html = `
      <article class="tile camera${cam.offline ? " offline" : ""}" role="button" tabindex="0" aria-label="${escapeHtml(name)} camera">
        ${model.picture ? `<img class="snap" src="${escapeHtml(model.picture)}" alt="" loading="lazy" decoding="async" />` : `<div class="no-snap" aria-hidden="true">📷</div>`}
        <div class="header">
          <span class="icon" aria-hidden="true">📷</span>
          <div class="name-block">
            <div class="name">${escapeHtml(name)}</div>
            <span class="badge${cam.live ? " live" : ""}">${cam.badge}</span>
          </div>
        </div>
      </article>`;
    return { model, html };
  }

  onTileClick() {
    this.moreInfo(this._config.entity);
  }
}
