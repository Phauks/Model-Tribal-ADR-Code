#!/usr/bin/env node
// Builds and checks the specimen at every size in book-sizes.yaml, to show
// that any size can be chosen in book.yaml. Writes a summary table to
// pdf/output/every-size/summary.md.

import fs from "node:fs";
import path from "node:path";
import { build } from "./build.mjs";
import { loadConfiguration, PRINT_DIRECTORY } from "./configuration.mjs";

const { sizes } = loadConfiguration();
const rows = [];
let failed = 0;
for (const trim of Object.keys(sizes.trims)) {
  try {
    const { report } = build({ specimen: true, trim, name: path.join("every-size", trim) });
    rows.push([
      `${report.trim.name} (${report.trim.width} x ${report.trim.height})`,
      report.page_count,
      `${report.body_size_points} pt`,
      `${report.margins_from_trim_inches.inside} / ${report.margins_from_trim_inches.outside}`,
      `${report.text_block_inches.width} x ${report.text_block_inches.height}`,
      `about ${report.characters_per_line}`,
      report.checks.closest_text_to_trim_inches,
      "passed",
    ]);
  } catch (error) {
    failed += 1;
    rows.push([trim, "", "", "", "", "", "", `FAILED: ${error.message.split("\n")[0]}`]);
  }
}

const header = [
  "Size (in)",
  "Pages",
  "Body",
  "Inside / outside margin (in)",
  "Text block (in)",
  "Characters per line",
  "Closest text to trim (in)",
  "Lulu checks",
];
const table = [header, header.map(() => "---"), ...rows].map((row) => `| ${row.join(" | ")} |`).join("\n");
const directory = path.join(PRINT_DIRECTORY, "output", "every-size");
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(
  path.join(directory, "summary.md"),
  `# Specimen at every size\n\nCharacters per line are estimated at 0.44 em per character (book-sizes.yaml).\n\n${table}\n`,
);
console.log(table);
if (failed) {
  console.error(`${failed} size(s) failed`);
  process.exit(1);
}
