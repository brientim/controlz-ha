import { visibleItems } from "./area-cache.js";
import { areasOrder } from "./hidden.js";
import { ICONS } from "./icons.js";
import { KIND, automationGroups, looseItems, sortedAreas } from "./model.js";
import { pickWeather } from "./weather-model.js";

/** House-wide pages (ControlZ system rooms): which tile kinds each lists. */
export const HOUSE_PAGES = Object.freeze({
  coverings: { title: "Window Coverings", kinds: [KIND.COVER], icon: ICONS.blinds },
  cameras: { title: "Cameras", kinds: [KIND.CAMERA], icon: ICONS.camera },
  sensors: { title: "Sensors", kinds: [KIND.SENSOR, KIND.MOTION], icon: ICONS.walk },
});

/** Room groups of a house page's kinds (dashboard room order), then "No room"; hidden rooms and devices left out. */
export function houseGroups(hass, config, kinds, hidden) {
  const wanted = new Set(kinds);
  const groups = sortedAreas(hass, { order: areasOrder(config) })
    .filter((a) => !hidden.areas.has(a.area_id))
    .map((a) => ({ id: a.area_id, name: a.name, items: visibleItems(hass, a.area_id, config).filter((i) => wanted.has(i.kind)) }))
    .filter((g) => g.items.length);
  const loose = looseItems(hass, kinds, hidden.entities);
  if (loose.length) groups.push({ id: "", name: "No room", items: loose });
  return groups;
}

/**
 * House pages with something to show, unless turned off (`coverings_view` / `cameras_view` /
 * `sensors_view` / `weather_view: false`). Weather needs a weather entity.
 */
export function availableHousePages(hass, config) {
  const hidden = { areas: new Set(config.hide_areas || []), entities: new Set(config.hide_entities || []) };
  const pages = Object.entries(HOUSE_PAGES)
    .filter(([id, p]) => config[`${id}_view`] !== false && houseGroups(hass, config, p.kinds, hidden).length > 0)
    .map(([id, p]) => ({ id, ...p }));
  if (config.weather_view !== false && pickWeather(hass, config.weather_entity)) pages.push({ id: "weather", title: "Weather", icon: ICONS.weather, kinds: [] });
  return pages;
}

/**
 * Pages other than rooms that can show the security banner, as `security_banner_rooms` entries
 * (`page:favorites`, `page:weather`, …). Room entries are area ids.
 */
export function bannerPages(hass, config) {
  return [
    ...(config.favorites_view !== false ? [{ id: "page:favorites", name: "Favorites" }] : []),
    ...(config.automations_view !== false && automationGroups(hass).length ? [{ id: "page:automations", name: "Automations" }] : []),
    ...availableHousePages(hass, config).map((p) => ({ id: `page:${p.id}`, name: p.title })),
  ];
}
