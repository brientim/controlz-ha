import { openAnnounce, voices } from "./announce.js";
import { areaItems, itemsKey, masterItems, visibleItems } from "./area-cache.js";
import { openAutomationEditor } from "./automation-editor.js";
import { openPresetEditor } from "./preset-editor.js";
import { openSceneCapture } from "./scene-sheet.js";
import { openImportSheet } from "./transfer.js";
import { dashboardBase, escapeHtml, fireEvent, navigate } from "./base.js";
import {
  FAVORITES_EVENT, favoriteLists, favoriteOrder, isFavorite, loadFavorites, setFavoritesOrder, toggleFavorite,
} from "./favorites.js";
import {
  EDIT_EVENT, HIDDEN_EVENT, HOME_SCENES, NO_AREA, areasOrder, entitiesOrder, hiddenLists, hiddenScenes, isEditing, movedOrder,
  reorderSubset, roomExcluded, roomsChangedThisSession, securityBannerSettings, setAreasOrder, setEditing, setEntitiesOrder, setHidden,
  setRoomExcluded, setScenesHidden,
} from "./hidden.js";
import { openEntityHistory, openRoomHistory, openSecurityHistory } from "./history.js";
import { historyItems } from "./history-model.js";
import { ICONS } from "./icons.js";
import {
  KIND, ROOM_FILTERS, automationGroups, domainOf, looseItems, favoriteAreas, favoriteItems, filterRoomItems, friendlyName, groupBySection, itemsOn,
  lightsOffTargets, maintenanceReport, orderItems, roomIsOn, roomReadings, roomStatus, roomSummary, securityReport, showsSecurityBanner,
  sortedAreas,
} from "./model.js";
import {
  HOME_FILTERS, PREFS_EVENT, collapsedSections, effectiveNav, effectiveScale, effectiveSize, homeFilter, isCollapsed, roomFilter, roomSection,
  takeStartPage, toggleCollapsed, writePrefs,
} from "./prefs.js";
import { resolveAreaIcon, roomIconSvg } from "./room-icons.js";
import { SECURITY_SETTINGS_EVENT, openSecuritySettings } from "./security-settings.js";
import { sheetFrame } from "./sheet.js";
import { GRID_STYLES } from "./styles.js";
import { createTile } from "./tile-factory.js";

export const iconOptions = (config) => ({
  ...(config.icon ? { icon: config.icon } : {}),
  ...(config.room_icons ? { room_icons: config.room_icons } : {}),
  ...(config.icon_source ? { icon_source: config.icon_source } : {}),
});

/** Hidden lists (and tile order) forwarded to child cards so room tiles leave hidden devices out of their counts. */
export const hiddenOptions = (config) => ({
  ...(config.hide_areas ? { hide_areas: config.hide_areas } : {}),
  ...(config.hide_entities ? { hide_entities: config.hide_entities } : {}),
  ...(config.entities_order ? { entities_order: config.entities_order } : {}),
  ...(config.room_exclude ? { room_exclude: config.room_exclude } : {}),
  ...(config.confirm_scenes ? { confirm_scenes: config.confirm_scenes } : {}),
  ...(config.hide_scenes ? { hide_scenes: config.hide_scenes } : {}),
});

/** Security banner scope and placement, forwarded to every page that can show the banner. */
export const securityOptions = (config) => Object.fromEntries(
  ["security_include", "security_exclude", "security_banner", "security_banner_rooms", "favorites_view", "automations_view",
    "coverings_view", "cameras_view", "sensors_view", "weather_view", "weather_entity"]
    .filter((key) => config[key] != null)
    .map((key) => [key, config[key]]),
);

/** View menu; `page` (`{ id, name }`) lets it offer "Start on this page". */
export const viewMenuHtml = (config, hass, page = null) =>
  config.show_menu === false
    ? ""
    : `<controlz-view-menu default-size="${escapeHtml(config.tile_size || "large")}"
        default-nav="${escapeHtml(config.room_nav || "tabs")}" default-scale="${escapeHtml(String(config.tile_scale ?? 1))}"
        ${config.show_nav_menu ? "show-nav" : ""} ${config.editable ? "editable" : ""} ${hass?.user?.is_admin ? "admin" : ""}
        ${page && config.editable ? `page-id="${escapeHtml(page.id)}" page-name="${escapeHtml(page.name)}"` : ""}></controlz-view-menu>`;

const EYE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 7a5 5 0 015 5c0 .65-.13 1.26-.36 1.83l2.92 2.92A11.82 11.82 0 0023 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16A4.85 4.85 0 0112 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55A2.82 2.82 0 009 12a3 3 0 003 3c.22 0 .44-.03.65-.08l1.55 1.55A4.97 4.97 0 017 12c0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16a3 3 0 00-3-3l-.17.01z"/></svg>`;

/**
 * Edit-mode wrapper: the tile plus a favorite heart (everyone), a show / hide button (admins) and,
 * when `move` names a group (a section, or the rooms), move buttons and drag to reorder within that
 * group. Buttons keep their on-screen size at any tile scale.
 */
export function editWrap(el, { kind, id, name, hidden = false, canHide = false, move = null, roomSwitch = null }) {
  const wrap = document.createElement("div");
  wrap.className = `tile-wrap${hidden ? " is-hidden" : ""}`;
  wrap.dataset.wrapId = id;
  if (move) {
    wrap.draggable = true;
    wrap.dataset.wrapGroup = move;
  }
  wrap.append(el);
  const fav = isFavorite(kind, id);
  const n = escapeHtml(name);
  wrap.insertAdjacentHTML("beforeend", `
    <button type="button" class="fav-toggle" data-fav-kind="${kind}" data-fav-id="${escapeHtml(id)}" aria-pressed="${fav}"
      title="${fav ? "Remove" : "Add"} ${n} ${fav ? "from" : "to"} favorites" aria-label="${fav ? "Remove" : "Add"} ${n} ${fav ? "from" : "to"} favorites">${fav ? ICONS.heart : ICONS.heartOutline}</button>
    ${canHide ? `<button type="button" class="hide-toggle" data-hide-kind="${kind}" data-hide-id="${escapeHtml(id)}" data-hide="${hidden ? "0" : "1"}"
      aria-pressed="${hidden}" title="${hidden ? "Show" : "Hide"} ${n}" aria-label="${hidden ? "Show" : "Hide"} ${n}">${hidden ? EYE_OFF : EYE}</button>` : ""}
    ${move ? `<button type="button" class="move-btn prev" data-move-id="${escapeHtml(id)}" data-move-group="${escapeHtml(move)}" data-move="-1" title="Move ${n} earlier" aria-label="Move ${n} earlier">${ICONS.chevronLeft}</button>
      <button type="button" class="move-btn next" data-move-id="${escapeHtml(id)}" data-move-group="${escapeHtml(move)}" data-move="1" title="Move ${n} later" aria-label="Move ${n} later">${ICONS.chevronRight}</button>` : ""}
    ${roomSwitch ? `<button type="button" class="room-switch-btn" data-room-switch-id="${escapeHtml(id)}" data-room-switch="${roomSwitch.excluded ? "1" : "0"}"
      aria-pressed="${!roomSwitch.excluded}" title="${roomSwitch.excluded ? `The room tile leaves ${n} alone. Tap so it controls it again.` : `The room tile switches and dims ${n}. Tap to leave it alone.`}"
      aria-label="${n}: ${roomSwitch.excluded ? "not controlled" : "controlled"} by the room tile">${ICONS.bulb}${roomSwitch.excluded ? "<span class=\"slash\"></span>" : ""}</button>` : ""}`);
  if (roomSwitch?.excluded) wrap.classList.add("room-excluded");
  return wrap;
}

