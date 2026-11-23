// Print cover template: back cover, spine and front cover on one page.
// Every position comes from the cover layout that pipeline/cover.mjs writes
// (inches from the top left of the spread); nothing here depends on a
// particular size or binding. Colors are the website's (site/src/app.css).

#let fonts = ("Atkinson Hyperlegible Next", "Noto Sans")
#let teal = rgb("#0F4C54")
#let paper = rgb("#FFFAF5")
#let orange = rgb("#B4461A")

#let at(area, body) = place(
  top + left,
  dx: area.x * 1in,
  dy: area.y * 1in,
  block(width: area.width * 1in, height: area.height * 1in, body),
)

#let cover(layout) = {
  let text-data = layout.text
  let front = layout.safe_front
  let back = layout.safe_back
  // Type sizes follow the width of the cover (project choice).
  let title-size = front.width * 0.11 * 72pt
  let body-size = calc.max(10pt, calc.min(13pt, back.width * 0.03 * 72pt))

  set document(title: text-data.title, author: text-data.author)
  set page(width: layout.width * 1in, height: layout.height * 1in, margin: 0pt, fill: teal)
  // Measure lines from the tallest ascender, so no letter reaches past the
  // safe areas that cover-layout.json gives.
  set text(font: fonts, fill: paper, lang: "en", hyphenate: false, top-edge: "ascender", bottom-edge: "descender")
  set par(justify: false)

  // Front cover.
  at(front, {
    v(front.height * 0.12in)
    text(size: title-size, weight: "bold", tracking: -0.01em, par(leading: 0.05em, text-data.title))
    v(0.5em)
    rect(width: 30%, height: calc.max(3pt, title-size * 0.08), fill: orange, stroke: none)
    if text-data.subtitle != none {
      v(0.4em)
      text(size: title-size * 0.45, text-data.subtitle)
    }
    v(1fr)
    if text-data.edition != none {
      text(size: title-size * 0.3, upper(text-data.edition))
      v(0.2em)
    }
    text(size: title-size * 0.5, weight: "semibold", text-data.author)
  })

  // Spine: read from top to bottom, as books printed in the United States do.
  if layout.spine_text_allowed {
    let spine = layout.safe_spine
    let size = calc.min(14pt, spine.width * 0.55 * 72pt)
    at(spine, align(center + horizon, rotate(90deg, reflow: true, text(size: size, {
      text(weight: "bold", text-data.title)
      h(1.5em)
      text(text-data.author)
    }))))
  }

  // Back cover.
  at(back, {
    set par(leading: 0.3em, spacing: 0.9em)
    if text-data.back_text != none {
      text(size: body-size * 1.15, text-data.back_text)
      parbreak()
    }
    if text-data.back_note != none { text(size: body-size, text-data.back_note) }
    v(1fr)
    text(size: body-size * 0.9, weight: "semibold", text-data.title)
  })
}
