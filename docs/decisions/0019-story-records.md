# 0019. Record stories in their tellers' own words, with credit, permissions and protocols

- **Status:** Accepted (lead author, Nov. 21, 2026); website display amended by [0029](0029-show-stories-while-nations-review-them.md) and [0034](0034-show-stories-in-full-where-rights-allow.md); scope widened by [0063](0063-widen-stories-to-law-justice-and-governance.md); sacred and ceremonial rule replaced for published public-domain texts by [0065](0065-take-in-public-domain-myths-and-religious-texts.md)
- **Date:** 2026-11-21

## Context

The lead author asked on Nov. 21, 2026 to gather Native nations' stories about resolving disputes, mediation and peacemaking, of every length and from many nations, for cultural context in the essays and book and as possible anthology chapters. He asked that each story be cited directly to its source and that the project settle on a file format for attributing them.

A story is not like the project's other sources. It can be free to quote under copyright law and still belong to a clan or family, be told only in one season, or need a cultural authority's approval before anyone retells it. The charter already says that ceremonial, restricted or community-held knowledge is not added without the community's written approval (commitment 5), and that a nation may correct, restrict or withdraw material about it (commitment 6).[^charter] The *Protocols for Native American Archival Materials* likewise separate legal rights from a community's own rules about who may see and share knowledge.[^protocols] Some stories will also reach the project from people rather than publications, through the contributor intake forms being drafted in a separate thread of the project.

## Decision

- **A story record** (`schemas/story.schema.json`, stored in `content/stories/<letter>/<id>.yaml`) describes one story across all its known tellings. It names the nations and, where given, the community; its kind (an open list); its length; its methods and topics; and excerpts of the story in the teller's own words.
- **Quote, never retell.** The lead author asked on Nov. 21, 2026 that the project not rewrite the stories but cite them directly as they are told. So the project writes no summary or paraphrase of a story. Each excerpt is the telling's exact words with a pinpoint (`locator`), a word count and a SHA-256 fingerprint. Without permission an excerpt is a short passage of 50 words or fewer, quoted only where the telling's rights allow quotation, a limit chosen to stay within fair use (17 U.S.C. § 107; project analysis, not legal advice). Where the rights do not allow it (Tribal law, which the project treats as link-only until a nation says otherwise; a court opinion; or a publisher that asks to be asked first), the exact words are kept in the project's private files and the record carries only the pinpoint and fingerprint. The whole story is reproduced only with permission (`publish-in-full`).
- **Every telling is cited directly.** A telling points to one source record (the nation's page, court opinion, book or recording) or to one private contributor filing (`filing-YYYY-NNNN`), never both. The nation's own telling is listed first. `authority` says whose voice the telling is, from the nation's government, court, cultural office, press or newspaper down to an outside recorder, so a reader can see at a glance how close the telling is to the nation.
- **Credit, permissions and access** use five shapes shared with contributor records, defined once in `schemas/common.schema.json`: `credit` (the form the teller or contributor chose: name, name and nation, role, pseudonym or none), `permitted_uses` (background-only, reference-only, quote or publish-in-full, and where), `access` (public, nation review first, embargoed until a date, or restricted), `cultural_authority` (the role or office that approved sharing) and `filing`. The story's access must be at least as restrictive as its most restrictive telling.
- **Protocols are recorded only when a source states them**: seasonal, setting, teller, clan- or family-owned, ceremonial, sacred, name avoidance or permission required, each with the source that states it and how the project follows it. A story whose content is sacred or ceremonial is recorded, if at all, with no excerpt of that content and with access `restricted`.
- **Anthology candidates** carry who must grant permission, separately for copyright and for cultural authority, even when one office holds both, and where to ask.
- **Validation.** `scripts/validate_records.py` checks that a story's tellings, protocols and titles cite existing source records, its nations and methods exist, its telling ids are unique, the anthology telling is one of its tellings, its access is not looser than any telling's, and each excerpt quotes a telling that allows it, within the word limit, with a fingerprint that matches its words.

## Consequences

- Stories can be cited in essays with `[@source-key]` and quoted in the teller's own words, and listed on a nation's page later. Only short excerpts enter public git history until a nation or publisher grants more.
- A nation's request to restrict or remove a story changes one field, and the website, exports and offline copies follow it (commitment 6).
- Collecting stories is slower: each needs its rights and any protocol checked, and most anthology use needs two permissions.
- The website does not show stories yet. Showing them, including seasonal display, is later website work.

## Sources

[^charter]: [Charter, commitments 5 and 6](../charter.md).
[^protocols]: First Archivist Circle, *Protocols for Native American Archival Materials* (2007), [www2.nau.edu](https://www2.nau.edu/libnap-p/protocols.html) (accessed Nov. 21, 2026).
