# ControlZ HA

ControlZ-style **Rooms and Tiles** for Home Assistant: Lovelace custom cards plus a dashboard strategy that builds a whole room-by-room dashboard from your Home Assistant **Areas**. The tile designs, sizes, colours and room badges come from the ControlZ home control app.

![All Rooms](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/sliders-all-rooms.png)

## Install with HACS

1. In Home Assistant open **HACS**, then the three-dot menu → **Custom repositories**.
2. Add `https://github.com/brientim/controlz-ha` with type **Dashboard**.
3. Open **ControlZ HA** in HACS and select **Download**, then reload your browser.

HACS adds the dashboard resource for you (Lovelace storage mode, the default).

### Create the ControlZ dashboard

1. **Settings → Dashboards → Add dashboard → New dashboard from scratch**, name it "ControlZ".
2. Open it, then three-dot menu → **Edit dashboard** → three-dot menu → **Raw configuration editor**.
3. Replace everything with:

```yaml
strategy:
  type: custom:controlz-rooms
```

You get an **All Rooms** view (security banner plus a tile per room) and one view per area. Tapping a room tile opens that room.

### Manual install

Download `controlz-ha.js` from the [latest release](https://github.com/brientim/controlz-ha/releases/latest), copy it to `config/www/`, and add `/local/controlz-ha.js` as a **JavaScript module** under **Settings → Dashboards → Resources**.

## What you get

| Card | Purpose |
|------|---------|
| `custom:controlz-rooms` (strategy) | Generates the whole dashboard: All Rooms plus one view per area. The view tabs act as the room strip. |
| `custom:controlz-room-card` | Room tile for one area. Green chip = lights on (lights only, not switches/outlets), orange = outlets on, blue = coverings open. Rooms with lights and coverings control both. |
| `custom:controlz-room-grid` | A full room page: room tile, then Scenes, Lights, Window Coverings, Security, Sensors and Other. |
| `custom:controlz-home-grid` | All Rooms: security banner (Secure / Motion / Insecure) and a room tile per area. |
| `custom:controlz-tile-card` | One device tile; the tile type is picked from the entity. |
| `custom:controlz-room-icons-card` | The icon each room resolved to (and why), plus the searchable room icon registry. |

**Tile sizes.** Every card takes `tile_size: large | thin | compact`. All tiles of a size have the same height (Large 200 px, Thin 100 px, Compact 150 px) and never grow. Each size shows what fits; the room controls popup (the button on every room tile) always has on/off, brightness, Warm / Neutral / Cool, colours and coverings.

| Size | Room tile |
|------|-----------|
| Large | Brightness slider + on/off; coverings position + Open / Stop / Close |
| Thin | One row: on/off + controls button (coverings-only rooms: Open / Stop / Close) |
| Compact | Badge chips under the name; on/off, plus Open / Stop / Close for rooms with coverings |

**Sliders.** Brightness sliders have a lightbulb and an amber fill (white on lit tiles); covering position sliders have a blinds icon and a blue fill.

**Scenes** show as a row of chips on each room page; tap to run, right-click for details. The room name Hue adds is dropped, so "Kitchen Bright Kitchen" reads "Bright". Set `scenes_style: tiles` for full scene tiles.

![Room page](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/sliders-office.png)

### How Home Assistant maps to ControlZ

| ControlZ | Home Assistant |
|----------|----------------|
| Room | Area (an entity's own area wins over its device's area) |
| Light tile | `light.*`; `switch.*` (wall switch); `switch.*` with `device_class: outlet` (outlet) |
| Window covering tile | `cover.*` (except garage / gate) |
| Security tile | `lock.*`, `alarm_control_panel.*`, garage/gate covers, door / window / opening / smoke / gas / CO / moisture binary sensors |
| Sensor tile | Motion / occupancy / presence binary sensors (with temperature from the same device); temperature, humidity, lux, CO₂, PM, power sensors |
| Scene | `scene.*`, `script.*`, `automation.*` |
| Other | fan, climate, media player, humidifier, vacuum, valve, water heater |

Hidden entities and config/diagnostic entities are skipped. Tapping a device tile opens Home Assistant's own more-info dialog.

### Room icons

Room icons come from the ControlZ room icon registry (114 room types with room-name suggestions), mapped to Material Design Icons. The icon for each room is chosen in this order:

1. `icon:` on a room card
2. `room_icons:` on the strategy (per area id)
3. ControlZ suggestion from the room name: exact match, then whole-word partial match ("Bedroom 1" → Bedroom, "Upstairs Toilet" → Toilet)
4. The Home Assistant area icon
5. House (or Blinds for coverings-only rooms)

Set `icon_source: area` to prefer Home Assistant area icons. An icon can be a registry name (`Library`), a registry id (`system:sofa.fill`) or any `mdi:` icon.

## Options

```yaml
strategy:
  type: custom:controlz-rooms
  tile_size: large                 # large | thin | compact
  areas_order: [office, kitchen]   # pinned first
  hide_areas: [utility]            # left out
  scenes_style: chips              # chips | tiles
  icon_source: controlz            # controlz | area
  room_icons:                      # per-area icon overrides
    office: Library
  view_icons: false                # true = room icons in the tabs (HA then hides tab titles)
  icons_view: false                # true = extra Room Icons view
```

Single cards in any dashboard:

```yaml
type: custom:controlz-room-card
area: living_room
navigation_path: /dashboard-controlz/room-living_room   # optional: tap opens that view
---
type: custom:controlz-tile-card
entity: light.office_colour_light
tile_size: thin
```

## Limitations

- New areas or devices moved between areas appear after a dashboard reload.
- Alarm panels that need a code are armed / disarmed from Home Assistant's more-info dialog.
- Tested on Home Assistant 2026.10.

## Development

```bash
npm install
npm test            # unit tests (node:test)
npm run build       # dist/controlz-ha.js
npm run serve       # then open http://127.0.0.1:8765/dev/harness.html
```

`dev/harness.html` renders the dashboard against a mock `hass` (`dev/fixture.js`); service calls change the fixture state and show in a log overlay. Query parameters: `?view=room-office&size=thin&dark=1`. `?fit=1` measures every tile at every size and reports any that are off-contract, clipped or overflowing.

**Deploy a dev build without HACS** (copies to `config/www` over SSH and creates the dashboard):

```bash
export HA_TOKEN='...' HA_URL='http://homeassistant.local:8123'
export HA_WWW_SCP_TARGET='root@homeassistant.local:/config/www/'
python3 scripts/deploy.py            # --tile-size compact | --cards-only | --status
python3 scripts/deploy.py --remove-local   # after switching to the HACS install
```

**Release:** bump the version (`npm version patch --no-git-tag-version`), commit, then `./scripts/release.sh` — it tests, builds, tags, pushes, and creates the GitHub release with `controlz-ha.js` attached for HACS.

## License

[MIT](LICENSE)
