import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window ??= new EventTarget();
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  favoriteLists, favoriteOrder, favoritesSource, isFavorite, loadFavorites, resetFavoritesForTest, setFavorite, setFavoritesOrder,
  toggleFavorite, USER_DATA_KEY,
} = await import("../src/favorites.js");

function userDataHass(initial) {
  let value = initial;
  const sent = [];
  return {
    sent,
    callWS: async (msg) => {
      sent.push(msg);
      if (msg.type === "frontend/get_user_data") return { value };
      if (msg.type === "frontend/set_user_data") {
        value = structuredClone(msg.value);
        return null;
      }
      throw new Error(`unexpected ${msg.type}`);
    },
  };
}

test("favorites load from and save to Home Assistant user data", async () => {
  resetFavoritesForTest();
  const hass = userDataHass({ areas: ["office"], entities: ["light.a", 7] });
  await loadFavorites(hass);
  assert.equal(favoritesSource(), "user");
  assert.deepEqual([...favoriteLists().entities], ["light.a"]);
  assert.equal(isFavorite("area", "office"), true);

  let events = 0;
  const onEvent = () => events++;
  window.addEventListener("controlz-ha-favorites", onEvent);
  await toggleFavorite(hass, "entity", "scene.relax");
  await setFavorite(hass, "area", "office", false);
  window.removeEventListener("controlz-ha-favorites", onEvent);
  assert.equal(events, 2);
  const saved = hass.sent.filter((m) => m.type === "frontend/set_user_data").at(-1);
  assert.equal(saved.key, USER_DATA_KEY);
  assert.deepEqual(saved.value, { areas: [], entities: ["light.a", "scene.relax"] });

  await setFavoritesOrder(hass, "entity", ["scene.relax", "light.a"]);
  assert.deepEqual(favoriteOrder().entities, ["scene.relax", "light.a"]);
  assert.deepEqual(hass.sent.at(-1).value.entities, ["scene.relax", "light.a"]);
});

test("without user data support, favorites stay in this browser", async () => {
  resetFavoritesForTest();
  const hass = { callWS: async () => { throw new Error("unknown command"); } };
  await loadFavorites(hass);
  assert.equal(favoritesSource(), "local");
  await setFavorite(hass, "entity", "lock.front_door", true);
  assert.deepEqual(JSON.parse(store.get("controlz-ha.favorites")), { areas: [], entities: ["lock.front_door"] });
  resetFavoritesForTest();
  await loadFavorites(hass);
  assert.equal(isFavorite("entity", "lock.front_door"), true);
});
