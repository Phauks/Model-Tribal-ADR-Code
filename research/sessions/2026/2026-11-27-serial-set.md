---
id: 2026-11-27-serial-set
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/serial_set.py and ran it, from the match of the University of Oklahoma's index to GovInfo that the thread "Find new data sources beyond tiers 2 and 3" made (PR #629).
- kind: page-fetch
  name: www.govinfo.gov
  detail: Each matched Serial Set package's PDF from GovInfo's public content address, streamed to the bucket and checked by size and SHA-256.
purpose: 'Trevor picked new data source category 3, the Congressional Serial Set''s documents on American Indians and Alaska Natives from 1817 to 1899, after categories 1, 2 and 4 (project thread "Collect approved tribal laws, water settlements and old nation codes", Nov. 27, 2026). He first asked for about 20 GB without the annual reports, then chose to host everything: "we will not be truncating files" and "we can identify if we need to cut after we have everything".'
queries:
- Every GovInfo Serial Set package that the University of Oklahoma Law Library's index of American Indian and Alaska Native documents, 1817-1899, points to (research/data-roadmap/2026-11-27-serial-set/oklahoma-index-matched-to-govinfo.csv)
sources_added: []
limits: 'Every record is Unverified: only the index entry and GovInfo''s package list were read, not the documents. Records carry no nations yet. 649 of the packages are annual reports or compendia of which only some pages concern Native nations; they are stored whole. The 1,973 index entries GovInfo lacks are linked to the University of Oklahoma''s copy, which refuses automated downloads. Citations are built from the index''s chamber, document type, number, Congress and session; the index''s dates are used as given.'
---

# Congressional Serial Set, 1817 to 1899: session notes

## What was built

`scripts/law/serial_set.py` has three steps. `file` downloads each GovInfo package's PDF to a temporary file, stores it in the bucket as `serial-set/<package>.pdf`, checks the bucket copy by size and SHA-256, and deletes the local copy. `index` adds the stored files to the capture index. `records` writes one `congressional-document` record per package, like the reports `scripts/law/congressional_documents.py` writes (a genre such as "House report" or "Senate executive document", and the chamber, Congress, session and package under `legislative`), cited in the Indigo Book form (for example "H.R. Doc. No. 80, 24th Cong., 1st Sess. (1836)"), and one per index entry GovInfo lacks. A package that already has a record from that script is left to it.

## Results

- 6,478 GovInfo packages, every one served. This script stored 5,575 (263.9 GB). The other 903 were already stored, byte for byte the same, by `scripts/law/congressional_documents.py` as `congress/<package>.pdf`; the 903 copies this script had stored too (2.7 GB) were deleted from the bucket and left out of the capture index. None failed.
- 7,533 new records: 5,560 packages, and 1,973 index entries linked to the university's copy (1,859 in volumes GovInfo does not hold, 85 whose number was not found in GovInfo's volume, 29 whose file name could not be read).
- 918 packages already had a record from `scripts/law/congressional_documents.py` (Serial Set reports whose titles name Native people), so they get no second record. For 15 of them this script's copy differs from that script's, so both copies are kept and the capture index links this one to the existing record.
- One collection, "Congressional Serial Set, 1817–1899" (`serial-set`). It lists every Serial Set document issued before 1900, whichever script wrote its record, so it holds the 7,533 new records and the 1,088 earlier reports that script found; those 1,088 move out of Committee Reports, so no record is counted twice.
- The bucket now holds about 322.8 GB, about $4.69 a month at R2's standard storage rate of $0.015 per GB-month after the first 10 GB.

## Next

Match each record to the nations it concerns (a Haiku reading of the titles, with a person settling disagreements). Trevor will decide later whether any of the annual reports should be cut.