// Order matters: the Favorites page follows the user's favorites order.
const favoritesKey = () => {
  const f = favoriteLists();
  return `${[...f.areas]}|${[...f.entities]}`;
};

const SECURITY_GROUPS = [
  { key: "insecure", title: "Insecure", dot: "#dc2626" },
  { key: "warning", title: "Check", dot: "#ea580c" },
  { key: "motion", title: "Motion", dot: "#ca8a04" },
];

const dragWrap = (ev) => ev.composedPath().find((el) => el instanceof HTMLElement && el.matches?.(".tile-wrap[draggable=true]"));

/**
 * Shared shell for page-level cards: rebuilds child tiles only when the set of entities, the
 * tile size, the hidden lists, favorites (where shown) or edit mode change; otherwise just forwards `hass`.
 */
export class CzPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._children = [];
    this._key = null;
    this._started = false;
    this._onPrefs = () => {
      if (!this._config) return;
      const sameCollapsed = this._builtCollapsed === collapsedSections().join();
      if (effectiveSize(this._config.tile_size) === this._size && sameCollapsed && !this.prefsChangeStructure()) {
        this._applyScale();
        return;
      }
      this._key = null;
      this._sync();
    };
    this._onStructure = () => {
      this._key = null;
      this._sync();
    };
    this._onFavorites = () => {
      if (this.usesFavorites() || this._editMode) this._onStructure();
    };
    this._resize = new ResizeObserver(() => this._applyScale());
    this.shadowRoot.addEventListener("click", (ev) => this._onPageClick(ev));
    this.shadowRoot.addEventListener(SECURITY_SETTINGS_EVENT, (ev) => {
      ev.stopPropagation();
      openSecuritySettings(this);
    });
    this._listenForDrags();
  }

  /** Drag a tile onto another tile of the same group (section / rooms) to put it before that one. */
  _listenForDrags() {
    this._drag = null;
    const clear = () => {
      for (const w of this.shadowRoot.querySelectorAll(".drag-over, .dragging")) w.classList.remove("drag-over", "dragging");
    };
    this.shadowRoot.addEventListener("dragstart", (ev) => {
      const wrap = dragWrap(ev);
      if (!wrap) return;
      this._drag = { id: wrap.dataset.wrapId, group: wrap.dataset.wrapGroup };
      wrap.classList.add("dragging");
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", this._drag.id);
    });
    this.shadowRoot.addEventListener("dragover", (ev) => {
      const wrap = dragWrap(ev);
      if (!wrap || !this._drag || wrap.dataset.wrapGroup !== this._drag.group) return;
      ev.preventDefault();
      for (const w of this.shadowRoot.querySelectorAll(".drag-over")) if (w !== wrap) w.classList.remove("drag-over");
      if (wrap.dataset.wrapId !== this._drag.id) wrap.classList.add("drag-over");
    });
    this.shadowRoot.addEventListener("dragend", () => {
      clear();
      this._drag = null;
    });
    this.shadowRoot.addEventListener("drop", (ev) => {
      const wrap = dragWrap(ev);
      const drag = this._drag;
      if (!wrap || !drag || wrap.dataset.wrapGroup !== drag.group || wrap.dataset.wrapId === drag.id) return;
      ev.preventDefault();
      clear();
      this.moveTile(drag.id, { beforeId: wrap.dataset.wrapId }, drag.group).catch((err) => this._showError(err));
    });
  }

  connectedCallback() {
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    window.addEventListener(HIDDEN_EVENT, this._onStructure);
    window.addEventListener(EDIT_EVENT, this._onStructure);
    window.addEventListener(FAVORITES_EVENT, this._onFavorites);
    this._resize.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    window.removeEventListener(HIDDEN_EVENT, this._onStructure);
    window.removeEventListener(EDIT_EVENT, this._onStructure);
    window.removeEventListener(FAVORITES_EVENT, this._onFavorites);
    this._resize.disconnect();
    if (this._sheet?.isConnected) this._sheet.close();
  }

  /** Zoom the content below the header by the tile scale, keeping it full width. */
  _applyScale() {
    const page = this.shadowRoot.querySelector(".page");
    if (!page || !this._config) return;
    const scale = effectiveScale(this._config.tile_scale);
    page.classList.toggle("scaled", scale !== 1);
    if (scale === 1) return;
    const style = getComputedStyle(page);
    const inner = page.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    page.style.setProperty("--cz-scale", String(scale));
    page.style.setProperty("--cz-inner", `${Math.max(0, Math.floor(inner))}px`);
  }

  setConfig(config) {
    this._config = this.normalizeConfig(config || {});
    this._key = null;
    this._sync();
  }

  normalizeConfig(config) {
    return { ...config };
  }

  set hass(hass) {
    this._hass = hass;
    this._sync();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  // Not `hidden` / `editing`: Home Assistant's card wrapper reads `element.hidden` to hide cards.
  get _editMode() {
    return isEditing() && !!this._config?.editable;
  }

  get _isAdmin() {
    return !!this._hass?.user?.is_admin;
  }

  get _hiddenSets() {
    return hiddenLists(this._config);
  }

  /** Pages that show favorites rebuild when they change. */
  usesFavorites() {
    return false;
  }

  /** Pages whose layout follows a per-device pref other than tile size. */
  prefsChangeStructure() {
    return false;
  }

  /** First `hass` on this page: only the first ControlZ page of a page load may use the start page. */
  firstSync() {
    takeStartPage();
  }

  _sync() {
    if (!this._hass || !this._config) return;
    loadFavorites(this._hass);
    if (!this._started) {
      this._started = true;
      this.firstSync();
    }
    this._size = effectiveSize(this._config.tile_size);
    this.setAttribute("size", this._size);
    const { areas, entities } = this._hiddenSets;
    const favs = this.usesFavorites() || this._editMode ? favoritesKey() : "";
    const scenes = `${collapsedSections()}|${[...hiddenScenes(this._config)]}`;
    const key = `${this._size}|${this._editMode}|${[...areas]}|${[...entities]}|${favs}|${this._bannerShown()}|${scenes}|${this.structureKey()}`;
    if (key !== this._key) {
      this._key = key;
      this._builtCollapsed = collapsedSections().join();
      this._children = [];
      this.shadowRoot.innerHTML = `<style>${GRID_STYLES}${this.styles()}</style><div class="page"></div>`;
      const page = this.shadowRoot.querySelector(".page");
      this.build(page);
      if (this._editMode) this._editBanner(page);
    }
    this._applyScale();
    this.update();
    this._updateBanner();
    this._updateRunning();
    for (const child of this._children) child.hass = this._hass;
    if (this._sheet?.isConnected) this._sheet.refresh();
  }

  /**
   * Where this page sits for `security_banner`: null = All Rooms, an area id for a room page,
   * `page:<id>` for Favorites, Automations and the house pages, undefined for no banner.
   */
  bannerArea() {
    return undefined;
  }

  _bannerShown() {
    const area = this.bannerArea();
    if (area === undefined || this._config.show_banner === false) return false;
    return showsSecurityBanner(securityBannerSettings(this._config), area);
  }

  bannerHtml() {
    return `<button type="button" class="banner" data-banner aria-haspopup="dialog">
      <span aria-hidden="true">🛡</span><span class="banner-text"></span><span class="banner-more" aria-hidden="true">›</span>
    </button>`;
  }

  _report() {
    return securityReport(this._hass, { include: this._config.security_include, exclude: this._config.security_exclude });
  }

  _updateBanner() {
    const banner = this.shadowRoot.querySelector(".banner");
    if (!banner) return;
    const report = this._report();
    banner.className = `banner ${report.level}`;
    const label = banner.querySelector(".banner-text");
    if (label.textContent !== report.text) label.textContent = report.text;
  }

  /** Scripts this page shows as running (ControlZ running-automation banner), each with Cancel. */
  runningScripts() {
    return [];
  }

  /**
   * Heading of a scene row: a chevron to collapse it on this device (count shown), and in edit mode
   * for admins a button to hide the row for everyone (`canHide`; rooms and All Rooms). `buttons`
   * are the row's own head buttons (+ New scene, Import, + New preset).
   */
  scenesHead({ title, key, count, buttons = "", canHide = false }) {
    const editing = this._editMode;
    const collapsed = !editing && isCollapsed(`scenes:${key}`);
    const hidden = canHide && hiddenScenes(this._config).has(key);
    const t = escapeHtml(title);
    const chevron = editing ? "" : `<button type="button" class="collapse-btn" data-collapse="scenes:${escapeHtml(key)}" aria-expanded="${!collapsed}"
      title="${collapsed ? `Show ${t}` : `Collapse ${t}`}" aria-label="${collapsed ? `Show ${t}` : `Collapse ${t}`}">${collapsed ? ICONS.chevronRight : ICONS.chevronDown}</button>`;
    const hide = editing && canHide && this._isAdmin
      ? `<button type="button" class="head-btn" data-hide-scenes="${escapeHtml(key)}" data-hide="${hidden ? "0" : "1"}" aria-pressed="${hidden}"
          title="${hidden ? "Show this row again for everyone" : "Hide this row for everyone on this dashboard"}"><span class="eye-inline">${hidden ? EYE_OFF : EYE}</span> ${hidden ? "Show for everyone" : "Hide for everyone"}</button>`
      : "";
    return `<div class="section-head scenes-head">${chevron}<h2${editing ? "" : ` data-collapse="scenes:${escapeHtml(key)}"`}>${t}${count ? ` (${count})` : ""}</h2>${hide}${buttons}</div>`;
  }

  /** Where the running banner goes (pages that have one call this in `build`). */
  runningSlot(page) {
    this._runningHtml = null;
    page.insertAdjacentHTML("beforeend", `<div class="running-row" role="status" hidden></div>`);
  }

  _updateRunning() {
    const row = this.shadowRoot.querySelector(".running-row");
    if (!row) return;
    const running = this.runningScripts().filter((id) => this._hass.states[id]?.state === "on");
    const html = running.map((id) => `<div class="running">
      <span class="running-dot" aria-hidden="true"></span><span class="running-name">${escapeHtml(friendlyName(this._hass, id))} is running</span>
      <button type="button" class="btn" data-cancel-script="${escapeHtml(id)}">Cancel</button></div>`).join("");
    if (html === this._runningHtml) return;
    this._runningHtml = html;
    row.innerHTML = html;
    row.hidden = !running.length;
  }

  // Owner interface for the shared <controlz-sheet> (security list; All Rooms adds maintenance).
  _openSheet(mode) {
    this._sheetMode = mode;
    this._sheet ||= document.createElement("controlz-sheet");
    this._sheet.show(this);
  }

  _row(item, dot, what, cls = "") {
    return `<button type="button" class="sec-row" data-action="sec-row" data-entity="${escapeHtml(item.entity_id)}">
      <span class="dot" style="background:${dot}"></span><span>${escapeHtml(item.name)}${item.area ? ` <span class="what">· ${escapeHtml(item.area)}</span>` : ""}</span>
      <span class="${cls || "what"}">${escapeHtml(what)}</span></button>`;
  }

  sheetBody() {
    return this._securitySheet();
  }

  _securitySheet() {
    const report = this._report();
    const groups = SECURITY_GROUPS.filter((g) => report[g.key].length).map((g) => `
      <div class="sheet-section">
        <div class="section-label">${g.title} (${report[g.key].length})</div>
        ${report[g.key].map((i) => this._row(i, g.dot, i.phrase || "motion")).join("")}
      </div>`).join("");
    const scoped = this._config.security_include?.length
      ? `Only the ${this._config.security_include.length} devices in security_include count.`
      : "All doors, locks, windows, garage doors, alarms and smoke / gas / CO / leak sensors in Home Assistant count"
        + (this._config.security_exclude?.length ? `, except ${this._config.security_exclude.length} excluded.` : ".");
    return sheetFrame({
      title: "Security",
      subtitle: report.text,
      body: `${groups || `<p class="sec-empty">All doors and locks secure. No motion.</p>`}
        <div class="sheet-section"><div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="sec-history">🕘 What happened (history)</button>
        </div></div>
        <p class="sec-scope">${scoped}</p>`,
    });
  }

  get actions() {
    return {
      "sec-row": (row) => {
        this._sheet?.close();
        this.moreInfo(row.dataset.entity);
      },
      "sec-history": () => openSecurityHistory(this),
    };
  }

  /**
   * Header row: `left` markup grows; the View menu sits on the right. Pages other than All Rooms
   * get the security banner under it when `security_banner` includes them.
   */
  header(page, left, pageInfo = null) {
    const menu = viewMenuHtml(this._config, this._hass, pageInfo);
    if (left || menu) page.insertAdjacentHTML("beforeend", `<div class="page-head">${left || "<span></span>"}${menu}</div>`);
    if (typeof this.bannerArea() === "string" && this._bannerShown()) {
      page.insertAdjacentHTML("beforeend", `<div class="banner-row">${this.bannerHtml()}</div>`);
    }
  }

  _editBanner(page) {
    const head = page.querySelector(".page-head");
    const what = this.reorders();
    const lights = this._isAdmin && this instanceof RoomGrid ? ` The bulb under a light sets whether the room tile switches it.` : "";
    const text = this._isAdmin
      ? `Edit rooms &amp; favorites — tap ♥ to add a favorite (yours only), <span class="eye-inline">${EYE}</span> to hide or show for everyone${what ? `, and the arrows (or drag) to reorder ${what}` : ""}. Hidden items are dimmed here.${lights}`
      : `Edit favorites — tap ♥ on any room, scene or device${what ? `; use the arrows (or drag) to reorder ${what}` : ""}. Favorites are yours and follow you to every device.`;
    const html = `<div class="edit-banner" role="status">
      <span>${text}</span>
      <span class="edit-error" hidden></span>
      <button type="button" class="btn" data-edit-done>Done</button>
    </div>`;
    if (head) head.insertAdjacentHTML("afterend", html);
    else page.insertAdjacentHTML("afterbegin", html);
  }

  /** What edit mode can reorder on this page for this user ("rooms", "tiles", …), or "" for nothing. */
  reorders() {
    return "";
  }

  _showError(err) {
    const error = this.shadowRoot.querySelector(".edit-error");
    if (!error) return;
    error.hidden = false;
    error.textContent = err?.message || "Could not save the dashboard.";
  }

  _onPageClick(ev) {
    const target = ev.composedPath().find((el) => el instanceof HTMLElement && el.matches?.(
      "[data-hide-kind], [data-fav-kind], [data-move-id], [data-edit-done], [data-new-automation], [data-import], [data-banner], [data-new-scene], [data-room-switch-id], [data-cancel-script], [data-new-preset], [data-collapse], [data-hide-scenes]"));
    if (!target) return;
    ev.stopPropagation();
    if (target.dataset.collapse) {
      toggleCollapsed(target.dataset.collapse);
      return;
    }
    if (target.hasAttribute("data-new-preset")) {
      openPresetEditor(this, { areaId: target.dataset.newPreset });
      return;
    }
    if (target.dataset.cancelScript) {
      this._hass.callService("script", "turn_off", { entity_id: target.dataset.cancelScript });
      return;
    }
    if (target.hasAttribute("data-banner")) {
      this._openSheet("security");
      return;
    }
    if (target.hasAttribute("data-new-scene")) {
      openSceneCapture(this, target.dataset.newScene);
      return;
    }
    if (target.hasAttribute("data-edit-done")) {
      setEditing(false);
      if (roomsChangedThisSession() && effectiveNav(this._config.room_nav) === "tabs") location.reload();
      return;
    }
    if (target.hasAttribute("data-new-automation")) {
      openAutomationEditor(this, { areaId: target.dataset.newAutomation });
      return;
    }
    if (target.hasAttribute("data-import")) {
      openImportSheet(this, { areaId: target.dataset.import });
      return;
    }
    this._runEdit(target, async () => {
      if (target.dataset.favKind) await toggleFavorite(this._hass, target.dataset.favKind, target.dataset.favId);
      else if (target.dataset.roomSwitchId) await setRoomExcluded(this._hass, target.dataset.roomSwitchId, target.dataset.roomSwitch !== "1");
      else if (target.dataset.hideScenes) await setScenesHidden(this._hass, target.dataset.hideScenes, target.dataset.hide === "1");
      else if (target.dataset.hideKind) await setHidden(this._hass, target.dataset.hideKind, target.dataset.hideId, target.dataset.hide === "1");
      else await this.moveTile(target.dataset.moveId, { delta: Number(target.dataset.move) }, target.dataset.moveGroup);
    });
  }

  async _runEdit(target, fn) {
    target.disabled = true;
    try {
      await fn();
    } catch (err) {
      target.disabled = false;
      this._showError(err);
    }
  }

  /** Move `id` within `group` (`{ delta }` for the arrows, `{ beforeId }` for a drop) and save the order. */
  async moveTile() {}

  /** Ids of a section's tiles as shown (edit mode), for working out the new order. */
  _groupIds(group) {
    return [...this.shadowRoot.querySelectorAll(".tile-wrap[data-wrap-group]")]
      .filter((w) => w.dataset.wrapGroup === group)
      .map((w) => w.dataset.wrapId);
  }

  tile(kind, config) {
    const el = createTile(kind, { tile_size: this._size, ...hiddenOptions(this._config), ...config });
    this._children.push(el);
    return el;
  }

  /** Room tile config: opens the room's view, or selects it inside the sidebar app. */
  roomConfig(areaId) {
    const config = { area: areaId, ...iconOptions({ ...this._config, icon: undefined }) };
    if (this._config.select_rooms) config.select_area = true;
    else if (this._config.navigation !== false) config.navigation_path = `${dashboardBase()}/${this._config.view_path_prefix || "room-"}${areaId}`;
    return config;
  }

  /**
   * Device sections (ControlZ room order). Scenes are a chip row unless `scenes_style: tiles` or
   * editing; `newAutomationArea` (admins) adds "+ New" to the Automations heading and Import to
   * the Scenes heading; `canMove` adds the reorder arrows in edit mode (each section reorders on its own).
   */
  sections(page, items, { areaName = "", newAutomationArea, canMove = false, scenes = null } = {}) {
    const editing = this._editMode;
    const hiddenEntities = this._hiddenSets.entities;
    const roomAdmin = newAutomationArea !== undefined && this._isAdmin;
    const sceneButtons = roomAdmin
      ? `<button type="button" class="head-btn" data-new-scene="${escapeHtml(newAutomationArea)}" title="Save how this room is now as a scene">+ New scene</button>
        <button type="button" class="head-btn" data-import="${escapeHtml(newAutomationArea)}">Import</button>`
      : "";
    const scenesHidden = !!scenes?.canHide && hiddenScenes(this._config).has(scenes.key);
    const groups = groupBySection(items).filter((s) => s.id !== "scenes" || editing || !scenesHidden);
    if (roomAdmin && !editing && !scenesHidden && !groups.some((s) => s.id === "scenes")) {
      page.insertAdjacentHTML("beforeend", `<section><div class="section-head"><h2>Scenes</h2>${sceneButtons}</div>
        <p class="hint">No scenes yet. Set the room how you like it, then + New scene.</p></section>`);
    }
    for (const section of groups) {
      const el = document.createElement("section");
      if (section.id === "scenes" && scenes) {
        const head = this.scenesHead({ title: scenes.title || section.title, key: scenes.key, count: section.items.length, buttons: sceneButtons, canHide: scenes.canHide });
        if (scenesHidden) el.classList.add("section-hidden");
        if (!editing && isCollapsed(`scenes:${scenes.key}`)) {
          el.innerHTML = head;
          page.append(el);
          continue;
        }
        if (this._config.scenes_style !== "tiles" && !editing) {
          el.innerHTML = head;
          const strip = document.createElement("controlz-scene-strip");
          strip.setConfig({ ...hiddenOptions(this._config), tile_size: this._size, area_name: areaName, entities: section.items.map((i) => i.entity_id) });
          this._children.push(strip);
          el.append(strip);
          page.append(el);
          continue;
        }
      }
      const importButton = section.id === "scenes" ? sceneButtons : "";
      const addButton = section.id === "automations" && roomAdmin
        ? `<button type="button" class="head-btn" data-new-automation="${escapeHtml(newAutomationArea)}">+ New</button>`
        : importButton;
      el.innerHTML = section.id === "scenes" && scenes
        ? `${this.scenesHead({ title: scenes.title || section.title, key: scenes.key, count: section.items.length, buttons: sceneButtons, canHide: scenes.canHide })}<div class="grid"></div>`
        : `<div class="section-head"><h2>${section.title}</h2>${addButton}</div><div class="grid"></div>`;
      const grid = el.querySelector(".grid");
      const excluded = roomExcluded(this._config);
      for (const item of section.items) {
        const tile = this.tile(item.kind, { entity: item.entity_id });
        grid.append(editing
          ? editWrap(tile, {
            kind: "entity", id: item.entity_id, name: friendlyName(this._hass, item.entity_id),
            hidden: hiddenEntities.has(item.entity_id), canHide: this._isAdmin, move: canMove && section.items.length > 1 ? section.id : null,
            roomSwitch: roomAdmin && item.kind === "light" ? { excluded: excluded.has(item.entity_id) } : null,
          })
          : tile);
      }
      page.append(el);
    }
  }

  styles() {
    return "";
  }

  structureKey() {
    return "";
  }

  build() {}

  update() {}

  moreInfo(entityId) {
    fireEvent(this, "hass-more-info", { entityId });
  }

  sheetDetailsEntity() {
    return null;
  }
}

