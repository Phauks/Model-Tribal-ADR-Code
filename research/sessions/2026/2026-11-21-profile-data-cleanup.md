---
id: 2026-11-21-profile-data-cleanup
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Found the duplicates, wrote the merge script, applied the method mapping and checked the
    results record by record for the lead author's review.
- kind: other
  name: python3 scripts
  detail: scripts/tribes/merge_duplicate_sources.py, and a one-time rename of forum kinds.
purpose: >-
  Work through review queue items 3, 4 and 6 of the provisional dispute
  resolution analysis: merge source records that describe the same document,
  remove the repeated provisions they caused, and rename profile forum kinds to
  the method ids added in pull request #5.
queries: []
sources_added: []
limits: >-
  No source was opened; the merges rest on matching addresses, titles and
  record contents. Research session logs and raw research files keep the keys
  as first recorded, so a removed key may still appear there; each kept source
  record lists both sessions in found_in. The forum kind mapping was proposed by
  the United States dispute resolution research session and has not been
  checked against each nation's own text.
---

## Duplicate sources (review queue items 3 and 4)

Two research passes recorded 63 National Indian Law Library tables of contents twice: once with "www." in the address (keys beginning `national-indian-law-library-code-index-`) and once without (keys beginning `national-indian-law-library-code-codes-`). The second record of each pair was kept because it carries the date the library gives for the table of contents. Five other documents were also recorded twice and merged by hand-checked pairs listed in the script: three Native American Rights Fund Indigenous Peacemaking Initiative pages, the North Carolina Commission of Indian Affairs tribal communities page and the Revised Constitution of American Samoa. The Samoa record was edited by hand afterward to keep its original layout.

Pairs that share an address but are different documents were left alone: the Uniform Mediation Act and its enactment kit, A.S.C.A. § 43.0302 and the case that quotes it, and several Michigan court rules and Nevada statutes that sit on one page.

After citations were pointed at the kept keys, 66 provisions repeated another provision in the same profile (same source, title and citation, ignoring section numbers that only one of them gave) and were removed. Distinct sections with the same heading, such as two sections titled "Dispute Resolution," were kept apart.

## Forum kinds (review queue item 6)

Nineteen forum records were renamed to method ids: mediation-program to mediation; family-or-talking-circle to circle-process, or to family-group-conference for the Jamestown S'Klallam, Nisqually and Salt River youth-code conferences; employment-tribunal to administrative-adjudication; traditional-forum to peacemaking (Navajo Nation, Skokomish) or to customary-dispute-resolution (Hopi villages, Sitka, Spirit Lake, Kenaitze); and other to council-hearing (Hopi, Hopland). The Kalispel Traditional Peacemakers Panel stays "other" because no method record fits its role in service and execution of judgments.
