/**
 * Hide rooms and devices, room order and where the security banner shows (dashboard-wide, like
 * ControlZ room / device hiding and Room Order).
 *
 * Hidden lists and the room order live in the ControlZ dashboard config (`hide_areas`,
 * `hide_entities`, `areas_order` on the `custom:controlz-rooms` strategy), so every device sees
 * the same thing. Saving needs an admin. After a save, cards update straight away from `override`;
 * the view tabs follow on reload.
 */
export const HIDDEN_EVENT = "controlz-ha-hidden";
export const EDIT_EVENT = "controlz-ha-edit";

const STRATEGY_TYPE = "custom:controlz-rooms";

let override = null;
let orderOverride = null;
let entitiesOverride = null;
let bannerOverride = null;
let excludeOverride = null;
let confirmOverride = null;
let scenesOverride = null;
let roomSizesOverride = null;
let editing = false;

/** Key for automations without a room in `entities_order`. */
export const NO_AREA = "__none";

export function hiddenLists(config = {}) {
  const lists = override || config;
  return {
    areas: new Set(lists.hide_areas || []),
    entities: new Set(lists.hide_entities || []),
  };
}

/** Room order: the one saved this session, else the dashboard config's `areas_order`. */
export const areasOrder = (config = {}) => orderOverride || config.areas_order || [];

/** Device tile order in one room (`entities_order.<area_id>`); unlisted devices follow by name. */
export const entitiesOrder = (config = {}, areaId) => (entitiesOverride || config.entities_order || {})[areaId || NO_AREA] || [];

export const isEditing = () => editing;

export function setEditing(value) {
  editing = !!value;
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: { editing } }));
}

/** Lovelace dashboard url_path for the current page (`null` = the default dashboard). */
export function currentDashboardPath() {
  const first = location.pathname.split("/")[1] || "";
  return first === "lovelace" ? null : first;
}

async function saveStrategy(hass, what, mutate) {
  if (!hass?.user?.is_admin) throw new Error(`Only Home Assistant admins can ${what}.`);
  const urlPath = currentDashboardPath();
  const config = await hass.callWS({ type: "lovelace/config", url_path: urlPath, force: false });
  if (config?.strategy?.type !== STRATEGY_TYPE) {
    throw new Error(`${what[0].toUpperCase()}${what.slice(1)} works on the ControlZ dashboard (strategy custom:controlz-rooms).`);
  }
  const strategy = mutate({ ...config.strategy });
  await hass.callWS({ type: "lovelace/config/save", url_path: urlPath, config: { ...config, strategy } });
  return strategy;
}

/** Hide (`hide = true`) or show an area or entity by saving the dashboard's strategy config. */
export async function setHidden(hass, kind, id, hide) {
  const key = kind === "area" ? "hide_areas" : "hide_entities";
  const strategy = await saveStrategy(hass, "hide rooms and devices", (s) => {
    const list = new Set(s[key] || []);
    if (hide) list.add(id);
    else list.delete(id);
    s[key] = [...list].sort();
    if (!s[key].length) delete s[key];
    return s;
  });
  override = { hide_areas: strategy.hide_areas || [], hide_entities: strategy.hide_entities || [] };
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: override }));
  return override;
}

/** Save the room order (area ids, first shown first) to the dashboard's `areas_order`. */
export async function setAreasOrder(hass, order) {
  const strategy = await saveStrategy(hass, "reorder rooms", (s) => {
    s.areas_order = [...new Set(order)];
    if (!s.areas_order.length) delete s.areas_order;
    return s;
  });
  orderOverride = strategy.areas_order || [];
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { areas_order: orderOverride } }));
  return orderOverride;
}

/** Save one room's device tile order (entity ids, first shown first) to the dashboard's `entities_order`. */
export async function setEntitiesOrder(hass, areaId, order) {
  const key = areaId || NO_AREA;
  const strategy = await saveStrategy(hass, "reorder devices", (s) => {
    const all = { ...(s.entities_order || {}) };
    all[key] = [...new Set(order)];
    if (!all[key].length) delete all[key];
    s.entities_order = all;
    if (!Object.keys(all).length) delete s.entities_order;
    return s;
  });
  entitiesOverride = strategy.entities_order || {};
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { entities_order: entitiesOverride } }));
  return entitiesOverride;
}

/**
 * `full` with the members of `subset` put in `subset`'s order, each taking one of the places the
 * members already had (so reordering one section leaves the rest of the room where it was).
 * Subset members missing from `full` go at the end.
 */
export function reorderSubset(full, subset) {
  const members = new Set(subset);
  const queue = [...subset];
  const out = full.map((id) => (members.has(id) ? queue.shift() : id));
  return [...out, ...queue];
}

/**
 * New order after moving `id` by `delta` places (or to just before `beforeId` when dropping),
 * starting from the rooms as currently shown.
 */
export function movedOrder(shown, id, { delta = 0, beforeId = null } = {}) {
  const list = shown.filter((a) => a !== id);
  const from = shown.indexOf(id);
  if (from < 0) return shown;
  let to;
  if (beforeId != null) to = beforeId === "" ? list.length : Math.max(0, list.indexOf(beforeId));
  else to = Math.min(list.length, Math.max(0, from + delta));
  list.splice(to, 0, id);
  return list;
}

