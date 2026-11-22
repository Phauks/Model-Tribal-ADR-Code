# 0025. Log every search for a nation's information, including the ones that fail

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

On Nov. 22, 2026, 186 of the 954 Native nation profiles had any dispute
resolution record, and 395 federally recognized nations had none (row 2 of
the [dataset gap audit](../../research/analyses/2026-11-21-dataset-gap-audit.md);
`python3 scripts/coverage_report.py`). An empty field could mean that the
nation publishes nothing on the subject, that its code sits on a site that
refuses scripts, that its website was down on the day, or that no one ever
looked. The project kept no record that would tell these apart. Research
session logs describe a session as a whole, not each nation, and earlier
threads repeated searches another thread had already made (project
analysis of `research/sessions/` and the project's working notes).

The lead author asked on Nov. 22, 2026: "if we cannot find information, let
us create a standard log used for every tribe and nation for how we searched,
and a log of places looked and why it failed. so in future, we can identify
gaps."

## Decision

- Every search for a kind of information about a Native nation is logged in
  one record per nation and topic:
  `research/search-logs/<topic>/<letter>/<profile id>.yaml`, validated by
  `schemas/search-log.schema.json`. The letter folder follows the profile's
  (`_other` for a first character that is not a letter).
- `topic` is an open slug, so courts, contacts, law codes and later searches
  use the same record without a schema change. The first topic is
  `dispute-resolution`.
- A record names the `profile` by its repository path and gives a `status`:
  `found`, `none-found`, `partly-searched` or `not-searched`, the date it was
  `last_searched`, and optional `next_steps`.
- Each entry in `searches` gives the `date`, who searched (`searched_by`: a
  person's chosen name or "Claude (AI assistant)"), the `method` (`script`,
  `browser`, `ai-review`, `by-hand`), the kind of place (`place_kind`, an
  open slug with suggested terms), its `address`, the `query` if any, the
  `outcome` (`found`, `not-found`, `no-site`, `blocked`, `dead-link`,
  `paywalled`, `scanned-unreadable`, `not-public`, `error`), a one-sentence
  `reason`, and the `records` it led to.
- Searches that find something are logged too, so the log shows every place
  looked, not only the gaps. Entries are added, never removed.
- A site that refuses the project's honestly named link checker, or shows a
  bot challenge, is logged as `blocked`, not as a dead link, and the project
  does not try to get past it.
- `scripts/validate_records.py` checks each record against the schema, that
  its folder matches its topic and letter, that its file name matches the
  profile and the profile exists, that `last_searched` is the latest search
  date, and that the status is `found` exactly when a search found something.
- `scripts/coverage_report.py` counts nations by search status for each topic,
  dispute resolution searches by region, and failed searches by kind of place
  and outcome.
- A search log is a research record, not a fact about the nation. What a
  search finds goes to a review first and reaches a profile only through the
  usual review (Gate 1 of the [roadmap](../roadmap.md)).

## Consequences

- An empty profile field can now be read with its search log: "not
  searched", "searched and nothing found", or "blocked at these places".
- The failed-search counts show where help is needed, for example which code
  hosts block scripts and need a person with a browser or a library.
- Logs say only what was searched and found; they do not say a nation has no
  dispute resolution practice. Absence from public sources is not absence of
  practice (project analysis).
- The first logs, for the 395 federally recognized nations with no dispute
  resolution record, come from the dispute resolution coverage search of
  Nov. 22, 2026 (`research/reviews/2026-11-22-dispute-resolution-coverage.md`).

## Sources

- Lead author's request, Nov. 22, 2026 (project thread on the data gap review).
- Dataset gap audit, row 2: `research/analyses/2026-11-21-dataset-gap-audit.md`.
- Verification levels and record lint: decision record 0014.
