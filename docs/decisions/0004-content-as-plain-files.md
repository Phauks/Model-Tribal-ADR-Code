# 0004. Keep content as plain files in git, one file per entity

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The work needs a legislative-style history of every change, a way for
co-authors to propose edits, and editions that can be rebuilt exactly.

## Decision

All content is stored as Markdown and YAML files in this repository, one file
per provision, commentary, essay, form, tribe and source, checked against the
JSON Schemas in `schemas/`. The website and the print edition are separate
builds from these files. Files a source record describes (such as PDFs of
published codes) are stored in Cloudflare R2 and served only when rights allow;
the repository holds the records, not the files.

## Consequences

- git history is the full change record; pull requests are the review process.
- Non-technical reviewers will need a website comment path that does not
  require GitHub (planned).
- See [repository-layout.md](../repository-layout.md) and
  [data-model.md](../data-model.md).
