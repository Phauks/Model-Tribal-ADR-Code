# State Indian law statutes: a full pilot in Oklahoma and a fifty-state survey

**Status:** research study, written Nov. 26, 2026, in answer to Trevor's request to "spike states for number of potential statutes and best method forward" starting "with a single test state" (project thread, Nov. 26, 2026). It follows the [tier 2 and 3 note](2026-11-26-tier-2-and-3-data-sources.md), section 3.2, which counted Oregon's code by keyword and scaled it to a rough 8,000 to 20,000 sections nationally. No pages were built: the pilot is clean, but turning it into pages needs a schema change and two choices that belong to Trevor (section 8). All counts are as of Nov. 26, 2026.

## 1. Short answer

- **Oklahoma has 381 Indian law sections** in its 33,507 sections in force (1.1%), spread over 48 of its 89 titles: 101 whose subject is Native nations or Indian people (the Oklahoma Indian Child Welfare Act, the State-Tribal Gaming Act and Model Tribal Gaming Compact, tobacco and motor fuel compacts, state-tribal agreements, the American Indian Cultural Center, Indian education, restricted Indian land) and 280 that give a nation, a tribal court or tribal members a specific role in a law about something else (counted and read; section 3).
- **The method works and is cheap.** A keyword pass found every one of them but about 4; small-model readers sorted the hits; precision after reading is about 98% and recall is about 99% (at least 86% at 95% confidence) (section 3.4).
- **Nationally: about 7,500 to 16,500 sections, roughly 11,000** (project analysis from four measured states: Oklahoma 381 read; Washington about 900 to 1,060, Oregon about 500 to 600 and Florida about 70 to 100 from keyword counts; section 6). Washington, not Oklahoma, is the heaviest state measured.
- **No national source is usable.** Justia refuses scripts, the Legal Information Institute links out to the states rather than hosting their codes, and Public.Resource.Org holds only old snapshots of about ten codes (section 5.2). Every state needs its own scraper, but most are easy: 34 states rate 1 or 2 on a five-point difficulty scale, 12 rate 3 or 4, and 4 (Arkansas, Georgia, Mississippi and Tennessee, all hosted by LexisNexis) rate 5 (section 5).
- **Recommended method:** one script per state from the legislature's own site, the same keyword pass, small-model readers on every hit through the Message Batches API, a random sample of non-hits for recall, and a top-model spot check, producing link-only records. The model cost is a few dollars for all fifty states; the real cost is writing the scrapers, roughly 10 to 15 working sessions (section 7).

## 2. Why Oklahoma

Oklahoma has the most federally recognized nations of any state outside Alaska and California (38; repository nation profiles), most of the state is Indian country after *McGirt v. Oklahoma*, 591 U.S. 894 (2020), and it leads every state in published Indian law opinions (654 in the tier 2 and 3 sample). It also tests a hard format: the official free text is PDF, and the courts' site (OSCN) blocks scripts. Washington was the alternative (29 nations, a clean bulk file share), so it was counted by keyword as a second check (section 6). The project also already holds Oklahoma's 1,062 state-tribal agreements and its state court opinions, so Oklahoma's statutes connect to records we have.

## 3. Oklahoma end to end

### 3.1 Source and terms

The Legislative Service Bureau publishes the whole Oklahoma Statutes free as 89 PDFs, one per title (145 MB), on oklegislature.gov, "last updated on November 12th, 2026" [1]. The page carries no terms of use or copyright notice (checked Nov. 26, 2026). By statute the official publisher of the Oklahoma Statutes is the Secretary of State (75 O.S. § 31.2(3)(c), part of Oklahoma's Uniform Electronic Legal Material Act, Laws 2025, c. 450, effective Jan. 1, 2026), and the official statutes are those certified by the Justices of the Oklahoma Supreme Court (75 O.S. § 192) [2]. OSCN, the courts' site that carries the statutes section by section, answers scripts with a Turnstile challenge [3]. The statute text itself is not copyrightable (*Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020)) [4], and the project's standing rule keeps state statutes link-only with a private copy of what we quote.

