import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.location = { pathname: "/dashboard-controlz/rooms" };
globalThis.window ??= new EventTarget();

const {
  areasOrder, currentDashboardPath, entitiesOrder, hiddenLists, movedOrder, reorderSubset, roomsChangedThisSession,
  setAreasOrder, setEntitiesOrder, setHidden,
} = await import("../src/hidden.js");

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

test("room order: move by one, drop before another, save to areas_order", async () => {
  const shown = ["a", "b", "c", "d"];
  assert.deepEqual(movedOrder(shown, "c", { delta: -1 }), ["a", "c", "b", "d"]);
  assert.deepEqual(movedOrder(shown, "a", { delta: -1 }), shown);
  assert.deepEqual(movedOrder(shown, "a", { delta: 1 }), ["b", "a", "c", "d"]);
  assert.deepEqual(movedOrder(shown, "d", { beforeId: "b" }), ["a", "d", "b", "c"]);
  assert.deepEqual(movedOrder(shown, "a", { beforeId: "" }), ["b", "c", "d", "a"]);

  const hass = mockHass({ type: "custom:controlz-rooms", hide_areas: ["x"] });
  await assert.rejects(setAreasOrder(mockHass({ type: "custom:controlz-rooms" }, { admin: false }), ["a"]), /admins can reorder/);
  await setAreasOrder(hass, ["b", "a", "b"]);
  const strategy = hass.saved.at(-1).config.strategy;
  assert.deepEqual(strategy.areas_order, ["b", "a"]);
  assert.deepEqual(strategy.hide_areas, ["x"]);
  assert.deepEqual(areasOrder({ areas_order: ["z"] }), ["b", "a"]);
  assert.equal(roomsChangedThisSession(), true);
});

test("device tile order: reorder one section in place, save per room", async () => {
  // Room shown as scenes s1 s2, lights l1 l2 l3: moving l3 first only touches the lights' places.
  assert.deepEqual(reorderSubset(["s1", "s2", "l1", "l2", "l3"], ["l3", "l1", "l2"]), ["s1", "s2", "l3", "l1", "l2"]);
  assert.deepEqual(reorderSubset(["a", "b"], ["b", "a", "new"]), ["b", "a", "new"]);

  const hass = mockHass({ type: "custom:controlz-rooms", entities_order: { kitchen: ["light.x"] } });
  await assert.rejects(setEntitiesOrder(mockHass({ type: "custom:controlz-rooms" }, { admin: false }), "office", ["a"]), /admins can reorder devices/);
  await setEntitiesOrder(hass, "office", ["light.b", "light.a", "light.b"]);
  await setEntitiesOrder(hass, null, ["automation.leak"]);
  const strategy = hass.saved.at(-1).config.strategy;
  assert.deepEqual(strategy.entities_order, { kitchen: ["light.x"], office: ["light.b", "light.a"], __none: ["automation.leak"] });
  assert.deepEqual(entitiesOrder({}, "office"), ["light.b", "light.a"]);
  assert.deepEqual(entitiesOrder({}, ""), ["automation.leak"]);
  await setEntitiesOrder(hass, "kitchen", []);
  assert.equal("kitchen" in hass.saved.at(-1).config.strategy.entities_order, false);
});
