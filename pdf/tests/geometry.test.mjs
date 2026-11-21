// Page geometry from book-sizes.yaml (Lulu's Book Creation Guide rules).

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadConfiguration, PRINT_DIRECTORY } from "../pipeline/configuration.mjs";
import { computeLayout, insideMarginForPageCount, printReport, safetyProblems, spineWidth } from "../pipeline/geometry.mjs";

const { book, sizes } = loadConfiguration();

test("the inside margin follows Lulu's gutter table (Book Creation Guide, p. 9)", () => {
  const rows = sizes.inside_margin_by_page_count;
  assert.equal(insideMarginForPageCount(32, rows), 0.5);
  assert.equal(insideMarginForPageCount(60, rows), 0.5);
  assert.equal(insideMarginForPageCount(61, rows), 0.625);
  assert.equal(insideMarginForPageCount(150, rows), 0.625);
  assert.equal(insideMarginForPageCount(151, rows), 1.0);
  assert.equal(insideMarginForPageCount(400, rows), 1.0);
  assert.equal(insideMarginForPageCount(401, rows), 1.125);
  assert.equal(insideMarginForPageCount(600, rows), 1.125);
  assert.equal(insideMarginForPageCount(601, rows), 1.25);
  assert.equal(insideMarginForPageCount(800, rows), 1.25);
});

test("spine width is pages / 444 + 0.06 in (Book Creation Guide, p. 13)", () => {
  assert.equal(spineWidth(444, sizes.spine), 1.06);
  assert.equal(spineWidth(250, sizes.spine), 0.6231);
  assert.equal(spineWidth(32, sizes.spine), 0.1321);
});

test("every size keeps text inside the safety margin at every page count", () => {
  for (const trim of Object.keys(sizes.trims)) {
    for (const pages of [32, 60, 61, 150, 151, 400, 401, 600, 601, 800]) {
      const layout = computeLayout(sizes, trim, pages);
      assert.deepEqual(safetyProblems(layout), [], `${trim} at ${pages} pages`);
      const sideMinimum = sizes.safety_margin + sizes.overhang_allowance;
      assert.ok(layout.margins.inside >= insideMarginForPageCount(pages, sizes.inside_margin_by_page_count), trim);
      assert.ok(layout.margins.inside >= sideMinimum && layout.margins.outside >= sideMinimum, trim);
      const longestLine = (sizes.maximum_line_length_em * layout.type.body) / 72;
      assert.ok(layout.text.width <= longestLine + 1e-3, `${trim}: line of ${layout.text.width} in is too long`);
      if (layout.characters_per_line < sizes.minimum_line_characters) {
        const report = printReport(sizes, book, layout);
        assert.ok(report.warnings.some((warning) => warning.includes("characters")), `${trim} at ${pages} pages`);
      }
    }
  }
});

test("the PDF page is the trim plus 0.125 in bleed on every side (Book Creation Guide, p. 23)", () => {
  const layout = computeLayout(sizes, "us-trade", 200);
  assert.deepEqual(layout.page, { width: 6.25, height: 9.25 });
  for (const [key, trim] of Object.entries(sizes.trims)) {
    const { page } = computeLayout(sizes, key, 200);
    assert.equal(page.width, Math.round((trim.width + 0.25) * 10000) / 10000);
    assert.equal(page.height, Math.round((trim.height + 0.25) * 10000) / 10000);
  }
});

test("Lulu's eligible paperback sizes are all listed, and Comic Book is not", () => {
  const listed = Object.values(sizes.trims).map((trim) => `${trim.width} x ${trim.height}`);
  assert.deepEqual(listed, [
    "4.25 x 6.875", "5 x 8", "5.5 x 8.5", "5.83 x 8.27", "6 x 9", "6.14 x 9.21",
    "7 x 10", "7.44 x 9.68", "7.5 x 7.5", "8.27 x 11.69", "8.5 x 11", "8.5 x 8.5",
  ]);
});

test("changing the size is a one-line change to book.yaml", () => {
  const original = fs.readFileSync(path.join(PRINT_DIRECTORY, "book.yaml"), "utf8");
  const changed = original.replace(/^trim: us-trade$/m, "trim: executive");
  const changedLines = original.split("\n").filter((line, index) => line !== changed.split("\n")[index]);
  assert.equal(changedLines.length, 1);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "book-"));
  const bookFile = path.join(directory, "book.yaml");
  fs.writeFileSync(bookFile, changed);
  const configuration = loadConfiguration({ bookFile });
  const layout = computeLayout(configuration.sizes, configuration.book.trim, 300);
  assert.deepEqual(layout.page, { width: 7.25, height: 10.25 });
  assert.equal(layout.type.body, sizes.type_scales.large.body);
});

test("the report warns about page count, paper and ISBN", () => {
  const layout = computeLayout(sizes, "executive", 20);
  const report = printReport(sizes, { ...book, paper: "cream", metadata: { ...book.metadata, isbn: null } }, layout);
  assert.equal(report.spine_text_allowed, false);
  assert.ok(report.warnings.some((warning) => warning.includes("20 pages")));
  assert.ok(report.warnings.some((warning) => warning.includes("cream")));
  assert.ok(report.warnings.some((warning) => warning.includes("ISBN")));
  const long = printReport(sizes, { ...book, metadata: { ...book.metadata, isbn: "978-0-00-000000-0" } }, computeLayout(sizes, "us-trade", 300));
  assert.equal(long.spine_text_allowed, true);
  assert.deepEqual(long.warnings, []);
});

test("an unknown size and an override of the size are refused", () => {
  assert.throws(() => loadConfiguration({ trim: "tabloid" }), /not in book-sizes.yaml/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "overrides-"));
  const overrides = path.join(directory, "overrides.yaml");
  fs.writeFileSync(overrides, "trim: a4\n");
  assert.throws(() => loadConfiguration({ overridesFile: overrides }), /trim is set only in book.yaml/);
});