### 3.2 Method

1. **Collect and split.** A script downloaded the 89 PDFs, converted them with `pdftotext -layout`, and split them at each section heading ("§12-728. Standards for ..."). Every one of the 47,736 sections in the titles' tables of contents was found in the body, so the split is complete; with the repealed, renumbered and expired entries removed, 33,507 sections are in force (counted). The script drops page footers and the chapter tables of contents printed between sections.
2. **Keyword pass.** Each section was tagged with "strong" terms (Indian tribe, nation, country, reservation, child, land, allotment or Indian affairs; federally recognized tribe; tribal government, court, member, land or compact; Native American; American Indian; Five Civilized Tribes; Bureau of Indian Affairs; state-tribal) and "weak" terms (Indian, tribe or tribal alone, Native, Nation, reservation, allotment, restricted land, and the names of the nations in Oklahoma, after removing county names such as Cherokee County or Osage County). Result: 337 sections with a strong term and 445 more with only a weak term (counted).
3. **Readers.** Small-model (Haiku) readers read every hit and four samples of non-hits, blind to which pool a section came from, with written instructions ([oklahoma-reading-instructions.md](../data-roadmap/2026-11-26-state-statutes/oklahoma-reading-instructions.md)): `core` if the section's subject is Native nations or Indian people, `incidental` if it gives a nation, tribal government, tribal court, tribal member or Indian land a specific legal role, right, duty or exemption in a law about something else, `none` otherwise. Sixteen readers read 3,515 sections in all.
4. **Spot check.** I read 73 of the readers' verdicts myself, drawn at random across the pools.

### 3.3 What Oklahoma's Indian law looks like

The 381 sections (383 printed texts: two sections print in two versions) fall in 48 titles, led by Title 74, State Government (43), Title 68, Revenue and Taxation (40), Title 63, Public Health and Safety (34), Title 10, Children (28), Title 70, Schools (27) and Title 10A, the Children and Juvenile Code (24) (counted). The core sections are the Oklahoma Indian Child Welfare Act (10 O.S. §§ 40 to 40.9), the State-Tribal Gaming Act and Model Tribal Gaming Compact (3A O.S. §§ 261 to 282), the tobacco and motor fuel compact laws (68 O.S. §§ 346 to 429 and 500.63), state-tribal cooperative agreements and the Joint Committee on State-Tribal Relations (74 O.S. §§ 1221 to 1225), the Native American Cultural and Educational Authority and the American Indian Cultural Center (74 O.S. § 1226 and following), the Oklahoma Advisory Council on Indian Education (70 O.S. §§ 3-171 to 3-173), conveyances by full-blood Indian heirs (58 O.S. §§ 901 to 905), recognition of tribal court judgments (12 O.S. § 728), Indian housing authorities, the Office of Tribal Relations, the Missing and Murdered Indigenous Persons liaison, imitation Indian arts and crafts (78 O.S. §§ 71 to 75) and the display of nations' flags at the Capitol (73 O.S. § 26) (read). The incidental sections are mostly modern lists that name tribal governments, tribal courts or tribal police beside federal, state and local ones (in grant eligibility, notice, information sharing, licensing disqualifications, definitions of "State" in uniform acts and tax exemptions) (read).

The list is in [oklahoma-indian-law-sections.csv](../data-roadmap/2026-11-26-state-statutes/oklahoma-indian-law-sections.csv), each row with its relevance, the reader's reason, the terms found and a link to the page of the official PDF where the section starts.

### 3.4 Precision and recall

