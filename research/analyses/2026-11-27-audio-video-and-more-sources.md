# Audio, video and other new sources for nations and federal Indian law

**Status:** research study, written Nov. 27, 2026, in answer to Trevor's question "any other information we could potentially get to richen nations or our understanding of federal indian law? Should we do research into audio and videos?" (project thread "Find new sources to enrich nations and federal Indian law", Nov. 27, 2026). Nothing here is built. It follows the [new data source categories](2026-11-27-new-data-source-categories.md) study of the same day, whose ranks 5 to 16 Trevor has not yet picked, and the [media survey](../media/2026-11-23-media-source-survey.md) of Nov. 23, 2026, which looked at media to illustrate pages rather than collections to hold. Neither is repeated here except where a new finding changes it.

**Method.** Each source's own page was fetched from the cloud with `curl` on Nov. 27, 2026 (status recorded below), and file sizes were read from the server's `content-length` header. Counts marked "counted" were read that day. Counts marked "project estimate" are the project's judgment and say so. Ranking weighs legal value to a central repository of Native legal information, whether a script can fetch the set, whether the hosting rules let the site serve it, and whether it raises CARE concerns (Collective benefit, Authority to control, Responsibility, Ethics).

## 1. Ranked summary

| Rank | Collection | What it adds | Reachable by script? | Hosting | Size and cost |
| --- | --- | --- | --- | --- | --- |
| 1 | Supreme Court oral argument audio for the Native cases | The argument in every Native case since 1955, beside the opinion | Court's MP3s yes (200, no key); National Archives copies need a free Catalog API key | Serve (government works) | 185 cases since the 1955 term (counted); about 10 to 15 GB (project estimate from two files of 44 and 92 MB); about $0.20 a month in R2; machine transcripts about $6 |
| 2 | Federal money to each nation (grants, contracts, loans) | A per-nation "Federal awards" fact with a breakdown by agency and program | Yes (USAspending API answered with no key) | Serve (government data) | One query per nation per year; small |
| 3 | Federal courts of appeals argument recordings for Indian law cases | The arguments behind the lower federal opinions we hold | Ninth Circuit (200) and Tenth Circuit (200) sites; Free Law Project's archive through CourtListener | Serve audio (government works); embed Ninth Circuit video from YouTube | Project estimate: a few hundred arguments, about 30 MB each as audio |
| 4 | Two small per-nation fact sets: the Land Buy-Back Program's results and the FCC's tribal spectrum licenses | Land consolidation and broadband rights as nation-page facts, each with its legal basis | Yes (Interior PDF 200; FCC 200) | Serve | One table of the locations where the Program worked (50 by Dec. 2018, Interior); 270 licenses as of Aug. 2021 (FCC) |
| 5 | National Archives films and sound recordings from the Bureau of Indian Affairs | Federal Indian policy as the government filmed and recorded it | Needs the free Catalog API key | Serve (public domain), with context and nation review for ceremonies | 14 general film reels, 10 general sound items, 500 Navajo school sound items (National Archives guide); more in other record groups |
| 6 | Congressional hearing video (declined by Trevor, Nov. 27, 2026) | The spoken hearing behind the 5,532 hearings and reports we already hold as text | Senate player and committee YouTube channels; not a simple file download | Link or embed only (size, and C-SPAN's copies are C-SPAN's) | Hosting would run to terabytes (project estimate) |
| 7 | Oral histories (Library of Congress, Smithsonian, boarding school survivors, university collections) | Native people's own accounts of law and policy | Library of Congress refuses scripts (403); Utah's Doris Duke portal refused (418) | Link only; most stay with the speaker or the community | Catalog entries only |
| 8 | Tribal council recordings | Nations' own legislative debate | Nation by nation (YouTube, Vimeo, Facebook) | By consent of each nation; link only until then | Not counted |

Ranks 1 to 4 can be built now and fit the hosting rules squarely. Rank 5 is good but needs care with what is shown. Ranks 6 to 8 are better as links than as holdings: 6 for size and rights, 7 and 8 because the people and nations who spoke should decide.

## 2. Recommendation

