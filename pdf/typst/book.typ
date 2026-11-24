// Print interior template. Every size, margin and type size comes from the
// layout that pipeline/build.mjs computes from book.yaml and book-sizes.yaml;
// nothing here depends on a particular trim size.
//
// Page numbering: one arabic sequence from the first page. Front matter pages
// carry no printed number but are counted, so no number is skipped or
// repeated and the contents match the pages (Lulu, Retail Distribution
// Guide, p. 11).

#let fonts = (
  "Atkinson Hyperlegible Next",
  // Fallbacks for characters Atkinson Hyperlegible Next lacks, such as
  // ʻokina, ʷ and ʔ in Native-language names, and whole scripts.
  "Noto Sans",
  "Noto Sans Cherokee",
  "Noto Sans Canadian Aboriginal",
)

// Section title shown in the running head of recto pages.
#let running-section = state("running-section", none)

// A running head stays on one line: a title too long for the measure is set
// smaller until it fits, so a long heading never pushes the head toward the
// trim at small sizes. A title that would need less than 70 percent of the
// running-head size is cut at the edge instead.
#let one-line(body) = layout(region => {
  let natural = measure(body).width
  if natural <= region.width { return body }
  let factor = calc.max(region.width / natural, 0.7)
  box(width: region.width, clip: true, outset: (bottom: 0.3em), text(size: factor * 1em, body))
})

#let page-has(label-name, page-number) = query(label-name).any(found => found.location().page() == page-number)

// Start the next item on a right-hand (odd) page. A page left empty for that
// lies between the two markers and prints no running head and no number.
#let recto-start() = {
  [#metadata("before") <recto-before>]
  pagebreak(weak: true, to: "odd")
  [#metadata("after") <recto-after>]
}

#let is-blank(page-number) = {
  let befores = query(<recto-before>)
  let afters = query(<recto-after>)
  range(calc.min(befores.len(), afters.len())).any(index => (
    befores.at(index).location().page() < page-number and afters.at(index).location().page() > page-number
  ))
}

// Small capitals for citations. Atkinson Hyperlegible Next has no small
// capital glyphs, so lowercase letters are printed as reduced capitals.
#let small-capitals(body) = {
  show regex("\p{Ll}+"): found => text(size: 0.8em, upper(found))
  body
}

