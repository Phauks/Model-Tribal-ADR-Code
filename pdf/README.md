# Print edition and ebook

The build that turns `content/` into the print interior PDF for Lulu. The ebook build will live here too. Version: see [version.txt](version.txt); history: see [CHANGELOG.md](CHANGELOG.md).

The print version is separate from the content version: 1.0.0 will be the 1st Edition. Each PDF records the print and content versions it was built from on its copyright page. The PDF is typeset with Typst, chosen after a test build against Paged.js; see [decision record 0005](../docs/decisions/0005-print-with-lulu.md). The ebook is built by a custom pipeline that shares the website's Markdown parser and citation engine; see [decision record 0011](../docs/decisions/0011-ebook-custom-pipeline.md).

## Changing the book size

The book size is not chosen yet. It is one line in [book.yaml](book.yaml):

```yaml
trim: us-trade
```

Change it to any size in [book-sizes.yaml](book-sizes.yaml) and rebuild. The margins, gutter, type sizes, running heads, line length and the spine width all follow from the size and the page count. To try a size without editing the file, run `npm run build -- --trim executive`.

| `trim` | Size (in) | Type |
| --- | --- | --- |
| `pocket-book` | 4.25 x 6.875 | 9 pt |
| `novella` | 5 x 8 | 9 pt |
| `digest` | 5.5 x 8.5 | 10 pt |
| `a5` | 5.83 x 8.27 | 10 pt |
| `us-trade` | 6 x 9 | 10 pt |
| `royal` | 6.14 x 9.21 | 10 pt |
| `executive` | 7 x 10 | 10.5 pt |
| `crown-quarto` | 7.44 x 9.68 | 10.5 pt |
| `small-square` | 7.5 x 7.5 | 10.5 pt (not distributed through Ingram) |
| `a4` | 8.27 x 11.69 | 11 pt |
| `us-letter` | 8.5 x 11 | 11 pt |
| `square` | 8.5 x 8.5 | 11 pt |

These are all the sizes Lulu lists as eligible for retail distribution as a paperback, perfect bound, with standard black-and-white ink (Lulu, *Retail Distribution Eligible Products Guide*, pp. 3-9). Comic Book is left out because it is eligible only with premium color.

## What the size controls

| Setting | Rule | Source |
| --- | --- | --- |
| PDF page | Trim plus 0.125 in bleed on every side | Lulu, *Book Creation Guide*, pp. 10, 11, 23 |
| Safety margin | Nothing printed within 0.5 in of the trim | *Book Creation Guide*, pp. 8, 17, 23 |
| Inside margin | 0.5, 0.625, 1, 1.125 or 1.25 in, by page count | *Book Creation Guide*, p. 9 |
| Spine width | Pages / 444 + 0.06 in (an estimate for the cover; Lulu's template is final) | *Book Creation Guide*, p. 13; *Retail Distribution Guide*, p. 13 |
| Spine text | Only at 100 pages or more | *Retail Distribution Guide*, p. 14 |
| Type sizes, top and bottom margins | One of four type scales per size | Project choice, in `book-sizes.yaml` |
| Line length | At most about 75 characters; wider pages get wider margins | Project choice, after Bringhurst's 45 to 75 character range |

The inside margin depends on the page count, and the page count on the margins, so the build lays the book out, counts the pages, and lays it out again until the gutter stops changing.

## Building

Needs Node.js 22, [Typst 0.15.1](https://github.com/typst/typst/releases/tag/v0.15.1) on the path (or in the `TYPST` variable) and Python 3 for the PDF checks.

```sh
cd pdf
npm ci
pip install -r requirements.txt
npm run build                # the book from content/
npm run build:specimen       # a specimen chapter plus content/
npm run build:every-size     # the specimen at every size, with a summary table
npm run build:editions       # interior and paperback and hardcover covers at every size, for ordering
npm test
```

Each build writes `output/<name>/interior.pdf` and `report.json` (page count, margins, spine width, cover size and warnings). `build:editions` also writes a cover for each size and binding to `output/editions/current/<size>/<binding>/`, checked by `tools/check_cover.py`; see [docs/book-orders.md](../docs/book-orders.md) for the cover sizes and how the files reach the website. `output/` is not committed; the `checks` workflow uploads the PDFs as a build artifact.

## What the build checks

[`tools/check_interior.py`](tools/check_interior.py) runs after every build and fails it if the PDF breaks one of Lulu's rules: the page size, embedded fonts, gray-only color for standard black-and-white ink, text inside the safety margin, the recommended inside margin, more than two blank pages in a row, or password protection. The build warns, without failing, when the page count is outside Lulu's 32 to 800 pages, when there is no ISBN yet, or when a distribution channel excludes the chosen size or paper.

## What the book contains

In order: title page, copyright page (Lulu requires it after the title page, with the title, author, copyright date and ISBN: *Retail Distribution Guide*, p. 10), contents, Part I essays (`content/essays/i-*.md`), Part II provisions grouped by chapter, each followed by its commentary in the Restatement pattern (Comment, Illustrations, Source Note), Part III essays (`content/essays/iii-*.md`), and the glossary from `content/glossary/`. Parts and chapters start on a right-hand page.

- **Footnotes** restart in each chapter. A citation in the text becomes a footnote placed after the punctuation that follows it; a citation inside a footnote prints in place. The first citation of a source in each chapter is a full citation.
- **Glossary links** `[[id]]` print the term and link to its entry in the PDF. The first link to an acronym in each chapter prints its expansion.
- **Placeholders** `{{nation.name}}` print their model text from `content/variables/`, such as "[Name of Nation]".
- **Page numbers** run in one sequence from the title page. Front matter pages are counted but not numbered, so no number is skipped or repeated (*Retail Distribution Guide*, p. 11).
- **Records** marked `restricted` or `tribal_review_required`, and withdrawn ones, are never printed (charter; `docs/data-model.md`).

Working titles for the parts and Part II chapter titles are in `book.yaml`.

## Layout of this folder

| Path | Holds |
| --- | --- |
| `book.yaml` | What to build: size, paper, title page and copyright details, part and chapter titles |
| `book-sizes.yaml` | Every supported size and the rules that turn a size into a layout |
| `pipeline/` | The build: content loading, Markdown reader, citations, Typst writer, geometry |
| `typst/book.typ` | The page template |
| `typst/cover.typ`, `pipeline/cover.mjs` | The cover template and its geometry |
| `styles/` | The citation style and locale ([README](styles/README.md)) |
| `fonts/` | Embedded fonts ([README](fonts/README.md)) |
| `tools/check_interior.py`, `tools/check_cover.py` | The PDF checks |
| `tests/` | Tests, and the typesetting specimen in `tests/fixtures/specimen/` |
