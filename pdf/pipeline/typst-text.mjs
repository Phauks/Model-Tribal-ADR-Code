// Escaping text for Typst markup.
//
// Every character that can start markup, a shorthand or an embedded
// expression is escaped with a backslash, so text from content files is
// always printed exactly as written:
//   \ # * _ ` $ < > @ [ ] ~ / " ' - . = + ( ;
// "-" and "." stop the "--", "---", "-?" and "..." shorthands; "/" stops
// comments and automatic links; quotes are already curly from markdown-it,
// so the escaped straight quotes stay straight; "(" stops a preceding
// function call such as #emph[...] from reading the text as arguments, and
// ";" right after such a call would end it and vanish from the page.

const SPECIAL = /[\\#*_`$<>@[\]~/"'\-.=+(;]/g;

export function escapeTypst(text) {
  return bindEllipses(text).replace(SPECIAL, (character) => "\\" + character);
}

// An ellipsis is three spaced periods (Indigo Book R8.3.1), and a line
// must never break inside one or between it and the word before it or the
// closing period after it ("knowledge . . . ."). No-break spaces hold it
// together.
export function bindEllipses(text) {
  return text.replace(/ ?\. \. \.(?: [.?!])?/g, (ellipsis) => ellipsis.replace(/ /g, "\u00a0"));
}

// A Typst string literal, for function arguments such as link targets.
export function typstString(text) {
  return JSON.stringify(text);
}

// After a function call written as #name[...], an unescaped "(" or "["
// would continue the call, and an unescaped ";" would end it and vanish.
// Text from citeproc's affixes is not always escaped, so escape those
// characters wherever they follow "]".
export function separateCalls(markup) {
  return markup.replace(/\]([([;])/g, "]\\$1");
}
