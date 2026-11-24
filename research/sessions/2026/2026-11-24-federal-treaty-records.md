---
id: 2026-11-24-federal-treaty-records
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/treaty_records.py and ran it; no record was read or written by hand.
- kind: page-fetch
  name: treaties.okstate.edu and govinfo.gov
  detail: The Oklahoma State University Tribal Treaties Database's listing page and its 149 agreement record pages, at about one request per second; the Statutes at Large granule for each of the 370 ratified treaties from GovInfo.
purpose: 'Trevor asked to cover federal Indian law in full, starting with tier 1 (Nov. 24, 2026, after the coverage spike in research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md). This session gives every treaty and agreement between the United States and Native nations its own citable source record.'
queries:
- Every ratified treaty with its date, Statutes at Large citation and Kappler page
- Every unratified treaty and related paper the database lists
- Every agreement the database lists, with its header line and whether it is marked not ratified
- The Statutes at Large text of each ratified treaty
sources_added: []
limits: 'The records carry the database''s metadata as the Nov. 23 treaty session and this session read it; nobody has read the texts against the titles, dates and citations yet, so every record is Unverified. Unratified treaties and agreements link the database''s reproduction and have no stored copy, and most give only a year. Which nations descend from each treaty''s signatories stays on the nation pages (the treaties field), where those links are marked as inferred.'
---

# Records for every treaty and agreement: session notes

## What was built

`scripts/law/treaty_records.py` has three steps. `fetch` downloads the Statutes at Large granule for each ratified treaty from GovInfo, `file` stores each copy in the project's bucket under `treaties/<key>.pdf` with `scripts/captures/mirror_captures.py` (the copies are United States government works, so the index marks them for redistribution), and `records` writes the source records.

The inputs are the Nov. 23 treaty session's data (`research/raw/2026-11-23/treaties.json`: 370 ratified treaties and 169 unratified or non-Kappler records) and this session's read of the database's agreements (`research/raw/2026-11-24/osu-agreements.json`: 149 agreements, 63 marked not ratified, two with a header line).

## Record keys

A ratified treaty's key is the database's address without its page number, such as `treaty-with-the-delawares-1778`. Where two treaties share a name and year, the date is added (`treaty-with-the-chippewa-1837-july-29`), and where they were also signed the same day, the Statutes at Large page (`treaty-with-the-seneca-1802-june-30-7-stat-70`). The 26 treaties that already had a record keep it and only gain the stored copy. Unratified treaties and agreements use the same rule, falling back to the database's full address where two records would share a key.

## Results

The run wrote 343 new records for ratified treaties and gave the 27 existing treaty records their stored copy, so all 370 ratified treaties now have a record. It also wrote 318 records for unratified treaties, related papers and agreements (169 from the Nov. 23 data and 149 agreements, 63 of them marked not ratified).

`check` read the first pages of each downloaded granule and looked for the treaty's first party (in the spellings the Statutes at Large use, such as "Pottawatamie", "Sac" and "Ioway") and the year signed. 355 passed and were stored in the bucket (337 under `treaties/`, 18 already filed under `jurisdiction/` by the Nov. 23 session). The other 15 have no stored copy and say so in their notes; [the check file](../../reviews/2026-11-24-treaty-text-check.csv) lists them:

1. GovInfo returned no granule for six citations: the Cherokee treaty of 1804 (7 Stat. 288), the Menominee treaty of Feb. 17, 1831 (7 Stat. 346), the Utah treaty of 1849, the Fort Laramie treaty of 1851 (11 Stat. 749), and the Eastern and Western Shoshoni treaties of 1863 (18 Stat. 685 and 689).
2. Three pairs of treaties carry the same citation in the data, so one of each pair has the wrong page: Kickapoo of the Vermilion and Choctaw (1820, 7 Stat. 210), Potawatomi of Dec. 4 and Dec. 10, 1834 (7 Stat. 467), and Iowa and Chippewa (1837, 7 Stat. 547).
3. Three granules did not show the treaty's party: Potawatomi 1815, Potawatomi Apr. 22, 1836 (7 Stat. 500) and the Chippewa of Saginaw, Swan Creek and Black River, 1864, whose citation leads to an 1867 private law.

Each of the 15 needs a person to look up the citation in the Statutes at Large index or Kappler and correct the raw data, then rerun `fetch`, `check`, `file` and `records`.
