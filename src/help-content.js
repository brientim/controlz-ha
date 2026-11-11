/**
 * Help sheet content (View → Help). Plain data so test/help-content.test.js can check that every
 * screenshot exists in dev/screenshots and every README anchor exists. Screenshots and README
 * links are pinned to the installed version's tag, so they match what the user is running.
 * Update WHATS_NEW for every release.
 */
export const REPO = "brientim/controlz-ha";

/** Git ref for links: the release tag, or main for unreleased dev builds. */
export const helpRef = (version) => (/^\d+\.\d+\.\d+$/.test(version) ? `v${version}` : "main");
export const screenshotUrl = (version, file) => `https://raw.githubusercontent.com/${REPO}/${helpRef(version)}/dev/screenshots/${file}`;
export const readmeUrl = (version, anchor = "") => `https://github.com/${REPO}/blob/${helpRef(version)}/README.md${anchor ? `#${anchor}` : ""}`;

export const helpLinks = (version) => [
  { label: "Full guide (README)", url: readmeUrl(version) },
  { label: `Release notes ${helpRef(version)}`, url: helpRef(version) === "main" ? `https://github.com/${REPO}/releases` : `https://github.com/${REPO}/releases/tag/${helpRef(version)}` },
  { label: "Report a problem", url: `https://github.com/${REPO}/issues` },
  { label: "Source on GitHub", url: `https://github.com/${REPO}` },
];

export const WHATS_NEW = {
  version: "0.8.2",
  items: [
    "Each room can have its own tile size: on a room's page, View → This room (Same, Large, Thin or Compact), saved on this device.",
    "Admins can set a room's tile size for everyone (View → This room for everyone, or room_tile_sizes in YAML).",
  ],
};

