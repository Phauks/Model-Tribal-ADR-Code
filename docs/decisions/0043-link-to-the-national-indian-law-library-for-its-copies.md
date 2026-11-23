# 0043. Link to the National Indian Law Library for copies taken from it

- **Status:** Accepted
- **Date:** 2026-11-22
- **Amends:** decision record [0031](0031-serve-copies-of-documents-from-the-private-bucket.md)

## Context

Decision record 0031 lets the website serve its own copies of nations' constitutions and laws. Some of those copies were captured from the National Indian Law Library (NILL) of the Native American Rights Fund. NILL's Tribal Law Gateway says that a nation's permission to share in NILL's collection "does not serve as implied consent to use the materials in any other way." Using a nation's legal materials "in another database or collection" needs "separate permission from the Tribal Nation itself, as NILL was not granted the authority to consent on their behalf" ([Tribal Law Gateway](https://nill.narf.org/triballaw/), accessed Nov. 23, 2026). The comparison of similar projects found this ([research note](../../research/analyses/2026-11-23-similar-legal-projects.md), section 6a). At that time the capture index served 54 constitution copies and 471 tribal law copies whose only published address was NILL's.

Asked whether to keep serving the constitution copies taken from NILL, Trevor Goldsmith chose "Link to NILL until nations consent" and wrote: "Keep them in our r2 but you can just link."

## Decision

- A copy of a nation's constitution or law whose only published address is NILL's (`narf.org/nill/` or `nill.narf.org/`) stays in the private bucket and keeps its capture index row, but is marked `redistribution: no`. The website does not serve it.
- Pages link to NILL's copy instead. The document history already falls back to the source's own address when no copy is served (`site/src/lib/server/document-history.ts`), and Sources lists keep linking the original address.
- The same rule covers codes and other tribal laws captured from NILL, not only constitutions, because NILL's statement covers all the legal materials it holds.
- A copy also published at an address that is not NILL's, such as the nation's own website, is not affected.
- When a nation agrees that the project may serve its copy, the consent is recorded by setting `"redistribution": "yes"` for the key in `research/capture-index-overrides.json`, with a note naming who agreed and when. The request goes on the project's private log of things to ask.
- `scripts/captures/mirror_captures.py` applies the rule when it builds the index and when it files a new copy, so later captures from NILL follow it too.

## Consequences

- Readers of those nations' pages open NILL's site instead of the project's copy. NILL limits "frequent or systematic" requests, but readers following links one at a time are not that.
- The project keeps NILL's goodwill, which matters for outreach, and keeps its own copy for research, version history and SHA-256 checks.
- Nations whose only text came from NILL become asks on the private log: whether the project may serve its own copy.

## Sources

- Trevor Goldsmith, project thread "Compare similar legal projects and what to learn", 2026-11-22 (decision card answer "Link to NILL until nations consent"; message "Keep them in our r2 but you can just link. Let's create a log of items we may ask or request for").
- Nat'l Indian L. Libr., *Tribal Law Gateway*, Native Am. Rts. Fund, [nill.narf.org](https://nill.narf.org/triballaw/) (accessed Nov. 23, 2026).
- Decision records [0030](0030-keep-research-captures-in-the-private-bucket.md) and [0031](0031-serve-copies-of-documents-from-the-private-bucket.md); [public-copies.md](../public-copies.md).
