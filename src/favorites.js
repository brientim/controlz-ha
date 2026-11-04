/**
 * Favorites (ControlZ favorite rooms, devices and scenes), per Home Assistant user.
 *
 * Stored with the frontend user data websocket calls (`frontend/get_user_data` /
 * `frontend/set_user_data`, key `controlz-ha-favorites`), so any user — not only admins — keeps
 * their own favorites and they follow them to every device. When those calls fail, favorites
 * fall back to this browser's localStorage. Changes broadcast `controlz-ha-favorites`.
 */
export const FAVORITES_EVENT = "controlz-ha-favorites";
export const USER_DATA_KEY = "controlz-ha-favorites";
const LOCAL_KEY = "controlz-ha.favorites";

let lists = { areas: [], entities: [] };
let loading = null;
let source = null;

const clean = (value) => ({
  areas: [...new Set(Array.isArray(value?.areas) ? value.areas.filter((v) => typeof v === "string") : [])],
  entities: [...new Set(Array.isArray(value?.entities) ? value.entities.filter((v) => typeof v === "string") : [])],
});

function readLocal() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(LOCAL_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLocal(value) {
  try {
    globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(value));
  } catch {
    // Storage disabled: favorites last for this page only.
  }
}

const broadcast = () => globalThis.window?.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: favoriteLists() }));

/** Current favorites as sets (empty until `loadFavorites` resolves). */
export function favoriteLists() {
  return { areas: new Set(lists.areas), entities: new Set(lists.entities) };
}

export const isFavorite = (kind, id) => (kind === "area" ? lists.areas : lists.entities).includes(id);

/** Where favorites are kept: "user" (Home Assistant user data), "local" (this browser) or null before loading. */
export const favoritesSource = () => source;

/** Load once per page; later calls return the same promise. */
export function loadFavorites(hass) {
  if (loading || !hass) return loading;
  loading = (async () => {
    try {
      const result = await hass.callWS({ type: "frontend/get_user_data", key: USER_DATA_KEY });
      lists = clean(result?.value);
      source = "user";
    } catch {
      lists = clean(readLocal());
      source = "local";
    }
    broadcast();
    return favoriteLists();
  })();
  return loading;
}

/** Add (`on = true`) or remove a favorite room (`kind = "area"`) or device / scene (`"entity"`). */
export async function setFavorite(hass, kind, id, on) {
  await loadFavorites(hass);
  const key = kind === "area" ? "areas" : "entities";
  const next = new Set(lists[key]);
  if (on) next.add(id);
  else next.delete(id);
  return save(hass, { ...lists, [key]: [...next] });
}

/** Favorites order (the Favorites page follows it): `ids` is the new order of one kind. */
export async function setFavoritesOrder(hass, kind, ids) {
  await loadFavorites(hass);
  const key = kind === "area" ? "areas" : "entities";
  return save(hass, { ...lists, [key]: [...new Set(ids)] });
}

/** Ordered favorites (arrays), for reordering. */
export const favoriteOrder = () => ({ areas: [...lists.areas], entities: [...lists.entities] });

async function save(hass, next) {
  lists = clean(next);
  broadcast();
  if (source === "user") {
    try {
      await hass.callWS({ type: "frontend/set_user_data", key: USER_DATA_KEY, value: lists });
      return favoriteLists();
    } catch {
      source = "local";
    }
  }
  writeLocal(lists);
  return favoriteLists();
}

export const toggleFavorite = (hass, kind, id) => setFavorite(hass, kind, id, !isFavorite(kind, id));

/** Test hook: forget loaded favorites. */
export function resetFavoritesForTest() {
  lists = { areas: [], entities: [] };
  loading = null;
  source = null;
}
