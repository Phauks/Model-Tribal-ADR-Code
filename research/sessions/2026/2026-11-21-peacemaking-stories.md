---
id: 2026-11-21-peacemaking-stories
date: 2026-11-21
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: >-
    The lead author asked for Native nations' stories about resolving disputes,
    mediation and peacemaking, of every length and from many nations, cited
    directly to their sources, and for a file format to attribute them. The
    lead session split the work into six regions plus one slice on anthologies,
    court opinions and protocol guides, and gave each to a research helper on a
    smaller model with written rules: prefer what a nation itself published,
    copy no story text, record any stated protocol, and save every page cited.
    The lead session checked each helper's verification quotation against the
    saved pages by script (54 of 56 matched; the two misses were a column-split
    PDF, confirmed by eye, and a Chickasaw timeline claim that the page did not
    support, which was dropped), then searched further itself for Tlingit,
    Navajo and Haudenosaunee sources and wrote the records.
- kind: web-search
  name: Web search
- kind: page-fetch
  name: Direct downloads (curl) with PDF text extraction (pdftotext)
  detail: >-
    Sites that refused automated requests or showed a bot challenge were not
    pursued: Mohegan, Penobscot, Oneida Nation (Wisconsin), Seneca Nation,
    Tuscarora, Siletz, Swinomish, Tule River, Pechanga, Makah, Jamestown
    S'Klallam, Smith River, Zuni, the Eastern Band of Cherokee Indians' sites,
    Caddo, Poarch, Sac and Fox, the Yurok code site, Kake's own site, the
    Navajo Nation Judicial Branch's peacemaking pages and Sealaska Heritage
    Institute's exhibit site.
purpose: >-
  Find stories, accounts and teachings about resolving disputes, making peace
  and restoring relationships that Native nations published or authorized,
  for cultural context in the essays and book and as possible anthology
  chapters; record each one's source, rights, protocols and who would grant
  permission; and propose a record format for attributing stories.
queries:
- <nation> stories peace OR peacemaker OR peacemaking site:<nation's domain> (one search per nation in each region)
- Haudenosaunee Peacemaker Great Law Two Row Wampum Onondaga Nation
- Sealaska Heritage Institute Tlingit peace ceremony War and Peace exhibit
- Navajo Nation Supreme Court opinion peacemaking talk things out
- Yupiit Qanruyutait Yup'ik Words of Wisdom Calista Elders Council
- hoʻoponopono Liliʻuokalani Trust Nānā I Ke Kumu
- Tribal court opinion traditional story; Ho-Chunk Traditional Court; Hopi Appellate Court clan
- Protocols for Native American Archival Materials; Local Contexts TK Labels
sources_added:
- onondaga-nation-history-page
- onondaga-nation-two-row-wampum-page
- onondaga-nation-timeline-page
- onondaga-nation-wampum-page
- haudenosaunee-confederacy-wampum-page
- haudenosaunee-confederacy-story-telling-page
- oneida-indian-nation-stories-and-heritage-page
- ltbb-anishinabe-justice-and-peacemaking-traditions
- kake-keex-kwaan-peacemaking-code-2024
- sealaska-heritage-institute-publications-page
- sealaska-heritage-2021-war-and-peace-virtual-exhibit
- juneau-empire-2019-war-and-peace-exhibit
- hopi-cultural-preservation-office-page
- ross-v-sulu-hopi-appellate-court
- lopez-my-story-aildi
- standing-rock-wolakota-information-for-participants
- othrp-2019-dancing-for-peace
- jefferson-delaney-thompson-1972-southern-utes
- cherokee-nation-history-page
- cherokee-nation-culture-page
- museum-of-the-cherokee-people-cherokee-history-page
- seminole-tribe-of-florida-green-corn-dance-page
- chickasaw-tv-winter-fire-voices-of-our-ancestors
- liliuokalani-trust-2024-hoopono-family-legacy
- pukui-haertig-lee-1972-nana-i-ke-kumu-1
- rvit-2026-yurok-treaty-of-friendship
- first-archivist-circle-2007-protocols
- local-contexts-tk-labels
- mccaslin-2005-justice-as-healing
- fletcher-anishinaabe-law-and-the-round-house
- tribal-college-journal-1996-making-peace-navajo-way
- colville-peacemaker-circle-page
- wilton-rancheria-tribal-court-page
- ho-chunk-nation-traditional-court-page
- yurok-tribe-tribal-court-page
sources_updated:
- navajo-nation-judicial-branch-courts-and-peacemaking
- rosebud-sioux-tribe-of-the-rosebud-india-history-culture
- cdatribe-nsn-home
- nielsen-zion-2005-navajo-nation-peacemaking
- ltbb-judicial-branch-peacemaking-page
limits: >-
  This is a first sweep of what nations publish on the open web. Many nations
  keep their stories off the web on purpose, so "none found" says nothing about
  whether a nation has such stories. Books were read at catalog level only.
  No story text was copied into the repository; the helpers' saved copies stay
  in the session's private scratch space. The Navajo Nation Judicial Branch's
  peacemaking history page, Sealaska Heritage Institute's War and Peace exhibit
  site and the Oneida Indian Nation's Tree of Peace page were not read. Not
  searched for lack of time: Tonawanda, Cayuga, Tuscarora, Passamaquoddy,
  Grand Traverse, Little River, Leech Lake, White Earth, Red Lake, Bay Mills,
  Pomo nations, Coos/Lower Umpqua/Siuslaw and most Pueblos.
---

## What this session added

- A proposed record format for stories (decision record
  [0019](../../../docs/decisions/0019-story-records.md), schema
  `schemas/story.schema.json`), with the credit, permission and access shapes
  agreed with the contributor intake forms thread.
- Twenty story records in `content/stories/`, from eighteen nations and the
  Native Hawaiian community, and thirty-five new source records.
- The catalog and anthology shortlist in
  [research/analyses/2026-11-21-peacemaking-stories.md](../../analyses/2026-11-21-peacemaking-stories.md).
- Nine library and database pulls, added as section 10 of the project's single
  Westlaw list.

## What the helpers found, in brief

Most nations' websites describe peacemaking programs rather than tell
stories. The stories and accounts that nations do publish are mostly about
peace between nations (the Haudenosaunee Great Peace and Two Row Wampum, the
Umonhon and Oglala peace, Ute and Spanish treaties, present-day treaties of
friendship) rather than about settling a quarrel between two people. Nations
that tell stories about everyday disputes tend to do it in books, in elders'
collections and in court opinions, which this sweep reached only at catalog
level (project analysis).

## Excluded on purpose

- A Mescalero Apache origin passage on the Tribe's culture page: it may be
  sacred and the page does not say, so no record was made.
- A Chickasaw.tv timeline entry: the helper reported a 1795 Creek peace that
  the saved page does not state, so it was dropped.
- Program pages without stories (Colville, Wilton, Ho-Chunk, Yurok, Grand
  Ronde, Umatilla, Blue Lake) are listed in the analysis as leads, not as
  stories.
