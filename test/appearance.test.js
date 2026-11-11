import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
});
globalThis.window ??= new EventTarget();

const { ACCENTS, accentId, applyAppearance, cornersId } = await import("../src/appearance.js");
const { writePrefs } = await import("../src/prefs.js");

const fakeRoot = () => {
  const props = new Map();
  return { props, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
};

test("collapsed scene rows toggle per device", async () => {
  const { collapsedSections, isCollapsed, toggleCollapsed } = await import("../src/prefs.js");
  assert.equal(isCollapsed("scenes:office"), false);
  toggleCollapsed("scenes:office");
  toggleCollapsed("scenes:__home");
  assert.deepEqual(collapsedSections(), ["scenes:__home", "scenes:office"]);
  toggleCollapsed("scenes:office");
  toggleCollapsed("scenes:__home");
  assert.deepEqual(collapsedSections(), []);
});

test("room tile size: this device's choice, then the dashboard's for the room, then the usual size", async () => {
  const { deviceRoomSizes, effectiveRoomSize, setDeviceRoomSize } = await import("../src/prefs.js");
  assert.equal(effectiveRoomSize("large", "garage", {}), "large");
  assert.equal(effectiveRoomSize("large", "garage", { garage: "compact" }), "compact");
  writePrefs({ tile_size: "thin" });
  assert.equal(effectiveRoomSize("large", "office", {}), "thin");
  assert.equal(effectiveRoomSize("large", "garage", { garage: "compact" }), "compact");
  setDeviceRoomSize("garage", "large");
  assert.equal(effectiveRoomSize("large", "garage", { garage: "compact" }), "large");
  assert.equal(effectiveRoomSize("large", "garage", { garage: "nonsense" }), "large");
  setDeviceRoomSize("garage", null);
  assert.deepEqual(deviceRoomSizes(), {});
  assert.equal(effectiveRoomSize("large", "garage", { garage: "huge" }), "thin");
  writePrefs({ tile_size: null, room_sizes: { a: "tiny", b: "compact" } });
  assert.deepEqual(deviceRoomSizes(), { b: "compact" });
  writePrefs({ room_sizes: null });
});

test("accent and corners default to ControlZ and set nothing", () => {
  const root = fakeRoot();
  applyAppearance(root);
  assert.equal(accentId(), "controlz");
  assert.equal(cornersId(), "round");
  assert.equal(root.props.size, 0);
});

test("a chosen accent and square corners become CSS variables; unknown values fall back", () => {
  writePrefs({ accent: "teal", corners: "square" });
  const root = fakeRoot();
  applyAppearance(root);
  assert.equal(root.props.get("--cz-accent"), ACCENTS.find((a) => a.id === "teal").value);
  assert.equal(root.props.get("--cz-corner"), "6px");
  writePrefs({ accent: "ha" });
  applyAppearance(root);
  assert.match(root.props.get("--cz-accent"), /--primary-color/);
  writePrefs({ accent: "neon", corners: null });
  applyAppearance(root);
  assert.equal(accentId(), "controlz");
  assert.equal(root.props.size, 0);
});
