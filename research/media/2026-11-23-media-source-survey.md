# Media sources for the website: videos, sound recordings and pictures

Survey date: November 23, 2026. Purpose: find videos, sound recordings and pictures the website's Picture, Video and Audio blocks (and YouTube links) could use, with each source's reuse terms and cultural-sensitivity concerns. Nothing found here is on the website, and no media file was downloaded.

Method: one AI research assistant (Claude, using web search and web fetch) read each source's own pages and terms and quoted them with links. The thread's lead session then re-fetched three of the license statements (the BJA reuse policy, the NARF Indigenous Peacemaking Initiative footer, and the National Archives still-pictures permissions page) and one video's YouTube listing, and all four matched. Statements marked *(analysis)* are the assistant's reasoning, not a source's words; statements marked **unverified** rest on pages that could not be read. Re-check any item's rights on its own page before it is used.

Related: [per-nation pictures recommendation](2026-11-23-per-nation-pictures-recommendation.md); the project's rules on restricted material ([charter, commitment 5](../../docs/charter.md#5-cultural-knowledge-and-restricted-material)) and on nations' seals and logos ([official-images.md](../../docs/official-images.md)).

**Pages that could not be read:**
- The Smithsonian's own terms page and Open Access FAQ (si.edu) returned errors.
- Several loc.gov item pages returned 403 or 503 part-way through the session.
- Wikimedia Commons rate-limited its API. I read Commons pages through raw page text instead.
- YouTube's main terms URL is blocked to automated readers. I read the US regional copy instead.
- web.archive.org was not reachable.

Where a fact rests on a page I could not read, it is marked **unverified**. Statements marked *(analysis)* are my own reasoning, not quotations from a source.

## How to read the license classes

