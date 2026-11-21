---
id: 2026-11-21-provision-pre-review
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: page fetch (curl with browser user agent)
  detail: Fetched every link and locator cited by the 1,327 provision records (1,358 addresses).
- kind: other
  name: pdftotext
- kind: other
  name: python3 script
  detail: scripts/review/provision_pre_review.py, which matched each record to the cited passage,
    flagged likely duplicates, batched the evidence and merged the verdicts.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Twenty-nine first-pass reviewer agents each judged one batch of records from the fetched
    evidence; six second-pass agents re-checked 114 hard cases, searching the full text and refetching
    sources where needed; the lead session wrote the briefs, validated every verdict file, spot-checked
    a sample against the evidence and wrote the report for the lead author's review.
purpose: Check each dispute resolution provision record in the Native nation profiles against its cited
  source, and suggest for each whether to keep, relabel, merge, drop or decide on scope, as pre-review
  findings for the lead author.
queries:
- every link and locator URL in content/tribes/*/*.yaml dispute_resolution.provisions
- 938 National Center on Restorative Justice record pages (ncorj.org/tribal-law/...)
- National Indian Law Library tribal code tables of contents cited by title-only records
- second pass only, for hard cases; current code pages and PDFs of the nations concerned
sources_added: []
limits: >-
  No profile or source record was changed. The verdicts were written by AI assistants and are
  pre-review findings, not the lead author's review. Many bulk records link to general pages, so their
  existence rests on the database's quotation. Sixty-two addresses refused automated access and twelve
  were not found; 41 records could not be verified at all. Some second-pass quotations are
  transcriptions from page images. Fetched code versions may be newer than the version a record was
  taken from.
---

Output: [the pre-review report](../../reviews/2026-11-21-provision-pre-review.md),
its [verdicts](../../reviews/2026-11-21-provision-pre-review.json),
the same as a [spreadsheet](../../reviews/2026-11-21-provision-pre-review.csv),
its [counts](../../reviews/2026-11-21-provision-pre-review-counts.json) and the
reviewers' [briefs](../../reviews/briefs/).

Method: the provisional analysis of dispute resolution practice (pull request
#10) placed 938 provisions in the bulk database tier and 291 in the title-only
tier, and asked for them to be checked one by one. This session fetched every
cited page, matched each record to the passage nearest its title or section
number, and gave the evidence to reviewer agents in batches of about 45
records, keeping each nation's records together so duplicates could be found.
A second, more careful pass re-checked records the first pass could not
verify, rated low confidence or proposed to drop although they were labeled
with a dispute resolution kind. The second pass changed 53 of 114 verdicts.

Ruled out: no record was deleted or edited, and the scope question (whether
diversion and restorative sentencing belong in the code) was flagged for the
lead author rather than decided.
