---
id: 2026-11-21-peacemaking-programs
date: 2026-11-21
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: >-
    Lead session checked the repository for earlier peacemaking work, split the
    search into six regional and topical slices, and gave each to a research
    helper (two on a larger model for Navajo sources and for scholarship and
    evaluations, four on a smaller model for regional program sweeps). Each
    helper returned structured findings with the pages it opened. The lead
    session then downloaded every cited page it could reach and checked each
    quotation word for word against the page text (59 of 79 matched; the
    rest were dropped, corrected, or marked as read through a fetch tool).
- kind: web-search
  name: Web search
- kind: page-fetch
  name: Web page fetch tool
  detail: >-
    Used by the helpers. A shared hourly limit on fetches ran out part way
    through, which cut short the Plains, Southwest, California and Nevada
    sweeps and the reading of paywalled or blocked scholarship.
- kind: page-fetch
  name: Direct downloads (curl) with PDF text extraction (pdftotext)
  detail: >-
    Used by the lead session to re-check quotations and page numbers. Sites
    that refuse automated downloads (the Navajo Nation Judicial Branch, some
    university repositories behind a browser challenge) could not be re-checked
    this way; the records say so.
purpose: >-
  Research peacemaking as its own track (charter, commitment 3): how Native
  nations' peacemaking programs operate, their history, scholarship and
  evaluations, building on the peacemaking codes already collected rather than
  collecting them again.
queries:
- Navajo Nation Judicial Branch Peacemaking Program plan of operations annual report
- Eric Gross Navajo peacemaking evaluation NIJ 97-IJ-CX-0039
- Coker Navajo peacemaking domestic violence UCLA Law Review; Theoretical Criminology
- Zion Navajo Peacemaker Court American Indian Law Review 1983; Bluehouse Zion Hozhooji Naat'aanii
- Little Traverse Bay Bands peacemaking; Little River Band peacemaking; Ho-Chunk Traditional Court
- Seneca Nation Peacemakers Court; Oneida Nation judiciary peacemaking; White Earth peacemaking
- Mashpee Wampanoag Peacemakers Court; Pokagon Native Justice; Lac Courte Oreilles peacemaking
- Grand Ronde Tribal Court peacemaker program; Tulalip elders panel; Coos Lower Umpqua Siuslaw Peacegiving Court
- Cow Creek peacemaker training Title 45; Wilton Rancheria Traditional Court; Colville peacemaking program
- Chickasaw Peacemaking Court; Choctaw Nation Peacemaking Act; Prairie Band Potawatomi Peacemakers Circle
- Kiowa Peacemaking Act; Kickapoo Traditional Tribe of Texas Peacemaker System; Mississippi Choctaw Peacemaker Court
- Kake Circle Peacemaking Honoring Nations; Tlingit Haida Court of Elders; Sitka children's code traditional dispute resolution
- Alaska v. Native Village of Venetie; John v. Baker; State v. Central Council of Tlingit and Haida 2016
- Indian Law and Order Commission Roadmap peacemaking Alaska chapter
- Center for Court Innovation Red Hook peacemaking evaluation; Widening the Circle; Peacemaking Today
- Melton Indigenous Justice Systems Judicature; Goldberg Overextended Borrowing; Valencia-Weber Tribal Courts Custom
sources_added:
- gross-1999-navajo-peacemaking-family-court-surveys
- navajo-peacemaking-program-brochure-2025
- navajo-judicial-branch-annual-report-fy2022
- navajo-judicial-branch-quarterly-report-fy2025-q4
- navajo-peacemaking-new-mexico-legislature-handout-2016
- nielsen-zion-2005-navajo-nation-peacemaking
- zion-1983-navajo-peacemaker-court
- bluehouse-zion-1993-hozhooji-naataanii
- coker-1999-enhancing-autonomy-navajo-peacemaking
- coker-2006-restorative-justice-navajo-peacemaking-domestic-violence
- little-river-peacemaking-page
- ho-chunk-traditional-court-page
- seneca-nation-judicial-page
- oneida-nation-peacemaking-page
- white-earth-peacemaking-page
- mashpee-peacemakers-page
- lac-courte-oreilles-peacemaking-ncorj-summary
- grand-ronde-tribal-court-page
- grand-ronde-peacemaker-program-ncorj-summary
- coos-peacegiving-court-page
- coos-peacegiving-court-amendment-notice-2026
- cow-creek-peacemaker-training-2024
- wilton-rancheria-traditional-court-page
- tribal-justice-colville-peacemaking-podcast-2018
- chickasaw-peacemaking-court-page
- prairie-band-potawatomi-code-2-5-1-peacemakers-circle
- kiowa-peacemaking-act-ncorj
- kickapoo-texas-tribal-code-chapter-1
- mississippi-choctaw-honoring-nations-presentation-2005
- honoring-nations-2003-kake-circle-peacemaking
- narf-ipi-kake-circle-peacemaking-profile
- state-v-central-council-tlingit-haida-2016
- indian-law-and-order-commission-2013-roadmap
- lambson-2015-red-hook-peacemaking-evaluation
- sasson-sydow-2017-inspired-by-peacemaking
- wolf-2012-widening-the-circle
- wolf-2012-peacemaking-today
- mirsky-2004-native-restorative-justice-practices-part-one
- narf-ipi-peacemaking-publications
limits: >-
  Not exhaustive. The fetch limit stopped the sweeps before they reached most
  Plains and Southwest nations (Northern Arapaho, Eastern Shoshone, Spirit
  Lake, Standing Rock, Turtle Mountain, Rosebud, Oglala, Cheyenne River,
  Chippewa Cree, Blackfeet, Fort Peck, Santee, Laguna, Hopi, Pascua Yaqui,
  Salt River, Tohono O'odham, Gila River, White Mountain Apache, the Ute
  nations), several California and Puget Sound nations, Nevada nations, and
  Alaska regional organizations (Tanana Chiefs Conference, Association of
  Village Council Presidents, Alaska Native Justice Center). Most scholarship
  was read at abstract or catalog level only: Yazzie 1994, Zion 1983,
  Bluehouse & Zion 1993, both Coker articles, Melton 1995, Valencia-Weber 1994,
  Goldberg 1997 and Nielsen & Zion 2005. Navajo Judicial Branch reports and the
  brochure were read only through the fetch tool. Nation web pages were used
  for structure and procedure only; ceremonial, clan and spiritual content was
  left out on purpose (charter; CARE).
