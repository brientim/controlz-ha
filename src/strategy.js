import { areaItems } from "./area-cache.js";
import { sortedAreas } from "./model.js";
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
 *     areas_order: [office]     # optional, pinned first
 *     hide_areas: [garage]      # optional
 *     security_include: []      # optional: only these entities can raise the security banner
 *     security_exclude: []      # optional: entities that never raise the security banner
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
      ...(config.room_icons ? { room_icons: config.room_icons } : {}),
      ...(config.icon_source ? { icon_source: config.icon_source } : {}),
    };
    const security = {
      ...(config.security_include ? { security_include: config.security_include } : {}),
      ...(config.security_exclude ? { security_exclude: config.security_exclude } : {}),
    };
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
              areas_order: areaOptions.order,
              hide_areas: areaOptions.hide,
              ...(config.scenes_style ? { scenes_style: config.scenes_style } : {}),
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
            areas_order: areaOptions.order,
            hide_areas: areaOptions.hide,
          }],
        },
        ...areas.map((a) => ({
          title: a.name,
          path: `room-${a.area_id}`,
          ...(config.view_icons ? { icon: resolveAreaIcon(hass, a.area_id, shared).icon.mdi } : {}),
          type: "panel",
          cards: [{
            type: "custom:controlz-room-grid",
            area: a.area_id,
            ...shared,
            ...(config.scenes_style ? { scenes_style: config.scenes_style } : {}),
          }],
        })),
        ...iconsView,
      ],
    };
  }
}
