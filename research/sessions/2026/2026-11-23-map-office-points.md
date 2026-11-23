---
id: 2026-11-23-map-office-points
date: 2026-11-23
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Wrote and ran scripts/maps/geocode_nation_offices.py, which matches the office addresses already in nation records to points with the Census Bureau's geocoder and, failing that, its ZIP Code Tabulation Area file.
purpose: >-
  Put nations with no Census land area on the website's map, as the lead author chose on 2026-11-23, by marking each at the office address its record cites.
queries: []
sources_added:
  - census-geocoder
  - census-gazetteer-zcta-2020
limits: >-
  An office is where a government works, not its land, and a mailing address can be far from either. Post office boxes are placed only at the middle of their ZIP Code area and are marked as approximate. Nations with no address on record get no point.
---

Findings:

- 357 of 947 nation records name no 2020 Census land area. 65 of them have an office address the script could place: 44 matched to the address and 21 placed by ZIP Code area. 4 addresses could not be placed (post office boxes in ZIP Codes with no tabulation area, and one record whose physical address reads "Contact Tribe For Physical Address"). 288 records have no address at all, most of them groups without federal or state recognition.
