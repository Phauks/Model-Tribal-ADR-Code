# Native nations' stories about making peace: a first catalog

**Status:** research notes, written Nov. 21, 2026, for the peacemaking track
and the essays. It lists stories, accounts and teachings about resolving
disputes and making peace that Native nations, or Native institutions, have
published, and says who would have to agree before any of them is reprinted.
It is not a finding about any nation's law or practice, and it retells no
story: where a story's content is given, it is quoted in the teller's own
words. Judgments are labeled project analysis. The search method and its
limits are in the session log,
[2026-11-21-peacemaking-stories](../sessions/2026/2026-11-21-peacemaking-stories.md).
It builds on the program survey in
[2026-11-21-peacemaking-programs](2026-11-21-peacemaking-programs.md) and does
not repeat it.

## Contents

1. Ground rules for collecting stories
2. The record format, and how a story is credited
3. The catalog
4. Anthology shortlist and whose permission each needs
5. What the stories say about protocols
6. Leads that are not stories yet
7. Gaps and next steps
8. Second search: more nations

## 1. Ground rules for collecting stories

The lead author is not Native, and the charter keeps ceremonial, restricted or
community-held knowledge out unless the community approves in
writing.[^charter-5] Archival practice written by Native and non-Native
archivists makes the same point about publishing: "Permission to publish must
be obtained from the contributors or home organization."[^protocols] So this
collection followed five rules (project analysis):

- **The nation's own telling first.** A nation's government, court, cultural
  office, press or newspaper outranks a Native institution, which outranks a
  member writing in their own name, which outranks an outside recorder.
- **Quote, never retell.** Each story is cited directly to the page, opinion
  or book where it was published, and told only in its teller's exact words:
  short excerpts (50 words or fewer) with a pinpoint, as the lead author asked
  on Nov. 21, 2026. Where a telling is Tribal law, a court opinion, or from a
  publisher that asks to be asked first, the exact words are kept in the
  project's private files and the record carries only the pinpoint and a
  fingerprint. The whole story is reprinted only with permission.
- **Record a protocol only when a source states it**, and follow it.
- **Leave out what may be sacred** when the page does not say otherwise.
- **Two permissions for a reprint.** Copyright and cultural authority are
  asked separately, even when one office holds both.

## 2. The record format, and how a story is credited

The lead author asked how stories should be attributed and in what file
format. Decision record [0019](../../docs/decisions/0019-story-records.md)
(accepted Nov. 21, 2026) answers with one YAML file per story in
`content/stories/`, checked against `schemas/story.schema.json`. In short:

- A **story** has a title, the nations, its kind and length, its methods and
  topics, and **excerpts**: exact passages from a telling, each with a
  pinpoint, a word count and a SHA-256 fingerprint. The project writes no
  summary of its own. The validator checks that each public excerpt matches
  its fingerprint, stays within 50 words unless the telling may be published
  in full, and comes from a telling whose permitted uses allow quotation.
- Each **telling** cites one source record, or one private contributor filing
  for a story that reaches the project from a person. It says whose voice it
  is (`authority`), how the teller is credited (`credit`), what the project
  may do with it (`permitted_uses`), who may see it (`access`) and who
  approved sharing it (`cultural_authority`). These shapes are shared with the
  contributor intake forms, so a told story and a published story are credited
  the same way.
- **Protocols** record a season, setting, clan or family ownership, ceremony
  or name that a source says governs the story.
- **Anthology** says whether it could be reprinted and whose permission each
  part needs.

**Credit line in print (proposal, project analysis).** A reprinted story
would carry the nation's own title, the teller as the nation or teller chose,
the publisher, and a permission line, with the full Indigo Book citation in
the Sources section. Once permission is granted, it might read:

> "Two Row Wampum," as published by the Onondaga Nation. Reprinted with the
> permission of the Onondaga Nation.

A story cited but not reprinted carries only its citation.

## 3. The catalog

