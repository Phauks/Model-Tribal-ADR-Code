---
id: 2026-11-21-peacemaking-second-sweep
date: 2026-11-21
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: >-
    Follow-up to session 2026-11-21-peacemaking-programs. The lead session split
    the regions that session did not reach into six slices and gave each to a
    research helper on a smaller model. Each helper saved every page it cited.
    The lead session then checked each quotation against the saved pages by
    script (104 of 114 matched), read three image-only documents by eye
    (Isleta, Snoqualmie and part of Hualapai), and re-checked the Navajo
    caseload figures itself.
- kind: web-search
  name: Web search
- kind: page-fetch
  name: Direct downloads (curl) with PDF text extraction (pdftotext)
  detail: >-
    Used by the helpers and the lead session. Sites that refused automated
    downloads or showed a bot challenge were not pursued (Swinomish, Southern
    Ute, Meskwaki, the Karuk code host, NARF's model-law PDFs and the Navajo
    Nation Judicial Branch site). The Navajo quarterly reports were read in
    the copies the Navajo Nation Council posts on its own site.
- kind: page-fetch
  name: Web page fetch tool
  detail: Used sparingly by the helpers where a direct download failed.
purpose: >-
  Second sweep of the peacemaking track: the Plains, Southwest, Nevada,
  California, Washington and Idaho nations and the Alaska regional Native
  organizations that the first sweep did not reach, and a re-check of the
  Navajo Judicial Branch figures.
queries:
- Navajo Nation Judicial Branch quarterly report peacemaking program fiscal year 2025 and 2026
- <nation> tribal court peacemaking OR peacemaker OR traditional court (one search per nation in each slice)
- Spirit Lake Wodakota Traditional Court; Standing Rock children's code peacemaking; Santee pre-trial conference traditional
- Chippewa Cree traditional peacemakers; Northern Arapaho Eastern Shoshone peacemaker court Wyoming Lawyer
- Pueblo of Isleta peacemaking program rules; Zuni customary pretrial conference; Acoma Fiscales mediation; Hopi village family disputes
- Habematolel Pomo judicial code peacemaker; Karuk Peacemaker Mediation Forum; Nevada tribal courts Nevada Lawyer 2024
- Skokomish traditional peacemaking forum; Snoqualmie Peacemaker Court; Northwest Intertribal Court System peacemaking
- Alaska Criminal Rule 11(i) restorative justice plan; statewide restorative justice procedures Alaska presiding judges
- Tanana Chiefs Conference tribal court; AVCP tribal justice center; Kawerak circle peacemaking; Alaska Judicial Council Resolving Disputes Locally 1993
sources_added:
- navajo-judicial-branch-quarterly-report-fy2026-q1
- navajo-judicial-branch-quarterly-report-fy2026-q2
- zuni-tribal-code-2022
- acoma-tribal-code-title-1-2026
- mescalero-apache-tribal-court-handbook-2012
- hopi-constitution-1936-naair
- havre-daily-news-2010-traditional-peacemakers
- sdpb-2023-oyate-court
- omaha-code-11-5-12-ncorj-summary
- standing-rock-children-code-6-814-ncorj-summary
- santee-code-title-1-sec-11-ncorj-summary
- sisseton-wahpeton-judicial-code-chapter-21-2025
- baldwin-2005-peacemaker-court-wyoming-lawyer
- nevada-lawyer-2024-nevadas-tribal-courts
- habematolel-pomo-judicial-code-2021
- alaska-trial-courts-statewide-restorative-justice-procedures-2024
- alaska-court-system-nenana-peacemaking-circle-plan
- alaska-court-system-minto-restorative-justice-plan
- narf-ipi-2018-alaska-state-court-circle-sentencing
- alaska-judicial-council-1993-resolving-disputes-locally
- hyslop-2012-restorative-justice-rural-alaska
- kawerak-tribal-legal-services-page
- alaska-public-media-2015-avcp-tribal-court-every-village
- anjc-tribal-justice-support-page
- tcc-tribal-court-governance-page
limits: >-
  A "none found" result means only that no peacemaking process appeared on
  the nation's court pages and codes the helpers could open; many nations do
  not publish their codes, and some processes are not written down at all.
  Not reached or blocked: Salt River, White Mountain Apache, San Carlos,
  Jicarilla, Southern Ute, Fort Belknap, Crow, Meskwaki, Swinomish, Quinault,
  Pechanga, Iipay, Te-Moak, Duck Valley and most New Mexico Pueblos. The
  Navajo FY2022 annual report and the 2025 brochure are still unchecked: the
  Judicial Branch site refuses direct downloads, and the Wayback Machine copy
  of the brochure was blocked by this environment's network policy. Most
  Alaska regional information is from a 1993 report. No scholarship was read
  beyond abstracts. Ceremonial and spiritual content on program pages was
  left out on purpose (charter; CARE).
