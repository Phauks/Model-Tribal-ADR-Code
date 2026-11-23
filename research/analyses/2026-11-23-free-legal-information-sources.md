# Free legal information projects as sources: Free Law Project and others

**Status:** research notes, written Nov. 23, 2026, in answer to Trevor's question about using "this project online that is about free access to legal information" that "has done stuff in the past." He did not name it. This note reads it as the Free Law Project, with CourtListener, its citation tools and its bulk data. It also covers the Caselaw Access Project, the Legal Information Institute at Cornell, the Free Access to Law Movement, the National Indian Law Library, the Tribal Court Clearinghouse, Justia and GovInfo. Trevor chose items 1 and 2 of section 3 on Nov. 23, 2026, and both were built that day: the citation check ([review](../reviews/2026-11-23-case-citations-courtlistener.md)) and the tribal court opinions ([index](../tribal-court-opinions/README.md)). Items 3 to 8 are parked. Counts marked "project analysis" come from scripts run on Nov. 23, 2026, against the project's source records and the downloaded data named in each footnote.

## 1. What each project offers this project

### 1a. Free Law Project and CourtListener

The Free Law Project is a nonprofit that runs CourtListener, a free case law search site, along with RECAP and open tools such as eyecite (a citation finder built with the Harvard Library Innovation Lab) and juriscraper. It joined the Free Access to Law Movement in 2013.[^flp-falm] Four parts of it fit this project.

**Citation lookup.** A single request can send up to 250 citations, or up to 64,000 characters of text, and CourtListener answers each citation with found, not found, ambiguous or unknown reporter. It is throttled to 60 valid citations a minute, and it does not look up statutes, journals, "id." or "supra."[^citation-lookup] The project's 109 case records hold 98 with a volume, reporter and page (project analysis),[^records] so one request would check them all.

**The citation graph.** The opinions-cited endpoint lists the opinions an opinion cites and the later opinions that cite it, with a count of how often. It carries no treatment labels, and its own page warns that missing parallel citations "can impact the accuracy of the graph."[^citations-api]

**A citator, but not yet.** In May 2025 the Free Law Project reported a test of whether AI models can tell when one Supreme Court opinion overrules another. It was a progress report with no launch date and no API, and it did not cover "distinguished" or "declined to extend."[^citator] So nothing from the Free Law Project replaces KeyCite today. The negative treatment that matters to the style guide still has to come from Westlaw.

**Tribal court opinions.** CourtListener lists 42 tribal courts holding 2,205 opinions in all. The largest are the Navajo Nation Supreme Court (553), the Fort Peck Appellate Court (345), the Mohegan Gaming Disputes Trial Court (184) and the Navajo Nation Court of Appeals (180).[^jurisdictions] These courts and their counts match West's American Tribal Law Reporter and the Navajo Reporter as digitized by the Caselaw Access Project (section 1b), so the tribal opinions end in 2017 (project analysis, comparing the two lists). The Caselaw Access Project files hold a little more, such as 110 opinions of Navajo Nation district courts that CourtListener does not list as tribal.

**Terms, keys and limits.** The REST API (version 4) now needs a token: an unsigned search request from this project's cloud machine was refused with "Authentication credentials were not provided" on Nov. 23, 2026 (project test). A free account gets 5 requests a minute, 50 an hour and 125 a day. Paid memberships run from $10 to $100 a month for higher limits, and an "EDU" membership is free for faculty, students and researchers with a .edu address.[^membership] The usage rules allow "personal, educational, research, journalistic, and exploratory use" but bar using the API "to build tools for for-profit or non-profit organizations."[^allowed-use] The pages read say nothing about showing API results on a public website, so that would need a question to the Free Law Project's partnerships team before the site calls the API itself.[^allowed-use]

**Bulk data.** Separate from the API, CourtListener publishes its whole database each quarter as compressed CSV files, marked "free of known copyright restrictions" with a Public Domain Mark.[^bulk] No key is needed. The Sept. 30, 2026, files include the citations table (128 MB), the citation map (533 MB), the opinion clusters (2.5 GB) and the full opinions (55 GB). A parentheticals file (290 MB) holds courts' own one-line descriptions of the cases they cite (project check of the public file list).[^bulk-files]

**A Claude connector.** The Free Law Project announced a connector for Claude in May 2026,[^membership-post] and a CourtListener connector is listed in the claude.ai connector directory (project check, Nov. 23, 2026). It would let any project thread search CourtListener and extract citations under Trevor's own account and limits.

### 1b. Caselaw Access Project (Harvard Library Innovation Lab)

