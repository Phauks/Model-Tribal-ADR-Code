// The Markdown reader and the Typst writer.

import assert from "node:assert/strict";
import { test } from "node:test";
import { CitationEngine } from "../pipeline/citations.mjs";
import { createMarkdown, parseMarkdown, prepareSource } from "../pipeline/markdown.mjs";
import { ChapterWriter, KINDS, caseFacts, courtDays, subsectionLevel } from "../pipeline/typst-writer.mjs";
import { escapeTypst } from "../pipeline/typst-text.mjs";

const variables = { "nation.name": { model: "[Name of Nation]" } };
const glossary = new Map([["adr", { id: "adr", term: "ADR", kind: "acronym", expansion: "alternative dispute resolution" }]]);
const items = {
  act: { id: "act", type: "legislation", title: "Uniform Mediation Act", "title-short": "Unif. Mediation Act" },
  worcester: {
    id: "worcester", type: "legal_case", title: "Worcester v. Georgia", "container-title": "U.S.", volume: "31", page: "515",
    issued: { "date-parts": [[1832]] },
  },
};

function writer({ notes } = {}) {
  return new ChapterWriter({ citations: new CitationEngine(items), glossary, printedGlossaryIds: new Set(["adr"]), notes, chapterIndex: 1 });
}

function write(kind, text, data = {}, chapter = writer()) {
  const markdown = createMarkdown({ sourceKeys: new Set(Object.keys(items)), glossaryIds: new Set(glossary.keys()) });
  const document = { kind, file: "test.md", data, ...parseMarkdown(markdown, text, variables) };
  chapter.numberNotes(document);
  return chapter.write(document);
}

// An essay's text, without the #essay-body[...] wrapper around it.
function essay(text, chapter) {
  const typst = write(KINDS.essay, text, {}, chapter);
  assert.ok(typst.startsWith("#essay-body[") && typst.endsWith("]"), typst);
  return typst.slice("#essay-body[".length, -1);
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
  const typst = essay("A rule [@act, § 4].");
  assert.equal(typst, "A rule\\.#footnote[Unif\\. Mediation Act § 4\\.]");
});

test("a citation inside a footnote prints in place without a double stop", () => {
  const typst = essay("A rule.[^1]\n\n[^1]: See [@act, § 4].");
  assert.equal(typst, "A rule\\.#footnote[See Unif\\. Mediation Act § 4\\.]");
});

test("unknown citation keys and glossary links stop the build", () => {
  assert.throws(() => write(KINDS.essay, "Text [@missing]."), /no source record/);
  assert.throws(() => write(KINDS.essay, "Text [[missing]]."), /no entry/);
});

test("the first link to an acronym in a chapter prints its expansion, with the words capitalized", () => {
  const typst = essay("[[adr]] and [[adr]] and [[adr|this]]");
  assert.equal(
    typst,
    "#link(<glossary-adr>)[Alternative Dispute Resolution \\(ADR)] and #link(<glossary-adr>)[ADR] and #link(<glossary-adr>)[this]",
  );
});

