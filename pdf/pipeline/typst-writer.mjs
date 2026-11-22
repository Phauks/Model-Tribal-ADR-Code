// Turns parsed Markdown into Typst markup that calls the functions in
// typst/book.typ. One ChapterWriter handles one chapter, so that footnote
// numbers and citation short forms restart with each chapter.

import { escapeTypst, separateCalls, typstString } from "./typst-text.mjs";

// Kinds of document, which change how headings and paragraphs print.
export const KINDS = { provision: "provision", commentary: "commentary", essay: "essay", glossary: "glossary" };

// Nest markdown-it's flat token list into a tree of blocks.
function blockTree(tokens) {
  const root = { children: [] };
  const stack = [root];
  for (const token of tokens) {
    const parent = stack[stack.length - 1];
    if (token.nesting === 1) {
      const node = { type: token.type.replace(/_open$/, ""), token, children: [] };
      parent.children.push(node);
      stack.push(node);
    } else if (token.nesting === -1) {
      stack.pop();
    } else {
      parent.children.push({ type: token.type, token, children: [] });
    }
  }
  return root.children;
}

// Subsection labels at the start of a provision paragraph:
// (a) level 1, (1) level 2, (A) level 3, (ii) level 4.
const ROMAN = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/;
export function subsectionLevel(text, previousLevel) {
  const match = /^\(([a-zA-Z]{1,4}|\d{1,3})\)\s/.exec(text);
  if (!match) return null;
  const label = match[1];
  if (/^\d+$/.test(label)) return 2;
  if (/^[A-Z]+$/.test(label)) return 3;
  if (ROMAN.test(label) && (label.length > 1 || previousLevel >= 3)) return 4;
  return 1;
}

