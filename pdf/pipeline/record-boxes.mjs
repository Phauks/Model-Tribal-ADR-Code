// The parts of a case or law box, kept on the source's record (`case_box`
// and `law_box` in schemas/source.schema.json; Trevor, Nov. 24, 2026). An
// essay holds only the box's place, ":::: case <key>" and "::::" with
// nothing between them, and each such place is filled with the box's parts
// as the essay syntax writes them before the essay is parsed. A box written
// out in full in an essay is left as it is. Mirrors
// site/src/lib/essays/record-boxes.ts, which does the same for the website.

const PART_ORDERS = {
  case: ["background", "question", "holding", "quotes", "treatment", "topics"],
  law: ["summary", "quotes", "treatment"],
};

/** A quotation's attribution: a citation of the source at its pinpoint, and any parenthetical. */
export function quoteAttribution(key, quote) {
  const citation = `[@${key}${quote.pinpoint ? `, ${quote.pinpoint}` : ""}]`;
  return quote.parenthetical ? `${citation} (${quote.parenthetical})` : citation;
}

/** One part of a box in the essay syntax ("::: holding" ... ":::"), or "" when the record has no such part. */
export function boxPartMarkdown(key, box, part) {
  let inner;
  if (part === "quotes") inner = box.quotes?.length ? box.quotes.map((quote) => `> ${quote.text}\n\n${quoteAttribution(key, quote)}`).join("\n\n") : undefined;
  else if (part === "topics") inner = box.topics?.length ? box.topics.join("; ") : undefined;
  else if (part === "treatment") inner = [box.treatment?.trim(), laterCasesMarkdown(box)].filter(Boolean).join("\n\n") || undefined;
  else inner = box[part]?.trim() || undefined;
  return inner ? `::: ${part}\n${inner}\n:::` : "";
}

// The kinds of treatment in the order a list shows them, most serious first (schemas/source.schema.json).
const LATER_CASE_KINDS = [
  "Overruling recognized", "Abrogation recognized", "Superseded by statute", "Called into doubt by statute", "Called into doubt",
  "Limitation of holding recognized", "Modification recognized", "Declined to follow", "Not followed as dicta",
  "Disagreement recognized", "Declined to extend", "Followed with reservations", "Distinguished",
];

const escapeMarkdown = (text) => text.replace(/([\\`*_[\]])/g, "\\$1");

/**
 * The later cases that treated the case negatively (`case_box.later_cases`;
 * Trevor, Nov. 27, 2026: name the cases rather than count them): each kind of
 * treatment as a bold line with its count, then one Indigo Book citation to a
 * line. The website links each case; the printed page does not.
 */
export function laterCasesMarkdown(box) {
  const list = box?.later_cases?.list ?? [];
  if (!list.length) return "";
  const kinds = [...new Set(list.map((item) => item.treatment))].sort((one, other) => LATER_CASE_KINDS.indexOf(one) - LATER_CASE_KINDS.indexOf(other));
  return kinds
    .map((kind) => {
      const items = list.filter((item) => item.treatment === kind);
      return `**${kind}** (${items.length})\n\n${items.map((item) => `- *${escapeMarkdown(item.name)}*, ${escapeMarkdown(item.citation)}`).join("\n")}`;
    })
    .join("\n\n");
}

/** Everything inside a box, in the essay syntax, its parts in their order. */
export function boxMarkdown(kind, key, box) {
  if (!box) return "";
  return PART_ORDERS[kind]
    .map((part) => boxPartMarkdown(key, box, part))
    .filter(Boolean)
    .join("\n\n");
}

/** A box's reading as the Analysis block that follows the box ("::: analysis Title" ... ":::"), or "". */
export function readingMarkdown(box) {
  const title = box?.reading?.title?.trim();
  const text = box?.reading?.text?.trim();
  return title && text ? `::: analysis ${title}\n${text}\n:::` : "";
}

const BOX_OPENING = /^(:{4,})[ \t]*(case|law)[ \t]+([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/;

/**
 * Markdown with each empty case or law box filled from its record, found by
 * key in `records` (a Map of source records), and the record's reading, if
 * any, placed right after the box as an Analysis block.
 */
export function fillBoxes(text, records) {
  const lines = text.split("\n");
  const filled = [];
  const after = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    filled.push(lines[index]);
    if (after.has(index)) filled.push("", ...after.get(index).split("\n"));
    const opening = BOX_OPENING.exec(lines[index]);
    if (!opening) continue;
    let next = index + 1;
    while (next < lines.length && !lines[next].trim()) next += 1;
    if (next >= lines.length || lines[next].trim() !== opening[1]) continue;
    const [, , kind, key] = opening;
    const box = records.get(key)?.[`${kind}_box`];
    const reading = readingMarkdown(box);
    if (reading) after.set(next, reading);
    const inside = boxMarkdown(kind, key, box);
    if (inside) filled.push(...inside.split("\n"));
  }
  return filled.join("\n");
}