| Pool | Sections | Read | Indian law | Share |
| --- | --- | --- | --- | --- |
| Strong-term hits | 337 | all | 312 (94 core, 218 incidental) | 92.6% |
| Weak-term-only hits | 445 | all | 71 (9 core, 62 incidental) | 16.0% |
| Non-hits in the same enacting law as a strong hit, or within two sections of one | 2,036 | 500 | 1 | 0.2% |
| All other non-hits | 30,656 | 2,200 (two random samples) | 0 | 0% |

(Counted. The strong and weak pools were drawn with a first version of the parser that kept chapter tables of contents; the final parser leaves the 337 and 445 shown, all of them read.)

- **Precision.** Strong terms alone are 92.6% precise; the misses are "Indian Territory" in pre-statehood railroad and probate laws, "Indian Nation Turnpike" and similar names, and "federally recognized" entities in banking law. Weak terms alone are 16% precise, mostly hotel "reservations", budget "allotments" and highway names. After reading, my spot check agreed with the readers on 72 of 73 verdicts (98.6%); the one disagreement is the Oklahoma Historic Capitols Preservation Act's purpose section (73 O.S. § 99.11), which preserves "former state and Native American capitols" and which I would call incidental rather than none (project analysis).
- **Recall.** The one section found outside the keyword pools is 63 O.S. § 5061.2, the "I/T/U Shared Savings Revolving Fund" (I/T/U stands for Indian Health Service, Tribal and Urban Indian health programs), which uses only the acronym. Scaled to its pool, that is about 4 missed sections (at most 19 at 95% confidence); the 2,200 other non-hits read found none (at most 42 in that pool at 95% confidence) (project analysis, one-sided binomial bounds). So the method found about 99% of Oklahoma's Indian law sections, and at least 86% at 95% confidence. Strong terms alone would find about 81%; the weak-term reading adds the rest.
- **One judgment call: whole acts.** Thirteen sections of the State-Tribal Gaming Act (3A O.S. §§ 264 to 279) set standards for electronic games at horse tracks and never mention a nation; the readers marked them none, and the count above follows the section test, not the act test. A record shape that groups sections by act (section 4) can show them as part of the act without counting them as Indian law.

### 3.5 Cost of the pilot

The scripts ran in minutes (download 8 seconds, conversion 13 seconds, split and keyword pass under a minute). The sixteen Haiku readers used about 2.5 million tokens and finished in under three minutes each (session usage). Through the Message Batches API the same reading would cost about $0.13 at Claude Haiku 5.5's listed price of $0.10 per million input tokens, less the batch discount of 50% [15] (project analysis: 3,515 sections at about 700 tokens each).

## 4. A record shape that fits our law pages

Draft records are in [record-shape-examples.yaml](../data-roadmap/2026-11-26-state-statutes/record-shape-examples.yaml). The first two use only fields the source schema has today and pass it (checked with the schema in `schemas/source.schema.json`): `kind: state-statute`; key `oklahoma-statutes-title-<title>-section-<section>`, matching the existing `oklahoma-statutes-title-12-section-728`; a Citation Style Language `legislation` citation with the heading as title, "Oklahoma Statutes" as container and title and section as volume and section; `original_link` to the official PDF with a `#page=` anchor (the printed page numbers in the tables of contents match the PDF pages; checked for 12 O.S. § 728 on page 160); `rights.basis: government-edict` with `redistribution: false` (link only); `jurisdictions: [{level: state, state: OK}]`; `subjects` from the closed list; topics `state-indian-law` plus `state-indian-law-core` or `-incidental`; and notes holding the Indigo Book citation, the session law history line from the PDF and "Unverified".

Three changes would make these pages work well (proposed, not built):