- **Public domain (US federal work).** A US government work has no copyright. Govinfo quotes the statute: "Copyright protection under this title is not available for any work of the United States Government" (https://www.govinfo.gov/about/policies).
  - Federal pages still carve out third-party material. BJA says "Some materials may contain a copyright notice" and "Copyrighted music or footage, which is incorporated in a production, may not be used unless permission is obtained" (https://bja.ojp.gov/reuse-policy).
  - Work made by a grantee is not automatically federal. Under 2 CFR 200.315(b), the recipient may copyright it, and "The Federal agency reserves a royalty-free, nonexclusive, and irrevocable right to reproduce, publish" it for federal purposes (https://www.law.cornell.edu/cfr/text/2/200.315).
  - *(analysis)* So webinars run by the Tribal Law and Policy Institute (TLPI) or NAICJA under BJA grants are not public domain by default. They need the grantee's permission.
- **Embed-only (YouTube).** YouTube's terms bar users from "access, reproduce, download, distribute, transmit, broadcast, display, sell, license, alter, modify" content except as authorized, and add "You may also show YouTube videos through the embeddable YouTube player" (https://www.youtube.com/static?gl=us&template=terms).
  - Privacy-enhanced mode is the youtube-nocookie.com embed domain. YouTube says it "prevents the use of views of embedded YouTube content from influencing the viewer's browsing experience on YouTube" (https://support.google.com/youtube/answer/171780?hl=en).
  - Uploaders can turn embedding off ("Uncheck the box next to 'Allow embedding'", same page).
  - I checked each YouTube ID below with YouTube's oEmbed endpoint (https://www.youtube.com/oembed?url=…). Each returned a title, channel and embed player on 2026-11-23. *(analysis)* That shows the video was public and embeddable that day. It is not a license, so re-check before publishing.
- **CC0 and CC licenses cover copyright only.**
  - The National Portrait Gallery (a Smithsonian unit) says "CC0 only applies to copyright so you may still need someone else's permission" and "a third party may claim rights in the content such as trademark, privacy, or publicity rights" (https://npg.si.edu/open-access-frequently-asked-questions).
  - Commons says a CC license or public-domain status "does not affect any rights belonging to the *subject* of the photograph" (https://commons.wikimedia.org/wiki/Commons:Photographs_of_identifiable_people).
- **CARE principles.** Source: the Global Indigenous Data Alliance (GIDA) one-pager (https://www.nnigovernance.arizona.edu/sites/default/files/resources/CARE%2520Principles_One%2520Pagers%2520FINAL_Oct_17_2019.pdf).
  - **Collective Benefit:** "Data ecosystems shall be designed and function in ways that enable Indigenous Peoples to derive benefit from the data."
  - **Authority to Control:** Indigenous Peoples' "authority to control" their data must be recognised.
  - **Responsibility:** those using the data must "share how those data are used".
  - **Ethics:** "Indigenous Peoples' rights and wellbeing should be the primary concern."
  - *(analysis)* For us, CARE means three things: ask the nation or program before rehosting; give a nation-facing removal route, not just a generic one; and prefer media the nation itself produced over outsider depictions.

---

## 1. Tribal court and peacemaking program video

### 1.1 Indigenous Peacemaking Initiative (IPI) video library, Native American Rights Fund (NARF)

**What it offers.** The page lists 18 peacemaking videos (https://peacemaking.narf.org/about-peacemaking/videos-about-peacemaking/). They are embedded from YouTube with no-cookie mode on. 17 are on NARF's own channel and one, Kake, is on Tribal Access Justice Innovation's channel. I confirmed each ID with oEmbed. One further entry, the Stanford "Sacred Circles" piece, also exists as Vimeo item 235384475. Examples:
- "About Peacemaking – Robert Yazzie" (Navajo Nation Chief Justice Emeritus): https://www.youtube.com/watch?v=eE_0OPp6z0o
- "About Peacemaking – Judge Michael Petoskey" (Pokagon Band): https://www.youtube.com/watch?v=nZfiiAvQNNU
- "Verna Teller: Healing Community through Peacemaking" (Isleta Pueblo): https://www.youtube.com/watch?v=r-xnDCR9uVw
- From the 2014 conference: "Peacemaking From the Bench" https://www.youtube.com/watch?v=6ibVa7biFOM; "Peacemaking Programs at Work in Tribal Nations" (Mississippi Band of Choctaw, Alabama-Coushatta) https://www.youtube.com/watch?v=Y4PNdEMwPqA; "Reentry Programs Using Peacemaking" (Muscogee, Cherokee) https://www.youtube.com/watch?v=dWgVLczGi2M; "Traditional Dispute Resolution as Healing and Growth of Tribal Sovereign Power" https://www.youtube.com/watch?v=NDPecJKreeg
- A four-part Stanford sample circle, starting with Part 1: https://www.youtube.com/watch?v=Te2PsrYXepQ
- The 2014 Cherokee Nation peacemaking conference archive at the National Indian Law Library (NILL) embeds the same session videos (https://www.narf.org/nill/documents/peacemaking/20141006_peacemaking-conference/).

**License.** The footer reads "© 2026 • Indigenous Peacemaking Initiative | Native American Rights Fund • All Rights Reserved." No video-specific license is given (https://peacemaking.narf.org/videos-about-peacemaking/). Class: **embed-only**; rehosting needs permission.

**Cultural sensitivity.**
- The videos are mostly talks by judges and practitioners, which is low risk.
- The Stanford sample circles show students role-playing. *(analysis)* They are not real disputants, which makes them the safest footage of a live circle.
- Treat any conference opening song or prayer, for example "Cherokee Nation Morning Song" on the NILL archive page, as ceremonial. Do not clip it out of context.

**Fit.** Video: YouTube no-cookie embed. Print: use our own poster frame or title card. *(analysis)* The YouTube thumbnail belongs to the uploader. Transcripts: none found on the page. YouTube captions **unverified**.

**Value: High.** It is the largest curated set of peacemaking video and is mostly in tribal judges' own voices.

### 1.2 Navajo Nation Judicial Branch and Peacemaking Program

**What it offers.**
- The program page describes Hózhóji Naat'aah, Áłchíní BáNdazhnit'á and Life Value Engagements. It links a brochure but carries no video or photo media (https://courts.navajo-nsn.gov/?p=89304; brochure https://courts.navajo-nsn.gov/wp-content/uploads/2025/10/Peacemaking-Program-Brochure-OCT.2025.pdf).
- I found no official Judicial Branch YouTube channel. Search turned up only press-release archives (https://courts.navajo-nsn.gov/news-and-other-announcements). A Facebook presence is **unverified**.
- The best Navajo-voiced media is elsewhere:
  - An audio podcast with Peacemaking Program Coordinator Gloria Benally, posted August 13, 2018, with a full transcript that includes Navajo-language passages with English translations (https://tribaljustice.org/2018/08/13/navajo-peacemaking-the-value-of-traditional-language-in-peacemaking/).
  - Robert Yazzie's talks: NARF video (§1.1), and "Honoring Nations: Robert Yazzie: The Navajo Nation Judicial Branch" on the Indigenous Governance Database (https://nnigovernance.arizona.edu/honoring-nations-robert-yazzie-navajo-nation-judicial-branch).
- A new film on forgiveness and hózhǫ́ was reported by the Navajo Times (https://navajotimes.com/ae/arts/finding-hozhǫ-travis-holt-hamiltons-newest-film-explores-forgiveness-culture-and-pursuit-of-peace-across-dinetah/). Content and licensing **unverified**.

**License.** The court site shows no license statement on the program page. Class: **permission needed** for anything Judicial Branch-made. The podcast page says "Copyright © 2023 - Tribal Access To Justice Innovation."

**Cultural sensitivity.**
- Peacemaking uses stories and teachings (program page above). Some teachings may be seasonal or restricted. Ask the program what may be published.
- Navajo tradition treats contact with the dead with avoidance: "any contact with them is to be avoided" (https://ehillerman.unm.edu/node/1451). *(analysis)* That supports asking the Judicial Branch before using archival photos of deceased judges or peacemakers.
- Navajo tribal parks ask visitors to "Obtain permission before taking pictures of the Navajo people," and commercial photos need a permit (https://navajonationparks.org/rules-regulations/).

**Fit.** Audio: R2 rehost with the existing transcript, if the Center for Justice Innovation and the Navajo program agree. Picture: only with Judicial Branch permission.

**Value: High.** It is the flagship peacemaking program. The best media needs permission.

### 1.3 Muscogee (Creek) Nation Supreme Court

**What it offers.** A YouTube live feed of hearings ("Live feed is only available during active court sessions") and a channel at https://www.youtube.com/@MCNSupremeCourt, plus a court group photo (https://www.creeksupremecourt.com/).

**License.** "Copyright 2025, Muscogee (Creek) Nation. All Rights Reserved" (same page). Class: **embed-only**; the photo needs permission.

**Cultural sensitivity.** Hearings show identifiable litigants. *(analysis)* Embed only argument sessions in public-law cases. Avoid family, juvenile or criminal matters.

**Fit.** Video: YouTube embed of a specific archived session, if archives exist (**unverified**).

**Value: Medium.** It shows a tribal appellate court at work, but there is privacy risk and no curated clips.

### 1.4 Other tribal courts checked

- **Little River Band of Ottawa Indians.** The tribal court livestreams proceedings ("The public will be able to view public court proceedings via a livestream"). The notice says nothing about recording or reuse (https://lrboi-nsn.gov/sites/default/files/pages/Notice-Regarding-Livestreaming-2.pdf). Class: **permission needed**. Value: Low; do not capture or rehost.
- **Mississippi Band of Choctaw Peacemaking Court** and **Tulalip Wellness Court and Elders Panel** videos are on NAICJA (§2.1).
- **Organized Village of Kake** circle peacemaking video is covered in §2.4.
- **Pokagon Band:** Judge Petoskey video (§1.1). American Indian magazine ran Pokagon Band photos of the circular courtroom and the "Healing Fire Room," credited "Courtesy of the Pokagon Band of Potawatomi" (https://www.americanindianmagazine.org/story/Native-negotiation-methods). Class: **permission needed**. Value: High as a permission target.
- **Cherokee Nation:** Osiyo TV publishes episodes (https://osiyo.tv/?p=5866). I found no court or peacemaking episode; **unverified**.
- **Little Traverse Bay Bands:** the peacemaking page was behind a bot check (https://ltbbodawa-nsn.gov/?p=3088); **unverified**.
- **Ho-Chunk, Oneida, Pascua Yaqui, Grand Traverse Band:** no published court video found in searches (**unverified**). The Grand Traverse Band court has a text profile on the Indigenous Governance Database (https://nnigovernance.arizona.edu/grand-traverse-band-tribal-court).

### 1.5 "Tribal Justice" (2017 documentary, dir. Anne Makepeace)

**What it offers.** A 57-minute film on Chief Judges Abby Abinanti (Yurok) and Claudette White (Quechan). A trailer is at https://youtu.be/PXz2o3GSHFs (https://www.visionmakermedia.org/film-library/tribal-justice). The full film's PBS POV stream "expired on October 28, 2019" (https://www.pbs.org/video/tribal-justice-dpsjnn).

**License.** PBS page: "Copyright © 2026 Public Broadcasting Service (PBS), all rights reserved." Class: **embed-only** for the trailer; **permission needed** for clips.

**Cultural sensitivity.** The film shows real defendants and families. *(analysis)* Do not take stills of participants.

**Fit.** Video: YouTube trailer embed. Value: High for storytelling, Low for reuse.

---

## 2. Organizations

### 2.1 National American Indian Court Judges Association (NAICJA)

**What it offers.** A video page (https://www.naicja.org/video/) and a YouTube channel (@naicja9023, confirmed via oEmbed). Examples:
- "Mississippi Band of Choctaw Indians: Peacemaking Court": https://www.youtube.com/watch?v=KqjkOwkcvCM (page https://www.naicja.org/2020/04/14/mississippi-band-of-choctaw-indians-peacemaking-court/)
- "Tulalip Tribes of Washington: Wellness Court & Elders Panel": https://www.naicja.org/2020/04/14/tulalip-tribes-of-washington-wellness-court-elders-panel/
- 2017 conference sessions on ICWA, tribal–state collaboration and judicial wellness.

NAICJA also published a three-episode podcast in 2022 on the Tribal Law and Order Act, VAWA and ICWA, marked "© All rights reserved" (https://podcasts.apple.com/us/podcast/naicja-podcasts/id1606263576).

**License.** The videos carry a BJA grant note: "This project was supported by Grant No. 2016-IC-BX-K003 awarded by the Bureau of Justice Assistance." No license is given (Choctaw page above). Class: **embed-only**. As a grantee work it is not public domain (2 CFR 200.315 above).

**Cultural sensitivity.** The elders panel and wellness-court participants may be identifiable. Check for minors or participants before embedding.

**Fit.** Video: YouTube embed. Audio: podcast needs permission, and no transcript was found.

**Value: High.** It is the only video found of a named tribal peacemaking court, and it comes from the national judges' association.

### 2.2 Tribal Law and Policy Institute (TLPI): Tribal Court Clearinghouse and Walking on Common Ground

**What it offers.**
- About 20 recorded YouTube webinars from 2014–2018, many on Healing to Wellness Courts and domestic-violence courts. Example: "Planning the Healing to Wellness Court: Inspiration and Vision to Get Started," https://www.youtube.com/watch?v=af9LxMMeiWw (channel @TLPIORG, confirmed via oEmbed). List: https://tribal-institute.org/lists/webinars.htm.
- With BJA: "Tribal Healing to Wellness Courts as Restorative Justice," May 25, 2023, with a youtu.be recording link (https://bja.ojp.gov/events/tribal-healing-wellness-courts-restorative-justice).
- No peacemaking-specific webinar is listed.
- Walking on Common Ground's tribal–state–federal court material is mainly reports (https://www.tribal-institute.org/WOCG/Pathways2EqualJusticeReport.htm).

**License.** No license on the list page. The only statement is "The Tribal Court Clearinghouse is published as a public service by the Tribal Law and Policy Institute" (https://tribal-institute.org/lists/webinars.htm). Class: **embed-only**. The BJA event page is federal, but the recording's presenters are a grantee, so status is **unverified** (analysis).

**Cultural sensitivity.** Low: these are professional webinars.

**Fit.** Video: YouTube embed. Transcripts: not found.

**Value: Medium-High.** It is the core source for healing-to-wellness courts, though it is dry webinar footage.

### 2.3 Center for Justice Innovation (formerly Center for Court Innovation), Tribal Justice Exchange, and Tribal Access to Justice Innovation

**What it offers.**
- tribaljustice.org "is a project of the Center for Court Innovation's Tribal Justice Exchange" (https://tribaljustice.org/about-us/). It hosts podcasts with on-page transcripts:
  - The Navajo peacemaking podcast (§1.2)
  - "'Each One's a Success When They Walk Through That Door': Creating and Sustaining a Tribal Peacemaking Program" (Colville): https://tribaljustice.org/2018/08/13/each-ones-a-success-when-they-walk-through-that-door-creating-and-sustaining-a-tribal-peacemaking-program/
  - A Navajo community-court episode (list https://tribaljustice.org/category/podcasts/page/2/)
  - The "New Thinking" episode on Colville elders as peacemakers, from June 2012, with a full on-page text (https://blubrry.com/newthinking/42714306/peacemaking-how-native-american-elders-use-tradition-to-support-offender-reintegration)
- There is also a 2012 video page on Navajo practitioners training Red Hook peacemakers (https://www.innovatingjustice.org/resources/peacemaking-practitioners-from-navajo-nation-train-volunteers-in-red-hook/).

**License.** The center's Terms of Use page reads only "Full policy coming soon" (https://www.innovatingjustice.org/terms-of-use). tribaljustice.org: "Copyright © 2023 - Tribal Access To Justice Innovation." Class: **permission needed**.

**Cultural sensitivity.** The Colville episode includes a named 29-year-old peacemaking client ("Brad"). *(analysis)* Ask whether he consented to wider reuse.

**Fit.** Audio: R2 rehost with the transcript, if permission is granted. This is ideal for our Audio block because transcripts already exist.

**Value: High.** It offers peacemakers' own voices with ready transcripts.

### 2.4 Native Nations Institute (NNI) Indigenous Governance Database and the Harvard Project's Honoring Nations

**What it offers.**
- A peacemaking keyword hub listing 12 resources (https://www.nnigovernance.arizona.edu/keywords/peacemaking).
- Video pages with full transcripts, for example:
  - Rae Nell Vaughn, "Tribal Court Systems in the 21st Century: The Choctaw Tribal Court System" (2009, Vimeo 71467037, transcript on page): https://www.nnigovernance.arizona.edu/rae-nell-vaughn-tribal-court-systems-21st-century-choctaw-tribal-court-system
  - "Giving the Justice System the Support It Needs" (2010; Vaughn, Pouley, Pommersheim and others; Vimeo 48832789; transcript): https://nnigovernance.arizona.edu/rebuilding-native-nations-course-series-giving-justice-system-support-it-needs
  - "Kake Circle Peacemaking – Overview Video" (2003, Vimeo 85293044), whose closing credits say "Property of OVK" (Organized Village of Kake): https://nnigovernance.arizona.edu/kake-circle-peacemaking-overview-video. The same film is on YouTube at https://www.youtube.com/watch?v=519Zqbfzn9Y (channel "Tribal Access Justice Innovation," confirmed via oEmbed).
- The Harvard tribal justice toolbox curates these on YouTube (https://sites.google.com/g.harvard.edu/tribal-justice-systems-toolbox/innovate/in-their-own-words/watch).

**License.** NNI pages say content and marks "may not be reproduced without express written permission," "© 2026 The Arizona Board of Regents" (Vaughn page). The Kake page says it is shown "with the permission of the Harvard Project." Class: **permission needed**. The YouTube copies are **embed-only**.

**Cultural sensitivity.** Kake shows community members and the circle keeper. The Organized Village of Kake owns it.

**Fit.** Video: our block cannot embed Vimeo. *(analysis)* Use the YouTube copy where one exists; otherwise link out or ask to rehost. Audio or transcript: excellent, because NNI transcripts can feed our transcript field with permission.

**Value: High.** It is the deepest body of tribal-court talks, and it already has transcripts.

### 2.5 National Congress of American Indians (NCAI)

**What it offers.** YouTube and Vimeo videos and Flickr galleries of conventions and events. The page names no court-specific media (https://archive.ncai.org/news/multimedia-center).

**License.** Photos are under "a Creative Commons License" and "available for use by media, educational institutions, and tribal governments." Which CC variant applies is **unverified**; check each Flickr photo. Class: **CC (per item)** for photos; **embed-only** for video.

**Cultural sensitivity.** Event photos show identifiable leaders. Fine with credit.

**Fit.** Picture: R2 rehost with credit after a per-photo license check.

**Value: Low-Medium.** Mostly policy events, not courts.

### 2.6 National Judicial College / National Tribal Judicial Center and UNLV

**What it offers.** The National Tribal Judicial Academy (UNLV's Indian Nations Gaming & Governance program with the National Tribal Judicial Center), Jan 11–13, 2027. Its curriculum includes "alternative dispute resolution." The page mentions no recordings (https://law.unlv.edu/events/national-tribal-judicial-academy). NJC webcasts exist generally (https://sji.gov/national-judicial-college-archives-recorded-webcasts-for-future-reference); tribal-specific public video is **unverified**.

**License.** "© 2026 William S. Boyd School of Law." Class: **permission needed**.

**Value: Low** for media. It is a possible partner to film or photograph with consent.

### 2.7 Other organizations checked

- **Indian Law Resource Center, Michigan State University Indigenous Law & Policy Center, Federal Bar Association Indian Law Conference:** no public recordings found in searches. FBA conference pages are event listings only (https://lawschool.unm.edu/news/2025/05/50th-annual-federal-bar-association-indian-law-conference.html). Recordings **unverified**. Value: Low.
- **Arizona's Indigenous Peoples Law and Policy (IPLP) program:** its talks surface through NNI (§2.4).
- **Stanford's Native American Cultural Center (NACC):** its circle videos are on NARF's channel (§1.1).

---

## 3. Oral histories and audio

### 3.1 Library of Congress American Folklife Center (AFC), including Ancestral Voices and the Federal Cylinder Project

**What it offers.**
- Ancestral Voices succeeds the Federal Cylinder Project. It starts with the 1890 Passamaquoddy cylinders and pilots Traditional Knowledge (TK) Labels applied by the tribe in Mukurtu (https://www.loc.gov/collections/ancestral-voices/about-this-collection/).
- *(analysis)* The content is songs and narratives, not courts.

**License.** AFC: "Rights over the recordings in American Folklife Center (AFC) collections generally belong to the performers." Rights may also belong to "the traditional community of origin" (https://ask.loc.gov/american-folklife/faq/304212). AFC collection statement: researchers should "approach the materials … with respect for the culture and sensibilities" (https://www.loc.gov/collections/living-nations-living-words/about-this-collection/rights-and-access/). Class: **permission needed**.

**Cultural sensitivity.** This is the strongest formal policy found.
- The Library's September 2024 Indigenous access policy says that for culturally sensitive materials "No online access or onsite copying is permitted without written permission from the community of origin."
- It also says uses "must also include proper attribution to the community of origin and to the collection source."
- It recommends an "Indigenous Recordings Notice" in catalog records.
- Source: https://www.loc.gov/acq/devpol/materialsindigenouspeoplesaccess.pdf

**Fit.** Audio: not recommended.

**Value: Low.** It matters for cultural-protocol essays, not for court media.

### 3.2 Doris Duke American Indian oral history collections (Utah, Oklahoma, Arizona, Florida, New Mexico, South Dakota, Illinois)

**What it offers.** These are 1966–1972 interviews, now being digitized and returned to tribal control through Mukurtu-based portals. "More control may mean that some materials won't be as readily accessible to the public." The University of New Mexico has pulled transcripts that describe ceremonies (https://www.pbs.org/newshour/nation/states-return-recordings-of-indigenous-oral-histories-to-tribal-control). Court-relevant finds:
- **Cipriano Manuel (Tohono O'odham)** discusses his work as a tribal judge in a University of Arizona seminar. The page says "the original recording was lost," which suggests only a transcript survives (https://asmla.org/node/4514).
- **Judge Garfield W. Hood (Keweenaw Bay Indian Community)** oral history at Northern Michigan University. Format and rights not stated (https://uplink.nmu.edu/node/31452). This one is not a Doris Duke item.

**License.**
- Utah: recordings "are free for use but access is subject to change… Duplication for commercial use is not permitted without permission" (https://www.nativeoralhistory.org/node/8681).
- Oklahoma example (Forest Olds, Miami Tribe, 1969; MP3 and PDF): "freely available except in cases where the community of origin decided to restrict access" (https://www.nativeoralhistory.org/digital-heritage/interview-forest-olds).
- Florida: Catawba and Seminole interviews are repatriated and tribal-members-only (https://guides.uflib.ufl.edu/NAOH/collection).

Class: **other / permission needed** (non-commercial; access revocable).

**Cultural sensitivity.**
- The archive warns that "Some records contain racist language, descriptions of violence."
- It links a Shoshone-Paiute (Duck Valley) cultural protocol (node/8681 page).
- These recordings are the clearest CARE case. *(analysis)* Ask the interviewee's nation before any use.

**Fit.** Audio: R2 rehost only with tribal and library permission. Transcripts often exist as PDFs.

**Value: Medium.** There are a few direct court voices, under strong governance.

### 3.3 Smithsonian Folkways

**What it offers.** Mostly music, for example Navajo song albums (https://folkways.si.edu/navajo-songs/american-indian/music/album/smithsonian).

**License.** Every use needs a license: "The use of any Smithsonian Folkways Recordings master requires a credit," and use is "for use of the master recording only" (https://folkways-media.si.edu/docs/folkways/customer_service/License_Request_Form.pdf). Class: **permission needed**.

**Cultural sensitivity.** Folkways' own audit found sacred material possibly published "without proper permission" and asks how many albums "hold sacred, secret, or personal content" (https://folklife.si.edu/magazine/indigenous-music-shared-stewardship).

**Value: Low.** It is off-subject and carries sacred-song risk.

### 3.4 National Museum of the American Indian (NMAI)

**What it offers.**
- Symposium videos on YouTube, for example "Nation to Nation: 13 Great Nations Keep Their Word – Philip J. Deloria" (2014). The record shows no usage statement (https://americanindian.si.edu/collections-search/object/yt_kp1lNpE3Khw).
- American Indian magazine's peacemaking article (§1.4).

**License.** Video: **embed-only**. Whether NMAI images are CC0 is decided item by item. I could not read Smithsonian's own Open Access pages, so any blanket CC0 claim is **unverified**.

**Cultural sensitivity.** NMAI "withholds object images, culturally protected information, and historic photos of culturally sensitive subjects" and answers takedown notices "within two business days" (https://americanindian.si.edu/collections-statement).

**Value: Medium.** Good for self-government and treaty context.

### 3.5 Native America Calling (Koahnic Broadcast Corporation)

**What it offers.** "The strength of tribal courts" (October 27, 2022), with Matthew Fletcher and Umatilla Tribal Court director Matt Johnson (https://www.nativeamericacalling.com/thursday-october-27-2022-the-strength-of-tribal-courts/).

**License.** "Copyright © 2026 Koahnic Broadcast Corporation." No transcript is listed, and the episode includes licensed break music. Class: **permission needed**. Link out instead.

**Value: Medium-High** for content, **Low** for reuse.

### 3.6 Child Welfare Information Gateway podcast (US Children's Bureau)

**What it offers.** A "Tribal Courts and Child Welfare" series with PDF transcripts. Example: Episode 39, "Being Family Centered," with the Saint Regis Mohawk and Taos Pueblo chief judges (https://www.childwelfare.gov/resources/tribal-courts-and-child-welfare-being-family-centered-episode-39/). Episode 38 is https://www.childwelfare.gov/more-tools-resources/podcast/episode-38.

**License.** The site policy does not state public-domain status (https://www.childwelfare.gov/information-gateway-policies/). As a federal service it is *probably* public domain, but that is **unverified** (it may be contractor-produced). Ask info@childwelfare.gov.

**Fit.** Audio plus transcript is a perfect match if public domain is confirmed.

**Value: High.**

---

## 4. Public-domain and openly licensed images

### 4.1 Library of Congress Prints & Photographs

**What it offers.**
- **Navajo Tribal Council committee in the Council House, Window Rock** (Thomas O'Halloran, 1966), in the Library's "Free to Use and Reuse" Native American Heritage set (https://www.loc.gov/free-to-use/native-american-heritage/; item https://www.loc.gov/resource/ppmsca.04781/). The item's rights advisory is **unverified**; the page failed to load.
- **Judge Crazy Walking, Court of Indian Offenses, Standing Rock** (Frank B. Fiske, c. 1931), featured on the Law Library blog (https://blogs.loc.gov/law/2017/04/judge-crazy-walking/). Item rights **unverified** (loc.gov/pictures/item/93503078 returned an error).
- Group records vary. "Portraits of individuals and groups of Native Americans": "No known restrictions on publication" (https://www.loc.gov/item/92500832). "Early images in Indian Territory": "Rights status of individual images not evaluated" (https://www.loc.gov/item/2004665223).

**License.** The Library "cannot grant or deny permission to publish" (92500832 page). Class: **public domain or no known restrictions, item by item**.

**Cultural sensitivity.**
- Many 19th-century studio portraits stage subjects with props. "Many 19th century Native American photographs also contain misidentified persons" (https://clements.umich.edu/issues-regarding-19th-century-native-american-photographs/).
- The Crazy Walking portrait shows the judge in a headdress holding a pipe, a photographer-styled image. *(analysis)* Caption the court role, not the costume.

**Fit.** Picture: R2 rehost with credit "Library of Congress, Prints & Photographs Division" plus the item ID.

**Value: High** for law-history images.

### 4.2 National Archives (NARA), including Bureau of Indian Affairs Record Group 75

**What it offers.** A Native American photos list (https://www.archives.gov/research/native-americans/pictures), including:
- Delegates of 34 tribes at the Creek Council House, c. 1880: https://catalog.archives.gov/id/519141
- Sioux Indian police at Pine Ridge, 1882: https://catalog.archives.gov/id/519143
- Cheyenne and Arapaho council, 1900: https://catalog.archives.gov/id/519188

There is also a BIA photo finding aid by tribe (https://www.archives.gov/research/native-americans/bia/photos/tribal-nations). No court photos are in the list.

**License.** Federal records are "treated as though they are in the public domain," but "A small percentage of photographs in our holdings are or may be subject to copyright restrictions." Credit lines are "encouraged" (https://www.archives.gov/research/still-pictures/permissions). Film follows the same rule (https://www.archives.gov/research/motion-pictures/permissions). Class: **public domain (US federal work)**, item check needed.

**Cultural sensitivity.** NARA warns that original terms "may now be considered to be outdated, inaccurate, derogatory" and keeps the original captions (pictures page). These images are agency-made and record federal control: Indian police and BIA "agents." *(analysis)* Write new captions that name the nation and the colonial context.

**Fit.** Picture: R2 rehost.

**Value: High.**

### 4.3 State historical societies (example: Wisconsin Historical Society)

**What it offers.** "Indian Court" at Warm Springs Agency, Oregon, c. 1897–1905, naming Chief Judge Albert Kuckup and Judge Thomas Palmer (https://www.wisconsinhistory.org/Records/Image/IM29312).

**License.** "NO COPYRIGHT - UNITED STATES," but the society's terms say "Use of the image requires written permission" and the image "may not be sold or redistributed" (same page). Class: **permission needed** (contractual).

**Value: High** as an image of a historical tribal court. Request permission.

### 4.4 Smithsonian Open Access

**License.** CC0 waives copyright only (NPG FAQ above). Non-CC0 items say "usage conditions apply" (same).

**Cultural sensitivity.** NMAI withholds sensitive images (§3.4).

**Fit.** Picture: R2 rehost of CC0 items only, checked per item.

**Value: Medium.** It has few court subjects (**unverified**, since the si.edu search was unreachable).

### 4.5 Wikimedia Commons

**What it offers.** Coverage of tribal governments is thin:
- "Native American government buildings in the United States" has 10 files plus the Navajo Nation Council Chamber subcategory (https://commons.wikimedia.org/wiki/Category:Native_American_government_buildings_in_the_United_States).
- "Federally recognized tribes in the United States" has 98 subcategories (https://commons.wikimedia.org/wiki/Category:Federally_recognized_tribes_in_the_United_States), against 575 federally recognized tribes (https://www.bia.gov/about-us).

Examples:
- **Leech Lake Band of Ojibwe Tribal Justice Center entrance**, 2023, CC BY-SA 4.0 (https://commons.wikimedia.org/wiki/File:Leech_Lake_Band_of_Ojibwe-05-Tribal_Justice_Center_entrance.jpg).
- **Navajo Nation Council Chamber**, 2019, CC BY-SA 4.0 (https://commons.wikimedia.org/wiki/File:Navajo_Nation_Council_Chamber,_January_2019.jpg).
- **Navajo Nation Council Chamber interior during session**, April 2024, CC BY-SA 4.0. It shows identifiable delegates (https://commons.wikimedia.org/wiki/File:Navajo_Nation_Council_Chamber_interior_during_session,_April_2024.jpg).
- **Mennonite mission-archive photo of the Council House** ("No known copyright restrictions"). Its listed "date" of 2013-01-31 is the Flickr upload date, not the photo date (1950–1970 per the caption), which is a typical metadata trap (https://commons.wikimedia.org/wiki/File:Navaho_Council_House,_Window_Rock_Ariz_(8432718723).jpg).

**License.** Varies per file. Commons on identifiable people: in the US, consent "is not as a rule required to photograph people in public places," but privacy and publicity rights stay with the subject. Minors need guardian consent (https://commons.wikimedia.org/wiki/Commons:Photographs_of_identifiable_people). Class: **CC BY / BY-SA, CC0 or PD, per file**.

**Fit.** Picture: R2 rehost. CC BY-SA needs author, license name and link, and the share-alike terms bind our adaptations *(analysis)*.

**Value: Medium.** Some building photos are good, but coverage is patchy.

### 4.6 Digital Public Library of America (DPLA)

**What it offers.** An aggregator of 1,900-plus institutions using RightsStatements.org labels (https://dp.la/news/announcing-the-launch-of-rightsstatements-org).

**License.** Metadata is CC0. For visuals, "please contact the relevant rights-holder," and users must "refrain from scraping or copying any of the Visual Assets" (https://dp.la/about/terms-conditions). Class: **varies; follow the holding institution**.

**Value: Medium** as a discovery tool only.

### 4.7 National Park Service (NPS)

**License.** NPS-created material "is generally considered in the public domain," but "Some content is protected by third party rights" (https://www.nps.gov/aboutus/disclaimer.htm). Museum images "may be subject to copyright or other legal restrictions" (https://www.nps.gov/articles/000/museum-image-rights-usage.htm). Class: **public domain (US federal)**, item check needed.

**Value: Low-Medium.** Mostly land and landscape; useful for "land" images of parks within or next to reservations.

### 4.8 Department of the Interior and Bureau of Indian Affairs photos

**License.** DOI: "Generally, materials produced by federal agencies are in the public domain." However, "Certain individuals depicted may claim rights in their likenesses and images" (https://doi.gov/copyright).

**What it offers.** The Indian Affairs Flickr account (USIndianAffairs) has 3,240 photos; the license shown per photo is **unverified** (https://flic.kr/people/62695826@N03/). BIA's Tribal Justice Support training page lists no recordings (https://www.bia.gov/CFRCourts/training).

Class: **public domain (US federal)**, per-photo check needed.

**Value: Medium** for officials and tribal leaders at federal events.

### 4.9 State court systems

The Judicial Council of California newsroom has a "Redding Rancheria Tribal Court" photo with no credit or reuse terms shown (https://newsroom.courts.ca.gov/news/supporting-native-american-communities-our-court-systems). Class: **permission needed** (**unverified** terms). Value: Medium.

---

## 5. Podcasts and lectures

- **This Land (Crooked Media).** Rebecca Nagle's series on McGirt (https://crooked.com/podcast-series/this-land/). Commercial podcast; class **permission needed**, so link only. Value: Medium.
- **California Law Review podcast with Lauren van Schilfgaarde, "Restorative Justice as Regenerative Tribal Jurisdiction"** (2024). Covers the Yurok, St. Regis Mohawk and Sisseton Wahpeton Oyate, with a full transcript. "© 2026 California Law Review, Inc. All rights reserved" (https://www.californialawreview.org/podcast/podcast-with-lauren-van-schilfgaarde). Class **permission needed**. Value: **High**; it is on-topic and already transcribed.
- **Rez Judicata: The Federal Indian Law Podcast** (https://creators.spotify.com/pod/show/rez-judicata). License **unverified**. Value: Medium.
- **Capacity Building Center for Tribes podcast, "Are Child Welfare Decisions Better Using Peacemaking Circles?"** with Brett Lee Shelton of NARF (https://www.audible.com/es_US/podcast/Season-1-Episode-5-Are-Child-Welfare-Decisions-Better-Using-Peacemaking-Circles/B0B8JQVJ7R; series https://soundcloud.com/centerfortribes). The series is federally funded through the Children's Bureau per the University of Southern Maine (https://usm.maine.edu/news/new-podcast-series-highlights-tribal-child-welfare-programs/). Public-domain status **unverified**. Value: High if cleared.
- **Center for Justice Innovation podcasts** (§2.3) and the **NAICJA podcast** (§2.1).
- **NARF podcast:** none found (**unverified**).
- **Native America Calling** (§3.5).

---

## 6. Federal government media

### 6.1 Senate Committee on Indian Affairs

**What it offers.**
- "Oversight Hearing on Tribal Courts and the Administration of Justice in Indian Country," July 24, 2008. Witnesses included NAICJA, Hualapai Chief Judge Joseph Flies-Away and the Northwest Tribal Court Judges Association. There is a transcript PDF (CHRG-110shrg45126) and a video poster. Host of the video **unverified** (https://www.indian.senate.gov/hearings/oversight-hearing-tribal-courts-and-administration-justice-indian-country).
- "Examining Public Safety and Justice Resources in Native Communities," May 22, 2024. Transcript at https://www.indian.senate.gov/wp-content/uploads/CHRG-118shrg57060.pdf (hearing page https://www.indian.senate.gov/hearings/oversight-hearing-titled-examining-public-safety-and-justice-resources-in-native-communities).

**License.** **Public domain (US federal work)** for Senate-produced video and GPO transcripts (govinfo quote above). *(analysis)* Witnesses' written statements may carry their own copyright, but spoken hearing testimony in the official record is generally treated as publicly reusable. Credit the committee.

**Fit.** Video: R2 rehost is allowed for Senate-produced video. If the only copy is on the committee's YouTube channel, a download is still barred by YouTube's terms, so use an embed or get an official file. Audio and transcript: GPO transcripts are ready-made.

**Value: High.** Tribal judges testifying is ideal law-and-policy footage.

### 6.2 Department of Justice

**What it offers.**
- Office of Tribal Justice webinars on YouTube, for example "Impact of TLOA and VAWA," https://www.youtube.com/watch?v=TaSrfY4lR6o (https://www.justice.gov/archives/tribal/2019-2020-webinars).
- A "Sacred Sites Training Video" (https://www.justice.gov/tribal/video/sacred-sites-training-video). It is useful for our own cultural-sensitivity guidance.
- "B.J. Learns About Federal and Tribal Court," a video for Native child witnesses, with its instructor's guide (https://ovc.ojp.gov/sites/ovc/files/pubs/OVC_Archives/reports/bjcourtprep/index.html). Whether the video is online is **unverified**.

**License.** BJA and OJP: "In general, our content — text, imagery, video and audio — is not copyrighted" and "Please acknowledge BJA as the source" (https://bja.ojp.gov/reuse-policy). Class: **public domain (US federal)**, except where a grantee or third party made the work.

**Cultural sensitivity.** Youth-summit public service announcements (https://www.justice.gov/tribal/video/thats-my-people) show minors. Embed rather than rehost, and do not crop stills.

**Value: Medium.**

### 6.3 Federal Register and US Courts

**Federal Register:** I found no relevant imagery. **US Courts:** I found no tribal-court educational video. Searches surfaced only the B.J. guide above. Value: Low.

---

## Brief answers

### Do Local Contexts labels exist on items we might use, and how should a site show them?

**Where they exist.** Traditional Knowledge (TK) labels exist on the Library of Congress Ancestral Voices (Passamaquoddy) material, where "Tribal communities adapt and apply them" (https://www.loc.gov/collections/ancestral-voices/about-this-collection/). I found none on the court and peacemaking items above. The Doris Duke portals run on Mukurtu, but the items I checked showed no labels (Forest Olds page; Utah page).

**Who applies what.**
- Labels belong to communities: "Communities can customize their TK and BC Labels." Icons stay unchanged, and template text can be customized (https://localcontexts.org/wp-content/uploads/2023/04/Local-Contexts-Labels.pdf).
- Notices are what institutions use: "The Notices are tools for institutions and researchers," and "The text for the Notices cannot be changed" (https://localcontexts.org/notices/about-the-notices/).
- The TK Notice says "there are accompanying cultural rights and responsibilities." It is generated through the Local Contexts Hub, which notifies the community (https://localcontexts.org/notice/tk-notice/).

**Display practice** *(analysis)*:
- Carry any label the source shows, with its exact icon, title and text, beside the caption and credit.
- Link it to the Hub project.
- Never invent a label ourselves. A project like ours may register and display a TK Notice on Indigenous-related media.
- Store label fields in each media record so print can show the icon and short text too.

### Is there an established US practice for warnings about deceased persons?

It is not standard, but it is growing.
- In Australia, broadcasters warn that content "may contain images and voices of deceased persons" and advise "liaising with the community is paramount" (https://www.sbs.com.au/nitv/article/2017/07/27/indigenous-cultural-protocols-what-media-needs-do-when-depicting-deceased-persons).
- US examples exist. The NIBSDA boarding-school archive warns that it "may lead to other external resources that contain images, names, and references to deceased persons" (https://nibsda.elevator.umn.edu/page/view/143).
- US practice more often uses harmful-content statements: NARA's terminology note, and the Utah archive's racist-language warning (cited above).
- The 2006 Protocols for Native American Archival Materials list burials and funerals among sensitive images and urge consultation (https://www2.nau.edu/libnap-p/protocols.html).
- My view *(analysis)*: add a site-wide notice and a per-item flag ("may contain images or voices of people who have passed on"). Use it on archival portraits and historical recordings by default, and adjust it to each nation's preference, for example Navajo avoidance practice (ehillerman source above).

### Which sources already have openly licensed pictures of individual nations, and is a per-nation picture search reliable?

**Openly licensed per-nation images exist in:**
- Commons: Leech Lake justice center; Navajo Council Chamber; tribal offices of the Chinook, Nooksack and Snoqualmie (category above).
- NARA: RG 75 by-tribe finding aid.
- Library of Congress: for example the Navajo Tribal Council, 1966.
- NPS: land and landscape.

**How reliable a per-nation search would be** *(analysis)*:
- Coverage is low. Commons has tribe subcategories for about 98 of 575 nations, and only about 10 photos of tribal government buildings in its dedicated category. Most nations would end up with no image, or a generic landscape or casino photo.
- Errors are common in historical images, even if they are hard to quantify. Misidentified subjects and tribes appear in 19th-century photographs (Clements Library above). A widely sold "Cochise" image actually depicts Isleta farmer Juan Rey Abeita (https://ictnews.org/archive/is-this-really-the-legendary-cochise/). I found no published error rate for Commons; that is **unverified**. Expect wrong dates (upload date shown as photo date, as in the Mennonite file above), wrong buildings, and old agency captions.
- Consent concerns:
  - Interiors and sessions show identifiable officials.
  - Some nations restrict photography. The Hopi forbid "picture-taking, video recording, audio recording, sketching" in villages, especially at ceremonies (https://jan.ucc.nau.edu/hcpo-p/Visitor%20Etiquette.pdf). Navajo parks require permission to photograph people.
  - Under CARE's Authority to Control, a nation may object to how its seat of government is shown even when the photo is legal.

**Recommendation** *(analysis)*: do not auto-search a picture per nation. Use a neutral default (map or seal-free graphic). Add a nation image only after a human verifies it and, ideally, the nation's own communications office supplies or approves it.

---

## (a) Top 10 sources and items for the website

1. **NARF Indigenous Peacemaking Initiative YouTube videos** (Yazzie, Petoskey, Teller, the 2014 conference sessions): no-cookie embeds of peacemakers in their own voices. https://peacemaking.narf.org/about-peacemaking/videos-about-peacemaking/
2. **Navajo peacemaking podcast with Gloria Benally**, with a Navajo/English transcript. Ask to rehost the audio. https://tribaljustice.org/2018/08/13/navajo-peacemaking-the-value-of-traditional-language-in-peacemaking/
3. **NAICJA "Mississippi Band of Choctaw Indians: Peacemaking Court"** (embed). https://www.youtube.com/watch?v=KqjkOwkcvCM
4. **Kake Circle Peacemaking** (YouTube copy; ask the Organized Village of Kake before rehosting). https://www.youtube.com/watch?v=519Zqbfzn9Y
5. **NNI Indigenous Governance Database talks with transcripts** (Rae Nell Vaughn on the Choctaw court; the "Giving the Justice System the Support It Needs" panel). https://www.nnigovernance.arizona.edu/rae-nell-vaughn-tribal-court-systems-21st-century-choctaw-tribal-court-system
6. **Senate Committee on Indian Affairs 2008 tribal courts hearing** (public-domain video and transcript). https://www.indian.senate.gov/hearings/oversight-hearing-tribal-courts-and-administration-justice-indian-country
7. **NARA RG 75 council and Indian police photographs** (public domain; recaption). https://www.archives.gov/research/native-americans/pictures
8. **Library of Congress: Navajo Tribal Council, 1966, and Judge Crazy Walking, c. 1931** (verify each item's rights advisory). https://www.loc.gov/free-to-use/native-american-heritage/ ; https://blogs.loc.gov/law/2017/04/judge-crazy-walking/
9. **Child Welfare Information Gateway "Tribal Courts and Child Welfare" episodes with transcripts** (confirm public domain). https://www.childwelfare.gov/resources/tribal-courts-and-child-welfare-being-family-centered-episode-39/
10. **Pokagon Band circular courtroom and Healing Fire Room photos** (permission request), plus the Wisconsin Historical Society's Warm Springs "Indian Court" photo (permission request). https://www.americanindianmagazine.org/story/Native-negotiation-methods ; https://www.wisconsinhistory.org/Records/Image/IM29312

Runners-up:
- California Law Review van Schilfgaarde podcast (transcript)
- TLPI Healing to Wellness webinars
- Commons Leech Lake Tribal Justice Center photo (CC BY-SA 4.0)
- Muscogee (Creek) Nation Supreme Court YouTube channel

## (b) License classes by source

| Source | License class | Our block fit |
|---|---|---|
| NARF IPI / NILL videos | Embed-only (All Rights Reserved) | Video: YouTube embed |
| Navajo Judicial Branch | Permission needed | Picture or audio after permission |
| Center for Justice Innovation / tribaljustice.org podcasts | Permission needed (terms "coming soon") | Audio + transcript (R2) after permission |
| NAICJA videos and podcast | Embed-only / permission (BJA grantee) | Video: YouTube embed |
| TLPI webinars | Embed-only (grantee) | Video: YouTube embed |
| NNI Indigenous Governance Database / Honoring Nations | Permission needed (Vimeo) | Link out, or rehost with permission; transcripts |
| Muscogee (Creek) Nation Supreme Court | Embed-only | Video: YouTube embed |
| Tribal Justice (2017 film) | Embed-only (trailer) / permission | Video: trailer embed |
| Senate Committee on Indian Affairs, GPO | Public domain (US federal) | Video or audio R2 rehost; transcript |
| DOJ / BJA / OJP | Public domain (US federal), except grantee or third-party work | R2 rehost or embed |
| Child Welfare Information Gateway | Likely public domain (unverified) | Audio + transcript |
| Library of Congress P&P | Item by item ("No known restrictions" or "not evaluated") | Picture: R2 |
| LoC AFC / Ancestral Voices | Permission needed; community consent | Avoid |
| NARA / RG 75 | Public domain (US federal), item check | Picture: R2 |
| Smithsonian Open Access | CC0 (copyright only) per item | Picture: R2 |
| NMAI | Varies; withholds sensitive items | Embed video; CC0 images only |
| Smithsonian Folkways | Permission (license) | Avoid |
| Doris Duke archives | Other (non-commercial, revocable) / tribal permission | Audio + transcript with permission |
| Wikimedia Commons | CC BY / BY-SA / CC0 / PD per file | Picture: R2 with attribution |
| DPLA | Varies; follow the holder | Discovery only |
| NPS / DOI / BIA | Public domain (US federal), item check | Picture: R2 |
| NCAI Flickr | CC (variant unverified) | Picture: R2 |
| Wisconsin Historical Society | Permission (contractual, even with no copyright) | Picture after permission |
| Native America Calling, This Land, California Law Review | Permission needed | Link out, or audio with permission |

## (c) Open questions that need a human

1. **Navajo Nation Judicial Branch, Peacemaking Program.** Will the program supply or approve video, photos or audio? Which teachings are not for publication? Does it want a deceased-persons notice?
2. **Center for Justice Innovation, Tribal Justice Exchange.** May we rehost the Navajo and Colville podcast audio and transcripts in R2? Their terms page is blank. Do the participants (for example the named client "Brad") consent?
3. **Organized Village of Kake.** The film's credits say "Property of OVK." May we embed or rehost it, and under what credit?
4. **NARF Indigenous Peacemaking Initiative.** Is embedding OK, as a courtesy? Could we have download files or transcripts for the Yazzie and Petoskey talks? Is any of their YouTube content under a Creative Commons license (unverified)?
5. **NNI / University of Arizona and the Harvard Project.** We need written permission to reuse transcripts and to rehost Vimeo video, or else link out. Should our Video block also support Vimeo?
6. **Pokagon Band of Potawatomi tribal court.** Can we use the circular-courtroom and Healing Fire Room photos?
7. **Wisconsin Historical Society.** We need a permission request for IM29312. Also ask the Confederated Tribes of Warm Springs how the image should be captioned.
8. **Children's Bureau (info@childwelfare.gov).** Confirm the public-domain status of the Tribal Courts podcast audio and transcripts.
9. **Senate Committee on Indian Affairs.** Is there an official downloadable file for the 2008 tribal-courts hearing video, or is it YouTube-only?
10. **Muscogee (Creek) Nation Supreme Court.** Which archived sessions are appropriate to embed, and does the court want them used at all?
11. **Doris Duke repositories** (Arizona State Museum for Cipriano Manuel; Northern Michigan University for Judge Hood). Ask about availability and tribal approval: the Tohono O'odham Nation and the Keweenaw Bay Indian Community.
12. **Policy decisions for the project.** Adopt a Local Contexts TK Notice through the Hub? Adopt a site-wide deceased-persons and harmful-content statement? Make it a rule that no per-nation image goes up without the nation's approval?
13. **Smithsonian and Commons pages I could not reach.** Re-verify the exact Open Access FAQ wording (si.edu returned errors) and each loc.gov item's rights advisory (several pages returned 403 or 503) before publishing.
