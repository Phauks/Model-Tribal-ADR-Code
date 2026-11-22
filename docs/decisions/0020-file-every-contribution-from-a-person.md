# 0020. Keep a signed filing for every contribution that comes from a person

- **Status:** Proposed
- **Date:** 2026-11-21

## Context

The project's evidence has so far been published sources, each cited through a
source record. The lead author expects people to contribute material that has
no published source behind it: personal stories, interviews, unpublished
documents. Without a record of what each person gave and allowed, the project
could not show its permission to use the material, honor a later withdrawal,
or prove that community-held knowledge was approved (charter, commitments 5
to 7). A separate thread is building story records that cite such material and
needs a shared way to point at it.

## Decision

- Every contribution that does not come from a published source gets a
  **filing**: a contributor statement, any other applicable forms with the
  version signed, the items with checksums, and a dated log
  ([docs/contributions.md](../contributions.md)).
- Filings hold personal details and unpublished material, so they live in the
  website's private database and file bucket (or the private project folder
  until that is built), never in git. Their shape is fixed by
  `schemas/contribution-filing.schema.json`.
- Public records carry only the filing id and five public-safe fields defined
  once in `schemas/common.schema.json`: `filing`, `credit`, `permitted_uses`,
  `access` and `cultural_authority`. Source records carry them in a
  `contribution` block; story records use the same definitions.
- Contributors keep their copyright. The default grant is a nonexclusive
  permission to the project; an open license is the contributor's choice.
- Community-held knowledge needs a cultural authority permission from the
  office the nation designates, whatever the contributor agreed.
- No form is used with a contributor until the lead author approves it.
  The lead author reads UNLV's human subjects rules as aimed at biomedical
  and scientific study and does not plan to seek university IRB review; any
  nation's own research rules are checked and followed before an interview.

## Consequences

- Seven draft forms in `docs/contributor-forms/`, versioned, for review.
- The website's "Contribute" request will open a filing; the database
  migration, signing flow and workspace page are a proposal, not yet built.
- A lint rule can require a `contribution` block on every `interview` source.
- Withdrawal has limits the forms state plainly: printed copies and copies
  made under an open license cannot be recalled.

## Sources

- Oral History Association, *Principles and Best Practices for Oral History*
  (adopted Oct. 2018), [oralhistory.org](https://oralhistory.org/wp-content/uploads/2025/12/2025-OHA-PrinciplesBP_Best-Practices.pdf).
- Library of Congress, Veterans History Project, *Veteran's Release Form*,
  [loc.gov](https://www.loc.gov/static/programs/veterans-history-project/documents/vhp-field-kit-veterans-release.pdf).
- NCAI Policy Research Center, *Frequently Asked Questions: Partnering with
  Tribal Nations on Research* (Nov. 12, 2021),
  [hosted by the Native Nations Institute](https://nnigovernance.arizona.edu/sites/default/files/2025-07/NCAI-PRC-FAQs-Partnering-with-Tribal-Nations-on-Research-11-12-2021-FINAL.pdf).
- Further sources are cited in [docs/contributions.md](../contributions.md#references).
