---
id: 2026-11-21-peacemaking-stories-second-sweep
date: 2026-11-21
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: >-
    The lead author approved a second search for nations the first stories
    session did not reach. The lead session gave four research helpers on a
    smaller model the first session's written rules, changed so that each
    helper copied up to two exact passages of 50 words or fewer from each page
    instead of describing the story (the project quotes stories, never retells
    them, decision record 0019). The lead session checked every passage
    against the saved page by script: all matched except two from a
    newspaper PDF whose layout extraction ran columns together, which matched
    once the PDF was extracted again in reading order. It then chose which
    items are stories and wrote the records.
- kind: web-search
  name: Web search
- kind: page-fetch
  name: Direct downloads (curl) with PDF text extraction (pdftotext)
  detail: >-
    Sites that refused automated requests (HTTP 406) were not pursued: the
    Sault Ste. Marie Tribe of Chippewa Indians, the Mille Lacs Band of Ojibwe
    and Nambé Pueblo. Many other addresses failed to connect, but most were
    guessed by the helpers and may not be the nations' real sites, so they
    say nothing about those nations.
purpose: >-
  Extend the first catalog of Native nations' stories about resolving disputes
  and making peace (session 2026-11-21-peacemaking-stories) to Haudenosaunee
  and Wabanaki nations, Anishinaabe nations in Michigan, Minnesota and
  Wisconsin, Pomo and Oregon coast nations, and the Pueblos.
queries:
- <nation> history OR culture OR peacemaking OR "tribal court" site:<nation's domain> (one or more per nation)
- <nation> Tribal newspaper peacemaking OR peacegiving
- Pueblo history page consultation OR welcomed OR settlement site:<Pueblo's domain>
sources_added:
- red-lake-nation-tribal-history-page
- saint-regis-mohawk-tribe-culture-and-history-page
- ctclusi-2025-voice-peacegiving-court-anniversary
- pueblo-of-taos-water-rights-page
sources_updated:
- cayuganation-nsn-history-culture
- cow-creek-peacemaker-training-2024
- jemez-history-and-culture
- pueblo-of-jemez-about-pecos-pueblo
limits: >-
  A second pass of what nations publish on the open web, about forty fetches
  per region. Pueblo sites in particular say little about dispute resolution,
  which fits the first session's caution that many nations keep this
  knowledge off the web on purpose; "none found" says nothing about whether a
  nation has such stories. The Oneida Indian Nation's Tree of Peace piece was
  still not reached: the landing page's saved copy has no link to it,
  probably because the page builds its links with scripts. The lead author
  offered to check blocked pages by hand.
---

## What this session added

- Seven story records in `content/stories/`, from seven nations, with eleven excerpts in the tellers' own words, each with a pinpoint and fingerprint. None is held privately: none of the tellings is Tribal law, a court opinion or from a publisher that asks to be asked first.
- Four new source records and four updated ones (rights now record short quotation; `found_in` adds this session).
- Section 8 of [research/analyses/2026-11-21-peacemaking-stories.md](../../analyses/2026-11-21-peacemaking-stories.md).

## Excluded on purpose

- **Tuscarora Nation of North Carolina:** a helper found its history page while looking for the Tuscarora Nation of New York. The project's profile lists the North Carolina group as unrecognized, and the project includes such groups only when they add something to dispute resolution; this page is an account of war and treaties, so no record was made.
- **Passamaquoddy Tribe:** the Tribe's site reposts a 1794 Massachusetts record and an outside historian's essay. Neither is the Tribe's own telling.
- **Mi'kmaq Nation StoryMap journals:** the page says permission is needed to use any part of them. They were not read.
- **Ogichidaa Storytellers, *Every Step: A Healing Circle*:** education materials about the Healing Circle Run among Ojibwe nations. The publisher is not named in the saved copy, so it is a lead until the publisher is confirmed.
- **Program and court pages without a story** (Little River Band, Leech Lake Band, Red Cliff Band, Klamath Tribes, Dry Creek Rancheria, the Northern California Intertribal Court, the Isleta, Zia and Pojoaque courts) are listed in the analysis as leads.
- **Accounts of war or displacement without a peace** (Santa Ana and Ysleta del Sur histories of the 1680 Pueblo Revolt; the Coos, Lower Umpqua and Siuslaw Peace Hike notice) were not recorded as stories.
