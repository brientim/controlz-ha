import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../dev/fixture.js";
import {
  countTurnsOn, eventKind, eventsCsv, filterEvents, historyItems, historyPoints, numericSeries, onPeriods, rangeHours,
  securityEvents, securityHistoryIds, seriesStats, sparkline,
} from "../src/history-model.js";
import { KIND } from "../src/model.js";

const hass = makeFixture();
const H = 3_600_000;
const sec = (ms) => ms / 1000;

test("history points read the compressed and the long format, oldest first", () => {
  assert.deepEqual(historyPoints([{ s: "2", lu: 20 }, { s: "1", lu: 10, lc: 5 }]), [{ t: 5000, s: "1" }, { t: 20000, s: "2" }]);
  assert.deepEqual(historyPoints([{ state: "on", last_changed: "2026-01-01T00:00:00Z" }]), [{ t: Date.parse("2026-01-01T00:00:00Z"), s: "on" }]);
  assert.deepEqual(historyPoints([{ s: "x" }, null]), []);
});

test("numeric series drop offline and text states; stats are time weighted", () => {
  const series = numericSeries(historyPoints([{ s: "10", lu: 0 }, { s: "unavailable", lu: sec(H) }, { s: "20", lu: sec(3 * H) }]));
  assert.deepEqual(series.map((p) => p.v), [10, 20]);
  const stats = seriesStats(series, 0, 4 * H);
  assert.deepEqual({ min: stats.min, max: stats.max, last: stats.last }, { min: 10, max: 20, last: 20 });
  assert.equal(stats.avg, 12.5);
  assert.equal(seriesStats([], 0, 1), null);
});

test("sparkline is a step line inside the box", () => {
  const { line, fill, min, max } = sparkline([{ t: 0, v: 1 }, { t: 50, v: 3 }], { start: 0, end: 100, width: 100, height: 20, pad: 0 });
  assert.equal(line, "M0 20 H50 V0 H100");
  assert.ok(fill.endsWith("V20 H0 Z"));
  assert.deepEqual([min, max], [1, 3]);
  assert.deepEqual(sparkline([{ t: 0, v: 5 }], { start: 0, end: 10 }).min, 4);
  assert.equal(sparkline([], { start: 0, end: 10 }).line, "");
});

test("on periods are clipped to the window and counted", () => {
  const points = historyPoints([{ s: "on", lu: -10 }, { s: "off", lu: 10 }, { s: "on", lu: 50 }, { s: "on", lu: 60 }, { s: "off", lu: 70 }]);
  assert.deepEqual(onPeriods(points, { start: 0, end: 100_000 }), [{ from: 0, to: 10_000 }, { from: 50_000, to: 60_000 }, { from: 60_000, to: 70_000 }]);
  assert.equal(countTurnsOn(points, 0), 1);
  assert.equal(countTurnsOn(points, -20_000), 2);
});

test("security events: changes inside the window, newest first, with words and room", () => {
  const history = {
    "binary_sensor.front_door": [{ s: "off", lu: sec(-H) }, { s: "on", lu: sec(H) }, { s: "off", lu: sec(2 * H) }],
    "lock.front_door": [{ s: "locked", lu: 0 }, { s: "unavailable", lu: sec(H) }, { s: "unlocked", lu: sec(3 * H) }],
    "binary_sensor.lounge_motion": [{ s: "on", lu: sec(30 * 60_000) }],
  };
  const events = securityEvents(hass, history, { start: 0, end: 4 * H });
  assert.deepEqual(events.map((e) => [e.entity_id, e.label, e.alert]), [
    ["lock.front_door", "Unlocked", true],
    ["binary_sensor.front_door", "Closed", false],
    ["binary_sensor.front_door", "Opened", true],
    ["binary_sensor.lounge_motion", "Motion", false],
  ]);
  assert.equal(events.find((e) => e.entity_id === "binary_sensor.front_door").area, "Entrance");
  assert.equal(events.find((e) => e.entity_id === "lock.front_door").area_id, "entrance");
  assert.deepEqual(filterEvents(events, { type: "lock" }).map((e) => e.label), ["Unlocked"]);
  assert.equal(filterEvents(events, { area: "living_room" }).length, 1);
  assert.equal(filterEvents(events, { query: "front door sensor" }).length, 2);
});

test("event kinds name what happened", () => {
  const kind = (id) => eventKind(id, hass.states[id]);
  assert.equal(kind("binary_sensor.office_window").type, "window");
  assert.equal(kind("binary_sensor.smoke_kitchen").label("on"), "Smoke detected");
  assert.equal(kind("cover.garage_door").label("open"), "Opened");
  assert.equal(kind("alarm_control_panel.house").label("armed_away"), "Armed away");
  assert.equal(kind("binary_sensor.office_motion").type, "motion");
});

test("security history follows security and motion tiles, minus excluded", () => {
  const ids = securityHistoryIds(hass, { exclude: ["lock.front_door"] });
  assert.ok(ids.includes("binary_sensor.lounge_motion") && ids.includes("cover.garage_door"));
  assert.ok(!ids.includes("lock.front_door") && !ids.includes("light.office_desk_lamp"));
});

test("CSV is oldest first and quotes commas", () => {
  const csv = eventsCsv([
    { t: 2000, area: "Hall", name: "Door, front", type: "door", label: "Opened", entity_id: "binary_sensor.a" },
    { t: 1000, area: "", name: "Lock", type: "lock", label: "Locked", entity_id: "lock.a" },
  ]);
  assert.deepEqual(csv.trim().split("\n"), [
    "Time,Room,Device,Type,Event,Entity",
    "1970-01-01T00:00:01.000Z,,Lock,lock,Locked,lock.a",
    '1970-01-01T00:00:02.000Z,Hall,"Door, front",door,Opened,binary_sensor.a',
  ]);
});

test("room history lists numeric sensors, then motion", () => {
  const items = [{ entity_id: "binary_sensor.m", kind: KIND.MOTION }, { entity_id: "sensor.t", kind: KIND.SENSOR }, { entity_id: "light.l", kind: KIND.LIGHT }];
  assert.deepEqual(historyItems(items).map((i) => i.entity_id), ["sensor.t", "binary_sensor.m"]);
  assert.equal(rangeHours("7d"), 168);
  assert.equal(rangeHours("nope"), 24);
});
