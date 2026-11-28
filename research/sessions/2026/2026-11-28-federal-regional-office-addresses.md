---
id: 2026-11-28-federal-regional-office-addresses
date: 2026-11-28
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Read each Bureau of Indian Affairs region's page for its office address and placed each address with the Census Bureau's geocoder, for the Federal offices page's map.
purpose: >-
  Mark each Bureau of Indian Affairs regional office on the Federal offices
  page's map, with its address, so a reader can see where the office that
  serves a nation is.
queries:
  - The "Contact Us" part of each of the twelve region pages linked from https://www.bia.gov/regional-offices
  - Census Bureau geocoder, onelineaddress, benchmark Public_AR_Current, for each address
sources_added:
  - bia-regional-office-pages-2026
limits: >-
  The Northwest Region's page gives no address, so that region has no pin.
  The Southern Plains Regional Office gives a post office box and "1 Mile
  North on Hwy 281", so its pin is placed one mile north of Anadarko,
  Oklahoma, not at a matched address. Phone numbers were not recorded: only
  four of the twelve pages give one, and two of those give more than one.
  The Indian Health Service's Area office addresses were not read, because
  ihs.gov did not answer requests from the cloud; agency addresses were not
  read either.
---

Findings:

- Eleven of the twelve region pages give a street address under "Contact Us". The Census Bureau's geocoder matched ten of them to a street address; the Navajo Region's "301 West Hill Street" matched "301 W HILL AVE, GALLUP, NM".
- The addresses are in site/src/lib/federal-offices.ts (regionOffices), each with the geocoder's point.