Harvard scanned its print reporters, about 6.5 million decisions, and in March 2024 the data became free to use "without restriction on access or use." The lab kept bulk files and readable cases at case.law and handed search to CourtListener, which "already includes all CAP cases"; the old search and API were wound down.[^cap-transition] The files sit at static.case.law and need no key (project check).

Two of its 401 reporters are tribal. West's American Tribal Law Reporter has 13 volumes, 1997 to 2017, with 1,951 cases, of which 278 are federal court decisions reprinted for Indian law. The Navajo Reporter has 8 volumes, 1969 to 2006, with 695 Navajo Nation cases.[^cap-tribal] Every volume of both is marked redacted, which in the Caselaw Access Project means the publisher's headnotes and summaries were removed and the courts' own text kept (project check of the volume metadata).[^cap-tribal] Together they hold 2,368 tribal court opinions from courts serving 24 Native nations (project analysis). The Navajo Nation has 949 of them and the Fort Peck Tribes 353, while the White Earth Band and a few others have one each.

A keyword pass over those 2,368 opinions found "sovereign immunity" in 328 and the Indian Civil Rights Act in 231. "Peacemaking" appears in 45 (28 of them from the Navajo Nation Supreme Court), arbitration in 33, mediation in 32 and "restorative justice" in 4 (project analysis).[^cap-terms] These are keyword hits, not readings, and some will be passing mentions. A first count of 291 for arbitration was wrong: its pattern also caught "arbitrary."

Each case also lists the cases it cites. Matching those lists against the project's 98 citable case records found 41 records cited by at least one tribal court. *Santa Clara Pueblo v. Martinez* is cited in 76 tribal opinions, *Montana v. United States* in 47 and *Williams v. Lee* in 29 (project analysis).[^cap-cites]

### 1c. National Indian Law Library (Native American Rights Fund)

The National Indian Law Library runs the Tribal Court Bulletin, "selected tribal court opinions 2016 - present," built from broad searches of Westlaw, Lexis, Casemaker and VersusLaw and from tribal websites, usually updated each week.[^nill-court][^nill-about] It posts full text, some of it vendor material "under an agreement with the vendor," so its copies are not ours to republish.[^nill-about] The 2026 page lists about 22 opinions; its last update was Nov. 4, 2026.[^nill-2026] This is the best free source for tribal opinions after 2017, the year the Caselaw Access Project data stops.

Its Tribal Law Gateway warns that a nation's permission to share a text with the library is not consent to other uses, and that it "will deny requests that appear to be frequent or systematic."[^nill-gateway] So the library is a source a person reads and asks (Ask NILL), not one to script against. The project already uses it this way for codes.

### 1d. Tribal Court Clearinghouse (Tribal Law and Policy Institute)

The Clearinghouse's decisions page links to about 59 tribal courts' own opinion pages by state, 24 of them in Washington through the Northwest Intertribal Court System, and to a searchable database run with VersusLaw. The page carries no date, and some links are old addresses.[^tlpi] It is a finding list for courts the other sources miss, not a data source.

### 1e. Legal Information Institute (Cornell)

The Legal Information Institute started the free access to law movement in 1992.[^falm] It is the host for 58 of the project's 109 case records (project analysis).[^records] Its terms welcome links. It claims no copyright in U.S. government works, but its own markup and added features are licensed under Creative Commons BY-NC-SA 2.5, and it does not consent to commercial redistribution.[^lii] It offers no API. It should stay a link target, with the project's own copies taken from official sources such as supremecourt.gov or GovInfo.

### 1f. GovInfo (Government Publishing Office)

GovInfo's API needs a free api.data.gov key and allows 36,000 requests an hour.[^govinfo] Its United States Courts Opinions collection holds opinions from selected federal appellate, district and bankruptcy courts, generally from 2004 on, as PDFs.[^uscourts] The project already files GovInfo PDFs as its own copies (decision record 0031). The API would let a script find the official PDF for a federal case decided since 2004 without guessing addresses.

### 1g. Justia and the Free Access to Law Movement

Justia publishes free case pages and a Native American law opinion summary feed.[^justia-feed] This note did not read Justia's terms, and Justia has no public API, so it stays a link target only. The Free Access to Law Movement is a network of free legal information institutes under the 2002 Montreal Declaration; it offers no data or service of its own.[^falm]

## 2. What this means for the project

Three points shape the proposals (project analysis, from section 1).

First, citation checking and tribal opinions can come from public domain bulk data, with no key and no usage rule to break: the Caselaw Access Project files and CourtListener's quarterly exports. Live API calls need a token and fall under rules written for individuals, so they belong in research scripts run by a person, not in the website.