/** One room: security banner (when `security_banner` includes this room), master tile, then Scenes / Lights / Coverings / Climate / Security / … sections. */
export class RoomGrid extends CzPage {
  static getStubConfig(hass) {
    return { area: Object.keys(hass?.areas || {})[0] || "living_room" };
  }

  constructor() {
    super();
    this.shadowRoot.addEventListener("click", (ev) => {
      const hit = ev.composedPath().find((el) => el instanceof HTMLElement && el.matches?.("[data-status], [data-room-history], [data-room-filter], [data-room-section]"));
      if (!hit) return;
      if (hit.dataset.roomFilter) writePrefs({ room_filter: hit.dataset.roomFilter === "all" ? null : hit.dataset.roomFilter });
      else if (hit.dataset.roomSection !== undefined) writePrefs({ room_section: hit.dataset.roomSection || null });
      else if (hit.hasAttribute("data-room-history")) openRoomHistory(this, this._config.area);
      else if (domainOf(hit.dataset.status) === "binary_sensor") openEntityHistory(this, hit.dataset.status);
      else this.moreInfo(hit.dataset.status);
    });
  }

  normalizeConfig(config) {
    if (!config.area) throw new Error("controlz-room-grid: `area` (area_id) is required");
    return { show_title: true, show_room_tile: true, show_room_status: true, scenes_style: "chips", ...config };
  }

