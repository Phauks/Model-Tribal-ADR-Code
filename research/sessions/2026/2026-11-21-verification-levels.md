---
id: 2026-11-21-verification-levels
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: python3 script
  detail: scripts/review/gap_review.py, which grouped the facts whose notes do not say how they were
    checked, merged the reviewers' levels and wrote `verification` into the profiles.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Three reviewer agents each gave a level to one batch of groups from the groups' example
    notes, choosing the weaker level whenever the evidence was thin or the examples disagreed; the lead
    session overrode one group and checked the result with the record lint and coverage report.
purpose: Fill in the `verification` level (decision record 0014) on the profile facts that predate it,
  so the coverage report counts stated levels instead of guesses.
queries:
- every cited fact in content/tribes/*/*.yaml without a `verification` key
sources_added: []
limits: >-
  Levels describe how each fact was gathered, as its note and source record it; no fact was checked
  again against its source in this session. 16,103 facts take the level their own note implies
  (NOTE_LEVELS in scripts/record_facts.py) or bulk-import because their source is a list cited by 20
  or more profiles; 2,234 facts in the 869 groups take a level an AI reviewer chose from the group's
  example notes. The dispute resolution provisions were left without a level, because their
  level follows the lead author's decisions on the provision pre-review.
---

Output: the level for each group of facts whose note does not say how it was
checked, in [`2026-11-21-verification-levels.json`](../../reviews/2026-11-21-verification-levels.json)
(and as a [spreadsheet](../../reviews/2026-11-21-verification-levels.csv)),
and `verification` on 18,337 facts in the 948 profiles.

Method: the dataset gap audit found that no fact recorded how it was checked.
Facts whose note uses the wording the coverage report already reads (for
example "matched to the nation by name", "Title is the link text", "Bulk record
from") take the level that wording implies, the weaker level winning when a
note shows two; facts from a source cited by 20 or more profiles take
bulk-import. The rest were grouped by profile section and source, and a
reviewer gave each group one level using the definitions in the schema
([brief](../../reviews/briefs/2026-11-21-verification-levels.md)).
`read-in-full` needed a quotation, a pinpoint into the document with a value
it states, or a note saying the page was read.

Overridden: the reviewer gave `read-in-full` to the 376 courts listed from
National Indian Law Library contact listings; they are directory entries, so
they are recorded as bulk-import.

Ruled out: no value, note or source was changed; only the `verification` key
was added.
