/**
 * Dashtop (a ControlZ desktop for the whole home): greeting, sky, calendar agenda and week,
 * status chips and the user's own layout. Pure: unit tested in test/dashtop-model.test.js.
 */

const DAY_MS = 86_400_000;

/** "Good morning" (5–12), "Good afternoon" (12–17), "Good evening" (17–22), else "Good night". */
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

/** Sky for the background: night below -6°, dawn / dusk within ±6° (rising or setting), day above; by the hour without `sun.sun`. */
export function skyPhase(sunState, now = new Date()) {
  const e = sunState?.attributes?.elevation;
  if (typeof e === "number" && Number.isFinite(e)) {
    if (e > 6) return "day";
    if (e < -6) return "night";
    const rising = sunState.attributes.rising;
    return (typeof rising === "boolean" ? rising : now.getHours() < 12) ? "dawn" : "dusk";
  }
  const h = now.getHours();
  if (h >= 7 && h < 18) return "day";
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 18 && h < 20) return "dusk";
  return "night";
}

/** What the sky shows over it: clear, cloudy, rain, storm, snow or fog (from a weather state). */
export function weatherMood(state) {
  if (["rainy", "pouring"].includes(state)) return "rain";
  if (["lightning", "lightning-rainy", "exceptional"].includes(state)) return "storm";
  if (["snowy", "snowy-rainy", "hail"].includes(state)) return "snow";
  if (state === "fog") return "fog";
  if (["cloudy", "partlycloudy", "windy", "windy-variant"].includes(state)) return "cloudy";
  return "clear";
}

const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** `{ t, allDay }` from a calendar time: `{ dateTime }`, `{ date }` or a plain string. Dates are local midnight. */
export function parseEventTime(value) {
  const raw = typeof value === "string" ? value : value?.dateTime ?? value?.date;
  if (typeof raw !== "string") return null;
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (date) return { t: new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3])).getTime(), allDay: true };
  const t = Date.parse(raw);
  return Number.isFinite(t) ? { t, allDay: false } : null;
}

/** Events from Home Assistant's calendar API (`/api/calendars/<entity>`), sorted by start; bad entries dropped. */
export function normalizeEvents(raw, calendar) {
  const out = [];
  for (const [i, e] of (Array.isArray(raw) ? raw : []).entries()) {
    const start = parseEventTime(e?.start);
    if (!start) continue;
    const end = parseEventTime(e?.end) || { t: start.t + (start.allDay ? DAY_MS : 3_600_000), allDay: start.allDay };
    out.push({
      id: `${calendar}|${e.uid ?? i}|${start.t}`, calendar, summary: String(e.summary || "Event"),
      start: start.t, end: Math.max(end.t, start.t), allDay: start.allDay, location: e.location || "",
    });
  }
  return out.sort((a, b) => a.start - b.start || a.summary.localeCompare(b.summary));
}

/** Events that touch the local day starting at `dayStart` (all-day events end exclusive). */
export const eventsOnDay = (events, dayStart) =>
  events.filter((e) => e.start < dayStart + DAY_MS && (e.end > dayStart || (e.end === e.start && e.start >= dayStart)));

/** `days` day columns from today: `{ start, today, events }`. */
export function weekDays(events, now = Date.now(), days = 7) {
  const first = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const start = startOfDay(first + i * DAY_MS + 3_600_000 * 3);
    return { start, today: i === 0, events: eventsOnDay(events, start) };
  });
}

/** Today's agenda: all-day events, timed events (with the one happening now and the next one), minutes to the next. */
export function agenda(events, now = Date.now()) {
  const today = eventsOnDay(events, startOfDay(now));
  const timed = today.filter((e) => !e.allDay);
  const current = timed.filter((e) => e.start <= now && e.end > now);
  const next = timed.find((e) => e.start > now) || null;
  return {
    allDay: today.filter((e) => e.allDay),
    timed,
    current,
    next,
    nextIn: next ? Math.round((next.start - now) / 60_000) : null,
    later: timed.filter((e) => e.end <= now).length,
  };
}