Every record below has access set to "nation review first": none will be
published until the nation has seen it (charter, commitment 4).[^charter-4]
"Teller's authority" is whose voice the cited telling is. A blank protocol
cell means no source read stated one, not that none exists.

| Story record | Nation | Kind and length | Teller's authority | Protocol stated | Anthology candidate |
| --- | --- | --- | --- | --- | --- |
| `onondaga-nation-founding-of-the-great-peace`[^onondaga-history] | Onondaga Nation | historical account, long | nation government | | yes |
| `onondaga-nation-two-row-wampum`[^two-row][^onondaga-timeline] | Onondaga Nation | historical account, short | nation government | | yes |
| `haudenosaunee-wampum-records-agreements`[^onondaga-wampum][^hcf-wampum] | Onondaga Nation; Haudenosaunee Confederacy | teaching, short | nation government | sacred use of wampum | no |
| `oneida-indian-nation-tree-of-peace`[^oneida] | Oneida Indian Nation | traditional story, not yet read | nation government | | not yet assessed |
| `ltbb-reviving-odawa-peacemaking`[^ltbb] | Little Traverse Bay Bands of Odawa Indians | community voices, long | nation court | | yes |
| `kake-guwakaan-deer-people`[^kake] | Organized Village of Kake | teaching in the Tribe's code, a paragraph | nation government | the code calls Guwakaan a sacred clan | no |
| `tlingit-law-and-peace-ceremonies`[^shi-books][^shi-exhibit][^juneau] | Tlingit (regional Tribe's profile used) | historical account, book | Native institution; Tlingit author | ask about clan ownership | yes |
| `navajo-nation-journey-narrative-and-the-courts`[^nn-guide] | Navajo Nation | teaching, a paragraph | nation court | | no |
| `navajo-peacemaking-paternity-account`[^tcj] | Navajo Nation | program story, short | outside recorder | | no |
| `hopi-clan-land-dispute-ross-v-sulu`[^ross][^hopi-cpo] | Hopi Tribe | court opinion, long | nation court | stories published without permission | no |
| `tohono-oodham-lopez-my-story`[^lopez] | Tohono O'odham Nation | oral history, long | member author | | yes (excerpt) |
| `lakota-wolakota-leaders-mediate`[^rosebud][^wolakota-sr] | Rosebud Sioux Tribe; Standing Rock Sioux Tribe | teaching, short | nation government | | yes |
| `omaha-umonhon-oglala-peace`[^othrp] | Omaha Tribe of Nebraska | historical account, book | Native institution | book has a section on the sacred | yes (excerpt) |
| `southern-ute-peace-with-the-spanish`[^ute] | Southern Ute Indian Tribe | historical account, book | nation government | | no |
| `cherokee-nation-reunification-1839`[^cn-history][^cn-culture] | Cherokee Nation | historical account, a paragraph | nation government | ceremonial life not shared publicly | no |
| `cherokee-tohi-balance`[^motcp] | Eastern Band of Cherokee Indians | teaching, a paragraph | Native institution (relation to the Band not confirmed) | | no |
| `seminole-green-corn-disputes-settled`[^semtribe] | Seminole Tribe of Florida | one published fact | nation | ceremonial; undisclosed places; spring | no |
| `native-hawaiian-hooponopono-family-legacy`[^paglinawan][^nana] | Native Hawaiian community (not a tribe) | oral history, short | Native institution | | yes |
| `round-valley-yurok-treaty-of-friendship`[^rvit] | Round Valley Indian Tribes; Yurok Tribe | present-day agreement, a paragraph | nation government | | yes (the treaty text, if both agree) |
| `coeur-dalene-1858-treaty-of-friendship`[^cda] | Coeur d'Alene Tribe | historical account, a paragraph | nation government | | no |

**What the catalog shows (project analysis).**

- **Peace between nations is what nations publish most.** Six of the
  twenty records concern peace or agreement between nations, from the Great
  Peace and the Two Row Wampum to a Treaty of Friendship signed in 2025.
  Stories about a quarrel between two people are rare on the web; the ones
  found are in a memoir, a magazine account and a court's community
  interviews.
- **Courts and codes are a source of stories.** The Kake code opens with the
  Tribe's own account of where its peacemaking comes from (§ 1.01.010; the
  words are held privately because the code is Tribal law), and the Navajo
  Judicial Branch writes that "[t]he history of our judiciary begins in our
  ancient history."[^kake][^nn-guide]
  The Hopi Appellate Court's decision shows a court sending a clan dispute
  back to the village.[^ross]
