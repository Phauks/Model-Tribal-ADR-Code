---
id: 2026-11-21-data-gap-review
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: python3 scripts
  detail: scripts/review/name_matches.py, compact_clauses.py and court_listings.py gathered the
    evidence; scripts/review/gap_review.py merged the reviewers' verdicts into research/reviews/.
- kind: other
  name: curl and pdftotext
  detail: Downloaded each nation's gaming compacts from the Office of Indian Gaming list and extracted
    their text.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Small-model reviewer agents gave first-pass verdicts; larger-model agents re-checked the
    name joins and read the full text of every compact; the lead session checked every compact
    quotation against the extracted text and every court verdict's evidence address against the
    pages fetched.
purpose: Follow up rows 1, 7 and 11 of the dataset gap audit, checking the facts joined to a nation
  by name, the compact dispute clauses copied from another nation's compact, and the courts copied
  from directory listings, so the lead author can decide what to fix.
queries:
- every profile fact whose note says it was matched to the nation by name, except the Public Law 280
  statutes and the Alaska place-name and region lists
- every gaming.compacts[] fact whose note says "nation-specific text not checked"
- every justice_institutions fact cited to the Tribal Law and Policy Institute directory or a
  National Indian Law Library nation page
sources_added: []
limits: >-
  All verdicts are AI-written leads for the lead author, and no profile was changed. Name joins were
  judged from names alone, without browsing. Compact text came from pdftotext, so scanned compacts
  could not be read. Court verdicts rest on one pass over passages from the pages fetched on Nov. 21,
  2026; a court that is not found on a nation's website may still operate.
---

Output: the [data gap review](../../reviews/2026-11-21-data-gap-review.md), with one spreadsheet each for the [name joins](../../reviews/2026-11-21-name-joins.csv), [compact dispute clauses](../../reviews/2026-11-21-compact-clauses.csv) and [court listings](../../reviews/2026-11-21-court-listings.csv).

Method: the scripts listed the facts each audit row names and gathered the evidence for them: the label each source prints for a name join, each nation's own compacts and their dispute resolution sections, and the listed court link, the nation's website and its court pages. AI reviewers gave a verdict on each item under the briefs in [`research/reviews/briefs/`](../../reviews/briefs/), and a second, larger model re-checked the name joins and the compacts.

Found: 10 name joins tie a component band's facts to its umbrella nation (Minnesota Chippewa Tribe, Paiute Indian Tribe of Utah) and 25 are unsure; 127 of 256 copied compact summaries do not match the nation's own compact; 315 of 690 listed courts were confirmed on the nation's own or an official court site, 47 more under a new address, 170 were not found and 158 could not be checked.

Ruled out: changing any profile. The lead author decides first.
