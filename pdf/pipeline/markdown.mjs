// The Markdown reader for content files: markdown-it with footnotes, plus
// the project's own syntax (docs/citation-style.md, docs/terminology.md,
// docs/data-model.md):
//   [@key] and [@key, pinpoint; @other]   citation, printed as a footnote
//   [[id]] and [[id|text]]                link to a glossary entry
//   {{group.name}}                        placeholder, printed as its model text
//   ```alternative A ... ```              one alternative of a provision
// Written so the website and the ebook can use the same reader later
// (decision record 0011).

import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import container from "markdown-it-container";

const KEY = "[a-z0-9]+(?:-[a-z0-9]+)*";
const CITATION = new RegExp(`^\\[(@${KEY}(?:,[^;\\]]*)?(?:;\\s*@${KEY}(?:,[^;\\]]*)?)*)\\]`);
const CITATION_PART = new RegExp(`^@(${KEY})(?:,\\s*(.*))?$`);
const TERM_LINK = new RegExp(`^\\[\\[(${KEY})(?:\\|([^\\]]+))?\\]\\]`);

function citationRule(sourceKeys) {
  return (state, silent) => {
    if (!state.src.startsWith("[@", state.pos)) return false;
    const match = CITATION.exec(state.src.slice(state.pos));
    if (!match) return false;
    const references = match[1].split(/;\s*/).map((part) => {
      const [, key, pinpoint] = CITATION_PART.exec(part.trim());
      if (!sourceKeys.has(key)) throw new Error(`Citation key "${key}" has no source record in content/sources/`);
      return { key, pinpoint: pinpoint ? pinpoint.trim() : undefined };
    });
    if (!silent) state.push("citation", "", 0).meta = { references };
    state.pos += match[0].length;
    return true;
  };
}

function termLinkRule(glossaryIds) {
  return (state, silent) => {
    if (!state.src.startsWith("[[", state.pos)) return false;
    const match = TERM_LINK.exec(state.src.slice(state.pos));
    if (!match) return false;
    if (!glossaryIds.has(match[1])) throw new Error(`Glossary link [[${match[1]}]] has no entry in content/glossary/`);
    if (!silent) state.push("term_link", "", 0).meta = { id: match[1], text: match[2] };
    state.pos += match[0].length;
    return true;
  };
}

export function createMarkdown({ sourceKeys, glossaryIds }) {
  // typographer gives curly quotes. Its "replacements" rule stays off: it
  // turns the subsection label "(c)" into "©" (decision record 0005).
  const markdown = new MarkdownIt({ html: false, typographer: true, linkify: false })
    .use(footnote)
    .use(container, "alternative", { validate: (info) => /^alternative\s+[A-Z]$/.test(info.trim()) })
    // Essay blocks, shared with the website's essay pages: a case (":::: case
    // KEY", holding text, then "::: quotes" and "::: treatment" parts, closed
    // by "::::"), a quotation ("::: quote") and the author's own analysis
    // ("::: analysis" with an optional title). A paragraph that begins with an
    // em dash inside a quotation names its source.
    .use(container, "case", { validate: (info) => /^case\s+[a-z0-9-]+$/.test(info.trim()) })
    .use(container, "law", { validate: (info) => /^law\s+[a-z0-9-]+$/.test(info.trim()) })
    .use(container, "background", { validate: (info) => info.trim() === "background" })
    .use(container, "question", { validate: (info) => info.trim() === "question" })
    .use(container, "holding", { validate: (info) => info.trim() === "holding" })
    .use(container, "summary", { validate: (info) => info.trim() === "summary" })
    .use(container, "quotes", { validate: (info) => info.trim() === "quotes" })
    .use(container, "treatment", { validate: (info) => info.trim() === "treatment" })
    .use(container, "quote", { validate: (info) => info.trim() === "quote" })
    .use(container, "analysis", { validate: (info) => /^analysis(?:\s+.+)?$/.test(info.trim()) });
  markdown.disable("replacements");
  markdown.inline.ruler.before("link", "term_link", termLinkRule(glossaryIds));
  markdown.inline.ruler.before("link", "citation", citationRule(sourceKeys));
  return markdown;
}

// Text changes made before parsing: placeholders become their model text,
// "§ " keeps its number on the same line, and alternative fences become
// containers so their text is read as Markdown.
export function prepareSource(text, variables) {
  return text
    .replace(/<!--[\s\S]*?-->\n?/g, "")
    .replace(/^```alternative ([A-Z])[ \t]*\n([\s\S]*?)^```[ \t]*$/gm, "::: alternative $1\n$2:::")
    .replace(/\{\{\s*([a-z]+(?:\.[a-z_]+)+)\s*\}\}/g, (placeholder, name) => {
      if (!variables[name]) throw new Error(`Placeholder ${placeholder} is not defined in content/variables/`);
      return variables[name].model;
    })
    .replace(/§ /g, "§ ");
}

// Parses one Markdown text. Returns the body tokens and the footnote bodies
// (inline tokens by footnote id), with the footnote block removed.
export function parseMarkdown(markdown, text, variables) {
  const environment = {};
  const tokens = markdown.parse(prepareSource(text, variables), environment);
  const blockStart = tokens.findIndex((token) => token.type === "footnote_block_open");
  const footnotes = new Map();
  let current = null;
  for (const token of blockStart >= 0 ? tokens.slice(blockStart) : []) {
    if (token.type === "footnote_open") {
      current = token.meta.id;
      footnotes.set(current, []);
    } else if (token.type === "inline" && current !== null) {
      footnotes.get(current).push(...token.children);
    } else if (token.type === "footnote_close") {
      current = null;
    }
  }
  return { tokens: blockStart >= 0 ? tokens.slice(0, blockStart) : tokens, footnotes };
}
