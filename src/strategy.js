import { areaItems } from "./area-cache.js";
import { availableHousePages } from "./house-grids.js";
import { automationGroups, sortedAreas } from "./model.js";

const HOUSE_VIEW_ICONS = { coverings: "mdi:blinds", cameras: "mdi:cctv", sensors: "mdi:motion-sensor", weather: "mdi:weather-partly-cloudy" };
const PAGE_TOGGLES = ["coverings_view", "cameras_view", "sensors_view", "weather_view"];
import { effectiveNav } from "./prefs.js";
import { resolveAreaIcon } from "./room-icons.js";

/**
 * Dashboard strategy `custom:controlz-rooms`.
 *
 *   strategy:
 *     type: custom:controlz-rooms
 *     room_nav: tabs            # tabs = All Rooms + one view (tab) per area; sidebar = ControlZ room sidebar
 *     tile_size: large          # large | thin | compact (default; each device can override from the View menu)
 *     tile_scale: 1             # 0.4–1.5; 0.6 shrinks every page ~40% so more tiles fit (View menu: 100/80/60%)
 *     areas_order: [office]     # optional, pinned first (View → Edit rooms & favorites reorders)
 *     hide_areas: [garage]      # optional: rooms left out (View → Edit rooms & favorites edits this)
 *     hide_entities: []         # optional: devices left out of tiles and room controls
 *     entities_order:           # optional: device tile order per room (edit mode reorders); others follow by name
 *       office: [light.desk_lamp, light.ceiling]
 *     security_include: []      # optional: only these entities can raise the security banner
 *     security_exclude: []      # optional: entities that never raise the security banner
 *     security_banner: all_rooms  # all_rooms | every_room | rooms | off (View → Security banner… edits this)
 *     security_banner_rooms: []   # with `rooms`: room pages that also show the banner
 *     favorites_view: true      # false = no Favorites view (favorites are per Home Assistant user)
 *     automations_view: true    # false = no Automations view (room pages still list their automations)
 *     coverings_view: true      # false = no house-wide Window Coverings page (Open all / Close all)
 *     cameras_view: true        # false = no Cameras page
 *     sensors_view: true        # false = no Sensors page (by room, by type, batteries & offline)
 *     weather_view: true        # false = no Weather page (shown when Home Assistant has a weather entity)
 *     weather_entity: weather.home  # optional: which weather entity the Weather page shows
 *     battery_threshold: 20     # All Rooms maintenance report: batteries under this % count as low
 *     show_maintenance: true    # false = no low battery / offline chip on All Rooms
 *     view_icons: false         # tabs only: room icons in tabs (HA then hides tab titles)
 *     icon_source: controlz     # controlz = ControlZ room icon registry first; area = HA area icon first
 *     room_icons:               # optional per-area override: registry name, registry id or mdi:*
 *       office: Library
 *     scenes_style: chips       # chips = compact scene row on room pages; tiles = full scene tiles
 *     icons_view: false         # true = extra "Room Icons" view (resolved icons + registry browser)
 *
 * The View menu's per-device Rooms choice (Tabs / Sidebar) overrides `room_nav` here, so the
 * layout follows it after the page reloads.
 */
