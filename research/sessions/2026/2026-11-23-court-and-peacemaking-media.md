---
id: 2026-11-23-court-and-peacemaking-media
date: '2026-11-23'
researchers:
- Claude (AI assistant)
tools:
- kind: web-search
  name: AI lookup helpers (Claude Haiku)
  detail: Six helpers searched the web and read pages for the 61 nations whose profiles record a peacemaking forum, about ten nations each, and a seventh swept the web for any nation's court or peacemaking channel. A shared page-fetch limit (100 an hour) stopped them early, so many pages went unread on this pass.
- kind: page-fetch
  name: curl
  detail: A second pass read the unread pages and every candidate's page with plain curl (default user agent, no media downloaded) and checked each YouTube video with YouTube's oEmbed listing. Sites that answered with a bot check or HTTP 403 were recorded as blocked, not retried another way.
- kind: ai-assistant
  name: Claude (AI assistant, Sonnet and Opus)
  detail: Checked the candidates' rights lines and subjects for batches 4 to 6 and the sweep (Sonnet) and for batches 1 to 3 (Opus, the thread's lead session), dropped items not about a court or peacemaking, and wrote the search logs and the candidate list.
purpose: Find videos, sound recordings and pictures made by or about Native nations' own courts, peacemaking programs and wellness courts for the website's Picture, Video and Audio blocks, with each item's reuse terms (Trevor Goldsmith, 2026-11-23, decision card "Courts and peacemaking media", chosen over a search for a picture of every nation).
queries:
- For each nation, web searches for "<nation> peacemaking video", "<nation> tribal court" with youtube, and "<nation> peacemaking podcast"
- The court and peacemaking links and the website on each profile, read for embedded video, audio, galleries, channel links and the rights line
- Sweep searches such as "tribal court" youtube channel, "peacemaking program" tribe video, "healing to wellness court" tribe video and "tribal court" podcast
- The Native American Rights Fund's peacemaking video page, the Harvard tribal justice toolbox watch page and the Native Nations Institute talk pages
limits: Fifteen nations are only partly searched because their sites refused automated requests or did not answer (listed in their search logs). Videos were identified from titles, listings and page text; none was watched. Rights lines were read on 2026-11-23 and can change. Facebook pages and whole YouTube channels were not browsed.
---

# Court and peacemaking media from Native nations

This session looked for media about the courts and peacemaking programs of the 61 nations whose profiles record a peacemaking forum, and swept the web for any other nation's court or peacemaking channel. The results are in the [candidate list](../../media/2026-11-23-court-and-peacemaking-media-candidates.md), and each nation's places and outcomes are in its [court-media search log](../../search-logs/court-media/).

Of the 61 nations, 19 have at least one candidate, 27 had nothing on the pages read, and 15 are only partly searched. The search found 21 candidates for those nations and 2 more from the sweep. The one public-domain item is the Office for Victims of Crime's film on the Leech Lake Tribal Court. Most of the other video is talks posted by organizations (the Native American Rights Fund, the National American Indian Court Judges Association and the Native Nations Institute), which the website may embed but not copy. Pictures on nations' own court pages need the nation's permission.

What was ruled out: ceremonies, songs and prayers; powwow, tourism, casino and general culture media; livestreams of hearings; sealed juvenile and child welfare listings; and videos that only mention a nation. Each is noted in the candidate list or the nation's search log.

The first pass ran out of the shared page-fetch allowance after a few pages per nation, the same limit the second seal collection met on 2026-11-22. Plain curl in the lead session does not count against it, so later searches of this kind should read pages that way from the start.
