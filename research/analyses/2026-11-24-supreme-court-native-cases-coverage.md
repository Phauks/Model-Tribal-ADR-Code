# Supreme Court cases involving Native people and nations: how many, how many we cover, and whether we can cover all

**Status:** tentative research spike, written Nov. 24, 2026, in answer to Trevor's question how many Supreme Court cases touched Native Americans or Native nations, how many the project covers, and whether covering all of them is feasible. No site code was changed. Numbers in brackets point to the Sources list in section 6, which marks what I read directly and what I inferred.

## 1. Short answer

**About 530 to 600 Supreme Court decisions involve Native people or Native nations.** I identified 533 by name and citation; they are listed in [native-cases-scdb.csv](../supreme-court-coverage/native-cases-scdb.csv). The true number is somewhat higher, because the coding I relied on misses some cases (section 2c).

**The project covers 54 of them (about 10%).** The repository holds 61 Supreme Court case records; 7 of them are not about Native people (5 arbitration cases, *Hilton v. Guyot* and *Downes v. Bidwell*).

**Covering all of them is feasible in two tiers.** A case record and page with the checkable facts (citation, dates, bench, opinions, official report scan, reading links) can be built for every case in a few days of thread work, because most of those facts can be pulled by scripts and only need a check. The case box (background, question, holding, verbatim quotes, treatment) is hand work, roughly an hour a case, so about 480 boxes is several hundred hours. I recommend tier 1 for all cases and tier 2 by priority (section 4).

## 2. How many cases

### 2a. What "touched" means here

I used three definitions, from narrow to broad:

| Definition | Count | We cover |
|---|---|---|
| Indian law is the case's main issue: the Supreme Court Database codes the issue as 20150 "Indians (other than pertains to state jurisdiction over)" or 20160 "Indians, state jurisdiction over" [1][2] | 446 | 43 |
| Main issue, **or** a Native party: the Database codes the petitioner or respondent as 170 "Indian, including Indian tribe or nation", 308 "Bureau of Indian Affairs" or 367 "Indian Claims Commission" [1][2], or a statute coded for the case names Indians or tribes | 504 | 52 |
| The above, plus cases I added by hand: 8 with a Native nation named in the caption but not coded, 2 of our own records the Database does not code (*Oklahoma v. Castro-Huerta*, *Denezpi v. United States*), and 19 on Wikipedia's list of Supreme Court cases involving Indian tribes that the Database does not code [3] | **533** | **54** |

Native Hawaiian cases are included where the Database codes them (*Rice v. Cayetano* is coded 20150). Native Hawaiians are not a tribe, but they are Native people, which fits Trevor's question.

The broadest reading, any case whose opinion discusses Native people at all, is not countable from the Database. It would need a full-text search of every opinion (for example the CourtListener bulk files [5]) and would likely run to well over a thousand cases, most of them mentioning Native people only in passing. I did not attempt it.

### 2b. Where the cases fall in time

| Terms | Cases identified | We cover |
|---|---|---|
| 1791 to 1857 | 13 (+ Wikipedia additions) | 3 |
| 1858 to 1945 | 333 (+ Wikipedia additions) | 8 |
| 1946 to 1958 | 10 | 2 |
| 1959 to 1999 | 112 | 22 |
| 2000 to 2025 | 46 | 19 |

(Counts by term are from the 514 Database-coded and caption cases; the 19 Wikipedia additions are mostly pre-1900.) Most of the gap is the period 1858 to 1945: allotment, Indian Territory land titles, Court of Claims suits by nations, and liquor and criminal jurisdiction cases. Since *Williams v. Lee* (1959) there are about 158 cases, of which we cover 41.

### 2c. How reliable the count is

- **Recall check against our records.** Of our 54 Native case records, the Database's codes catch 52; it misses *Castro-Huerta* (coded as a federalism case between a state and a private party) and *Denezpi* (coded as double jeopardy) [1]. That is about 96% recall on cases we chose as important.
- **Recall check against Wikipedia's list.** Wikipedia's list holds 179 citations [3]. 147 match the Database-coded set directly, the recent ones (since 2016) match by name because the Database lists them by Supreme Court Reporter citation, and 19 are not coded, for example *Fletcher v. Peck*, *The Cherokee Tobacco*, *United States v. McBratney* and *Employment Division v. Smith*. That suggests the codes miss roughly 10% of cases where the Native question is secondary. Hence the 530 to 600 range.
- **Precision check.** I read the captions and issue codes of a random sample of 20 of the 533; all 20 were plainly about Native people, nations or land (my own reading of captions, not of the opinions).
- **Wikipedia's list is a curated subset** of "major" cases (179), not a census, so it is a floor for importance, not for count.
- I could not open the Native American Rights Fund's Tribal Supreme Court Project reports from this environment (the site reset the connection), so I did not use their counts [4].

## 3. What a case record needs, and what can be automated

