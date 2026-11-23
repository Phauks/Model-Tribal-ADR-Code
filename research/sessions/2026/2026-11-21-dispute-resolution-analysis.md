---
id: 2026-11-21-dispute-resolution-analysis
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Wrote and ran the analysis script, read the records behind each example and drafted the
    provisional analysis and the roadmap for the lead author's review.
- kind: other
  name: python3 analysis script
  detail: scripts/analysis/dispute_resolution_practice.py, run on the profiles and source records
    at commit 34a68e6.
purpose: Describe the dispute resolution practice recorded in the Native nation profiles, measure how
  much of it rests on read text, flag weak data for the lead author's review, and plan the order of
  work toward drafting the model code.
queries: []
sources_added: []
limits: >-
  No new research was done and no source was opened; every statement rests on the records
  merged in pull request #2 and their research sessions. The data had not been reviewed by the lead
  author. Design features of forums were coded by keyword over recorded summaries, not over the codes
  themselves, so feature counts are approximate (the consent count is an upper bound). Gaming compact
  terms were counted over the 28 distinct summary texts, not per nation.
---

Output: [the provisional analysis](../../analyses/2026-11-21-dispute-resolution-practice.md), its [counts](../../analyses/2026-11-21-dispute-resolution-practice.json) and the [roadmap for documenting the model code](../../../docs/roadmap.md).

Method: the script sorted each provision into three evidence tiers by its own note (text read, section title only, bulk database record), counted forums, clauses, training and materials by kind, coverage by recognition and Bureau of Indian Affairs region, and compact dispute resolution summaries, and listed data quality flags. Examples named in the analysis were checked against the full profile record and its source record before citing.

A message from the United States dispute resolution research thread proposed a mapping from the profiles' forum kinds to the method ids in pull request #5. The roadmap lists it as a step after that pull request merges; no profile was changed.