  structureKey() {
    const filtered = this._editMode ? "" : itemsKey(this._filtered(this._ordered()));
    return `${this._config.area}|${itemsKey(this._ordered())}|${roomFilter()}|${roomSection()}|${filtered}`;
  }

  usesFavorites() {
    return roomFilter() === "favorites";
  }

  prefsChangeStructure() {
    return this._builtFilter !== `${roomFilter()}|${roomSection()}`;
  }

  /** Room items after this device's room filter (hidden devices are dropped before this). */
  _filtered(items) {
    return filterRoomItems(this._hass, items.filter((i) => !this._hiddenSets.entities.has(i.entity_id)),
      { filter: roomFilter(), section: roomSection(), favorites: favoriteLists().entities });
  }

  _filterRow(items) {
    const filter = roomFilter();
    const section = roomSection();
    const present = groupBySection(items).filter((s) => s.id !== "scenes");
    const chips = present.length > 1 || section
      ? `<div class="seg" role="group" aria-label="Device type">
          <button type="button" data-room-section="" aria-pressed="${!section}">All types</button>
          ${present.map((s) => `<button type="button" data-room-section="${s.id}" aria-pressed="${s.id === section}">${escapeHtml(s.title)}</button>`).join("")}
        </div>`
      : "";
    return `<div class="filter-row room-filter">
      <div class="seg" role="group" aria-label="Show devices">${ROOM_FILTERS.map((f) =>
        `<button type="button" data-room-filter="${f.id}" aria-pressed="${f.id === filter}" ${f.id === "favorites" ? 'title="Favorites" aria-label="Favorites"' : ""}>${f.label}</button>`).join("")}</div>
      ${chips}</div>`;
  }