test("commentary headings and illustrations use the Restatement pattern", () => {
  const typst = write(KINDS.commentary, "## Comment\n\nText.\n\n## Illustrations\n\n1. One.\n2. Two.\n\n## Source Note\n\nNote.");
  assert.match(typst, /#commentary-heading\[Comment\]/);
  assert.match(typst, /#illustrations\(1, \[One\\\.\], \[Two\\\.\]\)/);
  assert.match(typst, /#source-note\[Note\\\.\]/);
});

// Typst escapes removed, so expected values read like the printed text.
const plain = (typst) => typst.replace(/\\(.)/g, "$1");

test("a case block takes its heading from the source record, with Quotes and Treatment parts", () => {
  const typst = plain(essay(
    ":::: case worcester\nWhat the Court held.\n\n::: quotes\n> The Cherokee nation, then, is a distinct community.\n\n[@worcester, at 561]\n:::\n\n::: treatment\nLater cases.\n:::\n::::",
  ));
  assert.ok(typst.startsWith("#case-block([#emph[Worcester v. Georgia], 31 U.S. 515 (1832)], ())[What the Court held."), typst);
  assert.ok(typst.includes('#case-part("Quotes")[#quote-block[The Cherokee nation, then, is a distinct community.]'), typst);
  // The source line prints its citation in place, not as a note.
  assert.ok(typst.includes("#attribution[#emph[Worcester v. Georgia], 31 U.S. 515, 561 (1832)]"), typst);
  assert.ok(!typst.includes("#footnote"), typst);
  assert.ok(typst.includes('#case-part("Treatment")[Later cases.]'), typst);
});

test("the author's analysis is boxed, with an optional title", () => {
  assert.equal(plain(essay("::: analysis\nA reading.\n:::")), "#analysis-block(none)[A reading.]");
  assert.ok(plain(essay("::: analysis Why it matters\nA reading.\n:::")).startsWith("#analysis-block([Why it matters])["));
});

test("a figure prints as a box with its caption, parts and where to find it", () => {
  const picture = plain(essay(":::: figure picture /files/U-20261123-7KQ2MD/a.jpg\nThe council house.\n\n::: description\nA wooden building.\n:::\n\n::: credit\nPhoto by the archives.\n:::\n::::"));
  assert.equal(
    picture,
    '#figure-block("Picture", [It appears with this essay on the website.])[The council house.\n\n#case-part("Description")[A wooden building.]\n\n#figure-credit[Photo by the archives.]]',
  );
  const video = plain(essay(":::: figure video https://youtu.be/dQw4w9WgXcQ\nA hearing.\n::::"));
  assert.ok(video.startsWith('#figure-block("Video", [Watch it at #link("https://www.youtube.com/watch?v=dQw4w9WgXcQ")])[A hearing.]'), video);
  const chart = plain(essay(":::: figure chart\nCompacts by state.\n\n| State | Compacts |\n| --- | ---: |\n| California | 70 |\n::::"));
  assert.ok(chart.startsWith('#figure-block("Chart", none)[Compacts by state.'), chart);
  assert.ok(chart.includes("California"), chart);
});

test("with endnotes, a citation prints a numbered mark and the chapter's notes print at its end", () => {
  const chapter = writer({ notes: "endnotes" });
  const typst = essay("A rule [@act, § 4]. Another [@act, § 5].", chapter);
  assert.equal(typst, "A rule\\.#endnote-mark(1, <endnote-1-1>) Another\\.#endnote-mark(2, <endnote-1-2>)");
  assert.match(chapter.notesSection(), /^#endnotes-section\[#endnote-entry\(1\)\[Unif\\\. Mediation Act § 4\\\.\] <endnote-1-1>/);
});

test("a Supreme Court case block lists the nations, the Court, the vote and each justice's part", () => {
  const facts = caseFacts(
    {
      tribes: ["cabazon-band"],
      supreme_court: {
        court: "Rehnquist Court",
        vote: { majority: 6, minority: 3 },
        justices: [
          { name: "Thurgood Marshall", vote: "majority" },
          { name: "Byron R. White", vote: "majority", opinion: "majority" },
          { name: "John Paul Stevens", vote: "minority", opinion: "dissent" },
          { name: "Sandra Day O'Connor", vote: "minority" },
          { name: "Antonin Scalia", vote: "minority" },
        ],
      },
    },
    new Map([["cabazon-band", "Cabazon Band of Mission Indians"]]),
  );
  const text = plain(facts);
  assert.ok(text.includes('("Nation", [Cabazon Band of Mission Indians])'), text);
  assert.ok(text.includes('("Court", [Rehnquist Court])'), text);
  assert.ok(text.includes('("Vote", [6–3])'), text);
  assert.ok(text.includes('("Majority", [#strong[White] (opinion of the Court), Marshall])'), text);
  assert.ok(text.includes('("Dissent", [#strong[Stevens] (dissenting opinion), O\'Connor, Scalia])'), text);
});

test("a case block labels peoples that are not Tribes as peoples, and shows votes the report leaves open", () => {
  const facts = plain(
    caseFacts(
      {
        tribes: ["native-hawaiians"],
        supreme_court: {
          court: "Roberts Court",
          decision_type: "equally divided Court",
          vote: { majority: 4, minority: 4 },
          justices: [{ name: "Anthony M. Kennedy", vote: "not recorded" }],
        },
      },
      new Map([["native-hawaiians", "Native Hawaiians"]]),
      new Set(["native-hawaiians"]),
    ),
  );
  assert.ok(facts.includes('("People", [Native Hawaiians])'), facts);
  assert.ok(facts.includes('("Decision", [Affirmed by an equally divided Court])'), facts);
  assert.ok(facts.includes('("Vote not recorded", [Kennedy])'), facts);
});

test("case boxes give the decision date, take Background, Question and Holding parts, and law boxes take What it does", () => {
  const facts = plain(caseFacts({ citation: { issued: { "date-parts": [[1831, 3, 18]] } } }));
  assert.ok(facts.includes('("Decided", [March 18, 1831])'), facts);
  const typst = plain(essay(":::: case worcester\n::: background\nThe facts.\n:::\n\n::: question\nA question?\n:::\n\n::: holding\nNo.\n:::\n::::"));
  assert.ok(typst.includes('#case-part("Background")[The facts.]'), typst);
  assert.ok(typst.includes('#case-part("Question")[A question?]'), typst);
  assert.ok(typst.includes('#case-part("Holding")[No.]'), typst);
  assert.ok(/<case-worcester>$/.test(typst), typst);
  const law = plain(essay(":::: law act\n::: summary\nWhat it did.\n:::\n::::"));
  assert.ok(law.startsWith("#law-block(["), law);
  assert.ok(law.includes('#case-part("What it does")[What it did.]'), law);
});

test("a case box gives each court date its own line, in the order they happened", () => {
  const facts = plain(
    caseFacts({
      citation: { issued: { "date-parts": [[1990, 2, 20]] } },
      court_dates: { argued_and_submitted: ["1988-05-11"], amended: ["1992-03-16"] },
    }),
  );
  assert.ok(facts.startsWith('(("Argued and submitted", [May 11, 1988]), ("Decided", [February 20, 1990]), ("Amended", [March 16, 1992])'), facts);
  assert.equal(courtDays(["1823-02-19", "1823-02-17", "1823-02-18"]), "February 17–19, 1823");
  assert.equal(courtDays(["1823-02-15", "1823-02-17"]), "February 15 and 17, 1823");
  assert.equal(courtDays(["1831-12-30", "1832-01-02"]), "December 30, 1831, and January 2, 1832");
});

test("a link to #case-KEY prints the page of that case's box", () => {
  assert.equal(plain(essay("[*Worcester* (1832)](#case-worcester)")), "#case-ref(<case-worcester>)[#emph[Worcester] (1832)]");
});

test("a quotation from a separate opinion names it after the citation", () => {
  const typst = plain(essay("::: quote\n> A dissent's words.\n\n[@worcester, at 563] (Baldwin, J., dissenting)\n:::"));
  assert.ok(typst.includes("#attribution[#emph[Worcester v. Georgia], 31 U.S. 515, 563 (1832) (Baldwin, J., dissenting)]"), typst);
});
