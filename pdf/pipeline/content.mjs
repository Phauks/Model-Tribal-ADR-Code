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

// A nation's name as pages show it: "Navajo Nation, Arizona, New Mexico, &
// Utah" shows as "Navajo Nation" (the website's rule, site/src/lib/nation-labels.ts).
const STATE_NAMES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";
const TRAILING_STATES = new RegExp(`,\\s*(?:${STATE_NAMES})(?:(?:,\\s*|,?\\s+(?:&|and)\\s+)(?:${STATE_NAMES}))*\\s*$`, "u");
const ENDS_WITH_OF_STATE = new RegExp(`\\bof\\s+(?:the\\s+State\\s+of\\s+)?(?:${STATE_NAMES})$`, "u");
export function displayName(listedName) {
  const name = String(listedName).trim().replace(/,$/, "").trim();
  const match = TRAILING_STATES.exec(name);
  if (!match) return name;
  const before = name.slice(0, match.index).trim();
  if (before === "" || ENDS_WITH_OF_STATE.test(before)) return name;
  return before;
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
  // Nations' names, for the nations a case block names (from a source's
  // `tribes`): the recognizing list's name without the states it adds.
  // Peoples that are not Tribes (Native Hawaiians, the peoples of the
  // territories) are labeled as peoples, not nations.
  const nationNames = new Map();
  const peopleIds = new Set();
  for (const file of listFiles(path.join(contentDirectory, "tribes"), ".yaml")) {
    const text = fs.readFileSync(file, "utf8");
    const id = (/^id:\s*(.+)$/m.exec(text)?.[1] ?? path.basename(file, ".yaml")).trim();
    const official = /^names:\n(?:\s+.*\n)*?\s+official:\s*(.+)$/m.exec(text);
    const entityType = /^entity_type:\s*(.+)$/m.exec(text)?.[1].trim();
    nationNames.set(id, official ? displayName(YAML.parse(official[1])) : null);
    if (entityType && entityType !== "native-nation") peopleIds.add(id);
  }
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
  // Front matter pages the website shows too, such as the acknowledgments.
  const frontMatter = listFiles(path.join(contentDirectory, "front-matter"), ".md")
    .filter((file) => path.basename(file) !== "README.md")
    .map(readMarkdownRecord)
    .filter((record) => publishable(record.data));
  return { sources, nationNames, peopleIds, glossary, variables, provisions, commentary, essays, frontMatter };
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
