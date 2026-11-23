---
id: 2026-11-23-jurisdiction-and-federal-ties
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl (through the session proxy)
- kind: web-search
  name: WebSearch
- kind: other
  name: pdftotext and pdftoppm
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: The lead session filled the Public Law 280 gaps from the statutes and the Bureau of Indian Affairs' list. Research sub-agents gathered the Violence Against Women Act lists, state jurisdiction statutes, Indian Health Service Areas and treaties into raw files; the lead session reviewed each file and built the facts with scripts/jurisdiction/.
purpose: Fill in and extend the Jurisdiction section of nation pages (Trevor asked on Nov. 23, 2026 to start with the fast items from official lists), and add treaties and federal ties.
queries:
- https://www.bia.gov/faqs/what-public-law-280-and-where-does-it-apply
- https://ndlegis.gov/cencode/t27c19.pdf
- https://le.utah.gov/xcode/Title9/Chapter9/C9-9-P2_1800010118000101.pdf
- 'web search: Arizona 1967 Public Law 280 air and water pollution statute; North Dakota Public Law 280 tribal consent; Utah Public Law 280 tribal consent; South Dakota Public Law 280 highways Rosebud Sioux Tribe v. South Dakota; Act of May 31, 1946, 60 Stat. 229 Devils Lake'
- https://www.tribalvawa.org/implementing-tribes and its Special Tribal Criminal Jurisdiction Chart
- https://www.ncai.org/section/vawa/about-vawa-and-stcj/about-stcj
- https://www.justice.gov/ovw/media/1377361/dl?inline=
- https://www.justice.gov/ovw/media/1460186/dl?inline
- https://www.justice.gov/ovw/awards/fy-2025-ovw-grant-awards-program
- https://www.justice.gov/ovw/special-tribal-criminal-jurisdiction-reimbursement-program
sources_added:
- bia-faq-public-law-280
- tribal-law-and-policy-institute-special-tribal-criminal-jurisdiction-chart
- office-on-violence-against-women-2024-update-tribal-consultation-recommendations
- office-on-violence-against-women-fiscal-year-2025-grant-awards-by-program
limits: 'Public Law 280: a nation is placed in a state by the Census Bureau''s land areas, or by its office state when no land is recorded (then medium confidence); "not a Public Law 280 state" is inferred from the state''s absence from the Bureau of Indian Affairs'' two lists. Violence Against Women Act: the Justice Department publishes no list of Tribes exercising special Tribal criminal jurisdiction; the fullest list is the Tribal Law and Policy Institute chart (39 Tribes, undated, file modified Aug. 11, 2026), and the only Department documents naming exercising Tribes are the 14 first-round reimbursement awards of May 2024. Planning grants are recorded separately and never as exercising. The Kiowa Tribe (news report of July 20, 2026 describes a grant to implement) and the Mandan, Hidatsa and Arikara Nation (name match to the Three Affiliated Tribes) rest on the chart alone.'
---

## What was done

Public Law 280. `scripts/jurisdiction/public_law_280_gaps.py` compared each federally recognized nation's states with the six mandatory states and the ten optional states the Bureau of Indian Affairs lists. It added the mandatory-state fact where a profile had none for a state (the five Minnesota Chippewa Tribe bands split out of the combined record, Fond du Lac in Wisconsin, Ho-Chunk in Minnesota, Oglala in Nebraska, Metlakatla for civil jurisdiction, Bois Forte for civil jurisdiction after the 1975 criminal retrocession). Nations whose state retroceded everything (Menominee, Burns Paiute, Santee Sioux) keep only their retroceded fact. Every state that is on neither list got a `not-a-public-law-280-state` fact for each nation with land there (119 facts for 116 nations; 10 mandatory-state facts were added in all). The six Minnesota Chippewa bands also got their own Indian Child Welfare Act agent facts, from their rows in the 2026 notice.

Violence Against Women Act. `scripts/jurisdiction/build_violence_against_women_act.py` added 8 nations the chart marks as having implemented special Tribal criminal jurisdiction, 14 facts from the Justice Department's first reimbursement awards (which pay only for exercising it), and 10 planning-grant facts for nations not otherwise listed.

The facts were written with `scripts/jurisdiction/apply.py`, which appends to each profile without changing its other lines and records each search in `research/search-logs/jurisdiction/`.

## Output

Batches in `research/jurisdiction/`; the Violence Against Women Act research is in `research/raw/2026-11-23/violence-against-women-act-jurisdiction.json`.
