import { visibleItems } from "./area-cache.js";
import { dashboardBase, escapeHtml, fireEvent, navigate } from "./base.js";
import {
  DASHTOP_SECTIONS, agenda, chosenSources, countdown, dashtopTiles, greeting, normalizeEvents, skyPhase, statusChips, todoView,
  weatherMood, weekDays,
} from "./dashtop-model.js";
import { DASHTOP_EVENT, dashtopLayout, loadDashtop, saveDashtop } from "./dashtop-store.js";
import { favoriteLists } from "./favorites.js";
import { CzPage } from "./grids.js";
import { areasOrder, attentionIgnored, dashboardBatteryThreshold, hiddenLists } from "./hidden.js";
import { ICONS } from "./icons.js";
import { KIND, areaOfEntity, attentionReport, classifyEntity, friendlyName, isOn, securityReport, sortedAreas } from "./model.js";
import { effectiveBatteryThreshold, writePrefs } from "./prefs.js";
import { openScriptSheet } from "./preset-editor.js";
import { sheetFrame } from "./sheet.js";
import { dailyRows, pickWeather, sunView, weatherNow } from "./weather-model.js";

const DAY_MS = 86_400_000;
const CALENDAR_REFRESH_MS = 5 * 60_000;
const TICK_MS = 20_000;
const MAX_DAY_EVENTS = 4;
const CAL_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#a855f7", "#22c55e", "#ef4444"];

const calColor = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CAL_COLORS[h % CAL_COLORS.length];
};
const time = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Dashtop: the whole home at a glance (a ControlZ desktop). Greeting and status chips (security,
 * Needs Attention, lights on, running presets), clock and weather, today's calendar, a to-do list,
 * the week ahead and the user's own tiles, over a sky that follows the sun and the weather.
 * What it shows is each Home Assistant user's own (Customize).
 */
