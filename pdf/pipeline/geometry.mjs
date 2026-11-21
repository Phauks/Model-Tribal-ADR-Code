// Page geometry for the print interior, in inches. Pure functions: every
// value comes from book-sizes.yaml, the chosen trim and the page count.

const POINTS_PER_INCH = 72;
const round = (value) => Math.round(value * 10000) / 10000;

// Lulu's recommended total inside margin for a page count
// (Book Creation Guide, p. 9; rows in book-sizes.yaml).
export function insideMarginForPageCount(pageCount, rows) {
  for (const row of rows) {
    if (row.most_pages === null || pageCount <= row.most_pages) return row.inches;
  }
  throw new Error("inside_margin_by_page_count needs a last row with most_pages: null");
}

// Paperback spine width in inches (Book Creation Guide, p. 13).
export function spineWidth(pageCount, spine) {
  return round(pageCount / spine.pages_per_inch + spine.added_inches);
}

// Height of a line of type, as a share of the font size, used to keep the
// running head and the folio inside the safety margin (project choice:
// Atkinson Hyperlegible Next's ascender plus descender is under 1.25 em).
const LINE_BOX = 1.25;
const HEAD_RULE_GAP_POINTS = 4;

export function computeLayout(sizes, trimKey, pageCount) {
  const trim = sizes.trims[trimKey];
  if (!trim) {
    throw new Error(`Unknown trim "${trimKey}". Choose one of: ${Object.keys(sizes.trims).join(", ")}`);
  }
  const scale = sizes.type_scales[trim.type_scale];
  if (!scale) throw new Error(`Trim "${trimKey}" names unknown type scale "${trim.type_scale}"`);
  const safety = sizes.safety_margin;

  // Running head above the text block, folio below it on chapter openers.
  const headGap = 0.22;
  const footGap = 0.22;
  const headHeight = (scale.running_head * LINE_BOX + HEAD_RULE_GAP_POINTS) / POINTS_PER_INCH;
  const folioHeight = (scale.running_head * LINE_BOX) / POINTS_PER_INCH;

  const top = Math.max(scale.top, safety + headHeight + headGap);
  const bottom = Math.max(scale.bottom, safety + footGap + folioHeight);
  // Side margins leave room for hanging punctuation outside the safety margin.
  const sideMinimum = safety + sizes.overhang_allowance;
  const insideMinimum = Math.max(insideMarginForPageCount(pageCount, sizes.inside_margin_by_page_count), sideMinimum);
  let outside = Math.max(scale.outside, sideMinimum);

  // On wide pages the line stops at the longest comfortable length; the
  // spare width goes one third to the inside and two thirds to the outside,
  // the traditional proportion of a book's margins (project choice).
  const longestLine = (sizes.maximum_line_length_em * scale.body) / POINTS_PER_INCH;
  let inside = insideMinimum;
  const spare = trim.width - inside - outside - longestLine;
  if (spare > 0) {
    inside += spare / 3;
    outside += (2 * spare) / 3;
  }

  const bleed = sizes.bleed;
  return {
    trim: { key: trimKey, name: trim.name, width: trim.width, height: trim.height, millimeters: trim.millimeters },
    bleed,
    safety_margin: safety,
    overhang_allowance: sizes.overhang_allowance,
    page: { width: round(trim.width + 2 * bleed), height: round(trim.height + 2 * bleed) },
    // Margins measured from the trim edge.
    margins: { top: round(top), bottom: round(bottom), inside: round(inside), outside: round(outside) },
    text: { width: round(trim.width - inside - outside), height: round(trim.height - top - bottom) },
    characters_per_line: Math.round(((trim.width - inside - outside) * POINTS_PER_INCH) / (scale.body * sizes.average_character_em)),
    head_gap: headGap,
    foot_gap: footGap,
    head_height: round(headHeight),
    folio_height: round(folioHeight),
    type: { ...scale },
    page_count: pageCount,
  };
}

// Every printed element must sit inside the safety margin
// (Book Creation Guide, pp. 8 and 23). Returns a list of problems.
export function safetyProblems(layout) {
  const problems = [];
  const { margins, safety_margin: safety } = layout;
  const headTop = margins.top - layout.head_gap - layout.head_height;
  const folioBottom = margins.bottom - layout.foot_gap - layout.folio_height;
  if (headTop < safety - 1e-9) problems.push(`running head starts ${headTop.toFixed(3)} in from the trim`);
  if (folioBottom < safety - 1e-9) problems.push(`folio ends ${folioBottom.toFixed(3)} in from the trim`);
  for (const side of ["inside", "outside"]) {
    if (margins[side] < safety - 1e-9) problems.push(`${side} margin ${margins[side]} in is inside the safety margin`);
  }
  if (layout.text.width <= 0 || layout.text.height <= 0) problems.push("no room left for the text block");
  return problems;
}

// What the cover designer needs, and what Lulu will check, for a page count.
export function printReport(sizes, book, layout) {
  const trim = sizes.trims[layout.trim.key];
  const pages = layout.page_count;
  const spine = spineWidth(pages, sizes.spine);
  const warnings = [];
  if (pages < sizes.page_count.minimum || pages > sizes.page_count.maximum) {
    warnings.push(
      `${pages} pages is outside the ${sizes.page_count.minimum} to ${sizes.page_count.maximum} pages Lulu distributes for this format (Eligible Products, pp. 3-9).`,
    );
  }
  if (layout.characters_per_line < sizes.minimum_line_characters) {
    warnings.push(
      `Lines hold about ${layout.characters_per_line} characters, fewer than ${sizes.minimum_line_characters}: consider a wider size.`,
    );
  }
  const excludedPapers = trim.excluded_papers || {};
  for (const [channel, papers] of Object.entries(excludedPapers)) {
    if (papers.includes(book.paper)) {
      warnings.push(`${trim.name} on ${book.paper} paper is excluded from ${channel} (Eligible Products).`);
    }
  }
  for (const channel of trim.excluded_channels || []) {
    warnings.push(`${trim.name} paperback with standard black-and-white ink is excluded from ${channel} (Eligible Products, p. 8).`);
  }
  if (!book.metadata.isbn) {
    warnings.push("No ISBN yet: the copyright page shows a placeholder. Retail distribution needs one (Retail Distribution Guide, pp. 10 and 13).");
  }
  return {
    trim: layout.trim,
    paper: book.paper,
    page_count: pages,
    page_size_inches: layout.page,
    margins_from_trim_inches: layout.margins,
    text_block_inches: layout.text,
    body_size_points: layout.type.body,
    characters_per_line: layout.characters_per_line,
    spine_width_inches: spine,
    spine_text_allowed: pages >= sizes.spine.text_minimum_pages,
    cover_size_inches: {
      width: round(2 * layout.trim.width + spine + 2 * layout.bleed),
      height: round(layout.trim.height + 2 * layout.bleed),
      note: "Estimate from Lulu's formula. Use the cover template Lulu generates from the uploaded interior.",
    },
    warnings,
  };
}
