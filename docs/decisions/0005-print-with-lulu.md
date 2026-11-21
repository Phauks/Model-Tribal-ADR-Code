# 0005. Print and distribute through Lulu

- **Status:** Accepted (PDF engine: Typst, chosen 2026-11-20)
- **Date:** 2026-11-20

## Context

The book must be printable on demand and eligible for retail distribution. The
lead author, Trevor Goldsmith, has prior good experience with Lulu.

## Decision

- Publish the print edition through Lulu in a format eligible for Lulu's global
  retail distribution, which sends print books to "Amazon and Ingram"
  ([Lulu help](https://help.lulu.com/en/support/solutions/articles/64000255597-publishing-a-print-book-for-global-distribution)).
- Build the interior PDF from the same content as the website, typeset with
  [Typst](https://github.com/typst/typst) (free and open source, Apache-2.0).
  A test build of one sample chapter compared Typst 0.15.1 with Paged.js 0.4.3
  on 2026-11-20. Typst gave justified, hyphenated text and grayscale black,
  built in 0.085 s against 1.3 to 1.65 s, and installs as one binary with no
  runtime dependencies. Paged.js placed footnotes slightly better in that
  sample, but wrote a wrong TrimBox, printed black as RGB, split a table without
  repeating its header row, and depends on a deprecated Puppeteer release
  (spike report, measured; see "Evidence" below). The lead author chose Typst on
  2026-11-20.
- Use Atkinson Hyperlegible Next in print and on the website, with fonts
  embedded as Lulu requires
  ([Lulu PDF settings](https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings)).

## Consequences

- Markdown is converted to Typst markup by a small converter (about 90 lines
  in the test build), so the print layout lives in a Typst template separate
  from the website's CSS; both still read the same content files (project
  analysis).
- Footnote placement (one note in the sample started a page late) is to be
  tuned and checked on a full-length build before the 1st Edition.
- The markdown-it "typographer" option stays off, because it turned "(c)" into
  "©" and would corrupt legal subsection labels (measured in the test build).
- Trim size, binding, ink and paper are chosen only from Lulu's
  distribution-eligible options: US Trade 6 x 9 in, paperback perfect bound,
  standard black-and-white ink, 60# cream or white paper, 32 to 800 pages
  (Lulu, *Retail Distribution Eligible Products*, p.5). Premium black-and-white
  ink is not eligible (Lulu, *Retail Distribution Guide*, p.9).
- An ISBN is required for distribution (same Lulu help page).

## Evidence

The PDF engine test build (report, sample PDFs, page images, build scripts and
measurements) is kept outside the repository in the project's shared files at
`spikes/pdf-engine/`. Its findings will be summarized in a research session
file when the print build is added.
