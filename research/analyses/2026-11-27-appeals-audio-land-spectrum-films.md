# Spikes: appeals court argument audio, Land Buy-Back and spectrum license facts, and Indian Affairs films

Nov. 27, 2026. Trevor asked for spikes into ranks 3, 4 and 5 of the [audio, video and other new sources note](2026-11-27-audio-video-and-more-sources.md) (PR #698). These are feasibility studies only: nothing was downloaded into the bucket and no records were written. Trevor said "no to hearing videos" the same morning, so this note plans audio, not video, for the courts of appeals. All counts below are the project's own, from the scripts and files named in each section, unless a source is cited.

## 1. Summary and recommendation

| Spike | What exists | Matches to our records | Rights | Size | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 3. Courts of appeals argument audio | Ninth Circuit: an MP3 of argued cases on the court's own server back to 2003, found through the court's public media search [1]. Tenth Circuit: an MP3 of every argument since January 2018 [2], 2,719 recordings listed on Nov. 27, 2026 | Ninth Circuit: 392 of our 768 Ninth Circuit records from 2003 on have a recording with the same caption (335 arguments; 139 with a one-word caption match to check by docket number). Tenth Circuit: 100 of our 138 Tenth Circuit records from 2018 on have a recording with the same caption argued before the decision (97 arguments; 14 with a common surname to check by docket number) | Court recordings are works of the United States government [3] | Tenth Circuit MP3s average 11.7 MB (15 measured); Ninth Circuit about 30 to 45 MB (2 measured). About 13 GB in all (project estimate) | Build, audio only, after #595 lands. Serve our own copies, joined by docket number |
| 4a. Land Buy-Back Program results | Interior's final report (December 2023) with results for each of the 53 locations where land was bought, and appendices of fractionation for about 150 locations [4]; the last cumulative sales table (Oct. 12, 2022) [5] | 46 of the 48 location names in the 2022 table match the right nation with the shared name matcher; the Wind River row (two nations) and Bois Forte need a hand map | Government works | Two PDFs, 14.6 MB | Build as Key facts rows on about 55 nation pages (53 locations, some shared by two nations) |
| 4b. FCC tribal 2.5 GHz licenses | The FCC's bulk license file for the band (l_mdsitfs.zip, Nov. 22, 2026) [6]: 358 active licenses granted since 2020 to 310 tribal entities | 238 of the 310 licensees match one nation (277 licenses, 235 nations); 72 need a hand map (village councils, tribal utilities such as Hopi Telecommunications, Inc., consortia) | Government data | 15.5 MB file | Build as a Key facts row with the call sign and grant date, linked to the FCC's license page |
| 5. Indian Affairs films and sound (Record Group 75) | 14 general film reels (1908-1977) plus about 56 more reels listed under the same heading, 10 sound items (1969-1974), 500 Navajo school sound recordings (1950-1954) [7] | Item-level search needs the National Archives Catalog key | Government films are public domain; the Wanamaker films were privately made, but before 1931 | Unknown until the catalog is read | Link and describe the policy films and sound items; hold the ceremony films for nation consent; keep the Navajo school recordings private |

Recommended order: 4 first (two small fact sets, no new storage), then 3 for the Tenth Circuit (exact docket matches, small files), then the Ninth Circuit, then 5 once the National Archives Catalog key is in hand.

## 2. Courts of appeals argument recordings (rank 3)

### 2.1 What the courts publish

The Tenth Circuit has posted the audio of every argument within 48 hours since its January 2018 term and will not post earlier ones, apart from a few high-interest cases [2]. Its search page lists each recording with the docket number, caption, date argued, courtroom and an MP3 at `https://www.ca10.uscourts.gov/sites/ca10/files/oralarguments/<docket>.mp3`. A script read all 136 pages of the list on Nov. 27, 2026 and found 2,719 recordings, from April 2014 to Nov. 19, 2026.

The Ninth Circuit streams every argument on YouTube and keeps an archive [1]. The archive page reads its list from a public search service that the page itself calls; each hearing's entry gives the caption, docket number, panel, place, date, the YouTube link and, separately, an MP3 on the court's own server (`https://cdn.ca9.uscourts.gov/datastore/media/<yyyy>/<mm>/<dd>/<docket>.mp3`). The oldest Indian law argument found was *Coeur d'Alene Tribe v. Hammond*, argued Dec. 2, 2003. Because the audio comes from the court and not from YouTube, we never need to download from YouTube, and Trevor's "no to hearing videos" is kept.

Free Law Project also keeps appellate argument audio through CourtListener [8], but its API needs an account token from the cloud (HTTP 401 on Nov. 27, 2026), and the courts' own files are the original publisher's copies, which the project's rule puts first.

### 2.2 How many touch our cases

PR #595 holds 12,392 lower federal court records; 1,871 are Ninth Circuit and 1,184 Tenth Circuit decisions. Only cases decided after the recording archives begin can have audio: 739 Ninth Circuit records from 2003 on (plus 29 whose court reads only "Ninth") and 138 Tenth Circuit records from 2018 on.

Tenth Circuit: a script compared each record's caption with every listed argument heard up to 900 days before the decision. 100 of the 138 records have a recording whose caption words match and whose "United States v." side matches (97 different arguments, since three records are parallel reports of one case). 14 of the 100 are criminal cases against a defendant with a common surname (Smith, Clark, Martinez and others), which the build must confirm by docket number. Most of the other 38 records were likely decided on the briefs without argument (project inference; the court decides many appeals without argument).

Ninth Circuit: a script searched the court's archive by the most distinctive word of each record's caption and kept hearings argued up to four years before the decision. 392 of the 768 records have a recording whose caption words match on both sides (335 different arguments, since parallel reports and decisions after rehearing share one argument); 181 of them also have a YouTube video, which we would not use. 139 of the 392 match on only one distinctive word (for example "United States v. Begay"), so the build must confirm them by docket number. Another 157 records match in part and need a reading. A random sample of 12 strong matches were all the right case (for example *Yurok Tribe v. Resighini Rancheria*, No. 18-15309, argued Oct. 3, 2019, decided Dec. 12, 2019).

Our records carry no docket numbers today. The Caselaw Access Project's case files have a `docket_number` field and GovInfo's court opinion packages name the docket in each granule, so the build should add `docket` to each case record first and join on it, using the caption match only as a check.

### 2.3 Privacy

The project holds children's cases privately. An argument recording follows the hold of its opinion: no recording is served for a held record. Criminal appeals under the Major Crimes Act often concern sexual abuse of a child even when the caption names only the adult defendant, so the build should run the same sensitivity reading on the recording's transcript before release, and a recording of an argument in a shown case that names a child victim in open court stays private until read.

### 2.4 Size and cost

Fifteen Tenth Circuit MP3s averaged 11.7 MB, so about 100 recordings are about 1.2 GB. Two Ninth Circuit files measured 32.5 MB (2004) and 44.6 MB (2024). At about 35 MB each, 335 Ninth Circuit arguments are about 12 GB, so both courts together are about 13 GB (project estimate). At Cloudflare R2's storage price of $0.015 per GB-month [9], all of it costs a few cents a month. Machine transcripts would let search reach the arguments; the earlier note priced Whisper transcripts on Workers AI [10].

### 2.5 What a case page would show

A "Listen" row on the case page: the date argued, the panel, the length, our copy of the MP3 with its SHA-256 and the court's own link listed first under "Where to read it", and a transcript marked as a machine transcript once one exists.

## 3. Land Buy-Back Program and tribal spectrum licenses (rank 4)

### 3.1 Land Buy-Back Program for Tribal Nations

The Program carried out the land consolidation part of the *Cobell* settlement, funded by the Claims Resolution Act of 2010 (Pub. L. No. 111-291, 124 Stat. 3064). Its money ended in November 2022, and Interior announced its conclusion on Dec. 4, 2023: nearly 3 million acres in 15 states restored to tribal trust ownership and $1.69 billion paid to more than 123,000 people [11]. The final report, *Ten Years of Restoring Land and Building Trust 2012-2022* (December 2023, 103 pages), gives the dollar amount, interests and equivalent acres for each of the 53 locations where land was consolidated, and Appendices C and D give fractionation statistics for each nation with fractionated land [4]. The October 2022 cumulative sales table adds offers made, landowners, acceptance rates and tracts for each round of work at each location [5]; it hides the figures for six small locations (shown as ♦) to protect the few landowners there.

Data shape: one row for each location, keyed by the location name in the final report (for example "Blackfeet" or "Pine Ridge") and by the nation's full name in the 2022 table. The shared name matcher (`scripts/law/nation_names.py`) linked 46 of the 48 location names in the 2022 table to the right nation. The two that need a hand map are the Wind River row, which covers both the Eastern Shoshone Tribe and the Northern Arapaho Tribe (the table spells it "Arapahoe", so the matcher found only the Eastern Shoshone), and "Minnesota Chippewa - Bois Forte Band", which it did not link at all. The final report's short location names ("Pine Ridge", "Lake Traverse") need the same small hand map to the 2022 table's full names.

A nation-page line, under Key facts, Land: "Land Buy-Back Program (2012-2022): 196,519 fractional interests bought, 490,808 equivalent acres returned to the Blackfeet Tribe's trust ownership, $246.3 million paid to landowners", with the breakdown line Trevor asked for on every number (offers made, owners who sold, rounds of work) and the legal basis (the *Cobell* settlement and the Claims Resolution Act). The Blackfeet figures are from the final report's table [4].

### 3.2 FCC tribal 2.5 GHz licenses

In 2019 the FCC opened a Rural Tribal Priority Window for unassigned 2.5 GHz spectrum over rural tribal lands [12]; it had granted 270 licenses by Aug. 23, 2021 [13], and grants and waiver orders continued into 2024 [14]. The FCC's web pages for the window refuse scripts from the cloud (HTTP 403), but its bulk license file for the band, `l_mdsitfs.zip` from `data.fcc.gov/download/pub/uls/complete/`, downloads (15.5 MB, dated Nov. 22, 2026) [6].

In that file the window's licenses are Educational Broadband Service (`ED`) licenses granted from 2020 on to a tribal licensee. A first pass found 358 active licenses held by 310 tribal entities, after setting aside schools, a Spanish-language network and commercial carriers whose names matched words such as "Indian" or "Community". Each license has a call sign (for example WRJ-series licenses granted in 2020), a status, a grant date, an expiration date and the licensee's name; the license's own FCC page is `https://wireless2.fcc.gov/UlsApp/UlsSearch/license.jsp?licKey=<unique system identifier>`.

The shared name matcher linked 238 of the 310 licensees to one nation (277 licenses, 235 nations). The 72 it could not link are mostly Alaska village councils ("Hughes Village Council", "Nanwalek IRA Council"), shortened names ("Makah Tribe", "Red Lake Nation") and tribally owned utilities and companies ("Hopi Telecommunications, Inc.", "Tohono O'odham Utility Authority", "Yakama Power"). They need a hand map, and a utility's license should be shown on its nation's page as held by that utility. The Department of Hawaiian Home Lands also holds window licenses; Native Hawaiians are not a tribe, so those belong on a Native Hawaiian page, not a nation page. The exact list of window grants should come from the FCC's grant public notices, which list the file numbers, rather than from the name filter alone.

A nation-page line, under Key facts: "2.5 GHz spectrum license: call sign, granted date (FCC, Rural Tribal Priority Window)", linked to the FCC's license page, with the legal basis being the FCC's 2019 order [12].

## 4. Indian Affairs films and sound at the National Archives (rank 5)

### 4.1 What exists

The *Guide to Federal Records* for Record Group 75 lists [7]:

- Motion pictures (general), 1908-1977, 14 reels: the Rodman Wanamaker expeditions, "documenting Indian customs, dances, and activities," 1908-1920 (13 reels), and *A Trip to the Arctic With Uncle Sam* (1921, 1 reel). The same section lists further groups: 45 reels from 1908 to 1977 (among them the visit of Marshal Foch to the Crow Reservation, "Indian corn dance and other dances," Indian claims, the Zuni Development Center, "the children of the Akiachak Indians," and a Job Corps center with Senator Lee Metcalf); 9 reels from 1941 to 1977 on "Educational options for Alaskan Natives, offender rehabilitation in Oklahoma, economic life of the Pueblos, Zuni redevelopment, the Alaska Native Claims Settlement Act, Hopi and Navajo relocation, and the life of the Papago Indians"; and 2 reels on the Alaska Resupply Program.
- Sound recordings (general), 1969-1974, 10 items: "The education of American Indians, legislation relating to Indian affairs, the children of the Akiachak Indians, and the San Carlos Job Corps Center at Globe, Arizona."
- Under the Carson/Stewart Indian School, 500 "Soundscriber records of the Navajo school program, 1950-54," held in San Francisco.

The National Archives' research page on urban relocation describes the Bureau's relocation program and its records in the same record group [15].

### 4.2 What matters for law and governance

Relevant: the Alaska Native Claims Settlement Act film, the Hopi and Navajo relocation film (the Navajo-Hopi Land Settlement Act of 1974), the Indian claims reel, the offender rehabilitation film, the Zuni redevelopment films and the sound items on "legislation relating to Indian affairs." These show federal policy being carried out and explained by the agency that ran it.

Not relevant to law, or held: the Wanamaker films of dances and customs, the "corn dance and other dances" reel, and other ceremony footage; the films and sound items about "the children of the Akiachak Indians"; and the 500 Navajo school recordings.

### 4.3 Rights and cultural sensitivity

Films made by federal agencies are works of the United States government, and the National Archives treats them as public domain, while warning that some special media records hold others' rights [3]. The Wanamaker films were made by a private expedition, not the government, but they date from 1908 to 1920 and so are out of copyright in the United States whatever their status (project analysis: works published before 1931 are in the public domain in 2026, and the expedition leader Joseph K. Dixon died in 1926).

Copyright is not the limit here; the CARE principles are. As Trevor's research thread asked on Nov. 27, 2026:

- Ceremony films are held back: not served, embedded or described in detail until the nation filmed gives consent, the same rule as the stories collection.
- The Navajo school recordings, which may hold children's voices, are held privately under the project's rule for children's matters, and the Akiachak children's items with them.
- Policy films are shown with a caption that names the policy and what it did (for example, that relocation moved families off their homelands), not with the film's own framing alone.

### 4.4 What blocks the next step

Item-level counts (how many reels are digitized, their running times and file sizes) need the National Archives Catalog API, which requires a free key [16]; the catalog's public website gives nothing without it from a script. The earlier note already asks Trevor for this key, which also opens the archival treaty scans.

## 5. Sources

1. United States Court of Appeals for the Ninth Circuit, "Live Streams and Videos," https://www.ca9.uscourts.gov/cases/streams-videos/ (read Nov. 27, 2026); hearing record for *Yurok Tribe v. Klamath Water Users Ass'n*, No. 23-15499 (argued June 12, 2024), MP3 at https://cdn.ca9.uscourts.gov/datastore/media/2024/06/12/23-15499.mp3 (read Nov. 27, 2026).
2. United States Court of Appeals for the Tenth Circuit, "Oral Argument Recording Archive," https://www.ca10.uscourts.gov/node/3680, and "Argument Recordings" search, https://www.ca10.uscourts.gov/oralargument/search (read Nov. 27, 2026).
3. National Archives, "Permissions / Rights for Use of Special Media Records at NARA," https://www.archives.gov/research/motion-pictures/permissions (read Nov. 27, 2026); 17 U.S.C. § 105.
4. Department of the Interior, *Land Buy-Back Program for Tribal Nations: Ten Years of Restoring Land and Building Trust 2012-2022* (Dec. 2023), https://www.doi.gov/sites/default/files/doi-lbb.pdf (read Nov. 27, 2026), "Program Results and Impacts" and Appendices C and D.
5. Department of the Interior, *Land Buy-Back Program for Tribal Nations Cumulative Sales* (Oct. 12, 2022), https://www.doi.gov/sites/doi.gov/files/land-buy-back-program-for-tribal-nations-cumulative-sales-through-october-12-2022.pdf (read Nov. 27, 2026).
6. Federal Communications Commission, Universal Licensing System complete license file `l_mdsitfs.zip` (Nov. 22, 2026), https://data.fcc.gov/download/pub/uls/complete/ (read Nov. 27, 2026).
7. National Archives, *Guide to Federal Records*, Record Group 75, sections 75.20.4, 75.27 and 75.28, https://www.archives.gov/research/guide-fed-records/groups/075.html (read Nov. 27, 2026).
8. Free Law Project, "Oral Argument Recording Archive," https://free.law/projects/oral-arguments/ (cited in the earlier note, read Nov. 27, 2026).
9. Cloudflare, "R2 pricing," https://developers.cloudflare.com/r2/pricing/ (cited in the earlier note).
10. Cloudflare, "Workers AI pricing," https://developers.cloudflare.com/workers-ai/platform/pricing/ (cited in the earlier note).
11. Department of the Interior, "Three Million Acres of Land Returned to Tribes Through Interior Department's Land Buy-Back Program for Tribal Nations" (Dec. 4, 2023), https://www.doi.gov/pressreleases/three-million-acres-land-returned-tribes-through-interior-departments-land-buy-back (read Nov. 27, 2026).
12. Federal Communications Commission, Transforming the 2.5 GHz Band, 84 Fed. Reg. 57,343 (Oct. 25, 2019), https://regulations.justia.com/regulations/fedreg/2019/10/25/2019-22511.html (search result, Nov. 27, 2026).
13. Federal Communications Commission, "FCC Grants Additional 2.5 GHz Spectrum Licenses for Wireless Services in Alaska Native Communities" (Aug. 23, 2021), https://docs.fcc.gov/public/attachments/DOC-375125A1.txt (cited in the earlier note).
14. Federal Communications Commission, Wireless Telecommunications Bureau, Memorandum Opinion and Order, DA 24-251, https://docs.fcc.gov/public/attachments/DA-24-251A1.pdf, and DA 24-264, https://docs.fcc.gov/public/attachments/DA-24-264A1.pdf (read Nov. 27, 2026).
15. National Archives, "Bureau of Indian Affairs Records: Urban Relocation," https://www.archives.gov/research/native-americans/bia/urban-relocation (read Nov. 27, 2026).
16. National Archives, "API for the National Archives Catalog," https://www.archives.gov/research/catalog/help/api (cited in the earlier note).