// The words an acronym stands for print capitalized beside it, "Alternative
// Dispute Resolution (ADR)" (lead author, Nov. 22, 2026). Short joining words
// stay lowercase unless they come first.
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);
export function titleCase(text) {
  return text
    .split(" ")
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// The facts a case block lists under its heading, from the source record:
// the nations the case concerns, and for a Supreme Court case the Court,
// the vote and each justice's part (lead author, Nov. 22, 2026).
// What each justice wrote, as it reads after the justice's name. A justice
// listed with no label joined the side's opinion without writing.
const OPINION_LABELS = {
  majority: "opinion of the Court",
  plurality: "plurality opinion",
  concurrence: "concurring opinion",
  "special concurrence": "opinion concurring in the judgment",
  "concurrence in the result": "concurring in the result",
  judgment: "opinion announcing the judgment",
  dissent: "dissenting opinion",
};
// Decisions with no signed opinion of the Court, shown as their own line.
const DECISION_LABELS = { "per curiam": "Per curiam", "equally divided Court": "Affirmed by an equally divided Court", "judgment of the Court": "No opinion for a majority" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function surname(name) {
  const plain = name.replace(/,?\s+(?:Jr\.|Sr\.|II|III)$/, "").trim();
  return plain.split(/\s+/).pop();
}
// Typst markup: a justice who wrote is set in bold with the opinion named.
function justiceList(justices) {
  return justices
    .map((justice) => {
      const label = justice.opinion ? OPINION_LABELS[justice.opinion] || justice.opinion : null;
      const name = escapeTypst(surname(justice.name));
      return label ? `#strong[${name}] (${escapeTypst(label)})` : name;
    })
    .join(", ");
}
/** The full decision date of a case record, such as "March 18, 1831", or null. */
export function decisionDate(record) {
  const parts = record?.citation?.issued?.["date-parts"]?.[0] || [];
  if (parts.length < 3) return null;
  return `${MONTHS[parts[1] - 1]} ${parts[2]}, ${parts[0]}`;
}

/**
 * The lines under a case box's heading, as a Typst array of (label, [value]):
 * when it was decided, the nations or peoples it concerns, and for the
 * Supreme Court of the United States the Court, the vote and who wrote and
 * joined what.
 */
export function caseFacts(record, nationNames = new Map(), peopleIds = new Set()) {
  const facts = [];
  const text = (label, value) => facts.push([label, escapeTypst(value)]);
  const decided = decisionDate(record);
  if (decided) text("Decided", decided);
  if (record && Array.isArray(record.tribes) && record.tribes.length) {
    const names = record.tribes.map((id) => nationNames.get(id) || id);
    const peoples = record.tribes.filter((id) => peopleIds.has(id)).length;
    const plural = names.length > 1;
    const label = peoples === 0 ? (plural ? "Nations" : "Nation") : peoples === names.length ? (plural ? "Peoples" : "People") : "Nations and peoples";
    text(label, names.join("; "));
  }
  const bench = record && record.supreme_court;
  if (bench) {
    text("Court", bench.court);
    const { majority, minority } = bench.vote || {};
    if (Number.isInteger(majority) && Number.isInteger(minority)) text("Vote", `${majority}–${minority}`);
    if (DECISION_LABELS[bench.decision_type]) text("Decision", DECISION_LABELS[bench.decision_type]);
    const justices = bench.justices || [];
    const inMajority = justices.filter((justice) => justice.vote === "majority");
    const inMinority = justices.filter((justice) => justice.vote === "minority");
    const unrecorded = justices.filter((justice) => justice.vote === "not recorded");
    const absent = justices.filter((justice) => !["majority", "minority", "not recorded"].includes(justice.vote));
    // Opinion writers first: the opinion of the Court, then other opinions,
    // then the justices who joined without writing.
    const leads = (justice) => ["majority", "plurality", "judgment"].includes(justice.opinion);
    const writersFirst = (list) => [...list.filter(leads), ...list.filter((justice) => justice.opinion && !leads(justice)), ...list.filter((justice) => !justice.opinion)];
    if (inMajority.length) facts.push(["Majority", justiceList(writersFirst(inMajority))]);
    if (inMinority.length) facts.push(["Dissent", justiceList(writersFirst(inMinority))]);
    if (unrecorded.length) facts.push(["Vote not recorded", justiceList(unrecorded)]);
    if (absent.length) facts.push(["Did not participate", justiceList(absent)]);
  }
  if (!facts.length) return "()";
  return `(${facts.map(([label, value]) => `(${typstString(label)}, [${value}])`).join(", ")},)`;
}

/** The lines under a law box's heading: the nations or peoples it names. */
export function lawFacts(record, nationNames = new Map(), peopleIds = new Set()) {
  return caseFacts(record ? { tribes: record.tribes } : record, nationNames, peopleIds);
}

// About as many characters as fill a page in a narrow table column.
const LONG_ROW_CHARACTERS = 900;

// A paragraph that is nothing but a citation names the source of the
// quotation above it. No dash is used (lead author, Nov. 22, 2026). A quote
// from a separate opinion adds its Indigo Book parenthetical after the
// citation: [@key, p. 17] (Gorsuch, J., dissenting).
function isAttribution(inline) {
  return /^\[@[^\]]+\](?:\s+\([^()]+\))?$/.test((inline.content || "").trim());
}

export class ChapterWriter {
  constructor({ citations, glossary, printedGlossaryIds, notes = "footnotes", chapterIndex = 0, sourceRecords = new Map(), nationNames = new Map(), peopleIds = new Set(), boxedKeys = new Set() }) {
    this.citations = citations;
    this.sourceRecords = sourceRecords;
    this.nationNames = nationNames;
    this.peopleIds = peopleIds;
    this.boxedKeys = boxedKeys;
    this.endnotes = notes === "endnotes" ? [] : null;
    this.chapterIndex = chapterIndex;
    this.glossary = glossary;
    this.printedGlossaryIds = printedGlossaryIds;
    this.citations.startChapter();
    this.noteNumber = 0;
    this.expandedAcronyms = new Set();
  }

  // First pass, in reading order: give every footnote its number and send
  // every citation to citeproc with the number of the note it sits in.
  numberNotes(document) {
    for (const token of document.tokens) {
      if (token.type !== "inline") continue;
      // The source line under a quotation prints its citation in place.
      if (isAttribution(token)) continue;
      for (const child of token.children) {
        if (child.type === "footnote_ref") {
          this.noteNumber += 1;
          for (const inner of document.footnotes.get(child.meta.id) || []) {
            if (inner.type === "citation") inner.meta.citationID = this.citations.cite(inner.meta.references, this.noteNumber);
          }
        } else if (child.type === "citation") {
          this.noteNumber += 1;
          child.meta.citationID = this.citations.cite(child.meta.references, this.noteNumber);
        }
      }
    }
  }

  // Second pass: write Typst.
  write(document) {
    this.document = document;
    this.previousLevel = 0;
    this.commentaryPart = null;
    const markup = this.blocks(blockTree(document.tokens));
    return document.kind === KINDS.essay ? `#essay-body[${markup}]` : markup;
  }

  blocks(nodes) {
    return nodes.map((node) => this.block(node)).filter((text) => text !== "").join("\n\n");
  }

  block(node) {
    const { token } = node;
    switch (node.type) {
      case "paragraph":
        return this.paragraph(node);
      case "heading":
        return this.heading(node);
      case "bullet_list":
        return `#list(tight: ${!!this.isTight(node)}, ${node.children.map((item) => this.item(item)).join(", ")})`;
      case "ordered_list": {
        const start = Number(token.attrGet("start") || 1);
        const items = node.children.map((item) => this.item(item)).join(", ");
        if (this.document.kind === KINDS.commentary && this.commentaryPart === "illustrations") {
          return `#illustrations(${start}, ${items})`;
        }
        return `#enum(start: ${start}, tight: ${!!this.isTight(node)}, ${items})`;
      }
      case "blockquote":
      case "container_quote":
        return `#quote-block[${this.blocks(node.children)}]`;
      case "container_case":
      case "container_law": {
        const key = token.info.trim().split(/\s+/)[1];
        const heading = this.citations.standalone([{ key }]);
        const record = this.sourceRecords.get(key);
        // The first box for a case carries a label, so an index can point to its page.
        let label = "";
        if (node.type === "container_case" && !this.boxedKeys.has(key)) {
          this.boxedKeys.add(key);
          label = ` <case-${key}>`;
        }
        const facts = node.type === "container_case" ? caseFacts(record, this.nationNames, this.peopleIds) : lawFacts(record, this.nationNames, this.peopleIds);
        const kind = node.type === "container_case" ? "case-block" : "law-block";
        return `#${kind}([${heading}], ${facts})[${this.blocks(node.children)}]${label}`;
      }
      case "container_background":
        return `#case-part("Background")[${this.blocks(node.children)}]`;
      case "container_question":
        return `#case-part("Question")[${this.blocks(node.children)}]`;
      case "container_holding":
        return `#case-part("Holding")[${this.blocks(node.children)}]`;
      case "container_summary":
        return `#case-part("What it does")[${this.blocks(node.children)}]`;
      case "container_quotes":
        return `#case-part("Quotes")[${this.blocks(node.children)}]`;
      case "container_treatment":
        return `#case-part("Treatment")[${this.blocks(node.children)}]`;
      case "container_topics":
        return `#case-part("Topics")[${this.blocks(node.children)}]`;
      case "container_analysis": {
        // The title names what the box analyzes; a case name in it is written in *italics*.
        const title = token.info.trim().replace(/^analysis\s*/, "");
        const shown = title
          .replaceAll("'", "’")
          .split(/(\*[^*]+\*)/)
          .map((piece) => (/^\*[^*]+\*$/.test(piece) ? `#emph[${escapeTypst(piece.slice(1, -1))}]` : escapeTypst(piece)))
          .join("");
        return `#analysis-block(${title ? `[${separateCalls(shown)}]` : "none"})[${this.blocks(node.children)}]`;
      }
      case "container_alternative": {
        const letter = token.info.trim().split(/\s+/)[1];
        const alternative = (this.document.data.alternatives || []).find((entry) => entry.id === letter);
        const label = alternative ? `[${escapeTypst(alternative.label)}]` : "none";
        return `#alternative(${typstString(letter)}, ${label})[${this.blocks(node.children)}]`;
      }
      case "table":
        return this.table(node);
      case "fence":
      case "code_block":
        return `#raw(block: true, ${typstString(token.content)})`;
      case "hr":
        return `#align(center, line(length: 30%, stroke: 0.5pt + black))`;
      default:
        throw new Error(`${this.document.file}: Markdown "${node.type}" is not supported in the print edition`);
    }
  }

  isTight(list) {
    return list.children.every((item) => item.children.every((child) => child.type !== "paragraph" || child.token.hidden));
  }

  item(node) {
    return `[${this.blocks(node.children)}]`;
  }

  paragraph(node) {
    const inline = node.children[0].token;
    if (isAttribution(inline)) return `#attribution[${this.inline(inline.children, { attribution: true })}]`;
    const text = this.inline(inline.children);
    if (node.token.hidden) return text;
    if (this.document.kind === KINDS.provision) {
      const firstText = inline.children[0] && inline.children[0].type === "text" ? inline.children[0].content : "";
      const level = subsectionLevel(firstText, this.previousLevel);
      if (level) {
        this.previousLevel = level;
        return `#subsection(${level})[${text}]`;
      }
    }
    if (this.document.kind === KINDS.commentary && this.commentaryPart === "source note") return `#source-note[${text}]`;
    return text;
  }

  heading(node) {
    const inline = node.children[0].token;
    const text = this.inline(inline.children);
    const plain = inline.children.map((child) => child.content || "").join("").trim().toLowerCase();
    if (this.document.kind === KINDS.commentary) {
      this.commentaryPart = plain;
      return `#commentary-heading[${text}]`;
    }
    if (this.document.kind === KINDS.essay && node.token.tag === "h2") return `#heading(level: 3)[${text}]`;
    return `#commentary-heading[${text}]`;
  }

  table(node) {
    const rows = [];
    let headerCells = null;
    for (const section of node.children) {
      for (const row of section.children) {
        const cells = row.children.map((cell) => `[${this.inline(cell.children[0] ? cell.children[0].token.children : [])}]`);
        if (section.type === "thead") headerCells = cells;
        else rows.push(cells.join(", "));
      }
    }
    if (!headerCells) throw new Error(`${this.document.file}: tables need a header row`);
    // A row whose text could not fit on one page may break across pages.
    const longRows = rows.some((row) => row.replace(/#[a-z-]+\[|[\[\]]/g, "").length > LONG_ROW_CHARACTERS);
    return `#law-table(${headerCells.length}, (${headerCells.join(", ")},), long-rows: ${longRows}, ${rows.join(",\n  ")})`;
  }

  inline(children, { inNote = false, attribution = false } = {}) {
    let out = "";
    for (let index = 0; index < children.length; index++) {
      const token = children[index];
      const next = children[index + 1];
      switch (token.type) {
        case "text":
          out += escapeTypst(token.content);
          break;
        case "softbreak":
          out += " ";
          break;
        case "hardbreak":
          out += "#linebreak()";
          break;
        case "strong_open":
          out += "#strong[";
          break;
        case "em_open":
          out += "#emph[";
          break;
        case "s_open":
          out += "#strike[";
          break;
        case "strong_close":
        case "em_close":
        case "s_close":
        case "link_close":
          out += "]";
          break;
        case "code_inline":
          out += `#raw(${typstString(token.content)})`;
          break;
        case "link_open": {
          // "#case-KEY" points to a case box elsewhere in the book, and prints its page.
          const href = token.attrGet("href") || "";
          const caseLink = /^#(case-[a-z0-9-]+)$/.exec(href);
          out += caseLink ? `#case-ref(<${caseLink[1]}>)[` : `#link(${typstString(href)})[`;
          break;
        }
        case "footnote_ref": {
          const body = this.document.footnotes.get(token.meta.id) || [];
          out += this.note(this.inline(body, { inNote: true }));
          break;
        }
        case "citation": {
          if (attribution) {
            out += this.citations.standalone(token.meta.references);
            break;
          }
          let cluster = this.citations.text(token.meta.citationID);
          if (inNote) {
            // A citation written inside a note prints in place; avoid a double
            // stop when the note's own text supplies the punctuation.
            if (next && next.type === "text" && /^[.;,:]/.test(next.content)) {
              if (/\\\.$/.test(cluster)) cluster = cluster.slice(0, -2);
              else if (/\\\.\]$/.test(cluster) && next.content.startsWith(".")) next.content = next.content.slice(1);
            }
            out += cluster;
          } else {
            // A citation in the text becomes a footnote, placed after any
            // punctuation that follows it.
            out = out.replace(/ +$/, "");
            if (next && next.type === "text") {
              const punctuation = /^[.,;:!?]+/.exec(next.content);
              if (punctuation) {
                out += escapeTypst(punctuation[0]);
                next.content = next.content.slice(punctuation[0].length);
              }
            }
            out += this.note(cluster);
          }
          break;
        }
        case "term_link":
          out += this.termLink(token.meta);
          break;
        default:
          throw new Error(`${this.document.file}: Markdown "${token.type}" is not supported in the print edition`);
      }
    }
    return out;
  }

  // A note: at the foot of the page, or a numbered mark whose text prints
  // with the chapter's other notes at its end.
  note(body) {
    if (!this.endnotes) return `#footnote[${body}]`;
    this.endnotes.push(body);
    const number = this.endnotes.length;
    return `#endnote-mark(${number}, <endnote-${this.chapterIndex}-${number}>)`;
  }

  // The chapter's notes, for the end of the chapter; empty with footnotes.
  notesSection() {
    if (!this.endnotes || !this.endnotes.length) return "";
    const entries = this.endnotes.map((body, index) => `#endnote-entry(${index + 1})[${body}] <endnote-${this.chapterIndex}-${index + 1}>`);
    return `#endnotes-section[${entries.join("\n")}]`;
  }

  // [[id]] prints the entry's term, or the given text, linked to the glossary.
  // The first [[id]] of an acronym in each chapter prints its expansion too
  // (usage note of content/glossary/adr.yaml).
  termLink({ id, text }) {
    const entry = this.glossary.get(id);
    let shown = escapeTypst(text || entry.term);
    if (!text && entry.kind === "acronym" && entry.expansion && !this.expandedAcronyms.has(id)) {
      this.expandedAcronyms.add(id);
      shown = `${escapeTypst(titleCase(entry.expansion))} \\(${escapeTypst(entry.term)})`;
    }
    if (!this.printedGlossaryIds.has(id)) return shown;
    return `#link(<glossary-${id}>)[${shown}]`;
  }
}
