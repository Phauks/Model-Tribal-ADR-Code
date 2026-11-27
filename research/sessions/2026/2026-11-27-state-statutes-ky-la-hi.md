---
id: 2026-11-27-state-statutes-ky-la-hi
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote adapters for Kentucky, Louisiana and Hawaii in the shared state statutes pipeline (scripts/law/state_statutes/), ran it, read every strong hit a reader marked none and about 50 random verdicts per state, and settled the few it disagreed with in each state's settled.json. Smaller Claude models (Haiku) read every keyword hit and the recall samples blind to their pool, in batches of about 145, and gave each section a core, incidental or none verdict.
- kind: page-fetch
  name: Legislatures' code sites
  detail: 'Kentucky: the PDF of every section of the Kentucky Revised Statutes (apps.legislature.ky.gov/law/statutes), 40,502 files, listed on 753 chapter and subchapter pages. Louisiana: every section page of the Louisiana Revised Statutes and the Children''s Code (legis.la.gov/Legis/Law.aspx), 46,188 pages, listed on each title''s table of contents. Hawaii: every section page of the Hawaii Revised Statutes (data.capitol.hawaii.gov/hrscurrent), 19,836 pages, found by walking the folder listings of its 14 volumes.'
purpose: 'Trevor asked on Nov. 26, 2026 (Pacific time) to "start on tier 3 for states", and on Nov. 27, 2026 that the remaining states run in parallel threads. This session took Illinois, Alabama, Arkansas, Georgia, Hawaii, Kentucky, Louisiana, Mississippi and Tennessee; this note covers the three it could read from the cloud with no further choice from Trevor.'
queries:
- Which sections of the Kentucky, Louisiana and Hawaii codes are Indian law (or, in Hawaii, Native Hawaiian law), labeled core or incidental, by the Oklahoma pilot's method
- How well the keyword pass finds them in each state, measured on random samples of the other sections
sources_added: []
limits: 'Reader verdicts are Unverified until a person checks them (Trevor will review every state''s labels once all are in). Recall rests on samples of 300 non-hits near a strong hit and 300 other non-hits per state. Each record links to the official site and is not served (state statutes stay link only). Sections in force only.'
---

# State statutes sweep: Kentucky, Louisiana and Hawaii

The method is the one in the first sweep's notes (research/sessions/2026/2026-11-27-state-statutes-sweep.md) and in `scripts/law/state_statutes/README.md`. Each state's results are in `research/state-statutes/<state>/`, and the state notes the readers were given are in `research/state-statutes/reader-prompt.md`.

| State | Sections in force | Strong hits | Weak-only hits | Indian law sections | Core | Incidental | Recall-sample misses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kentucky | 25,073 | 26 | 234 | 28 | 5 | 23 | 0 of 600 |
| Louisiana | 38,905 | 82 | 571 | 97 | 23 | 74 | 0 of 600 |
| Hawaii | 18,464 | 106 | 438 | 309 | 132 | 177 | 2 of 600 |

## Kentucky

The Legislative Research Commission prints each section as its own PDF, listed on its chapter's page (some chapters list only subchapters, which the adapter follows). The chapter pages also list repealed sections, which is why 15,262 of the 40,345 sections are left out as repealed. The PDFs are read with `pdftotext -raw`, since the default layout pulls subsection numbers away from their text. A section's first enactment is the "Created" or "Enacted" session law at the end of its history line (the history runs newest first). Kentucky has no federally recognized nation, and its Indian law is light: the Native American Heritage Commission (KRS 171.820 and 171.822), Native American Indian Month, the archaeological sites act's definition of Indian graves, the child custody act's application to tribes, and the uniform acts that count a tribe as a "state". The readers marked one strong hit none (KRS 42.705, which names Native American sites only in its findings); the session agreed.

## Louisiana

The Revised Statutes and the Children's Code are both read, because the state's Indian Child Welfare Act articles are in the Children's Code. The Revised Statutes' front page names its titles' folders only inside its page state, so the adapter reads the folder numbers from there; each title's table of contents then lists every section. A chapter's headings print only on its first section's page, so the parser carries them forward through the title. Records for the Children's Code are cited "La. Child. Code Ann. art. <n>" and keyed `louisiana-childrens-code-art-<n>`. The site answered slowly (about three hours for the download). Many parish and city names are nations' names (Caddo, Natchitoches, Opelousas, Houma, Avoyelles, Coushatta); the readers were told so. The readers marked two strong hits none; the session settled both incidental, following the earlier states' rule that a racial category with legal effect is incidental: the voter registration form's American Indian choice (La. Stat. Ann. § 18:104) and the insurance examination reports by group (§ 22:1545). The one record held as it was is the hand-made La. Stat. Ann. § 46:2305 (the Native American Commission).

## Hawaii

capitol.hawaii.gov refuses cloud addresses, but its data host (data.capitol.hawaii.gov) serves the same files, so the adapter walks that host's folder listings. Only the Revised Statutes' chapter folders are read: the first volume's copies of the United States Constitution, the Organic Act, the Admission Act, the state constitution and the Hawaiian Homes Commission Act, 1920 (a federal act the project holds as its own record) are left out. A section file's name gives each digit after the decimal point its own group (`HRS_0010-0014_0005_0005.htm` is § 10-14.55). The host resets connections under load, so folder listings are cached and retried and downloads run four at a time.

Native Hawaiians are Native people, not a tribe. The readers were told to treat a section whose subject is Native Hawaiians (the Office of Hawaiian Affairs, Hawaiian home lands, traditional and customary rights, iwi kupuna, the Hawaiian language, Native Hawaiian recognition) as core and one that gives the Office of Hawaiian Affairs or Native Hawaiians a specific role as incidental, and never to call Native Hawaiians a tribe. The records say "Native Hawaiian or Indian law section" in their review check, not "Indian law section" (the adapter's `LAW_NAME`, which `records.py` now reads). `CHAPTER_LAW` in `core.py` now also matches "Hawaiian Affairs" and "Hawaiian Home(s)", so every section of chapter 10 (Office of Hawaiian Affairs) was read in pool E. The 18 Hawaii records about Indian tribes are the uniform acts and the protective order and sex offender registration laws; every other record is about Native Hawaiians. The weak-term list adds Native Hawaiian words (Office of Hawaiian Affairs, kuleana, iwi kupuna, ahupua`a and others) and takes out "Hawaiian" as a place or company name (Hawaiian Islands, Hawaiian waters, Hawaiian Electric). Weak hits were yes far more often than in other states (173 of 438), because "Hawaiian" and "traditional and customary" are strong signals here.

The two recall-sample misses were HRS § 6D-8 (a burial found in a cave goes to the iwi kupuna procedures) and § 190D-24 (konohiki fishing rights), 2 of the 309 found, under the 5% threshold. The readers marked five strong hits none; the session agreed with four (the "Aloha Spirit" statute, and native Hawaiian plants and animals in three land and forest sections) and settled § 201B-13 incidental (the tourism authority's advisory group must work on programs to preserve Native Hawaiian culture). Three hand-made records (§§ 10H-1, 10H-3 and 10H-8, the Native Hawaiian recognition act) are held as they are.

## The other six states

Illinois's site (ilga.gov) refuses cloud addresses, and Alabama's code site loads its text from a data service the session's safety check would not let it call without Trevor's approval; both wait on his choice. Arkansas, Georgia, Mississippi and Tennessee publish their codes only through LexisNexis's free sites; the choice of how to get them (park them, export from Westlaw, use Public.Resource.Org's older copies, or script the Lexis sites after reading their terms) is Trevor's.