- **Several nations tell the same lesson about the mediator.** The Lakota
  Wolakota teaching, which two nations publish, says: "Leaders should always
  look for a compromise between two irreconcilable forces. Never take sides
  because a leader should be able to mediate in order to make the best
  decision for the people."[^rosebud][^wolakota-sr] This is the
  closest thing in the catalog to a nation's own statement of a mediator's
  duty. It is one teaching from one people, not a general Native view.

## 4. Anthology shortlist and whose permission each needs

These are candidates only. Nothing has been asked. The record for each holds
the details.

| Candidate | Copyright | Cultural authority | Notes |
| --- | --- | --- | --- |
| Two Row Wampum (Onondaga) | Onondaga Nation | Onondaga Nation Council of Chiefs | Short and complete. |
| The founding of the Great Peace (Onondaga) | Onondaga Nation | Onondaga Nation Council of Chiefs | Other Haudenosaunee nations tell it too; ask whether the Nation prefers its text be paired with theirs. |
| Wolakota: Code of Behavior | Rosebud Sioux Tribe; Standing Rock Sioux Tribe | the same | Short; about the mediator's role. |
| Reviving Odawa peacemaking (LTBB) | LTBB Judicial Branch; the quoted paper's author | LTBB Judicial Branch | Community members' voices. |
| Tlingit law and peace ceremonies (Worl 2020) | Sealaska Heritage Institute | Sealaska Heritage Institute, on whether a clan must also agree | Read the booklet first. |
| Umonhon and Oglala peace (OTHRP) | Omaha Tribal Historical Research Project | Omaha Tribe of Nebraska | Excerpt; leave out the section on the sacred. |
| My Story (Danny Lopez) | the author's family or estate; AILDI | Tohono O'odham Nation (office to identify) | Excerpt on settling matters the traditional way. |
| Hoʻopono family legacy | Liliʻuokalani Trust | the teller | Native Hawaiian section, labeled as not a tribe. |
| Treaty of Friendship (Round Valley and Yurok) | both nations | both nations | The treaty text, if both agree. |

Two published anthologies show that a collection like this can be done and
how it was framed: *Justice as Healing*, from Living Justice Press, and
*Navajo Nation Peacemaking*, from the University of Arizona Press, whose page
offers reprint licenses.[^mccaslin][^nielsen-zion] Neither was read beyond
the publisher's page, so whether their contributors wrote about their own
nations is not yet known.

## 5. What the stories say about protocols

The sources themselves state the rules a collection must follow (project
analysis of the statements cited):

- **The Hopi Tribe** says that many Hopi stories told to outsiders were
  published without the storytellers' permission.[^hopi-cpo] No Hopi story
  is described here.
- **The Cherokee Nation** says much of the spiritual and ceremonial side of
  traditional Cherokee life is not shared publicly.[^cn-culture] The
  **Chickasaw Nation** describes its oral histories as "sacred
  stories."[^chickasaw] The **Haudenosaunee Confederacy** says wampum had "a
  more sacred use."[^hcf-wampum]
- **The Seminole Tribe of Florida** publishes that disputes are settled
  during the Green Corn Dance, held each spring at undisclosed
  places.[^semtribe] The project records that one fact and nothing about the
  ceremony.
- **The Organized Village of Kake** calls Guwakaan a sacred clan, and also
  says no one can own the process of peacemaking.[^kake]
- **Local Contexts** gives communities their own Labels for seasonal,
  sacred and permission conditions.[^tk-labels] The schema records a Label
  only when a community applies it (charter, commitment 5).[^charter-5]

