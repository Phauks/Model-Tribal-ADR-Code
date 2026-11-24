---
id: 2026-11-24-justice-and-president-pages
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session read the official reports' opinion lines for every Supreme Court case on the site and built the Justice and President pages' data with scripts/law/supreme_court_people.py; no other readers were used.
- kind: page-fetch
  name: fjc.gov, guides.loc.gov, inaugural.senate.gov, tile.loc.gov, supremecourt.gov, Wikidata and Wikimedia Commons
  detail: The Federal Judicial Center's judges.csv, education.csv and professional-career.csv exports; the Library of Congress chronological list of Presidents; the Joint Congressional Committee on Inaugural Ceremonies' list of past ceremonies; the U.S. Reports as the Library of Congress scans them, and the Court's bound volumes, preliminary prints and reporter's-version slip opinions; Wikidata only to find each portrait, and Commons for each portrait's maker, source and license.
purpose: 'Trevor asked for a page for each Justice and each appointing President, showing their relationship to the cases on the site, with pictures (Nov. 24, 2026), and for the Court pages to list each case''s opinions: the opinion of the Court, concurrences and dissents, and how many there are.'
queries:
- Who wrote each opinion in each Supreme Court case on the site, and of what kind, from the official report
- Each Justice's birth, death, schooling, career before the Court, other federal judicial service, nomination and confirmation
- The years each President served, and the party of each appointing President
- A portrait of each Justice and President that the license allows the site to show
sources_added:
- federal-judicial-center-biographical-directory-judges
- library-of-congress-presidents-chronological-list
- joint-congressional-committee-past-inaugural-ceremonies
limits: 'Portraits are those Wikidata names for each person; where Commons marks that file with a license that does not allow reuse, or none, the page shows no portrait rather than a substitute. The Library of Congress list gives years, not days, and stops before the present term, so the current President''s present term is dated by the Inaugural Committee''s list. Every reading awaits the lead author''s review.'
---

# Pages for each Justice and appointing President: session notes

## Opinions in each case, checked against the official reports

Each of the 55 Supreme Court cases on the site was read in the official report: the Library of Congress scan of the U.S. Reports through volume 541, and the Court's own bound volumes (579 and 581), preliminary print (591) and reporter's-version opinions (593 to 602) after that. The report's syllabus names who delivered the opinion of the Court and who filed each other opinion; older reports say it in the body ("Mr. Justice Harlan dissented."). Eight records were corrected where Oyez's opinion types differed from the report: Iowa Mutual (Stevens concurred in part and dissented in part), Plains Commerce Bank (Ginsburg concurred in part, concurred in the judgment in part and dissented in part), Montana (Blackmun dissented in part), Nevada v. Hicks (O'Connor concurred in part and in the judgment), Rice v. Cayetano (Breyer concurred in the result), Lone Wolf (Harlan concurred in the result without an opinion), Lewis v. Clarke (Thomas and Ginsburg concurred in the judgment) and Haaland v. Brackeen (Kavanaugh's concurring opinion, which Oyez leaves out). Three nineteenth- and early twentieth-century reports note a lone dissent with no opinion (Talton v. Mayes, United States v. Winans, Winters v. United States); the Court pages list those Justices as dissenting without an opinion and do not count an opinion for them.

## Who the Justices were

`scripts/law/supreme_court_people.py` matches each of the Court's 121 appointments to its person in the Federal Judicial Center's Directory by seat, which gives 116 people: John Rutledge, Edward D. White, Charles Evans Hughes, Harlan F. Stone and William H. Rehnquist served twice, and the two John Marshall Harlans are told apart by year of birth.

## Portraits

Wikidata's "Biographical Directory of Federal Judges alpha ID" (P2736) links each Justice to an item and its image; Presidents are found by the office they held. Commons' own record of each file gives its license, maker and source. Files marked public domain or under a Creative Commons license that allows reuse are kept, and the credit line names the maker and the license.