export class ControlZRoomsStrategy extends HTMLElement {
  static async generate(config, hass) {
    const tileSize = config.tile_size || "large";
    const roomNav = effectiveNav(config.room_nav);
    const areaOptions = { order: config.areas_order || [], hide: config.hide_areas || [] };
    const shared = {
      tile_size: tileSize,
      ...(config.tile_scale != null ? { tile_scale: config.tile_scale } : {}),
      room_nav: config.room_nav || "tabs",
      show_nav_menu: true,
      editable: true,
      ...(config.hide_areas ? { hide_areas: config.hide_areas } : {}),
      ...(config.hide_entities ? { hide_entities: config.hide_entities } : {}),
      ...(config.entities_order ? { entities_order: config.entities_order } : {}),
      ...(config.room_exclude ? { room_exclude: config.room_exclude } : {}),
      ...(config.confirm_scenes ? { confirm_scenes: config.confirm_scenes } : {}),
      ...(config.room_icons ? { room_icons: config.room_icons } : {}),
      ...(config.icon_source ? { icon_source: config.icon_source } : {}),
    };
    const security = {
      ...(config.security_include ? { security_include: config.security_include } : {}),
      ...(config.security_exclude ? { security_exclude: config.security_exclude } : {}),
      ...(config.security_banner ? { security_banner: config.security_banner } : {}),
      ...(config.security_banner_rooms ? { security_banner_rooms: config.security_banner_rooms } : {}),
    };
    const home = {
      ...(config.battery_threshold != null ? { battery_threshold: config.battery_threshold } : {}),
      ...(config.show_maintenance != null ? { show_maintenance: config.show_maintenance } : {}),
    };
    const scenes = config.scenes_style ? { scenes_style: config.scenes_style } : {};
    const showFavorites = config.favorites_view !== false;
    const showAutomations = config.automations_view !== false && automationGroups(hass).length > 0;
    const iconsView = config.icons_view
      ? [{ title: "Room Icons", path: "room-icons", type: "panel", cards: [{ type: "custom:controlz-room-icons-card", ...shared }] }]
      : [];

    if (roomNav === "sidebar") {
      return {
        title: config.title || "ControlZ",
        views: [
          {
            title: config.title || "ControlZ",
            path: "rooms",
            type: "panel",
            cards: [{
              type: "custom:controlz-rooms-app",
              ...shared,
              ...security,
              ...home,
              ...scenes,
              areas_order: areaOptions.order,
              hide_areas: areaOptions.hide,
              ...(showFavorites ? {} : { favorites_view: false }),
              ...(config.automations_view === false ? { automations_view: false } : {}),
              ...Object.fromEntries(PAGE_TOGGLES.filter((k) => config[k] === false).map((k) => [k, false])),
              ...(config.weather_entity ? { weather_entity: config.weather_entity } : {}),
            }],
          },
          ...iconsView,
        ],
      };
    }

    const areas = sortedAreas(hass, areaOptions).filter((a) => areaItems(hass, a.area_id).length > 0);
    return {
      title: config.title || "ControlZ",
      views: [
        {
          title: "All Rooms",
          path: "rooms",
          ...(config.view_icons ? { icon: "mdi:view-dashboard-variant" } : {}),
          type: "panel",
          cards: [{
            type: "custom:controlz-home-grid",
            ...shared,
            ...security,
            ...home,
            areas_order: areaOptions.order,
            hide_areas: areaOptions.hide,
          }],
        },
        ...(showFavorites ? [{
          title: "Favorites",
          path: "favorites",
          ...(config.view_icons ? { icon: "mdi:heart" } : {}),
          type: "panel",
          cards: [{ type: "custom:controlz-favorites-grid", ...shared, ...scenes, areas_order: areaOptions.order }],
        }] : []),
        ...(showAutomations ? [{
          title: "Automations",
          path: "automations",
          ...(config.view_icons ? { icon: "mdi:robot" } : {}),
          type: "panel",
          cards: [{ type: "custom:controlz-automations-grid", ...shared, areas_order: areaOptions.order }],
        }] : []),
        ...availableHousePages(hass, config).map((p) => ({
          title: p.id === "coverings" ? "Coverings" : p.title,
          path: p.id,
          ...(config.view_icons ? { icon: HOUSE_VIEW_ICONS[p.id] } : {}),
          type: "panel",
          cards: [p.id === "weather"
            ? { type: "custom:controlz-weather-grid", ...shared, ...(config.weather_entity ? { weather_entity: config.weather_entity } : {}) }
            : { type: "custom:controlz-house-grid", page: p.id, ...shared, ...home, areas_order: areaOptions.order }],
        })),
        ...areas.map((a) => ({
          title: a.name,
          path: `room-${a.area_id}`,
          ...(config.view_icons ? { icon: resolveAreaIcon(hass, a.area_id, shared).icon.mdi } : {}),
          type: "panel",
          cards: [{
            type: "custom:controlz-room-grid",
            area: a.area_id,
            ...shared,
            ...security,
            ...scenes,
          }],
        })),
        ...iconsView,
      ],
    };
  }
}
