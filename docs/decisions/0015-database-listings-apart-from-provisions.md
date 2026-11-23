# 0015. Keep bulk database entries apart from dispute resolution provisions

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The first research pass copied 938 entries from the National Center on Restorative Justice Restorative Justice Tribal Laws Database into each nation's `dispute_resolution.provisions` without opening the laws they list. They made up 71 percent of the provision records, and the project assigned their `kind` by a rule from the database's tags, so 857 were labeled "other" ([provisional analysis, section 5 and review queue item 1](../../research/analyses/2026-11-21-dispute-resolution-practice.md#5-the-restorative-justice-database-records)). By the database's own tags, most concern diversion, treatment or sentencing in criminal, juvenile and child welfare matters rather than the resolution of a dispute between parties (project analysis of the database's tags). Counting them as provisions would overstate both how much of the record was read and how much of it is about dispute resolution.

## Decision

The lead author chose on Nov. 21, 2026 to move these entries to a separate field rather than keep them as provisions or drop them.

- Entries copied in bulk from a database or directory of tribal laws live in `dispute_resolution.database_listings` (`schemas/tribe.schema.json`).
- Each keeps the database's title, citation, link and locator, and the database's own tags in `practice_area`, `phase` and `form_of_practice`, exactly as the database writes them. The rule-assigned `kind` is dropped.
- Each carries `verification: bulk-import` (decision record 0014).
- A listing is a lead, not a provision. It moves to `provisions` only after the law it names is read, with a `kind` and a summary written from the text.
- Records that cite the database but were read and summarized by hand stay in `provisions` (four at the time of the move).
- `scripts/tribes/move_database_listings.py` made the move.

## Consequences

- Provision counts now describe only records the project wrote from a law's text or its section titles: 323 provisions remain, and 80 of the 184 profiles with any dispute resolution record have database listings only (`research/analyses/2026-11-21-dispute-resolution-practice-rerun.json`).
- The pre-review of provision records (`research/reviews/2026-11-21-provision-pre-review.json`) names records by profile and position, which the move changes. Match its bulk records to listings by `locator`, which is the database entry's address.
- Triage of the listings (keep, promote to a provision after reading, or drop) remains part of Gate 1 of the [roadmap](../roadmap.md).
- The 15 forum records that cite the database are unchanged; they were written as forums, not copied in bulk.

## Sources

- Lead author's choice on the review queue decision, Nov. 21, 2026 (project thread).
- Provisional analysis, review queue item 1: `research/analyses/2026-11-21-dispute-resolution-practice.md`.
- Verification levels: decision record 0014.
