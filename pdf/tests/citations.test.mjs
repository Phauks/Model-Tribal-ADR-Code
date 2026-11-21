// The project citation style (styles/project-law-review.csl) with citeproc-js.
// The first tests reproduce the bug found in the ebook test build: the
// upstream Bluebook style dropped a statute's "§ 4" pinpoint and printed
// nothing for its short form (spikes/epub/REPORT.md).

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { CitationEngine, citationItems, parsePinpoint } from "../pipeline/citations.mjs";
import { REPOSITORY_DIRECTORY } from "../pipeline/configuration.mjs";
import { loadContent } from "../pipeline/content.mjs";

const ITEMS = {
  "uniform-mediation-act": {
    id: "uniform-mediation-act",
    type: "legislation",
    title: "Uniform Mediation Act",
    "title-short": "Unif. Mediation Act",
    authority: "Unif. L. Comm'n",
    issued: { "date-parts": [[2001]] },
  },
  "act-without-short-title": {
    id: "act-without-short-title",
    type: "legislation",
    title: "Indian Civil Rights Act of 1968",
  },
  "code-section": {
    id: "code-section",
    type: "legislation",
    title: "25 U.S.C. § 5130",
    "container-title": "U.S.C.",
    volume: "25",
    section: "5130",
  },
  "state-code-section": {
    id: "state-code-section",
    type: "legislation",
    title: "Fla. Stat. § 90.506",
    "container-title": "Fla. Stat.",
    section: "90.506",
    issued: { "date-parts": [[2020]] },
  },
  "repealed-section": {
    id: "repealed-section",
    type: "legislation",
    title: "Ala. Code § 13A-12-5",
    "container-title": "Ala. Code",
    section: "13A-12-5",
    status: "repealed",
    issued: { "date-parts": [[2015]] },
  },
  case: {
    id: "case",
    type: "legal_case",
    title: "Santa Clara Pueblo v. Martinez",
    "title-short": "Santa Clara Pueblo",
    "container-title": "U.S.",
    volume: "436",
    page: "49",
    issued: { "date-parts": [[1978]] },
  },
  book: {
    id: "book",
    type: "book",
    author: [{ family: "Austin", given: "Raymond D." }],
    title: "Navajo Courts and Navajo Common Law",
    issued: { "date-parts": [[2009]] },
  },
};

// Cites each cluster in its own footnote and returns the footnote texts with
// Typst escapes removed, so the expected values read like the printed note.
function notes(clusters, items = ITEMS) {
  const engine = new CitationEngine(items);
  const ids = clusters.map((references, index) => engine.cite(references, index + 1));
  return ids.map((id) => engine.text(id).replace(/\\(.)/g, "$1"));
}

test("a statute keeps its section pinpoint in the full citation", () => {
  const [first] = notes([[{ key: "uniform-mediation-act", pinpoint: "§ 4" }]]);
  assert.equal(first, "Unif. Mediation Act § 4 (Unif. L. Comm’n 2001).");
});

test("a statute's short form is never empty and keeps its pinpoint", () => {
  const printed = notes([
    [{ key: "uniform-mediation-act", pinpoint: "§ 4" }],
    [{ key: "book" }],
    [{ key: "uniform-mediation-act", pinpoint: "§ 5" }],
    [{ key: "book" }],
    [{ key: "uniform-mediation-act" }],
  ]);
  assert.equal(printed[2], "Unif. Mediation Act § 5.");
  assert.equal(printed[4], "Unif. Mediation Act.");
});

test("an act with no short title uses its full title in the short form", () => {
  const printed = notes([
    [{ key: "act-without-short-title", pinpoint: "§ 2" }],
    [{ key: "book" }],
    [{ key: "act-without-short-title", pinpoint: "§ 3" }],
  ]);
  assert.equal(printed[0], "Indian Civil Rights Act of 1968 § 2.");
  assert.equal(printed[2], "Indian Civil Rights Act of 1968 § 3.");
});

