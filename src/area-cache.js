import { hiddenLists, roomExcluded } from "./hidden.js";
import { entitiesForArea } from "./model.js";

/**
 * Area → tile items, recomputed only when the registries change (HA replaces
 * `hass.entities` / `hass.devices` on registry updates) or entities appear in `hass.states`.
 */
const cache = new WeakMap();

export function areaItems(hass, areaId) {
  if (!hass?.entities) return [];
  const statesCount = Object.keys(hass.states || {}).length;
  let entry = cache.get(hass.entities);
  if (!entry || entry.devices !== hass.devices || entry.statesCount !== statesCount) {
    entry = { devices: hass.devices, statesCount, byArea: new Map() };
    cache.set(hass.entities, entry);
  }
  if (!entry.byArea.has(areaId)) entry.byArea.set(areaId, entitiesForArea(hass, areaId));
  return entry.byArea.get(areaId);
}

/** Area items without the entities hidden on this dashboard (`hide_entities`). */
export function visibleItems(hass, areaId, config) {
  const { entities } = hiddenLists(config);
  const items = areaItems(hass, areaId);
  return entities.size ? items.filter((i) => !entities.has(i.entity_id)) : items;
}

/** What the room tile controls and counts: visible items minus `room_exclude`. */
export function masterItems(hass, areaId, config) {
  const excluded = roomExcluded(config);
  const items = visibleItems(hass, areaId, config);
  return excluded.size ? items.filter((i) => !excluded.has(i.entity_id)) : items;
}

export const itemsKey = (items) => items.map((i) => `${i.entity_id}:${i.kind}`).join(",");
