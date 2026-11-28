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
limits: 'Cases with none of the terms were not read, and CourtListener''s copies of opinions filed since Oct. 2017 are only as complete as its sources (district court opinions mostly from GovInfo). The AI readers saw excerpts, not whole opinions; their judgments are in research/federal-court-opinions/readings.json, and the spot checks agreed with the score for 190 of 200 Project cases and 93 of 100 CourtListener cases. Nations are linked only where the caption names one that matches a nation record. Records start unverified.'
---

# Lower federal court opinions on Indian law: session notes

The scripts and how to run them are described at the top of `scripts/caselaw/federal_indian_law_cases.py` (the scan of the Caselaw Access Project), `scripts/caselaw/courtlistener_federal_opinions.py` (CourtListener, after the Project ends) and `scripts/caselaw/state_court_opinions.py` (reading, selection, privacy holds, records and copies, with `--courts federal`). Outputs are in `research/federal-court-opinions/`: `readings.json` (the AI readers' judgments, by case id, without captions), `records.csv` (one row per record written, with how it was chosen) and `summary.json` (the counts).

## Caselaw Access Project, to 2019

The scan read all 5,726 federal volumes and found 19,322 candidates with at least one Indian law term: 5,009 scoring 10 or more and 14,313 scoring 1 to 9.

Cases scoring 10 or more were kept by score, except those whose only terms are "Native" words, which were read. A reader checked a random 200 of the cases kept by score and agreed on 190; the 10 it rejected (for example *United States v. Durham*, which quotes the Indian Commerce Clause only for the Commerce Clause, and *Lobenstein v. United States*, an 1873 supply contract) were left out. Readers judged 14,300 cases (14,173 scoring 1 to 9, after cases sharing a citation were counted once, and the 127 high-scoring ones): 5,400 were Indian law cases. Nine more that they rejected name a Native nation as a party in the caption and were kept, since the site lists the cases a nation is party to.

That made 10,152 cases. Of them:

- 77 were already held (by citation);
- 479 are held for a privacy review (cases about children or protected persons, and cases where a party is named only by initials, as federal courts do for minors and victims), listed only in the project's private files, never in git;
- 9,596 have records: 1,712 from the Ninth Circuit, 1,304 from the Eighth, 1,055 from the Tenth, 818 from the Court of Claims, and the rest from the other circuits, the district courts and the Court of Federal Claims. They run from 1795 to 2019, most of them (7,342) from 1970 on. Of them 4,450 were kept by score, 5,137 on a reader's judgment and 9 for a nation named as a party; 2,255 link at least one nation named in the caption.

Estate cases are shown, following Trevor's choice for the state court set (decision record 0060).

## CourtListener, after the Caselaw Access Project

The Project's federal reporters stop between December 2017 and August 2019, so `scripts/caselaw/courtlistener_federal_opinions.py` read CourtListener's Sept. 30, 2026 bulk files for every opinion cluster filed since Oct. 1, 2017 in a federal court of appeals, district court or the Court of Federal Claims: 919,662 clusters. The opinions file (55 GB compressed, 10.9 million opinions) was downloaded whole and read in about 75 minutes; 9,254 clusters use at least one Indian law term (1,180 scoring 10 or more, 1,645 scoring 3 to 9 and 6,429 scoring 1 or 2). Most (6,452) are district court opinions CourtListener took from GovInfo, which gives no precedential status; 2,564 are published and 236 unpublished.

Of the 9,254, 592 share a citation with a Project case and 55 more match one by caption and a filing date within a week (the Project's last volumes overlap CourtListener's first years), so 8,607 were added. Readers judged the 7,639 that needed reading; 2,023 were Indian law cases. A reader checked a random 100 of the 968 kept by score and agreed on 93 (*Saginaw Chippewa Indian Tribe v. Blue Cross Blue Shield*, one of the 7, was kept for its caption). That made 2,992 cases: 2,796 have records, 194 are held for a privacy review and 2 were already held. They run from October 2017 to September 2026. Their copies are built from CourtListener's opinion text (the court's own text: CourtListener's syllabus and headnote fields are left out) and credit CourtListener; their records link to the CourtListener page, and those with no reporter citation yet give the docket number instead.

District court names are given in the Project's style ("United States District Court for the Eastern District of New York", not CourtListener's "District Court, E.D. New York"), so each court is listed one way.

In all, the collection had 12,392 records and 673 cases held for a privacy review; after the read check and the review below (Nov. 27, 2026) it has 12,642 records and 423 held.

## Hosting

Each record's copy is the court's opinion only, built from the Project's JSON (or CourtListener's opinion text) without the publisher's head matter (headnotes, synopsis and syllabus), and served from R2 under `federal-court-opinions/` (decision record 0060, which now covers lower federal court opinions too). The copies are listed in their own copy list, split into parts of 2,500 so each page stays small.

## Privacy holds

The held cases follow the state court set's rules (decision record 0060): cases about children, protected persons and adoptions are not written as records and their copies are not served until a person reviews them. Federal courts name minors and victims by initials, so a case with a party named only by initials (*United States v. B.N.M.*) is held too. Estate cases are shown. The list is in the project's private files under `research/federal-court-opinions/private/`.

