# Data reviews

Each review checks records the project already holds against their sources
and writes its findings beside them, for the lead author to accept, change or
reject. A review never edits a record. Changes it leads to are made in a
separate pull request after the lead author decides.

| Review | Covers | Files |
| --- | --- | --- |
| [Provision pre-review, Nov. 21, 2026](2026-11-21-provision-pre-review.md) | All 1,327 dispute resolution provision records in `content/tribes/` | report, `.json` (one record per provision), `.csv` (the same as a spreadsheet, with an empty decision column), `-counts.json`, and the reviewers' [briefs](briefs/) |
| Verification levels, Nov. 21, 2026 | The level (`read-in-full`, `title-only`, `bulk-import`, `inferred`) given to each of 869 groups of profile facts whose note does not say how the fact was checked, as used by `scripts/review/gap_review.py levels` | `2026-11-21-verification-levels.json` and `.csv` (one row per group, with the reviewer's reason), and the reviewers' [brief](briefs/2026-11-21-verification-levels.md) |
| [Data gap review, Nov. 21, 2026](2026-11-21-data-gap-review.md) | Rows 1, 7 and 11 of the [dataset gap audit](../analyses/2026-11-21-dataset-gap-audit.md): 3,778 name joins behind 4,309 facts, 256 compact dispute clauses copied from another nation's compact, and 690 courts listed from directories | report, `2026-11-21-name-joins`, `2026-11-21-compact-clauses` and `2026-11-21-court-listings` (each `.json` and `.csv` with an empty decision column), `2026-11-21-data-gap-review-counts.json`, and the reviewers' [briefs](briefs/) |
| [Second data gap review, Nov. 22, 2026](2026-11-22-second-gap-review.md) | Rows 4, 8, 10, 12, 15, 16, 20, 21 and 23 of the audit: quotations in method and glossary records, 581 ICWA designated agent facts, 1,577 governing document links, government structure, petition status, gaming report links, 5,386 source links and 30 outreach search results, as gathered by `scripts/review/second_gap_review.py` | report, `2026-11-22-petition-status`, `-icwa-agents`, `-quotations`, `-outreach-search-results`, `-source-links` and `-governing-documents` (each `.csv` with an empty decision column), `2026-11-22-second-gap-review.json` and `-counts.json`, and the reviewers' [briefs](briefs/) |
| Compact clause re-check, Nov. 22, 2026 | The 86 compact dispute clauses the data gap review left undecided, each given a third reading of the nation's own compact or Secretarial Procedures (row 1 of the gap audit); the 81 that came out clear were applied with `scripts/review/gap_review.py rewrite-compacts` and 5 wait for the lead author | `2026-11-22-compact-clauses-recheck.json` and `.csv` (one row per clause, with an empty decision column), and the [brief](briefs/2026-11-22-compact-clauses-recheck.md) |
| [Dispute resolution coverage, Nov. 22, 2026](2026-11-22-dispute-resolution-coverage.md) | Row 2 of the dataset gap audit: every federally recognized nation with no dispute resolution record, searched in the project's own captures, on the National Indian Law Library, the nation's website, court pages and code sites | report, `2026-11-22-dispute-resolution-coverage.json` and `.csv` (one row per candidate, with an empty decision column), `-counts.json`, the reviewers' [brief](briefs/2026-11-22-dispute-resolution-coverage.md), and one [search log](../search-logs/README.md) per nation |

Each file name starts with the date of the review, so a later review of the
same records sits beside the earlier one instead of replacing it.