/** `text` is plain text (escaped when shown); `steps` are short how-to lines. */
export const HELP_SECTIONS = [
  {
    id: "rooms",
    title: "Rooms and tiles",
    text: "All Rooms shows a tile for every Home Assistant area with lights, outlets and coverings, plus a security banner. Tap a room tile to open that room; tap the switch on a tile to turn the whole room on or off.",
    steps: [
      "All / On / Off shows every room, the rooms with something on, or the rooms where everything is off.",
      "All lights off turns off every light and wall switch on the page, after asking.",
      "Badges: green lights on, orange outlets on, blue coverings open.",
    ],
    image: "sliders-all-rooms.png",
    anchor: "create-the-controlz-dashboard",
  },
  {
    id: "controls",
    title: "Room pages and device controls",
    text: "A room page has the room tile, then Scenes, Lights, Window Coverings, Climate, Security, Sensors and Automations. Tap a tile (or its colour button) for its controls: brightness, colour, position, temperature and fan speed.",
    steps: ["Brightness is amber, coverings blue and fans teal, so sliders never look alike.", "More details opens Home Assistant's own dialog."],
    image: "sliders-office.png",
    anchor: "what-you-get",
  },
  {
    id: "room-pages",
    title: "Room status and filters",
    text: "Under a room's name, chips show motion, open doors and windows, unlocked locks and what the thermostat is doing; tap one for that device. All / On / Off / ♥ and the device types narrow the room to what you want to see.",
    steps: [
      "📈 History shows every sensor in the room with a chart and its low and high.",
      "Admins: in Edit rooms & favorites, the bulb under a light sets whether the room tile switches it.",
    ],
    image: "room-filters.png",
    anchor: "room-pages-status-filters-and-the-room-tile",
  },
  {
    id: "history",
    title: "History",
    text: "Tap a temperature, humidity, motion, door or window tile for its chart over 6 hours, 24 hours or 7 days. Security history lists every door, window, lock, alarm and motion change, newest first.",
    steps: ["Security history: tap the security banner, then What happened.", "Filter by type and room, search, and Export CSV."],
    image: "security-history.png",
    anchor: "history-sensors-rooms-and-security",
  },
  {
    id: "scenes-presets",
    title: "Scenes and presets",
    text: "Set a room how you like it, then + New scene on its Scenes heading saves it as a Home Assistant scene (admins). Presets run scenes and other steps in order, with waits between, like ControlZ's Home, Away and Bedtime.",
    steps: [
      "Tap the chevron on a Scenes row to collapse it on this device.",
      "Admins: Edit rooms & favorites → Hide for everyone on a Scenes row hides it for the whole dashboard.",
      "+ New preset is on All Rooms and the Automations page.",
      "In a scene's or preset's sheet, admins can make it ask before running.",
      "While a preset runs, a green banner offers Cancel.",
    ],
    image: "scene-capture.png",
    anchor: "scenes-and-presets",
  },
  {
    id: "house",
    title: "House pages and weather",
    text: "Window Coverings, Cameras, Sensors and Weather each have a page for the whole house. Coverings can open, stop or close them all; Sensors shows them by room, by type or by battery; Weather shows now, the next 24 hours, 7 days and the sun.",
    image: "weather.png",
    anchor: "house-pages-coverings-cameras-sensors-and-weather",
  },
  {
    id: "media",
    title: "Media and announcements",
    text: "Media players show what is playing, with play / pause, skip and volume. 📢 Announce speaks a message on the speakers you tick, using Home Assistant's text to speech; save phrases you use often.",
    image: "announce.png",
    anchor: "media-and-announcements",
  },
  {
    id: "view",
    title: "View menu",
    text: "View (top right) sets the tile size (Large, Thin, Compact), the scale (50–120%), rooms as tabs or a sidebar, what a lock's button does, the accent colour and corners, and the page this device starts on. These choices are saved on this device only, so a wall tablet and a phone can differ.",
    steps: [
      "On a room's page, This room gives that room its own tile size (admins can set it for everyone).",
      "Start on … makes this device open on the current page.",
      "Use dashboard defaults puts this device back to the dashboard's settings.",
    ],
    image: "view-menu.png",
    anchor: "view-menu",
  },
  {
    id: "favorites",
    title: "Favorites",
    text: "Your own favorite rooms, scenes and devices, on the Favorites page. They follow your Home Assistant user to every device.",
    steps: ["Tap ♥ in any device's or room's controls.", "Or View → Edit favorites… and tap ♥ on any tile."],
    image: "favorites.png",
    anchor: "favorites",
  },
  {
    id: "edit",
    title: "Hide and reorder (admins)",
    text: "View → Edit rooms & favorites… lets admins hide rooms and devices for everyone and change their order. Hidden items are dimmed while editing.",
    steps: ["Tap the eye to hide or show.", "Use the arrows, or drag on All Rooms, to reorder.", "Tap Done when finished."],
    image: "edit-all-rooms.png",
    anchor: "edit-rooms--favorites-hide-show-and-reorder",
  },
  {
    id: "security",
    title: "Security and maintenance",
    text: "The security banner turns red for open doors, unlocked locks and smoke or leak alarms, and amber for open windows. Tap it for the list. On All Rooms, a Maintenance chip appears when a battery is low or a device is unavailable; tap it for the list.",
    steps: [
      "Admins: View → Security banner… shows it on All Rooms only, every room and page, chosen rooms and pages, or turns it off.",
      "Pages include Favorites, Automations, Window Coverings, Cameras, Sensors and Weather; every banner covers the whole house.",
      "Tap a lock for Lock, Unlock and its history; View → Lock button sets whether its button asks first.",
    ],
    image: "security-banner-settings.png",
    anchor: "security-banner",
  },
  {
    id: "automations",
    title: "Automations",
    text: "The Automations page lists every automation by room. Run checks the automation's conditions first; the details sheet shows what it will do. Admins can create, edit, duplicate and delete.",
    steps: [
      "+ New automation: a name, a room, one trigger, then one or more actions.",
      "Triggers include every N minutes, arriving or leaving a place, and the sun's height.",
      "Actions include controlling a whole room, a notification, an announcement and a wait.",
      "Anything with conditions or choices opens Home Assistant's own editor.",
    ],
    image: "automation-editor.png",
    anchor: "automations",
  },
  {
    id: "transfer",
    title: "Scenes: export and import (admins)",
    text: "Tap a scene to see what it sets. Export shows a scene or automation as YAML or JSON to copy, download or share. Import adds scenes and automations from YAML or JSON as new ones; nothing is replaced.",
    steps: [
      "Export: open a scene or an automation's details → Export.",
      "Import: Automations page, or Import on a room's Scenes heading.",
    ],
    image: "export-sheet.png",
    anchor: "export-and-import",
  },
  {
    id: "sidebar",
    title: "Sidebar layout",
    text: "With rooms as a sidebar, every room is listed on the left with its icon and badges. On a phone the sidebar becomes a strip of rooms across the top.",
    image: "sidebar-office.png",
    anchor: "rooms-tabs-or-sidebar",
  },
];