## Read check and release, Nov. 27, 2026

Most of the 673 holds came from the text rule alone: three or more words about children ("adoption", "juvenile", "custody" and the like) anywhere in the opinion, which also catches the adoption of a rule or a regulation. The thread "Close the tier 2 data gaps" sorted the holds into groups, and Trevor chose "read-check, then release" for the 387 Caselaw Access Project opinions held for their text only. Two AI readings of each full opinion asked whether it names a child or a protected person, in full or by an identifying first name. For 294 neither reading found one; 93 stay held.

The 294 were fetched again from the Caselaw Access Project (the first run's work folder was gone) and written with `scripts/caselaw/state_court_opinions.py --courts federal release`, which rebuilds each case's score from the scan's terms and how it was chosen from `research/federal-court-opinions/readings.json` (188 by score, 106 on a reader's judgment), then writes them as `write` does, adding to the existing records. Each record's notes and review say it was held for its words about children and released after the read check. Their copies were filed in `tribal-law-project-files` under `federal-court-opinions/` and checked by size and SHA-256 (294 of 294). ### CourtListener opinions, through GovInfo

The 168 CourtListener opinions held for their text could not be read the same way, because CourtListener's opinion text needs an account token. GovInfo's United States Courts Opinions collection (USCOURTS, through the api.data.gov key) holds many of the same filings, so each was searched there by the caption's words and the exact decision date: 96 had a match on the date, 89 of them exactly one. For those 89, every passage of the GovInfo filing around a word about children, minors, victims, custody or abuse was read by two AI readers, and 41 the first readings left unsure were read a third time in small batches. An opinion was released only when no reader found a child or protected person named, at least two readers were sure, its passages were all read, and the filing itself uses the words that held the case (three or more, as the hold rule counts them). That left 63. Of the others, 13 were flagged by a reader, 4 had too many passages to read in full, 4 had a reader unsure, and 5 did not look like the held text: two Eighth Circuit matches were the clerk's cover letters and three filings lacked the words that held the case.

The 63 records keep CourtListener's case name and citation, link to GovInfo's page for the filing, name CourtListener's page in their notes, and serve GovInfo's PDF of the court's filing under `federal-court-opinions/govinfo/` (63 of 63 checked by size and SHA-256). Their notes say they were kept by CourtListener's text, because this run scored GovInfo's.

The private list of held cases now has 316 rows: 44 whose caption is about a child or protected person, 74 with a party named only by initials, 93 Caselaw Access Project opinions whose text names one, and 105 CourtListener opinions (79 with no single GovInfo match and the 26 above).

One copy, of a 1917 Court of Claims estate case, had stayed in the capture index after its record was held in the first run; the case is among the 294, so the row is right again.

## Review, Nov. 27, 2026

Trevor asked on Nov. 27, 2026 for a review of these opinions. AI readers read the passages of 133 shown opinions that either use words about juvenile cases, child victims or foster care three or more times or name a party in the caption the way courts name minors ("United States v. Doe", a first name and an initial). The readers found 107 that are about a specific child: a juvenile defendant, a child victim the opinion describes, or a child's placement. Their records and copies were withdrawn and the cases joined the private held list, so the collection had 12,285 records and 780 cases held for a privacy review before the read check above was merged, and has 12,642 records and 423 held with it. The readers' choices are in the private files beside the held list (privacy-reviews.json), and `scripts/caselaw/state_court_opinions.py` now keeps them on a later run.

The same review fixed the records the first run wrote, with `scripts/caselaw/fix_federal_court_opinions.py`, which changes them in place, and changed `state_court_opinions.py` so a new run writes them the fixed way:

- **Case names.** 260 titles were rebuilt from the full caption: CourtListener captions that kept only a surname, names in capitals, and Caselaw Access Project names cut short ("Tribe v. Connecticut" is *Mohegan Tribe v. Connecticut*). Docket notes such as "DO NOT FILE IN THIS CONSOLIDATED CASE" are left out.
- **Courts.** 53 court names were written one way: "United States District Court for the District of X", and the District of Columbia's district court and Court of Appeals told apart by reporter and year.
- **Nations.** Links to a nation made only through a bare word such as "Tribes" or "Dakota" were taken out. Two other changes (#608 and #740) had already taken out most of them; this one takes out the last 7.
- **Duplicates.** 94 opinions were on the site twice, as parallel reports (such as the Court of Claims Reports and the Federal Supplement) or as two CourtListener entries of one docket. The record with the Federal Reporter's citation stays and lists the other citation. Eight of the duplicates had a docket number or argument recordings from the appeals audio work (#715). Seven of the records kept already had the same ones, and *Deschutes River Alliance v. PGE* (9th Cir. 2021) took docket 18-35867 and its recording from the record merged into it.
- **Released after reading.** 17 of the 79 CourtListener opinions held without a text were read in GovInfo's copy and found to name no child; 16 are added, and one is the same opinion as a record already shown, so `summary.json` counts 95 merged duplicates.

The collection now has 12,564 records, and 406 cases are held for a privacy review.
