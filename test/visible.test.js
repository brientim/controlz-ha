import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleItems } from "../src/area-cache.js";
import { roomSummary } from "../src/model.js";
import { makeFixture } from "../dev/fixture.js";

test("hidden devices drop out of room tiles and room controls", () => {
  const hass = makeFixture();
  const config = { hide_entities: ["light.kitchen_bench_light", "switch.kitchen_kettle"] };
  const items = visibleItems(hass, "kitchen", config);
  assert.equal(items.some((i) => i.entity_id === "light.kitchen_bench_light"), false);
  const summary = roomSummary(hass, items);
  assert.equal(summary.lights.length, 2);
  assert.equal(summary.outletsOn, 0);
});
