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
