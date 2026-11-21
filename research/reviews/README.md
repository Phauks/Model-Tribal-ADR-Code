# Data reviews

Each review checks records the project already holds against their sources
and writes its findings beside them, for the lead author to accept, change or
reject. A review never edits a record. Changes it leads to are made in a
separate pull request after the lead author decides.

| Review | Covers | Files |
| --- | --- | --- |
| [Provision pre-review, Nov. 21, 2026](2026-11-21-provision-pre-review.md) | All 1,327 dispute resolution provision records in `content/tribes/` | report, `.json` (one record per provision), `.csv` (the same as a spreadsheet, with an empty decision column), `-counts.json`, and the reviewers' [briefs](briefs/) |
| Verification levels, Nov. 21, 2026 | The level (`read-in-full`, `title-only`, `bulk-import`, `inferred`) given to each of 869 groups of profile facts whose note does not say how the fact was checked, as used by `scripts/review/gap_review.py levels` | `2026-11-21-verification-levels.json` and `.csv` (one row per group, with the reviewer's reason), and the reviewers' [brief](briefs/2026-11-21-verification-levels.md) |

Each file name starts with the date of the review, so a later review of the
same records sits beside the earlier one instead of replacing it.