Build rank 1 first, together with rank 5 of the earlier study (the Court's argument transcripts since 2000 and the Solicitor General's briefs), so every Native Supreme Court case page gets its argument as sound and text. Build rank 2 next, because it adds a fact to every nation page at almost no cost. Ask Trevor for one free National Archives Catalog API key, because the same key opens rank 1's older recordings, rank 5 here, and the archival treaty scans (rank 10 of the earlier study). For ranks 6 to 8, list links only, and bring oral histories and council recordings to the [Indigenous advisory council](../../docs/indigenous-advisory-council.md) before collecting anything.

## 3. Each source

### 3.1 Supreme Court oral argument audio (rank 1)

The Court began recording arguments in the 1955 term, and the National Archives holds the recordings in Record Group 267 in three series: the Black Series (October 1955 to December 1972), the Red Series (December 1972 to June 27, 2005) and the Gold Series (October 3, 2005 to July 1, 2024) [1]. The National Archives announced on May 30, 2023 that these recordings "have been fully digitized and are available for listening and download through the National Archives Catalog" [2]. Since the 2010 term the Court has also posted every argument's MP3 on its own site at the end of the argument week [3]. Our list of Native cases holds 185 cases from the 1955 term on and 31 from the 2010 term on (counted from `research/supreme-court-coverage/native-cases-scdb.csv`; some of the 185 were decided without argument, so the true number of recordings is somewhat lower).

The Court's files download with no key: *McGirt v. Oklahoma* (18-9526) is 44,046,858 bytes and *Haaland v. Brackeen* (21-376) is 92,327,625 bytes (read Nov. 27, 2026). At that range the whole set is about 10 to 15 GB (project estimate), about $0.20 a month in R2 at $0.015 per GB-month [4]. The older recordings come from the National Archives Catalog, whose API needs a free key and allows 10,000 queries a month [5]. The Court printed transcripts only from the 1968 term [1] and posts its own from 2000, so for the older arguments a machine transcript would be needed: Workers AI's Whisper model costs $0.0005 an audio minute [6], about $6 for 185 hour-long arguments. Machine transcripts would be marked as such and never quoted as the record.

Oyez offers the same audio under a Creative Commons license [7] (the media survey recorded it as noncommercial), but we do not need its copies, since the National Archives holds the originals as federal records. Free Law Project's own Supreme Court recordings start in 2013 [8].

### 3.2 Federal money to each nation (rank 2)

USAspending.gov reports every federal award by recipient type, including "Indian/Native American Tribal Government." A query from the cloud for fiscal year 2025 answered with no key and ranked the Cherokee Nation first at $666,464,897, then the Alaska Native Tribal Health Consortium and the Choctaw Nation of Oklahoma (USAspending API, Nov. 27, 2026) [9]. Its searches start at Oct. 1, 2007, with older data by download [9]. This would give each nation page a "Federal awards" line with a breakdown by agency and program, in keeping with the rule that every number gets a breakdown. The work is matching each recipient (by its UEI number and name) to our 947 nations, and keeping tribal enterprises, consortia and health organizations apart from the governments. It complements the self-governance programs collection, which lists which programs a nation takes part in but not the money.

### 3.3 Courts of appeals argument recordings (rank 3)

The Ninth Circuit streams every argument live on YouTube and keeps an archive of past hearings on its site [10]. The Tenth Circuit has posted audio of every argument within 48 hours since its January 2018 term, but will not post earlier ones [11]. Together these two circuits hear most of the Indian law appeals from the West (project estimate). Free Law Project has kept federal appellate argument audio since 2014, uploads it to the Internet Archive, and makes machine transcripts, through CourtListener's API [8]; its site content is licensed CC BY-ND, but the recordings themselves are the courts' own. Our 12,392 lower federal court opinion records could be joined to these recordings by docket number; the number of matches has not been counted.

### 3.4 Land Buy-Back Program and tribal spectrum licenses (rank 4)