export class DashtopGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this._events = [];
    this._calKey = null;
    this._calAt = 0;
    this._todos = {};
    this._todoKeys = {};
    this._forecast = null;
    this._forecastFor = null;
    this._unsub = null;
    this._slots = {};
    this.shadowRoot.addEventListener("click", (ev) => this._onDashClick(ev));
    this.shadowRoot.addEventListener("change", (ev) => {
      const box = ev.target.closest?.("[data-todo-check]");
      if (box) this._todoSet(box.dataset.todoList, box.dataset.todoCheck, box.checked);
    });
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && ev.target.matches?.("[data-todo-input]")) this._todoAdd(ev.target.dataset.todoInput);
    });
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(DASHTOP_EVENT, this._onStructure);
    this._timer = setInterval(() => this.update(), TICK_MS);
    if (this._hass && this._config) this.update();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(DASHTOP_EVENT, this._onStructure);
    clearInterval(this._timer);
    this._unsubscribe();
  }

  _layout() {
    loadDashtop(this._hass);
    return dashtopLayout();
  }

  _tiles() {
    return dashtopTiles(this._layout(), favoriteLists()).filter((t) => {
      const [kind, id] = [t.slice(0, t.indexOf(":")), t.slice(t.indexOf(":") + 1)];
      return kind === "area" ? !!this._hass.areas?.[id] : !!this._hass.states?.[id];
    });
  }

  usesFavorites() {
    return !this._layout().tiles.length;
  }

  structureKey() {
    const layout = this._layout();
    return `${JSON.stringify(layout.sections)}|${this._tiles().join(",")}`;
  }

  build(page) {
    const layout = this._layout();
    page.classList.add("dt");
    this._slots = {};
    this._html = {};
    page.insertAdjacentHTML("afterbegin", `<div class="dt-sky" aria-hidden="true"><div class="dt-fx"></div></div>`);
    this.header(page, `<div class="dt-top">
        <div class="dt-hello"><div class="dt-greet"></div><h1 class="dt-name"></h1></div>
        <div class="dt-chips" role="group" aria-label="Home status"></div>
        <button type="button" class="dt-btn" data-dt-customize title="Choose what Dashtop shows">✎ Customize</button>
      </div>`, { id: "dashtop", name: "Dashtop" });
    const s = layout.sections;
    page.insertAdjacentHTML("beforeend", `<div class="dt-grid">
      ${s.clock ? `<section class="dt-panel dt-hero" data-slot="hero"></section>` : ""}
      ${s.today ? `<section class="dt-panel dt-today" data-slot="today"></section>` : ""}
      ${s.todo ? `<section class="dt-panel dt-todo" data-slot="todo"></section>` : ""}
      ${s.week ? `<section class="dt-panel dt-week" data-slot="week"></section>` : ""}
    </div>`);
    if (s.tiles) {
      const section = document.createElement("section");
      section.className = "dt-panel dt-tiles";
      section.innerHTML = `<div class="dt-ph"><h2>My tiles</h2><button type="button" class="dt-link" data-dt-customize>Choose…</button></div>`;
      const tiles = this._tiles();
      if (tiles.length) {
        const grid = document.createElement("div");
        grid.className = "grid";
        for (const t of tiles) {
          const id = t.slice(t.indexOf(":") + 1);
          if (t.startsWith("area:")) grid.append(this.tile("room", this.roomConfig(id)));
          else grid.append(this.tile(classifyEntity(id, this._hass.states[id], this._hass.entities?.[id]) || KIND.OTHER, { entity: id }));
        }
        section.append(grid);
      } else {
        section.insertAdjacentHTML("beforeend", `<p class="hint">Choose rooms and devices with Customize, or tap ♥ on any room or device to add a favorite.</p>`);
      }
      page.append(section);
    }
    for (const el of page.querySelectorAll("[data-slot]")) this._slots[el.dataset.slot] = el;
  }

  /** Each slot is re-rendered only when its markup changes (Home Assistant pushes `hass` constantly). */
  _fill(slot, html) {
    const el = slot === "chips" ? this.shadowRoot.querySelector(".dt-chips") : this._slots[slot];
    if (!el || this._html[slot] === html) return;
    if (slot === "todo" && el.contains(this.shadowRoot.activeElement) && this.shadowRoot.activeElement?.matches?.("input[type=text]")) return;
    this._html[slot] = html;
    el.innerHTML = html;
  }

  update() {
    if (!this._hass || !this.shadowRoot.querySelector(".dt")) return;
    const now = new Date();
    const layout = this._layout();
    const sources = chosenSources(this._hass, layout);
    this._sky(now);
    const greet = this.shadowRoot.querySelector(".dt-greet");
    const name = this.shadowRoot.querySelector(".dt-name");
    const text = `${greeting(now)}${this._hass.user?.name ? "," : ""}`;
    if (greet && greet.textContent !== text) greet.textContent = text;
    const who = this._hass.user?.name || now.toLocaleDateString([], { weekday: "long" });
    if (name && name.textContent !== who) name.textContent = who;
    this._fill("chips", this._chipsHtml());
    if (layout.sections.clock) this._fill("hero", this._heroHtml(now));
    if (layout.sections.today || layout.sections.week) this._loadCalendars(sources.calendars, now);
    if (layout.sections.today) this._fill("today", this._todayHtml(now, sources));
    if (layout.sections.todo) {
      this._loadTodos(sources.todos);
      this._fill("todo", this._todoHtml(sources));
    }
    if (layout.sections.week) this._fill("week", this._weekHtml(now, sources));
  }

  _sky(now) {
    const sky = this.shadowRoot.querySelector(".dt-sky");
    if (!sky) return;
    const weatherId = pickWeather(this._hass, this._config.weather_entity);
    const cls = `dt-sky phase-${skyPhase(this._hass.states["sun.sun"], now)} mood-${weatherMood(this._hass.states[weatherId]?.state)}`;
    if (sky.className !== cls) sky.className = cls;
  }

  // Status chips.

  _counts() {
    const hidden = hiddenLists(this._config);
    const areas = sortedAreas(this._hass, { order: areasOrder(this._config) }).filter((a) => !hidden.areas.has(a.area_id));
    const items = areas.flatMap((a) => visibleItems(this._hass, a.area_id, this._config));
    const lightsOn = items.filter((i) => (i.kind === KIND.LIGHT || i.kind === KIND.SWITCH) && isOn(this._hass.states[i.entity_id])).length;
    const running = Object.keys(this._hass.states)
      .filter((id) => id.startsWith("script.") && !hidden.entities.has(id) && this._hass.states[id].state === "on")
      .map((id) => ({ entity_id: id, name: friendlyName(this._hass, id) }));
    const attention = this._config.attention_view === false ? 0 : attentionReport(this._hass, {
      threshold: effectiveBatteryThreshold(dashboardBatteryThreshold(this._config)),
      exclude: [...hidden.entities],
      ignore: [...attentionIgnored(this._config)],
    }).count;
    const report = securityReport(this._hass, { include: this._config.security_include, exclude: this._config.security_exclude });
    const security = { level: report.level, count: report[report.level]?.length || 0 };
    return { lightsOn, running, attention, security };
  }

  _chipsHtml() {
    const chips = statusChips(this._counts());
    const wx = this._weatherNow();
    const temp = wx && wx.temperature != null
      ? `<span class="dt-chip weather" title="${escapeHtml(wx.label)}"><span aria-hidden="true">${wx.emoji}</span>${Math.round(wx.temperature)}° ${escapeHtml(wx.label)}</span>`
      : "";
    return chips.map((c) => `<button type="button" class="dt-chip ${c.level}" data-chip="${escapeHtml(c.id)}">
        <span aria-hidden="true">${c.icon}</span>${escapeHtml(c.text)}${c.id === "attention" ? `<span class="dt-chip-go" aria-hidden="true">›</span>` : ""}</button>`).join("") + temp;
  }

  // Clock and weather.

  _weatherNow() {
    const id = pickWeather(this._hass, this._config.weather_entity);
    if (!id) return null;
    this._subscribe(id);
    return weatherNow(this._hass.states[id]);
  }

  _subscribe(entityId) {
    if (this._forecastFor === entityId || !this.isConnected) return;
    this._unsubscribe();
    this._forecastFor = entityId;
    const conn = this._hass.connection;
    const f = this._hass.states[entityId]?.attributes?.supported_features ?? 0;
    const type = f & 1 ? "daily" : f & 4 ? "twice_daily" : null;
    if (!conn?.subscribeMessage || !type) return;
    try {
      this._unsub = conn.subscribeMessage((msg) => {
        this._forecast = msg?.forecast || [];
        this.update();
      }, { type: "weather/subscribe_forecast", forecast_type: type, entity_id: entityId }).catch(() => null);
    } catch {
      this._unsub = null;
    }
  }

  _unsubscribe() {
    Promise.resolve(this._unsub).then((off) => off?.()).catch(() => {});
    this._unsub = null;
    this._forecastFor = null;
  }

  _heroHtml(now) {
    const parts = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).formatToParts(now);
    const clock = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
    const ampm = parts.find((p) => p.type === "dayPeriod")?.value || "";
    const wx = this._weatherNow();
    const id = pickWeather(this._hass, this._config.weather_entity);
    const legacy = this._hass.states[id]?.attributes?.forecast;
    const today = dailyRows(this._forecast || (Array.isArray(legacy) ? legacy : []), 1)[0];
    const sun = sunView(this._hass.states["sun.sun"]);
    const sunLine = sun.known
      ? (sun.up ? `🌇 Sunset ${time(sun.sunset)}` : `🌅 Sunrise ${time(sun.sunrise)}`)
      : "";
    return `<div class="dt-clock"><span class="dt-time">${escapeHtml(clock)}</span>${ampm ? `<span class="dt-ampm">${escapeHtml(ampm)}</span>` : ""}</div>
      <div class="dt-date">${escapeHtml(now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }))}</div>
      ${wx && !wx.offline ? `<div class="dt-wx">
        <span class="dt-wx-emoji" aria-hidden="true">${wx.emoji}</span>
        <span class="dt-wx-temp">${wx.temperature == null ? "—" : `${Math.round(wx.temperature)}°`}</span>
        <span class="dt-wx-text"><strong>${escapeHtml(wx.label)}</strong>
          <span>${[today?.high != null && `H ${today.high}°`, today?.low != null && `L ${today.low}°`, wx.feels != null && `Feels ${Math.round(wx.feels)}°`].filter(Boolean).join(" · ")}</span></span>
      </div>` : ""}
      ${sunLine ? `<div class="dt-sun">${sunLine}${today?.rain ? ` · 💧 ${today.rain}% rain` : ""}</div>` : ""}`;
  }

  // Calendars.

  async _loadCalendars(ids, now) {
    const day = startOfDay(now.getTime());
    const key = `${ids.join(",")}|${day}`;
    if (key === this._calKey && Date.now() - this._calAt < CALENDAR_REFRESH_MS) return;
    this._calKey = key;
    this._calAt = Date.now();
    if (!ids.length) {
      this._events = [];
      return;
    }
    const start = new Date(day).toISOString();
    const end = new Date(day + 8 * DAY_MS).toISOString();
    const results = await Promise.allSettled(ids.map((id) =>
      this._hass.callApi("GET", `calendars/${encodeURIComponent(id)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
        .then((raw) => normalizeEvents(raw, id))));
    if (key !== this._calKey) return;
    this._calLoaded = true;
    this._events = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).sort((a, b) => a.start - b.start);
    this._calError = results.length && results.every((r) => r.status === "rejected");
    this.update();
  }

  _calName(id) {
    return friendlyName(this._hass, id);
  }

  _eventRow(e, now) {
    const live = !e.allDay && e.start <= now && e.end > now;
    return `<li class="dt-ev${live ? " live" : ""}${!e.allDay && e.end <= now ? " past" : ""}" style="--cal:${calColor(e.calendar)}">
      <span class="dt-ev-time">${e.allDay ? "All day" : `${escapeHtml(time(e.start))}<small>${escapeHtml(time(e.end))}</small>`}</span>
      <span class="dt-ev-body"><strong>${escapeHtml(e.summary)}</strong>${e.location || live ? `<small>${live ? "Now" : ""}${live && e.location ? " · " : ""}${escapeHtml(e.location)}</small>` : ""}</span>
    </li>`;
  }

  _todayHtml(now, sources) {
    const t = now.getTime();
    const a = agenda(this._events, t);
    const count = a.allDay.length + a.timed.length;
    const head = `<div class="dt-ph"><h2>Today</h2><span class="dt-muted">${count ? `${count} event${count === 1 ? "" : "s"}` : ""}</span></div>`;
    if (!sources.allCalendars.length) {
      return `${head}<p class="hint">Add a calendar in Home Assistant (Local Calendar, Google, CalDAV…) and today's events show here.</p>`;
    }
    if (this._calError) return `${head}<p class="hint">Home Assistant did not return the calendars.</p>`;
    if (!this._calLoaded && sources.calendars.length) return `${head}<p class="dt-empty">Loading…</p>`;
    const next = a.next
      ? `<div class="dt-next" style="--cal:${calColor(a.next.calendar)}"><span>Next</span><strong>${escapeHtml(a.next.summary)}</strong><span>${escapeHtml(countdown(a.nextIn))}</span></div>`
      : "";
    const rows = [...a.allDay, ...a.timed].map((e) => this._eventRow(e, t)).join("");
    return `${head}${next}${rows ? `<ul class="dt-evs">${rows}</ul>` : `<p class="dt-empty">Nothing on today.</p>`}`;
  }

  _weekHtml(now, sources) {
    const days = weekDays(this._events, now.getTime(), 7);
    const total = days.reduce((n, d) => n + d.events.length, 0);
    const cols = days.map((d) => {
      const date = new Date(d.start);
      const shown = d.events.slice(0, MAX_DAY_EVENTS);
      return `<div class="dt-day${d.today ? " today" : ""}">
        <div class="dt-day-head"><span>${d.today ? "Today" : escapeHtml(date.toLocaleDateString([], { weekday: "short" }))}</span><strong>${date.getDate()}</strong></div>
        ${shown.map((e) => `<div class="dt-pill${e.allDay ? " all" : ""}" style="--cal:${calColor(e.calendar)}" title="${escapeHtml(`${e.summary}${e.allDay ? "" : ` · ${time(e.start)}`}`)}">
          ${e.allDay ? "" : `<small>${escapeHtml(time(e.start))}</small>`}${escapeHtml(e.summary)}</div>`).join("")}
        ${d.events.length > MAX_DAY_EVENTS ? `<div class="dt-more">+${d.events.length - MAX_DAY_EVENTS} more</div>` : ""}
      </div>`;
    }).join("");
    const legend = sources.calendars.length > 1
      ? `<span class="dt-legend">${sources.calendars.map((id) => `<span style="--cal:${calColor(id)}">${escapeHtml(this._calName(id))}</span>`).join("")}</span>`
      : "";
    return `<div class="dt-ph"><h2>This week</h2>${legend}<span class="dt-muted">${total ? `${total} event${total === 1 ? "" : "s"}` : ""}</span></div>
      ${sources.allCalendars.length ? `<div class="dt-days">${cols}</div>` : `<p class="hint">No calendars in Home Assistant yet.</p>`}`;
  }

  // To-do lists.

  async _loadTodos(ids) {
    for (const id of ids) {
      const s = this._hass.states[id];
      const key = `${s?.state}|${s?.last_updated}`;
      if (this._todoKeys[id] === key) continue;
      this._todoKeys[id] = key;
      try {
        const result = await this._hass.callWS({ type: "todo/item/list", entity_id: id });
        this._todos = { ...this._todos, [id]: result?.items || [] };
      } catch {
        this._todos = { ...this._todos, [id]: null };
      }
      this.update();
    }
  }

  _todoHtml(sources) {
    if (!sources.allTodos.length) {
      return `<div class="dt-ph"><h2>To do</h2></div><p class="hint">Add a to-do list in Home Assistant (Local To-do, Shopping list…) and it shows here.</p>`;
    }
    return sources.todos.map((id) => {
      const items = this._todos[id];
      const v = todoView(items || []);
      const list = items == null ? `<p class="hint">${items === null ? "Could not read this list." : "Loading…"}</p>` : `
        <ul class="dt-todos">${v.open.map((i) => `<li><label><input type="checkbox" data-todo-list="${escapeHtml(id)}" data-todo-check="${escapeHtml(i.uid ?? i.summary)}" />
          <span>${escapeHtml(i.summary)}${i.due ? `<small>${escapeHtml(new Date(i.due).toLocaleDateString([], { day: "numeric", month: "short" }))}</small>` : ""}</span></label></li>`).join("")}</ul>
        ${v.open.length ? "" : `<p class="dt-empty">All done.</p>`}
        ${v.done.length ? `<details class="dt-done"><summary>${v.done.length} done</summary><ul class="dt-todos">${v.done.map((i) => `<li class="done"><label>
          <input type="checkbox" checked data-todo-list="${escapeHtml(id)}" data-todo-check="${escapeHtml(i.uid ?? i.summary)}" /><span>${escapeHtml(i.summary)}</span></label></li>`).join("")}</ul></details>` : ""}`;
      return `<div class="dt-ph"><h2>${escapeHtml(friendlyName(this._hass, id))}</h2><span class="dt-muted">${items ? `${v.open.length} to do` : ""}</span></div>
        ${list}
        <div class="dt-add"><input type="text" data-todo-input="${escapeHtml(id)}" placeholder="Add a task…" aria-label="Add to ${escapeHtml(friendlyName(this._hass, id))}" />
          <button type="button" data-todo-add="${escapeHtml(id)}" aria-label="Add">+</button></div>`;
    }).join(`<div class="dt-sep"></div>`);
  }

  async _todoSet(list, item, done) {
    await this._hass.callService("todo", "update_item", { entity_id: list, item, status: done ? "completed" : "needs_action" });
    this._todoKeys[list] = null;
  }

  async _todoAdd(list) {
    const input = this.shadowRoot.querySelector(`[data-todo-input="${CSS.escape(list)}"]`);
    const text = input?.value.trim();
    if (!text) return;
    input.value = "";
    input.blur();
    await this._hass.callService("todo", "add_item", { entity_id: list, item: text });
    this._todoKeys[list] = null;
  }

  // Navigation.

  _go(page) {
    if (this._config.select_rooms) fireEvent(this, "controlz-select-area", { area: page === "rooms" ? null : `__${page}` });
    else navigate(page === "rooms" ? `${dashboardBase()}/rooms` : `${dashboardBase()}/${page}`);
  }

  _onDashClick(ev) {
    const hit = ev.composedPath().find((el) => el instanceof HTMLElement && el.matches?.("[data-chip], [data-dt-customize], [data-todo-add]"));
    if (!hit) return;
    if (hit.hasAttribute("data-dt-customize")) openDashtopCustomize(this);
    else if (hit.dataset.todoAdd) this._todoAdd(hit.dataset.todoAdd);
    else if (hit.dataset.chip === "security") this._openSheet("security");
    else if (hit.dataset.chip === "attention") this._go("attention");
    else if (hit.dataset.chip === "lights") {
      writePrefs({ home_filter: "on" });
      this._go("rooms");
    } else if (hit.dataset.chip.startsWith("script:")) openScriptSheet(this, hit.dataset.chip.slice("script:".length));
  }

  styles() {
    return DASHTOP_STYLES;
  }
}

/** Customize Dashtop (any user, saved for them): sections, calendars, to-do lists and tiles in order. */
class DashtopCustomize {
  constructor(host) {
    this._host = host;
    this._draft = structuredClone(dashtopLayout());
    const sources = chosenSources(host.hass, this._draft);
    this._cals = new Set(sources.calendars);
    this._todos = new Set(sources.todos);
    this._tiles = [...dashtopTiles(this._draft, favoriteLists())];
    this._tilesChanged = false;
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

  _rerender() {
    this._host._sheet?.refresh(true);
  }

  _label(t) {
    const id = t.slice(t.indexOf(":") + 1);
    if (t.startsWith("area:")) return `${this.hass.areas?.[id]?.name || id} (room)`;
    const area = areaOfEntity(this.hass, id);
    return `${friendlyName(this.hass, id)}${area ? ` · ${this.hass.areas?.[area]?.name || area}` : ""}`;
  }

  /** Rooms, then every device that gets a tile, grouped by room in dashboard order. */
  _addOptions() {
    const config = this._host._config || {};
    const taken = new Set(this._tiles);
    const rooms = sortedAreas(this.hass, { order: areasOrder(config) });
    const opt = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    const roomOpts = rooms.filter((a) => !taken.has(`area:${a.area_id}`)).map((a) => opt(`area:${a.area_id}`, a.name)).join("");
    const groups = rooms.map((a) => {
      const items = visibleItems(this.hass, a.area_id, config).filter((i) => !taken.has(`entity:${i.entity_id}`));
      return items.length ? `<optgroup label="${escapeHtml(a.name)}">${items.map((i) => opt(`entity:${i.entity_id}`, friendlyName(this.hass, i.entity_id))).join("")}</optgroup>` : "";
    }).join("");
    return `<option value="">Add a room or device…</option>${roomOpts ? `<optgroup label="Rooms">${roomOpts}</optgroup>` : ""}${groups}`;
  }

  sheetBody() {
    const sources = chosenSources(this.hass, this._draft);
    const check = (action, value, label, on) => `<label class="check-row"><input type="checkbox" data-action="${action}" value="${escapeHtml(value)}" ${on ? "checked" : ""} /><span>${escapeHtml(label)}</span></label>`;
    const body = `
      <div class="sheet-section"><div class="section-label">Show</div>
        <div class="check-list">${DASHTOP_SECTIONS.map((s) => check("dc-section", s.id, s.label, this._draft.sections[s.id])).join("")}</div></div>
      <div class="sheet-section"><div class="section-label">Calendars</div>
        ${sources.allCalendars.length ? `<div class="check-list">${sources.allCalendars.map((id) => check("dc-cal", id, friendlyName(this.hass, id), this._cals.has(id))).join("")}</div>`
          : `<p class="note">No calendars in Home Assistant yet.</p>`}</div>
      <div class="sheet-section"><div class="section-label">To-do lists</div>
        ${sources.allTodos.length ? `<div class="check-list">${sources.allTodos.map((id) => check("dc-todo", id, friendlyName(this.hass, id), this._todos.has(id))).join("")}</div>`
          : `<p class="note">No to-do lists in Home Assistant yet.</p>`}</div>
      <div class="sheet-section"><div class="section-label">My tiles, in order</div>
        ${this._tiles.length ? `<ol class="dc-tiles">${this._tiles.map((t, i) => `<li><span>${escapeHtml(this._label(t))}</span>
          <button type="button" class="btn secondary" data-action="dc-move" data-index="${i}" data-delta="-1" ${i ? "" : "disabled"} aria-label="Move up">↑</button>
          <button type="button" class="btn secondary" data-action="dc-move" data-index="${i}" data-delta="1" ${i < this._tiles.length - 1 ? "" : "disabled"} aria-label="Move down">↓</button>
          <button type="button" class="btn secondary" data-action="dc-remove" data-index="${i}" aria-label="Remove">✕</button></li>`).join("")}</ol>`
          : `<p class="note">No tiles: your favorites show instead.</p>`}
        ${!this._draft.tiles.length && !this._tilesChanged && this._tiles.length ? `<p class="note">These are your favorites; they keep following ♥ until you change this list.</p>` : ""}
        <label class="field"><span>Add</span><select data-action="dc-add" aria-label="Add a room or device">${this._addOptions()}</select></label>
      </div>
      ${this._error ? `<p class="error">${escapeHtml(this._error)}</p>` : ""}
      <p class="note">Saved for your Home Assistant user, so it follows you to every device; everyone in the house has their own Dashtop.</p>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="dc-save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save"}</button>`;
    return sheetFrame({ title: "Customize Dashtop", subtitle: "", body, footer });
  }

  async _save() {
    const sources = chosenSources(this.hass, this._draft);
    const all = (set, list) => (list.every((id) => set.has(id)) && set.size === list.length ? null : [...set]);
    this._saving = true;
    this._rerender();
    try {
      await saveDashtop(this.hass, {
        sections: this._draft.sections,
        calendars: all(this._cals, sources.allCalendars),
        todos: [...this._todos],
        // Untouched tiles keep following the user's favorites.
        tiles: this._tilesChanged ? this._tiles : this._draft.tiles,
      });
      this._host._sheet?.close();
    } catch (err) {
      this._saving = false;
      this._error = err?.message || "Could not save.";
      this._rerender();
    }
  }

  get actions() {
    const toggle = (set) => (input) => {
      if (input.checked) set.add(input.value);
      else set.delete(input.value);
    };
    return {
      "change:dc-section": (input) => {
        this._draft.sections = { ...this._draft.sections, [input.value]: input.checked };
      },
      "change:dc-cal": toggle(this._cals),
      "change:dc-todo": toggle(this._todos),
      "change:dc-add": (select) => {
        if (!select.value) return;
        this._tiles = [...this._tiles, select.value];
        this._tilesChanged = true;
        this._rerender();
      },
      "dc-move": (button) => {
        const i = Number(button.dataset.index);
        const j = i + Number(button.dataset.delta);
        if (j < 0 || j >= this._tiles.length) return;
        const next = [...this._tiles];
        [next[i], next[j]] = [next[j], next[i]];
        this._tiles = next;
        this._tilesChanged = true;
        this._rerender();
      },
      "dc-remove": (button) => {
        this._tiles = this._tiles.filter((_, i) => i !== Number(button.dataset.index));
        this._tilesChanged = true;
        this._rerender();
      },
      "dc-save": () => this._save(),
    };
  }
}

export function openDashtopCustomize(host) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new DashtopCustomize(host));
}

