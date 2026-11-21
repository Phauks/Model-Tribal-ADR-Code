#!/usr/bin/env node
// Builds the Lulu print interior.
//
//   node pipeline/build.mjs              the book, from content/
//   node pipeline/build.mjs --specimen   a typesetting specimen: the test
//                                        chapter in tests/fixtures/specimen
//                                        plus everything in content/
//   --trim <size>      build at another size without editing book.yaml
//   --no-check         skip the PDF checks in tools/check_interior.py
//
// Output goes to pdf/output/<name>/: interior.pdf, report.json, and the
// generated main.typ and layout.json.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { assembleBook } from "./book.mjs";
import { compileInterior, TYPST_VERSION, typstVersion } from "./compile.mjs";
import { loadConfiguration, PRINT_DIRECTORY, REPOSITORY_DIRECTORY, trackVersion } from "./configuration.mjs";
import { loadContent } from "./content.mjs";
import { printReport } from "./geometry.mjs";

export const SPECIMEN_DIRECTORY = path.join(PRINT_DIRECTORY, "tests/fixtures/specimen");

function mergeContent(first, second) {
  const merged = {
    sources: [...first.sources, ...second.sources],
    glossary: [...first.glossary, ...second.glossary],
    variables: { ...first.variables, ...second.variables },
    provisions: [...first.provisions, ...second.provisions],
    commentary: new Map([...first.commentary, ...second.commentary]),
    essays: [...first.essays, ...second.essays],
  };
  for (const [kind, key] of [["sources", "key"], ["glossary", "id"]]) {
    const keys = merged[kind].map((record) => record[key]);
    const duplicate = keys.find((value, index) => keys.indexOf(value) !== index);
    if (duplicate) throw new Error(`Specimen ${kind} record "${duplicate}" duplicates one in content/`);
  }
  return merged;
}

export function build({ specimen = false, trim, name, check = true } = {}) {
  const started = performance.now();
  const { book, sizes } = loadConfiguration({
    trim,
    overridesFile: specimen ? path.join(SPECIMEN_DIRECTORY, "book-overrides.yaml") : undefined,
  });
  let content = loadContent(path.join(REPOSITORY_DIRECTORY, "content"));
  if (specimen) content = mergeContent(content, loadContent(path.join(SPECIMEN_DIRECTORY, "content")));

  const outputName = name || (specimen ? `specimen-${book.trim}` : `book-${book.trim}`);
  const directory = path.join(PRINT_DIRECTORY, "output", outputName);
  fs.mkdirSync(directory, { recursive: true });

  const { body, warnings } = assembleBook({ book, content });
  fs.writeFileSync(path.join(directory, "main.typ"), body);

  const metadata = {
    ...book.metadata,
    full_title: [book.metadata.title, book.metadata.subtitle].filter(Boolean).join(": "),
    isbn_text: book.metadata.isbn || "[to be assigned]",
    print_version: trackVersion("pdf"),
    content_version: trackVersion("content"),
    keywords: ["dispute resolution", "Native nations", "model code"],
  };
  const layoutExtras = { metadata, inside_margin_rows: sizes.inside_margin_by_page_count };
  const layout = compileInterior({ directory, sizes, trimKey: book.trim, layoutExtras });
  const report = printReport(sizes, book, layout);
  report.warnings.unshift(...warnings);
  const version = typstVersion();
  if (!version || !version.includes(TYPST_VERSION)) {
    report.warnings.push(`Built with ${version || "an unknown Typst"}; the build is tested with Typst ${TYPST_VERSION}.`);
  }
  report.build_seconds = Math.round(performance.now() - started) / 1000;

  if (check) {
    const result = spawnSync(
      "python3",
      ["-I", path.join(PRINT_DIRECTORY, "tools/check_interior.py"), path.join(directory, "interior.pdf"), path.join(directory, "layout.json")],
      { encoding: "utf8" },
    );
    if (result.error) throw new Error(`Could not run the PDF checks: ${result.error.message}`);
    report.checks = result.stdout ? JSON.parse(result.stdout) : null;
    if (result.status !== 0) {
      fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
      throw new Error(`PDF checks failed for ${outputName}:\n${result.stderr || result.stdout}`);
    }
  }
  fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
  return { directory, report };
}

function main() {
  const { values } = parseArgs({
    options: {
      specimen: { type: "boolean", default: false },
      trim: { type: "string" },
      "no-check": { type: "boolean", default: false },
    },
  });
  const { directory, report } = build({ specimen: values.specimen, trim: values.trim, check: !values["no-check"] });
  const relative = path.relative(process.cwd(), directory);
  console.log(`${relative}/interior.pdf`);
  console.log(
    `  ${report.trim.name} (${report.trim.width} x ${report.trim.height} in), ${report.page_count} pages, ` +
      `inside margin ${report.margins_from_trim_inches.inside} in, spine about ${report.spine_width_inches} in, ${report.build_seconds} s`,
  );
  for (const warning of report.warnings) console.log(`  warning: ${warning}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