  /** The room's items in the saved tile order (`entities_order`), then by name. */
  _ordered() {
    return orderItems(areaItems(this._hass, this._config.area), entitiesOrder(this._config, this._config.area));
  }

  reorders() {
    return this._isAdmin ? "tiles within each section" : "";
  }

  async moveTile(id, opts, group) {
    // Saved section by section, so `entities_order` reads like the page.
    const full = groupBySection(this._ordered()).flatMap((s) => s.items.map((i) => i.entity_id));
    await setEntitiesOrder(this._hass, this._config.area, reorderSubset(full, movedOrder(this._groupIds(group), id, opts)));
  }

  _readings() {
    const unit = this._hass?.config?.unit_system?.temperature || "°C";
    return roomReadings(this._hass, visibleItems(this._hass, this._config.area, this._config), unit).text;
  }

  build(page) {
    const { area, show_title, show_room_tile } = this._config;
    const hiddenEntities = this._hiddenSets.entities;
    const editing = this._editMode;
    const all = this._ordered();
    const items = editing ? all : all.filter((i) => !hiddenEntities.has(i.entity_id));
    const name = this._config.title || this._hass.areas?.[area]?.name || area;
    const { icon } = resolveAreaIcon(this._hass, area, this._config);
    this.header(page, show_title
      ? `<h1 class="page-title"><span class="title-icon">${roomIconSvg(icon)}</span>${escapeHtml(name)}<span class="readings-inline"></span></h1>`
      : "", { id: `room-${area}`, name });
    this._statusHtml = null;
    if (this._config.show_room_status !== false && !editing) page.insertAdjacentHTML("beforeend", `<div class="room-status" role="status"></div>`);
    if (!editing) this.runningSlot(page);
    this._builtFilter = `${roomFilter()}|${roomSection()}`;
    if (!items.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">${all.length ? "Every device in this room is hidden." : "No supported devices in this area."}</div>`);
      return;
    }
    const visible = items.filter((i) => !hiddenEntities.has(i.entity_id));
    if (show_room_tile && visible.some((i) => ["light", "cover"].includes(i.kind))) {
      const master = document.createElement("div");
      master.className = "master";
      const tile = this.tile("room", { area, ...iconOptions(this._config) });
      master.append(editing ? editWrap(tile, { kind: "area", id: area, name }) : tile);
      page.append(master);
    }
    if (editing || this._config.show_filter === false) {
      this.sections(page, items, { areaName: name, newAutomationArea: area, canMove: this._isAdmin, scenes: { key: area, canHide: true } });
      return;
    }
    page.insertAdjacentHTML("beforeend", this._filterRow(visible));
    const shown = this._filtered(items);
    const filtering = roomFilter() !== "all" || roomSection();
    if (filtering && !shown.length) {
      const what = { on: "Nothing here is on.", off: "Nothing here is off.", favorites: "No favorites in this room yet." }[roomFilter()] || "Nothing to show.";
      page.insertAdjacentHTML("beforeend", `<div class="empty">${what}</div>`);
      return;
    }
    this.sections(page, shown, {
      areaName: name, newAutomationArea: filtering ? undefined : area, canMove: this._isAdmin, scenes: { key: area, canHide: true },
    });
  }

