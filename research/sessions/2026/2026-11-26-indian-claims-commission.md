---
id: 2026-11-26-indian-claims-commission
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/indian_claims_commission.py and ran it; no record was written by hand.
- kind: other
  name: CONTENTdm (Oklahoma State University Library)
  detail: The item list of collection p17279coll10, the library's scan of Indian Claims Commission Decisions, and each item's PDF, one request a second as the site's robots.txt asks.
purpose: 'Trevor asked to add the sources missing from the data roadmap and to collect the ones that are high value and scriptable (project thread "Add the new data sources to the roadmap and collect them", Nov. 26, 2026). This session gives each decision of the Indian Claims Commission its own case record and a stored copy, served by the site.'
queries:
- 'https://cdm17279.contentdm.oclc.org/digital/bl/dmwebservices/index.php?q=dmQuery/p17279coll10/0/identi!title!date!descri!is!subjec/identi/1024/1/1/0/0/0/json and the pages after it, Nov. 26, 2026: 2,783 items'
sources_added: []
limits: 'Every record is Unverified. Parties, dates, dockets, volumes and pages come from the library''s catalog, not from a reading of the scans, and two catalog dates are out of order in their volume (the records say so). Nations are matched by name in the parties and subjects, which links 2,381 of the 2,779 records; the matcher misses a claimant named only by a band or a historic name.'
---

# Records for the Indian Claims Commission's decisions: session notes

## What was built

`scripts/law/indian_claims_commission.py` has three steps. `fetch` reads the item list of the Oklahoma State University Library's CONTENTdm collection of *Indian Claims Commission Decisions* (43 volumes, 1948-1978) and downloads each item's PDF, at most one request a second. Each item is one opinion, finding, order or award, and its identifier gives the docket, volume and first page (`oksd_icc_d337_v05_p493a`). `file` stores each PDF in the bucket under `indian-claims-commission/<identifier>.pdf`, served as a work of the United States government with the library credited for its scan. `records` writes one record per item, `<short case name>-<volume>-ind-cl-comm-<page>`, of kind `federal-case` with the Commission as its authority, the kind of decision as its genre, the dockets as its number and the claimant nations matched by name. Items printed at the same page (an opinion and its findings, say) name each other in their notes. Four pairs under different dockets share a page and letter (Yakima, 16 Ind. Cl. Comm. 565; Seminole, 17 Ind. Cl. Comm. 97; Miami, 20 Ind. Cl. Comm. 113; Ponca, 6 Ind. Cl. Comm. 408f), so their keys end in their docket.

The site lists them as their own collection, "Indian Claims Commission Decisions", under Courts and cases, and the Commission's court page links that list.

## Results

2,783 PDFs downloaded (1.25 GB). 2,779 records: 605 opinions of the Commission, 279 findings of fact, 224 interlocutory orders, 143 additional findings, 128 final awards and the rest orders on attorneys' fees, judgments and settlements, in 675 dockets. 2,381 records name at least one of 165 nations. One item is listed twice in the catalog (Creek Nation, 39 Ind. Cl. Comm. 409) and has one record. Three items are appendices, not decisions (two maps of volume 7 and an appendix of volume 39), and have no record.

## Gaps and checks

The catalog dates Eastern (Emigrant) Cherokee, 1 Ind. Cl. Comm. 31, to Nov. 15, 1946, and Quapaw, 1 Ind. Cl. Comm. 644, to Dec. 6, 1995, though volume 1 runs from 1948 to 1951; the records keep the catalog's dates and say they may be wrong. The scans' text was not read. A person reading each decision against its scan fixes dates, parties and nations.

## Next

Link each decision to the treaty and the Royce cession it valued, and to the Court of Claims appeals from it; read the nations from the text, not only the catalog.
