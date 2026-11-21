# 0016. Give component bands their own profiles

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The Federal Register list of recognized entities names the Minnesota
Chippewa Tribe with six component reservations in parentheses: Bois Forte
Band (Nett Lake), Fond du Lac Band, Grand Portage Band, Leech Lake Band,
Mille Lacs Band and White Earth Band (91 Fed. Reg. 4104 (Jan. 30, 2026)). The
first build made one profile per list entry, so every band's courts, codes,
gaming records and dispute resolution records sat on the Tribe's profile,
told apart only by notes ([provisional analysis, review queue item 7](../../research/analyses/2026-11-21-dispute-resolution-practice.md#9-review-queue);
`research/reviews/2026-11-21-data-gap-review.md`). Each band runs its own
court and publishes its own code (project analysis of the records), and the
[terminology guide](../terminology.md) puts a nation's own usage first.

## Decision

The lead author chose on Nov. 21, 2026 to give each band its own profile,
linked to the Tribe's profile, and to move band records to them.

- A profile may carry `part_of`, the id of the profile whose list entry names
  it (`schemas/tribe.schema.json`). The six band profiles carry
  `part_of: minnesota-chippewa-tribe`.
- Each band's official name is the name the list gives it, cited to the same
  list entry, and its recognition cites that entry with a note that the band
  is named as a component, not as a separate entity.
- A fact moves to a band when the fields that identify it name only that band,
  or, failing that, its note does. Facts about the Tribe's own documents, and
  facts that name several bands or none, stay on the Tribe's profile.
  `scripts/tribes/split_component_bands.py` made the move.
- Counts of recognized entities leave out profiles with `part_of`, so no
  entity is counted twice; analyses count them apart.

## Consequences

- 115 facts moved: 12 to Bois Forte, 12 to Fond du Lac, 8 to Grand Portage,
  22 to Leech Lake, 21 to Mille Lacs and 40 to White Earth. The Tribe's
  profile keeps its own constitution, contacts, the shared trust land and the
  records that name every band.
- The 11 moved provisions that had no `verification` level were given one
  from their notes, as decision record 0014 requires of changed facts: a
  written summary as `read-in-full`, section headings as `title-only`, and a
  list's description with the provision not read as `bulk-import`.
- The band profiles have no self-designation yet. Each band's own name for
  itself (for example "White Earth Nation" or "Mille Lacs Band of Ojibwe")
  should be added from the band's own publications, with a citation.
- The same field can serve any other entry that names components only in
  parentheses, if one is found.
- The band profiles are drafted from public sources and have not been sent to
  the bands (charter, commitment 4).

## Sources

- Lead author's choice on the review queue decision, Nov. 21, 2026 (project
  thread).
- Indian Entities Recognized by and Eligible To Receive Services From the
  United States Bureau of Indian Affairs, 91 Fed. Reg. 4104 (Jan. 30, 2026)
  (source `bia-recognized-entities-2026`).
- Data gap review, name joins: `research/reviews/2026-11-21-data-gap-review.md`.
