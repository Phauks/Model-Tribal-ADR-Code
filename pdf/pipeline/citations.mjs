// Citations: [@key, pinpoint] in the text becomes a footnote formatted by
// citeproc-js with the project's citation style (docs/citation-style.md).
//
// Each chapter is processed with a fresh citation engine, because footnote
// numbers restart in every chapter: the first citation of a source in a
// chapter is always a full citation, and "supra note 3" always points to a
// note in the same chapter (project choice).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { escapeTypst, separateCalls, typstString } from "./typst-text.mjs";

const require = createRequire(import.meta.url);
const CSL = require("citeproc");

const STYLES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../styles");
export const STYLE_FILE = path.join(STYLES, "project-law-review.csl");
export const LOCALE_FILE = path.join(STYLES, "locales-en-US.xml");

// Typst output for citeproc-js, built on its plain-text format.
function registerTypstFormat() {
  if (CSL.Output.Formats.typst) return;
  const unescape = (text) => text.replace(/\\(.)/g, "$1");
  CSL.Output.Formats.typst = {
    ...CSL.Output.Formats.text,
    text_escape: (text) => escapeTypst(text || ""),
    "@font-style/italic": "#emph[%%STRING%%]",
    "@font-style/oblique": "#emph[%%STRING%%]",
    "@font-variant/small-caps": "#small-capitals[%%STRING%%]",
    "@font-weight/bold": "#strong[%%STRING%%]",
    "@text-decoration/underline": "#underline[%%STRING%%]",
    "@vertical-align/sup": "#super[%%STRING%%]",
    "@vertical-align/sub": "#sub[%%STRING%%]",
    "@URL/true": (state, text) => `#link(${typstString(unescape(text))})[${text}]`,
    "@DOI/true": (state, text) => `#link(${typstString("https://doi.org/" + unescape(text))})[${text}]`,
  };
}

// Pinpoint labels the text may use, after Pandoc's citation syntax:
// "p. 16", "pp. 3-5", "at 52", "§ 4", "sec. 3", "¶ 12", "para. 2", "ch. 1",
// "n. 4", "art. IV". A pinpoint with no label, such as "(2)", is a page in CSL terms;
// for a section of a code it is printed joined to the section number.
const LABELS = [
  [/^(?:pp?\.|pages?|at)\s+/i, "page"],
  [/^(?:§§?|secs?\.|sections?)\s*/i, "section"],
  [/^(?:¶¶?|paras?\.|paragraphs?)\s*/i, "paragraph"],
  [/^(?:ch(?:ap)?\.|chapters?)\s+/i, "chapter"],
  [/^(?:nn?\.|notes?)\s+/i, "note"],
  // CSL 1.0.2 names an article of a treaty or constitution "article-locator";
  // the older name, "article", prints the item-type term "preprint".
  [/^(?:arts?\.|articles?)\s+/i, "article-locator"],
];

export function parsePinpoint(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return {};
  for (const [pattern, label] of LABELS) {
    if (pattern.test(trimmed)) return { label, locator: trimmed.replace(pattern, "") };
  }
  return { label: "page", locator: trimmed };
}

// A code section is recorded as its number, "5130", or numbers, "471, 473"
// or "654–658", with or without its symbol. The build prints it as "§ 5130"
// or "§§ 471, 473" (Indigo Book R16.1): several sections take "§§". A hyphen
// is part of some section numbers, such as Hawaii's "10H-1", so a hyphen
// marks a range, and becomes an en dash, only after "§§". The style prints
// the section as given, because CSL cannot tell that "38.206–38.248" is plural.
const SEVERAL_SECTIONS = /,|–|—|&|\band\b/;

export function normalizeSection(section) {
  if (typeof section !== "string" || !section.trim()) return section;
  const [, symbol = "", numbers] = /^(§§?)?\s*(.*)$/s.exec(section.trim());
  const several = symbol === "§§" || SEVERAL_SECTIONS.test(numbers);
  if (!several) return `§\u00A0${numbers}`;
  return `§§\u00A0${symbol === "§§" ? numbers.replace(/(\w)-(\w)/g, "$1–$2") : numbers}`;
}

// Court names as the Indigo Book abbreviates them in a citation's
// parenthetical (Indigo Book R10.1.3 and Table T1). A record keeps the court's
// full name; the citation prints the abbreviation. The Supreme Court of the
// United States is left out when the case is in the United States Reports.
const ORDINALS = {
  first: "1st", second: "2d", third: "3d", fourth: "4th", fifth: "5th", sixth: "6th", seventh: "7th",
  eighth: "8th", ninth: "9th", tenth: "10th", eleventh: "11th", federal: "Fed.", "district of columbia": "D.C.", "d.c.": "D.C.",
};
const STATES = {
  Alabama: "Ala.", Alaska: "Alaska", Arizona: "Ariz.", Arkansas: "Ark.", California: "Cal.", Colorado: "Colo.",
  Connecticut: "Conn.", Florida: "Fla.", Idaho: "Idaho", Kansas: "Kan.", Michigan: "Mich.", Minnesota: "Minn.",
  Montana: "Mont.", Nebraska: "Neb.", Nevada: "Nev.", "New Mexico": "N.M.", "New York": "N.Y.",
  "North Dakota": "N.D.", Oklahoma: "Okla.", Oregon: "Or.", "South Dakota": "S.D.", Utah: "Utah",
  Washington: "Wash.", Wisconsin: "Wis.", Wyoming: "Wyo.",
};
const COURTS = [
  [/^Supreme Court of the United States$/, () => ""],
  [/^(?:United States|U\.S\.) Court of Appeals for the (.+?) Circuit$/i, (name) => {
    const ordinal = ORDINALS[name.toLowerCase()];
    return ordinal ? `${ordinal} Cir.` : null;
  }],
  [/^United States Court of Federal Claims$/, () => "Fed. Cl."],
  [/^United States Court of Claims$/, () => "Ct. Cl."],
  [/^(?:United States|U\.S\.) District Court for the District of (.+)$/, (state) => (STATES[state] ? `D. ${STATES[state]}` : null)],
  [/^(?:United States|U\.S\.) District Court for the (Northern|Southern|Eastern|Western|Central|Middle) District of (.+)$/,
    (part, state) => (STATES[state] ? `${part[0]}.D. ${STATES[state]}` : null)],
  [/^U\.S\. District Court, ([NSEWCM])\.D\. (.+)$/, (part, state) => (STATES[state] ? `${part}.D. ${STATES[state]}` : null)],
  [/^Supreme Court of (Alaska|Wisconsin|Montana|Washington|Arizona|New Mexico|Oklahoma|Minnesota|Idaho|Nevada|California)$/,
    (state) => STATES[state]],
  [/^(Oklahoma|Alaska|Wisconsin|Montana|Washington|Arizona|New Mexico) Supreme Court$/, (state) => STATES[state]],
  [/^Supreme Court of Guam$/, () => "Guam"],
  [/^Supreme Court of the Virgin Islands$/, () => "V.I."],
  [/^Supreme Court of the Commonwealth of the Northern Mariana Islands$/, () => "N. Mar. I."],
];

