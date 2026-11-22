// The project citation style (styles/project-law-review.csl) with citeproc-js.
// The first tests reproduce the bug found in the ebook test build: the
// upstream Bluebook style dropped a statute's "§ 4" pinpoint and printed
// nothing for its short form (spikes/epub/REPORT.md).

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { CitationEngine, citationItems, courtAbbreviation, normalizeSection, parsePinpoint } from "../pipeline/citations.mjs";
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
  "several-sections": {
    id: "several-sections",
    type: "legislation",
    title: "28 U.S.C. §§ 654–658",
    "container-title": "United States Code",
    "container-title-short": "U.S.C.",
    volume: "28",
    section: "654–658",
  },
  "section-with-symbol": {
    id: "section-with-symbol",
    type: "legislation",
    title: "Nev. Rev. Stat. §§ 38.206-38.248",
    "container-title": "Nev. Rev. Stat.",
    section: "§§ 38.206-38.248",
    issued: { "date-parts": [[2025]] },
  },
  "single-section-with-symbol": {
    id: "single-section-with-symbol",
    type: "legislation",
    title: "25 C.F.R. § 900.217",
    "container-title": "C.F.R.",
    volume: "25",
    section: "§ 900.217",
  },
  "executive-order": {
    id: "executive-order",
    type: "legislation",
    title: "Executive Order 12988, Civil Justice Reform",
    "title-short": "Exec. Order 12,988",
    "container-title": "Federal Register",
    "container-title-short": "Fed. Reg.",
    volume: "61",
    page: "4729",
    issued: { "date-parts": [[1996, 2, 5]] },
  },
  "register-notice": {
    id: "register-notice",
    type: "legislation",
    title: "Reconsidered Final Determination To Decline To Acknowledge the Chinook Indian Tribe/Chinook Nation",
    "container-title": "Federal Register",
    "container-title-short": "Fed. Reg.",
    volume: "67",
    page: "46204-46206",
    issued: { "date-parts": [[2002, 7, 12]] },
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
// Unescapes the Typst output, and shows the no-break space after "§" as a
// space so that the expected strings stay readable.
function notes(clusters, items = ITEMS) {
  const engine = new CitationEngine(items);
  const ids = clusters.map((references, index) => engine.cite(references, index + 1));
  return ids.map((id) => engine.text(id).replace(/\\(.)/g, "$1").replaceAll("\u00A0", " "));
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

test("several sections print §§, and a section recorded with its symbol prints it once (Indigo Book R16.1)", () => {
  const printed = notes([
    [{ key: "several-sections" }],
    [{ key: "section-with-symbol" }],
    [{ key: "single-section-with-symbol" }],
    [{ key: "single-section-with-symbol", pinpoint: "(b)" }],
  ]);
  assert.equal(printed[0], "28 U.S.C. §§ 654–658.");
  assert.equal(printed[1], "Nev. Rev. Stat. §§ 38.206–38.248 (2025).");
  assert.equal(printed[2], "25 C.F.R. § 900.217.");
  assert.equal(printed[3], "#emph[Id.] § 900.217(b).");
});

test("a hyphen inside one section number is kept", () => {
  assert.equal(normalizeSection("13A-12-5"), "§\u00A013A-12-5");
  assert.equal(normalizeSection("10H-1"), "§\u00A010H-1");
  assert.equal(normalizeSection("471, 473"), "§§\u00A0471, 473");
  assert.equal(normalizeSection("§§ 3.475-3.500"), "§§\u00A03.475–3.500");
});

test("Federal Register documents print volume, first page and full date (Indigo Book R19.4)", () => {
  const printed = notes([
    [{ key: "executive-order" }],
    [{ key: "register-notice", pinpoint: "46205" }],
    [{ key: "register-notice", pinpoint: "46206" }],
    [{ key: "book" }],
    [{ key: "executive-order" }],
  ]);
  assert.equal(printed[0], "Exec. Order 12,988, 61 Fed. Reg. 4729 (Feb. 5, 1996).");
  assert.equal(
    printed[1],
    "Reconsidered Final Determination To Decline To Acknowledge the Chinook Indian Tribe/Chinook Nation, 67 Fed. Reg. 46204, 46205 (July 12, 2002).",
  );
  assert.equal(printed[2], "#emph[Id.] at 46206.");
  assert.equal(printed[4], "Exec. Order 12,988, 61 Fed. Reg. 4729.");
});

test("case names print in italics; books print with a comma before 'at' after supra", () => {
  const printed = notes([
    [{ key: "case", pinpoint: "52" }],
    [{ key: "book", pinpoint: "p. 12" }],
    [{ key: "case", pinpoint: "55" }],
    [{ key: "book", pinpoint: "p. 14" }],
    [{ key: "book", pinpoint: "§ 3" }],
  ]);
  assert.equal(printed[0], "#emph[Santa Clara Pueblo v. Martinez], 436 U.S. 49, 52 (1978).");
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
  assert.deepEqual(parsePinpoint("art. IV"), { label: "article-locator", locator: "IV" });
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

test("courts print as the Indigo Book abbreviates them, and unreported cases by docket number", () => {
  assert.equal(courtAbbreviation("United States Court of Appeals for the Federal Circuit"), "Fed. Cir.");
  assert.equal(courtAbbreviation("U.S. Court of Appeals for the Ninth Circuit"), "9th Cir.");
  assert.equal(courtAbbreviation("United States Court of Appeals for the District of Columbia Circuit"), "D.C. Cir.");
  assert.equal(courtAbbreviation("United States Court of Federal Claims"), "Fed. Cl.");
  assert.equal(courtAbbreviation("U.S. District Court, W.D. Oklahoma"), "W.D. Okla.");
  assert.equal(courtAbbreviation("Supreme Court of Alaska"), "Alaska");
  assert.equal(courtAbbreviation("Supreme Court of Canada"), "Supreme Court of Canada");
  assert.equal(courtAbbreviation("Supreme Court of the United States", { "container-title": "U.S." }), "");
  const items = citationItems([
    {
      key: "reported",
      citation: { type: "legal_case", title: "Jones v. United States", authority: "United States Court of Appeals for the Federal Circuit", "container-title": "F.3d", volume: "846", page: "1343", issued: { "date-parts": [[2017]] } },
    },
    {
      key: "unreported",
      citation: { type: "legal_case", title: "Flying Horse v. United States", authority: "United States Court of Appeals for the Federal Circuit", number: "2017-1620", issued: { "date-parts": [[2017, 6, 13]] } },
    },
  ]);
  const printed = notes([[{ key: "reported", pinpoint: "1350" }], [{ key: "unreported" }]], items);
  assert.equal(printed[0], "#emph[Jones v. United States], 846 F.3d 1343, 1350 (Fed. Cir. 2017).");
  assert.equal(printed[1], "#emph[Flying Horse v. United States], No. 2017-1620 (Fed. Cir. June 13, 2017).");
});
