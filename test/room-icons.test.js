import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../dev/fixture.js";
import {
  DEFAULT_ROOM_ICON,
  ROOM_ICONS,
  lookupRoomIcon,
  resolveAreaIcon,
  resolveRoomIcon,
  suggestRoomIcon,
} from "../src/room-icons.js";

const camel = (name) => `mdi${name.replace(/^mdi:/, "").split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("")}`;

test("every registry entry has a bundled path and a well-formed mdi name", () => {
  for (const e of ROOM_ICONS) {
    assert.match(e.mdi, /^mdi:[a-z0-9-]+$/, e.name);
    assert.ok(e.path && e.path.startsWith("M"), `${e.name} has no path`);
    assert.ok(e.suggested.length > 0, `${e.name} has no suggestions`);
  }
});

test("bundled paths match the mdi names they claim", async () => {
  const mdi = await import("@mdi/js");
  for (const e of ROOM_ICONS) assert.equal(mdi[camel(e.mdi)], e.path, `${e.name} (${e.mdi})`);
});

test("exact suggestions follow ControlZ registration order (first entry wins)", () => {
  assert.equal(suggestRoomIcon("Living Room").name, "Living Room");
  assert.equal(suggestRoomIcon("Lounge").name, "Living Room");
  assert.equal(suggestRoomIcon("Office").name, "Office");
  assert.equal(suggestRoomIcon("Kitchen").name, "Kitchen");
  assert.equal(suggestRoomIcon("Garage").name, "Garage");
  assert.equal(suggestRoomIcon("Entrance").name, "Entrance");
  assert.equal(suggestRoomIcon("Ensuite").name, "Master Bathroom");
  assert.equal(suggestRoomIcon("Rumpus").name, "Rumpus Room");
  assert.equal(suggestRoomIcon("Powder Room").name, "Toilet");
});

test("partial matches cover numbered and qualified room names", () => {
  assert.equal(suggestRoomIcon("Bedroom 1").name, "Bedroom");
  assert.equal(suggestRoomIcon("Upstairs Toilet").name, "Toilet");
  assert.equal(suggestRoomIcon("Front Yard Garden").mdi, "mdi:umbrella");
  assert.equal(suggestRoomIcon("living_room").name, "Living Room");
  assert.equal(suggestRoomIcon("A"), null);
  assert.equal(suggestRoomIcon("Zzqx"), null);
});

test("lookup accepts registry name, registry id and mdi", () => {
  assert.equal(lookupRoomIcon("Library").mdi, "mdi:bookshelf");
  assert.equal(lookupRoomIcon("system:sofa.fill").name, "Living Room");
  assert.equal(lookupRoomIcon("mdi:pool").name, "Pool");
  const custom = lookupRoomIcon("mdi:desk");
  assert.equal(custom.mdi, "mdi:desk");
  assert.equal(custom.path, null);
});

test("resolution order: override, room_icons map, suggestion, HA area icon, default", () => {
  assert.equal(resolveRoomIcon({ name: "Office", override: "Library" }).source, "config");
  assert.equal(resolveRoomIcon({ name: "Office", mapped: "Gym" }).icon.name, "Gym");
  assert.equal(resolveRoomIcon({ name: "Office", areaIcon: "mdi:desk" }).source, "suggested");
  assert.equal(resolveRoomIcon({ name: "Office", areaIcon: "mdi:desk", iconSource: "area" }).source, "area");
  assert.equal(resolveRoomIcon({ name: "Zzqx", areaIcon: "mdi:desk" }).source, "area");
  assert.equal(resolveRoomIcon({ name: "Zzqx", coverOnly: true }).icon.name, "Blinds");
  assert.equal(resolveRoomIcon({ name: "Zzqx" }).icon, DEFAULT_ROOM_ICON);
});

test("fixture areas resolve to ControlZ icons", () => {
  const hass = makeFixture();
  const name = (id, config) => resolveAreaIcon(hass, id, config).icon.name;
  assert.equal(name("office"), "Office");
  assert.equal(name("kitchen"), "Kitchen");
  assert.equal(name("living_room"), "Living Room");
  assert.equal(name("bedroom_1"), "Bedroom");
  assert.equal(name("garage"), "Garage");
  assert.equal(name("entrance"), "Entrance");
  assert.equal(name("office", { room_icons: { office: "Library" } }), "Library");
});