Second, no free source gives KeyCite-style negative treatment. CourtListener's graph says who cited a case, and the parentheticals say how a court described it, which can point a person to a likely "distinguished" or "declined to extend." A person still has to confirm it in Westlaw.

Third, the tribal opinions stop in 2017 (2006 for the Navajo Reporter). Anything newer comes from the National Indian Law Library's bulletin, the courts' own sites and the nations themselves.

## 3. Proposed uses, ranked

Ranked by value to the model code and the website against the work and risk each takes (project analysis).

1. **Check every case citation through CourtListener's citation lookup.** One script sends the 98 citable case records in one request, records each match, and flags any citation that is not found or is ambiguous. It also stores each case's CourtListener identifier on the record, which later uses build on. A free CourtListener token is enough, kept as an environment secret and never in GitHub. Trevor's UNLV address should qualify for the free EDU tier, though this note did not test that. About half a day of work.
2. **Bring in the tribal court opinions from the Caselaw Access Project.** Load the 2,368 opinions as research data and link each to its nation's record. Then pull out the ones on peacemaking, mediation, arbitration and sovereign immunity for the Foundations and code chapters. This is the largest store of tribal judicial writing on dispute resolution the project can get for free. Whether the website shows these opinions is a separate choice (open question 1). About two days, more for reading.
3. **Show "cited by tribal courts" on case pages.** From the same data, list on each federal case page the tribal court opinions that cite it (41 cases have at least one). This tells readers how nations' own courts have used *Santa Clara Pueblo* or *Montana*, which no commercial citator puts first. About a day after item 2.
4. **Find treatment leads from CourtListener's parentheticals and citation graph.** Most of the 98 cases still wait on KeyCite (20 have a citator result now). For each, list later opinions whose parentheticals use words such as "distinguishing," "declining to extend" or "overruled," as leads for the Westlaw pull list. It saves search time but never replaces the Westlaw check. Uses the 290 MB parentheticals file; about a day.
5. **Link case citations automatically in essays and pages.** Run eyecite over essays and commentary when the site builds, and link each citation to the project's own case page or copy, falling back to CourtListener. It is open source and runs at build time, so the site makes no live calls. About a day.
6. **Add the CourtListener connector to the project.** It lets research threads search case law and extract citations directly. It is quick, but it runs under Trevor's account limits and the usage rules in section 1a.
7. **Fetch official federal opinion PDFs from GovInfo.** For federal cases decided since 2004, find the court's own PDF through the GovInfo API and file it as the project's copy, in place of Legal Information Institute or Justia pages. Needs a free api.data.gov key. Small gain, since most key cases are Supreme Court cases already copied from supremecourt.gov.
8. **Give back.** Send the Free Law Project corrections found in items 1 and 2, and tell it about tribal courts it lacks. Sharing tribal opinions gathered after 2017 should wait for each nation's consent under the project's CARE principles commitment. Low cost, best done after items 1 and 2.

Not proposed: scripted use of the National Indian Law Library (its terms bar systematic requests), and any live CourtListener API call from the website until the Free Law Project says public display is allowed.

## 4. Open questions for Trevor

1. Should the website show the Caselaw Access Project's tribal court opinions in full, as it does nations' constitutions and laws under decision record 0031, with the same removal link? The data is free of restriction and the headnotes are already removed, but the opinions are nations' judicial records, and some nations may want a say (CARE principles).
2. Which of the eight uses to build, and in what order. The ranking above is a recommendation.
3. Whether to sign up for a CourtListener account (free, or EDU with a UNLV address) so item 1 can run. The token would go in the cloud environment's secrets and in Cloudflare only if the site ever needs it.

## Sources

