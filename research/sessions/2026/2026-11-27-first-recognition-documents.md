---
id: 2026-11-27-first-recognition-documents
date: '2026-11-27'
researchers:
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote the matching script, settled uncertain list matches by searching the list texts, and read the Indian Health Service notice of 1988 on its page images. Smaller Claude models checked uncertain list matches against the closest entries and against the list lines naming each nation's rarer name words; their answers are in research/reviews/first-recognition/list-appearance-reviews.json and list-appearance-audit.json.
- kind: page-fetch
  name: GovInfo
  detail: The project's stored copies of the 40 Bureau of Indian Affairs lists (served from the site's /copies route), read with pdftotext; GovInfo full-text search of the Federal Register (api.govinfo.gov/search) and the issue of Aug. 25, 1988.
purpose: 'Trevor asked (Nov. 27, 2026) whether the project can collect the documents by which the United States first recognized each nation, since 523 of the 581 federal nation pages say the site has not found that document and cite only the list of Jan. 30, 2026.'
queries:
- Each federal nation's names, matched back through the Federal Register lists of recognized tribes from 1979 to 2026
- The treaties, land instruments and reorganization-act constitutions already on the profiles and in the constitution histories
- GovInfo full-text search of the Federal Register for "Tillie Hardwick"
sources_added:
- ihs-health-service-delivery-areas-1988
sources_updated: []
limits: 'Treaty links on the profiles are inferred by name and were not checked here. List matches before 1995 rest on OCR of scanned pages; every uncertain match was reviewed, but each reviewer saw only the lines the script picked out, and 27 low-confidence disagreements from the second review remain flagged. The Tillie Hardwick order itself was not found online; the 17 rancherias rest on the Indian Health Service notice that names them. Nation pages show only the 17 restorations; the other candidates wait on Trevor''s choice of what counts as first.'
---

# First federal recognition documents: session notes

The method, counts and leads are in `research/analyses/2026-11-27-first-recognition-documents.md`. The review table is `research/reviews/first-recognition/candidates.csv`.

## Rancherias restored by Tillie Hardwick

A GovInfo full-text search of the Federal Register for "Tillie Hardwick" returned three documents: the issues of June 11, 1984 and Aug. 25, 1988, and a 2008 rule on gaming on trust lands. The 1984 issue's text does not contain the name. The 1988 issue holds the Indian Health Service's *Geographic Composition of the Health Service Delivery Areas (HSDA) Established by Regulations of the Indian Health Service*, 53 Fed. Reg. 32,460 (Aug. 25, 1988). Its table marks 17 California rancherias with note 3: "Restored by Court Order issued December 22, 1983, in Tillie Hardwick v. U.S., Civil No. C-79-1910-SW, U.S. District Court for the Northern District of California" (53 Fed. Reg. at 32,463). The note marks were read on the page images, because the text layer misreads several of them as 8.

Each of the 17 is first named on the Bureau of Indian Affairs list of Feb. 13, 1985, 50 Fed. Reg. 6055 (the review table, column `earliest_list`). The list before it, 48 Fed. Reg. 56,862, was published on Dec. 23, 1983, the day after the order, and names none of them. The 1985 list reads "Redding Valley Ranchería of Pomo Indians of California" for the Redding Rancheria, so that match stays at medium confidence. Their profiles now cite the order through the notice (`scripts/tribes/recognition_basis.py`, table `JUDGED`).

## Second review of the list-only matches

A second reviewer model checked the 255 nations whose only candidate was a list entry, shown the list lines that hold each nation's rarer name words (at most five lines per list). It disagreed on 47; its answers are in `research/reviews/first-recognition/list-appearance-audit.json`. I searched the full text of every list for the 17 disagreements it rated high or medium and for three more whose entries looked wrong, and recorded the result in `list-appearance-reviews.json` (reviewer "by searching the full text of every list"). Corrections: Blue Lake, Northfork and Smith River (Tolowa Dee-ni') first appear in 1985, not 1979; Chalkyitsik and Chignik in 1982 (the 1979 to 1981 lists hold no Alaska entities); Council in 1988; Agua Caliente and Karuk (spelled "Aqua-Caliente" and "Karok") in 1979; Orutsararmiut as "Bethel Native Village" in 1982; Pit River Tribe as "Pit River Indian Tribe of the X-L Ranch Reservation" in 1982. The second reviewer was wrong on Fort Sill ("Fort Still" on the 1979 list), Lone Pine and Fort Mojave, which it could not see past its five-line limit. The other 27 disagreements were rated low and mostly come from that limit; the table flags them.
