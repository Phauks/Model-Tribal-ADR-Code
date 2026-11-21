# 0012. Keep the list of dispute resolution methods open

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The lead author asked that the project's data model allow for dispute
resolution methods the project has not yet considered (project thread,
2026-11-21). The foundations schemas named processes only in closed lists:
the provision `track` field and the tribe profile's `justice_institutions.kind`
field. A closed list forces a process that fits none of its values into the
nearest one or into "other", which loses what makes it distinct.

The sources show why this matters. Federal law already defines its lists of
processes as open: the Administrative Dispute Resolution Act's definition of
"alternative means of dispute resolution" lists conciliation, facilitation,
mediation, factfinding, minitrials, arbitration and ombuds, "or any combination
thereof" [@usc-5-571], and the Alternative Dispute Resolution Act of 1998 lists
processes "such as" early neutral evaluation, mediation, minitrial and
arbitration [@usc-28-651]. Native nations and the peoples of the territories
use processes that are not ADR at all and that the project describes on their
own terms (charter, commitment 3).

## Decision

- Each dispute resolution method is one YAML record in `content/methods/`,
  validated by [method.schema.json](../../schemas/method.schema.json). Adding a
  method means adding a file; no schema changes.
- A process with no record is added with `status: proposed` and reviewed by
  the lead author before it becomes `adopted`.
- A method is described by facets (`who_decides`, `outcome`, `neutral_role`,
  `participation`, `settings`), each allowing `varies` and `other` plus a
  note. A process nobody has named can still be recorded and compared with
  others by how it works.
- A method's `classification` says whether the project treats it as ADR, as
  its own tradition (peacemaking, customary processes), as a court or
  governmental process, or as unsettled. `broader` never places an
  own-tradition method under an ADR method.
- Methods can be hybrids (`combines`), kinds of other methods (`broader`) or
  related, and can carry names in the language of the people who practice
  them.
- Sources and provisions refer to methods by id in a `methods` list. The
  validator checks every id resolves.
- The provision `track` list stays closed: it organizes the book, not the
  processes a provision governs.
- Tribe profiles record a nation's forums with an open `kind` value. Those
  values are meant to match method ids, so a nation's forum and the general
  method it uses can be compared (to be wired up with the tribe profile
  dataset).

## Consequences

- The first method records are drafted from the sources found while building
  the United States dispute resolution bibliography and stay `proposed` until
  reviewed.
- Model provisions should also leave room for unlisted processes, for example
  with a general clause allowing any process the parties and the nation agree
  to (project analysis; to be drafted with the provisions).
- A method particular to one nation names it in `tribes` and follows the
  charter's consultation process before publication.

## Sources

Citation keys resolve to records in `content/sources/`.