---

## What already existed

Earlier sessions had collected about forty peacemaking codes and rules,
mostly from the Native American Rights Fund's Indigenous Peacemaking
Initiative model-law pages, and recorded peacemaking forums on 37 nations'
profiles (session `2026-11-21-dispute-resolution-practice`). Section 2 of the
dispute resolution practice analysis counted shared structural features. The
`peacemaking` method record, its glossary entry and three scholarly sources
(Porter 1997, read; Yazzie 1994 and Goldberg 1997, not read in full) were in
place. No session had looked at how programs operate, at evaluations, or at
the scholarship as a body.

## What this session did

1. Program sweeps by region, starting from each nation's own court or
   judicial pages and only then going to secondary sources.
2. Navajo Nation in depth: the Plan of Operations, Judicial Branch reports,
   the Gross evaluation, and the main scholarship.
3. Scholarship and evaluations across nations, including state-court
   programs modeled on Native peacemaking.
4. Alaska: Kake Circle Peacemaking, Tlingit & Haida's Court of Elders, and
   the case law on Tribal jurisdiction without Indian country.
5. Verification by the lead session (see tools). Quotations that could not be
   matched were dropped or marked; one helper's figure (a 45 percent survey
   result attributed to a 2012 Center for Court Innovation paper) was not
   found in either paper and is not used.

## Ruled out or corrected

- The Gross evaluation is dated February 1999, not about 2001 as first
  assumed.
- The Seneca Nation's Peacemakers Court is an elected trial court, not a
  peacemaking program, despite the name.
- The Tulalip Mediation Services page describes mediation by an outside
  provider, not peacemaking.
- The Navajo Nation's 2012 Plan of Operations mentions a 2012 observation of
  peacemaking convened by another nation's elders; it is not Navajo practice
  and is not used.
- Yakutat: the earlier training record does not name the Yakutat Tlingit
  Tribe, so it is not treated as evidence of a Yakutat program.

The findings are written up in
[research/analyses/2026-11-21-peacemaking-programs.md](../../analyses/2026-11-21-peacemaking-programs.md).
