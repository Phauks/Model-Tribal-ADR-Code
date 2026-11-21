# Typesetting specimen

Test content for the print build. Nothing here is a proposed provision or a
statement about any nation's law: it is placeholder text that exercises every
element the book prints, so the layout can be checked at every trim size
before real chapters exist.

`npm run build:specimen` builds these files together with everything in
`content/`. `book-overrides.yaml` gives the specimen its subtitle and chapter
title; the trim still comes only from `pdf/book.yaml`.

| File | Exercises |
| --- | --- |
| `content/provisions/02-104.md` | Subsections (a), (1), (A), Alternatives A and B, placeholders, long footnotes that split across pages |
| `content/commentary/02-104.md` | Comment, Illustrations and Source Note; a table; citations to a uniform act, a statute and a case, with full forms, short forms and *Id.* |
| `content/provisions/02-105.md` | A second section, for running heads and section order |
| `content/essays/i-typesetting-specimen.md` | Part I essay: headings, lists, a block quotation, and characters that need the Noto fallback fonts |
| `content/essays/iii-specimen-methods.md` | Part III, so all three parts are built |
