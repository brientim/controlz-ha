import { areaItems } from "./area-cache.js";
import { sortedAreas } from "./model.js";
import { resolveAreaIcon } from "./room-icons.js";

/**
 * Dashboard strategy `custom:controlz-rooms`: an "All Rooms" view plus one panel view
 * per Home Assistant area (the view tabs act as the ControlZ room strip).
 *
 *   strategy:
 *     type: custom:controlz-rooms
 *     tile_size: large          # large | thin | compact
 *     areas_order: [office]     # optional, pinned first
 *     hide_areas: [garage]      # optional
 *     view_icons: false         # true = room icons in tabs (HA then hides tab titles)
 *     icon_source: controlz     # controlz = ControlZ room icon registry first; area = HA area icon first
 *     room_icons:               # optional per-area override: registry name, registry id or mdi:*
 *       office: Library
 *     scenes_style: chips       # chips = compact scene row on room pages; tiles = full scene tiles
 *     icons_view: false         # true = extra "Room Icons" view (resolved icons + registry browser)
 */
export class ControlZRoomsStrategy extends HTMLElement {
  static async generate(config, hass) {
    const tileSize = config.tile_size || "large";
    const areaOptions = { order: config.areas_order || [], hide: config.hide_areas || [] };
    const areas = sortedAreas(hass, areaOptions).filter((a) => areaItems(hass, a.area_id).length > 0);
    const icons = {
      ...(config.room_icons ? { room_icons: config.room_icons } : {}),
      ...(config.icon_source ? { icon_source: config.icon_source } : {}),
    };
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
            tile_size: tileSize,
            areas_order: areaOptions.order,
            hide_areas: areaOptions.hide,
            ...icons,
          }],
        },
        ...areas.map((a) => ({
          title: a.name,
          path: `room-${a.area_id}`,
          ...(config.view_icons ? { icon: resolveAreaIcon(hass, a.area_id, icons).icon.mdi } : {}),
          type: "panel",
          cards: [{
            type: "custom:controlz-room-grid",
            area: a.area_id,
            tile_size: tileSize,
            ...(config.scenes_style ? { scenes_style: config.scenes_style } : {}),
            ...icons,
          }],
        })),
        ...(config.icons_view
          ? [{ title: "Room Icons", path: "room-icons", type: "panel", cards: [{ type: "custom:controlz-room-icons-card", ...icons }] }]
          : []),
      ],
    };
  }
}