No source read stated a seasonal rule for any story in the catalog, so no
seasonal protocol was recorded for one. That is a statement about the pages
read, not about the stories; asking each nation is the only way to know
(project analysis).

## 6. Leads that are not stories yet

Program pages that describe a nation's peacemaking or traditional court but
tell no story: the Colville Peacemaker Circle, the Wilton Rancheria
Traditional Court, the Ho-Chunk Traditional Court and the Yurok Tribal
Court.[^colville][^wilton][^ho-chunk][^yurok] Each is a place to ask for a
story the nation chooses to share. Others to follow:

- **Navajo Nation:** the Judicial Branch's "History of Peacemaking" page and
  the Navajo Supreme Court's *Manning v. Abeita*, which a blog summary says
  quotes a teaching about the family and the hogan.[^nn-guide] Both are on
  the pull list.
- **Anishinaabe law:** Matthew L.M. Fletcher's article uses Anishinaabe
  stories, some from anthropologists' reports, on how communities answered
  killings and revenge.[^fletcher] Read before deciding whether it belongs;
  some stories it discusses may be sensitive.
- **Alaska:** Sealaska Heritage Institute's War and Peace exhibit and the film
  *Haa Shagoon*;[^juneau] Yup'ik elders' teachings collected with the Calista
  Elders Council (on the pull list).

## 7. Gaps and next steps

- **Not reached or blocked** (see both session logs): Mohegan, Penobscot,
  Oneida Nation of Wisconsin, Seneca, Tuscarora, Siletz, Swinomish, Zuni,
  the Eastern Band's own sites, the Yurok code site, the Sault Ste. Marie
  Tribe, the Mille Lacs Band, Nambé Pueblo and others. The lead author
  offered on Nov. 21, 2026 to check blocked pages by hand.
- **Ask, do not search.** The richest stories are likely to come from asking
  the nations' cultural offices and peacemaking programs, through the
  contributor intake forms, rather than from the web (project analysis). The
  second search, which found program pages far more often than stories,
  supports this.
- **Pulls.** Nine items are in section 10 of the project's single Westlaw
  list.

## 8. Second search: more nations

The lead author approved a second search on Nov. 21, 2026, for Haudenosaunee
and Wabanaki nations, Anishinaabe nations in Michigan, Minnesota and
Wisconsin, Pomo and Oregon coast nations, and the Pueblos. Method and limits
are in the session log,
[2026-11-21-peacemaking-stories-second-sweep](../sessions/2026/2026-11-21-peacemaking-stories-second-sweep.md).
It added seven stories, each quoted in the teller's own words:

| Record | Nation | Kind | Teller's voice | Anthology |
| --- | --- | --- | --- | --- |
| `red-lake-nation-dakota-seek-peace`[^red-lake] | Red Lake Nation | historical account, two sentences | nation government | no |
| `cayuga-nation-great-law-and-canandaigua`[^cayuga] | Cayuga Nation | historical account, short | nation government | no |
| `saint-regis-mohawk-rekindled-fire-1888`[^srmt] | Saint Regis Mohawk Tribe | historical account, a paragraph | nation government | no |
| `ctclusi-peacegiving-court-second-restoration`[^clusi] | Confederated Tribes of Coos, Lower Umpqua and Siuslaw Indians | program story, short | nation newspaper | yes |
| `cow-creek-xaawiisaa-go-between`[^cow-creek] | Cow Creek Band of Umpqua Tribe of Indians | teaching, two sentences | nation government | no |
| `jemez-pecos-welcome-1838`[^jemez-pecos][^jemez-history] | Pueblo of Jemez | historical account, short | nation cultural office | yes (the 1838 section only) |
| `taos-pueblo-abeyta-water-negotiations`[^taos] | Pueblo of Taos | historical account, a paragraph | nation government | no |

**What the second search shows (project analysis).**