1. **Give state statutes law pages.** `state-statute` is today one of the kinds "counted only as sources" (`site/src/lib/server/collections.ts`) and is not in the law page kinds (`site/src/lib/server/law-records.ts`), so records would not get a `/laws/<key>` page until it is added.
2. **Add a small `state_law` block to the schema**: `relevance` (core or incidental), `act` (the act's short title, taken from its short title section) and `sections` (for an act-level record that groups its section records, such as the Oklahoma Indian Child Welfare Act), plus `page` for the PDF anchor.
3. **A collection entry** in the statistics registry with a per-state breakdown, so the "State statutes" collection shows counts by state.

## 5. The fifty states

The full table is [fifty-state-survey.csv](../data-roadmap/2026-11-26-state-statutes/fifty-state-survey.csv): official source, format, any bulk file or API, whether a cloud script reached it on Nov. 26, 2026, terms and copyright notes, a difficulty rating and the estimated section count. Facts marked "probed" were fetched by script that day; facts marked "memory" were not checked and should be read as leads.

### 5.1 What the survey found

- **Formats.** Most legislatures publish HTML by chapter or section. The easiest (difficulty 1) offer a whole code in a few files or an API: Oklahoma (title PDFs), Washington (whole-chapter pages and a file share with every section, `lawfilesext.leg.wa.gov/law/RCW`) [9], Oregon, Nevada and North Carolina (whole-chapter pages), Montana, Rhode Island and South Carolina (static indexes), Delaware (title PDFs), Virginia (a REST API in JSON and XML and CSV downloads) [12] and New York (the Senate's Open Legislation API, which needs a free key) [14]. California's site refused scripts (HTTP 403), but its weekly database dump of the codes is downloadable (`pubinfo_2025.zip`, 1.2 GB) [13]. Florida's bulk download is a Windows viewer package in a proprietary format, so its whole-chapter pages are the better route [10].
- **Blocked from the cloud.** Connecticut, Illinois, New Hampshire, West Virginia and Wisconsin failed at the connection (TLS or reset), and Hawaii and California's site returned 403 (probed). These are not legal barriers; a scraper run from GitHub Actions or Trevor's computer would likely reach them (not tested).
- **Publisher-hosted codes.** Arkansas, Georgia, Mississippi and Tennessee publish their codes only through LexisNexis's free public sites, which are JavaScript applications under Lexis terms of use (probed: each returned only a page shell). These are rated 5. Their Indian law is small (estimated 40 to 120 sections each), so a keyword search on Westlaw through Boyd and records written by hand is cheaper than any scraper.
- **Copyright.** The text of state statutes is not copyrightable under the government edicts doctrine, and annotations written for a legislature are not either (*Georgia v. Public.Resource.Org*) [4]. What states still claim is narrower: Minnesota's Revisor registered copyright in its headings, numbering and history notes, though not the statute text (Copyright Office Review Board, 2017) [5]; Virginia's site leaves out the publisher's (Michie's) annotations as copyrighted (probed); and Public.Resource.Org's folders record past disputes with Arkansas, Colorado, Georgia, Idaho, Mississippi, Oregon and Tennessee [6]. Website footers that say "All rights reserved" (Arizona, Missouri, Nebraska and others) cover the sites, not the law. Our records hold citations, headings, short reasons and links, not text, so these claims do not touch them; quoting a section's text is quoting law.

### 5.2 Bulk sources

- **Justia** carries every state's code, but it is an unofficial copy, its terms page returned 403 to a script, and the earlier study found it refuses automated reading [8]. Not usable.
- **The Legal Information Institute (Cornell)** links to each state's official code rather than hosting it (its state pages list the legislature sites) [7]. Its own compilations are copyright Cornell University, and its documentation says that putting them online "does not constitute consent to any use of this material for commercial redistribution"; texts maintained by other institutions are "subject only to such conditions as those institutions set", and government documents "lie in the public domain" [7]. Useful as a list of official sites, not as a source.
- **Public.Resource.Org** posts bulk copies at law.resource.org/pub/us/code, but for states only snapshots from 2012 to 2017 (Arkansas, Colorado, Georgia, Idaho, Mississippi, Oregon and Tennessee folders hold mostly correspondence; Arkansas and Colorado have 2012 scans and XML; Delaware has Title 8 from 2014) [6]. Too old to use, though a fine record of the copyright disputes.

## 6. How many sections nationally

Four states were measured. Oklahoma was counted and read (381). Washington's 2,761 chapters were read by script from the Legislature's whole-chapter pages: 51,378 sections, 976 with a strong term and 969 more with only a weak term (counted; [washington-term-count.json](../data-roadmap/2026-11-26-state-statutes/washington-term-count.json)), which Oklahoma's rates (92.6% and at most 16%) convert to about 900 to 1,060 Indian law sections, led by Title 43, State Government (189 strong-term sections), and Title 28A, Common Schools (91) (project analysis). Florida's 638 chapters: 24,992 sections, 77 with a strong term and 518 with weak terms that are mostly "Miami" (Miami-Dade) and "reservation" (counted; [florida-term-count.json](../data-roadmap/2026-11-26-state-statutes/florida-term-count.json)), so about 70 to 100. Oregon's earlier count found 544 strong-term sections [11], so about 500 to 600.

So the number of nations alone does not predict a code's Indian law: Washington, with 29 nations, has more than twice Oklahoma's with 38, and Oregon, with 9, has more than Oklahoma. Codes differ in style: Washington and Oregon name tribes in many modern lists of governments. Each other state was put in a band by its nations, Indian country and code style (project analysis; the band is in the survey table): heavy, 400 to 1,000 sections (Alaska, Arizona, California, Montana, New Mexico, South Dakota); high, 200 to 450 (Michigan, Minnesota, Nevada, New York, North Dakota, Wisconsin); medium, 100 to 250 (12 states); light, 40 to 120 (22 states). The total is **about 7,500 to 16,500 sections, roughly 11,000** (project analysis). This is narrower than the earlier 8,000 to 20,000 and rests on one full count and three keyword counts, so treat the bands as estimates to be replaced state by state as each is built. About three quarters will be incidental, if Oklahoma is typical.

## 7. Recommended method and cost

**Method, per state:**

1. A script fetches the code from the legislature's own site (or its API or bulk file) and splits it into sections with headings and history lines. Check completeness against the code's own table of contents, as for Oklahoma.
2. The keyword pass, with the term list widened by what the pilot missed (the acronyms I/T/U, IHS and ICWA) and each state's county and place names removed.
3. Small-model readers on every hit through the Message Batches API (or Haiku subagents for small states), with the pilot's instructions.
4. A random sample of 1,000 non-hits read for recall, and a top-model check of 75 verdicts; stop and fix the term list if recall falls below 95%.
5. Records written by script in the section 4 shape, Unverified, link-only, with a private R2 copy of each title or chapter file read.

**Order.** The heavy and high states first (Washington, California through its bulk dump, Arizona, New Mexico, Alaska, Montana, South Dakota, Oregon, Oklahoma's records from this pilot, then Minnesota, Michigan, Nevada, New York, North Dakota, Wisconsin), then the rest by difficulty. Cloud-blocked states go to GitHub Actions or Trevor's computer; the four Lexis states by hand on Westlaw.

**Cost.** Reading: about 125,000 sections nationally (every hit plus the recall samples, at about 2,500 per state) at about 700 tokens each is about 90 million tokens, about $9 at Haiku 5.5's listed input price, about $4.50 through batches, plus a little for output [15] (project analysis). Spot checks by the top model: about 3,750 sections, a few dollars. Hosting: link-only records add nothing to serve; private copies of the codes are a few gigabytes in R2, under $0.10 a month (project analysis from Oklahoma's 145 MB). The real cost is agent time to write and check 46 scrapers: about an hour each for difficulty 1 and 2, half a day for 3 and 4, so roughly 10 to 15 working sessions, plus a day by hand for the four Lexis states (project analysis).

## 8. Choices for Trevor

1. **Which sections become records:** both kinds, labeled core or incidental (recommended: the incidental ones are where most state Indian law lives, and a practitioner needs them), or core only (about a quarter).
2. **Whether to build now:** the tier 2 and 3 note left tier 3 waiting on whether states get a separate site. This pilot shows the work is cheap and mechanical, so building state statutes on this site, behind the "State statutes" collection, is practical whenever Trevor chooses.

## 9. Files

- `scripts/analysis/state_statutes/ok_parse.py` splits the Oklahoma PDFs into sections and tags terms; `ok_batches.py` draws the blind reading pools; `wa_count.py` and `fl_count.py` count Washington and Florida; `survey_rows.py` writes the fifty-state table.
- `research/data-roadmap/2026-11-26-state-statutes/`: `oklahoma-indian-law-sections.csv` (381 sections), `oklahoma-readings.json` (all 3,515 readings with pool and verdict), `oklahoma-reading-instructions.md`, `fifty-state-survey.csv`, `nations-by-state.json` (from the nation profiles), `washington-term-count.json`, `florida-term-count.json` and `record-shape-examples.yaml`.

## 10. Sources

1. Oklahoma Legislature, *Oklahoma Statutes*, https://www.oklegislature.gov/osStatuesTitle.html, with the title files at https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os1.pdf to os85A.pdf (89 files; downloaded Nov. 26, 2026).
2. Okla. Stat. tit. 75, §§ 31.2, 31.4, 31.8 (Laws 2025, c. 450, eff. Jan. 1, 2026) and § 192, read in the Title 75 file of source 1.
3. Oklahoma State Courts Network, https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST&level=1 (a script received a Turnstile challenge page, Nov. 26, 2026).
4. *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020), slip opinion https://www.supremecourt.gov/opinions/19pdf/18-1150_7m58.pdf.
5. U.S. Copyright Office Review Board, letter to the Minnesota Revisor of Statutes on "Minnesota Statutes 2014" (Aug. 3, 2017), https://www.copyright.gov/rulings-filings/review-board/docs/minnesota-statutes-2014.pdf.
6. Public.Resource.Org, *Law.Resource.Org: Bulk Access to Primary Legal Materials*, https://law.resource.org/pub/us/code/ and its state folders (listings read Nov. 26, 2026).
7. Legal Information Institute, *LII Site Documentation*, https://www.law.cornell.edu/lii/terms/documentation, and *State law listing*, https://www.law.cornell.edu/states/listing (read Nov. 26, 2026).
8. Justia, *Terms of Service*, https://www.justia.com/terms-of-service (HTTP 403 to a script, Nov. 26, 2026); tier 2 and 3 note, source 13.
9. Washington State Legislature, *Revised Code of Washington*, chapter pages https://app.leg.wa.gov/RCW/default.aspx?cite=37.12&full=true (and every other chapter), and the file share https://lawfilesext.leg.wa.gov/law/RCW/ (read Nov. 26, 2026).
10. Florida Legislature, *Online Sunshine*, https://www.leg.state.fl.us/statutes/ (whole-chapter pages and the download page; read Nov. 26, 2026).
11. Tier 2 and 3 note, section 3.2 and source 12 (Oregon count).
12. Virginia Division of Legislative Automated Systems, *Virginia Law Developers page*, https://law.lis.virginia.gov/developers/ (read Nov. 26, 2026).
13. California Legislative Counsel, downloads index, https://downloads.leginfo.legislature.ca.gov/ (read Nov. 26, 2026).
14. New York State Senate, *Open Legislation laws API*, https://legislation.nysenate.gov/static/docs/html/laws.html (read Nov. 26, 2026; the API answered 401 without a key).
15. Anthropic API prices as listed in Claude Code's Claude API reference (cached Nov. 3, 2026): Claude Haiku 5.5 $0.10 per million input tokens and $0.50 per million output tokens; Message Batches at 50% of standard prices.
16. Repository nation profiles, `content/tribes/` (federally recognized nations counted by the state of their government office; 581 in all, because a few nations have offices in two states).