The Interior Department's Land Buy-Back Program for Tribal Nations bought fractional interests in allotted land from willing owners and transferred them to the nations. As of Dec. 31, 2018 it had acquired 800,310 interests, a 34 percent reduction at the 50 locations where it had worked [12], and its final cumulative table (Oct. 12, 2022) gives offers, owners, purchases and acres nation by nation [13]. In the 2.5 GHz Rural Tribal Priority Window the FCC had granted 270 spectrum licenses to tribal entities by Aug. 23, 2021 [14]. Each is a small, citable nation-page fact with a clear legal basis (the Cobell settlement for the first, the FCC's grant for the second).

### 3.5 National Archives films and sound recordings (rank 5)

Record Group 75, the Bureau of Indian Affairs, holds 14 general film reels from 1908 to 1977 (among them 13 reels of the Rodman Wanamaker expeditions of 1908-1920, filming "Indian customs, dances, and activities," and later films on the Alaska Native Claims Settlement Act and Hopi and Navajo relocation), 10 general sound items from 1969 to 1974 on Indian education and legislation, and 500 "Soundscriber records of the Navajo school program, 1950-54" at San Francisco [15]. Films made by the government are federal records and the National Archives treats them as public domain, with a few exceptions [16]. Two cautions apply. Films of dances and ceremonies should not be served until the nation filmed says it may be (the same rule as the stories collection). The Navajo school recordings may hold children's voices, so they fall under the project's rule that children's matters are held privately. Policy films such as those on relocation need a caption that names the policy and its effect.

### 3.6 Congressional hearing video (rank 6)

**Declined by Trevor on Nov. 27, 2026 ("no to hearing videos").** The site keeps the printed hearings only; no hearing video is collected, linked or embedded unless Trevor reopens it.

The Senate Committee on Indian Affairs shows its hearings through the Senate's own video player and its YouTube channel (hearing page fetched Nov. 27, 2026) [17]. C-SPAN allows "non-commercial copying, sharing and posting of C-SPAN video on the Internet, with attribution" for its coverage of congressional hearings, but that is C-SPAN's license, not a public domain grant [18]. Video of one two-hour hearing runs to one or two gigabytes (project estimate), so hosting a few thousand hearings would take terabytes. Since the site already holds the printed hearings, the recommendation is a "Watch" link or YouTube embed on each hearing record where the committee has one, and no copies.

### 3.7 Oral histories (rank 7)

The Library of Congress's Veterans History Project says "all VHP participants retain the copyright to their materials," and researchers need the veteran's or the family's permission to publish [19]. The American Folklife Center says rights in its recordings "generally belong to the performers" and may belong to "the traditional community of origin" (media survey) [20]. The National Native American Boarding School Healing Coalition's oral history project with the Interior Department recorded more than 360 survivors in 19 states; "survivors, however, will retain full ownership of their interviews, and they alone decide whether their stories are made public," the videos go to the Library of Congress, and the project runs to June 2027 [21]. Interior's Road to Healing tour transcripts are posted on doi.gov as federal records [22], but they are survivors' testimony about abuse, and CARE's Authority to control points to the survivors and their nations, not to copyright, as the test. The Library of Congress refused scripts (403) and the University of Utah's Doris Duke portal answered 418 on Nov. 27, 2026. The recommendation is a list of where these collections are, with links, and nothing copied until the Indigenous advisory council has weighed in.

### 3.8 Tribal council recordings (rank 8)

Some nations record and post their councils: the Navajo Nation Council links its own YouTube, Vimeo and Facebook channels from its "Live Now" page and keeps agendas and legislation by session [23]. These are a nation's own legislative record, but a recording of debate is not a governing document under the hosting rule, and nations choose differently whether to keep them public. The recommendation is a link on the nation page where the nation itself posts recordings, and copies only by a nation's request.

## 4. Sources

