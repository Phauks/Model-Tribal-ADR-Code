---
id: 2026-11-23-dispute-resolution-retry
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Search workers ran at most 3 web searches per nation for the 62 nations left partly-searched on Nov. 22 and read official pages they found. The lead session read the archived copies, the scanned San Manuel arbitration ordinance from page images, and the 2022 Alaska Tribal Court Directory in full.
- kind: page-fetch
  name: Wayback Machine (web.archive.org), through the repository's "fetch archived copies" workflow
  detail: Three rounds of archived copies of pages that had failed, and capture index queries for the nations' sites; the workflow returned them encrypted, since cloud sessions cannot reach the Wayback Machine.
- kind: other
  name: scripts/review/dispute_resolution_retry.py
  detail: Wrote the review, the candidate CSV and the counts, and appended the searches to the dispute-resolution search logs.
purpose: Try again for the 62 nations whose dispute resolution search was only partly done on Nov. 22, 2026, and record every place looked.
queries:
- dispute resolution, mediation, arbitration, peacemaking, talking or healing circles, elders' courts and councils, restorative justice
- tribal code, court rules and court pages of each nation
- the 2022 Alaska Tribal Court Directory entries (types of cases heard, diversion agreements)
sources_added: []
limits: Web searches were limited to 3 per nation and read by AI workers whose quotes were not checked word for word. Many archived copies did not answer in three rounds. Archived pages can be years old. The Shoshone and Arapaho draft Peacemaker Court title was not fetched because the tribe has not allowed its full text online. 10 nations stay partly-searched.
---

# Dispute resolution search, second try

## What was done

The 62 nations left `partly-searched` by the Nov. 22 coverage search were searched again: web searches by AI search workers under the [brief](../../reviews/briefs/2026-11-23-dispute-resolution-retry.md), archived copies of the failed pages fetched by the "fetch archived copies" workflow, and the 2022 Alaska Tribal Court Directory read in full. `scripts/review/dispute_resolution_retry.py` wrote the [review](../../reviews/2026-11-23-dispute-resolution-retry.md) and appended 294 searches to the search logs.

## Result

12 candidates for 11 of the 62 nations, among them the Coeur d'Alene Tribal Arbitration Act, the San Manuel Arbitration Ordinance (2004), a draft Shoshone and Arapaho Peacemaker Court title (1989), the White Mountain Court of Elders ordinance, Red Lake's Ojibwe Culture Based Mediation Court (2007) and Kwigillingok's peacemaking cases. The directory also showed 14 Alaska nations outside the retry whose tribal courts list dispute resolution or peacemaking; seven of their logs had been `none-found`. Logs of the 62: 11 `found`, 41 `none-found`, 10 still `partly-searched`.

## Not done

No profile was changed and no source record was added. Still to do:

- using the 27 kept candidates (all marked keep under the grab-now rule; weak ones flagged);
- the archived pages that did not answer and the scanned PDFs not read, listed in the 10 logs' `next_steps`;
- a call to the offices of nations with nothing found.
