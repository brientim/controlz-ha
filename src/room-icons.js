/**
 * Room icon registry — port of ControlZ `RoomIconRegistry.swift` (SF Symbol entries, same order
 * and room-name suggestions). Each entry maps the ControlZ SF Symbol to a Material Design Icon so
 * it renders in Home Assistant; paths are bundled from @mdi/js so icons also render outside HA.
 *
 * Resolution (mirrors `resolvedRoomIconIdentifier` + `suggestedIcon(for:)`):
 *   card `icon` → `room_icons` map → exact name match → partial name match → HA area icon → House
 * With `icon_source: area` the HA area icon is tried before the name suggestions.
 */
import {
  mdiAccessPointNetwork, mdiAccountGroup, mdiAccountMultiple, mdiArchive, mdiBalcony, mdiBed,
  mdiBedDouble, mdiBedKing, mdiBilliards, mdiBlindsOpen, mdiBookshelf, mdiBrush, mdiCar, mdiChandelier,
  mdiCircle, mdiDesktopTowerMonitor, mdiDoorOpen, mdiDoorbellVideo, mdiDumbbell, mdiFire, mdiGamepadVariant,
  mdiGarage, mdiGlassWine, mdiGrill, mdiHexagonMultiple, mdiHome, mdiHomeAutomation, mdiHomeFloorNegative1,
  mdiHomeImportOutline, mdiHomeRoof, mdiHomeVariant, mdiLeaf, mdiMovieOpen, mdiMusicNote, mdiNumeric0Box,
  mdiNumeric1Box, mdiNumeric2Box, mdiOfficeBuilding, mdiPool, mdiShieldLock, mdiShoeSneaker, mdiShower,
  mdiSilverwareForkKnife, mdiSofa, mdiSofaSingle, mdiSpeaker, mdiSquare, mdiStairs, mdiStar, mdiTelevision,
  mdiTheater, mdiThermometer, mdiToilet, mdiTools, mdiTree, mdiTshirtCrew, mdiUmbrella, mdiViewGrid, mdiWalk,
  mdiWashingMachine, mdiWater, mdiWhiteBalanceSunny, mdiWindowClosedVariant, mdiZigbee,
} from "@mdi/js";

export const ICON_CATEGORIES = ["location", "zone", "system"];

const entry = (name, sf, mdi, path, suggested, category = "location") => ({
  id: `system:${sf}`,
  name,
  sf,
  mdi,
  path,
  suggested,
  category,
});

