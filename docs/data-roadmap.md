# Data roadmap

The site is becoming a central repository of Native legal information (Trevor, Nov. 23, 2026). This page lists every collection the project has, is building or means to build, in one place, so any thread can see what exists, what is next and the rule for hosting it. It is a living list: add a row when a new collection is proposed and change its status as work lands. The model code's own drafting plan stays in [roadmap.md](roadmap.md).

## How to use this page

Each row is one collection. **Status** is one of: *Done* (records exist for the whole collection), *Partial* (records exist for part of it), *Building* (a thread or open pull request is adding it), *Spiked* (counted and planned, nothing built), *Planned* (wanted, not yet counted) or *Not feasible in full* (only a partial set can be built; the row says why). **Where** names the thread, pull request or note that holds the work. **Source** is where the material comes from. **Hosting** follows the rules below. **Size** is a rough count of items, from the note named in Where when there is one; otherwise it is the project's estimate and says so.

To add a collection: add a row to the right tier, with its status, source, hosting rule and rough size, in the same pull request that starts the work if there is one. When a collection's records land, update its row, add it to the statistics page's collection registry once that exists (thread "Add a stats page counting our materials"), and, for a set built from a list file such as [`research/data-roadmap/small-sets.yaml`](../research/data-roadmap/small-sets.yaml), add the documents there rather than writing records by hand. A spike that ends without a build also gets a row in [roadmap.md, Parked research](roadmap.md#parked-research). A collection that lands also gets a watcher, or a reason it is not watched, in [source-watch.md](source-watch.md) (decision record 0059, proposed), so new and changed items in it are found.

Every record a script writes starts as Unverified and says so in its notes, until a person checks it against the document.

## Hosting rules

- **Serve**: works of the United States government (17 U.S.C. § 105), works whose copyright has expired, and Native nations' own governing documents (constitutions, codes, compacts the nation is party to), which a nation can ask us to take down. The bucket keeps a copy and the site serves it.
- **Private copy, link**: copyrighted works and works whose rights are not settled (UN and Organization of American States documents, journal articles, books, nations' court opinions outside the published reporters). The bucket keeps a private copy of anything we cite directly; the site links to the publisher.
- **Link only**: state statutes, regulations and cases. The site links to the state's own site and does not host the text; a private copy is kept only when a page quotes it.
- **By consent**: material a nation controls and has not published, such as Tribal court opinions after 2017 or stories. Built only with the nation's permission and its privacy rules (see the Tribal court opinions rows).

## Tier 1: the federal core

| Collection | Status | Where | Source | Hosting | Size |
| --- | --- | --- | --- | --- | --- |
| Supreme Court cases involving Native people | Building (54 of about 533 covered) | Thread "Cover every Supreme Court Native case"; [coverage note](../research/analyses/2026-11-24-supreme-court-native-cases-coverage.md) (PR #449) | Supreme Court Database, U.S. Reports, CourtListener | Serve (U.S. Reports scans) | About 533 cases |
| Justices and Presidents | Done | `content/supreme-court/` (thread "Add pages for justices and presidents") | Federal Judicial Center, Library of Congress | Serve (government works); portraits by license | 116 Justices and the 41 Presidents who appointed them |
| Treaties, unratified treaties and agreements | Done (Unverified) | PR #460 (records, merged Nov. 24, 2026); thread "Verify treaty records against their texts" (PR #470) | Oklahoma State University Tribal Treaties Database; Statutes at Large on GovInfo | Serve | 370 ratified, 169 unratified or related, 149 agreements |
| Title 25 of the United States Code | Building | PR #469 | GovInfo (2024 edition) | Serve | 57 chapters (about 1,180 sections) |
| Acts of Congress that Title 25 cites (session laws) | Partial (about 85 Acts) | [Federal laws coverage note](../research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md) | Statutes at Large on GovInfo; Congress.gov (needs a free api.data.gov key) | Serve | About 1,000 Acts |
| Title 25 of the Code of Federal Regulations | Building | PR #469 | eCFR; GovInfo annual edition | Serve | 154 parts (4,701 sections) |
| Executive orders on Indian affairs | Building | PR #467 | OSU database; Federal Register | Serve | 566 (562 reservation orders and modern ones) |
| Federal Register lists of recognized nations | Building | PR #465 | Federal Register API; GovInfo | Serve | 41 lists since 1979 |
| Native nations (one page each) | Done, kept current | `content/tribes/` | Federal Register list, nations' own sites, state lists | Serve (nations' governing documents) | 947 profiles |
| Nations' constitutions and their versions | Partial | [Constitutions catalog](../research/constitutions/README.md) (PR #55) | Nations' sites, NILL, Wayback captures | Serve (nations' governing documents) | 861 constitution records; 189 nations with no text found |
| Tribal-state gaming compacts | Partial | `research/gaming/`; compact records | Interior's compact list and Federal Register approvals | Serve (nations' governing documents) | About 1,100 compact records |
| Major federal reports on Indian affairs | Partial (first 16) | This page's first sets (session [2026-11-24-data-roadmap-first-sets](../research/sessions/2026/2026-11-24-data-roadmap-first-sets.md)); list in `research/data-roadmap/small-sets.yaml` | ERIC, Internet Archive, GovInfo, agencies | Serve (the Meriam Report as public domain) | 16 done; the project estimates 30 to 50 of similar weight (for example the 1949 Hoover Commission and the 1952 House termination report) |
| People: Native leaders, litigants and biographies | Building | Threads "Add profiles for Native leaders and litigants" and biographies (PR #458) | Case records, public biographies | Serve text we write; pictures by license | Open-ended |

## Tier 2: lower federal sources and the record of the relationship

| Collection | Status | Where | Source | Hosting | Size |
| --- | --- | --- | --- | --- | --- |
| Lower federal court cases (circuits, district courts, Court of Claims, Federal Circuit) | Partial (about 100 federal case records) | Planned after tier 1 | CourtListener, Caselaw Access Project, GovInfo USCOURTS | Serve (opinions are government edicts) | Project estimate: several thousand Indian law cases |
| Indian Claims Commission dockets and decisions | Spiked | [Federal laws coverage note](../research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md), section 5 | Oklahoma State University ICC decisions collection; National Archives | Serve | 370 petitions, 617 dockets |
| Solicitor's opinions (M-Opinions) | Spiked | Same note, section 5 | Interior's 1917-1974 volumes; Solicitor's site since 1993 | Serve | About 509 (1917-1974) and 120 since 1993 |
| Interior Board of Indian Appeals decisions | Planned | | Interior Office of Hearings and Appeals | Serve | Project estimate: several thousand since 1970 |
| National Indian Gaming Commission decisions and approved gaming ordinances | Planned | | NIGC reading room | Serve (ordinances are nations' governing documents) | Project estimate: about 500 nations' ordinances plus amendments |
| Federal acknowledgment decisions (25 C.F.R. part 83) | Planned | Recognition basis session ([record](../research/sessions/2026/2026-11-23-recognition-basis.md)) | Office of Federal Acknowledgment; Federal Register | Serve | Project estimate: about 60 final determinations |
| Fee-to-trust and reservation proclamation notices | Planned | | Federal Register | Serve | Project estimate: thousands of notices |
| Congressional hearings on Indian affairs | Planned | | GovInfo hearings collection (about 1985 on); older ones in libraries | Serve | Project estimate: thousands; build an index first |
| Annual Reports of the Commissioner of Indian Affairs (1824-1932 and later) | Planned | | University of Wisconsin Digital Collections; HathiTrust | Serve | Project estimate: about 110 volumes |
| Kappler, Indian Affairs: Laws and Treaties | Planned | | Oklahoma State University digital Kappler | Serve | 7 volumes |
| Land: Royce's land cessions | Done (report and maps) | First sets session | Internet Archive (Smithsonian Libraries scan) | Serve | 1 report, 67 maps; splitting the maps and drawing the cessions is a later step |
| Land: Census tribal boundary files | Done (2000, 2010, 2020, 2025) | First sets session | Census Bureau TIGER/Line | Serve | 9 files |
| Land: reservation boundary rulings | Planned | | Supreme Court and lower court records | Serve | Project estimate: about 50 rulings |
| Census counts of American Indian and Alaska Native people | Planned | | Census Bureau API (needs a free key) | Serve | One table per area and state per census |
| Indian Health Service and Bureau of Indian Affairs budgets | Planned | | Congressional budget justifications | Serve | One per agency per year |
| Agreements beyond gaming: taxes, child welfare, cross-deputization, recognition of judgments | Planned | | Nations' and states' sites, state commissions | Serve where a nation is party; otherwise link only | Project estimate: hundreds |
| Federal law reviews and studies other than reports | Planned | | GAO, CRS, Inspector General reports | Serve | Project estimate: hundreds |

## Tier 3: states

| Collection | Status | Where | Source | Hosting | Size |
| --- | --- | --- | --- | --- | --- |
| State statutes on Native nations and Indian affairs | Partial (45 records) | Possibly a separate site later (Trevor, Nov. 24, 2026) | States' official code sites | Link only | Project estimate: thousands of sections across 50 states |
| State cases on Indian law | Partial (9 records) | Same | State courts, CourtListener | Link only | Project estimate: thousands |
| State recognition and state commissions on Indian affairs | Partial (on nation profiles) | `content/tribes/` | State lists and statutes | Link only | Counted on the nation profiles |

## Native nations' own law and accounts

| Collection | Status | Where | Source | Hosting | Size |
| --- | --- | --- | --- | --- | --- |
| Nations' codes and court rules | Partial | [Tribal law files](../research/tribal-law/README.md) | Nations' sites, NILL, Municode and eCode360 | Serve (nations' governing documents) | 169 code and 21 court rule records |
| Tribal court opinions to 2017 (Caselaw Access Project) | Done, with privacy holds | [Opinions README](../research/tribal-court-opinions/README.md); decision record 0047; PR #472 holds child and protection order cases | Caselaw Access Project | Serve, with initials or holds for children and protected persons | 2,368 opinions |
| Tribal court opinions after 2017 and from courts not in the reporters | Not feasible in full | [Republishing note](../research/analyses/2026-11-24-republishing-tribal-court-opinions.md) | Nations that publish (for example Navajo, Ho-Chunk, Mashantucket), NILL's Tribal Courts Bulletin for citations, each nation's consent | By consent | A full set is not possible: many courts do not publish, privacy laws limit sharing and each nation decides; a partial set grows with consent |
| Directory of Tribal courts and judges | Partial (courts on profiles) | [Individual courts review](../research/reviews/2026-11-22-individual-courts.md) | Nations' sites, NAICJA, the 2021 court directory | Serve the facts; link sources | Courts on 137 profiles found so far; judges not collected |
| Stories and accounts of making peace and of law | Partial | [Stories catalog](../research/analyses/2026-11-21-peacemaking-stories.md); thread "Link human accounts to the laws behind them" | Published collections, nations' cultural offices | Private copy, link; full text only by permission | Open-ended |
| Dispute resolution methods | Partial (33 proposed) | `content/methods/` | Profiles and provisions | Serve the facts | Grows with the evidence |

## International

| Collection | Status | Where | Source | Hosting | Size |
| --- | --- | --- | --- | --- | --- |
| UN Declaration on the Rights of Indigenous Peoples and the U.S. statement of support | Done | First sets session | UN Official Document System; State Department | Private copy, link | 2 records |
| UN treaty bodies and Special Rapporteurs on the United States | Partial (5) | First sets session | UN Official Document System | Private copy, link | Project estimate: about 20 (other concluding observations, universal periodic reviews) |
| Inter-American Commission on Human Rights: U.S. petitions and thematic reports | Partial (5) | First sets session | Commission's site (turns away scripts); University of Minnesota Human Rights Library | Private copy, link | Project estimate: about 15 |
| American Declaration on the Rights of Indigenous Peoples | Done (record, no copy) | Existing record | Organization of American States | Private copy, link | 1 |
| Canada and Mexico comparisons | Parked | [roadmap.md, Parked research](roadmap.md#parked-research) | | Private copy, link | Two notes |

## Already counted elsewhere

The National Indian Law Library's holdings ([coverage note](../research/analyses/2026-11-24-national-indian-law-library-coverage.md)), legal help providers ([records](../research/legal-help/README.md)), Indian law journals ([session](../research/sessions/2026/2026-11-23-indian-law-journals.md)) and media ([survey](../research/media/README.md)) each have their own notes; add rows here when one becomes a collection the site shows.
