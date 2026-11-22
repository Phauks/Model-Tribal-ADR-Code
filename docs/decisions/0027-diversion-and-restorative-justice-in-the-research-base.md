# 0027. Keep diversion and restorative justice records in the research base

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

The pre-review of the 1,327 provision records checked each record against its cited source and suggested keep, relabel, merge, drop or check source for each one ([report](../../research/reviews/2026-11-21-provision-pre-review.md)). It left one question for the lead author. In 161 records a criminal, juvenile or child welfare case goes to a conference, circle, peacemaker or community board (121 of them diversion to a consensual process, 23 restorative sentencing). Are those within the project's research, or does it cover civil and family disputes only? The pre-review's verdicts were written by AI reviewers, and a second pass changed 53 of the 114 hardest calls (same report, "Method"), so they needed the lead author's decision before any profile changed. That decision is Gate 1 of the [roadmap](../roadmap.md).

## Decision

On Nov. 22, 2026 the lead author made two choices.

- **Scope:** diversion to a consensual process and restorative justice stay in the research base. The 161 scope-question records are kept, and so are the 12 restorative sentencing records the reviewers had suggested dropping.
- **The rest:** the lead author accepted the pre-review's recommendations for now, and plans to review in depth what comes next, the model code itself.

`scripts/review/apply_provision_decisions.py` applied these choices to the profiles and wrote each record's outcome to the `lead_author_decision` column of the pre-review's JSON and CSV files:

- Records judged not to be dispute resolution were removed: treatment courts, services, probation and ordinary court steps.
- Duplicates were removed and the record they repeat was kept. Where a provision repeated a database listing, the provision stayed and the listing went, because a listing is only a lead (decision record 0015).
- Kinds changed where the reviewers suggested one of the schema's suggested kinds. The reviewers' other relabel notes, on titles, citations and new kind terms, are left for the reading pass.
- The 41 records whose source nobody could read are unchanged until the text is pulled. They are on the pull list, `documents-to-get.md` in the project files, sections 1e, 2f and 4c.
- Surviving provisions that had no verification level got one from the pre-review's evidence: `read-in-full` where the text was read, `title-only` where only a section title was seen (decision record 0014).

## Consequences

- Provisions fall from 323 to 229 and database listings from 938 to 258 (counts from the script's run on Nov. 22, 2026). The removed records stay in the pre-review files and in the repository's history.
- The kept listings are still leads. Each moves to `provisions` only after the law it names is read and summarized (decision record 0015).
- This decision covers the research base, not the code's text. How far the model code reaches into diversion is a drafting question, settled in the working outline (`docs/outline.md`) and at Gate 2.
- The dispute resolution analysis should be re-run on the reviewed data (roadmap step 1, "Reviewed evidence").

## Sources

- Lead author's decision in the provision review thread, Nov. 22, 2026: "i think that i will trust you for now in your recommendations" and "yes for diversion and resotrative justice".
- Pre-review report and verdicts: `research/reviews/2026-11-21-provision-pre-review.md` and `.json` (PR #19).
- Database listings: decision record 0015. Verification levels: decision record 0014.
