# Tier 2 and tier 3 data sources: how many there are, where they are held, and what covering them would cost

**Status:** research study, written Nov. 26, 2026, in answer to Trevor's request to "quantify tier 2 and tier 3 if possible" (project chat, Nov. 26, 2026). Tier 1 is the federal core, already counted in the [federal laws note](2026-11-24-federal-laws-and-treaties-coverage.md) and the [Supreme Court note](2026-11-24-supreme-court-native-cases-coverage.md). Tier 2 is lower federal sources; tier 3 is the states, possibly as a separate site later (Trevor, Nov. 24, 2026). No site or content was changed. Numbers in brackets point to the Sources list in section 8. "Counted" means a script in this pull request counted it; "sampled" means a script counted a sample and scaled it up; "project analysis" marks my own estimate or reading, with its basis. The data and scripts are listed in section 7.

## 1. Short answer

### Tier 2: lower federal sources

| Source | How many | Where held | Script? | Hosting | Rough cost to cover |
| --- | --- | --- | --- | --- | --- |
| Federal courts of appeals, district courts and their predecessors: Indian law opinions | About 7,550 published to 2019 (sampled; range 4,550 to 8,300 by how strict the test is), plus about 1,250 since 2019 (project analysis), so **about 8,800** | Caselaw Access Project to 2019 [1]; CourtListener bulk files for later years [2] | Yes | Serve | Medium: 1 day of script, then a small-model reading pass over about 9,000 candidates |
| Court of Claims, Claims Court and Court of Federal Claims | **About 925** (sampled: 492 Court of Claims, 106 Claims Court, 327 Court of Federal Claims) | Caselaw Access Project [1] | Yes | Serve | Low, with the courts above |
| Courts of the Indian Territory (1895-1907) | **575** cases, all relevant (counted by the Harvard resources study [14]) | Caselaw Access Project [1] | Yes | Serve | Low |
| Interior Board of Indian Appeals | **4,879 decisions**, 1970 to Nov. 2026, in 72 volumes; 1,424 are probate appeals (counted) | Interior's yearly index, each with a PDF [3] | Yes | Serve; probate appeals need a privacy choice | Low: 1 day |
| Solicitor's opinions (M-Opinions) | **About 509** for 1917-1974 and **about 127** since 1993; 1975-1992 not online | University of Oklahoma scan; Interior's index [4] | Partly | Serve | Medium: the middle years need a library pull |
| National Indian Gaming Commission | 1,168 ordinance documents for 321 nations (already held), **102** Indian lands opinions, **122** game classification opinions, **327** declination letters, **360** enforcement actions, **65** Commission final decisions, **103** bulletins (counted) | NIGC reading room [5] | Yes | Serve | Low: 1 day |
| Federal Register since 1994: Indian affairs agencies | **3,322** Bureau of Indian Affairs documents (2,914 notices, 169 final rules, 192 proposed rules); **362** NIGC; **768** Indian Health Service; 63 from smaller offices (counted). We hold 819 | Federal Register API [6] | Yes | Serve | Low: 1 day |
| Federal acknowledgment (25 C.F.R. part 83) | **52** petitions resolved (18 acknowledged, 34 denied), **21** in process (counted); 178 Federal Register documents since 1994 | Office of Federal Acknowledgment [7] | Yes | Serve | Low to medium: each petition has several long reports |
| Indian Claims Commission | 370 petitions, 617 dockets, about 43 volumes of decisions | Oklahoma State University; National Archives [8] | Partly (OSU's site refuses cloud requests) | Serve | Medium |
| Congressional hearings and committee reports | **600** hearings of the Indian Affairs committees and **873** hearings with an Indian term in the title on GovInfo; **3,558** committee reports with such a term in the title (counted, title search) | GovInfo [9] | Yes, with a free key | Serve | Low for an index; high to read |
| NAGPRA notices (National Park Service) | **6,922** Federal Register notices since 1994 (counted) | Federal Register API [6] | Yes | Serve | Low, but a separate subject (cultural property) for Trevor to choose |

### Tier 3: states

| Source | How many | Where held | Script? | Hosting | Rough cost to cover |
| --- | --- | --- | --- | --- | --- |
| State court Indian law opinions | About 4,600 published to 2019 (sampled; range 2,600 to 5,000 by how strict the test is), plus about 650 since (project analysis), so **about 5,000**; Oklahoma, California, Washington, South Dakota, Montana, Alaska, Arizona, Oregon and New Mexico hold over half | Caselaw Access Project to 2019 [1]; CourtListener after [2] | Yes | Serve the opinions (see section 5) | Medium, like the federal cases |
| State statutes on Native nations | **Oregon, counted in full: 544 of 114,191 sections** (686 with any Indian term). Fifty states: roughly 8,000 to 20,000 sections (project analysis from Oregon and the dedicated chapters found) | Each state's code site; no national source | One scraper per state | Link only today (see section 5) | High: 50 different sites |
| State constitutions | About 15 states have a provision on Indians or Native Hawaiians, most of them the enabling-act disclaimers of title to Indian lands; probably 30 to 40 provisions in all (project analysis; partly checked) | Legislature sites | By hand is quicker | Serve | Low: 50 documents |
| State-tribal compacts and agreements beyond gaming | **Oklahoma alone: 1,087** filed with its Secretary of State, 1968-2026 (538 cross-deputization and law enforcement, 298 tobacco, 90 gaming, 30 motor fuel; counted). Few other states publish a list | Oklahoma Secretary of State [10]; other states' offices | Oklahoma yes; others by hand | Serve where a nation is party | Low for Oklahoma (1 day); high elsewhere |
| State Indian affairs commissions and offices | **22 confirmed** with a statute or official page; about 10 more named but not checked; so roughly 30 to 35 states (project analysis) | Statutes and state sites | No (a list) | Link only | Low: one table |
| State-recognized tribes | **About 68** listed across 14 states with entries (counted from Wikipedia's list) [11]; 17 nation profiles carry state recognition today | State statutes and lists | No | Facts on nation pages | Low |

The short version: everything in tier 2 is a United States government work, held in a few places, and scriptable, so covering it is mostly a matter of running scripts; the one large set is the federal court opinions, at about 10,000 counting the claims and Indian Territory courts. Tier 3 splits in two. State court opinions and Oklahoma's compacts are scriptable from single sources. State statutes are the expensive part, because every state publishes its code differently and no one has a national list of Indian law sections.

## 2. Tier 2, source by source

### 2.1 Federal court opinions

**Method.** The Caselaw Access Project publishes every reporter volume it scanned, to about 2019, as a zip of JSON cases with no key [1]. A script read every 20th volume of the federal reporters (every 10th to 3rd for the small ones; 413 volumes, 81,868 cases), scored each case by how often it uses Indian law terms ("Indian country", "Indian tribe", "tribal court", "25 U.S.C.", "Bureau of Indian Affairs", the Indian Child Welfare Act and similar), and scaled each reporter's count by its number of volumes. I looked over 30 sampled F.3d cases (their names and which terms they hit) to see how often a score means a real Indian law case: about 1 in 6 cases with one or two hits, 4 in 6 with three or four, and 5 in 6 with five or more (project analysis; false hits are mostly affirmative action cases using "Native American" and passing mentions). The "weighted" count multiplies each band by that share.

| Reporter (years in sample) | Volumes | Cases in reporter (scaled) | Any term | Score 3+ | Score 5+ | Score 10+ | Weighted estimate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Federal Cases (1779-1892) | 30 | 18,252 | 165 | 87 | 60 | 39 | 75 |
| F. (1876-1923) | 300 | 70,600 | 1,040 | 640 | 510 | 350 | 552 |
| F.2d (1913-1993) | 999 | 276,403 | 3,756 | 2,018 | 1,578 | 999 | 1,779 |
| F.3d (1992-2019) | 935 | 140,529 | 4,257 | 2,168 | 1,691 | 1,174 | 1,933 |
| F. Supp. (1927-1998) | 997 | 213,757 | 2,951 | 1,276 | 1,057 | 818 | 1,197 |
| F. Supp. 2d (1995-2014) | 999 | 116,863 | 2,917 | 1,139 | 919 | 719 | 1,091 |
| F. Supp. 3d (to 2019) | 386 | 36,363 | 1,138 | 465 | 356 | 277 | 435 |
| F. App'x (1999-2017, unpublished) | 714 | 289,363 | 1,562 | 491 | 372 | 178 | 495 |
| Court of Claims (1853-1982) | 231 | 19,286 | 829 | 592 | 450 | 278 | 492 |
| Claims Court (1982-1992) | 26 | 3,144 | 170 | 126 | 104 | 74 | 106 |
| Court of Federal Claims (1992-2018) | 109 | 9,728 | 734 | 359 | 295 | 233 | 327 |
| **All** | **5,726** | **1,194,288** | **19,519** | **9,361** | **7,392** | **5,139** | **8,482** |

So about 8,500 published lower federal opinions to 2019 are Indian law cases, of which about 925 come from the claims courts (sampled). The Harvard resources study (PR #513) counted the claims reporters a different way, by a Native party in the case name, and found about 629 Court of Claims cases (1883-1982) and 92 Claims Court cases [14], close to this sample's 492 and 106 (which also count cases with no Native party in the name, and miss some that the name test finds). The same study counted all 575 cases in the *Indian Territory Reports* (1895-1907), the federal territorial courts before Oklahoma statehood, which belong in tier 2 as well and are not in the table above. The weighted sample found 170 to 190 a year in 2014-2018 across the circuits, district courts and unpublished appeals, so the years since the Caselaw Access Project stopped add about 1,250 (project analysis: 7 years at about 180). The total is **about 9,000 to 10,000**. A strict reading (score 10 or more) gives about 6,000; a loose one (any term) about 20,000, which is the candidate list a build would read.

Not counted: district court opinions never printed in a reporter (on GovInfo's court opinions collection since 2004 and on PACER), and orders without opinions. GovInfo's search refused our demonstration key after a few calls [9], so this needs the free api.data.gov key already on Trevor's list.

**Where held and how to get them.** To 2019, the Caselaw Access Project's static files (a full pass is about 5,700 federal volumes, roughly 20 GB downloaded and discarded volume by volume). After 2019, CourtListener's quarterly bulk files, which are public domain and need no key [2]; its search API needs a token, so the bulk files are the way in. The project already reads both (`scripts/caselaw/`).

### 2.2 Interior Board of Indian Appeals

Interior's Office of Hearings and Appeals keeps a chronological index with one page per calendar year since 1970, and every entry links a PDF on `oha.doi.gov` [3]. The script read all 57 year pages: **4,879 decisions** cited 1 IBIA through 72 IBIA, from 8 in 1970 to a peak of 170 in 1994 and about 50 a year since 2019. **1,424** are estate (probate) appeals, which name the person who died and the heirs. A sample PDF downloaded from the cloud without trouble. Decisions before 1970 sit in *Decisions of the Department of the Interior* (Lands Decisions 1881-1929, Interior Decisions since 1930), which are in libraries, not online as a set [3].

### 2.3 Solicitor's opinions

Unchanged from the Nov. 24 count [4]: about 509 opinions on Indian affairs for 1917-1974 (the two-volume University of Oklahoma scan) and about 127 M-numbered opinions since 1993 on Interior's index, roughly 60% about Indian affairs. 1975-1992 are not collected online.

### 2.4 National Indian Gaming Commission

Counted from the reading room tables on Nov. 26, 2026 [5]: gaming ordinances for **321** nations in **1,168** documents (the project already holds all of them, `research/gaming/ordinance-documents.csv`); **102** Indian lands opinions (whether a parcel is gaming-eligible land, with the legal theory and outcome); **122** game classification opinions; **327** declination letters on management contracts; **360** enforcement actions since 1996 (177 notices of violation, 135 settlement agreements, 25 civil fines, the rest closures and combinations); **65** Commission final decisions (1994-2005, mostly ordinance and management contract appeals); and **103** bulletins. The Indian lands opinions and Commission decisions carry the most legal weight (project analysis).

### 2.5 Federal Register

The Federal Register API covers documents since 1994 [6]. Counted Nov. 26, 2026: Bureau of Indian Affairs 3,322 (2,914 notices, 169 final rules, 192 proposed rules); National Indian Gaming Commission 362; Indian Health Service 768; Office of the Special Trustee 35; Indian Arts and Crafts Board 17; Navajo and Hopi relocation office 7; Indian Trust Transition Office 4. Inside the Bureau's documents, by phrase: 326 gaming compact notices, 272 liquor ordinances (each publishes a nation's law), 162 trust land acquisitions, 112 reservation proclamations, 178 acknowledgment documents and 44 recognized-entity lists. We hold 819 notices, mostly gaming. Before 1994 the Federal Register is on GovInfo as scanned issues (1936-1993) with no subject search, so older notices are found one by one from citations.

### 2.6 Federal acknowledgment

The Office of Federal Acknowledgment lists **52** petitions resolved under part 83 (18 acknowledged, 34 denied) and **21** in process [7]. Each resolved petition has a proposed finding, a final determination and technical reports, often hundreds of pages; 178 Federal Register documents since 1994 announce them. This is the source of many nations' status and pairs with the recognition-basis parked research.

### 2.7 Other tier 2 sources

The Indian Claims Commission (370 petitions in 617 dockets) is as counted Nov. 24 [8]. GovInfo lists 600 hearings held by committees named for Indian affairs and 873 hearings with an Indian term in the title, and 3,558 committee reports with such a term in the title [9] (title counts, with some false hits). The National Park Service has published 6,922 repatriation (NAGPRA) notices since 1994 [6]. Not counted: Interior Board of Land Appeals decisions on Indian and Alaska Native allotments, Attorney General and Office of Legal Counsel opinions, Government Accountability Office decisions and reports (62 titled reports on GovInfo, a partial collection), Interior Decisions before 1970, and Indian water rights settlements (statutes, so tier 1).

## 3. Tier 3, source by source

### 3.1 State court opinions

**Method.** The same script as for the federal courts (section 2.1), run over every state's own reporters in the Caselaw Access Project (every 10th volume in the 27 states with many Native nations or many Indian law cases, every 33rd elsewhere; 336 reporters) and over the regional reporters, whose volumes in the Caselaw Access Project hold only the cases a state's own reports do not [1]; 2,253 volumes and 366,976 cases in all. In all the sample stands for about 4.9 million state cases, close to the 6 million the project's metadata lists.

| Measure | Count to 2019 |
| --- | --- |
| Cases with any Indian law term | 11,700 |
| Score 3 or more | 4,948 |
| Score 5 or more | 3,711 |
| Score 10 or more | 2,633 |
| Weighted estimate | **4,567** |

By state (weighted estimate, and the share of that state's cases): Oklahoma 654 (1.0%), California 431, New York 346, Washington 240, South Dakota 204 (1.2%), Montana 196, Alaska 194 (1.8%), Arizona 192, Oregon 165, New Mexico 153, Kansas 131, Minnesota 124, North Dakota 103, Michigan 90, Idaho 85, and fewer than 85 in each other state; Dakota Territory adds 24. The low-share states' numbers carry more false hits (for example employment cases that mention a Native American plaintiff), so New York's 346 overstates its Indian law (project analysis). By decade the count rises from about 200 a decade in 1900-1930 to 815 in the 1990s and 820 in the 2010s, driven by the Indian Child Welfare Act (1978) and gaming (1988) (sampled). At the recent rate of about 90 a year, the years since 2019 add about 650 (project analysis), for **about 5,000 published state opinions**. Many state child welfare appeals are unpublished (California especially) and are not in any reporter, so the real number of state decisions applying the Indian Child Welfare Act is larger than this count.

### 3.2 State statutes

No national source lists state Indian law. Each state publishes its code on its own site, in its own format, and several, especially those a publisher hosts for the state, attach terms of use (memory). To get a real number I counted one whole code: the Oregon Revised Statutes, read chapter by chapter from the Legislature's site [12]. Of **114,191** sections in 657 chapters, **544** use a strong Indian law term (Indian tribe, Indian country, Indian child, federally recognized tribe, tribal government or court) and **686** use any Indian term. Oregon has nine federally recognized nations; its Indian law sections are spread across 141 chapters, led by chapter 419B, the juvenile code, which holds the Oregon Indian Child Welfare Act (80 sections; the Act's place is from memory), then chapter 109 on parents and children (39), and smaller groups on public safety, water, health, cultural sites, education and taxes.

The helpers that read state sites for this study found dedicated Indian affairs chapters in most states they reached, usually small (Maine's Implementing Act, 30 M.R.S. ch. 601, 26 sections; South Dakota's Department of Tribal Relations, 26; New Mexico's Indian Affairs Department Act, 15; Alabama, 10; Vermont, 7; Idaho's State-Tribal Relations Act, 7) [13]. A dedicated chapter is a small share of a state's Indian law: Oregon has none, yet 544 sections use the terms (counted). Scaling Oregon's 544 by each state's number of nations and Indian land gives roughly 400 to 1,500 sections in each of the 15 to 20 states with many nations (Oklahoma, Arizona, New Mexico, Washington, California, Alaska, Montana, the Dakotas, Minnesota, Wisconsin, Nevada) and 20 to 150 in most others, so **roughly 8,000 to 20,000 sections in all** (project analysis; the basis is one full count and the chapter sizes, so treat it as an order of magnitude).

### 3.3 State constitutions

The provisions are few and well known: the disclaimers of title to Indian lands that Congress required in the enabling Acts of the western states (Arizona, Idaho, Montana, New Mexico, North Dakota, Oklahoma, South Dakota, Utah, Washington, Wyoming and Alaska), plus a handful of others such as Montana's Indian education clause, Michigan's tribal gaming provision and Hawaii's seven Native Hawaiian sections (Office of Hawaiian Affairs, Hawaiian Homes) (memory, partly confirmed by the helpers [13]). That is probably 15 states and 30 to 40 provisions (project analysis). The study could not count them by script: the sites that hold full texts (Justia, Wikisource, Ballotpedia) refused or rate-limited automated reading, and the helpers ran out of their web budget. Fifty documents is a short job by hand in a browser.

### 3.4 State-tribal compacts and agreements

Gaming compacts are already a collection (about 1,100 records). For everything else, only Oklahoma publishes a full register: its Secretary of State's database lists **1,087** tribal compacts and agreements filed from 1968 to Nov. 2026, each with a PDF that downloads from the cloud [10]. By keywords in their titles: 538 cross-deputization and law enforcement agreements, 298 tobacco tax compacts, 90 gaming, 30 motor fuel, 12 vehicle registration, 6 hunting and fishing, 5 child welfare and 104 others (counted). Elsewhere the helpers found short lists only (Michigan, 7 accords and directives; Alaska, 12 civil diversion agreements) [13]. Washington, Wisconsin, Minnesota, Arizona and New Mexico are known to hold many tax, child welfare and law enforcement agreements without a public register (project analysis), so a national count would mean asking each state.

### 3.5 Commissions and state recognition

Twenty-two states have a confirmed Indian affairs commission, council, department or office with a statute or official page (Alabama, Arizona, California, Idaho, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Minnesota, New Mexico, North Carolina, South Dakota, Tennessee, Utah, Vermont, Virginia, Washington, plus Hawaii's Office of Hawaiian Affairs); North Dakota, Oregon and Wisconsin were named but not checked, and several more are known from memory (Colorado, Connecticut, Florida, Georgia, Montana, Nebraska, Nevada, New Jersey) [13]. Wikipedia's list names about 68 state-recognized tribes in the 14 states with entries [11]. Both are facts for nation pages and one table, not document collections.

## 4. What the project holds today

Counted from the repository on Nov. 26, 2026 (main at ddf7c344): about 40 lower federal court records and 9 state court records; 45 state statute records; 819 Federal Register notices; 1,168 NIGC ordinance documents and about 1,100 gaming compact records; no IBIA decision and 5 records that cite Solicitor's opinions; 17 nation profiles with state recognition.

## 5. Copyright and hosting

Every tier 2 source is a work of the United States government (17 U.S.C. § 105), and court opinions are not copyrightable whoever writes them (*Banks v. Manchester*, 128 U.S. 244 (1888); *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020)), so the standing rule "Serve" applies. The Caselaw Access Project released its data without restriction in 2024, and CourtListener marks its bulk data public domain [1][2]. Nations' ordinances and the compacts they signed are nations' governing documents, served under the existing rule that a nation can ask for removal.

Two choices need Trevor. First, the **IBIA probate appeals** (1,424) name people who died and their heirs, often in family disputes. They are public on Interior's site, but the project's privacy rules for Tribal court opinions suggest at least `noindex` pages or initials (decision record 0057's approach). Second, the data roadmap's rule says **state statutes and cases are "link only"**. That rule is a project choice, not a legal limit: under *Georgia v. Public.Resource.Org* the text of state law and state court opinions is not copyrightable, though some states' official code sites attach terms of use and publishers own their headnotes and annotations (project analysis). If tier 3 is built, serving state court opinions from the Caselaw Access Project is as safe as serving federal ones; statutes could stay link-only with a private copy of what we quote.

## 6. Recommendation and order

1. **Tier 2, by script, now that tier 1 is mostly built:** IBIA decisions (records from the index, PDFs to R2), NIGC Indian lands opinions, Commission decisions and game classification opinions, the Federal Register Indian affairs documents since 1994 and the acknowledgment decisions. Each is about a day of script work and review is light, because the documents are official and closed lists (project analysis).
2. **Federal court opinions** next: a full Caselaw Access Project pass for candidates (about 20,000), a small-model reading of the roughly 9,000 that score 3 or more to confirm each is Indian law and tag its subject and nations, then CourtListener bulk for 2019 on. Records start Unverified, as for the Supreme Court cases.
3. **Oklahoma's 1,087 compacts and agreements**, because they are one public register of nations' own agreements and scriptable in a day, whether or not the rest of tier 3 is built.
4. **The rest of tier 3 waits** for Trevor's choice on a separate site. When it starts: state court opinions by the same script as the federal ones (cheap), constitutions and commissions by hand (a day), statutes state by state, highest-Native-population states first, at roughly a day per state for a scraper and review (project analysis).

Rough storage: about 10,000 federal opinions at 40 KB of text is 0.4 GB, and the IBIA PDFs about 0.7 GB (4,879 at a sampled 125 KB), both small amounts of storage (project analysis).

## 7. Data and scripts in this pull request

- `scripts/analysis/indian_law_case_sample.py` samples Caselaw Access Project volumes and scales the counts (`sample` and `estimate`).
- `scripts/analysis/federal_agency_counts.py` counts the IBIA index (writes every decision), the NIGC reading room and the Federal Register.
- `scripts/analysis/oregon_statutes_count.py` counts Oregon's code.
- `research/data-roadmap/2026-11-26-tier-2-and-3/`: `ibia-decisions.csv` (4,879 rows: name, date, citation, probate flag, PDF link), `nigc-reading-room.json`, `federal-register-counts.json`, `federal-courts-sample-estimate.json`, `state-courts-sample-estimate.json`, `oklahoma-tribal-compacts.json` and `oregon-statutes-count.json`.

The state helpers' raw notes (constitutions, commissions, chapters) were partial and are summarized in sections 3.3 to 3.5, not committed.

## 8. Sources

All read or counted Nov. 26, 2026, from the cloud, unless marked.

1. Harvard Law School Library, Caselaw Access Project, static files, https://static.case.law/ (reporter folders, `JurisdictionsMetadata.json`, `ReportersMetadata.json`). Sampled as described in sections 2.1 and 3.1.
2. Free Law Project, CourtListener bulk data, https://www.courtlistener.com/help/api/bulk-data/ (memory from the Nov. 23 sources note, `research/analyses/2026-11-23-free-legal-information-sources.md`: quarterly, public domain, no key). Its search API answered 401 without a token today.
3. Department of the Interior, Office of Hearings and Appeals, *Chronological Index of IBIA Decisions*, https://www.doi.gov/oha/organization/ibia/Chronological-Index-of-Decisions, and its 57 year pages (counted); *Finding Pre-IBIA Decisions*, https://www.doi.gov/oha/organization/ibia/IbiaOldDecisions (read); sample PDF https://www.oha.doi.gov/IBIA/Ibiadecisions/52ibia/52ibia364.pdf (downloaded).
4. As cited in the [federal laws note](2026-11-24-federal-laws-and-treaties-coverage.md), source 7: Interior's M-Opinion index and the University of Oklahoma's *Opinions of the Solicitor ... Relating to Indian Affairs 1917-1974* (not re-read today).
5. National Indian Gaming Commission reading room tables, https://www.nigc.gov/office-of-general-counsel/gaming-ordinances/, https://www.nigc.gov/office-of-general-counsel/legal-opinions/indian-lands-opinions/, https://www.nigc.gov/office-of-general-counsel/legal-opinions/game-classification-opinions/, https://www.nigc.gov/office-of-general-counsel/legal-opinions/declination-letters/, https://www.nigc.gov/commission/commission-actions/enforcement-actions/, https://www.nigc.gov/commission/commission-actions/commission-final-decisions/, https://www.nigc.gov/office-of-chief-of-staff/compliance/bulletins/ (counted).
6. Federal Register API, https://www.federalregister.gov/api/v1/documents.json, by agency, type and phrase (counted; documents since 1994).
7. Bureau of Indian Affairs, Office of Federal Acknowledgment, *Resolved Petitions List*, https://www.bia.gov/as-ia/ofa/resolved, and *Petitions in Process*, https://www.bia.gov/as-ia/ofa/petitions-in-process (counted).
8. As cited in the federal laws note, sources 11 and 12 (Indian Claims Commission final report).
9. GovInfo search API, https://api.govinfo.gov/search, with the demonstration key: `collection:CHRG AND committee:"Indian Affairs"` 600; `collection:CHRG AND title:(Indian OR tribal OR tribes OR Native)` 873; `collection:CRPT AND title:(Indian OR tribe OR tribal)` 3,558; `collection:GAOREPORTS AND title:(Indian OR tribal OR tribes)` 62 (counted); court opinion searches were refused (rate limit).
10. Oklahoma Secretary of State, *Tribal Compacts and Agreements*, https://execleg.sos.ok.gov/tribal.html, data file https://execleg.sos.ok.gov/json/dataTribal.json (1,087 records, counted) and PDFs at `https://execleg.sos.ok.gov/documents/filelog/<id>.pdf` (one downloaded).
11. *State-recognized tribes in the United States*, Wikipedia, https://en.wikipedia.org/wiki/State-recognized_tribes_in_the_United_States (list items counted by state heading; Wikipedia, so a starting list only).
12. Oregon State Legislature, *Oregon Revised Statutes*, chapter pages https://www.oregonlegislature.gov/bills_laws/ors/ors001.html to ors838.html, with lettered chapters such as ors419B.html (657 chapters answered; counted). Sections are split on section numbers at the start of a line, so a few cross-references count as sections.
13. Five small-model helpers read state legislature, commission and Justia pages for this study, each state with a budget of about 8 pages; the shared web budget ran out partway, so about half the states are partial. Their findings used here (commission statutes and dedicated chapters) each came with a source address, kept in the session's working files; treat them as leads to check, not citations.
14. Harvard resources study, `research/analyses/2026-11-26-harvard-native-resources.md`, section 5, and `research/harvard-resources/caselaw-access-project-claims-and-indian-territory-cases.csv` (PR #513, another thread of this project, Nov. 26, 2026; not re-counted here).
