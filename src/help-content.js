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
  version: "0.6.0",
  items: [
    "Automations can do several things in order: + Add action under Then.",
    "Control a room: one action for all the lights, blinds, fans… in a room.",
    "Device, scene and room pickers follow your ControlZ rooms.",
    "Export scenes and automations as YAML or JSON; Import them on any Home Assistant.",
    "Tap a scene (or right-click a scene chip) to see what it sets.",
    "Help (this page) and the version number in the View menu.",
    "Security banner on every room, chosen rooms or off: View → Security banner… (admins).",
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
    id: "view",
    title: "View menu",
    text: "View (top right) sets the tile size (Large, Thin, Compact), the scale (50–120%), rooms as tabs or a sidebar, and the page this device starts on. These choices are saved on this device only, so a wall tablet and a phone can differ.",
    steps: ["Start on … makes this device open on the current page.", "Use dashboard defaults puts this device back to the dashboard's settings."],
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
      "Admins: View → Security banner… shows it on All Rooms only, every room, chosen rooms, or turns it off.",
      "A banner on a room page still covers the whole house.",
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
      "Control a room: all the lights, coverings, fans… in one room at once.",
      "Anything with conditions or waits opens Home Assistant's own editor.",
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
