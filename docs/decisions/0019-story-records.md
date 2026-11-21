# 0019. Record stories as pointers with credit, permissions and protocols, never as text

- **Status:** Proposed
- **Date:** 2026-11-21

## Context

The lead author asked on Nov. 21, 2026 to gather Native nations' stories about
resolving disputes, mediation and peacemaking, of every length and from many
nations, for cultural context in the essays and book and as possible
anthology chapters. He asked that each story be cited directly to its source
and that the project settle on a file format for attributing them.

A story is not like the project's other sources. It can be free to quote
under copyright law and still belong to a clan or family, be told only in
one season, or need a cultural authority's approval before anyone retells it.
The charter already says that ceremonial, restricted or community-held
knowledge is not added without the community's written approval (commitment
5), and that a nation may correct, restrict or withdraw material about it
(commitment 6).[^charter] The *Protocols for Native American Archival
Materials* likewise separate legal rights from a community's own rules about
who may see and share knowledge.[^protocols] Some stories will also reach the
project from people rather than publications, through the contributor intake
forms being drafted in a separate thread of the project.

## Decision

- **A story record** (`schemas/story.schema.json`, stored in
  `content/stories/<letter>/<id>.yaml`) describes one story across all its
  known tellings. It names the nations and, where given, the community; its
  kind (an open list); its length; a neutral one or two sentence summary in
  the project's words, never a retelling; methods and topics.
- **Every telling is cited directly.** A telling points to one source record
  (the nation's page, court opinion, book or recording) or to one private
  contributor filing (`filing-YYYY-NNNN`), never both. The nation's own
  telling is listed first. `authority` says whose voice the telling is, from
  the nation's government, court, cultural office, press or newspaper down to
  an outside recorder, so a reader can see at a glance how close the telling
  is to the nation.
- **The record holds no story text.** Quotation follows the cited source's
  `rights` record as for any other source. Where a story may be reprinted in
  full, the text is kept privately with the permission, not in the
  repository.
- **Credit, permissions and access** use five shapes shared with contributor
  records, defined once in `schemas/common.schema.json`: `credit` (the form
  the teller or contributor chose: name, name and nation, role, pseudonym or
  none), `permitted_uses` (background-only, reference-only, quote or
  publish-in-full, and where), `access` (public, nation review first,
  embargoed until a date, or restricted), `cultural_authority` (the role or
  office that approved sharing) and `filing`. The story's access must be at
  least as restrictive as its most restrictive telling.
- **Protocols are recorded only when a source states them**: seasonal,
  setting, teller, clan- or family-owned, ceremonial, sacred, name avoidance
  or permission required, each with the source that states it and how the
  project follows it. A story whose content is sacred or ceremonial is
  recorded, if at all, without a summary and with access `restricted`.
- **Anthology candidates** carry who must grant permission, separately for
  copyright and for cultural authority, even when one office holds both, and
  where to ask.
- **Validation.** `scripts/validate_records.py` checks that a story's
  tellings, protocols and titles cite existing source records, its nations
  and methods exist, its telling ids are unique, the anthology telling is one
  of its tellings, and its access is not looser than any telling's.

## Consequences

- Stories can be cited in essays with `[@source-key]` as now, and listed on a
  nation's page later, without copying any story into public git history.
- A nation's request to restrict or remove a story changes one field, and
  the website, exports and offline copies follow it (commitment 6).
- Collecting stories is slower: each needs its rights and any protocol
  checked, and most anthology use needs two permissions.
- The website does not show stories yet. Showing them, including seasonal
  display, is later website work.

## Sources

[^charter]: [Charter, commitments 5 and 6](../charter.md).
[^protocols]: First Archivist Circle, *Protocols for Native American Archival Materials* (2007), [www2.nau.edu](https://www2.nau.edu/libnap-p/protocols.html) (accessed Nov. 21, 2026).