/** "now", "in 25 min", "in 2 h", "in 2 h 5 min", "tomorrow"-ish beyond a day. */
export function countdown(minutes) {
  if (minutes == null) return "";
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `in ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

/**
 * Status chips across the top (ControlZ header status): security first ("All secure" when it is),
 * then Needs Attention, lights on and running presets — each only when there is something to say.
 */
export function statusChips({ security, attention = 0, lightsOn = 0, running = [] } = {}) {
  const chips = [];
  if (security) {
    const n = security.count || 0;
    const text = { insecure: `${n} insecure`, warning: `${n} to check`, motion: `Motion · ${n}` }[security.level] || "All secure";
    chips.push({ id: "security", level: security.level in { insecure: 1, warning: 1, motion: 1 } ? security.level : "secure", icon: "🛡", text });
  }
  if (attention > 0) chips.push({ id: "attention", level: "warning", icon: "⚠", text: `${attention} need${attention === 1 ? "s" : ""} attention` });
  if (lightsOn > 0) chips.push({ id: "lights", level: "on", icon: "💡", text: `${lightsOn} light${lightsOn === 1 ? "" : "s"} on` });
  for (const r of running) chips.push({ id: `script:${r.entity_id}`, level: "running", icon: "▶", text: `${r.name} running` });
  return chips;
}

export const DASHTOP_SECTIONS = Object.freeze([
  { id: "clock", label: "Clock & weather" },
  { id: "today", label: "Today's calendar" },
  { id: "todo", label: "To-do list" },
  { id: "week", label: "This week" },
  { id: "tiles", label: "My tiles" },
]);

const strings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x))] : null);

/**
 * A user's Dashtop layout: which sections show, which calendars and to-do lists (null = all
 * calendars / the first list), and their tiles (`area:<id>` / `entity:<id>`; empty = their favorites).
 */
export function normalizeLayout(raw) {
  const sections = Object.fromEntries(DASHTOP_SECTIONS.map((s) => [s.id, raw?.sections?.[s.id] !== false]));
  return {
    sections,
    calendars: strings(raw?.calendars),
    todos: strings(raw?.todos),
    tiles: (strings(raw?.tiles) || []).filter((t) => /^(area|entity):./.test(t)),
  };
}

/** Calendars and to-do lists the layout shows, from what Home Assistant has. */
export function chosenSources(hass, layout) {
  const ids = (domain) => Object.keys(hass?.states || {}).filter((id) => id.startsWith(`${domain}.`)).sort();
  const calendars = ids("calendar");
  const todos = ids("todo");
  return {
    calendars: layout.calendars ? layout.calendars.filter((id) => calendars.includes(id)) : calendars,
    todos: layout.todos ? layout.todos.filter((id) => todos.includes(id)) : todos.slice(0, 1),
    allCalendars: calendars,
    allTodos: todos,
  };
}

/** Tiles to show: the layout's own, else the user's favorites (rooms first). */
export function dashtopTiles(layout, favorites = { areas: [], entities: [] }) {
  if (layout.tiles.length) return layout.tiles;
  return [...[...favorites.areas].map((id) => `area:${id}`), ...[...favorites.entities].map((id) => `entity:${id}`)];
}

/** To-do items: open ones first (by due date, then as listed), then done ones. */
export function todoView(items) {
  const list = Array.isArray(items) ? items.filter((i) => i && typeof i.summary === "string") : [];
  const open = list.filter((i) => i.status !== "completed");
  const due = (i) => (i.due ? Date.parse(i.due) : Infinity);
  return {
    open: open.map((i, n) => ({ i, n })).sort((a, b) => due(a.i) - due(b.i) || a.n - b.n).map((x) => x.i),
    done: list.filter((i) => i.status === "completed"),
  };
}
