---
id: 2026-11-27-approved-nation-laws
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/approved_nation_laws.py and ran it. 26 list names the script could not match were matched by hand in research/approved-nation-laws/nation-matches.csv; no record was written by hand.
- kind: page-fetch
  name: bia.gov and epa.gov
  detail: The Bureau of Indian Affairs' Approved HEARTH Act Regulations page and every file it links; EPA's Tribes Approved for Treatment as a State page; EPA's Actions on Tribal Water Quality Standards and Contacts page, each nation's water quality standards page it links, and every standards document and eligibility decision those pages link.
purpose: 'Trevor picked new data source category 1, federal approvals of Native nations'' own laws, from the ranked list of new kinds of sources (project thread "Collect approved tribal laws, water settlements and old nation codes", Nov. 27, 2026: "grab 1,2,4"). No other collection held these laws.'
queries:
- Every approval on the Bureau of Indian Affairs' list of approved HEARTH Act leasing regulations, 2013 to 2026, with the file it links
- Every nation EPA lists as approved for treatment in a similar manner as a state, by program
- Every nation EPA lists as eligible to set water quality standards, and the standards and eligibility decisions on its page
sources_added: []
limits: 'Every record and fact is Unverified: the lists were read by script and the documents themselves were not read. The HEARTH list links one file per approval; where an approval was later amended, both files are kept when both are linked, and an amendment linked only to an anchor on the page has no file of its own. EPA''s pages list only what EPA posts: water quality standards for 54 of the 85 eligible nations, and eligibility decisions for 30. EPA notes that parts of a standards document may be disapproved or not in effect for Clean Water Act purposes; its page for the nation says which. Treatment-as-a-state approvals for grant programs only (Clean Water Act §§ 106 and 319, Clean Air Act § 105) are counted on EPA''s page but not listed by nation, so they are not facts.'
---

# Nations' laws approved by federal agencies: session notes

## What was built

`scripts/law/approved_nation_laws.py` has four steps. `fetch` reads the three lists and each nation's water quality standards page and downloads every linked document. `file` stores each document in the bucket under `approved-nation-laws/hearth-act-leasing-regulations/` or `approved-nation-laws/water-quality-standards/`, marked for serving (decision record 0031). `records` writes the source records and the lists in `research/approved-nation-laws/`. `facts` writes `research/jurisdiction/approved-nation-laws.json`, applied with `scripts/jurisdiction/apply.py`.

## Results

- 129 HEARTH Act leasing regulations (kind `tribal-code`, genre "HEARTH Act leasing regulations"), each with its stored copy, approved from 2013 to June 22, 2026, for 101 nations.
- 59 water quality standards documents (kind `tribal-code`), 10 EPA actions on standards and 30 EPA decisions that a nation is eligible to run a standards program (kind `federal-agency-document`), each with its stored copy.
- 2 records for EPA's two list pages, which the treatment-as-a-state facts cite.
- 279 nation-page facts for 172 nations under two new jurisdiction topics (docs/data-model.md): `hearth-act-leasing-regulations` (129) and `environmental-treatment-as-a-state` (150, one per nation per program; EPA's own counts per program match).
- 228 files, 1.23 GB, in the bucket.

The site counts the 230 documents as one collection, "Nations' Laws Approved by Federal Agencies" (`approved-nation-laws` in `site/src/lib/server/collections.ts`), and leaves them out of "Codes and Laws" so they are not counted twice.

## Matching

Nations are matched by name with `scripts/law/nation_names.py`. Until PR #551's guard lands on main, a Confederated Salish and Kootenai Tribes match also needs "Salish", "Kootenai" or "Flathead" in the name. 26 names were matched by hand (`research/approved-nation-laws/nation-matches.csv`). The Shivwits Band of Paiutes' regulations are linked to the Paiute Indian Tribe of Utah, of which it is a constituent band, and the fact names the band; the Fond du Lac and Leech Lake bands are linked to their own profiles, not the Minnesota Chippewa Tribe's.

## Next

A watcher for the three lists (`approved-nation-laws` in `site/watch/watchers/index.ts`, planned). Two smaller lists of the same kind, nations exercising special Tribal criminal jurisdiction (already a jurisdiction topic) and probate codes approved under the American Indian Probate Reform Act, are not built.
