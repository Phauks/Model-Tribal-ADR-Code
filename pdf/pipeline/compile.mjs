// Runs Typst. The inside margin depends on the page count (Lulu's gutter
// table), and the page count depends on the margins, so the layout is
// computed, the pages counted, and the layout recomputed until the gutter
// stops changing.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRINT_DIRECTORY } from "./configuration.mjs";
import { computeLayout, insideMarginForPageCount, safetyProblems } from "./geometry.mjs";

export const TYPST_VERSION = "0.15.1";
const FONT_DIRECTORY = path.join(PRINT_DIRECTORY, "fonts");

function typst(args) {
  const command = process.env.TYPST || "typst";
  const result = spawnSync(
    command,
    [...args, "--root", PRINT_DIRECTORY, "--font-path", FONT_DIRECTORY, "--ignore-system-fonts", "--ignore-embedded-fonts"],
    { encoding: "utf8" },
  );
  if (result.error) throw new Error(`Could not run Typst (${command}): ${result.error.message}. Install Typst ${TYPST_VERSION} or set TYPST.`);
  if (result.status !== 0) throw new Error(`Typst failed:\n${result.stderr}`);
  return result.stdout;
}

export function typstVersion() {
  const result = spawnSync(process.env.TYPST || "typst", ["--version"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function writeLayout(directory, layout) {
  fs.writeFileSync(path.join(directory, "layout.json"), JSON.stringify(layout, null, 2) + "\n");
}

function countPages(mainFile) {
  const output = typst(["query", mainFile, "<book-end>", "--field", "value", "--one"]);
  return Number(JSON.parse(output));
}

// Builds interior.pdf in directory (which holds main.typ). Returns the final layout.
export function compileInterior({ directory, sizes, trimKey, layoutExtras }) {
  const mainFile = path.join(directory, "main.typ");
  const rows = sizes.inside_margin_by_page_count;
  let pageCount = 1;
  let layout;
  const seen = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    layout = { ...computeLayout(sizes, trimKey, pageCount), ...layoutExtras };
    writeLayout(directory, layout);
    const counted = countPages(mainFile);
    seen.push(counted);
    if (insideMarginForPageCount(counted, rows) === insideMarginForPageCount(pageCount, rows)) {
      pageCount = counted;
      break;
    }
    // A book on the edge of two gutter rows can flip between them; settle on
    // the wider gutter, which is always within Lulu's recommendation.
    pageCount = attempt >= 3 ? Math.max(...seen) : counted;
  }
  layout = { ...computeLayout(sizes, trimKey, pageCount), ...layoutExtras };
  const problems = safetyProblems(layout);
  if (problems.length) throw new Error(`Layout breaks Lulu's safety margin: ${problems.join("; ")}`);
  writeLayout(directory, layout);
  typst(["compile", mainFile, path.join(directory, "interior.pdf")]);
  layout.page_count = countPages(mainFile);
  writeLayout(directory, layout);
  return layout;
}
