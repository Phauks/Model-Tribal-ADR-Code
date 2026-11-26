---
id: 2026-11-26-federal-court-indian-law-opinions
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/caselaw/federal_indian_law_cases.py and scripts/caselaw/courtlistener_federal_opinions.py, extended scripts/caselaw/state_court_opinions.py with --courts federal, and ran them. Smaller Claude models each read a batch of the borderline cases (short excerpts around the Indian law terms, plus the caption, court and date) and judged whether each is an Indian law case; another read a random 200 of the cases kept by score alone, as a check.
- kind: page-fetch
  name: static.case.law
  detail: The Caselaw Access Project's VolumesMetadata.json and one zip of JSON cases for each of the 5,726 volumes of its federal reporters (F., F.2d, F.3d, F. Supp., F. Supp. 2d and 3d, F. App'x, F. Cas., Ct. Cl., Cl. Ct., Fed. Cl. and the other federal series).
- kind: page-fetch
  name: CourtListener bulk data (Free Law Project)
  detail: The 2026-09-30 quarterly bulk files (courts, opinion clusters, dockets, citations and opinions), read from com-courtlistener-storage.s3-us-west-2.amazonaws.com/bulk-data/ with no account or key.
purpose: 'Trevor asked on Nov. 26, 2026 to "start with tier 2" and "work to completion". This is the fifth tier 2 source in research/analyses/2026-11-26-tier-2-and-3-data-sources.md, section 2.1: the lower federal court opinions on Indian law, about 9,000 to 10,000 by that note''s sample.'
queries:
- Every case in every federal reporter volume of the Caselaw Access Project, scored by the tier 2 and 3 study's Indian law terms
- Every CourtListener opinion filed since Oct. 1, 2017 in a federal court of appeals, district court or the Court of Federal Claims, scored by the same terms
- For cases scoring 1 to 9, whether excerpts show an Indian law case (research/federal-court-opinions/reading-instructions.md)
- Which selected cases concern children, protected persons or estates, to hold for a privacy review
sources_added: []
limits: 'Cases with none of the terms were not read. The AI readers saw excerpts, not whole opinions; their judgments are in research/federal-court-opinions/readings.json, and the spot check agreed with the score for 190 of 200 cases. Nations are linked only where the caption names one that matches a nation record. Records start unverified.'
---

# Lower federal court opinions on Indian law: session notes

The scripts and how to run them are described at the top of `scripts/caselaw/federal_indian_law_cases.py` (the scan of the Caselaw Access Project), `scripts/caselaw/courtlistener_federal_opinions.py` (CourtListener, after the Project ends) and `scripts/caselaw/state_court_opinions.py` (reading, selection, privacy holds, records and copies, with `--courts federal`). Outputs are in `research/federal-court-opinions/`: `readings.json` (the AI readers' judgments, by case id, without captions), `records.csv` (one row per record written, with how it was chosen) and `summary.json` (the counts).

## Caselaw Access Project, to 2019

The scan read all 5,726 federal volumes and found 19,322 candidates with at least one Indian law term once cases sharing a citation were counted once: 5,009 scoring 10 or more and 14,313 scoring 1 to 9.

Cases scoring 10 or more were kept by score. A reader checked a random 200 of them and agreed on 190; the 10 it rejected were read again with the borderline cases. Readers judged all 14,300 cases scoring 1 to 9 (and the 10 spot-check rejections): 5,400 were Indian law cases. Nine more that they rejected name a Native nation as a party in the caption and were kept, since the site lists the cases a nation is party to.

That made 10,162 cases. Of them:

- 264 were already held (by citation, mostly the 150 federal cases filed with the states' reports by the state court set, and lower federal records written by hand before);
- 619 are held for a privacy review (451 about children or protected persons, 168 estates decided in or after 1976), listed only in the project's private files, never in git;
- 9,279 have records: 1,668 from the Ninth Circuit, 1,279 from the Eighth, 1,026 from the Tenth, 818 from the Court of Claims, 234 from the Court of Federal Claims, and the rest from the other circuits and the district courts. They run from 1795 to 2019, most of them (6,170) from 1970 on. Of them 4,222 were kept by score, 5,049 on a reader's judgment and 8 for a nation named as a party; 2,123 link at least one nation named in the caption.

Each record is `kind: federal-case` with topic `federal-court-indian-law`, listed in the collection "Lower Federal Court Opinions".

## CourtListener, after 2019

PENDING

## Hosting

Each record's copy is the court's opinion only, built from the Project's JSON (or CourtListener's opinion text) without the publisher's head matter (headnotes, synopsis and syllabus), and served from R2 under `federal-court-opinions/` (decision record 0060, which now covers lower federal court opinions too). The copies are listed in their own copy list, split into parts of 2,500 so each page stays small.

## Privacy holds

The held cases follow the state court set's rules (decision record 0060): cases about children, protected persons and adoptions, and estates decided in or after 1976, are not written as records and their copies are not served until a person reviews them. The list is in the project's private files under `research/federal-court-opinions/private/`.