- **A court's founding can be its own story.** The Coos, Lower Umpqua and
  Siuslaw newspaper calls the Peacegiving Court's founding "a second
  restoration," after federal restoration in 1984, and Judge Don Costello
  says it "was a joint effort of our Tribe and members of the Coquille Indian
  Tribe."[^clusi] This is the clearest account found so far of a community
  telling how it built its own peacemaking forum.
- **Old roles come back under their own names.** Cow Creek writes that in
  historical accounts its peacemakers "are referenced as ' xaawiisaa ,' or
  'go-between.'"[^cow-creek] (Spacing as on the page.)
- **Welcome after consultation.** The Pueblo of Jemez's cultural office
  writes that "[a]fter a long consultation with the Jemez leaders the P`ǽ
  kish were welcomed and accepted by their kin."[^jemez-pecos] The same
  page goes on to ceremonial matters, which the project does not describe.
- **Pueblo sites say little about resolving disputes.** None of the Pueblo
  pages reached described peacemaking or a traditional dispute process; the
  courts' pages describe procedure. That is a fact about the pages, not
  about the Pueblos.

**Leads from the second search.** Program pages with no story: the Little
River Band's Peacemaking program (on hold, per the page), the Leech Lake
Band's Bamenim Anishinaabeg program, the Klamath Tribes' Peacemaker Court,
the Coos, Lower Umpqua and Siuslaw Peacegiving Court page, and the Northern
California Intertribal Court. The Ogichidaa Storytellers' education materials
on the Healing Circle Run, among Ojibwe nations after the treaty-rights
conflicts, need a confirmed publisher before a record is made. The Mi'kmaq
Nation's StoryMap journals ask for permission before any use.