#let book(layout: none, body) = {
  let inches(value) = value * 1in
  let type = layout.type
  let bleed = inches(layout.bleed)
  let details = layout.metadata

  set document(
    title: details.full_title,
    author: details.author,
    keywords: details.keywords,
    date: none,
  )
  set text(
    font: fonts,
    fallback: false,
    size: type.body * 1pt,
    lang: details.language,
    fill: black,
    hyphenate: auto,
  )
  set par(justify: true, leading: type.line_spacing * 1em, spacing: 0.9em)
  show raw: set text(font: fonts, size: 0.95em)
  show link: it => it

  set page(
    width: inches(layout.page.width),
    height: inches(layout.page.height),
    binding: left,
    margin: (
      top: inches(layout.margins.top) + bleed,
      bottom: inches(layout.margins.bottom) + bleed,
      inside: inches(layout.margins.inside) + bleed,
      outside: inches(layout.margins.outside) + bleed,
    ),
    header-ascent: inches(layout.head_gap),
    footer-descent: inches(layout.foot_gap),
    header: context {
      let number = here().page()
      if is-blank(number) or page-has(<no-folio>, number) or page-has(<no-header>, number) { return }
      set text(size: type.running_head * 1pt)
      set par(justify: false)
      let folio = strong(counter(page).display())
      if calc.even(number) {
        let chapters = query(heading.where(level: 2).before(here()))
        let chapter = if chapters.len() > 0 { chapters.last().body } else { [] }
        grid(columns: (auto, 1fr), column-gutter: 1em, folio, one-line(emph(chapter)))
      } else {
        let on-page = query(heading.where(level: 3)).filter(found => found.location().page() == number)
        let section = if on-page.len() > 0 { on-page.first().body } else { running-section.get() }
        if section == none {
          let chapters = query(heading.where(level: 2).before(here()))
          section = if chapters.len() > 0 { chapters.last().body } else { [] }
        }
        grid(columns: (1fr, auto), column-gutter: 1em, align(right, one-line(section)), folio)
      }
      v(-0.55em)
      line(length: 100%, stroke: 0.4pt + black)
    },
    footer: context {
      let number = here().page()
      // A box that runs onto the next page says so at the foot of the page.
      // (Decided here, not in the box's own footer, where here() is not
      // reliable inside a repeated table footer.)
      let box-pages = (:)
      for marker in query(<boxed-page>) {
        let key = str(marker.value)
        box-pages.insert(key, box-pages.at(key, default: ()) + (marker.location().page(),))
      }
      let continued = box-pages.values().any(pages => number in pages and (number + 1) in pages)
      let folio-at-foot = page-has(<no-header>, number) and not page-has(<no-folio>, number) and not is-blank(number)
      let note = text(size: type.running_head * 1pt, style: "italic", [Continued on next page])
      let folio = text(size: type.running_head * 1pt, counter(page).display())
      // On a chapter's opening page the folio is at the foot too; both share
      // one line, so the folio stays where it always is, inside the safety
      // margin (a second line pushed it 0.004 in past it).
      if continued and folio-at-foot {
        grid(columns: (1fr, auto, 1fr), [], folio, align(right, note))
      } else if continued {
        align(right, note)
      } else if folio-at-foot {
        align(center, folio)
      }
    },
  )

  set footnote.entry(
    separator: line(length: 30%, stroke: 0.5pt + black),
    gap: 0.45em,
    clearance: 0.9em,
    indent: 0em,
  )
  show footnote.entry: set text(size: type.footnote * 1pt)
  show footnote.entry: set par(leading: 0.5em, justify: true)
  // Note number, a thin space, then the note.
  show footnote.entry: it => {
    let location = it.note.location()
    let number = numbering(it.note.numbering, ..counter(footnote).at(location))
    [#link(location, super(number))#h(0.25em)#it.note.body]
  }

  // Parts (level 1) and chapters (level 2) are printed by part-opener and
  // chapter-opener; their headings only feed the contents, the PDF bookmarks
  // and the running heads.
  show heading.where(level: 1): none
  show heading.where(level: 2): none
  // Sections: a provision's number and title, or an essay's section.
  show heading.where(level: 3): it => {
    running-section.update(it.body)
    set text(size: type.section_title * 1pt, weight: "bold")
    set par(justify: false)
    block(above: 1.6em, below: 0.9em, sticky: true, it.body)
  }

  show outline.entry.where(level: 1): it => {
    set text(weight: "bold")
    block(above: 1.1em, it)
  }

  body
}

// ---------- Front matter

#let title-page(layout) = {
  let details = layout.metadata
  [#metadata("title page") <no-folio>]
  set par(justify: false)
  v(1fr)
  align(center, {
    text(size: layout.type.chapter_title * 1.3pt, weight: "bold", details.title)
    if details.subtitle != none {
      parbreak()
      text(size: layout.type.chapter_title * 0.8pt, details.subtitle)
    }
    v(2em)
    text(size: layout.type.section_title * 1.1pt, details.author)
  })
  v(2fr)
  pagebreak()
}