/** Registration order matters: the first entry claiming an exact room name wins. */
export const ROOM_ICONS = [
  entry("Attic", "arrow.up.to.line", "mdi:home-roof", mdiHomeRoof, ["attic", "loft"]),
  entry("Balcony", "building.2.fill", "mdi:balcony", mdiBalcony, ["balcony", "deck"]),
  entry("Bathroom", "shower.fill", "mdi:shower", mdiShower, ["bathroom", "bath", "washroom", "restroom"]),
  entry("Bedroom", "bed.double.fill", "mdi:bed-double", mdiBedDouble, ["bedroom", "bedrooms", "bed room", "bed rooms", "sleeping room", "sleeping rooms"]),
  entry("Carport", "car.fill", "mdi:car", mdiCar, ["carport"]),
  entry("Closet", "tshirt.fill", "mdi:tshirt-crew", mdiTshirtCrew, ["closet", "wardrobe"]),
  entry("Computer", "desktopcomputer", "mdi:desktop-tower-monitor", mdiDesktopTowerMonitor, ["computer", "computer room"]),
  entry("Dining Room", "fork.knife.circle.fill", "mdi:silverware-fork-knife", mdiSilverwareForkKnife, ["dining", "dining room", "dining area", "dinning", "dinning room", "dinner room", "dinner area"]),
  entry("Driveway", "car.fill", "mdi:car", mdiCar, ["driveway", "sideway", "side driveway", "side drive", "side drive way", "drive way", "road", "access road", "accessway"]),
  entry("Front Door", "door.left.hand.open", "mdi:door-open", mdiDoorOpen, ["front door", "entry", "entryway", "foyer"]),
  entry("Garage", "car.fill", "mdi:garage", mdiGarage, ["garage"]),
  entry("Guest Room", "bed.double.fill", "mdi:bed", mdiBed, ["guest room", "guestroom", "guest bedroom"]),
  entry("Gym", "dumbbell.fill", "mdi:dumbbell", mdiDumbbell, ["gym", "fitness", "workout"]),
  entry("Hallway", "figure.walk", "mdi:walk", mdiWalk, ["hallway", "hall", "corridor"]),
  entry("Kids Bedroom", "bed.double.fill", "mdi:bed", mdiBed, [
    "kids bedroom", "kidsbedroom", "kid's bedroom", "kids' bedroom", "children's bedroom", "childrens bedroom",
    "children bedroom", "child's bedroom", "child bedroom", "kids light", "kids' light", "kid's light",
    "children's light", "children light", "nursery", "baby room",
  ]),
  entry("Girl's Bedroom", "bed.double.fill", "mdi:bed", mdiBed, [
    "girl's bedroom", "girls bedroom", "girls' bedroom", "girl bedroom", "daughter's bedroom", "daughters bedroom",
    "daughter bedroom", "girls room", "girl's room",
  ]),
  entry("Boy's Bedroom", "bed.double.fill", "mdi:bed", mdiBed, [
    "boy's bedroom", "boys bedroom", "boys' bedroom", "boy bedroom", "son's bedroom", "sons bedroom",
    "son bedroom", "boys room", "boy's room",
  ]),
  entry("Kitchen", "fork.knife.circle.fill", "mdi:silverware-fork-knife", mdiSilverwareForkKnife, ["kitchen", "kitchen pantry", "pantry kitchen", "main kitchen", "cooking area"]),
  entry("Laundry Room", "washer.fill", "mdi:washing-machine", mdiWashingMachine, ["laundry", "laundry room", "laundryroom", "utility"]),
  entry("Living Room", "sofa.fill", "mdi:sofa", mdiSofa, ["living room", "living", "living_room", "lounge", "lounge room", "family room"]),
  entry("Lounge", "sofa.fill", "mdi:sofa", mdiSofa, ["lounge", "lounge room", "sitting room", "sitting"]),
  entry("Man Cave", "gamecontroller.fill", "mdi:gamepad-variant", mdiGamepadVariant, ["man cave", "mancave", "den", "study"]),
  entry("Nursery", "bed.double.fill", "mdi:bed", mdiBed, ["nursery", "baby room"]),
  entry("Office", "desktopcomputer", "mdi:desktop-tower-monitor", mdiDesktopTowerMonitor, ["office", "study", "workspace", "home office", "work office"]),
  entry("Other", "square.grid.3x3.fill", "mdi:view-grid", mdiViewGrid, ["other", "misc", "miscellaneous"]),
  entry("Outdoor", "umbrella.fill", "mdi:umbrella", mdiUmbrella, ["outdoor", "outdoors", "patio", "terrace", "backyard", "back yard", "frontyard", "front yard", "yard"]),
  entry("Outdoor Social", "umbrella.fill", "mdi:umbrella", mdiUmbrella, ["outdoor social", "patio", "deck", "outdoor entertainment"]),
  entry("BBQ", "flame.fill", "mdi:grill", mdiGrill, ["bbq", "barbeque", "barbecue", "grill", "grilling area", "outdoor kitchen"]),
  entry("Pool", "drop.fill", "mdi:pool", mdiPool, ["pool", "swimming pool"]),
  entry("Porch", "umbrella.fill", "mdi:umbrella", mdiUmbrella, ["porch", "veranda"]),
  entry("Recreation", "gamecontroller.fill", "mdi:gamepad-variant", mdiGamepadVariant, ["recreation", "rec room", "game room", "playroom"]),
  entry("Rumpus Room", "4k.tv", "mdi:television", mdiTelevision, ["rumpus room", "rumpus", "rumpusroom", "family room", "den"]),
  entry("Staircase", "stairs", "mdi:stairs", mdiStairs, ["staircase", "stairs", "stairway", "stairwell", "stair well"]),
  entry("Storage", "archivebox.fill", "mdi:archive", mdiArchive, ["storage", "storeroom", "pantry"]),
  entry("Studio", "wrench.and.screwdriver.fill", "mdi:tools", mdiTools, ["studio", "workshop"]),
  entry("Terrace", "umbrella.fill", "mdi:umbrella", mdiUmbrella, ["terrace", "balcony", "deck"]),
  entry("Toilet", "toilet.fill", "mdi:toilet", mdiToilet, ["toilet", "toilet upstairs", "toilet downstairs", "toilet up", "toilet down", "upstairs toilet", "downstairs toilet", "powder room", "half bath"]),
  entry("TV Room", "tv.fill", "mdi:television", mdiTelevision, ["tv", "tv room", "media room", "theater"]),
  entry("Basement", "arrow.down.to.line", "mdi:home-floor-negative-1", mdiHomeFloorNegative1, ["basement", "cellar", "lower level", "lower floor"]),
  entry("Library", "book.fill", "mdi:bookshelf", mdiBookshelf, ["library", "reading room", "book room", "study room"]),
  entry("Sunroom", "sun.max.fill", "mdi:white-balance-sunny", mdiWhiteBalanceSunny, ["sunroom", "conservatory", "solarium", "garden room", "sun room"]),
  entry("Mudroom", "shoe.fill", "mdi:shoe-sneaker", mdiShoeSneaker, ["mudroom", "mud room", "boot room", "entry room"]),
  entry("Pantry", "archivebox.fill", "mdi:archive", mdiArchive, ["pantry", "kitchen pantry", "pantry kitchen", "larder", "food storage", "butler's pantry", "butlers pantry"]),
  entry("Walk-in Closet", "tshirt.fill", "mdi:tshirt-crew", mdiTshirtCrew, ["walk-in closet", "walk in closet", "walkin closet", "wib", "wic", "dressing room", "dressing", "walk-in wardrobe"]),
  entry("Walk-in Bathroom", "shower.fill", "mdi:shower", mdiShower, ["walk-in bathroom", "walk in bathroom", "walkin bathroom", "wib bathroom", "wib", "walk-in bath"]),
  entry("Walk-in Butler's Pantry", "archivebox.fill", "mdi:archive", mdiArchive, [
    "walk-in butler's pantry", "walk in butlers pantry", "walkin butler pantry", "wib pantry", "butler's pantry",
    "butlers pantry", "butler pantry", "serving pantry", "prep pantry",
  ]),
  entry("Master Bedroom", "bed.double.fill", "mdi:bed-king", mdiBedKing, ["master bedroom", "main bedroom", "primary bedroom", "master bed"]),
  entry("Master Bathroom", "shower.fill", "mdi:shower", mdiShower, ["master bathroom", "ensuite", "en suite", "primary bathroom", "master bath"]),
  entry("Guest Bathroom", "shower.fill", "mdi:shower", mdiShower, ["guest bathroom", "guest bath", "visitor bathroom"]),
  entry("Home Theater", "tv.fill", "mdi:theater", mdiTheater, ["home theater", "home theatre", "cinema", "movie room", "theater room"]),
  entry("Bar", "wineglass.fill", "mdi:glass-wine", mdiGlassWine, ["bar", "bar area", "home bar", "cocktail room", "bar room"]),
  entry("Sauna", "drop.fill", "mdi:water", mdiWater, ["sauna", "steam room", "steam"]),
  entry("Wine Cellar", "wineglass.fill", "mdi:glass-wine", mdiGlassWine, ["wine cellar", "wine room", "wine storage", "cellar"]),
  entry("Breakfast Nook", "fork.knife.circle.fill", "mdi:silverware-fork-knife", mdiSilverwareForkKnife, ["breakfast nook", "breakfast area", "nook", "breakfast room"]),
  entry("Utility Room", "wrench.and.screwdriver.fill", "mdi:tools", mdiTools, ["utility room", "utility", "boiler room", "mechanical room"]),
  entry("Workshop", "wrench.and.screwdriver.fill", "mdi:tools", mdiTools, ["workshop", "work shop", "tool room", "diy room"]),
  entry("Music Room", "music.note", "mdi:music-note", mdiMusicNote, ["music room", "piano room", "recording studio", "music studio"]),
  entry("Hobby Room", "paintbrush.fill", "mdi:brush", mdiBrush, ["hobby room", "craft room", "sewing room", "hobby"]),
  entry("Greenhouse", "leaf.fill", "mdi:leaf", mdiLeaf, ["greenhouse", "garden room", "plant room"]),
  entry("Shed", "house.fill", "mdi:home-variant", mdiHomeVariant, ["shed", "garden shed", "tool shed", "storage shed", "garage", "barn", "barn shed"]),
  entry("Rooftop", "building.2.fill", "mdi:home-roof", mdiHomeRoof, ["rooftop", "roof terrace", "rooftop terrace", "roof"]),
  entry("Courtyard", "building.2.fill", "mdi:office-building", mdiOfficeBuilding, ["courtyard", "inner courtyard", "atrium"]),
  entry("Great Room", "sofa.fill", "mdi:sofa", mdiSofa, ["great room", "greatroom", "open plan"]),
  entry("Scullery", "fork.knife.circle.fill", "mdi:silverware-fork-knife", mdiSilverwareForkKnife, ["scullery", "scullery kitchen", "back kitchen", "wash kitchen", "prep kitchen", "secondary kitchen"]),
  entry("Larder", "archivebox.fill", "mdi:archive", mdiArchive, ["larder", "cold larder", "pantry larder", "food larder"]),
  entry("Atrium", "building.2.fill", "mdi:office-building", mdiOfficeBuilding, ["atrium", "atrium room", "central atrium", "courtyard atrium"]),
  entry("Vestibule", "door.left.hand.open", "mdi:door-open", mdiDoorOpen, ["vestibule", "entry vestibule", "entrance vestibule", "entry hall"]),
  entry("Spandrel", "square.fill", "mdi:square", mdiSquare, ["spandrel", "spandrel space", "spandrel room", "arch spandrel"]),
  entry("Foyer", "door.left.hand.open", "mdi:door-open", mdiDoorOpen, ["foyer", "entrance foyer", "entry foyer", "grand foyer"]),
  entry("Anteroom", "figure.walk", "mdi:walk", mdiWalk, ["anteroom", "ante room", "ante-chamber", "antechamber", "waiting room"]),
  entry("Loggia", "building.2.fill", "mdi:office-building", mdiOfficeBuilding, ["loggia", "covered balcony", "covered terrace", "arcade"]),
  entry("Rotunda", "circle.fill", "mdi:circle", mdiCircle, ["rotunda", "circular room", "round room", "dome room"]),
  entry("Ballroom", "music.note", "mdi:music-note", mdiMusicNote, ["ballroom", "dance hall", "event room", "banquet hall"]),
  entry("Billiard Room", "gamecontroller.fill", "mdi:billiards", mdiBilliards, ["billiard room", "billiards", "pool room", "snooker room"]),
  entry("Break Room", "fork.knife.circle.fill", "mdi:silverware-fork-knife", mdiSilverwareForkKnife, ["break room", "breakroom", "lunch room", "staff room", "employee lounge"]),
  entry("Cloakroom", "tshirt.fill", "mdi:tshirt-crew", mdiTshirtCrew, ["cloakroom", "coat room", "coatroom", "hat room", "vestibule"]),
  entry("Common Room", "person.3.fill", "mdi:account-group", mdiAccountGroup, ["common room", "commonroom", "shared room", "communal room"]),
  entry("Drawing Room", "sofa.fill", "mdi:sofa", mdiSofa, ["drawing room", "drawingroom", "sitting room", "parlour", "parlor"]),
  entry("Dressing Room", "tshirt.fill", "mdi:tshirt-crew", mdiTshirtCrew, ["dressing room", "dressingroom", "changing room", "changingroom"]),
  entry("Great Hall", "building.2.fill", "mdi:office-building", mdiOfficeBuilding, ["great hall", "greathall", "grand hall", "banquet hall", "feast hall"]),
  entry("Lobby", "door.left.hand.open", "mdi:door-open", mdiDoorOpen, ["lobby", "reception", "reception area", "waiting room"]),
  entry("Parlour", "sofa.fill", "mdi:sofa", mdiSofa, ["parlour", "parlor", "parlour room", "sitting room", "reception room"]),
  entry("Root Cellar", "arrow.down.to.line", "mdi:home-floor-negative-1", mdiHomeFloorNegative1, ["root cellar", "rootcellar", "food cellar", "vegetable cellar", "cold cellar"]),
  entry("Safe Room", "lock.shield.fill", "mdi:shield-lock", mdiShieldLock, ["safe room", "saferoom", "panic room", "security room", "bunker"]),
  entry("Servants' Quarters", "person.2.fill", "mdi:account-multiple", mdiAccountMultiple, ["servants quarters", "servants' quarters", "staff quarters", "servants room", "staff room"]),
  entry("Tasting Room", "wineglass.fill", "mdi:glass-wine", mdiGlassWine, ["tasting room", "tastingroom", "wine tasting", "whiskey tasting", "tasting"]),
  entry("Throne Room", "star.fill", "mdi:star", mdiStar, ["throne room", "throneroom", "reception room", "formal reception"]),
  entry("Undercroft", "arrow.down.to.line", "mdi:home-floor-negative-1", mdiHomeFloorNegative1, ["undercroft", "vaulted basement", "crypt", "underground vault"]),
  entry("Waiting Room", "figure.walk", "mdi:walk", mdiWalk, ["waiting room", "waitingroom", "waiting area", "holding room"]),
  entry("Wiring Closet", "antenna.radiowaves.left.and.right", "mdi:access-point-network", mdiAccessPointNetwork, ["wiring closet", "wiringcloset", "network closet", "server closet", "telecom room", "data closet"]),
  entry("Washitsu", "house.fill", "mdi:home", mdiHome, ["washitsu", "tatami room", "japanese room", "tatami", "japanese style room"]),
  entry("Tabagie", "flame.fill", "mdi:fire", mdiFire, ["tabagie", "smoking room", "smokingroom", "cigar room", "cigar lounge"]),
  entry("Transmission Control Room", "tv.fill", "mdi:television", mdiTelevision, ["transmission control room", "control room", "broadcast room", "tv control room", "production room"]),

  entry("First Floor", "1.square.fill", "mdi:numeric-1-box", mdiNumeric1Box, ["first floor", "firstfloor", "ground floor"], "zone"),
  entry("Ground Floor", "0.square.fill", "mdi:numeric-0-box", mdiNumeric0Box, ["ground floor", "groundfloor", "main floor"], "zone"),
  entry("Second Floor", "2.square.fill", "mdi:numeric-2-box", mdiNumeric2Box, ["second floor", "secondfloor", "upstairs"], "zone"),

  entry("Scenes", "movieclapper", "mdi:movie-open", mdiMovieOpen, ["scenes", "custom scenes"], "system"),
  entry("Blinds", "blinds.vertical.open", "mdi:blinds-open", mdiBlindsOpen, ["blinds", "window coverings", "shades", "curtains"], "system"),
  entry("Window", "window.vertical.closed", "mdi:window-closed-variant", mdiWindowClosedVariant, ["window", "windows", "bay window", "bay windows", "window seat", "window area", "window nook"]),
  entry("Sensors", "thermometer", "mdi:thermometer", mdiThermometer, ["sensors", "sensor room"], "system"),
  entry("ZigBee2MQTT", "antenna.radiowaves.left.and.right", "mdi:zigbee", mdiZigbee, ["zigbee2mqtt", "zigbee 2 mqtt", "z2m", "mqtt bridge", "mqtt-z2m"], "system"),
  entry("MQTT", "antenna.radiowaves.left.and.right", "mdi:access-point-network", mdiAccessPointNetwork, ["mqtt", "mqtt bridge", "mqtt room"], "system"),
  entry("Conbee", "antenna.radiowaves.left.and.right", "mdi:zigbee", mdiZigbee, ["conbee", "conbee bridge", "deconz", "phoscon"], "system"),
  entry("HomeKit", "homepod", "mdi:home-automation", mdiHomeAutomation, ["home", "homekit", "home kit", "home hub", "apple home"], "system"),
  entry("Matter Hub", "circle.hexagongrid.fill", "mdi:hexagon-multiple", mdiHexagonMultiple, ["matter", "matter hub", "matter bridge", "matter room"], "system"),
  entry("Chandelier", "chandelier", "mdi:chandelier", mdiChandelier, ["chandelier", "chandeliers", "dining room chandeliers", "dinning room chandeliers", "lounge room chandeliers", "living room chandeliers", "downstairs chandeliers", "downstair chandeliers", "upstairs chandeliers"]),
  entry("All Outside", "tree", "mdi:tree", mdiTree, ["all outside", "all outdoors", "outside", "outdoors", "backyard", "back yard", "frontyard", "front yard", "yard"]),
  entry("All Rooms", "house.fill", "mdi:home", mdiHome, ["all rooms", "allrooms", "all rooms view", "home", "house"], "system"),
  entry("Doorbird", "video.doorbell", "mdi:doorbell-video", mdiDoorbellVideo, ["doorbird", "door bird", "video doorbell"], "system"),
  entry("Sonos", "speaker.wave.3.fill", "mdi:speaker", mdiSpeaker, ["sonos", "speakers", "audio", "sonos system"], "system"),
  entry("Ensuite", "shower", "mdi:shower", mdiShower, ["ensuite", "en suite", "master ensuite", "master en suite"]),
  entry("Family Room", "chair.lounge", "mdi:sofa-single", mdiSofaSingle, ["family room", "familyroom", "family"]),
  entry("Entrance", "house.lodge", "mdi:home-import-outline", mdiHomeImportOutline, ["entrance", "entry", "entryway"]),
  entry("Path", "figure.walk", "mdi:walk", mdiWalk, ["path", "front path", "pathway", "walkway", "front pathway"]),
];

