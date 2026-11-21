// Map page test for the print book: 6 x 9 in trim plus 0.125 in bleed, as in the PDF spike.
#set page(width: 6.25in, height: 9.25in, margin: (inside: 1in, outside: 0.625in, y: 0.875in))
#set text(font: "Atkinson Hyperlegible Next", size: 10pt)

= Native nations by state

#figure(
  image("../../out/d3/presence-map-print.svg", width: 100%),
  caption: [Number of nations with a presence in each state, DC and territory. Mock data. No boundaries of nations are drawn. The table that follows lists the same data.],
)

#figure(
  table(
    columns: (auto, auto, 1fr),
    stroke: 0.5pt,
    [*State or territory*], [*Nations*], [*Names*],
    [Oklahoma], [3], [Example Nation C, Example Nation D, Example Nation G],
    [Arizona], [1], [Example Nation B],
  ),
  caption: [Same data as the map (excerpt).],
)

#pagebreak()
= Control: the web SVG, which uses CSS classes and custom properties

#image("../../out/d3/presence-map.svg", width: 100%)
