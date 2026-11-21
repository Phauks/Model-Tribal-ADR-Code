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
// "n. 4". A pinpoint with no label, such as "(2)", is a page in CSL terms;
// for a section of a code it is printed joined to the section number.
const LABELS = [
  [/^(?:pp?\.|pages?|at)\s+/i, "page"],
  [/^(?:§§?|secs?\.|sections?)\s*/i, "section"],
  [/^(?:¶¶?|paras?\.|paragraphs?)\s*/i, "paragraph"],
  [/^(?:ch(?:ap)?\.|chapters?)\s+/i, "chapter"],
  [/^(?:nn?\.|notes?)\s+/i, "note"],
];

export function parsePinpoint(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return {};
  for (const [pattern, label] of LABELS) {
    if (pattern.test(trimmed)) return { label, locator: trimmed.replace(pattern, "") };
  }
  return { label: "page", locator: trimmed };
}

// Source records (content/sources/*.yaml) to CSL-JSON items keyed by id.
export function citationItems(sources) {
  const items = {};
  for (const source of sources) items[source.key] = { ...source.citation, id: source.key };
  return items;
}

export class CitationEngine {
  constructor(items, { style = fs.readFileSync(STYLE_FILE, "utf8"), locale = fs.readFileSync(LOCALE_FILE, "utf8") } = {}) {
    registerTypstFormat();
    this.items = items;
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

  text(citationID) {
    const text = this.output.get(citationID);
    if (!text || /CSL STYLE ERROR/.test(text)) {
      throw new Error(`Citation ${citationID} has no printed form: ${JSON.stringify(text)}`);
    }
    return separateCalls(text);
  }
}
