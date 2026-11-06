import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../dev/fixture.js";
import { compass, condition, dailyRows, forecastTypes, hourlyRows, pickWeather, sunView, weatherNow } from "../src/weather-model.js";

const hass = makeFixture();

test("current conditions read the weather entity", () => {
  const now = weatherNow(hass.states["weather.home"]);
  assert.deepEqual([now.emoji, now.label, now.temperature, now.feels, now.humidity, now.wind, now.pressure, now.uv],
    ["⛅", "Partly cloudy", 23.4, 24.1, 58, "14 km/h SE", "1016 hPa", 6]);
  assert.equal(weatherNow(undefined).offline, true);
  assert.equal(condition("weird-thing").label, "weird thing");
});

test("forecast types from supported features", () => {
  assert.deepEqual(forecastTypes(hass.states["weather.home"]), ["hourly", "daily"]);
  assert.deepEqual(forecastTypes({ attributes: { supported_features: 4 } }), ["twice_daily"]);
  assert.deepEqual(forecastTypes({ attributes: {} }), []);
});

test("compass points", () => {
  assert.deepEqual([0, 22, 90, 135, 359, -90].map(compass), ["N", "NNE", "E", "SE", "N", "W"]);
  assert.equal(compass("NW"), "NW");
  assert.equal(compass(null), "");
});

test("hourly rows start at the current hour", () => {
  const now = Date.parse("2026-11-06T10:30:00Z");
  const rows = hourlyRows([
    { datetime: "2026-11-06T09:00:00Z", condition: "sunny", temperature: 18.4 },
    { datetime: "2026-11-06T10:00:00Z", condition: "rainy", temperature: 19.6, precipitation_probability: 40 },
    { datetime: "2026-11-06T11:00:00Z", condition: "cloudy", temperature: 20 },
  ], now, 2);
  assert.deepEqual(rows.map((r) => [r.emoji, r.temperature, r.rain]), [["🌦️", 20, 40], ["☁️", 20, null]]);
});

test("daily rows merge twice-daily forecasts and keep the daytime condition", () => {
  const rows = dailyRows([
    { datetime: "2026-11-06T06:00:00", condition: "sunny", temperature: 24, is_daytime: true, precipitation_probability: 10, precipitation: 0.5 },
    { datetime: "2026-11-06T18:00:00", condition: "clear-night", temperature: 12, is_daytime: false, precipitation_probability: 30, precipitation: 1 },
    { datetime: "2026-11-07T12:00:00", condition: "rainy", temperature: 19, templow: 11 },
  ]);
  assert.deepEqual(rows.map((r) => [r.emoji, r.high, r.low, r.rain, r.amount]), [["☀️", 24, 12, 30, 1.5], ["🌦️", 19, 11, null, null]]);
});

test("sun card and weather entity choice", () => {
  const sun = sunView(hass.states["sun.sun"]);
  assert.deepEqual([sun.known, sun.up, sun.elevation], [true, true, 42.1]);
  assert.ok(sun.sunrise > Date.now() && sun.sunset > Date.now());
  assert.equal(sunView(undefined).known, false);
  assert.equal(pickWeather(hass), "weather.home");
  assert.equal(pickWeather(hass, "weather.nope"), "weather.home");
  assert.equal(pickWeather({ states: {} }), null);
});
