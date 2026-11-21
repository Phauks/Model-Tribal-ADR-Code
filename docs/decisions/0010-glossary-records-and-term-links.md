# 0010. Define terms once, as records, and link them from text

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The words used for Native nations carry legal and political weight, and
sources disagree about some of them (see
[docs/terminology.md](../terminology.md)). The book will have many authors and
editions, and readers of the website, print and ebook editions all need to
find what a term or acronym means where it is used. The lead author asked that
any definition or acronym be linkable wherever it is invoked.

## Decision

- Each defined term, phrase or acronym is one YAML record in
  `content/glossary/`, validated by
  [glossary.schema.json](../../schemas/glossary.schema.json), with its usage
  status (preferred, acceptable, context-only, avoid), definition, sources and
  the basis of the choice.
- Text links to an entry as `[[id]]` or `[[id|shown text]]`, alongside the
  existing `[@key]` citation and `{{group.name}}` variable syntax.
- Each build resolves the links: hover cards and a page per term on the
  website, with "Used in" backlinks; acronym expansion on first use; a
  back-matter glossary in print and the ebook.
- A text check flags unresolved links, unlinked first uses and "avoid" terms
  outside quotations.
- Glossary entries are licensed CC BY 4.0, like other data
  ([LICENSE.md](../../LICENSE.md)).

## Consequences

- Term ids are permanent; retired entries redirect.
- Writers check the glossary before introducing a term, and add an entry, with
  sources, when they need a new one.
- The `[[...]]` syntax is the project's own, so the Markdown converters for the
  website, Typst and EPUB each need a small extension to handle it.