  update() {
    const el = this.shadowRoot.querySelector(".readings-inline");
    if (el) {
      const text = this._readings();
      if (el.textContent !== text) el.textContent = text;
    }
    const row = this.shadowRoot.querySelector(".room-status");
    if (!row) return;
    const items = visibleItems(this._hass, this._config.area, this._config);
    const chips = roomStatus(this._hass, items);
    const history = historyItems(items).length > 0;
    const html = `${chips.map((c) => `<button type="button" class="status-chip ${c.level}" data-status="${escapeHtml(c.entity_id)}">
        <span aria-hidden="true">${c.icon}</span>${escapeHtml(c.text)}</button>`).join("")}
      ${history ? `<button type="button" class="status-chip history" data-room-history aria-haspopup="dialog">📈 History</button>` : ""}`;
    if (html === this._statusHtml) return;
    this._statusHtml = html;
    row.innerHTML = html;
    row.hidden = !chips.length && !history;
  }

  favoriteTarget() {
    return { kind: "area", id: this._config.area };
  }

  bannerArea() {
    return this._config.area;
  }

  runningScripts() {
    return visibleItems(this._hass, this._config.area, this._config).map((i) => i.entity_id).filter((id) => id.startsWith("script."));
  }
}
const FILTER_LABELS = { all: "All", on: "On", off: "Off" };

/**
 * All Rooms: security banner (tap for the device list), All / On / Off filter with the devices on
 * right now, maintenance report (low batteries, offline devices), All lights off, and one ControlZ
 * room tile per area. Tapping a room opens its view, or selects it when hosted by the sidebar app (`select_rooms`).
 */