/** Security banner placement: the one saved this session, else the dashboard config's `security_banner` / `security_banner_rooms`. */
export function securityBannerSettings(config = {}) {
  if (bannerOverride) return bannerOverride;
  return { mode: config.security_banner || "all_rooms", rooms: config.security_banner_rooms || [] };
}

/** Save where the security banner shows (`mode` from SECURITY_BANNER_MODES; `rooms` for "rooms"). */
export async function setSecurityBanner(hass, { mode, rooms = [] }) {
  const strategy = await saveStrategy(hass, "change the security banner", (s) => {
    if (mode === "all_rooms") delete s.security_banner;
    else s.security_banner = mode;
    const list = [...new Set(rooms)];
    if (mode === "rooms" && list.length) s.security_banner_rooms = list;
    else delete s.security_banner_rooms;
    return s;
  });
  bannerOverride = { mode: strategy.security_banner || "all_rooms", rooms: strategy.security_banner_rooms || [] };
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { security_banner: bannerOverride } }));
  return bannerOverride;
}

/**
 * Lights the room tile leaves alone (ControlZ Room Master exclusions, `room_exclude`): still shown
 * and controllable on their own, but not switched, dimmed or counted by the room tile.
 */
export const roomExcluded = (config = {}) => new Set(excludeOverride || config.room_exclude || []);

export async function setRoomExcluded(hass, entityId, exclude) {
  const strategy = await saveStrategy(hass, "change what the room tile controls", (s) => {
    const list = new Set(s.room_exclude || []);
    if (exclude) list.add(entityId);
    else list.delete(entityId);
    s.room_exclude = [...list].sort();
    if (!s.room_exclude.length) delete s.room_exclude;
    return s;
  });
  excludeOverride = strategy.room_exclude || [];
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { room_exclude: excludeOverride } }));
  return excludeOverride;
}

/** Tile size per room for everyone on the dashboard (`room_tile_sizes: { office: compact }`). */
export const roomTileSizes = (config = {}) => ({ ...(roomSizesOverride || config.room_tile_sizes || {}) });

/** Save (or clear, with `size` null) a room's tile size for everyone. */
export async function setRoomTileSize(hass, areaId, size) {
  const strategy = await saveStrategy(hass, "set a room's tile size", (s) => {
    const all = { ...(s.room_tile_sizes || {}) };
    if (["large", "thin", "compact"].includes(size)) all[areaId] = size;
    else delete all[areaId];
    s.room_tile_sizes = all;
    if (!Object.keys(all).length) delete s.room_tile_sizes;
    return s;
  });
  roomSizesOverride = strategy.room_tile_sizes || {};
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { room_tile_sizes: roomSizesOverride } }));
  return roomSizesOverride;
}

/** `hide_scenes` key for All Rooms' house-wide Scenes & presets row (rooms use their area id). */
export const HOME_SCENES = "__home";

/** Scene rows hidden for everyone on the dashboard (`hide_scenes`: area ids and `__home`). */
export const hiddenScenes = (config = {}) => new Set(scenesOverride || config.hide_scenes || []);

export async function setScenesHidden(hass, key, hide) {
  const strategy = await saveStrategy(hass, "hide scenes", (s) => {
    const list = new Set(s.hide_scenes || []);
    if (hide) list.add(key);
    else list.delete(key);
    s.hide_scenes = [...list].sort();
    if (!s.hide_scenes.length) delete s.hide_scenes;
    return s;
  });
  scenesOverride = strategy.hide_scenes || [];
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { hide_scenes: scenesOverride } }));
  return scenesOverride;
}

/** Scenes and scripts that ask before running (ControlZ "confirm before run", `confirm_scenes`), for everyone on the dashboard. */
export const confirmScenes = (config = {}) => new Set(confirmOverride || config.confirm_scenes || []);

export async function setSceneConfirm(hass, entityId, ask) {
  const strategy = await saveStrategy(hass, "change which scenes ask first", (s) => {
    const list = new Set(s.confirm_scenes || []);
    if (ask) list.add(entityId);
    else list.delete(entityId);
    s.confirm_scenes = [...list].sort();
    if (!s.confirm_scenes.length) delete s.confirm_scenes;
    return s;
  });
  confirmOverride = strategy.confirm_scenes || [];
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: { confirm_scenes: confirmOverride } }));
  return confirmOverride;
}

/** Run a scene or script, asking first when it is in `confirm_scenes`. False when the user said no. */
export function runScene(hass, config, entityId, name) {
  if (confirmScenes(config).has(entityId) && !window.confirm(`Run "${name}"?`)) return false;
  hass.callService(entityId.split(".")[0], "turn_on", { entity_id: entityId });
  return true;
}

/** True when this page session changed hidden rooms or room order (tabs need a reload to follow). */
export const roomsChangedThisSession = () => override !== null || orderOverride !== null;
