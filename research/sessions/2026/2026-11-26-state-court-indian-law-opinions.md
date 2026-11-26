---
id: 2026-11-26-state-court-indian-law-opinions
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/caselaw/state_court_opinions.py and ran it. Eight smaller Claude models each read an eighth of the 2,470 borderline cases (short excerpts around the Indian law terms, plus the caption, court and date) and judged whether each is an Indian law case; a ninth read a random 200 of the cases kept by score alone, as a check.
- kind: page-fetch
  name: static.case.law
  detail: The Caselaw Access Project's VolumesMetadata.json and one zip of JSON cases for each of the 32,353 volumes of every state, regional and territorial reporter it holds.
purpose: 'Trevor asked on Nov. 26, 2026 to "grab" the tier 3 state court opinions counted in research/analyses/2026-11-26-tier-2-and-3-data-sources.md, section 3.1: the published state court opinions on Indian law, about 5,000 by that note''s sample.'
queries:
- Every case in every state, regional and territorial reporter volume of the Caselaw Access Project, scored by the tier 2 and 3 study's Indian law terms
- For cases scoring 3 to 9, whether excerpts show an Indian law case (research/state-court-opinions/reading-instructions.md)
- Which selected cases concern children or protected persons, to hold for a privacy review
sources_added: []
limits: 'The Caselaw Access Project ends about 2019; later opinions (about 650 by the study''s estimate) are not here and would come from CourtListener. Cases scoring under 3 were not read, so a few Indian law cases with only one or two of the terms are missed. The AI readers saw excerpts, not whole opinions; their judgments are in research/state-court-opinions/readings.json, and the spot check agreed with the score for 193 of 200 cases (the 7 it rejected were left out unless a party is a Native nation or organization). Nations are linked only where the caption names one that matches a nation record. Records start unverified.'
---

# Published state court opinions on Indian law: session notes

The script and how to run it are described at the top of `scripts/caselaw/state_court_opinions.py`. Its outputs are in `research/state-court-opinions/`: `selected.json` (the cases chosen, and how), `readings.json` (the AI readers' judgments, by case id, without captions), `records.csv` (one row per record written) and `summary.json` (the counts).

## What was found

The scan read all 32,353 volumes and found 11,696 cases with at least one Indian law term: 2,702 scoring 10 or more, 2,478 scoring 3 to 9 and 6,516 scoring under 3. After cases sharing a citation were counted once, 2,699 cases scored 10 or more and 2,470 scored 3 to 9.

The readers judged 1,703 of the 2,470 borderline cases to be Indian law cases. Thirteen more that they rejected name a Native nation or Native organization as a party (for example *Viejas Band of Kumeyaay Indians v. Lorinsky* and *Pala Band of Mission Indians v. County of San Diego*) and were kept, since the site lists the cases a nation is party to. Of the 200 high-scoring cases checked, 193 were confirmed; the other 7 were left out.

That made 4,408 cases. Of them:

- 11 were already held (by citation, or because they are Supreme Court cases filed in a state reporter, such as *United States v. McBratney*, also reported at 2 Colo. L. Rep. 378);
- 1,297 are held for a privacy review (cases about children or protected persons), listed only in the project's private files, never in git;
- 3,100 have records: 2,950 from state and territorial courts, including 68 from the Court of Appeals of Indian Territory, and 150 from federal courts whose reports the Project files with the states' (mostly the District of Columbia's).

The federal courts' 150 are recorded as federal cases (topic `federal-court-indian-law`) and are listed with the other lower court cases, not as state court opinions.

## Estate cases

The first run held 51 estate cases decided since 1976. Later the same day Trevor chose to show estate cases like any other opinion, so they were written with `--show-estates`: 48 now have records and 3, which are also about a child, are held with the child cases.

## Hosting

Each record's copy is the court's opinion only, built from the Project's JSON without the publisher's head matter (headnotes, synopsis and syllabus), and served from R2 under `caselaw-access-project/` (decision record 0060).
