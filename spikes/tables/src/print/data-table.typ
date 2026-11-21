// Renders any table definition (see ../tables/table-definition.mjs) as a
// Typst table. The definition is the same JSON the website uses.
//
// - Only columns whose "media" includes "print" are shown.
// - The header row repeats on every page (table.header).
// - The row header column is set in bold. When Typst runs with
//   `--features a11y-extras`, it is also tagged as a row header in the PDF
//   (pdf.header-cell); without the feature that function does not exist, so
//   the template checks for it first.
// - Fills are neutral grays only, so the page stays grayscale for Lulu.

#let columns-for-print(definition) = definition.columns.filter(column =>
  "print" in column.at("media", default: ("website", "print", "ebook"))
)

#let data-table(definition, header-fill: luma(225), stripe-fill: luma(245)) = {
  let shown = columns-for-print(definition)
  // Rows are used in the stored order. The build sorts them with the same
  // language-aware rule as the website, so print needs no sorting of its own.
  let rows = definition.rows
  figure(
    kind: table,
    caption: definition.caption,
    table(
      columns: shown.map(column => {
        let width = column.at("printWidth", default: "1fr")
        if width.ends-with("fr") { float(width.trim("fr")) * 1fr } else { auto }
      }),
      align: shown.map(column => if column.at("align", default: "start") == "end" { right } else { left }),
      fill: (_, row) => if row == 0 { header-fill } else if calc.even(row) { stripe-fill } else { none },
      stroke: (x: none, y: 0.4pt + luma(120)),
      inset: (x: 4pt, y: 3pt),
      table.header(
        repeat: true,
        ..shown.map(column => text(weight: "bold", column.header)),
      ),
      ..rows.map(row => shown.map(column => {
        let cell = row.cells.at(column.key)
        if column.at("isRowHeader", default: false) {
          if "header-cell" in dictionary(pdf) {
            pdf.header-cell(scope: "row", text(weight: "bold", cell.text))
          } else {
            text(weight: "bold", cell.text)
          }
        } else {
          cell.text
        }
      })).flatten(),
    ),
  )
}
