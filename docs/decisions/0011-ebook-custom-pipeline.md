# 0011. Build the ebook with a custom pipeline

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The book is to be offered as an ebook as well as in print (decision record 0005). Lulu accepts only EPUB for ebooks, asks that it be validated with "EPUBCheck v5," and requires accessibility to EPUB Accessibility 1.1 and WCAG 2.0 Level AA (Lulu, *Retail Distribution Guide*, p.19; *Ebook Creation Guide*, p.11). A test build on 2026-11-20 and 21 built one sample chapter three ways: with Pandoc 3.14, with a custom pipeline, and with Typst 0.15.1's HTML export. All three passed EPUBCheck 5.4.0 with no errors or warnings and DAISY Ace 1.4.6 with no violations (measured).

## Decision

Build the EPUB with a custom pipeline. It parses the Markdown with markdown-it and the website's own plugins, renders citations with citeproc-js, and packages the result with a short Node script. The lead author, Trevor Goldsmith, chose this on 2026-11-20. In the test build this was the only route that:

- reads the content exactly as the website does;
- writes the accessibility conformance claim without further processing; and
- includes a page list that maps the ebook to the print edition's page numbers, taken from the Typst layout.

Pandoc remains the fallback if the custom pipeline becomes too costly to maintain (project analysis).

## Consequences

- The ebook build lives with the print build in `pdf/` and shares its version track and changelog, because both are editions of the same book (project choice).
- The packager is about 430 lines in the test build, against about 117 for Pandoc (measured).
- DAISY Ace runs in continuous integration, not in the book build, because it installs at about 404 MB with open npm audit findings (measured).
- Atkinson Hyperlegible Next has no "↩" glyph, so footnote backlinks use a word instead (measured).
- Two questions go to Lulu before a retail ebook: whether the CC0 provisions count as "public domain content," which retail ebooks may not include (*Retail Distribution Guide*, p.20), and whether hidden print page markers conflict with the advice not to include page numbers or page breaks (*Ebook Creation Guide*, p.7).

## Evidence

The test build (report, sample EPUBs, page images, validator logs and build scripts) is kept outside the repository in the project's shared files at `spikes/epub/`.
