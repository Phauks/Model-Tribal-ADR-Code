# Case citations checked against CourtListener, Nov. 23, 2026

**What was checked:** every case source record in `content/sources/` (109 records: 95 federal, 7 territorial, 6 state and 1 tribal), looked up by citation in CourtListener's bulk data release of Sept. 30, 2026, with the case name and year compared. Trevor chose this check on Nov. 23, 2026, from the [sources note](../analyses/2026-11-23-free-legal-information-sources.md) (section 3, item 1). Script: `scripts/caselaw/check_case_citations.py`. Results, one row per record: [`2026-11-23-case-citations-courtlistener.csv`](2026-11-23-case-citations-courtlistener.csv).

This checks that each citation points to the case the record names. It is not a treatment check: KeyCite results still come from Westlaw.

## Result

No citation was found pointing to the wrong case (project analysis, from the results file).

- **96 matched.** The citation finds the same case in CourtListener, with a matching party name and year. Each of these records now has a `courtlistener` block with the cluster number and a link.
- **1 year differs.** *Wabol v. Villacrusis*, 958 F.2d 1450: CourtListener dates it Mar. 16, 1992, the date of the amended opinion, and the record uses the 1990 decision date. The record's citator note already explains the amendment, so nothing changes.
- **5 not found.** Each citation is right but missing from CourtListener: *McGirt v. Oklahoma*, 591 U.S. 894 (CourtListener files it only as 140 S. Ct. 2452); *Fitisemanu v. United States*, 1 F.4th 862; *PAC United Corp. (CNMI) v. Guam Concrete Builders*, 2002 MP 15; *Ocean Pest Control, LLC v. Rebelly*, 2026 VI 5; and *Whyte v. Bockino*, 69 V.I. 749 (project check of CourtListener's citation pages, Nov. 23, 2026). These misses suggest CourtListener covers the courts of the Northern Mariana Islands and the U.S. Virgin Islands thinly (project analysis, from three misses only).
- **7 with no reporter citation.** Docket-only or Westlaw-only cases: *Cherokee Nation v. Stitt* (2020), *Flying Horse v. United States* (2017), *Maverick Gaming v. United States* (2024), *New Mexico v. Department of the Interior* (2017), *Seneca Nation v. New York* (2021), *Maisonet Rivera v. Aibonito* (2026) and *Ross v. Sulu* (Hopi Appellate Court). They wait for a reporter citation.

One match is worth a look by a person: the record "In re Matai Title 'Taliaaueafe' (Savea v. Alaipalelei)," 3 Am. Samoa 3d 225, matched a case CourtListener names *Taulapapa v. Alaipalelei*. The shared party suggests the same consolidated matter under another caption.

## Running it again

The script picks the newest quarterly release by itself. Run it after adding case records or when a new release appears (the last days of March, June, September and December):

```
python3 scripts/caselaw/check_case_citations.py --cache ~/caselaw-cache
python3 scripts/caselaw/check_case_citations.py --apply-report
```

The first command writes a new dated results file; read it, then the second writes the blocks for the rows marked `matched`.
