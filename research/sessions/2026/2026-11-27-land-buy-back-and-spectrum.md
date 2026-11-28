---
id: 2026-11-27-land-buy-back-and-spectrum
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/tribes/land_buy_back.py and scripts/tribes/fcc_tribal_spectrum.py, ran them, and wrote the hand map of FCC licensees to nations.
- kind: page-fetch
  name: doi.gov
  detail: Interior's final Land Buy-Back report (doi-lbb.pdf), its cumulative sales table of Oct. 12, 2022, and its press release of Dec. 12, 2016 on the Colville offers.
- kind: page-fetch
  name: data.fcc.gov and docs.fcc.gov
  detail: The Universal Licensing System's complete weekly file for the 2.5 GHz band (l_mdsitfs.zip, Nov. 22, 2026), the 2019 Report and Order (FCC 19-62) and FCC 20-183, which cites the order's page numbers.
purpose: 'Trevor asked (Nov. 27, 2026, "go and get the info") for spike 4 of the appeals audio, Land Buy-Back, spectrum and films note (PR #710): the Land Buy-Back Program''s results and the FCC''s tribal 2.5 GHz licenses as Key facts on nation pages, with their legal basis.'
queries:
- The results for each location in Interior's final Land Buy-Back report, and the landowners, offers, rates and tracts for each nation in the October 2022 cumulative sales table
- Every license in the FCC's 2.5 GHz file whose market is a tribal land area (market codes beginning TL)
sources_added:
- interior-land-buy-back-final-report-2023
- interior-land-buy-back-cumulative-sales-2022-10-12
- fcc-uls-2-5-ghz-license-file-2026-11-22
- fcc-19-62-transforming-the-2-5-ghz-band
limits: 'The final report''s figures are the Program''s last word, but its table of results by location prints the figures of 17 locations beside the wrong names; the names here come from the October 2022 table. The tract counts, landowner counts and offer amounts are as of Oct. 12, 2022, a month before the Program''s money ran out. Licenses held by carriers they were assigned to, by consortia of several nations or by colleges have no nation, and the FCC file does not say which nation assigned a license to a carrier. Records stay Unverified.'
---

# Land Buy-Back results and tribal 2.5 GHz licenses: session notes

## Land Buy-Back Program for Tribal Nations

The Program carried out the land consolidation part of the *Cobell* settlement, funded by the Claims Resolution Act of 2010 (Pub. L. No. 111-291, 124 Stat. 3064). Interior's final report, *Ten Years of Restoring Land and Building Trust 2012-2022* (Dec. 2023), gives on pages 28 and 29 the amount paid, the fractional interests bought and the equivalent acres for each of the 53 locations where land was consolidated, six of them in one row. The October 2022 cumulative sales table gives, for each nation by its full name and each round of offers, the landowners offered, the offers made, the landowners who sold, the amount paid, the interests, acres and tracts.

The two tables disagree about names. Matched by their figures, the final report prints the figures of 17 locations beside another location's name. The clearest case is Colville: the final report prints $44,429,584 paid at "Colville", but Interior announced on Dec. 12, 2016 that Colville landowners had received "about $25 million in purchase offers" in all, and the October 2022 table gives Colville $25,440,446 offered and $9,839,343 paid. The October 2022 table's rows agree with themselves (paid over offered gives the capture rate the table prints), so `scripts/tribes/land_buy_back.py` keeps its names and matches each of the final report's figure rows to the table row it continues: the same interests and amount, or a little more where offers were still being processed in October 2022 (Crow Creek, Fort Belknap, Pine Ridge, Umatilla and Winnebago). Every table row has exactly one final row, and no final figure is smaller than the table's.

Two names needed a hand map: the Wind River row, which is both the Northern Arapaho Tribe's and the Eastern Shoshone Tribe's (the table spells it "Arapahoe"), and "Minnesota Chippewa - Bois Forte Band" (and the Fond du Lac Band's row, named the same way). The output is `research/land-buy-back/locations.csv`.

The rounds of offers in the October 2022 table do not add up to its totals, because a landowner offered in two rounds is counted once (the table's notes 2 and 3). The page therefore gives the years of the rounds, not a table of them.

## FCC 2.5 GHz licenses over tribal lands

The FCC opened the Rural Tribal Priority Window in its 2019 Report and Order on the 2.5 GHz band (34 FCC Rcd 5446, paras. 47-65, as FCC 20-183 cites it; 84 Fed. Reg. 57,343). The licenses it granted are Educational Broadband Service licenses whose market is a tribal land area, with market codes beginning "TL" in the Universal Licensing System's market file. That is a better test than the name filter the spike used: it found 426 licenses, 397 of them active, where the name filter found 358.

`scripts/tribes/fcc_tribal_spectrum.py` matches each licensee to a nation by the shared name matcher, and by `research/fcc-tribal-spectrum/licensee-nations.csv` for the rest: Alaska village councils, shortened names, and the utilities and companies nations own (Hopi Telecommunications, Inc.; Tohono O'odham Utility Authority; Yakama Power; NTUA Wireless, LLC, the Navajo Tribal Utility Authority's wireless company). Licensees that are not one nation or its own body have no nation: carriers a license was assigned to (T-Mobile, Clearwire, Nextel and others), consortia (Alaska Tribal Spectrum, the Chickahominy and Virginia consortia), colleges, and the Department of Hawaiian Home Lands, a state agency (Native Hawaiians are not a tribe). 359 active licenses show on 308 nation pages. Every name match was read by hand.

## On the website

Two Key facts groups on nation pages, after "Member of" (site/DESIGN.md, "Summary list"): "2.5 GHz spectrum license" and "Land Buy-Back Program". Our copies of the four sources are stored in the bucket and served (U.S. government works).
