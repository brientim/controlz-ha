import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Home Assistant's card wrapper (hui-card) reads `element.hidden` to decide whether to show a card,
// and other built-in HTMLElement properties are read by the browser. A getter or field with one of
// these names on a card silently breaks it (v0.4.0 hid every page through a `get hidden()`).
const RESERVED = [
  "hidden", "title", "id", "style", "dir", "lang", "slot", "role", "inert", "draggable", "translate",
  "className", "dataset", "tabIndex", "isConnected", "children", "shadowRoot", "innerHTML", "textContent",
];

const files = ["src", "src/tiles"].flatMap((dir) =>
  readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => `${dir}/${f}`));

test("cards do not shadow built-in HTMLElement properties", () => {
  // Class getters / setters / methods / fields; `name="..."` is an HTML attribute in a template, not a member.
  const pattern = new RegExp(`^\\s*(?:get|set|static)?\\s*(${RESERVED.join("|")})\\s*(?:\\(|=(?![\"'=]))`, "m");
  for (const file of files) {
    const match = readFileSync(file, "utf8").match(pattern);
    assert.equal(match, null, `${file} defines "${match?.[1]}", which shadows HTMLElement.${match?.[1]}`);
  }
});
