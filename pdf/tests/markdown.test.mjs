// The Markdown reader and the Typst writer.

import assert from "node:assert/strict";
import { test } from "node:test";
import { CitationEngine } from "../pipeline/citations.mjs";
import { createMarkdown, parseMarkdown, prepareSource } from "../pipeline/markdown.mjs";
import { ChapterWriter, KINDS, subsectionLevel } from "../pipeline/typst-writer.mjs";
import { escapeTypst } from "../pipeline/typst-text.mjs";

const variables = { "nation.name": { model: "[Name of Nation]" } };
const glossary = new Map([["adr", { id: "adr", term: "ADR", kind: "acronym", expansion: "alternative dispute resolution" }]]);
const items = {
  act: { id: "act", type: "legislation", title: "Uniform Mediation Act", "title-short": "Unif. Mediation Act" },
};

function write(kind, text, data = {}) {
  const markdown = createMarkdown({ sourceKeys: new Set(Object.keys(items)), glossaryIds: new Set(glossary.keys()) });
  const document = { kind, file: "test.md", data, ...parseMarkdown(markdown, text, variables) };
  const writer = new ChapterWriter({ citations: new CitationEngine(items), glossary, printedGlossaryIds: new Set(["adr"]) });
  writer.numberNotes(document);
  return writer.write(document);
}

test("text is escaped so Typst prints it exactly", () => {
  assert.equal(escapeTypst("a -- b ... c #d $e *f* _g_ <h> @i [j] ~k /l"), "a \\-\\- b \\.\\.\\. c \\#d \\$e \\*f\\* \\_g\\_ \\<h\\> \\@i \\[j\\] \\~k \\/l");
  assert.equal(escapeTypst("1. (2)"), "1\\. \\(2)");
});

test("subsection labels stay as written, not as a copyright sign", () => {
  const typst = write(KINDS.provision, "(c) **Exceptions.** Text.");
  assert.match(typst, /^#subsection\(1\)\[\\\(c\) #strong\[Exceptions\\\.\] Text\\\.\]$/);
});

test("subsection levels: (a) 1, (1) 2, (A) 3, (ii) 4", () => {
  assert.equal(subsectionLevel("(a) x", 0), 1);
  assert.equal(subsectionLevel("(1) x", 1), 2);
  assert.equal(subsectionLevel("(A) x", 2), 3);
  assert.equal(subsectionLevel("(ii) x", 3), 4);
  assert.equal(subsectionLevel("(i) x", 3), 4);
  assert.equal(subsectionLevel("(i) x", 1), 1);
  assert.equal(subsectionLevel("No label", 1), null);
});

test("placeholders print their model text, and unknown ones stop the build", () => {
  assert.equal(prepareSource("the {{nation.name}} court", variables), "the [Name of Nation] court");
  assert.throws(() => prepareSource("{{court.name}}", variables), /not defined/);
});

test("alternatives become labeled blocks", () => {
  const typst = write(KINDS.provision, "```alternative A\n(d) Text.\n```\n", { alternatives: [{ id: "A", label: "First" }] });
  assert.match(typst, /^#alternative\("A", \[First\]\)\[#subsection\(1\)\[/);
});

test("a citation in the text becomes a footnote after the punctuation", () => {
  const typst = write(KINDS.essay, "A rule [@act, § 4].");
  assert.equal(typst, "A rule\\.#footnote[Unif\\. Mediation Act § 4\\.]");
});

test("a citation inside a footnote prints in place without a double stop", () => {
  const typst = write(KINDS.essay, "A rule.[^1]\n\n[^1]: See [@act, § 4].");
  assert.equal(typst, "A rule\\.#footnote[See Unif\\. Mediation Act § 4\\.]");
});

test("unknown citation keys and glossary links stop the build", () => {
  assert.throws(() => write(KINDS.essay, "Text [@missing]."), /no source record/);
  assert.throws(() => write(KINDS.essay, "Text [[missing]]."), /no entry/);
});

test("the first link to an acronym in a chapter prints its expansion", () => {
  const typst = write(KINDS.essay, "[[adr]] and [[adr]] and [[adr|this]]");
  assert.equal(
    typst,
    "#link(<glossary-adr>)[alternative dispute resolution \\(ADR)] and #link(<glossary-adr>)[ADR] and #link(<glossary-adr>)[this]",
  );
});

test("commentary headings and illustrations use the Restatement pattern", () => {
  const typst = write(KINDS.commentary, "## Comment\n\nText.\n\n## Illustrations\n\n1. One.\n2. Two.\n\n## Source Note\n\nNote.");
  assert.match(typst, /#commentary-heading\[Comment\]/);
  assert.match(typst, /#illustrations\(1, \[One\\\.\], \[Two\\\.\]\)/);
  assert.match(typst, /#source-note\[Note\\\.\]/);
});
