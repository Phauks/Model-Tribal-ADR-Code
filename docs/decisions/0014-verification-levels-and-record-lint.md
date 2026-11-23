# 0014. Record how each fact was checked, and lint for unchecked data

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

An audit of the dataset on Nov. 21, 2026 found that 15,725 of the 19,675 cited facts in the Native nation profiles come from 42 sources that are each cited by 20 or more profiles, and that the only measure on each fact, `confidence`, does not separate a document read in full from a row copied from a list (project analysis of `content/tribes/` and `content/sources/`; see `research/analyses/2026-11-21-dataset-gap-audit.md`). How a fact was checked was written, if at all, in free-text notes. Other gaps had the same cause: no check noticed them as they built up. Examples are source records recorded twice under two spellings of one address, forum kinds with no method record, sources without an archived copy, and cases and statutes with no citator check. The lead author asked for a lint so that such gaps cannot build up again (2026-11-21).

## Decision

- Every cited fact may carry `verification`: `read-in-full`, `title-only`, `bulk-import` or `inferred` (`schemas/common.schema.json`, defined in docs/data-model.md). It sits beside `confidence` and does not replace it.
- `scripts/lint_records.py` runs on every pull request (the "Record lint and coverage" job in `.github/workflows/checks.yml`). It fails a pull request that adds or changes:
  - a profile fact with no `verification`;
  - a source record at the same address as another (ignoring the scheme, `www.`, a trailing slash and an index page), unless the two list each other in `shares_link_with` because they are different documents;
  - a dispute resolution forum whose `kind` has no method record;
  - a source record with a web address and no archived copy more than 30 days after `retrieved`.
  - a service (an entry in a profile's `justice_institutions` or `dispute_resolution.forums`) with no `link` (check `service-link`, added Nov. 22, 2026 after the lead author's rule "If we list a service, it should have a link"). The link is the service's own official page or, where it has none, the official directory entry that lists it ([docs/data-model.md](../data-model.md#courts-and-other-services)). Services already on `main` without a link are warnings, each with a search log saying where the project looked.
- Content headed for an edition (essays, provisions, commentary, glossary) may cite only sources that are archived, that have a citator result if they are a case, statute, regulation or court rule, and that are not marked unverified. The lint warns while the citing file is a draft, fails once it is stable, adopted or final, and fails on every such citation when run with `--edition` before an edition is exported.
- Records that were already on `main` when this was adopted are reported as warnings, not failures, so that unrelated work is not blocked. They are counted by `scripts/coverage_report.py`, which runs in the same job, writes its report to the job summary and compares every count with the pull request's base, so a pull request that adds unchecked data shows it.

## Consequences

- Facts that predate the field have no level until they are reviewed. The coverage report guesses one from each note's wording, reported apart from stated levels; the guess is project analysis, not a check.
- A pull request that edits a fact must state its level even if the edit was small, because the lint cannot tell a small edit from a new fact.
- The 30-day archive grace period starts to fail pull requests that touch older source records from Dec. 21, 2026, unless the "archive sources" workflow has filled them in.
- Thresholds live in the scripts (`GRACE_DAYS`, `BULK_SOURCE_PROFILES`) and change by pull request.

## Sources

- Dataset gap audit: `research/analyses/2026-11-21-dataset-gap-audit.md`.
- Earlier analysis and its review queue: `research/analyses/2026-11-21-dispute-resolution-practice.md`, section 9.
- Citation fields: docs/data-model.md, "Every fact is cited"; archive rule: docs/citation-style.md.
- Service links: the lead author's rule in the project chat, Nov. 22, 2026; the first pass over the services without a link is `research/reviews/2026-11-22-service-links.md`.
