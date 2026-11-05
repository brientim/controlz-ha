import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { HELP_SECTIONS, WHATS_NEW, helpLinks, helpRef, readmeUrl, screenshotUrl } from "../src/help-content.js";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
// GitHub heading anchors: lower case, punctuation dropped, each space a hyphen.
const anchors = new Set(readFileSync("README.md", "utf8").split("\n")
  .filter((line) => /^#{1,6} /.test(line))
  .map((line) => line.replace(/^#+ /, "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-")));

test("every help section has text, a screenshot in dev/screenshots and a README anchor", () => {
  const ids = new Set();
  for (const s of HELP_SECTIONS) {
    assert.ok(s.title && s.text, s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
    assert.ok(existsSync(`dev/screenshots/${s.image}`), `missing dev/screenshots/${s.image}`);
    assert.ok(anchors.has(s.anchor), `README has no heading for #${s.anchor}`);
  }
});

test("what's new matches package.json (update src/help-content.js when bumping the version)", () => {
  assert.equal(WHATS_NEW.version, pkg.version);
  assert.ok(WHATS_NEW.items.length > 0);
});

test("links are pinned to the release tag, main for dev builds", () => {
  assert.equal(helpRef("0.6.0"), "v0.6.0");
  assert.equal(helpRef("dev"), "main");
  assert.equal(screenshotUrl("0.6.0", "a.png"), "https://raw.githubusercontent.com/brientim/controlz-ha/v0.6.0/dev/screenshots/a.png");
  assert.equal(readmeUrl("0.6.0", "automations"), "https://github.com/brientim/controlz-ha/blob/v0.6.0/README.md#automations");
  assert.ok(helpLinks("dev").every((l) => l.url.startsWith("https://github.com/brientim/controlz-ha")));
});
