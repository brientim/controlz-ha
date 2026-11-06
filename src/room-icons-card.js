import { escapeHtml } from "./base.js";
import { sortedAreas } from "./model.js";
import { ICON_CATEGORIES, ROOM_ICONS, resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { TOKENS } from "./styles.js";

const SOURCE_LABELS = {
  config: "Card override",
  map: "room_icons override",
  area: "Home Assistant area icon",
  suggested: "ControlZ suggestion (room name)",
  coverings: "Coverings room",
  default: "Default",
};

const STYLES = `
  ${TOKENS}
  .card { background: var(--cz-card-bg); border: 1px solid var(--cz-border); border-radius: var(--cz-radius); padding: 16px; }
  h2 { margin: 0 0 4px; font-size: 1.1rem; }
  h3 { margin: 18px 0 8px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); }
  .hint { margin: 0 0 8px; font-size: 0.85rem; color: var(--cz-text-secondary); }
  .rooms { display: grid; gap: 6px; }
  .room { display: grid; grid-template-columns: 36px 1fr auto; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 10px; background: var(--cz-bg-secondary); }
  .glyph { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--cz-card-bg); border: 1px solid var(--cz-border); }
  .glyph svg { width: 18px; height: 18px; }
  .glyph ha-icon { --mdc-icon-size: 18px; }
  .room-name { font-weight: 600; }
  .room-meta { font-size: 0.75rem; color: var(--cz-text-secondary); }
  .source { font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: color-mix(in srgb, var(--cz-primary) 12%, transparent); color: var(--cz-primary); white-space: nowrap; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
  input[type="search"], select { font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-text); }
  input[type="search"] { flex: 1; min-width: 160px; }
  .registry { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .entry { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border-radius: 10px; border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: inherit; font: inherit; cursor: pointer; text-align: center; }
  .entry:hover { border-color: var(--cz-primary); }
  .entry svg { width: 24px; height: 24px; }
  .entry-name { font-size: 0.78rem; font-weight: 600; }
  .entry-mdi { font-size: 0.65rem; color: var(--cz-text-secondary); }
  .entry[hidden] { display: none; }
  .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #111827; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; z-index: 5; }
`;

/** Shows the ControlZ room icon each area resolves to (and why), plus the searchable registry. */
export class RoomIconsCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.addEventListener("input", (ev) => this._filter(ev));
    this.shadowRoot.addEventListener("change", (ev) => this._filter(ev));
    this.shadowRoot.addEventListener("click", (ev) => this._copy(ev));
  }

  setConfig(config) {
    this._config = { ...(config || {}) };
    this._areasRef = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (hass.areas !== this._areasRef) this._render();
  }

  getCardSize() {
    return 10;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._areasRef = this._hass.areas;
    const rooms = sortedAreas(this._hass).map((area) => {
      const { icon, source } = resolveAreaIcon(this._hass, area.area_id, this._config);
      return `<div class="room">
        <span class="glyph">${roomIconSvg(icon)}</span>
        <div><div class="room-name">${escapeHtml(area.name)}</div>
          <div class="room-meta">${escapeHtml(icon.name)} · ${escapeHtml(icon.mdi)}${icon.sf ? ` · SF ${escapeHtml(icon.sf)}` : ""}</div></div>
        <span class="source">${SOURCE_LABELS[source]}</span>
      </div>`;
    }).join("");
    const entries = ROOM_ICONS.map((e) => `
      <button type="button" class="entry" data-name="${escapeHtml(e.name)}" data-category="${e.category}"
        data-search="${escapeHtml([e.name, e.mdi, e.sf, ...e.suggested].join(" ").toLowerCase())}"
        title="Suggested for: ${escapeHtml(e.suggested.join(", "))}">
        ${roomIconSvg(e)}
        <span class="entry-name">${escapeHtml(e.name)}</span>
        <span class="entry-mdi">${escapeHtml(e.mdi)}</span>
      </button>`).join("");
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="card">
        <h2>${escapeHtml(this._config.title || "Room icons")}</h2>
        <p class="hint">ControlZ picks a room icon from the room name. Override one with
          <code>room_icons: { area_id: Name }</code> on the strategy or <code>icon:</code> on a room card.</p>
        <h3>Your rooms</h3>
        <div class="rooms">${rooms || `<div class="hint">No areas yet.</div>`}</div>
        <h3>Registry (${ROOM_ICONS.length})</h3>
        <div class="toolbar">
          <input type="search" placeholder="Search rooms, e.g. ensuite" aria-label="Search room icons" />
          <select aria-label="Category">
            <option value="">All categories</option>
            ${ICON_CATEGORIES.map((c) => `<option value="${c}">${c[0].toUpperCase()}${c.slice(1)}</option>`).join("")}
          </select>
        </div>
        <div class="registry">${entries}</div>
      </div>`;
  }

  _filter(ev) {
    if (!ev.target.matches?.('input[type="search"], select')) return;
    const query = this.shadowRoot.querySelector('input[type="search"]').value.trim().toLowerCase();
    const category = this.shadowRoot.querySelector("select").value;
    for (const el of this.shadowRoot.querySelectorAll(".entry")) {
      el.hidden = (query && !el.dataset.search.includes(query)) || (category && el.dataset.category !== category);
    }
  }

  async _copy(ev) {
    const entry = ev.target.closest?.(".entry");
    if (!entry) return;
    const name = entry.dataset.name;
    try {
      await navigator.clipboard.writeText(name);
      this._toast(`Copied “${name}” — use it in room_icons`);
    } catch {
      this._toast(name);
    }
  }

  _toast(text) {
    this.shadowRoot.querySelector(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    this.shadowRoot.append(toast);
    setTimeout(() => toast.remove(), 2200);
  }
}
