# ControlZ HA

ControlZ-style **Rooms and Tiles** for Home Assistant: Lovelace custom cards plus a dashboard strategy that builds a whole room-by-room dashboard from your Home Assistant **Areas**. The tile designs, sizes, colours and room badges come from the ControlZ home control app.

![All Rooms](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/sliders-all-rooms.png)

## Install

[![Open your Home Assistant instance and open this repository.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=brientim&repository=controlz-ha&category=plugin)

The button opens ControlZ HA in your Home Assistant and offers to add it as a custom repository. It works with both stores:

- **Home Assistant 2026.11 and newer — Marketplace.** HACS is built into Home Assistant as **Settings → Marketplace**. Select **Download**, then reload your browser. Updates appear under **Settings → Updates**.
- **Home Assistant 2026.10 and older — HACS.** In **HACS**, three-dot menu → **Custom repositories**, add `https://github.com/brientim/controlz-ha` with type **Dashboard**, then open **ControlZ HA**, select **Download**, and reload your browser.

Either store adds the dashboard resource for you (Lovelace storage mode, the default). Upgrading from HACS to 2026.11 moves an existing install to the Marketplace automatically. Because ControlZ HA is added from a link (not the default catalog), the store checks GitHub for new releases about every 48 hours, and needs a GitHub connection to do so.

### Create the ControlZ dashboard

1. **Settings → Dashboards → Add dashboard → New dashboard from scratch**, name it "ControlZ".
2. Open it, then three-dot menu → **Edit dashboard** → three-dot menu → **Raw configuration editor**.
3. Replace everything with:

```yaml
strategy:
  type: custom:controlz-rooms
```

You get an **All Rooms** view (security banner, All / On / Off filter and a tile per room), a **Favorites** view, an **Automations** view and one view per area. Tapping a room tile opens that room. Add `room_nav: sidebar` for the ControlZ room sidebar instead of tabs.

![Sidebar](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/sidebar-office.png)

### Rooms: tabs or sidebar

- **Tabs** (`room_nav: tabs`, default): All Rooms plus one Home Assistant view per area; the view tabs are the room strip.
- **Sidebar** (`room_nav: sidebar`): a ControlZ-style room sidebar with each room's icon and badge chips (green lights, orange outlets, blue coverings; All Rooms shows the security state), with Favorites and Automations under All Rooms. The selected page fills the rest of the screen, and the URL (`#room=office`, `#page=favorites`) keeps back / forward and links working. Below 700 px wide the sidebar becomes a horizontal room strip, like ControlZ on iPhone.

### View menu

Every page has a **View** menu (top right; in the sidebar next to the title) to pick the **tile size** (Large / Thin / Compact), the **scale** (slider 50–120%, plus 50 / 60 / 80 / 100% buttons) and **Rooms** layout (Tabs / Sidebar). The choice is saved on that device only, so a wall tablet can use Compact + Sidebar while a phone keeps Large + Tabs; **Use dashboard defaults** clears it. Tile size and scale change immediately; switching Tabs / Sidebar reloads the page.

**Scale** shrinks everything below the page header together — tiles, controls, text and spacing — so tiles keep their look, controls keep fitting, and more tiles fit on screen (60% shows about 1.7× as many per row). The header, View menu and controls sheets stay full size. Set a dashboard default with `tile_scale` (any value from 0.4 to 1.5). At 50–60% text and buttons are small; 80% is a good middle ground on touch screens.

**Start page** (ControlZ Startup Room): open any room, Favorites or Automations and choose **View → Start on …** to make this device open there. It only applies when the dashboard is opened, so going back to All Rooms afterwards stays on All Rooms. **Start on All Rooms** clears it.

### Favorites

Your favorite rooms, scenes and devices, on the **Favorites** view (tabs) or the Favorites row (sidebar). Tap ♥ in a room's or device's controls (light, thermostat, fan, alarm, automation), or choose **View → Edit favorites…** and tap ♥ on any tile.

Favorites are saved **per Home Assistant user** (Home Assistant's frontend user data), so every member of the household keeps their own list and it follows them to every phone, tablet and browser. Non-admins can edit their favorites too. If that storage is not available, favorites are kept in the browser instead. Hidden rooms and devices stay out of Favorites. Turn the view off with `favorites_view: false`.

![Favorites](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/favorites.png)

### Edit rooms & favorites: hide, show and reorder

**View → Edit rooms & favorites…** (on the ControlZ dashboard) puts a ♥ on every tile and sidebar room for everyone. Home Assistant admins also get a hide / show button and arrows to reorder (on a computer you can also drag a tile onto another one):

- **Rooms** on All Rooms and in the sidebar (▲▼). Room views (tabs) follow after **Done**.
- **Device tiles** on a room page, within each section (Lights, Scenes, Security, …). Scene chips follow the new order. The Automations view reorders automations within each room and shares that order with the room page.
- **Favorites**: on the Favorites page every user can reorder their own favorite rooms and devices; that order is saved with their favorites.

Hidden items stay dimmed while you edit so you can bring them back; press **Done** when finished. Hiding and room / device order are saved in the dashboard config (`hide_areas`, `hide_entities`, `areas_order`, `entities_order`), so they apply on every device; devices you never moved keep their alphabetical place after the ones you did. Hidden devices also drop out of their room tile (on/off, brightness, badge counts). They still count for the security banner — use `security_exclude` for that.

![Edit mode](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/edit-all-rooms.png)

### All Rooms: what's on, all lights off, maintenance

- **All / On / Off** (ControlZ light filter) shows every room, the rooms with lights or outlets on, or the rooms where everything is off. **On** also lists every light, switch, outlet and fan that is on right now, across the house. The choice is kept on this device.
- **All lights off** turns off every light and wall switch in the rooms on the page (after asking). Outlets such as a kettle are left alone.
- **Maintenance** (ControlZ Low Battery Report): a chip appears when a battery is under `battery_threshold` % (default 20) or a device is unavailable. Tap it for the list, then a device for its details. Battery sensors count even though Home Assistant files them as diagnostic entities. Hide the chip with `show_maintenance: false`.

![Maintenance](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/maintenance.png)

### Automations

Automations have their own **Automations** view (grouped by room, then "No room") and an Automations section on each room page. Each automation tile has:

- **Run** — asks first, then runs the automation **with its conditions checked**. (Earlier versions ran automations from the scene row with `automation.trigger`, which skips conditions by default.) The details sheet also has **Run, skip conditions**.
- **Enable / disable** (⏻).
- **What this will do** — the automation's triggers, conditions and actions in plain words ("When Front Door changes to on", "Turn on Hall Light").
- For Home Assistant admins: **Edit**, **Delete**, and in the details sheet **Duplicate**, **Traces** and **Open in Home Assistant**.

**+ New automation** (Automations view, or **+ New** on a room's Automations heading) opens a simple editor like ControlZ's: a name, a room, one trigger (a time, a device changing, or sunrise / sunset with an offset) and one action (activate a scene, run a script, or control a device). It saves through Home Assistant's own automation config API, so the result is an ordinary Home Assistant automation. **Edit** uses the same editor when an automation is that simple; anything with conditions, several steps or templates opens Home Assistant's automation editor instead, so nothing is ever rewritten in a simpler form. Turn the view off with `automations_view: false`; room pages still list their automations.

![Automation details](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/automation-sheet.png) With tabs, the page reloads after Done so hidden rooms leave the tab bar.

### Security banner

The banner at the top of All Rooms looks at every Home Assistant device that gets a Security tile, in every area, and names the ones that need attention. Tap it for the full list; tap a device for its details.

| Banner | When |
|--------|------|
| **INSECURE** (red) | A lock is unlocked or open, a door / opening / garage door sensor or garage / gate cover is open, an alarm panel is triggered, or a smoke / gas / CO / leak / safety / tamper sensor is on |
| **CHECK** (amber) | A window sensor is open or a lock is jammed (and nothing is red) |
| **MOTION** (yellow) | A motion / occupancy / presence sensor is on (and nothing is red or amber) |
| **SECURE** (green) | None of the above |

Unavailable devices, hidden entities and diagnostic entities never raise the banner. Like ControlZ's Security membership, you can scope it: `security_include` (only these entities count) or `security_exclude` (these never count).

**Alarm panels**: tap the alarm tile (or its ARM / DISARM button) for the ControlZ keypad. It offers the arm modes the panel supports (Away, Home, Night, Vacation, Bypass) and a number keypad or code field when the panel needs a code. Panels that arm without a code arm Away in one tap from the tile.

### Manual install

Download `controlz-ha.js` from the [latest release](https://github.com/brientim/controlz-ha/releases/latest), copy it to `config/www/`, and add `/local/controlz-ha.js` as a **JavaScript module** under **Settings → Dashboards → Resources**. Don't combine this with a Marketplace / HACS install, or two copies of the cards load.

## What you get

| Card | Purpose |
|------|---------|
| `custom:controlz-rooms` (strategy) | Generates the whole dashboard: All Rooms plus one view per area. The view tabs act as the room strip. |
| `custom:controlz-room-card` | Room tile for one area. Green chip = lights on (lights only, not switches/outlets), orange = outlets on, blue = coverings open. Rooms with lights and coverings control both. |
| `custom:controlz-room-grid` | A full room page: room tile, then Scenes, Lights, Window Coverings, Climate, Security, Cameras, Sensors, Automations and Other. |
| `custom:controlz-home-grid` | All Rooms: security banner (tap for the device list), All / On / Off filter, All lights off, maintenance chip, and a room tile per area. |
| `custom:controlz-favorites-grid` | Favorites: your favorite rooms, scenes and devices (per Home Assistant user). |
| `custom:controlz-automations-grid` | Automations by room: run, enable, details; admins also new / edit / duplicate / delete. |
| `custom:controlz-rooms-app` | Sidebar layout: room sidebar plus the selected room (use in a panel view; the strategy adds it for `room_nav: sidebar`). |
| `custom:controlz-tile-card` | One device tile; the tile type is picked from the entity. |
| `custom:controlz-room-icons-card` | The icon each room resolved to (and why), plus the searchable room icon registry. |

**Tile sizes.** Every card takes `tile_size: large | thin | compact`. All tiles of a size have the same height (Large 200 px, Thin 100 px, Compact 150 px) and never grow. Each size shows what fits; the room controls popup (the button on every room tile) always has on/off, brightness, Warm / Neutral / Cool, colours and coverings.

| Size | Room tile |
|------|-----------|
| Large | Brightness slider + on/off; coverings position + Open / Stop / Close |
| Thin | One row: on/off + controls button (coverings-only rooms: Open / Stop / Close) |
| Compact | Badge chips under the name; on/off, plus Open / Stop / Close for rooms with coverings |

**Sliders.** Brightness sliders have a lightbulb and an amber fill (white on lit tiles); covering position sliders have a blinds icon and a blue fill; fan speed sliders have a fan icon and a teal fill.

**Room readings.** Large room tiles and the room page title show the room's temperature and humidity (💧): the average of its temperature / humidity sensors, else its motion sensors' own thermometers, else its thermostat.

**Thermostats** (ControlZ thermostat tiles) show the mode or what the thermostat is doing (HEATING, COOL, AUTO, OFF), the current temperature, and a − setpoint + row; the tile turns orange while heating and blue while cooling. Quick presses are sent as one setpoint. The thermostat sheet has the target (or Heat to / Cool to for a range), modes, presets and fan modes.

**Fans** have a power toggle and chip (teal when on), a speed slider on Large, and a sheet with speed, presets, oscillation and direction. **Cameras** show the latest snapshot (refreshed every 10 s while the page is visible); tap for Home Assistant's live view.

![Thermostat](https://raw.githubusercontent.com/brientim/controlz-ha/main/dev/screenshots/thermostat-sheet.png)

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
| Thermostat tile | `climate.*` |
| Fan tile | `fan.*` |
| Security camera | `camera.*` |
| Scene | `scene.*`, `script.*` |
| Automation tile | `automation.*` |
| Other | media player, humidifier, vacuum, valve, water heater |

Hidden entities and config/diagnostic entities are skipped. Tapping a light opens the compact ControlZ light sheet (on/off, brightness, Warm / Neutral / Cool, colours); **More details** there opens Home Assistant's own dialog. Other device tiles open Home Assistant's dialog directly. ControlZ sheets fit any window: their content scrolls when the window is short, and they become a bottom sheet on phones.

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
  room_nav: tabs                   # tabs | sidebar
  tile_size: large                 # large | thin | compact (each device can override in the View menu)
  tile_scale: 1                    # 0.4–1.5, e.g. 0.6 = 40% smaller (View menu: 100 / 80 / 60%)
  areas_order: [office, kitchen]   # pinned first
  hide_areas: [utility]            # rooms left out (View → Edit rooms & favorites edits this and areas_order)
  hide_entities: [switch.kettle]   # devices left out of tiles and room controls
  entities_order:                  # device tile order per room (edit mode writes this); others follow by name
    office: [light.office_desk_lamp, light.office_colour_light]
  scenes_style: chips              # chips | tiles
  security_include: []             # only these entity ids raise the security banner
  security_exclude: [binary_sensor.office_window]   # never raise the banner
  favorites_view: true             # false = no Favorites view
  automations_view: true           # false = no Automations view (room pages still list automations)
  battery_threshold: 20            # All Rooms maintenance chip: batteries under this % are low
  show_maintenance: true           # false = no low battery / offline chip
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

- New areas or devices moved between areas appear after a dashboard reload. With tabs, a reordered room list also follows after a reload (the page reloads itself after **Done**).
- Editing, duplicating and deleting automations needs a Home Assistant admin (Home Assistant's automation config API is admin-only). YAML automations without an `id` can be run and enabled, but not read or edited here.
- Favorites changed on one device show on another after it reloads.
- Tested on Home Assistant 2026.10.

## Development

```bash
npm install
npm test            # unit tests (node:test)
npm run build       # dist/controlz-ha.js
npm run serve       # then open http://127.0.0.1:8765/dev/harness.html (add ?fresh=1 to clear saved hides)
```

`dev/harness.html` renders the dashboard against a mock `hass` (`dev/fixture.js`); service calls change the fixture state and show in a log overlay. The mock also fakes the automation config API, frontend user data (favorites) and entity registry updates for the browser session (`?fresh=1` resets them). Query parameters: `?view=room-office&size=thin&dark=1&nav=sidebar&admin=0&open=menu|security|edit|maintenance|light-sheet|room-sheet|climate-sheet|fan-sheet|alarm-sheet|automation-sheet|editor-sheet`. `?fit=1` measures every tile at every size and reports any that are off-contract, clipped, overflowing or off-screen; add `&scale=0.6` and `&nav=sidebar` to check those too.

**Deploy a dev build without HACS** (copies to `config/www` over SSH and creates the dashboard):

```bash
export HA_TOKEN='...' HA_URL='http://homeassistant.local:8123'
export HA_WWW_SCP_TARGET='root@homeassistant.local:/config/www/'
python3 scripts/deploy.py            # --tile-size compact | --cards-only | --status
python3 scripts/deploy.py --remove-local   # after switching to the Marketplace / HACS install
```

**Release:** bump the version (`npm version patch --no-git-tag-version`), commit, then `./scripts/release.sh` — it tests, builds, tags, pushes, and creates the GitHub release with `controlz-ha.js` attached. The Marketplace and HACS install that release asset (they look for `controlz-ha.js`, named in `hacs.json`).

## License

[MIT](LICENSE)
