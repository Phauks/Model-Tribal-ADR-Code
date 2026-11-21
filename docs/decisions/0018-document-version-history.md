# 0018. Record every version of a document, and how its key clauses changed

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Many documents the project cites change over time. A gaming compact is
amended, extended, amended and restated, or replaced; a constitution is
amended or revised in full; a code or a court's rules are recodified. Each
source record described one document at one moment, and the only history
field on a source (`history`) tracked changes to the web page at its
address, not to the law. The review of copied compact dispute clauses
(pull request #33) and the compact catalog (pull request #42) found many
clause summaries that did not match the nation's compact because they came
from a different edition of it (project analysis of
`research/reviews/2026-11-21-data-gap-review.md` and
`research/gaming/compact-clauses.csv`; the lead author's count was 127). The
lead author asked on Nov. 21, 2026 for one framework so that every kind of
document can carry its history.

## Decision

- **A document history record** (`schemas/document-history.schema.json`,
  stored in `content/documents/<letter>/<id>.yaml`) describes one document
  over time: what kind it is (an open list such as constitution, law-code,
  gaming-compact, court-rules), the nations and states that are parties,
  and every known version, oldest first.
- **Each version** says what it did (`event`: original, amendment, revision,
  restatement, replacement, extension, renewal, edition, repeal and others),
  whether it is in effect (`status`), the dates the sources give (signed,
  adopted, submitted, approved, published, effective, ended), the approving
  authority's action, which earlier versions it `amends` or `supersedes`, and
  the project's private `capture` of its text with a SHA-256 fingerprint.
  Its citation fields are those of every cited fact: `source` is the source
  record of that version's own text, which holds the Indigo Book citation
  and the archived copies.
- **Key clauses and changes.** A version lists its key clauses by topic (an
  open list led by dispute-resolution), and records for each tracked topic how
  it differs from the version it amends or supersedes: added, removed,
  changed, reworded, renumbered, unchanged or not compared yet. "Reworded"
  separates a change of words from a change of process, which is the
  difference the clause review needed.
- **Links both ways.** A source record that is one version names it in
  `document_version`. Any cited fact may name the version it describes in the
  same field, which says the fact describes that version on purpose.
- **Lint.** `scripts/lint_records.py` adds checks `version-dates`,
  `version-order`, `version-status`, `clause-change`, `version-link` and
  `superseded-citation`. As with decision record 0014, problems in records a
  pull request adds or changes fail it; older ones are warnings. The coverage
  report counts histories, versions, captures, clauses and changes.
- **Website.** A nation page shows its documents' histories in a "Document
  history" section before Sources, each version with its dates, what it did
  to earlier versions and how its clauses changed; each version's source is
  listed in the Sources section like every other fact
  ([site/DESIGN.md](../../site/DESIGN.md#nation-pages)).

The structure follows the distinction legal document standards draw between
a work and its versions over time, as in the OASIS Akoma Ntoso vocabulary for
legal documents, which models a document's lifecycle of amendments and
consolidations (design inspiration only; the standard was identified by its
title and was not read in full for this decision). The project uses plain
YAML fields rather than that vocabulary (project choice).

## Consequences

- A history is worth recording only where versions matter. Single-version
  documents need no history record; their source record is enough.
- Catalogs in `research/` (the compact catalog, the constitutions catalog and
  the tribal law catalog) can be converted into history records one document
  at a time; rows not yet read become versions with `verification:
  bulk-import` and changes marked `not-compared`, which the coverage report
  counts until someone compares them.
- Profile facts that cite a version no longer in effect are reported until
  they cite the version in effect or name the version they describe. The
  first record found two: the Ak-Chin Indian Community's compact dispute
  clause, and the Yavapai-Prescott Indian Tribe's, which cites the Ak-Chin
  copy of the 2003 Arizona compact.
- The Federal Register notices of approval that pull request #42 recorded
  are each version's `approval.source`.

## Sources

- The lead author's request: project thread "Build version history for all
  documents," Nov. 21, 2026.
- First record and its research session:
  `content/documents/a/ak-chin-indian-community-arizona-gaming-compact.yaml`;
  `research/sessions/2026/2026-11-21-document-version-history.md`.
- OASIS LegalDocML Technical Committee, *Akoma Ntoso Version 1.0, Part 1: XML
  Vocabulary* (OASIS Standard, 2018),
  [docs.oasis-open.org/legaldocml/akn-core/v1.0/akn-core-v1.0-part1-vocabulary.html](https://docs.oasis-open.org/legaldocml/akn-core/v1.0/akn-core-v1.0-part1-vocabulary.html);
  announcement, [oasis-open.org/?p=4710](https://oasis-open.org/?p=4710)
  (both seen as search results on Nov. 21, 2026; not read in full).
- Compact approval and effect: 25 U.S.C. § 2710(d)(3)(B), (d)(8).
