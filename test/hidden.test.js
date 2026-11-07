import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.location = { pathname: "/dashboard-controlz/rooms" };
globalThis.window ??= new EventTarget();

const {
  areasOrder, currentDashboardPath, entitiesOrder, hiddenLists, movedOrder, reorderSubset, roomsChangedThisSession,
  securityBannerSettings, setAreasOrder, setEntitiesOrder, setHidden, setSecurityBanner, roomExcluded, setRoomExcluded,
  confirmScenes, runScene, setSceneConfirm, HOME_SCENES, hiddenScenes, setScenesHidden,
} = await import("../src/hidden.js");

test("scene rows hidden for everyone save to hide_scenes", async () => {
  assert.deepEqual([...hiddenScenes({ hide_scenes: ["office"] })], ["office"]);
  const hass = mockHass({ type: "custom:controlz-rooms" });
  await setScenesHidden(hass, HOME_SCENES, true);
  await setScenesHidden(hass, "office", true);
  assert.deepEqual(hass.saved.at(-1).config.strategy.hide_scenes, ["__home", "office"]);
  assert.deepEqual([...hiddenScenes({})], ["__home", "office"]);
  await setScenesHidden(hass, HOME_SCENES, false);
  await setScenesHidden(hass, "office", false);
  assert.equal("hide_scenes" in hass.saved.at(-1).config.strategy, false);
});

test("scenes that ask first: confirm_scenes, and runScene asks only for those", async () => {
  const hass = mockHass({ type: "custom:controlz-rooms" });
  const ran = [];
  hass.callService = (domain, service, data) => ran.push(`${domain}.${service} ${data.entity_id}`);
  globalThis.window.confirm = () => false;
  assert.equal(runScene(hass, {}, "scene.a", "A"), true);
  await setSceneConfirm(hass, "script.night", true);
  assert.deepEqual(hass.saved.at(-1).config.strategy.confirm_scenes, ["script.night"]);
  assert.equal(runScene(hass, {}, "script.night", "Night"), false);
  globalThis.window.confirm = () => true;
  assert.equal(runScene(hass, {}, "script.night", "Night"), true);
  assert.deepEqual(ran, ["scene.turn_on scene.a", "script.turn_on script.night"]);
  await setSceneConfirm(hass, "script.night", false);
  assert.equal("confirm_scenes" in hass.saved.at(-1).config.strategy, false);
  assert.equal(confirmScenes({ confirm_scenes: ["scene.x"] }).size, 0);
});

test("room tile exclusions save to room_exclude and apply straight away", async () => {
  assert.deepEqual([...roomExcluded({ room_exclude: ["light.x"] })], ["light.x"]);
  const hass = mockHass({ type: "custom:controlz-rooms" });
  await setRoomExcluded(hass, "light.b", true);
  await setRoomExcluded(hass, "light.a", true);
  assert.deepEqual(hass.saved.at(-1).config.strategy.room_exclude, ["light.a", "light.b"]);
  assert.deepEqual([...roomExcluded({})], ["light.a", "light.b"]);
  await setRoomExcluded(hass, "light.a", false);
  await setRoomExcluded(hass, "light.b", false);
  assert.equal("room_exclude" in hass.saved.at(-1).config.strategy, false);
  await assert.rejects(setRoomExcluded(mockHass({ type: "custom:controlz-rooms" }, { admin: false }), "light.a", true), /admins/);
});

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

test("security banner placement: config until saved, then the saved value; default keys are dropped", async () => {
  assert.deepEqual(securityBannerSettings({}), { mode: "all_rooms", rooms: [] });
  assert.deepEqual(securityBannerSettings({ security_banner: "rooms", security_banner_rooms: ["office"] }), { mode: "rooms", rooms: ["office"] });

  const hass = mockHass({ type: "custom:controlz-rooms", hide_areas: ["x"] });
  await assert.rejects(setSecurityBanner(mockHass({ type: "custom:controlz-rooms" }, { admin: false }), { mode: "off" }), /admins can change the security banner/);
  await setSecurityBanner(hass, { mode: "rooms", rooms: ["office", "kitchen", "office"] });
  let strategy = hass.saved.at(-1).config.strategy;
  assert.equal(strategy.security_banner, "rooms");
  assert.deepEqual(strategy.security_banner_rooms, ["office", "kitchen"]);
  assert.deepEqual(strategy.hide_areas, ["x"]);
  assert.deepEqual(securityBannerSettings({ security_banner: "off" }), { mode: "rooms", rooms: ["office", "kitchen"] });

  await setSecurityBanner(hass, { mode: "every_room", rooms: ["office"] });
  strategy = hass.saved.at(-1).config.strategy;
  assert.equal(strategy.security_banner, "every_room");
  assert.equal("security_banner_rooms" in strategy, false);

  await setSecurityBanner(hass, { mode: "all_rooms" });
  strategy = hass.saved.at(-1).config.strategy;
  assert.equal("security_banner" in strategy, false);
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
