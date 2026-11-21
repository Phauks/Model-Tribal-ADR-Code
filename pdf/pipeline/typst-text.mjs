// Escaping text for Typst markup.
//
// Every character that can start markup, a shorthand or an embedded
// expression is escaped with a backslash, so text from content files is
// always printed exactly as written:
//   \ # * _ ` $ < > @ [ ] ~ / " ' - . = + (
// "-" and "." stop the "--", "---", "-?" and "..." shorthands; "/" stops
// comments and automatic links; quotes are already curly from markdown-it,
// so the escaped straight quotes stay straight; "(" stops a preceding
// function call such as #emph[...] from reading the text as arguments.

const SPECIAL = /[\\#*_`$<>@[\]~/"'\-.=+(]/g;

export function escapeTypst(text) {
  return text.replace(SPECIAL, (character) => "\\" + character);
}

// A Typst string literal, for function arguments such as link targets.
export function typstString(text) {
  return JSON.stringify(text);
}

// After a function call written as #name[...], an unescaped "(" or "["
// would continue the call. Text from citeproc's affixes is not always
// escaped, so escape those two characters wherever they follow "]".
export function separateCalls(markup) {
  return markup.replace(/\]([([])/g, "]\\$1");
}