export function courtAbbreviation(authority, item = {}) {
  if (typeof authority !== "string") return authority;
  for (const [pattern, abbreviate] of COURTS) {
    const match = pattern.exec(authority.trim());
    if (!match) continue;
    const short = abbreviate(...match.slice(1));
    if (short === "" && item["container-title"] !== "U.S.") return authority;
    if (short !== null && short !== undefined) return short;
  }
  return authority;
}

function caseItem(citation) {
  const item = { ...citation };
  const authority = courtAbbreviation(item.authority, item);
  if (authority) item.authority = authority;
  else delete item.authority;
  // A docket number reads "No. 2017-1620" (Indigo Book R10.1.6).
  if (typeof item.number === "string" && /^\d/.test(item.number.trim())) item.number = `No. ${item.number.trim()}`;
  return item;
}

// Source records (content/sources/*.yaml) to CSL-JSON items keyed by id.
export function citationItems(sources) {
  const items = {};
  for (const source of sources) {
    const citation = source.citation && source.citation.type === "legal_case" ? caseItem(source.citation) : source.citation;
    items[source.key] = { ...citation, id: source.key };
  }
  return items;
}

export class CitationEngine {
  constructor(items, { style = fs.readFileSync(STYLE_FILE, "utf8"), locale = fs.readFileSync(LOCALE_FILE, "utf8") } = {}) {
    registerTypstFormat();
    this.items = {};
    for (const [key, item] of Object.entries(items)) {
      this.items[key] = item.section === undefined ? item : { ...item, section: normalizeSection(item.section) };
    }
    this.style = style;
    this.locale = locale;
    this.startChapter();
  }

  startChapter() {
    const system = {
      retrieveLocale: () => this.locale,
      retrieveItem: (id) => {
        if (!this.items[id]) throw new Error(`No source record for citation key "${id}"`);
        return this.items[id];
      },
    };
    this.engine = new CSL.Engine(system, this.style, "en-US");
    this.engine.setOutputFormat("typst");
    this.clusters = [];
    this.output = new Map();
  }

  // Formats one citation cluster in footnote noteIndex. Returns the cluster's
  // id; the final text is read with text(id) once the chapter is done, because
  // a later citation can change an earlier one (for example, to disambiguate).
  cite(references, noteIndex) {
    const citation = {
      citationID: `citation-${this.clusters.length + 1}`,
      citationItems: references.map(({ key, pinpoint }) => ({ id: key, ...parsePinpoint(pinpoint) })),
      properties: { noteIndex },
    };
    const previous = this.clusters.map((cluster) => [cluster.citationID, cluster.noteIndex]);
    const [status, updates] = this.engine.processCitationCluster(citation, previous, []);
    if (status.citation_errors && status.citation_errors.length) {
      throw new Error(`Citation error: ${JSON.stringify(status.citation_errors)}`);
    }
    this.clusters.push({ citationID: citation.citationID, noteIndex });
    for (const [index, text] of updates) this.output.set(this.clusters[index].citationID, text);
    return citation.citationID;
  }

  // A citation printed on its own, outside the chapter's run of notes: the
  // heading of a case block, or the source line under a quotation. Always the
  // full form, and it does not change the short forms of later notes.
  standalone(references) {
    const engine = new CSL.Engine(
      { retrieveLocale: () => this.locale, retrieveItem: (id) => {
        if (!this.items[id]) throw new Error(`No source record for citation key "${id}"`);
        return this.items[id];
      } },
      this.style,
      "en-US",
    );
    engine.setOutputFormat("typst");
    const citation = {
      citationID: "standalone",
      citationItems: references.map(({ key, pinpoint }) => ({ id: key, ...parsePinpoint(pinpoint) })),
      properties: { noteIndex: 1 },
    };
    const [, updates] = engine.processCitationCluster(citation, [], []);
    const text = updates.length ? updates[0][1] : "";
    if (!text || /CSL STYLE ERROR/.test(text)) throw new Error(`Citation of ${JSON.stringify(references)} has no printed form`);
    return separateCalls(text).replace(/\\\.$/, "");
  }

  text(citationID) {
    const text = this.output.get(citationID);
    if (!text || /CSL STYLE ERROR/.test(text)) {
      throw new Error(`Citation ${citationID} has no printed form: ${JSON.stringify(text)}`);
    }
    return separateCalls(text);
  }
}
