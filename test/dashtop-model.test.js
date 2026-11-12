import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../dev/fixture.js";
import {
  agenda, chosenSources, countdown, dashtopTiles, eventsOnDay, greeting, normalizeEvents, normalizeLayout, parseEventTime, skyPhase,
  statusChips, todoView, weatherMood, weekDays,
} from "../src/dashtop-model.js";

const hass = makeFixture();
const local = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test("greeting follows the hour", () => {
  assert.deepEqual([6, 13, 19, 23, 3].map((h) => greeting(new Date(2026, 10, 13, h))),
    ["Good morning", "Good afternoon", "Good evening", "Good night", "Good night"]);
});

test("sky follows the sun's elevation, or the hour without sun.sun", () => {
  const sun = (elevation, rising) => ({ attributes: { elevation, rising } });
  assert.equal(skyPhase(sun(30, true)), "day");
  assert.equal(skyPhase(sun(-20, false)), "night");
  assert.equal(skyPhase(sun(2, true)), "dawn");
  assert.equal(skyPhase(sun(-3, false)), "dusk");
  assert.equal(skyPhase(null, new Date(2026, 10, 13, 12)), "day");
  assert.equal(skyPhase(null, new Date(2026, 10, 13, 22)), "night");
  assert.deepEqual(["rainy", "snowy", "lightning-rainy", "partlycloudy", "sunny", "fog"].map(weatherMood), ["rain", "snow", "storm", "cloudy", "clear", "fog"]);
});

test("calendar times: dates are local all-day, date-times are instants", () => {
  assert.deepEqual(parseEventTime({ date: "2026-11-13" }), { t: local(2026, 11, 13), allDay: true });
  assert.deepEqual(parseEventTime({ dateTime: "2026-11-13T09:30:00Z" }), { t: Date.parse("2026-11-13T09:30:00Z"), allDay: false });
  assert.deepEqual(parseEventTime("2026-11-14"), { t: local(2026, 11, 14), allDay: true });
  assert.equal(parseEventTime({}), null);
});

test("events are normalized, sorted, and placed on their days (all-day end is exclusive)", () => {
  const events = normalizeEvents([
    { summary: "Dinner", start: { dateTime: new Date(local(2026, 11, 13, 19)).toISOString() }, end: { dateTime: new Date(local(2026, 11, 13, 21)).toISOString() } },
    { summary: "Holiday", start: { date: "2026-11-14" }, end: { date: "2026-11-16" } },
    { summary: "Bins", start: { date: "2026-11-13" }, end: { date: "2026-11-14" } },
    { summary: "Broken" },
  ], "calendar.family");
  assert.deepEqual(events.map((e) => e.summary), ["Bins", "Dinner", "Holiday"]);
  assert.equal(events[0].calendar, "calendar.family");
  assert.deepEqual(eventsOnDay(events, local(2026, 11, 13)).map((e) => e.summary), ["Bins", "Dinner"]);
  assert.deepEqual(eventsOnDay(events, local(2026, 11, 15)).map((e) => e.summary), ["Holiday"]);
  assert.deepEqual(eventsOnDay(events, local(2026, 11, 16)).map((e) => e.summary), []);
  const week = weekDays(events, local(2026, 11, 13, 10), 7);
  assert.equal(week.length, 7);
  assert.equal(week[0].today, true);
  assert.deepEqual(week.map((d) => d.events.length), [2, 1, 1, 0, 0, 0, 0]);
});

test("today's agenda: all-day, timed, now and next", () => {
  const events = normalizeEvents([
    { summary: "Bins", start: { date: "2026-11-13" }, end: { date: "2026-11-14" } },
    { summary: "Standup", start: { dateTime: new Date(local(2026, 11, 13, 9)).toISOString() }, end: { dateTime: new Date(local(2026, 11, 13, 9, 30)).toISOString() } },
    { summary: "Lunch", start: { dateTime: new Date(local(2026, 11, 13, 12)).toISOString() }, end: { dateTime: new Date(local(2026, 11, 13, 13)).toISOString() } },
    { summary: "Pickup", start: { dateTime: new Date(local(2026, 11, 13, 15)).toISOString() }, end: { dateTime: new Date(local(2026, 11, 13, 15, 30)).toISOString() } },
  ], "c");
  const a = agenda(events, local(2026, 11, 13, 12, 20));
  assert.deepEqual(a.allDay.map((e) => e.summary), ["Bins"]);
  assert.deepEqual(a.current.map((e) => e.summary), ["Lunch"]);
  assert.equal(a.next.summary, "Pickup");
  assert.equal(a.nextIn, 160);
  assert.equal(a.later, 1);
  assert.deepEqual([0, 25, 60, 125, 1500, null].map(countdown), ["now", "in 25 min", "in 1 h", "in 2 h 5 min", "in 1 day", ""]);
});

test("status chips: security first, attention links, lights and running presets only when there is something", () => {
  assert.deepEqual(statusChips({ security: { level: "secure", count: 0 } }).map((c) => [c.id, c.text]), [["security", "All secure"]]);
  const chips = statusChips({
    security: { level: "insecure", count: 2 }, attention: 3, lightsOn: 1, running: [{ entity_id: "script.bed", name: "Bedtime" }],
  });
  assert.deepEqual(chips.map((c) => [c.id, c.level, c.text]), [
    ["security", "insecure", "2 insecure"], ["attention", "warning", "3 need attention"], ["lights", "on", "1 light on"],
    ["script:script.bed", "running", "Bedtime running"],
  ]);
  assert.equal(statusChips({ attention: 1 })[0].text, "1 needs attention");
});

test("layout: every section on by default, calendars all, first to-do list, favorites as tiles", () => {
  const layout = normalizeLayout(null);
  assert.deepEqual(layout, { sections: { clock: true, today: true, todo: true, week: true, tiles: true }, calendars: null, todos: null, tiles: [] });
  const s = chosenSources(hass, layout);
  assert.deepEqual(s.calendars, ["calendar.family", "calendar.work"]);
  assert.deepEqual(s.todos, ["todo.chores"]);
  const mine = normalizeLayout({ sections: { week: false }, calendars: ["calendar.work", "calendar.gone"], todos: ["todo.shopping_list"], tiles: ["area:office", "bad", "entity:light.a", "area:office"] });
  assert.equal(mine.sections.week, false);
  assert.deepEqual(chosenSources(hass, mine).calendars, ["calendar.work"]);
  assert.deepEqual(mine.tiles, ["area:office", "entity:light.a"]);
  assert.deepEqual(dashtopTiles(layout, { areas: new Set(["office"]), entities: new Set(["light.x"]) }), ["area:office", "entity:light.x"]);
  assert.deepEqual(dashtopTiles(mine, { areas: new Set(["kitchen"]), entities: new Set() }), ["area:office", "entity:light.a"]);
});

test("to-do items: open first by due date, then done", () => {
  const v = todoView([
    { uid: "1", summary: "A", status: "needs_action" }, { uid: "2", summary: "B", status: "completed" },
    { uid: "3", summary: "C", status: "needs_action", due: "2026-11-14" }, { summary: 5 },
  ]);
  assert.deepEqual(v.open.map((i) => i.summary), ["C", "A"]);
  assert.deepEqual(v.done.map((i) => i.summary), ["B"]);
});