export class HomeGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this.shadowRoot.addEventListener("click", (ev) => {
      const path = ev.composedPath().filter((el) => el instanceof HTMLElement);
      const hit = (sel) => path.find((el) => el.matches?.(sel));
      if (hit("[data-maintenance]")) this._openSheet("maintenance");
      else if (hit("[data-announce]")) openAnnounce(this, []);
      else if (hit("[data-all-off]")) this._allOff();
      else if (hit("[data-filter]")) writePrefs({ home_filter: hit("[data-filter]").dataset.filter === "all" ? null : hit("[data-filter]").dataset.filter });
    });
  }

  normalizeConfig(config) {
    return { show_banner: true, navigation: true, view_path_prefix: "room-", show_maintenance: true, battery_threshold: 20, ...config };
  }

  styles() {
    return `
      .sec-group { display: flex; flex-direction: column; gap: 6px; }
      .sec-group h4 { margin: 0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); }
      .sec-empty, .sec-scope { margin: 0; }
    `;
  }

  firstSync() {
    const start = takeStartPage();
    if (!start || start === "rooms" || this._config.select_rooms || !this._config.editable) return;
    // Navigating from inside the `hass` setter would swap the view while this card is still being set up.
    setTimeout(() => {
      if (this.isConnected) navigate(`${dashboardBase()}/${start}`, { replace: true });
    }, 0);
  }

  prefsChangeStructure() {
    return this._filter !== homeFilter();
  }

  reorders() {
    return this._isAdmin ? "rooms" : "";
  }

  /** Areas with lights or coverings; hidden ones only while editing. */
  _areas() {
    const hiddenAreas = this._hiddenSets.areas;
    const editing = this._editMode;
    return sortedAreas(this._hass, { order: areasOrder(this._config) })
      .filter((a) => editing || !hiddenAreas.has(a.area_id))
      .filter((a) => areaItems(this._hass, a.area_id).some((i) => i.kind === "light" || i.kind === "cover"));
  }

  /** Visible items of every room shown on All Rooms (hidden rooms and devices left out). */
  _houseItems() {
    const hiddenAreas = this._hiddenSets.areas;
    return this._areas().filter((a) => !hiddenAreas.has(a.area_id)).flatMap((a) => visibleItems(this._hass, a.area_id, this._config));
  }

  /** Rooms after the All / On / Off filter (editing always shows every room). */
  _shownAreas() {
    const areas = this._areas();
    const filter = this._editMode ? "all" : homeFilter();
    if (filter === "all") return areas;
    return areas.filter((a) => roomIsOn(roomSummary(this._hass, masterItems(this._hass, a.area_id, this._config))) === (filter === "on"));
  }

  _onNow() {
    return this._editMode || homeFilter() !== "on" ? [] : itemsOn(this._hass, this._houseItems());
  }

  /** House-wide scenes and scripts (no room), ControlZ presets such as Home / Away / Bedtime. */
  _presets() {
    return looseItems(this._hass, [KIND.SCENE], this._editMode ? new Set() : this._hiddenSets.entities);
  }

  _presetsSection(page) {
    const presets = this._presets();
    const add = this._isAdmin && !this._editMode
      ? `<button type="button" class="head-btn" data-new-preset="" title="Scenes and steps in order, saved as a Home Assistant script">+ New preset</button>`
      : "";
    if (!presets.length && !add) return;
    const scenes = { key: HOME_SCENES, title: "Scenes & presets", canHide: true };
    if (this._editMode) {
      this.sections(page, presets, { scenes });
      return;
    }
    if (hiddenScenes(this._config).has(HOME_SCENES)) return;
    const section = document.createElement("section");
    section.innerHTML = this.scenesHead({ ...scenes, count: presets.length, buttons: add });
    if (isCollapsed(`scenes:${HOME_SCENES}`)) {
      page.append(section);
      return;
    }
    if (presets.length) {
      const strip = document.createElement("controlz-scene-strip");
      strip.setConfig({ ...hiddenOptions(this._config), tile_size: this._size, entities: presets.map((i) => i.entity_id) });
      this._children.push(strip);
      section.append(strip);
    } else section.insertAdjacentHTML("beforeend", `<p class="hint">House-wide scenes and presets (Home, Away, Bedtime…) go here.</p>`);
    page.append(section);
  }

  async moveTile(id, opts) {
    const shown = this._areas().map((a) => a.area_id);
    await setAreasOrder(this._hass, movedOrder(shown, id, opts));
  }

  bannerArea() {
    return null;
  }

  /** Every script in the house that is not hidden on this dashboard. */
  runningScripts() {
    const hidden = this._hiddenSets.entities;
    return Object.keys(this._hass.states).filter((id) => id.startsWith("script.") && !hidden.has(id));
  }

  _maintenance() {
    return maintenanceReport(this._hass, { threshold: Number(this._config.battery_threshold) || 20, exclude: this._config.hide_entities });
  }

  structureKey() {
    this._filter = homeFilter();
    const rooms = this._shownAreas().map((a) => `${a.area_id}:${a.name}:${a.icon || ""}`).join(",");
    return `${this._filter}|${rooms}|${this._onNow().map((i) => i.entity_id).join(",")}|${itemsKey(this._presets())}`;
  }

  build(page) {
    const title = this._config.title ? `<h1 class="page-title">${escapeHtml(this._config.title)}</h1>` : "";
    const banner = this._bannerShown() ? this.bannerHtml() : "";
    this.header(page, banner || title, { id: "rooms", name: "All Rooms" });
    if (banner && title) page.insertAdjacentHTML("afterbegin", title);
    if (!this._editMode) this.runningSlot(page);
    const all = this._areas();
    if (!all.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">No areas with lights or window coverings yet. Assign devices to areas in Home Assistant.</div>`);
      return;
    }
    this._rowHtml = null;
    page.insertAdjacentHTML("beforeend", `<div class="filter-row"></div>`);
    this._presetsSection(page);
    const areas = this._shownAreas();
    const hiddenAreas = this._hiddenSets.areas;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const a of areas) {
      const tile = this.tile("room", this.roomConfig(a.area_id));
      grid.append(this._editMode
        ? editWrap(tile, { kind: "area", id: a.area_id, name: a.name, hidden: hiddenAreas.has(a.area_id), canHide: this._isAdmin, move: this._isAdmin ? "rooms" : null })
        : tile);
    }
    if (areas.length) page.append(grid);
    else page.insertAdjacentHTML("beforeend", `<div class="empty">${homeFilter() === "on" ? "Everything is off." : "Every room has something on."}</div>`);
    const onNow = this._onNow();
    if (onNow.length) {
      const section = document.createElement("section");
      section.innerHTML = `<h2>On now (${onNow.length})</h2><div class="grid"></div>`;
      for (const item of onNow) section.querySelector(".grid").append(this.tile(item.kind, { entity: item.entity_id }));
      page.append(section);
    }
  }

  _filterRow() {
    const filter = homeFilter();
    const m = this._config.show_maintenance === false ? null : this._maintenance();
    const off = lightsOffTargets(this._hass, this._houseItems());
    const parts = [];
    if (m?.lowBattery.length) parts.push(`🔋 ${m.lowBattery.length} low`);
    if (m?.unavailable.length) parts.push(`⚠ ${m.unavailable.length} offline`);
    return `
      ${this._editMode ? "" : `<div class="seg" role="group" aria-label="Show rooms">${HOME_FILTERS.map((f) =>
        `<button type="button" data-filter="${f}" aria-pressed="${f === filter}">${FILTER_LABELS[f]}</button>`).join("")}</div>`}
      ${parts.length ? `<button type="button" class="pill warn" data-maintenance aria-haspopup="dialog" title="Low batteries and offline devices">${parts.join(" · ")}</button>` : ""}
      <span class="spacer"></span>
      ${this._canAnnounce() ? `<button type="button" class="pill" data-announce aria-haspopup="dialog" title="Speak a message on your speakers">📢 Announce</button>` : ""}
      ${off.count ? `<button type="button" class="pill" data-all-off title="Turn off every light on this page">💡 All lights off (${off.count})</button>` : ""}`;
  }

  _canAnnounce() {
    if (this._config.show_announce === false || this._editMode) return false;
    return voices(this._hass).length > 0 && Object.keys(this._hass.states).some((id) => id.startsWith("media_player."));
  }

  update() {
    const row = this.shadowRoot.querySelector(".filter-row");
    if (row) {
      const html = this._filterRow();
      if (html !== this._rowHtml) {
        this._rowHtml = html;
        row.innerHTML = html;
      }
    }
  }

  _allOff() {
    const off = lightsOffTargets(this._hass, this._houseItems());
    if (!off.count || !this.confirmAction(`Turn off ${off.count} light${off.count === 1 ? "" : "s"}?`)) return;
    if (off.light.length) this._hass.callService("light", "turn_off", { entity_id: off.light });
    if (off.switch.length) this._hass.callService("switch", "turn_off", { entity_id: off.switch });
  }

  confirmAction(message) {
    return window.confirm(message);
  }

  sheetBody() {
    return this._sheetMode === "maintenance" ? this._maintenanceSheet() : this._securitySheet();
  }

  _maintenanceSheet() {
    const m = this._maintenance();
    const body = `
      ${m.lowBattery.length ? `<div class="sheet-section"><div class="section-label">Low battery (${m.lowBattery.length})</div>
        ${m.lowBattery.map((i) => this._row(i, "#dc2626", i.level == null ? "LOW" : `${i.level}%`, "level low")).join("")}</div>` : ""}
      ${m.unavailable.length ? `<div class="sheet-section"><div class="section-label">Offline (${m.unavailable.length})</div>
        ${m.unavailable.map((i) => this._row(i, "#6b7280", "offline")).join("")}</div>` : ""}
      ${m.count ? "" : `<p class="sec-empty">All batteries are fine and every device is online.</p>`}
      <p class="sec-scope">Batteries under ${m.threshold}% (battery_threshold) and devices that are unavailable. Tap one for details.</p>`;
    return sheetFrame({ title: "Maintenance", subtitle: m.count ? `${m.count} need attention` : "Nothing needs attention", body });
  }
}

