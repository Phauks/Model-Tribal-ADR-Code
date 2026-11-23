// Cover geometry from book-sizes.yaml (Lulu, Book Creation Guide, and
// "Casewrap Books: The Basics").

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfiguration } from "../pipeline/configuration.mjs";
import { coverGeometry, hardcoverSpineWidth } from "../pipeline/cover.mjs";
import { luluTrimCode, podPackageIdentifier } from "../pipeline/build-editions.mjs";

const { sizes } = loadConfiguration();

test("a paperback cover is both covers plus the spine, with 0.125 in bleed all round", () => {
  const cover = coverGeometry(sizes, "us-trade", 444, "paperback");
  assert.equal(cover.spine.width, 1.06);
  assert.equal(cover.width, 2 * 6 + 1.06 + 0.25);
  assert.equal(cover.height, 9.25);
  assert.deepEqual(cover.front, { x: 7.185, y: 0.125, width: 6, height: 9 });
});

test("a hardcover cover adds the board overhang and a 0.75 in wrap", () => {
  const cover = coverGeometry(sizes, "us-trade", 300, "hardcover");
  assert.equal(cover.spine.width, 0.938);
  assert.equal(cover.height, 9 + 0.25 + 1.5);
  assert.equal(cover.width, Math.round((2 * (0.75 + 6.125) + 0.938) * 10000) / 10000);
  assert.equal(cover.front.x, Math.round((0.75 + 6.125 + 0.938) * 10000) / 10000);
});

test("the hardcover spine follows Lulu's table (Book Creation Guide, p. 15)", () => {
  const rows = sizes.cover.hardcover.spine_by_page_count;
  assert.equal(hardcoverSpineWidth(24, rows), 0.25);
  assert.equal(hardcoverSpineWidth(84, rows), 0.25);
  assert.equal(hardcoverSpineWidth(85, rows), 0.5);
  assert.equal(hardcoverSpineWidth(306, rows), 0.938);
  assert.equal(hardcoverSpineWidth(307, rows), 1);
  assert.equal(hardcoverSpineWidth(800, rows), 2.125);
  assert.throws(() => hardcoverSpineWidth(801, rows));
  assert.throws(() => coverGeometry(sizes, "us-trade", 20, "hardcover"));
});

test("text areas keep the safety margin on every size and binding", () => {
  for (const trim of Object.keys(sizes.trims)) {
    for (const binding of ["paperback", "hardcover"]) {
      for (const pages of [32, 99, 100, 400, 800]) {
        const cover = coverGeometry(sizes, trim, pages, binding);
        for (const [safe, area] of [[cover.safe_back, cover.back], [cover.safe_front, cover.front]]) {
          assert.ok(safe.width > 0 && safe.height > 0, `${trim} ${binding} ${pages}`);
          assert.ok(safe.x >= area.x + sizes.cover.safety_margin - 1e-9);
          assert.ok(safe.x + safe.width <= area.x + area.width - sizes.cover.safety_margin + 1e-9);
          assert.ok(safe.y >= area.y + sizes.cover.safety_margin - 1e-9);
        }
        assert.equal(cover.spine_text_allowed, pages >= sizes.spine.text_minimum_pages);
        assert.ok(Math.abs(cover.front.x + cover.front.width + cover.edge - cover.width) < 1e-6);
      }
    }
  }
});

test("Lulu product codes match the website's (site/src/lib/book-order.ts)", () => {
  assert.equal(luluTrimCode(sizes.trims["us-trade"]), "0600X0900");
  assert.equal(luluTrimCode(sizes.trims["pocket-book"]), "0425X0687");
  assert.equal(luluTrimCode(sizes.trims.a4), "0827X1169");
  assert.equal(podPackageIdentifier(sizes.trims["us-trade"], "paperback"), "0600X0900.BW.STD.PB.060UW444.MXX");
  assert.equal(podPackageIdentifier(sizes.trims["us-letter"], "hardcover"), "0850X1100.BW.STD.CW.060UW444.MXX");
});
