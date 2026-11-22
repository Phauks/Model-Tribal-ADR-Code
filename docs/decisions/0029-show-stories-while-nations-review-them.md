# 0029. Show story records on the website while their nations review them

- **Status:** Accepted (lead author, Nov. 22, 2026)
- **Date:** 2026-11-22
- **Amends:** [0019](0019-story-records.md), for website display only

## Context

Decision record 0019 set up story records and marked every one gathered so far `nation-review-first`, which the shared schema defines as "held until the nation's office has reviewed it."[^common] Under that rule the website could show none of the 27 records in `content/stories/`, and 0019 left showing them to later website work.[^0019]

On Nov. 22, 2026 the lead author asked to "add them all for now" so that he can review them on the website itself, rather than in a table.[^request] The records quote only short passages from material the nations and their people have already published, and most tellings come from the nation's own government, court, cultural office or newspaper. The charter still promises that a nation may correct, restrict or withdraw material about it (commitment 6), and that community-held or ceremonial knowledge is not added without the community's written approval (commitment 5).[^charter]

## Decision

- **Shown while the review is pending.** On the website, a story whose access is `nation-review-first` is shown, with a notice at the top of its page that the nation has not reviewed it yet. The record keeps its access level and review status: nothing in the record changes until the nation answers, and the notice goes away when the review status becomes `reviewed-by-nation` or `approved-by-nation`.
- **Only published tellings.** This applies only to tellings that cite a published source record. A telling that reached the project from a person, through a contributor filing, stays held until its access is `public`, because the contributor agreed only to what the filing says ([0020](0020-file-every-contribution-from-a-person.md)).
- **Never shown.** A story or telling marked `restricted` is never shown, exported, cached offline or listed in search. One marked `embargoed` is shown only from its `until` date, on the first build after it. A story whose review status is `withdrawn-at-request` is not shown.
- **The rest of 0019 stands.** The project does not retell or summarize a story. A page quotes excerpts of 50 words or fewer in the teller's exact words, each with the teller's credit and a pinpoint, and only where the telling's permitted uses allow quotation. An excerpt held privately (Tribal law, a court opinion, or a publisher that asks to be asked first) appears as its pinpoint and a link to the telling, never as text. Protocols are shown with how the site follows them.
- **A removal link on every story.** Each story page links to the request form with the story named, so a nation, teller or reader can ask for it to be removed. As with any request to restrict or remove, the story is taken out of public view before the request is reviewed ([requests.md](../requests.md)).
- **Citations in a Sources section.** Each page lists its sources at the end, each followed by the parts of the page it supports, as nation and glossary pages do.
- **New records appear on their own.** The pages are built from `content/stories/` when the site is built, so a new record shows up on the next build with no other change. The rules above are in `site/src/lib/story-visibility.ts`, with tests.

This decision covers the website only. The print edition, ebook and any future data export still treat `nation-review-first` as held, until a later decision says otherwise.

## Consequences

- The lead author can review every story where readers will see it, and mark individual records `restricted`, change them or delete them by pull request.
- Stories go public before their nations have seen them. That risk is what the notice, the removal link and the hold on contributor material are for. Outreach to each nation should name the stories about it and ask for review (charter, commitment 4).
- A reader can tell at a glance which stories a nation has reviewed.

## Sources

[^common]: [`schemas/common.schema.json`](../../schemas/common.schema.json), `$defs.accessLevel`.
[^0019]: [Decision record 0019](0019-story-records.md), "Consequences."
[^request]: Lead author, message in the project's story thread, Nov. 22, 2026 (project records).
[^charter]: [Charter, commitments 4 to 6](../charter.md).
