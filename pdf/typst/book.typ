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
      if page-has(<no-header>, number) and not page-has(<no-folio>, number) and not is-blank(number) {
        align(center, text(size: type.running_head * 1pt, counter(page).display()))
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

#let law-table(columns, header, ..rows) = {
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
