---
id: 2026-11-24-legal-help-providers
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session searched the web, read each provider's pages with a page reader and a headless browser, read the Legal Services Corporation's service area data, wrote the provider records and scripts/legal-help/match_nations.py, and matched records to nation pages. A fetch service read six pages that block automated readers.
- kind: page-fetch
  name: lsc.gov, api.lscdataease.org, lsc-live.app.box.com, federalregister.gov, providers' own sites, state court and legal help sites, Washington 211, Minnesota State Law Library
  detail: The Legal Services Corporation's service area feed and per-area records, its 2026 notice of intent to award, its 2016 award chart and three Federal Register notices; each provider's own page where one exists.
purpose: 'Trevor asked (Nov. 24, 2026) to identify tribal law self-help centers around the country and which states and nations they may serve, to integrate into the nation pages and the assistance queue.'
queries:
- Which organizations hold the Legal Services Corporation's Native American service areas, and which states and nations does each area cover
- Which tribal courts run self-help centers
- Which state courts and state legal help sites have tribal court or Native American pages
- Which nations run legal aid offices for their members (checked for nations left without a match)
sources_added: []
limits: 'The tribal legal aid offices were found while checking gaps, not by a search of every nation''s site. Pages for Choctaw Nation, Cheyenne and Arapaho, Idaho Legal Aid, New Mexico Legal Aid, Oklahoma Indian Legal Services and the Bureau of Indian Affairs court list were read through a fetch service because they block automated readers; DNA-People''s Legal Services and the Poarch Band announcement were not read. Every record awaits the lead author''s review.'
---

# Tribal law legal help and self-help centers: session notes

The findings and gap list are in [the Nov. 24, 2026 note](../../analyses/2026-11-24-legal-help-providers.md); the records are in [`research/legal-help/`](../../legal-help/README.md).

## Legal Services Corporation data

The LSC service area page loads a map whose script fetches `https://api.lscdataease.org/public/lsc/service_areas/<area>/about.json` for each area; `service_areas.json` returns all 190 areas. Its 27 Native American areas match LSC's own count and the 2016 award chart's list. Grantee names and 2026 amounts come from the notice of intent to award, downloaded from LSC's Box link on its Matters for Comment page. Captures are in the working files under `research/legal-help/captures/lsc/`.

## Searches that found little

"Tribal court self-help center" searches return the same few courts (Karuk, Wilton Rancheria, the Bureau of Indian Affairs Western Region court) and a content-farm article on the Navajo center, which was replaced by the Judicial Branch's own quarterly report. The Northern California Tribal Court Coalition's self-help page returned 404. Self-Help Washington's tribal courts page is a placeholder.