// Lulu requires a copyright page after the title page, with the title,
// subtitle, author, copyright date and print ISBN (Retail Distribution
// Guide, p. 10).
#let copyright-page(layout) = {
  let details = layout.metadata
  [#metadata("copyright page") <no-folio>]
  set text(size: layout.type.footnote * 1pt)
  set par(justify: false, spacing: 0.8em)
  v(1fr)
  strong(details.title)
  if details.subtitle != none [: #details.subtitle]
  linebreak()
  details.author
  parbreak()
  [Copyright © #details.copyright_year #details.copyright_holder]
  parbreak()
  for statement in details.license_lines { statement; parbreak() }
  [ISBN: #details.isbn_text]
  parbreak()
  [#details.edition. Print edition #details.print_version, built from content version #details.content_version.]
  parbreak()
  [Set in Atkinson Hyperlegible Next, with Noto Sans for characters it lacks.]
  pagebreak()
}

#let contents-page(layout) = {
  recto-start()
  [#metadata("contents") <no-header>]
  text(size: layout.type.chapter_title * 1pt, weight: "bold", [Contents])
  v(1.2em)
  outline(title: none, depth: 3, indent: 1.2em)
}

// ---------- Openers

#let part-opener(layout, number, title) = {
  recto-start()
  [#metadata("part opener") <no-folio>]
  heading(level: 1, outlined: true, bookmarked: true, [#number. #title])
  set par(justify: false)
  v(2.2in)
  align(center, {
    text(size: layout.type.section_title * 1pt, weight: "semibold", tracking: 0.08em, upper(number))
    parbreak()
    text(size: layout.type.chapter_title * 1pt, weight: "bold", title)
  })
  // No page break here: the chapter that follows starts on the next recto.
}

#let chapter-opener(layout, number, title) = {
  recto-start()
  [#metadata("chapter opener") <no-header>]
  counter(footnote).update(0)
  running-section.update(none)
  let full = if number == none { title } else [#number. #title]
  heading(level: 2, outlined: true, bookmarked: true, full)
  set par(justify: false)
  v(1.2in)
  if number != none {
    text(size: layout.type.section_title * 1pt, weight: "semibold", tracking: 0.06em, upper(number))
    parbreak()
  }
  block(below: 1.6em, text(size: layout.type.chapter_title * 1pt, weight: "bold", title))
}

// ---------- Provisions and commentary (Restatement pattern)

// Subsection paragraphs: (a) level 1, (1) level 2, (A) level 3, (i) level 4.
#let subsection(level, body) = pad(left: (level - 1) * 1.5em, body)

#let alternative(letter, label, body) = block(
  width: 100%,
  stroke: (left: 1pt + black),
  inset: (left: 0.8em, top: 0.2em, bottom: 0.2em),
  above: 1em,
  below: 1em,
  {
    block(below: 0.7em, sticky: true, text(weight: "semibold", [Alternative #letter#if label != none [: #label]]))
    body
  },
)

// "Comment", "Illustrations", "Source Note" and other headings inside commentary.
#let commentary-heading(body) = block(
  above: 1.4em,
  below: 0.7em,
  sticky: true,
  text(weight: "semibold", tracking: 0.04em, body),
)

#let illustrations(start, ..items) = {
  set text(size: 0.95em)
  set enum(numbering: "1.", indent: 0em, body-indent: 0.6em, spacing: 0.9em, start: start)
  enum(..items.pos())
}

#let source-note(body) = {
  set text(size: 0.95em)
  body
}

#let law-table(columns, header, long-rows: false, ..rows) = {
  // A row never starts on one page and ends on the next (lead author, Nov. 22,
  // 2026); the header repeats on each page the table runs onto. A table with a
  // row too long for one page lets its rows break, or it would run off the page.
  set table.cell(breakable: long-rows)
  set text(size: 0.85em)
  set par(justify: false, leading: 0.5em)
  block(above: 1em, below: 1em, table(
    columns: (1.25fr,) + (1fr,) * (columns - 1),
    inset: (x: 4pt, y: 5pt),
    align: left + top,
    stroke: (x, y) => (
      top: if y == 0 { 0.8pt + black } else { 0pt },
      bottom: if y == 0 { 0.6pt + black } else { 0.3pt + black },
    ),
    table.header(..header),
    ..rows.pos(),
  ))
}

// ---------- Essays

// Essay text: paragraphs after the first in a run open with an indent, and
// lists sit in from the margin (lead author, Nov. 22, 2026: "Use proper
// tabbing").
#let essay-body(body) = {
  set par(first-line-indent: (amount: 1.5em, all: false), spacing: 0.7em)
  set list(indent: 1.2em, body-indent: 0.5em)
  set enum(indent: 1.2em, body-indent: 0.5em)
  body
}

// A box set apart from the text (cases, laws, analysis). When it runs onto
// another page, its heading repeats at the top with "(continued)", and the
// page it leaves says "Continued on next page" at its foot (page footer
// above) (lead author, Nov. 22, 2026).
#let boxed-counter = counter("boxed-block")
#let boxed(heading, body, stroke: 0.6pt + black) = {
  boxed-counter.step()
  context {
    let id = boxed-counter.get().first()
    // The footer repeats on every page the box reaches, so its markers give
    // the box's first and last pages.
    let pages = query(<boxed-page>).filter(item => item.value == id).map(item => item.location().page())
    let first-page = if pages.len() > 0 { calc.min(..pages) } else { 0 }
    let side = (left: stroke, right: stroke)
    block(above: 1.3em, below: 1.3em, table(
      columns: (1fr,),
      inset: (x: 0.9em, y: 0pt),
      stroke: (x, y) => side,
      table.header(repeat: true, table.cell(stroke: (top: stroke, ..side), inset: (x: 0.9em, top: 0.8em, bottom: 0.6em), context {
        set par(first-line-indent: 0em, justify: false)
        text(weight: "semibold", heading)
        if first-page > 0 and here().page() > first-page { text(weight: "regular", style: "italic", [ (continued)]) }
      })),
      table.cell(inset: (x: 0.9em, top: 0pt, bottom: 0.2em), {
        set par(first-line-indent: 0em, justify: false)
        body
      }),
      table.footer(repeat: true, table.cell(stroke: (bottom: stroke, ..side), inset: (x: 0.9em, top: 0pt, bottom: 0.7em), {
        [#metadata(id) <boxed-page>]
      })),
    ))
  }
}

// The lines under a box's heading: when a case was decided, the nations it
// concerns and, for a Supreme Court case, who decided it.
#let box-facts(facts) = if facts.len() > 0 {
  block(below: 0.8em, sticky: true, {
    set text(size: 0.85em)
    grid(
      columns: (auto, 1fr),
      column-gutter: 0.8em,
      row-gutter: 0.4em,
      ..facts.map(((label, value)) => (text(weight: "semibold", label), value)).flatten(),
    )
  })
}

// A court case: its full citation as the heading, then its Question,
// Holding, Quotes and Treatment parts.
#let case-block(citation, facts, body) = boxed(citation, { box-facts(facts); body })

// An act or other law: its full citation as the heading, then What it does,
// Quotes and Treatment. A heavier rule tells it from a case.
#let law-block(citation, facts, body) = boxed(citation, { box-facts(facts); body }, stroke: 1.4pt + black)

#let case-part(label, body) = {
  block(above: 0.9em, below: 0.5em, sticky: true, text(size: 0.85em, weight: "semibold", tracking: 0.06em, upper(label)))
  body
}

// A quotation, in italics, indented on both sides with a rule at its left.
// A paragraph that is only a citation names the source, set right.
#let quote-block(body) = block(
  width: 100%,
  inset: (left: 1.5em, right: 1.5em),
  above: 0.9em,
  below: 0.9em,
  block(width: 100%, stroke: (left: 1.2pt + black), inset: (left: 0.8em, y: 0.2em), {
    set par(first-line-indent: 0em)
    set text(size: 0.95em, style: "italic")
    body
  }),
)

#let attribution(body) = align(right, text(size: 0.9em, style: "normal", body))

// The author's own analysis, boxed apart from the sourced text.
#let analysis-block(title, body) = boxed(
  if title == none [Analysis] else [Analysis: #title],
  body,
  stroke: (paint: black, thickness: 0.6pt, dash: "dashed"),
)

// An essay's picture, video, sound recording or chart. The book prints its
// caption, description, credit and transcript, and where to see or hear it;
// a chart prints its table.
#let figure-block(label, where, body) = boxed(
  label,
  [#body #if where != none { block(above: 0.8em, text(size: 0.85em, style: "italic", where)) }],
  stroke: (paint: black, thickness: 0.6pt, dash: "dotted"),
)

// Who made a figure, in smaller type.
#let figure-credit(body) = block(above: 0.5em, below: 0.5em, text(size: 0.85em, body))

// A case named in an index, with the page its box starts on.
#let case-ref(target, body) = [#link(target, body), #context [p. #locate(target).page()]]

// Endnotes (book.yaml, notes: endnotes): a numbered mark in the text that
// links to the note, and the chapter's notes gathered at its end.
#let endnote-mark(number, target) = super(link(target, str(number)))

#let endnote-entry(number, body) = block(above: 0.45em, below: 0.45em, grid(
  columns: (2em, 1fr),
  align(right, [#number.#h(0.4em)]),
  body,
))

#let endnotes-section(body) = {
  // The notes start on a page of their own (lead author, Nov. 22, 2026).
  pagebreak(weak: true)
  block(above: 0em, below: 0.9em, sticky: true, text(weight: "semibold", tracking: 0.04em, [Notes]))
  set text(size: 0.85em)
  set par(justify: false, first-line-indent: 0em, leading: 0.5em)
  body
}

// ---------- Glossary

#let glossary-entry(term, label, expansion, usage, see-also, body) = block(above: 1.1em, breakable: true, {
  set par(justify: false)
  text(weight: "bold", term)
  [ #emph(label)]
  if expansion != none [ of #text(weight: "bold", expansion)]
  if usage != none [ #h(0.3em) #text(size: 0.85em, tracking: 0.04em, upper(usage))]
  parbreak()
  body
  if see-also != none {
    parbreak()
    emph([See also ]) + see-also
  }
})