[^flp-falm]: Free Law Project, *Free Law Project Joins the Free Access to Law Movement* (Dec. 10, 2013), https://free.law/2013/12/10/free-law-project-joins-free-access-to-law-movement/.
[^citation-lookup]: Free Law Project, *Citation Lookup and Verification API*, CourtListener Help (REST API v4), https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup (last visited Nov. 23, 2026); Michael Lissner, *Announcing Our Citation Lookup API*, Free Law Project (Apr. 16, 2024), https://free.law/2024/04/16/citation-lookup-api/.
[^records]: Project analysis of `content/sources/` on Nov. 23, 2026: 109 records of kind federal-case (95), territorial-case (7), state-case (6) and tribal-case (1); 98 carry volume, reporter and page; 20 carry a `citator` result; 58 cite www.law.cornell.edu as their link.
[^citations-api]: Free Law Project, *Citation APIs*, CourtListener Help (REST API v4), https://wiki.free.law/c/courtlistener/help/api/rest/v4/citations (last visited Nov. 23, 2026).
[^citator]: Rachel Gao, *Building a Citator with AI, A Progress Report*, Free Law Project (May 1, 2025), https://free.law/2025/05/01/citator/.
[^jurisdictions]: CourtListener, *Available Jurisdictions*, https://www.courtlistener.com/help/api/jurisdictions/ (last visited Nov. 23, 2026) (rows with jurisdiction "Tribal").
[^membership]: Free Law Project, *Membership*, https://free.law/membership/ (last visited Nov. 23, 2026); Free Law Project, *REST API v4 Overview*, CourtListener Help, https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview (last visited Nov. 23, 2026).
[^allowed-use]: Free Law Project, *Allowed API Usage*, https://free.law/membership/allowed-api-usage/ (last visited Nov. 23, 2026).
[^membership-post]: Jenifer Whiston, *API Included in Memberships*, Free Law Project (May 7, 2026), https://free.law/2026/05/07/api-included-in-memberships/.
[^bulk]: Free Law Project, *Bulk Legal Data*, CourtListener Help, https://wiki.free.law/c/courtlistener/help/api/bulk-data/bulk-legal-data (last visited Nov. 23, 2026).
[^bulk-files]: CourtListener bulk data file list, https://com-courtlistener-storage.s3-us-west-2.amazonaws.com/list.html?prefix=bulk-data/ (checked Nov. 23, 2026; files dated Sept. 30, 2026).
[^cap-transition]: Harvard Library Innovation Lab, *Transitions for the Caselaw Access Project* (Mar. 26, 2024), https://lil.law.harvard.edu/blog/2024/03/26/transitions-for-the-caselaw-access-project; Harvard Library Innovation Lab, *Caselaw Access Project*, https://lil.law.harvard.edu/our-work/caselaw-access-project (last visited Nov. 23, 2026).
[^cap-tribal]: Caselaw Access Project, *ReportersMetadata.json*, *VolumesMetadata.json* and *CasesMetadata.json* for the reporters `am-tribal-law` and `navajo-rptr`, https://static.case.law/ (downloaded Nov. 23, 2026).
[^cap-terms]: Project analysis: case-insensitive search of the opinion text in all 21 volume files of the two reporters, https://static.case.law/am-tribal-law/ and https://static.case.law/navajo-rptr/ (downloaded Nov. 23, 2026), leaving out federal court decisions. The patterns are in `research/tribal-court-opinions/sources.yaml` and the counts in `research/tribal-court-opinions/counts.json`, written by `scripts/caselaw/tribal_court_opinions.py`. The 17 opinions of the Grand Ronde Court of Appeals that the Caselaw Access Project files under the Navajo Nation are counted for Grand Ronde.
[^cap-cites]: Project analysis: each tribal opinion's `cites_to` list in the same files, matched against "volume reporter page" built from the project's 98 citable case records.
[^nill-court]: National Indian Law Library, *Find Tribal Courts and Court Opinions*, https://nill.narf.org/triballaw/court.html (last visited Nov. 23, 2026).
[^nill-about]: National Indian Law Library, *About the Tribal Court Opinion Indian Law Bulletin*, https://narf.org/nill/bulletins/tribal/about.html (last visited Nov. 23, 2026).
[^nill-2026]: National Indian Law Library, *2026 Tribal Courts Cases*, https://www.narf.org/nill/bulletins/tribal/2026.html (last visited Nov. 23, 2026).
[^nill-gateway]: National Indian Law Library, *Tribal Law Gateway*, https://nill.narf.org/triballaw/ (last visited Nov. 23, 2026).
[^tlpi]: Tribal Law and Policy Institute, *Tribal Court Decisions*, Tribal Court Clearinghouse, https://tribal-institute.org/lists/decision.htm (last visited Nov. 23, 2026).
[^falm]: *Free Access to Law Movement*, Wikipedia, https://en.wikipedia.org/wiki/Free_Access_to_Law_Movement (last visited Nov. 23, 2026).
[^lii]: Legal Information Institute, *Terms of Use*, https://about.law.cornell.edu/terms/ (last visited Nov. 23, 2026).
[^govinfo]: U.S. Government Publishing Office, *GovInfo API* (README), https://github.com/usgpo/api (last visited Nov. 23, 2026).
[^uscourts]: U.S. Government Publishing Office, *About United States Courts Opinions*, GovInfo Help, https://www.govinfo.gov/help/uscourts (last visited Nov. 23, 2026).
[^justia-feed]: Justia, *Native American Law Opinion Summaries* (feed), https://law.justia.com/summaryfeed/native-american-law/ (last visited Nov. 23, 2026).