const DASHTOP_STYLES = `
  .page.dt { position: relative; isolation: isolate; container: dt / inline-size; min-height: 100%; }
  .dt-sky {
    position: absolute; inset: 0; z-index: -1; overflow: hidden; border-radius: 0 0 28px 28px;
    background: linear-gradient(180deg, #7cc3f0 0%, #bfe3fa 60%, #e9f6ff 100%); transition: background 2s ease;
  }
  .dt-sky.phase-dawn { background: linear-gradient(180deg, #2b3a67 0%, #b86f8a 45%, #f6a07a 75%, #fde2b8 100%); }
  .dt-sky.phase-dusk { background: linear-gradient(180deg, #1f1640 0%, #5b2a6e 40%, #c4577a 72%, #f39a6b 100%); }
  .dt-sky.phase-night { background: linear-gradient(180deg, #060b1f 0%, #121a3a 55%, #1f2a55 100%); }
  .dt-sky.mood-cloudy, .dt-sky.mood-fog { filter: saturate(0.6); }
  .dt-sky.mood-rain, .dt-sky.mood-storm { filter: saturate(0.45) brightness(0.85); }
  .dt-fx { position: absolute; inset: -50% 0 0 0; pointer-events: none; }
  .phase-night.mood-clear .dt-fx {
    background-image: radial-gradient(1.5px 1.5px at 10% 20%, #fff 50%, transparent), radial-gradient(1px 1px at 30% 60%, #fff 50%, transparent),
      radial-gradient(1.5px 1.5px at 55% 30%, #fff 50%, transparent), radial-gradient(1px 1px at 70% 70%, #fff 50%, transparent),
      radial-gradient(1.5px 1.5px at 85% 15%, #fff 50%, transparent), radial-gradient(1px 1px at 45% 85%, #fff 50%, transparent);
    background-size: 420px 300px; opacity: 0.8; animation: dt-twinkle 6s ease-in-out infinite alternate;
  }
  .mood-cloudy .dt-fx, .mood-fog .dt-fx {
    background-image: radial-gradient(closest-side, rgba(255,255,255,0.55), transparent), radial-gradient(closest-side, rgba(255,255,255,0.4), transparent);
    background-size: 520px 180px, 380px 140px; background-position: 0 30%, 200px 55%; background-repeat: repeat-x;
    animation: dt-drift 120s linear infinite;
  }
  .mood-fog .dt-fx { opacity: 1; filter: blur(8px); }
  .mood-rain .dt-fx, .mood-storm .dt-fx {
    background-image: linear-gradient(transparent 70%, rgba(255,255,255,0.35) 70%, rgba(255,255,255,0.35) 100%);
    background-size: 2px 46px; transform: skewX(-12deg); animation: dt-fall 0.9s linear infinite;
  }
  .mood-snow .dt-fx {
    background-image: radial-gradient(2.5px 2.5px at 20% 30%, #fff 60%, transparent), radial-gradient(2px 2px at 60% 70%, #fff 60%, transparent),
      radial-gradient(3px 3px at 80% 20%, #fff 60%, transparent);
    background-size: 220px 220px; animation: dt-fall 12s linear infinite;
  }
  @keyframes dt-twinkle { to { opacity: 0.45; } }
  @keyframes dt-drift { to { background-position: 1040px 30%, 960px 55%; } }
  @keyframes dt-fall { to { transform: translateY(50%) skewX(-12deg); } }
  @media (prefers-reduced-motion: reduce) { .dt-fx { animation: none !important; } }

  .dt .page-head { margin-bottom: 14px; }
  .dt-top {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 16px; border-radius: 22px;
    background: color-mix(in srgb, var(--cz-card-bg) 62%, transparent); backdrop-filter: blur(18px) saturate(1.3);
    -webkit-backdrop-filter: blur(18px) saturate(1.3); border: 1px solid color-mix(in srgb, #fff 35%, transparent);
    box-shadow: 0 8px 30px rgba(15,23,42,0.12);
  }
  .dt-hello { min-width: 0; }
  .dt-greet { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cz-text-secondary); }
  .dt-name { margin: 0; font-size: 1.35rem; line-height: 1.15; }
  .dt-chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 0; justify-content: flex-end; }
  .dt-chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font: inherit; font-size: 0.82rem; font-weight: 700;
    border: 1px solid transparent; background: color-mix(in srgb, var(--cz-card-bg) 80%, transparent); color: var(--cz-text); cursor: pointer;
  }
  .dt-chip.secure { background: #dcfce7; color: #14532d; }
  .dt-chip.insecure { background: #fee2e2; color: #7f1d1d; border-color: #fca5a5; }
  .dt-chip.warning { background: #ffedd5; color: #7c2d12; border-color: #fdba74; }
  .dt-chip.motion { background: #fef3c7; color: #78350f; }
  .dt-chip.on { background: #fef3c7; color: #713f12; }
  .dt-chip.running { background: #dcfce7; color: #14532d; }
  .dt-chip.weather { cursor: default; }
  .dt-chip-go { font-size: 1.05rem; line-height: 0.8; }
  .dt-btn, .dt-link {
    border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-primary); border-radius: 999px;
    padding: 6px 12px; font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap;
  }
  .dt-link { padding: 3px 10px; }

  /* Wide: clock | today | to-do in one row. Medium: clock over to-do, today beside both. Narrow: one column. */
  .dt-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); grid-auto-flow: row dense; margin-bottom: 14px; }
  @container dt (min-width: 700px) {
    .dt-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dt-hero, .dt-todo { grid-column: 1; }
    .dt-today { grid-column: 2; grid-row: span 2; }
    .dt-grid:not(:has(.dt-todo)) .dt-today, .dt-grid:not(:has(.dt-hero)) .dt-today { grid-row: span 1; }
    .dt-grid:not(:has(.dt-today)) .dt-todo { grid-column: 2; }
  }
  @container dt (min-width: 1120px) {
    .dt-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .dt-hero { grid-column: span 4; }
    .dt-today { grid-column: span 5; grid-row: auto; }
    .dt-todo { grid-column: span 3; }
    .dt-grid:not(:has(.dt-todo)) .dt-today { grid-column: span 8; }
    .dt-grid:not(:has(.dt-today)) .dt-todo { grid-column: span 8; }
  }
  .dt-week { grid-column: 1 / -1; }
  .dt-panel {
    min-width: 0; padding: 16px; border-radius: 22px; background: color-mix(in srgb, var(--cz-card-bg) 70%, transparent);
    backdrop-filter: blur(18px) saturate(1.3); -webkit-backdrop-filter: blur(18px) saturate(1.3);
    border: 1px solid color-mix(in srgb, #fff 30%, transparent); box-shadow: 0 8px 30px rgba(15,23,42,0.12);
  }
  .dt-ph { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .dt-ph h2 { margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dt-muted { font-size: 0.78rem; font-weight: 600; color: var(--cz-text-secondary); white-space: nowrap; }
  .dt-empty { margin: 4px 0; color: var(--cz-text-secondary); font-size: 0.9rem; }
  .dt-sep { height: 1px; background: var(--cz-border); margin: 12px 0; }

  .dt-hero { display: flex; flex-direction: column; gap: 6px; }
  .dt-clock { display: flex; align-items: baseline; gap: 6px; }
  .dt-time { font-size: clamp(3rem, 8cqi, 4.6rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
  .dt-ampm { font-size: 1.1rem; font-weight: 700; color: var(--cz-text-secondary); }
  .dt-date { font-size: 1rem; font-weight: 600; }
  .dt-wx { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .dt-wx-emoji { font-size: 2.6rem; line-height: 1; }
  .dt-wx-temp { font-size: 2.4rem; font-weight: 800; line-height: 1; }
  .dt-wx-text { display: flex; flex-direction: column; font-size: 0.85rem; }
  .dt-wx-text span { color: var(--cz-text-secondary); font-weight: 600; }
  .dt-sun { margin-top: auto; padding-top: 8px; font-size: 0.82rem; font-weight: 600; color: var(--cz-text-secondary); }

  .dt-next {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 14px; margin-bottom: 10px; font-size: 0.88rem;
    background: color-mix(in srgb, var(--cal) 16%, transparent); border: 1px solid color-mix(in srgb, var(--cal) 40%, transparent);
  }
  .dt-next span:first-child { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cal); }
  .dt-next strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dt-next span:last-child { font-weight: 700; white-space: nowrap; }
  .dt-evs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .dt-ev { display: flex; gap: 10px; padding: 8px 10px; border-radius: 12px; background: color-mix(in srgb, var(--cz-card-bg) 70%, transparent); border-left: 4px solid var(--cal); }
  .dt-ev.live { box-shadow: 0 0 0 2px var(--cal) inset; }
  .dt-ev.past { opacity: 0.55; }
  .dt-ev-time { min-width: 4.6rem; font-size: 0.8rem; font-weight: 700; display: flex; flex-direction: column; font-variant-numeric: tabular-nums; }
  .dt-ev-time small, .dt-ev-body small { font-weight: 600; color: var(--cz-text-secondary); font-size: 0.75rem; }
  .dt-ev-body { display: flex; flex-direction: column; min-width: 0; font-size: 0.9rem; }
  .dt-ev-body strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .dt-days { display: grid; grid-template-columns: repeat(7, minmax(110px, 1fr)); gap: 8px; overflow-x: auto; padding-bottom: 4px; }
  .dt-day { min-height: 120px; padding: 10px; border-radius: 16px; background: color-mix(in srgb, var(--cz-card-bg) 60%, transparent); display: flex; flex-direction: column; gap: 5px; }
  .dt-day.today { background: color-mix(in srgb, var(--cz-primary) 14%, var(--cz-card-bg)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--cz-primary) 50%, transparent) inset; }
  .dt-day-head { display: flex; flex-direction: column; margin-bottom: 2px; }
  .dt-day-head span { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cz-text-secondary); }
  .dt-day-head strong { font-size: 1.4rem; line-height: 1.1; }
  .dt-pill {
    font-size: 0.78rem; font-weight: 600; padding: 4px 8px; border-radius: 10px; overflow: hidden; line-height: 1.3;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: break-word; hyphens: auto;
    background: color-mix(in srgb, var(--cal) 14%, transparent); border-left: 3px solid var(--cal);
  }
  .dt-pill.all { background: color-mix(in srgb, var(--cal) 30%, transparent); }
  .dt-pill small { font-weight: 800; margin-right: 4px; }
  .dt-more { font-size: 0.72rem; font-weight: 700; color: var(--cz-text-secondary); }
  .dt-legend { display: inline-flex; gap: 10px; flex-wrap: wrap; font-size: 0.75rem; font-weight: 600; }
  .dt-legend span::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--cal); margin-right: 4px; }

  .dt-todos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .dt-todos label { display: flex; align-items: flex-start; gap: 10px; padding: 7px 8px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; }
  .dt-todos label:hover { background: color-mix(in srgb, var(--cz-card-bg) 70%, transparent); }
  .dt-todos input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--cz-primary); flex-shrink: 0; }
  .dt-todos span { display: flex; flex-direction: column; min-width: 0; }
  .dt-todos small { font-size: 0.72rem; color: var(--cz-text-secondary); font-weight: 600; }
  .dt-todos .done span { text-decoration: line-through; opacity: 0.6; }
  .dt-done summary { cursor: pointer; font-size: 0.78rem; font-weight: 700; color: var(--cz-text-secondary); margin: 6px 0 2px; }
  .dt-add { display: flex; gap: 6px; margin-top: 10px; }
  .dt-add input { flex: 1; min-width: 0; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-text); font: inherit; }
  .dt-add button { width: 38px; border-radius: 12px; border: none; background: var(--cz-primary); color: #fff; font-size: 1.2rem; font-weight: 700; cursor: pointer; }

  .dt-tiles .grid { margin-top: 4px; }
`;