---

## What this session added

The first sweep (session `2026-11-21-peacemaking-programs`) covered the Navajo Nation, the Great Lakes and Northeast, Oregon and part of Washington, Oklahoma and the South, and four Alaska Tribes. This session covered the regions it listed as not reached, and re-checked the Navajo figures it had read only through a fetch tool.

Findings are written into [research/analyses/2026-11-21-peacemaking-programs.md](../../analyses/2026-11-21-peacemaking-programs.md) (sections 3 and 7).

## Nations checked with no peacemaking process found

On the court pages and codes opened, no peacemaking process was found for these nations. This is a statement about the pages, not about the nations (project analysis):

- **Northern Plains:** Standing Rock (beyond a juvenile disposition option), Turtle Mountain, Mandan Hidatsa and Arikara, Rosebud, Oglala, Cheyenne River, Yankton, Lower Brule, Crow Creek, Winnebago (its Traditional Wellness Court is a treatment court) and Omaha.
- **Montana, Wyoming, Kansas, Iowa:** Blackfeet (its alternative court was a substance-abuse pilot), Fort Peck, Northern Cheyenne, Confederated Salish and Kootenai, Little Shell, Kickapoo Tribe in Kansas, Iowa Tribe of Kansas and Nebraska, Sac and Fox Nation of Missouri.
- **Southwest:** Laguna, Pascua Yaqui, Tohono O'odham, Gila River, Ute Mountain Ute, Ute Indian Tribe of the Uintah and Ouray Reservation.
- **Nevada:** Pyramid Lake, Reno-Sparks, Washoe, Walker River, Las Vegas Paiute, Moapa, Fallon, Yerington.
- **California:** Hoopa Valley, Bishop Paiute, Shingle Springs, Tule River (it hosted a 2026 NARF peacemaking training).
- **Washington and Idaho:** Muckleshoot (its court lists healing circles), Nisqually, Port Gamble S'Klallam, Suquamish, Lummi, Squaxin Island, Puyallup, Nooksack, Makah, Yakama, Spokane, Coeur d'Alene, Shoshone-Bannock, and the Northwest Intertribal Court System.

Already covered by the code-text pass and not repeated here: Northern Arapaho, Spirit Lake, Nez Perce, Skokomish, Snoqualmie, Hopland, Pit River, Karuk and Kalispel.

## Checks and corrections

- **Navajo figures.** The fiscal year 2025 fourth-quarter figures (100 new, 61 closed, 97 pending) match the copy posted by the Navajo Nation Council. Two later quarters were added. The spring 2026 report gives two different new-case counts for the same quarter (65 in the narrative, 129 in the statistics), with no explanation.
- **Chippewa Cree.** A helper reported "about 250 cases a year" for the Traditional Peacemaker Circle. The article gives 250 as the child support office's yearly caseload, not a peacemaking count. Corrected.
- **Nez Perce.** A helper's quotation that peacemaker agreements "are not enforceable" comes from § 1-8-11, which covers matters brought by people outside the court's jurisdiction. Agreements in referred cases can be entered as judgments under § 1-8-10. Both are in the code-text pass.
- **NARF model-law PDFs.** Direct requests for the NARF copies of the Isleta, Nez Perce, Skokomish and Snoqualmie codes returned 404 on Nov. 21, 2026, while NARF's list page still links them and refused the request itself (406). This looks like a block on automated requests, not a move (project analysis), so the records were not marked as moved. Each nation also publishes its own copy (Isleta, Nez Perce, Skokomish, Snoqualmie), which the helpers read.
- **Helper user agent.** One helper sent a custom user agent on its first batch of downloads, against the brief. It reports that no site had refused it; the pages it used were re-checked by the lead session.
