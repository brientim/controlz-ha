import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.location = { pathname: "/dashboard-controlz/rooms" };
globalThis.window ??= new EventTarget();

const { currentDashboardPath, hiddenLists, setHidden } = await import("../src/hidden.js");

function mockHass(strategy, { admin = true } = {}) {
  const saved = [];
  let config = strategy ? { strategy } : { views: [] };
  return {
    user: { is_admin: admin },
    saved,
    callWS: async (msg) => {
      if (msg.type === "lovelace/config") return structuredClone(config);
      if (msg.type === "lovelace/config/save") {
        saved.push(msg);
        config = structuredClone(msg.config);
        return null;
      }
      throw new Error(`unexpected ${msg.type}`);
    },
  };
}

test("dashboard path comes from the URL; the default dashboard is null", () => {
  assert.equal(currentDashboardPath(), "dashboard-controlz");
  globalThis.location = { pathname: "/lovelace/0" };
  assert.equal(currentDashboardPath(), null);
  globalThis.location = { pathname: "/dashboard-controlz/rooms" };
});

test("only admins on a ControlZ dashboard can hide", async () => {
  await assert.rejects(setHidden(mockHass({ type: "custom:controlz-rooms" }, { admin: false }), "area", "garage", true), /admins/);
  await assert.rejects(setHidden(mockHass(null), "area", "garage", true), /ControlZ dashboard/);
});

test("hiding saves sorted lists to the strategy and showing removes them", async () => {
  const hass = mockHass({ type: "custom:controlz-rooms", tile_size: "thin" });
  await setHidden(hass, "entity", "light.b", true);
  await setHidden(hass, "entity", "light.a", true);
  await setHidden(hass, "area", "garage", true);
  let strategy = hass.saved.at(-1).config.strategy;
  assert.equal(hass.saved.at(-1).url_path, "dashboard-controlz");
  assert.equal(strategy.tile_size, "thin");
  assert.deepEqual(strategy.hide_entities, ["light.a", "light.b"]);
  assert.deepEqual(strategy.hide_areas, ["garage"]);
  assert.deepEqual([...hiddenLists({}).areas], ["garage"]);

  await setHidden(hass, "area", "garage", false);
  strategy = hass.saved.at(-1).config.strategy;
  assert.equal("hide_areas" in strategy, false);
});
