# Harvard's Native resources: what they hold and what we should acquire

**Status:** research spike, written Nov. 26, 2026, in answer to Trevor's request "Investigate the harvard Indian resource center for what data they have that we should acquire." Nothing was built and no site content was changed. The two lists this note counts are in [`research/harvard-resources/`](../harvard-resources/).

## 1. Short answer

Harvard has no body named "Indian resource center." Four Harvard places hold Native material, and the one most likely meant is the **Project on Indigenous Governance and Development** at Harvard Kennedy School, formerly the Harvard Project on American Indian Economic Development, which runs Honoring Nations and keeps a public research repository [1][2][3]. The second most likely is the **Harvard Law School Library's Tribal Law research guide**, the library's own list of Native law sources [4]. I checked both, plus the **Caselaw Access Project** (Harvard Law School Library's case law scans) and **Harvard Dataverse**. The **Harvard University Native American Program** (HUNAP) is a student and community program; its library page only points to the library's research guides and the Tozzer Library's Indigenous Knowledge Collection of zines, comics and games, so it has no legal data to acquire [5].

What we should get, best first:

1. **Indian claims cases in the Caselaw Access Project**: about 629 Court of Claims cases (1883-1982) and 92 Claims Court cases (1982-1992) with a Native nation or Native people as a party, plus all 575 cases of the *Indian Territory Reports* (1895-1907). Free, no restrictions, and a script can fetch them. We hold records for 4 claims court cases. Tier 2.
2. **The Library of Congress collection Harvard's guide lists first for constitutions** ("Native American Constitutions and Legal Materials"): 426 items, of which 309 are not in our records. That includes 48 nineteenth-century session laws and codes of the Five Tribes and others, and an estimated 45 to 120 constitution or charter versions we lack. Free, scriptable (slowly).
3. **Harvard Project reports on Tribal courts and justice** (25 items on its Justice topic page, 1993-2018), such as *Hualapai Judicial Reform: Developing Alternative Dispute Resolution* (1997) and *New Law and Old Law Together* (Navajo, 1999). We hold 3 Honoring Nations items in all. Copyrighted by Harvard: private copies, cite and link.
4. **Two public-domain (CC0) data sets on Harvard Dataverse**: Arthur Spirling's classification of 595 treaties (operable, ratified agreement, rejected, unratified) with Deloria-DeMallie numbers, and C. Timothy McKeown's 2026 acreage table for 319 reservations and 25 Oklahoma Tribal Statistical Areas. Both scriptable, both servable.
5. **The rest of the Harvard Project repository** (361 items): index them as source records with links, take private copies only of what we cite, and use the facts in its 2025 *Databook* of Census figures for reservations.
6. **Harvard Law School Library's paid databases** (HeinOnline's Native law collection with the 1981 and 1988 tribal code microfiche, LLMC's Indigenous Law Portal, ProQuest Indian Claims Insight): only reachable through a subscribing library. Worth asking whether UNLV's Boyd library has them, because the 1981 and 1988 codes would give older versions of nations' codes.

## 2. The four Harvard candidates

| Candidate | What it is | Native legal holdings | Copyright and terms | Can a script get it? | What we already have |
| --- | --- | --- | --- | --- | --- |
| Project on Indigenous Governance and Development (Kennedy School, Ash Center) | Research and Honoring Nations awards since 1998 [1][2] | Research repository of 361 items [3] | © Harvard Project; hard-copy print and distribution allowed, other reuse by permission [6] | Not from our cloud machines: the site returns 403 to scripts (checked Nov. 26, 2026). The fetch tool can read pages and PDFs one by one. Older Honoring Nations PDFs are also on the University of Arizona's Indigenous Governance Database, which scripts can reach [7] | 3 Honoring Nations source records and 1 outreach record |
| Harvard Law School Library | Tribal Law research guide (updated Aug. 26, 2026) and print and rare collections [4] | Guide to free and paid sources; print tribal codes reclassed into KIE-KIK; rare tribal materials keyed to Hargrett's 1947 bibliography [4] | Free sources vary; paid databases under license | The guide yes; the Harvard catalog API (LibraryCloud) returned 403 from our machines; paid databases no | Most of the free sources the guide lists (section 4) |
| Caselaw Access Project (Harvard Law School Library) | Scans of all published U.S. case law to 2018 [8] | 401 reporters, including the tribal reporters and the claims courts [9] | Released without restriction [8] | Yes: static.case.law files, no key | Both tribal reporters (2,368 opinions); none of the claims reporters |
| Harvard Dataverse | Harvard's open data repository | Two Native law data sets found (section 6) | CC0 | Yes: Dataverse API, no key | Neither |
| Harvard University Native American Program | Student, community and events program [5] | None; links to library research guides [5] | n/a | n/a | n/a |

## 3. Project on Indigenous Governance and Development

**Name.** The Project's terms of use still call it "The Harvard Project on American Indian Economic Development" [6]; it joined the Ash Center in 2019 and its old site was hpaied.org (our outreach record `harvard-project-on-indigenous-governance-and-development` cites the Ash Center release). It works with the Native Nations Institute at the University of Arizona, its "sister organization," on the Joint Occasional Papers on Native Affairs [3].

**Holdings.** The research repository lists 361 results (345 published, 16 working papers). By type: Honoring Nations Awardee Profiles 145, Field Reports 91, Project Reports 39, Articles 14, Working Papers 16, Teaching Cases 11, Testimony and Speeches 11, Joint Occasional Papers 10, Honoring Nations Reports 9, Policy Briefs 9, Books 4, Databooks 2, Tools and Data 1 [3]. Honoring Nations "has recognized 148 exemplary tribal government programs" from "over 100 tribal nations" [2]; the repository's honoree years run 1999 to 2025 [3]. By Honoring Nations topic: Economic and Community Development 104, Government Performance 50, Environmental and Natural Resources 47, Intergovernmental Relations 44, Cultural Affairs 40, Education 37, Health and Social Services 36, Justice 26 [3].

The only data set is the third edition of the *Databook* (Akee, Moreno and Besaw-Medford, 2025): Census and American Community Survey figures for reservations, 1990-2020, published as a PDF [10]. A 2026 working paper describes "a comprehensive dataset of settler/Indigenous violent encounters covering more than 200 tribes in 21 western states," but the page does not say where it is published [3].

**The Justice topic.** The Justice topic page lists 25 items (the facet count says 26; the page repeats one item) [11]. The Tribal court and dispute resolution ones, with their honoree or report year:

| Year | Item | Nation |
| --- | --- | --- |
| 1993 | Developing Restitution as an Alternative Sanction for the Tuba City Family Court | Navajo Nation |
| 1994 | The Oglala Lakota Judiciary: Meeting Nontribal Demands and Tribal Needs | Oglala Sioux Tribe |
| 1997 | Hualapai Judicial Reform: Developing Alternative Dispute Resolution | Hualapai Tribe |
| 1998 | Building Support for the Development of the Hualapai Tribal Court | Hualapai Tribe |
| 1999 | Crow Tribal Courts in the 21st Century: Changing Paths, Strengthening the Vision | Crow Tribe |
| 1999 | New Law and Old Law Together | Navajo Nation |
| 1999 | Tribal Court of the Grand Traverse Band (we hold the Arizona copy) | Grand Traverse Band |
| 2000 | Jiway Gwavo, The War Room: Building a Hualapai Department of Justice | Hualapai Tribe |
| 2003 | Northwest Intertribal Court System | Nine member nations |
| 2005 | Choctaw Tribal Court System | Mississippi Band of Choctaw Indians |
| 2006 | Alternative Sentencing Program | Tulalip Tribes |
| 2010 | Joint Tribal-State Jurisdiction | Leech Lake Band of Ojibwe |
| 2015 | Kenaitze Tribal Court | Kenaitze Indian Tribe |
| 2018 | Sitka ICWA Partnership | Sitka Tribe of Alaska |

The other Justice items cover policing (Yankton 2004, Flandreau 2005, Gila River 2003, and a 2001 report to the National Institute of Justice), corrections and reentry (Navajo 2003, Muscogee 2008), child welfare (Port Gamble S'Klallam 2014, Navajo 2000), wellness (Yurok 2018), methamphetamine (Navajo 2006) and a 2007 *Wall Street Journal* reprint [11]. None of the 14 above is in our records except Grand Traverse Band (searched by title in `content/` and `research/`, Nov. 26, 2026).

**Terms.** "The copyrights for this website are owned by The Harvard Project on American Indian Economic Development." Readers may "view, print and/or distribute Content in hard copy"; other uses need permission from hpaied@hks.harvard.edu [6]. The footer reads "Copyright © 2026 The President and Fellows of Harvard College" [11]. Under our hosting rules these are **private copy, link** (docs/data-roadmap.md, "Hosting rules"): we keep a private copy of what we cite, quote briefly, and link to the Project.

## 4. Harvard Law School Library's Tribal Law guide

The guide sorts its sources into tribal law (databases, print, constitutions, codes, cases) and federal Indian law (texts, treaties, claims, statutes, regulations, cases) [4]. The free sources it lists, checked against our records:

| Source the guide lists | Its size | What we hold |
| --- | --- | --- |
| National Indian Law Library, Tribal Law Gateway | 596 nation pages | All 596 read and matched (NILL coverage note, Nov. 24, 2026) |
| Library of Congress, Native American Constitutions and Legal Materials | 426 items (counted from the collection's API, Nov. 26, 2026) [12] | 117 referenced by item number; 309 not (see below) |
| University of Oklahoma, Native American Constitution and Law Digitization Project and IRA constitutions | Hundreds of pages | 357 constitution documents; 722 captures |
| The Memory Hole 2, constitutions of 440 nations from the Bureau of Indian Affairs | 11 Internet Archive items | Held: 497 documents (`research/constitutions/README.md`) |
| Tribal Court Clearinghouse codes and decisions | "About 140 codes"; decisions of 58 courts [4] | 15 captures; used as a finding list |
| Caselaw Access Project, *American Tribal Law Reporter* | 13 volumes | Held in full |
| Oklahoma State University, Kappler | 7 volumes | Treaty records built from it; full Kappler is a planned roadmap row |
| Solicitor's opinions, 1917-1974 | About 509 | Spiked (federal laws coverage note, section 5) |
| Interior administrative decisions | Bibliography page | Interior Board of Indian Appeals is a planned roadmap row |

**Library of Congress items not in our records.** Of the 309, by title: 138 constitutions or bylaws, 108 corporate charters, 48 laws, acts or codes, and 15 other. A rough match of nation name and year against our constitution catalog suggests about 127 of the constitutions and charters are versions we already hold from another copy, about 45 are versions we lack for nations we know, and 74 did not match a nation name automatically and need a person or a better matcher (project analysis; method in section 8). The 48 laws are the clearest gain: for example *Laws of the Cherokee Nation, adopted by the Council at various periods* (1826), the Chickasaw *Constitution and laws* with the treaties of 1832-1866, the Osage *Treaties and laws* (1890), the Muscogee *Acts and resolutions* (1893-1899) and the Tahlequah town ordinances. The list is [`library-of-congress-items-not-in-our-records.csv`](../harvard-resources/library-of-congress-items-not-in-our-records.csv). The site answered with 429 (too many requests) and 503 at 3-second spacing, so a build should wait 15 seconds or more between pages.

**Paid sources** (Harvard Key or HLS only) the guide relies on, which we cannot script: HeinOnline *Indigenous Peoples of the Americas* (constitutions, acts and bylaws; the 1981 and 1988 Indian Tribal Codes microfiche, digitized; treaties; the *Indian Law Reporter*, 1974-2013), the LLMC Indigenous Law Portal, ProQuest Indian Claims Insight, Westlaw (24 tribal codes) and Lexis (96 tribal codes, cases from 112 Tribal courts), and vLex (81 Tribal courts) [4]. The guide also notes that Harvard reclassed its print tribal law from KF 8228 to KIE-KIK "as part of a reparative project," and that many rare items carry Hargrett bibliography numbers [4].

## 5. Caselaw Access Project: claims courts and Indian Territory

We already hold both tribal reporters (`research/tribal-court-opinions/`). The project's reporter list (401 reporters) has three more that matter for tier 2 [9]:

| Reporter | Years | Cases | Native party in the case name |
| --- | --- | --- | --- |
| United States Court of Claims Reports (`us-ct-cl`) | 1853-1982 | 18,452 | About 629 (1883-1982) |
| United States Claims Court Reporter (`cl-ct`) | 1982-1992 | 3,254 | About 92 |
| Indian Territory Reports (`indian-terr`) | 1895-1907 | 575 | All (courts sitting in Indian Territory) |

The counts come from each volume's `CasesMetadata.json`, matching case names on words such as Indians, Tribe, Nation, Band, Pueblo and Rancheria and dropping obvious misses such as railroads (project analysis; some false matches remain, and cases about Native people not named as parties are missed). The 1,296 rows are in [`caselaw-access-project-claims-and-indian-territory-cases.csv`](../harvard-resources/caselaw-access-project-claims-and-indian-territory-cases.csv), each with a link to the case file. The *Federal Claims Reporter* (1991-2018, 109 volumes) was not counted. Opinions are government edicts, so these are **Serve** under the roadmap's hosting rules. This fills the roadmap's "Lower federal court cases" row for the Court of Claims and pairs with the Indian Claims Commission row, whose appeals went to the Court of Claims.

## 6. Harvard Dataverse

Searching the Dataverse API for Native law terms found two open data sets worth taking (both CC0, both checked Nov. 26, 2026):

- **Spirling, "Replication data for: US Treaty-making with American Indians"** [13]: `UniverseCases.csv` lists 595 treaties, each classed as valid and operable, ratified agreement, rejected or unratified, with the nations and bands, place, date, Deloria-DeMallie number and a Kappler link, plus the texts in four zip files. Use: cross-check our 370 ratified, 169 unratified and 149 agreement records.
- **McKeown, "Area of Federal Indian Reservations: Trust and Non-Trust Lands, and Oklahoma Tribal Statistical Areas"** (2026) [14]: total, trust and estimated non-trust acreage for 319 reservations and 25 Oklahoma areas. Use: a land fact on nation pages, cited.

The same search also turns up University of Michigan (ICPSR) studies indexed in Dataverse, such as the National Survey of Tribal Court Systems, 2014, and the Census of Tribal Justice Agencies, 2002 [15]. They are not Harvard's; ICPSR's own terms apply and need a separate check.

## 7. Recommended acquisitions, ranked

| Rank | What | Size | Hosting | How | Tier |
| --- | --- | --- | --- | --- | --- |
| 1 | Court of Claims, Claims Court and Indian Territory cases | About 1,296 cases | Serve | Script from static.case.law using the CSV list; Unverified records | 2 |
| 2 | Library of Congress laws and missing constitution versions | 48 laws; 45 to 120 versions | Serve (nations' governing documents) | Script from loc.gov, 15 seconds apart; match versions into the constitution catalog | Nations' own law |
| 3 | Harvard Project Justice-topic reports | 14 court and dispute resolution items, 11 more on policing, corrections and child welfare | Private copy, link | The fetch tool one by one, or a hand download (pull list 1k) | Research for the model code |
| 4 | Spirling treaty classification and McKeown reservation acreage | 595 treaties; 344 areas | Serve (CC0) | Script from the Dataverse API | 1 |
| 5 | Rest of the Harvard Project repository, and *Databook* facts | 361 items | Link; private copy when cited; facts cited | Index as source records; ask hpaied@hks.harvard.edu before hosting anything | Research |
| 6 | Paid collections: HeinOnline Indian Tribal Codes 1981 and 1988, LLMC, Indian Claims Insight | Unknown | Private copy, link | Ask whether UNLV's Boyd library subscribes (pull list 4i) | Nations' own law; 2 |

Items 1, 2 and 4 are scriptable work the project can do itself, so they go to a build thread, not the pull list. Items 3 and 6 are on the pull list (sections 1k and 4i). No pirated copy of any work is proposed.

## 8. Method and limits

- Harvard Project pages were read with the fetch tool on Nov. 26, 2026, because the Kennedy School site returns 403 to scripts from our cloud machines; counts are tallies of the page text [3][11]. The Justice topic shows 25 distinct items against a facet count of 26.
- Library of Congress: all 5 pages of the collection's JSON API were read (426 items); "in our records" means the item number appears anywhere in `content/` or `research/`. The version estimate matches a nation's name (first 18 characters) in the title and a four-digit year against the adopted, approved or effective years in `research/constitutions/documents.csv`; it is rough.
- Caselaw Access Project: volume metadata for 264 volumes was read from static.case.law; counts are name matches only.
- Harvard LibraryCloud (the catalog API) returned 403, so Harvard's print holdings of tribal codes were not counted.

## Sources

1. Ash Center, Harvard Kennedy School, "Project on Indigenous Governance and Development," https://ash.harvard.edu/programs/project-on-indigenous-governance-and-development/ (read Nov. 26, 2026).
2. Project on Indigenous Governance and Development, "Honoring Nations," https://indigenousgov.hks.harvard.edu/honoring-nations.md (read Nov. 26, 2026).
3. Project on Indigenous Governance and Development, "Research Repository," https://indigenousgov.hks.harvard.edu/publications.md, and "Research," https://indigenousgov.hks.harvard.edu/research.md (read Nov. 26, 2026).
4. Harvard Law School Library, "Tribal Law" research guide, https://guides.library.harvard.edu/law/triballaw (last updated Aug. 26, 2026; read Nov. 26, 2026).
5. Harvard University Native American Program, "Indigenous Library Resources," https://hunap.harvard.edu/indigenous-library-resources (read Nov. 26, 2026).
6. Project on Indigenous Governance and Development, "Terms of Use," https://indigenousgov.hks.harvard.edu/terms-use.md (read Nov. 26, 2026).
7. Native Nations Institute, University of Arizona, Indigenous Governance Database, "About," https://nnigovernance.arizona.edu/about (read Nov. 26, 2026); our record `honoring-nations-2003-kake-circle-peacemaking` cites a Harvard Project PDF hosted there.
8. Caselaw Access Project terms as recorded in [Free legal information sources](2026-11-23-free-legal-information-sources.md) (checked Nov. 23, 2026).
9. Caselaw Access Project, `ReportersMetadata.json` and each reporter's `VolumesMetadata.json` and `CasesMetadata.json`, https://static.case.law/ (read Nov. 26, 2026).
10. Randall Akee, Andrea Moreno and Kenneth Besaw-Medford, *Social and Economic Changes in American Indian Reservations: A Databook of the US Census and the American Community Survey* (3d ed. 2025), https://ash.harvard.edu/wp-content/uploads/2025/09/Databook-Third-Edition-2025-09-07-1.pdf (listed at [3]).
11. Project on Indigenous Governance and Development, "Justice" topic page, https://indigenousgov.hks.harvard.edu/topic/justice (3 pages), and "Sitka ICWA Partnership," https://indigenousgov.hks.harvard.edu/publications/sitka-icwa-partnership-sitka-tribe-alaska (read Nov. 26, 2026).
12. Library of Congress, "Native American Constitutions and Legal Materials," https://www.loc.gov/collections/native-american-constitutions-and-legal-materials/ (JSON API, read Nov. 26, 2026).
13. Arthur Spirling, "Replication data for: US Treaty-making with American Indians," Harvard Dataverse (2012), https://doi.org/10.7910/DVN/L0ZG70 (CC0; read Nov. 26, 2026).
14. C. Timothy McKeown, "Area of Federal Indian Reservations: Trust and Non-Trust Lands, and Oklahoma Tribal Statistical Areas (OTSAs)," Harvard Dataverse (2026), https://doi.org/10.7910/DVN/N97XMS (CC0; read Nov. 26, 2026).
15. Harvard Dataverse search API, query "tribal court," https://dataverse.harvard.edu/api/search (14 results, Nov. 26, 2026); for example https://doi.org/10.3886/ICPSR38409.
