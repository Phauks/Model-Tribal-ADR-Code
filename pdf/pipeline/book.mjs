// Puts the book together in reading order and writes it as Typst markup:
// front matter, Part I essays, Part II provisions with their commentary,
// Part III essays, and the glossary.

import path from "node:path";
import { CitationEngine, citationItems } from "./citations.mjs";
import { essaysForPart, provisionChapters } from "./content.mjs";
import { createMarkdown, parseMarkdown } from "./markdown.mjs";
import { ChapterWriter, KINDS } from "./typst-writer.mjs";
import { escapeTypst, typstString } from "./typst-text.mjs";

const USAGE_LABELS = { preferred: "Preferred", acceptable: "Acceptable", "context-only": "Context only", avoid: "Avoid" };

const FRONT_MATTER_ORDER = ["acknowledgments"];
const frontMatterRank = (page) => {
  const rank = FRONT_MATTER_ORDER.indexOf(page.data.id);
  return rank === -1 ? FRONT_MATTER_ORDER.length : rank;
};

const content = (text) => `[${escapeTypst(text)}]`;

export function assembleBook({ book, content: records }) {
  const sources = citationItems(records.sources);
  const glossary = new Map(records.glossary.map((entry) => [entry.id, entry]));
  const markdown = createMarkdown({ sourceKeys: new Set(Object.keys(sources)), glossaryIds: new Set(glossary.keys()) });
  const citations = new CitationEngine(sources);
  const warnings = [];
  const parse = (kind, file, text, data = {}) => ({ kind, file, data, ...parseMarkdown(markdown, text, records.variables) });
  const relative = (file) => path.relative(process.cwd(), file);

  // A chapter is a list of pieces: Typst markup, or a parsed document.
  const chapters = [];
  const addPart = (part) => chapters.push({ part });

  const essayChapters = (essays) =>
    essays.map((essay) => {
      if (!essay.data.title) throw new Error(`${relative(essay.file)}: essays need a title in their front matter`);
      return { number: null, title: essay.data.title, pieces: [parse(KINDS.essay, essay.file, essay.body, essay.data)] };
    });

  // Front matter pages print after the contents, before Part I, in the
  // order FRONT_MATTER_ORDER gives (others follow by file name).
  const frontMatter = [...(records.frontMatter || [])].sort(
    (first, second) => frontMatterRank(first) - frontMatterRank(second) || first.file.localeCompare(second.file),
  );
  for (const page of frontMatter) {
    if (!page.data.title) throw new Error(`${relative(page.file)}: front matter pages need a title`);
    chapters.push({ number: null, title: page.data.title, pieces: [parse(KINDS.essay, page.file, page.body, page.data)] });
  }

  const partOne = essayChapters(essaysForPart(records.essays, "i"));
  if (partOne.length) addPart(book.parts.essays);
  chapters.push(...partOne);

  const provisionGroups = provisionChapters(records.provisions);
  if (provisionGroups.length) addPart(book.parts.provisions);
  for (const [number, provisions] of provisionGroups) {
    let title = book.chapters[number];
    if (!title) {
      title = `Chapter ${number}`;
      warnings.push(`book.yaml has no title for chapter ${number} (chapters: { ${number}: ... }).`);
    }
    const pieces = [];
    for (const provision of provisions) {
      const { id, number: sectionNumber, title: sectionTitle } = provision.data;
      pieces.push(`#heading(level: 3)[${escapeTypst(`${sectionNumber}. ${sectionTitle}`)}] <section-${id}>`);
      pieces.push(parse(KINDS.provision, provision.file, provision.body, provision.data));
      const commentary = records.commentary.get(id);
      if (commentary) pieces.push(parse(KINDS.commentary, commentary.file, commentary.body, commentary.data));
    }
    chapters.push({ number: `Chapter ${number}`, title, pieces });
  }

  const partThree = essayChapters(essaysForPart(records.essays, "iii"));
  if (partThree.length) addPart(book.parts.methods);
  chapters.push(...partThree);

  // Glossary: every current entry, alphabetical by term.
  const entries = [...glossary.values()].sort((first, second) =>
    first.term.localeCompare(second.term, "en", { sensitivity: "base" }),
  );
  const printedGlossaryIds = new Set(entries.map((entry) => entry.id));
  if (entries.length) {
    const pieces = entries.map((entry) => {
      const text = [entry.definition];
      if (entry.usage_note) text.push(`*Usage.* ${entry.usage_note}`);
      if (entry.use_instead && entry.use_instead.length) {
        text.push(`*Use instead:* ${entry.use_instead.map((id) => `[[${id}]]`).join(", ")}.`);
      }
      return { entry, document: parse(KINDS.glossary, entry.file, text.join("\n\n"), entry) };
    });
    chapters.push({ number: null, title: "Glossary", glossary: pieces });
  }

  // Write every chapter: number its notes first, then write the markup.
  const output = [];
  for (const chapter of chapters) {
    if (chapter.part) {
      output.push(`#part-opener(layout, ${content(chapter.part.number)}, ${content(chapter.part.title)})`);
      continue;
    }
    const writer = new ChapterWriter({ citations, glossary, printedGlossaryIds });
    const number = chapter.number ? content(chapter.number) : "none";
    output.push(`#chapter-opener(layout, ${number}, ${content(chapter.title)})`);
    if (chapter.glossary) {
      for (const { document } of chapter.glossary) writer.numberNotes(document);
      for (const { entry, document } of chapter.glossary) {
        const expansion = entry.kind === "acronym" && entry.expansion ? content(entry.expansion) : "none";
        const usage = USAGE_LABELS[entry.usage] ? typstString(USAGE_LABELS[entry.usage]) : "none";
        const seeAlso = (entry.see_also || []).filter((id) => glossary.has(id));
        const seeAlsoMarkup = seeAlso.length
          ? `[${seeAlso.map((id) => `#link(<glossary-${id}>)[${escapeTypst(glossary.get(id).term)}]`).join(", ")}]`
          : "none";
        output.push(
          `#glossary-entry(${content(entry.term)}, ${expansion}, ${usage}, ${seeAlsoMarkup})[${writer.write(document)}] <glossary-${entry.id}>`,
        );
      }
      continue;
    }
    for (const piece of chapter.pieces) if (typeof piece !== "string") writer.numberNotes(piece);
    for (const piece of chapter.pieces) output.push(typeof piece === "string" ? piece : writer.write(piece));
  }

  const body = [
    "// Generated by pdf/pipeline/build.mjs from the files in content/. Do not edit.",
    '#import "/typst/book.typ": *',
    '#let layout = json("layout.json")',
    "#show: book.with(layout: layout)",
    "#title-page(layout)",
    "#copyright-page(layout)",
    "#contents-page(layout)",
    ...output,
    "#context [#metadata(here().page()) <book-end>]",
    "",
  ].join("\n\n");
  return { body, warnings };
}
