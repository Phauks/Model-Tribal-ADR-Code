---
id: 2026-11-21-outreach-list
date: 2026-11-21
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Planned the record format; three sub-agents researched UNLV and Nevada bodies, national Native organizations and art partners, and law schools and dispute resolution bodies; the assistant checked their results, re-read weakly sourced pages, and wrote the records.
  - kind: web-search
    name: Web search tool
  - kind: page-fetch
    name: Web page fetch tool and curl
    detail: Pages were read directly; where only a search result was seen, the source is marked search-result-only.
  - kind: other
    name: Tribe profile dataset (pull request 2)
    detail: Nevada nation records were drafted from the profiles' Bureau of Indian Affairs, Census, National Indian Law Library and Tribal Law and Policy Institute citations; tribal court links were loaded again on 2026-11-21 and only working links kept.
purpose: Consolidate the outreach list from section 9 of the planning analysis into cited records of organizations the project may ask for help (co-authoring, review, consultation, art), covering UNLV and Boyd School of Law, national Native organizations, Nevada nations and regional bodies, law schools with Indian law programs, dispute resolution bodies, and possible art contest partners.
queries:
  - Saltman Center for Conflict Resolution faculty and Mediation Clinic
  - Wiener-Rogers Law Library federal Indian law and tribal law research guide
  - Boyd Indian Nations Gaming and Governance Program; gaming law LL.M.; UNLV International Gaming Institute
  - Inter-Tribal Council of Nevada; Nevada Department of Native American Affairs (formerly Nevada Indian Commission)
  - Inter-Tribal Court of Appeals Nevada; Court of Indian Offenses Western Region
  - National Tribal Judicial Center National Judicial College
  - State Bar of Nevada Tribal Law Section; Alternative Dispute Resolution Section
  - Nevada Legal Services Indian Law Project; Stewart Indian School Cultural Center and Museum
  - NARF Indigenous Peacemaking Initiative; National Indian Law Library; NCAI; NAICJA; TLPI; Indian Gaming Association
  - Native Governance Center; Native Nations Institute; Project on Indigenous Governance and Development
  - Local Contexts; Global Indigenous Data Alliance; United States Indigenous Data Sovereignty Network
  - Alaska Native Justice Center; Alaska Tribal Court Conference; Native Hawaiian Legal Corporation; Office of Hawaiian Affairs
  - Institute of American Indian Arts; First Peoples Fund; Native Arts and Cultures Foundation; SWAIA; Heard Museum; Sealaska Heritage Institute art contest
  - Indian law programs and clinics at Arizona, Arizona State, New Mexico, Oklahoma, Tulsa, Michigan State, UCLA, Colorado, Washington, Montana, North Dakota, Hawaiʻi, Lewis & Clark
  - ABA Section of Dispute Resolution; ABA Native American Concerns Committee; ABA Tribal Courts Council; Federal Bar Association Indian Law Section
  - Udall Foundation National Center for Environmental Conflict Resolution; Straus Institute; AAA-ICDR Foundation; JAMS Foundation; Uniform Mediation Act
sources_added: []
limits: >-
  Outreach records cite web pages inline rather than as source records, and no
  Wayback captures were made. Several pages blocked automated reading
  (Institute of American Indian Arts, Native Arts and Cultures Foundation,
  Smithsonian, some Office of Hawaiian Affairs pages); those sources are marked
  search-result-only. The Inter-Tribal Court of Appeals of Nevada has no website
  and its current operation rests on two 2024 bar magazine articles. The Las
  Vegas Indian Center's website did not respond. The National American Indian
  Court Judges Association's site showed injected spam text. No committee on
  tribal dispute resolution was found in the ABA Section of Dispute Resolution,
  but its committee list did not fully load. Named people, asks and priority
  were researched but are kept in the private plan, not here.
---

Result: 102 records in `research/outreach/`: 20 Nevada-area Native nations
(each pointing to its Tribe profile), 23 UNLV, Boyd and Nevada bodies, 31
national Native, data governance and art organizations, and 28 law school
programs and dispute resolution bodies. Named people, suggested asks, priority
and contact status are in the private plan
([decision record 0012](../../../docs/decisions/0012-outreach-list-split-public-and-private.md)).

Changes found while checking the original list:

- The Nevada Indian Commission became the Nevada Department of Native American
  Affairs on July 1, 2024.
- The State Bar of Nevada's section is the Tribal Law Section, not an Indian
  Law Section.
- The Native American Journalists Association is now the Indigenous
  Journalists Association.
- The Harvard Project on American Indian Economic Development is now the
  Project on Indigenous Governance and Development.
- The Udall Foundation's center is now the John S. McCain III National Center
  for Environmental Conflict Resolution.
- The University of New Mexico's Indian law program is now the Law and
  Indigenous Peoples Program; the University of Oklahoma's center is the
  Center for the Study of American Indian Law and Policy.
- The Alaska Native Justice Center's victim services moved to Cook Inlet
  Tribal Council on October 11, 2025.

Not found: an Indian law clinic at Boyd, a Native student services office at
UNLV, a Nevada tribal-state court forum, a Nevada tribal judges association,
and an Alaska tribal judges association with its own website.

Data issues noticed in the Tribe profile dataset (pull request 2), for that
work: several tribal court links no longer load (Las Vegas Paiute, Fallon
Paiute-Shoshone, Reno-Sparks, Duck Valley, Goshute), and the Pyramid Lake
profile cites a law-code source keyed to another nation
(`national-indian-law-library-code-codes-snoqualmie`).
