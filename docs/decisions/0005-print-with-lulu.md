# 0005. Print and distribute through Lulu

- **Status:** Accepted (PDF engine pending)
- **Date:** 2026-11-20

## Context

The book must be printable on demand and eligible for retail distribution. The
lead author has prior good experience with Lulu.

## Decision

- Publish the print edition through Lulu in a format eligible for Lulu's global
  retail distribution, which sends print books to "Amazon and Ingram"
  ([Lulu help](https://help.lulu.com/en/support/solutions/articles/64000255597-publishing-a-print-book-for-global-distribution)).
- Build the interior PDF from the same content as the website. Paged.js is the
  planned engine because it reuses the website's HTML and CSS; a test build
  comparing it with Typst (both free and open source) will confirm the choice in
  a later record.
- Use Atkinson Hyperlegible Next in print and on the website, with fonts
  embedded as Lulu requires
  ([Lulu PDF settings](https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings)).

## Consequences

- Trim size, binding and page limits are chosen only from Lulu's
  distribution-eligible options; the test build documents them from Lulu's
  official guides.
- An ISBN is required for distribution (same Lulu help page).
