# 0063. Widen story records to law, justice and governance

- **Status:** Accepted (lead author, Nov. 27, 2026)
- **Date:** 2026-11-27
- **Amends:** [0019](0019-story-records.md), for what a story record may be about

## Context

Decision record 0019 set up story records for Native nations' stories "about resolving disputes, mediation and peacemaking," because the lead author first asked for those on Nov. 21, 2026.[^0019] The schema was later widened once, to accounts of how a law, treaty, court case or federal policy affected the people who lived under it.[^impact] Meanwhile the lead author decided on Nov. 24, 2026 that the website is a central repository of Native legal information and that its general pages should not single out dispute resolution.[^scope]

On Nov. 27, 2026 the lead author asked: "can you expand the stories section to include stories relating to the law, not just dispute resolution."[^request] An audit of the section found that the 40 records already reached past dispute resolution (treaties, the Two Row Wampum, allotment testimony, boarding school memories), but the page's lead, its description, the home page panel, the search entry and the README still described every story as being about making peace.

## Decision

- **Scope.** A story record may hold any story, account or teaching, as a Native nation or its people tell it, about law, justice or governance. That includes a nation's own laws, councils, courts and leaders; treaties, land and sovereignty; resolving disputes, making peace and restoring relationships; and how federal or state law affected the people who lived under it. Dispute resolution stays one topic among these, recorded in `topics` and `methods` as before.
- **Everything else in 0019 stands.** Quote, never retell; cite every telling directly; record protocols only when a source states them; leave out anything sacred or ceremonial; every story first marked for the nation's review; a nation may restrict or remove any record. Full texts follow decision records 0034 and 0036.
- **Copy.** The Stories page, its description, the home page panel, the search entry, the tag pages and the records' README describe the section as stories about law, justice and governance. The page layout does not change: stories are still listed by nation.
- **Where to look first.** Books and articles by Native authors published before 1931 are in the public domain and can be shown in full without asking; nations' own published histories come next, under decision record 0036. A passage taken from a longer book marks what it leaves out, where it was.

## Consequences

- The first six stories under the wider scope are in session [2026-11-27-stories-about-law](../../research/sessions/2026/2026-11-27-stories-about-law.md) and section 11 of the [stories catalog](../../research/analyses/2026-11-21-peacemaking-stories.md).
- Story records linked to a treaty, statute or case appear on that law's page, as accounts of its effect already do.
- The essays and the model code still draw on the dispute resolution stories; nothing about them changes.

## Sources

[^0019]: [Decision record 0019](0019-story-records.md), Context.
[^impact]: `affected_by` and `account` in [`schemas/story.schema.json`](../../schemas/story.schema.json), added for accounts of the human impact of laws (Nov. 24, 2026).
[^scope]: Lead author, project thread "Broaden the site beyond dispute resolution," Nov. 24, 2026 (project memory).
[^request]: Lead author, project thread "Broaden stories beyond dispute resolution," Nov. 27, 2026.
