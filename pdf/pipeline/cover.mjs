// The printed cover: one spread with the back cover, spine and front cover
// (Lulu, Book Creation Guide, p. 25). The geometry comes from
// book-sizes.yaml; typst/cover.typ draws the cover from it.
//
// Two bindings:
//   paperback   perfect bound. The spread is both covers plus the spine, with
//               0.125 in bleed on every side; the spine is pages / 444 + 0.06 in
//               (Book Creation Guide, pp. 10 and 13).
//   hardcover   casewrap. Each board overhangs the pages by 0.125 in at the
//               top, bottom and fore edge, and the artwork wraps 0.75 in
//               around every edge of the boards; the spine comes from Lulu's
//               table (Lulu, "Casewrap Books: The Basics"; Book Creation
//               Guide, p. 15). Linen wrap books use the same file.
//
// Lulu's cover-dimensions call gives the exact spread size for a product and
// page count; pipeline/build-editions.mjs compares it with these numbers
// when Lulu credentials are set.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRINT_DIRECTORY } from "./configuration.mjs";
import { spineWidth } from "./geometry.mjs";

const FONT_DIRECTORY = path.join(PRINT_DIRECTORY, "fonts");
const round = (value) => Math.round(value * 10000) / 10000;

export const BINDINGS = ["paperback", "hardcover"];

/** Hardcover spine width in inches from Lulu's table (Book Creation Guide, p. 15). */
export function hardcoverSpineWidth(pageCount, rows) {
  for (const row of rows) if (pageCount <= row.most_pages) return row.inches;
  throw new Error(`${pageCount} pages is more than Lulu's hardcover spine table covers`);
}

/**
 * Where everything goes on the cover spread, in inches from the top left.
 * `back` and `front` are the parts of each cover a reader sees; `safe_back`
 * and `safe_front` are the areas text stays inside.
 */
export function coverGeometry(sizes, trimKey, pageCount, binding) {
  const trim = sizes.trims[trimKey];
  if (!trim) throw new Error(`Unknown trim "${trimKey}"`);
  if (!BINDINGS.includes(binding)) throw new Error(`Unknown binding "${binding}"`);
  const rules = sizes.cover;
  let edge, overhang, spine, hinge;
  if (binding === "paperback") {
    edge = sizes.bleed;
    overhang = 0;
    hinge = 0;
    spine = spineWidth(pageCount, sizes.spine);
  } else {
    const hardcover = rules.hardcover;
    if (pageCount < hardcover.minimum_pages) throw new Error(`A hardcover needs at least ${hardcover.minimum_pages} pages`);
    edge = hardcover.wrap;
    overhang = hardcover.overhang;
    hinge = hardcover.hinge;
    spine = hardcoverSpineWidth(pageCount, hardcover.spine_by_page_count);
  }
  // One cover as the reader sees it: the trim (paperback) or the board.
  const panel = { width: round(trim.width + overhang), height: round(trim.height + 2 * overhang) };
  const width = round(2 * (edge + panel.width) + spine);
  const height = round(panel.height + 2 * edge);
  const back = { x: edge, y: edge, ...panel };
  const spineArea = { x: round(edge + panel.width), y: edge, width: spine, height: panel.height };
  const front = { x: round(edge + panel.width + spine), y: edge, ...panel };
  const safety = rules.safety_margin;
  // Text on each cover keeps the safety margin from every edge, and on the
  // spine side also clears the hinge.
  const spineSide = Math.max(safety, hinge + safety / 2);
  const inset = (area, leftInset, rightInset) => ({
    x: round(area.x + leftInset),
    y: round(area.y + safety),
    width: round(area.width - leftInset - rightInset),
    height: round(area.height - 2 * safety),
  });
  return {
    binding,
    trim: { key: trimKey, name: trim.name, width: trim.width, height: trim.height },
    page_count: pageCount,
    width,
    height,
    edge,
    back,
    spine: spineArea,
    front,
    safe_back: inset(back, safety, spineSide),
    safe_front: inset(front, spineSide, safety),
    safe_spine: inset(spineArea, rules.spine_safety, rules.spine_safety),
    spine_safety: rules.spine_safety,
    spine_text_allowed: pageCount >= sizes.spine.text_minimum_pages,
  };
}

function typst(args) {
  const command = process.env.TYPST || "typst";
  const result = spawnSync(
    command,
    [...args, "--root", PRINT_DIRECTORY, "--font-path", FONT_DIRECTORY, "--ignore-system-fonts", "--ignore-embedded-fonts"],
    { encoding: "utf8" },
  );
  if (result.error) throw new Error(`Could not run Typst (${command}): ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Typst failed:\n${result.stderr}`);
}

/** Writes cover.pdf and cover-layout.json in directory, then checks the PDF. */
export function buildCover({ directory, sizes, book, trimKey, pageCount, binding, check = true }) {
  fs.mkdirSync(directory, { recursive: true });
  const geometry = coverGeometry(sizes, trimKey, pageCount, binding);
  const layout = {
    ...geometry,
    text: {
      title: book.metadata.title,
      subtitle: book.metadata.subtitle,
      author: book.metadata.author,
      edition: book.metadata.edition,
      back_text: book.cover?.back_text ?? null,
      back_note: book.cover?.back_note ?? null,
    },
  };
  fs.writeFileSync(path.join(directory, "cover-layout.json"), JSON.stringify(layout, null, 2) + "\n");
  fs.writeFileSync(
    path.join(directory, "cover.typ"),
    ['// Generated by pdf/pipeline/cover.mjs. Do not edit.', '#import "/typst/cover.typ": cover', '#cover(json("cover-layout.json"))', ""].join("\n"),
  );
  typst(["compile", path.join(directory, "cover.typ"), path.join(directory, "cover.pdf")]);
  let checks = null;
  if (check) {
    const result = spawnSync(
      "python3",
      ["-I", path.join(PRINT_DIRECTORY, "tools/check_cover.py"), path.join(directory, "cover.pdf"), path.join(directory, "cover-layout.json")],
      { encoding: "utf8" },
    );
    if (result.error) throw new Error(`Could not run the cover checks: ${result.error.message}`);
    checks = result.stdout ? JSON.parse(result.stdout) : null;
    if (result.status !== 0) throw new Error(`Cover checks failed for ${directory}:\n${result.stderr || result.stdout}`);
  }
  return { layout, checks };
}
