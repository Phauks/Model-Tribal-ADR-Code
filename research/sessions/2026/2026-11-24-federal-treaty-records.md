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

Trevor asked for further research into these (Nov. 24, 2026); the hand check follows.

## Hand check of the 15

I read the Statutes at Large pages on GovInfo for each one. All 15 are now settled, and the script records each finding (`CITATION_FIXES`, `GRANULES`, `HAND_CHECKED`, `SHARED_COPY` and `NOT_PRINTED` in `scripts/law/treaty_records.py`), so a rerun keeps them.

1. **Two misprinted citations.** The Cherokee treaty of Oct. 24, 1804 is at 7 Stat. 228, not 288: it was proclaimed in 1824 and printed among that year's treaties. The Chippewa of Saginaw, Swan Creek and Black River treaty of Oct. 18, 1864 is at 14 Stat. 657, not 637, which is an 1867 private law. Both records now carry the right citation and say the database misprinted it.
2. **Three pairs that begin on one page.** Each pair really does share a starting page, and both citations are right: GovInfo files the first treaty as `Pg210`, `Pg467` or `Pg547` and the second as `Pg210-2`, `Pg467-2` or `Pg547-2`. Kickapoo of the Vermilion and Choctaw (1820), Potawatomi of Dec. 4 and Dec. 10 (1834), and Iowa and Saginaw Chippewa (1837) each now have their own text.
3. **Older spellings.** The Potawatomi treaties of 1815 and Apr. 22, 1836 were right all along: the pages spell the nation "Poutawatamie" and "Patawattimie".
4. **One shared text.** The Menominee supplementary articles of Feb. 17, 1831 are at 7 Stat. 346, inside the granule GovInfo files for the Feb. 8 treaty (`Pg342`), so both records point to the same stored copy.
5. **One failed download.** The Utah treaty of 1849 (9 Stat. 984) downloaded on the second try.
6. **Three treaties not printed in the Statutes at Large.** At 11 Stat. 749, where the Fort Laramie treaty of 1851 is cited, the volume prints only a note that the treaty is "not yet in a proper form for publication" because the tribes had not all assented to the Senate's amendments. The Eastern and Western Shoshoni treaties of 1863 are placed by Kappler in 18 Stat., part 3, which GovInfo does not hold: its links for 18 Stat. 685 and 689 open the Revised Statutes in part 1 instead. These three records now link Kappler's text in the Oklahoma State University database and have no stored copy. A copy could come from the Library of Congress scan of 18 Stat., part 3, or from Kappler's printed volume.

After the hand check, 367 of the 370 ratified treaties have a stored copy of the official text.