A full case on the site today (see `content/sources/w/worcester-v-georgia.yaml` and the case pages built in PR #433) has these parts. The table says how each could be made for about 480 new cases; the effort figures are my estimates from how the existing records were built, not measured.

| Part | How it is made today | Automation for new cases | Human check per case |
|---|---|---|---|
| Citation, name, decision date | Hand-entered | Pull from the Supreme Court Database [1] and CourtListener bulk files [5] (`scripts/caselaw/check_case_citations.py` already matches by citation) | 1 to 2 min |
| Official report scan (LoC U.S. Reports) | Link found by hand or `reading_links.py` | Deterministic: the Library of Congress path is built from volume and page (`usrepVVV/usrepVVVPPP`). 499 of the cases are in volumes 1 to 542, which the LoC collection covers (inferred, see [6]); 34 later cases need supremecourt.gov bound volumes or slip opinions | 1 min |
| `court_dates` (argued, decided, as printed) | Read from the official report | Pull the "Argued … Decided …" line from the scan's text layer by pattern; older reports print only the decision date or a term | 2 to 5 min (old scans OCR badly) |
| `supreme_court` (bench, vote, who wrote) | `scripts/law/supreme_court_benches.py` from Oyez | Same script; for cases Oyez lacks, the Database's justice-centered file has votes and opinion writers for every era [1] | 2 to 5 min |
| `opinions` (each opinion and its first page) | Hand-read from the scan (only Worcester has it) | Find "delivered the opinion", "concurring", "dissenting" headings in the scan text and their page numbers | 5 to 10 min |
| `courtlistener`, `reading_links`, archives | Scripts | Same scripts | none |
| Nations linked to the case | Hand-linked (PR #389) | Suggest from parties and caption; a person confirms | 2 to 5 min |
| Case box: background, question, holding | Written by hand | A draft can be generated from the opinion, but it must be read against it | 20 to 40 min |
| Quotes, verbatim, with pinpoints | Hand-checked against the official report (project rule) | Candidate sentences can be pulled, but each must be compared word for word with the scan | 10 to 20 min |
| Treatment (later history, negative treatment) | Hand research | No free citator exists; CourtListener's citing-opinions data gives leads only [5] | 15 to 30 min |

So tier 1 (everything above the case box) is about 15 to 30 minutes of checking a case after the scripts run, or roughly 120 to 240 hours across about 480 cases, most of which a thread can do. Tier 2 (the case box) adds about 45 to 90 minutes a case, roughly 360 to 720 hours for all.

Things that would break or need care at this scale:

- The build fails when a case's Justice names do not match `content/supreme-court/people.yaml` (see `site/src/lib/server/supreme-court-people.ts`). All Justices are already there, so this should hold, but nineteenth-century name spellings in the Database will need mapping.
- New opinion kinds (per curiam, memorandum, "separate opinion") must be in `site/src/lib/case-opinions.ts` and the print writer.
- The Court pages (`content/supreme-court/courts.yaml`) need a cited history for every Court that decided a new case (Taney, Chase, Taft, Hughes, Stone, Vinson and others).
- Each case page is prerendered; about 600 case pages should be fine, but the build time should be measured.
- The project keeps a private R2 copy of every directly cited source; that means about 480 scan downloads from the Library of Congress, which does not answer from cloud sessions (project memory), so the copies would be fetched another way.

## 4. Recommendation

1. **Tier 1 for all 533:** generate records with the facts in section 3 from the Database, CourtListener and the scans, mark each as Unverified until a check passes, and give each a case page. This makes the site's Supreme Court list complete, which fits the site's role as a central repository of Native legal information.
2. **Tier 2 by priority:** write case boxes first for the 117 cases since 1959 we do not cover, then the cases on Wikipedia's curated list, then the rest. Cases that a chapter or essay cites jump the queue.
3. Re-run the count when the Database publishes a new release, and add cases from each new term.

Beyond the Supreme Court, most federal Indian law decisions come from lower federal courts. They include the Court of Claims and its successors, where nations sued the United States over treaties and land; the Indian Claims Commission (1946 to 1978); and the Courts of Appeals and district courts. These were not counted here; many of the Supreme Court cases in the list came up from them. A later spike could size them from the CourtListener bulk files [5].

## 5. Files

- [native-cases-scdb.csv](../supreme-court-coverage/native-cases-scdb.csv): the 533 cases, with the Database case ID, term, decision date, citation, caption, issue code, whether it carries the Indian issue code and the Native party code, why it was included, our record key where we have one, and whether its volume is in the LoC scan range.

## 6. Sources

1. Harold J. Spaeth et al., *Supreme Court Database*, Version 2026 Release 01 (modern, 1946 to 2025 terms, 9,409 cases) and Legacy Release 07 (1791 to 1945 terms, 19,861 cases), case-centered citation and legal-provision files, http://scdb.wustl.edu/data.php. **Read directly:** downloaded and counted all files; the counts above are my own computation from them.
2. Supreme Court Database codebook, variables `issue` and `petitioner`, http://scdb.wustl.edu/documentation.php?var=issue and ?var=petitioner. **Read directly** for codes 20150, 20160, 170, 308 and 367.
3. Wikipedia, "List of United States Supreme Court cases involving Indian tribes," raw text fetched Nov. 24, 2026, https://en.wikipedia.org/wiki/List_of_United_States_Supreme_Court_cases_involving_Indian_tribes. **Read directly:** I counted its 179 citations and compared them with the Database set.
4. Native American Rights Fund, Tribal Supreme Court Project, https://sct.narf.org. **Not read:** the 25-year report would not download from this environment.
5. Free Law Project, CourtListener bulk data. **Not re-read for this note;** its use and limits are in [the free legal information sources note](2026-11-23-free-legal-information-sources.md).
6. Library of Congress, United States Reports collection. **Inferred, not checked:** that the digitized collection runs through volume 542 is from memory and from the existing records' scan links; the Library does not answer from cloud sessions.
7. Repository: the 61 Supreme Court records in `content/sources/` (authority "Supreme Court of the United States"), read directly with a script on Nov. 24, 2026, at commit 27ed6ac1.
