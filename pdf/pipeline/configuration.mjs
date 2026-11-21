// Reads book.yaml (what to build) and book-sizes.yaml (the sizes and rules).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const PRINT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPOSITORY_DIRECTORY = path.resolve(PRINT_DIRECTORY, "..");

export function readYaml(file) {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}

const PAPERS = ["white", "cream"];

// Lulu: titles, subtitles and cover text in Latin characters only
// (Retail Distribution Guide, pp. 12 and 14).
const LATIN_TEXT = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;

function mergeOverrides(book, overrides) {
  const merged = { ...book, ...overrides };
  merged.metadata = { ...book.metadata, ...(overrides.metadata || {}) };
  merged.parts = { ...book.parts, ...(overrides.parts || {}) };
  merged.chapters = { ...(book.chapters || {}), ...(overrides.chapters || {}) };
  if ("trim" in overrides) throw new Error("Overrides may not set the trim: the trim is set only in book.yaml");
  return merged;
}

export function loadConfiguration({ trim, overridesFile, bookFile = path.join(PRINT_DIRECTORY, "book.yaml") } = {}) {
  let book = readYaml(bookFile);
  const sizes = readYaml(path.join(PRINT_DIRECTORY, "book-sizes.yaml"));
  if (overridesFile) book = mergeOverrides(book, readYaml(overridesFile));
  if (trim) book = { ...book, trim };

  const problems = [];
  if (!sizes.trims[book.trim]) {
    problems.push(`book.yaml: trim "${book.trim}" is not in book-sizes.yaml (${Object.keys(sizes.trims).join(", ")})`);
  }
  if (!PAPERS.includes(book.paper)) problems.push(`book.yaml: paper must be one of ${PAPERS.join(", ")}`);
  for (const field of ["title", "author", "copyright_holder", "copyright_year", "language"]) {
    if (!book.metadata[field]) problems.push(`book.yaml: metadata.${field} is required`);
  }
  for (const field of ["title", "subtitle", "author"]) {
    const value = book.metadata[field];
    if (value && !LATIN_TEXT.test(value)) problems.push(`book.yaml: metadata.${field} must use Latin characters only`);
  }
  const fullTitle = [book.metadata.title, book.metadata.subtitle].filter(Boolean).join(": ");
  if (fullTitle.length > 200) problems.push("book.yaml: title and subtitle must be 200 characters or fewer");
  for (const [key, trimRecord] of Object.entries(sizes.trims)) {
    if (!sizes.type_scales[trimRecord.type_scale]) problems.push(`book-sizes.yaml: ${key} names unknown type scale`);
  }
  if (problems.length) throw new Error(problems.join("\n"));
  return { book, sizes };
}

export function trackVersion(track) {
  return fs.readFileSync(path.join(REPOSITORY_DIRECTORY, track, "version.txt"), "utf8").trim();
}