export const DEFAULT_ROOM_ICON = ROOM_ICONS.find((e) => e.name === "All Rooms");
export const COVERINGS_ROOM_ICON = ROOM_ICONS.find((e) => e.name === "Blinds");

const normalize = (value) => String(value ?? "").toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();

const EXACT = new Map();
for (const e of ROOM_ICONS) {
  for (const s of e.suggested) {
    const key = normalize(s);
    if (!EXACT.has(key)) EXACT.set(key, e);
  }
}
const BY_MDI = new Map();
const BY_KEY = new Map();
for (const e of ROOM_ICONS) {
  for (const [map, key] of [[BY_MDI, e.mdi], [BY_KEY, e.id], [BY_KEY, normalize(e.name)]]) {
    if (!map.has(key)) map.set(key, e);
  }
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsWord = (haystack, needle) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`).test(haystack);

/**
 * Registry suggestion for a room name: exact suggestion match, then partial match
 * (name contains a suggestion, or a suggestion contains the name). Unlike ControlZ,
 * partial matches are whole-word so "Garden" does not match "den".
 */
export function suggestRoomIcon(roomName) {
  const name = normalize(roomName);
  if (!name) return null;
  if (EXACT.has(name)) return EXACT.get(name);
  for (const e of ROOM_ICONS) {
    for (const s of e.suggested) {
      const key = normalize(s);
      if (containsWord(name, key) || containsWord(key, name)) return e;
    }
  }
  return null;
}

/** Look up an icon reference: registry id (`system:sofa.fill`), registry name (`Living Room`) or `mdi:*`. */
export function lookupRoomIcon(ref) {
  if (!ref) return null;
  const raw = String(ref).trim();
  if (raw.startsWith("mdi:")) return BY_MDI.get(raw) || { id: raw, name: raw, mdi: raw, path: null, suggested: [], category: "custom" };
  return BY_KEY.get(raw) || BY_KEY.get(normalize(raw)) || null;
}

/**
 * Resolve the icon for a room. Returns `{ icon, source }` where `source` is
 * `config` | `map` | `area` | `suggested` | `coverings` | `default`.
 */
export function resolveRoomIcon({ name, areaId, override, mapped, areaIcon, iconSource = "controlz", coverOnly = false } = {}) {
  const fromConfig = lookupRoomIcon(override);
  if (fromConfig) return { icon: fromConfig, source: "config" };
  const fromMap = lookupRoomIcon(mapped);
  if (fromMap) return { icon: fromMap, source: "map" };
  const fromArea = lookupRoomIcon(areaIcon);
  if (fromArea && iconSource === "area") return { icon: fromArea, source: "area" };
  const suggested = suggestRoomIcon(name) || suggestRoomIcon(areaId);
  if (suggested) return { icon: suggested, source: "suggested" };
  if (fromArea) return { icon: fromArea, source: "area" };
  if (coverOnly) return { icon: COVERINGS_ROOM_ICON, source: "coverings" };
  return { icon: DEFAULT_ROOM_ICON, source: "default" };
}

/** Resolve for an HA area using the card / strategy options (`icon`, `room_icons`, `icon_source`). */
export function resolveAreaIcon(hass, areaId, config = {}, { coverOnly = false } = {}) {
  const area = hass?.areas?.[areaId];
  return resolveRoomIcon({
    name: area?.name,
    areaId,
    override: config.icon,
    mapped: config.room_icons?.[areaId],
    areaIcon: area?.icon,
    iconSource: config.icon_source,
    coverOnly,
  });
}

/**
 * Markup for an icon: bundled path when known, otherwise `<ha-icon>` (any mdi icon,
 * available inside Home Assistant), otherwise the House glyph.
 */
export function roomIconSvg(icon) {
  if (icon?.path) {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${icon.path}"/></svg>`;
  }
  if (icon?.mdi && customElements.get("ha-icon")) return `<ha-icon icon="${icon.mdi}"></ha-icon>`;
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${DEFAULT_ROOM_ICON.path}"/></svg>`;
}
