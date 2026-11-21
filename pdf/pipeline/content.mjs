// Reads the records in content/ that the book prints. Schema validation is
// done by scripts/validate_records.py; this module only loads and orders.

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;

// Files in a folder and its subfolders (source records may be grouped in
// subfolders, such as by first letter), sorted by path.
function listFiles(directory, suffix) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { recursive: true })
    .filter((name) => name.endsWith(suffix))
    .map((name) => path.join(directory, name))
    .sort();
}

export function readMarkdownRecord(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = FRONT_MATTER.exec(text);
  if (!match) throw new Error(`${file} has no YAML front matter`);
  return { file, data: YAML.parse(match[1]), body: text.slice(match[0].length) };
}

// The charter's commitments: restricted records are never published, and
// records that need a nation's review are held back until approved
// (docs/data-model.md, "Sensitivity flags").
function publishable(data) {
  const sensitivity = data.sensitivity || {};
  return !sensitivity.restricted && !sensitivity.tribal_review_required && data.status !== "withdrawn";
}

export function loadContent(contentDirectory) {
  const yamlRecords = (folder) =>
    listFiles(path.join(contentDirectory, folder), ".yaml").map((file) => ({ file, ...YAML.parse(fs.readFileSync(file, "utf8")) }));

  const sources = yamlRecords("sources").filter(publishable);
  const glossary = yamlRecords("glossary").filter((entry) => entry.status !== "retired" && !entry.redirect_to);
  const variables = {};
  for (const group of yamlRecords("variables")) {
    for (const [name, variable] of Object.entries(group.variables)) variables[`${group.group}.${name}`] = variable;
  }
  const provisions = listFiles(path.join(contentDirectory, "provisions"), ".md")
    .map(readMarkdownRecord)
    .filter((record) => publishable(record.data));
  const commentary = new Map(
    listFiles(path.join(contentDirectory, "commentary"), ".md")
      .map(readMarkdownRecord)
      .filter((record) => publishable(record.data))
      .map((record) => [record.data.provision, record]),
  );
  const essays = listFiles(path.join(contentDirectory, "essays"), ".md")
    .map(readMarkdownRecord)
    .filter((record) => publishable(record.data));
  return { sources, glossary, variables, provisions, commentary, essays };
}

// Part II chapters: provisions grouped by chapter, in section order.
export function provisionChapters(provisions) {
  const chapters = new Map();
  for (const provision of [...provisions].sort((first, second) => first.data.id.localeCompare(second.data.id))) {
    const number = provision.data.chapter;
    if (!chapters.has(number)) chapters.set(number, []);
    chapters.get(number).push(provision);
  }
  return [...chapters.entries()].sort(([first], [second]) => first - second);
}

// Essays: "i-" files open the book (Part I), "iii-" files close it
// (Part III), following docs/repository-layout.md.
export function essaysForPart(essays, prefix) {
  return essays.filter((essay) => path.basename(essay.file).startsWith(prefix + "-"));
}
