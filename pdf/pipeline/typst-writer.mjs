// Turns parsed Markdown into Typst markup that calls the functions in
// typst/book.typ. One ChapterWriter handles one chapter, so that footnote
// numbers and citation short forms restart with each chapter.

import { escapeTypst, typstString } from "./typst-text.mjs";

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

export class ChapterWriter {
  constructor({ citations, glossary, printedGlossaryIds }) {
    this.citations = citations;
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
    return this.blocks(blockTree(document.tokens));
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
        return `#quote(block: true)[${this.blocks(node.children)}]`;
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
    return `#law-table(${headerCells.length}, (${headerCells.join(", ")},), ${rows.join(",\n  ")})`;
  }

  inline(children, { inNote = false } = {}) {
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
        case "link_open":
          out += `#link(${typstString(token.attrGet("href"))})[`;
          break;
        case "footnote_ref": {
          const body = this.document.footnotes.get(token.meta.id) || [];
          out += `#footnote[${this.inline(body, { inNote: true })}]`;
          break;
        }
        case "citation": {
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
            out += `#footnote[${cluster}]`;
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

  // [[id]] prints the entry's term, or the given text, linked to the glossary.
  // The first [[id]] of an acronym in each chapter prints its expansion too
  // (usage note of content/glossary/adr.yaml).
  termLink({ id, text }) {
    const entry = this.glossary.get(id);
    let shown = escapeTypst(text || entry.term);
    if (!text && entry.kind === "acronym" && entry.expansion && !this.expandedAcronyms.has(id)) {
      this.expandedAcronyms.add(id);
      shown = `${escapeTypst(entry.expansion)} \\(${escapeTypst(entry.term)})`;
    }
    if (!this.printedGlossaryIds.has(id)) return shown;
    return `#link(<glossary-${id}>)[${shown}]`;
  }
}
