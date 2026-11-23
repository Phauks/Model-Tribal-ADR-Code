---
id: 2026-11-21-federal-list-import
date: 2026-11-21
researchers: [Trevor Goldsmith, Claude (AI assistant)]
tools:
  - kind: web-search
    name: Federal Register API
    detail: Searched documents from the Bureau of Indian Affairs titled "Indian Entities Recognized" to find the newest list.
  - kind: page-fetch
    name: govinfo.gov
    detail: Downloaded the PDF and text editions of FR Doc. 2026-01899.
  - kind: other
    name: ArcGIS REST query
    detail: Queried every row of the Bureau of Indian Affairs Tribal Leaders Directory feature service.
  - kind: archive
    name: Wayback Machine availability API
    detail: Found existing captures of the list and the directory page.
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Wrote and ran scripts/tribes/federal_facts.py to parse the list, match it to the directory and emit cited facts.
purpose: Start the Native nations dataset with one profile per federally recognized entity, with official office contacts.
queries:
  - https://www.federalregister.gov/api/v1/documents.json?conditions[term]="Indian Entities Recognized"&conditions[agencies][]=indian-affairs-bureau&order=newest
  - https://www.govinfo.gov/content/pkg/FR-2026-01-30/html/2026-01899.htm
  - https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0/query?where=1=1&outFields=*&returnGeometry=false&f=json
  - https://archive.org/wayback/available?url=https://www.govinfo.gov/content/pkg/FR-2026-01-30/pdf/2026-01899.pdf
sources_added:
  - bia-recognized-entities-2026
  - bia-tribal-leaders-directory-2026
limits: >-
  The directory's office fields were taken as published and not checked
  against each nation's own site. Matching between the list and the directory
  was by exact name except where noted in a fact's note. Leader names, titles,
  email addresses and election dates in the directory were not copied.
---

## What was done

The Federal Register API returned the list published Jan. 30, 2026 (91 Fed. Reg. 4102, FR Doc. 2026-01899) as the newest "Indian Entities Recognized" notice. The notice counts 575 Tribal entities and adds the Lumbee Tribe of North Carolina after Pub. L. No. 119-60, § 8803.

The govinfo.gov text edition was parsed into entries. Lines ending in a space continue onto the next line; page markers gave each entry's page. Entries of the form "X (See Y)" are cross-references to another entry and were skipped, except Lumbee's, whose "(See Supplementary Information supra ...)" is a note. That leaves 573 entries. The Capitan Grande Band entry names two groups, the Barona Group and the Viejas (Baron Long) Group, which the Tribal Leaders Directory lists as separate affiliates with their own offices, so each got its own profile as well, for 575 profiles. Whether the notice's count of 575 is reached the same way is not stated in the notice (project analysis).

"Previously listed as" names became former names and "aka" names became alternate names. Other parenthetical text (component bands, villages, places) was kept verbatim in the recognition note rather than guessed to be a name. The text edition prints "PuliklaTribe of Yurok People" without a space; it was treated as a typesetting artifact.

Each entry was matched to the directory (602 rows, including component bands and villages; data last edited Nov. 20, 2026). Office website, street and mailing addresses, phone and fax, Bureau of Indian Affairs region and agency, and, for Alaska, the regional corporation were recorded. Placeholder values ("Please refer to affiliates") were dropped. Where several entities share one website, the fact is labeled as a shared, likely regional, site.

Identifiers are slugs of the official name with parentheticals and a trailing ", State" removed. Some are long; they are not yet published, so they can be shortened before the first release if preferred.

## Output

`research/raw/2026-11-21/federal-list-and-directory.json`: 575 entities and about 5,000 cited facts, all high confidence. Profiles are built from it by `scripts/tribes/build_profiles.py`.
