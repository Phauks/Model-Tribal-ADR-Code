# 0022. Let people register to help; keep workspace access with the lead author

- **Status:** Accepted
- **Date:** 2026-11-21 (accepted 2026-11-22)

## Context

Decision record 0013 said nobody can sign in until the lead author adds their
email address. The lead author now wants people who would like to help to
register themselves, keep a profile they can edit, and choose early how they
are credited in the book, with a confirmation page before anything is used
(2026-11-21). A profile needs an account, so the person can come back to it.

## Decision

- Anyone who signs in, which proves they receive mail at their address
  ([decision record 0024](0024-own-sign-in.md)), may keep a
  **contributor profile** ([docs/contributor-profiles.md](../contributor-profiles.md)).
- A profile gives **no access to the workspace**. The lead author still
  decides who gets a role, either from the People page as before or by giving
  access from a registration. Registrants are not rows in `people` until then.
- Profiles are kept in their own tables, linked to `people` when access is
  given, so access rules and the `people` table stay as decision record 0013
  set them.
- Every confirmation of a profile is kept as a numbered version, and credits
  are taken only from the last confirmed version.
- Credits use the five forms in `schemas/common.schema.json` `credit` (decision
  record 0020's contributor statement), so a profile and a filing describe
  credit in the same words.
- Registration is for adults. Nation affiliation is optional, self-described
  and never verified.

## Consequences

- The sentence "There is no open sign-up" in site/COLLABORATION.md becomes
  "There is no open access to the workspace."
- Anyone can create a profile, so the Contributors page may collect
  registrations that are not useful. Each needs a verified email address, and
  drafts stay private; declining is one click with a reason.
- Migration 0003 must be applied to the remote database, after migration
  0002 (permission tiers), before the profile pages work.

## Sources

- docs/contributor-profiles.md, which cites the design patterns used.
- Decision records [0001](0001-adopt-care-principles.md) (CARE) and
  [0013](0013-sign-in-with-auth0.md) and [0024](0024-own-sign-in.md) (sign-in).