test("Id. with a section pinpoint has no 'at' (Indigo Book R6.2.2)", () => {
  const printed = notes([
    [{ key: "uniform-mediation-act", pinpoint: "§ 4" }],
    [{ key: "uniform-mediation-act", pinpoint: "§ 9" }],
    [{ key: "uniform-mediation-act", pinpoint: "§ 9" }],
  ]);
  assert.equal(printed[1], "#emph[Id.] § 9.");
  assert.equal(printed[2], "#emph[Id.]");
});

test("a code section joins a subsection pinpoint to the section number", () => {
  const printed = notes([
    [{ key: "code-section", pinpoint: "(2)" }],
    [{ key: "code-section", pinpoint: "(3)" }],
    [{ key: "book" }],
    [{ key: "code-section", pinpoint: "(a)-(c)" }],
    [{ key: "code-section" }],
  ]);
  assert.equal(printed[0], "25 U.S.C. § 5130(2).");
  assert.equal(printed[1], "#emph[Id.] § 5130(3).");
  assert.equal(printed[3], "25 U.S.C. § 5130(a)-(c).");
  // After a pinpoint, a cite of the whole section is not "Id." (CSL ibid rules).
  assert.equal(printed[4], "25 U.S.C. § 5130.");
});

test("state code and repealed sections carry the year parenthetical (Indigo Book R17.3, R17.4)", () => {
  const printed = notes([[{ key: "state-code-section" }], [{ key: "repealed-section", pinpoint: "(a)(1)" }]]);
  assert.equal(printed[0], "Fla. Stat. § 90.506 (2020).");
  assert.equal(printed[1], "Ala. Code § 13A-12-5(a)(1) (repealed 2015).");
});

test("cases and books print as before, with a comma before 'at' after supra", () => {
  const printed = notes([
    [{ key: "case", pinpoint: "52" }],
    [{ key: "book", pinpoint: "p. 12" }],
    [{ key: "case", pinpoint: "55" }],
    [{ key: "book", pinpoint: "p. 14" }],
    [{ key: "book", pinpoint: "§ 3" }],
  ]);
  assert.equal(printed[0], "Santa Clara Pueblo v. Martinez, 436 U.S. 49, 52 (1978).");
  assert.equal(printed[1], "#small-capitals[Raymond D. Austin], #small-capitals[Navajo Courts and Navajo Common Law] 12 (2009).");
  assert.equal(printed[2], "#emph[Santa Clara Pueblo], 436 U.S. at 55.");
  assert.equal(printed[3], "#small-capitals[Austin], #emph[supra] note 2, at 14.");
  assert.equal(printed[4], "#emph[Id.] § 3.");
});

test("pinpoint labels follow Pandoc's citation syntax", () => {
  assert.deepEqual(parsePinpoint("p. 16"), { label: "page", locator: "16" });
  assert.deepEqual(parsePinpoint("at 52"), { label: "page", locator: "52" });
  assert.deepEqual(parsePinpoint("§ 4"), { label: "section", locator: "4" });
  assert.deepEqual(parsePinpoint("sec. 3"), { label: "section", locator: "3" });
  assert.deepEqual(parsePinpoint("¶ 12"), { label: "paragraph", locator: "12" });
  assert.deepEqual(parsePinpoint("(2)"), { label: "page", locator: "(2)" });
  assert.deepEqual(parsePinpoint(undefined), {});
});

test("every source record in content/ prints a full and a short form", () => {
  const { sources } = loadContent(path.join(REPOSITORY_DIRECTORY, "content"));
  const items = citationItems(sources);
  for (const key of Object.keys(items)) {
    const printed = notes([[{ key }], [{ key: "book" }], [{ key }]], { ...items, book: ITEMS.book });
    for (const text of [printed[0], printed[2]]) {
      assert.ok(text.replace(/[.\s]/g, "").length > 0, `${key} printed "${text}"`);
      assert.doesNotMatch(text, /STYLE ERROR/);
    }
  }
});