/** Favorites (ControlZ favorite rooms, scenes and devices): this Home Assistant user's own list. */
export class FavoritesGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  normalizeConfig(config) {
    return { scenes_style: "chips", view_path_prefix: "room-", ...config };
  }

  usesFavorites() {
    return true;
  }

  bannerArea() {
    return "page:favorites";
  }

  structureKey() {
    return `${Object.keys(this._hass.areas || {}).length}`;
  }

  reorders() {
    return "your favorites";
  }

  /** Favorites order is the user's own (any user), saved with their favorites. */
  async moveTile(id, opts, group) {
    const kind = group === "fav-rooms" ? "area" : "entity";
    const full = favoriteOrder()[kind === "area" ? "areas" : "entities"];
    await setFavoritesOrder(this._hass, kind, reorderSubset(full, movedOrder(this._groupIds(group), id, opts)));
  }

  build(page) {
    const title = this._config.title || "Favorites";
    this.header(page, `<h1 class="page-title"><span class="title-icon" style="color:#e11d48">${ICONS.heart}</span>${escapeHtml(title)}</h1>`,
      { id: "favorites", name: title });
    const favs = favoriteLists();
    const editing = this._editMode;
    const hidden = this._hiddenSets;
    const rooms = favoriteAreas(this._hass, [...favs.areas], { hide: editing ? [] : [...hidden.areas] });
    const items = favoriteItems(this._hass, [...favs.entities], editing ? new Set() : hidden.entities);
    if (!rooms.length && !items.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty">
        <p><strong>No favorites yet.</strong></p>
        <p>Tap ♥ in a room's or device's controls, or choose View → ${this._config.editable ? (this._isAdmin ? "Edit rooms &amp; favorites" : "Edit favorites") : "Edit favorites"} and tap ♥ on any tile.</p>
        <p>Favorites are saved for your Home Assistant user and follow you to every device.</p></div>`);
      return;
    }
    if (rooms.length) {
      const section = document.createElement("section");
      section.innerHTML = `<h2>Rooms</h2><div class="grid"></div>`;
      const grid = section.querySelector(".grid");
      for (const a of rooms) {
        const tile = this.tile("room", this.roomConfig(a.area_id));
        grid.append(editing ? editWrap(tile, { kind: "area", id: a.area_id, name: a.name, move: rooms.length > 1 ? "fav-rooms" : null }) : tile);
      }
      page.append(section);
    }
    this.sections(page, items, { canMove: true, scenes: { key: "__favorites" } });
  }
}

/** Automations by room (ControlZ automation list): run, enable, details, and for admins new / edit / duplicate / delete. */
export class AutomationsGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  /** Groups by room, each in that room's saved tile order (shared with the room page). */
  _groups() {
    return automationGroups(this._hass, {
      order: areasOrder(this._config),
      hideEntities: this._hiddenSets.entities,
      includeHidden: this._editMode,
    }).map((g) => ({ ...g, items: orderItems(g.items, entitiesOrder(this._config, g.area_id)) }));
  }

  reorders() {
    return this._isAdmin ? "automations within each room" : "";
  }

  bannerArea() {
    return "page:automations";
  }

  async moveTile(id, opts, group) {
    const areaId = group.slice("auto:".length);
    const moved = movedOrder(this._groupIds(group), id, opts);
    const full = areaId === NO_AREA
      ? moved
      : groupBySection(orderItems(areaItems(this._hass, areaId), entitiesOrder(this._config, areaId))).flatMap((s) => s.items.map((i) => i.entity_id));
    await setEntitiesOrder(this._hass, areaId === NO_AREA ? null : areaId, reorderSubset(full, moved));
  }

  structureKey() {
    return this._groups().map((g) => `${g.area_id}:${g.name}:${g.items.map((i) => i.entity_id)}`).join("|");
  }

  build(page) {
    const title = this._config.title || "Automations";
    const add = this._isAdmin
      ? `<button type="button" class="head-btn" data-new-automation="">+ New automation</button><button type="button" class="head-btn" data-new-preset="">+ New preset</button>
        <button type="button" class="head-btn" data-import="">Import</button>`
      : "";
    this.header(page, `<div class="section-head" style="margin:0"><h1 class="page-title"><span class="title-icon">${ICONS.gear}</span>${escapeHtml(title)}</h1>${add}</div>`,
      { id: "automations", name: title });
    const groups = this._groups();
    if (!groups.length) {
      page.insertAdjacentHTML("beforeend", `<div class="empty"><p>No automations yet.</p>${this._isAdmin ? "<p>Use + New automation, or Home Assistant's automation editor.</p>" : ""}</div>`);
      return;
    }
    const hiddenEntities = this._hiddenSets.entities;
    for (const g of groups) {
      const section = document.createElement("section");
      const addHere = this._isAdmin && g.area_id ? `<button type="button" class="head-btn" data-new-automation="${escapeHtml(g.area_id)}">+ New</button>` : "";
      section.innerHTML = `<div class="section-head"><h2>${escapeHtml(g.name)} (${g.items.length})</h2>${addHere}</div><div class="grid"></div>`;
      const grid = section.querySelector(".grid");
      for (const item of g.items) {
        const tile = this.tile(item.kind, { entity: item.entity_id });
        grid.append(this._editMode
          ? editWrap(tile, {
            kind: "entity", id: item.entity_id, name: friendlyName(this._hass, item.entity_id), hidden: hiddenEntities.has(item.entity_id),
            canHide: this._isAdmin, move: this._isAdmin && g.items.length > 1 ? `auto:${g.area_id || NO_AREA}` : null,
          })
          : tile);
      }
      page.append(section);
    }
  }
}
