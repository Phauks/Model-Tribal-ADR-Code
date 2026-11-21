// Test page: the 1,000-row nations directory in print.
// The trim size is not decided (project memory), so it is an input:
//   typst compile --input page-width=6in --input page-height=9in ...
#import "data-table.typ": data-table

#let length-input(name, fallback) = {
  let value = sys.inputs.at(name, default: fallback)
  float(value.trim("in")) * 1in
}

#set document(title: "Nations directory table test (fictional sample data)", author: "Model Tribal ADR Code project")
#set text(font: "Atkinson Hyperlegible Next", size: 7.5pt, lang: "en")
#set page(
  width: length-input("page-width", "6in"),
  height: length-input("page-height", "9in"),
  margin: (x: 0.6in, y: 0.7in),
  numbering: "1",
)
#show figure.where(kind: table): set figure.caption(position: top)
#show figure: set block(breakable: true)

#let definition = json(sys.inputs.at("definition", default: "/out/tables/nations-directory.json"))
#data-table(definition)