1. National Archives, "U.S. Supreme Court Oral Arguments," https://www.archives.gov/research/court-records/oral-arguments (read Nov. 27, 2026).
2. National Archives, The Unwritten Record, "Oyez! Oyez! Oyez! Sound Recordings of the Supreme Court of the United States Now Fully Digitized" (May 30, 2023), https://unwritten-record.blogs.archives.gov/2023/05/30/oyez-oyez-oyez-sound-recordings-of-the-supreme-court-of-the-united-states-now-fully-digitized (read Nov. 27, 2026).
3. Supreme Court of the United States, press release (Sept. 28, 2010), https://www.supremecourt.gov/publicinfo/press/pressreleases/pr_09-28-10 (read Nov. 27, 2026).
4. Cloudflare, "R2 pricing," https://developers.cloudflare.com/r2/pricing/ (cited in the earlier study, read Nov. 27, 2026).
5. National Archives, "API for the National Archives Catalog," https://www.archives.gov/research/catalog/help/api (read Nov. 27, 2026).
6. Cloudflare, "Workers AI pricing," https://developers.cloudflare.com/workers-ai/platform/pricing/ (read Nov. 27, 2026).
7. Creative Commons wiki, "Oyez," https://wiki.creativecommons.org/wiki/Oyez (read Nov. 27, 2026).
8. Free Law Project, "Oral Argument Recording Archive," https://free.law/projects/oral-arguments/ (read Nov. 27, 2026).
9. USAspending.gov API, `POST /api/v2/search/spending_by_category/recipient/`, https://api.usaspending.gov/ (queried Nov. 27, 2026).
10. United States Court of Appeals for the Ninth Circuit, "Live Streams and Videos," https://www.ca9.uscourts.gov/media/live-oral-arguments (read Nov. 27, 2026).
11. United States Court of Appeals for the Tenth Circuit, "Oral Argument Recording Archive," https://www.ca10.uscourts.gov/node/3680 (read Nov. 27, 2026).
12. Department of the Interior, Land Buy-Back Program for Tribal Nations, "Program Impact," https://doi.gov/buybackprogram/program-impact (read Nov. 27, 2026).
13. Department of the Interior, *Land Buy-Back Program for Tribal Nations Cumulative Sales* (Oct. 12, 2022), https://www.doi.gov/sites/doi.gov/files/land-buy-back-program-for-tribal-nations-cumulative-sales-through-october-12-2022.pdf (read Nov. 27, 2026).
14. Federal Communications Commission, "FCC Grants Additional 2.5 GHz Spectrum Licenses for Wireless Services in Alaska Native Communities" (Aug. 23, 2021), https://docs.fcc.gov/public/attachments/DOC-375125A1.txt (read Nov. 27, 2026).
15. National Archives, *Guide to Federal Records*, Record Group 75, sections 75.20.4, 75.27 and 75.28, https://www.archives.gov/research/guide-fed-records/groups/075.html (read Nov. 27, 2026).
16. National Archives, "Motion Pictures: Permissions," https://www.archives.gov/research/motion-pictures/permissions (quoted in the media survey, Nov. 23, 2026).
17. Senate Committee on Indian Affairs, hearing page "Examining Public Safety and Justice Resources in Native Communities," https://www.indian.senate.gov/hearings/oversight-hearing-titled-examining-public-safety-and-justice-resources-in-native-communities (read Nov. 27, 2026).
18. John Eggerton, "C-SPAN Loosens Copyright for Some Content Online," *Broadcasting & Cable* (Mar. 7, 2007), https://www.nexttv.com/news/c-span-loosens-copyright-some-content-online-27884 (read Nov. 27, 2026).
19. Library of Congress, Veterans History Project, "Can Veterans History Project (VHP) collection materials be used in publications or in exhibitions outside the Library of Congress?," https://ask.loc.gov/veterans-history/faq/369365 (read Nov. 27, 2026).
20. Library of Congress, American Folklife Center FAQ, https://ask.loc.gov/american-folklife/faq/304212 (quoted in the [media survey](../media/2026-11-23-media-source-survey.md), section 3.1).
21. "Native American boarding school oral history project ends," KUER (June 23, 2026), https://www.kuer.org/race-religion-social-justice/2026-06-23/native-american-boarding-school-oral-history-project-ends (read Nov. 27, 2026).
22. Department of the Interior, Road to Healing transcript, Rosebud Sioux Tribe, https://doi.gov/sites/default/files/rth-sd-rosebud-sioux-transcript.pdf (search result, Nov. 27, 2026).
23. Navajo Nation Council, "Live Now," https://www.navajonationcouncil.org/live-now/, and "Meetings Archive," https://www.navajonationcouncil.org/meetings-2024/meetings-archive/ (read Nov. 27, 2026).