[^charter-4]: [Charter, commitment 4](../../docs/charter.md#4-consultation-before-publication).
[^charter-5]: [Charter, commitment 5](../../docs/charter.md#5-cultural-knowledge-and-restricted-material).
[^protocols]: First Archivist Circle, *Protocols for Native American Archival Materials* (2007), [www2.nau.edu](https://www2.nau.edu/libnap-p/protocols.html) (accessed Nov. 21, 2026). Source record: `first-archivist-circle-2007-protocols`.
[^onondaga-history]: *History*, Onondaga Nation, [onondaganation.org](https://www.onondaganation.org/history/) (last visited Nov. 21, 2026). Source record: `onondaga-nation-history-page`.
[^two-row]: *Two Row Wampum – Gaswéñdah*, Onondaga Nation, [onondaganation.org](https://www.onondaganation.org/culture/wampum/two-row-wampum-belt-guswenta/) (last visited Nov. 21, 2026). Source record: `onondaga-nation-two-row-wampum-page`.
[^onondaga-timeline]: *Timeline*, Onondaga Nation, [onondaganation.org](https://www.onondaganation.org/history/timeline/) (last visited Nov. 21, 2026). Source record: `onondaga-nation-timeline-page`.
[^onondaga-wampum]: *Wampum*, Onondaga Nation, [onondaganation.org](https://www.onondaganation.org/culture/wampum/) (last visited Nov. 21, 2026). Source record: `onondaga-nation-wampum-page`.
[^hcf-wampum]: *Wampum*, Haudenosaunee Confederacy, [haudenosauneeconfederacy.com](https://www.haudenosauneeconfederacy.com/wampum/) (last visited Nov. 21, 2026). Source record: `haudenosaunee-confederacy-wampum-page`.
[^oneida]: *Stories & Heritage*, Oneida Indian Nation, [oneidaindiannation.com](https://www.oneidaindiannation.com/stories-and-heritage) (last visited Nov. 21, 2026). Source record: `oneida-indian-nation-stories-and-heritage-page`.
[^ltbb]: *Anishinabe Justice and Peacemaking Traditions*, Little Traverse Bay Bands of Odawa Indians Judicial Branch, [ltbbodawa-nsn.gov](https://ltbbodawa-nsn.gov/judicial-branch/peacemaking/anishinabe-justice-and-peacemaking-traditions/) (last visited Nov. 21, 2026). Source record: `ltbb-anishinabe-justice-and-peacemaking-traditions`.
[^kake]: Organized Village of Kake, Keex' Kwaan Peacemaking Code § 1.01.010 (adopted July 2024), [kake-nsn.gov](https://kake-nsn.gov/wp-content/uploads/2026/03/Judicial-Peacemaking-Code.pdf) (accessed Nov. 21, 2026). Source record: `kake-keex-kwaan-peacemaking-code-2024`.
[^shi-books]: *SHI's Archives and Collections Department*, Sealaska Heritage Institute, [sealaskaheritage.org](https://sealaskaheritage.org/?p=5459) (last visited Nov. 21, 2026) (describing Rosita Worl, *Tlingit Law, American Injustice, and the Destruction of Tlingit Villages* (Sealaska Heritage 2020)). Source record: `sealaska-heritage-institute-publications-page`.
[^shi-exhibit]: Press Release, Sealaska Heritage Institute, SHI to Unveil Virtual Version of Exhibit (June 2, 2021), [sealaskaheritage.org](https://sealaskaheritage.org/?p=16574). Source record: `sealaska-heritage-2021-war-and-peace-virtual-exhibit`.
[^juneau]: Michael Lockett, *A Wound Still Bleeding: New Exhibit Lays Bare War and Peace in the Southeast*, Juneau Empire (Dec. 8, 2019), [juneauempire.com](https://www.juneauempire.com/news/a-wound-still-bleeding-new-exhibit-lays-bare-war-and-peace-in-the-southeast). Source record: `juneau-empire-2019-war-and-peace-exhibit`.
[^nn-guide]: Judicial Branch of the Navajo Nation, *Courts & Peacemaking in the Navajo Nation: A Public Guide*, [courts.navajo-nsn.gov](https://courts.navajo-nsn.gov/publicguide.htm) (last visited Nov. 21, 2026). Source record: `navajo-nation-judicial-branch-courts-and-peacemaking`. *Manning v. Abeita* was seen only through a summary on the Turtle Talk blog, [turtletalk.blog](https://turtletalk.blog/tag/manning-v-abeita/); it has no source record yet.
[^tcj]: Sharon Witmer, *Making Peace, the Navajo Way*, Tribal College J., Summer 1996, [tribalcollegejournal.org](https://tribalcollegejournal.org/making-peace-navajo/). Source record: `tribal-college-journal-1996-making-peace-navajo-way`.
[^ross]: *Ross v. Sulu*, No. AP-010-88 (Hopi App. Ct.) (date not shown on the copy), [tribal-institute.org](https://www.tribal-institute.org/cases/hopi/format_editing/ross.htm). Source record: `ross-v-sulu-hopi-appellate-court`.
[^hopi-cpo]: *Hopi Cultural Preservation Office*, The Hopi Tribe, [hopi-nsn.gov](https://www.hopi-nsn.gov/hopi-cultural-preservation/) (last visited Nov. 21, 2026). Source record: `hopi-cultural-preservation-office-page`.
[^lopez]: Danny Lopez, *My Story*, American Indian Language Development Institute, [aildi.arizona.edu](https://aildi.arizona.edu/sites/default/files/aildi-30-year-book-12-danny-lopez-my-story.pdf) (accessed Nov. 21, 2026). Source record: `lopez-my-story-aildi`.
[^rosebud]: *History & Culture*, Rosebud Sioux Tribe, [rosebudsiouxtribe-nsn.gov](https://www.rosebudsiouxtribe-nsn.gov/history-culture) (last visited Nov. 21, 2026). Source record: `rosebud-sioux-tribe-of-the-rosebud-india-history-culture`.
[^wolakota-sr]: Standing Rock Sioux Tribe, *Wolakota [the Lakota Way]: Information for Participants* (2024), [standingrock.org](https://standingrock.org/wp-content/uploads/2024/06/Wolakota-Information-for-ParticipantsEnglish.pdf). Source record: `standing-rock-wolakota-information-for-participants`.
[^othrp]: Omaha Tribal Historical Research Project, Inc., *Dancing for Peace* (2019), [omahatribe.com](https://omahatribe.com/wp-content/uploads/2025/01/DANCING-FOR-PEACE-1.pdf). Source record: `othrp-2019-dancing-for-peace`.
[^ute]: James Jefferson, Robert W. Delaney & Gregory C. Thompson, *The Southern Utes: A Tribal History* (Floyd A. O'Neil ed., Southern Ute Tribe 1972), [southernute-nsn.gov](https://www.southernute-nsn.gov/wp-content/uploads/sites/15/2025/10/The_Southern_Utes_A_Tribal_History-1.pdf). Source record: `jefferson-delaney-thompson-1972-southern-utes`.
[^cn-history]: *Cherokee Nation: History*, Cherokee Nation, [cherokee.gov](https://www.cherokee.gov/about-the-nation/history/) (last visited Nov. 21, 2026). Source record: `cherokee-nation-history-page`.
[^cn-culture]: *Cherokee Nation: Culture*, Cherokee Nation, [cherokee.gov](https://www.cherokee.gov/about-the-nation/culture/) (last visited Nov. 21, 2026). Source record: `cherokee-nation-culture-page`.
[^motcp]: *Cherokee History*, Museum of the Cherokee People, [motcp.org](https://motcp.org/learn/cherokee-history/) (last visited Nov. 21, 2026). Source record: `museum-of-the-cherokee-people-cherokee-history-page`.
[^semtribe]: *Green Corn Dance*, Seminole Tribe of Florida, [semtribe.com](https://www.semtribe.com/culture/green-corn-dance) (last visited Nov. 21, 2026). Source record: `seminole-tribe-of-florida-green-corn-dance-page`.
[^chickasaw]: *The Voices of Our Ancestors*, Chickasaw.tv, [chickasaw.tv](https://www.chickasaw.tv/episodes/winter-fire-season-1-episode-2-the-voices-of-our-ancestors) (last visited Nov. 21, 2026). Source record: `chickasaw-tv-winter-fire-voices-of-our-ancestors`.
[^paglinawan]: Kaʻaiʻai Paglinawan, *How the Hoʻopono Program Became a Family Legacy for Kaʻaiʻai Paglinawan*, Liliʻuokalani Trust (Sept. 9, 2024), [onipaa.org](https://onipaa.org/columns/how-the-hoopono-program-became-a-family-legacy-for-kaaiaiai-paglinawan). Source record: `liliuokalani-trust-2024-hoopono-family-legacy`.
[^nana]: Mary Kawena Pukui, E.W. Haertig & Catherine A. Lee, *Nānā I Ke Kumu (Look to the Source)*, vol. 1 (Hui Hānai 1972). Source record: `pukui-haertig-lee-1972-nana-i-ke-kumu-1`.
[^rvit]: *Round Valley Indian Tribes, Yurok Tribe Signs Landmark Treaty*, Round Valley Indian Tribes (Apr. 30, 2026), [rvit.org](https://www.rvit.org/news-story/round-valley-indian-tribes-yurok-tribe-signs-landmark-treaty-2026). Source record: `rvit-2026-yurok-treaty-of-friendship`.
[^cda]: *Coeur d'Alene Tribe* (home page timeline), [cdatribe-nsn.gov](https://www.cdatribe-nsn.gov/) (last visited Nov. 21, 2026). Source record: `cdatribe-nsn-home`.
[^mccaslin]: *Justice as Healing: Indigenous Ways* (Wanda D. McCaslin ed., Living Justice Press 2005). Source record: `mccaslin-2005-justice-as-healing`.
[^nielsen-zion]: *Navajo Nation Peacemaking: Living Traditional Justice* (Marianne O. Nielsen & James W. Zion eds., 2005). Source record: `nielsen-zion-2005-navajo-nation-peacemaking`.
[^tk-labels]: *TK Labels*, Local Contexts, [localcontexts.org](https://localcontexts.org/labels/traditional-knowledge-labels/) (last visited Nov. 21, 2026). Source record: `local-contexts-tk-labels`.
[^colville]: *Peacemaker Circle*, Confederated Tribes of the Colville Reservation, [cct-pmc.com](https://www.cct-pmc.com/peacemaker-circle) (last visited Nov. 21, 2026). Source record: `colville-peacemaker-circle-page`.
[^wilton]: *Tribal Court*, Wilton Rancheria, [wiltonrancheria-nsn.gov](https://www.wiltonrancheria-nsn.gov/tribal-government/tribal-court/) (last visited Nov. 21, 2026). Source record: `wilton-rancheria-tribal-court-page`.
[^ho-chunk]: *Traditional Court*, Ho-Chunk Nation, [ho-chunknation.com](https://ho-chunknation.com/government/judicial-branch/courts/traditional-court-2/) (last visited Nov. 21, 2026). Source record: `ho-chunk-traditional-court-page`.
[^yurok]: *Tribal Court*, Yurok Tribe, [yuroktribe.org](https://www.yuroktribe.org/tribal-court) (last visited Nov. 21, 2026). Source record: `yurok-tribe-tribal-court-page`.
[^fletcher]: Matthew L.M. Fletcher, *Anishinaabe Law and the Round House*, Alb. Gov't L. Rev. (volume and page to confirm), [albanygovernmentlawreview.org](https://www.albanygovernmentlawreview.org/api/v1/articles/23983-anishinaabe-law-and-the-round-house.pdf). Source record: `fletcher-anishinaabe-law-and-the-round-house`.
[^red-lake]: *Tribal History & Historical Photos*, Red Lake Nation, [redlakenation.org](https://www.redlakenation.org/tribal-history-historical-photos/) (last visited Nov. 22, 2026). Source record: `red-lake-nation-tribal-history-page`.
[^cayuga]: *History & Culture*, Cayuga Nation, [cayuganation-nsn.gov](https://cayuganation-nsn.gov/history-culture/) (last visited Nov. 22, 2026). Source record: `cayuganation-nsn-history-culture`.
[^srmt]: *Culture and History*, Saint Regis Mohawk Tribe, [srmt-nsn.gov](https://www.srmt-nsn.gov/culture-and-history) (last visited Nov. 22, 2026). Source record: `saint-regis-mohawk-tribe-culture-and-history-page`.
[^clusi]: *41st Restoration Celebration Puts Spotlight on 20th Anniversary of Peacegiving Court*, The Voice of CLUSI (Confederated Tribes of Coos, Lower Umpqua & Siuslaw Indians), Nov. 2025, at 1, [ctclusi.org](https://ctclusi.org/wp-content/uploads/2025/10/FINAL-November-2025-for-web.pdf). Source record: `ctclusi-2025-voice-peacegiving-court-anniversary`.
[^cow-creek]: *Mark Your Calendars: Peacemaker Training Session*, Cow Creek Band of Umpqua Tribe of Indians, [cowcreek-nsn.gov](https://www.cowcreek-nsn.gov/mark-your-calendars-peacemaker-training-session/) (last visited Nov. 22, 2026). Source record: `cow-creek-peacemaker-training-2024`.
[^jemez-pecos]: Christopher Toya, *Pecos Pueblo History*, Pueblo of Jemez, [jemezpueblo.org](https://www.jemezpueblo.org/about/pecos-pueblo/) (last visited Nov. 22, 2026). Source record: `pueblo-of-jemez-about-pecos-pueblo`.
[^jemez-history]: *History and Culture*, Pueblo of Jemez, [jemezpueblo.org](https://www.jemezpueblo.org/about/history-and-culture/) (last visited Nov. 22, 2026) (text credited to William Whatley, 1993, edited by the Pueblo of Jemez Administration). Source record: `jemez-history-and-culture`.
[^taos]: *Water Rights*, Taos Pueblo, [taospueblo.com](https://taospueblo.com/community/water-rights/) (last visited Nov. 22, 2026). Source record: `pueblo-of-taos-water-rights-page`.
