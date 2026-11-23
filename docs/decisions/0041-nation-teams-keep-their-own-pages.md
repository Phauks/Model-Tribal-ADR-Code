# 0041. Let each nation choose a team that keeps its own page, with delegation inside that nation only

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The lead author asked on Nov. 23, 2026 to "provide nation page specific permissions to individuals, so once approved, they can update information without our prior approval, although perhaps we still review," and added: "Allow for someone with permission within a tribe to allow delegation beneath that tribe. Eg, they can provide others with access, but not for other tribes."

Until now a nation could only ask the project to correct or remove material ([charter](../charter.md), commitment 6), and one "nation reviewer" per nation could comment on and approve its record ([decision record 0023](0023-permission-levels-per-document.md)). The charter adopts the right to act "through representatives chosen by themselves in accordance with their own procedures" (UNDRIP art. 18; charter, commitment 4), and the CARE principle of Authority to control.

A proposal with mockups set out how a person proves they speak for a nation, the levels inside a nation, what goes live when, review after the fact, the audit log, rollback, how changes reach git, and protection against impersonation. The lead author chose "Build as proposed" on Nov. 23, 2026.

## Decision

**Proof.** A person asks from their profile page, with a letter or resolution from the nation, or by naming an office that speaks for it. The project always confirms with the nation's office, using a contact the project already had for the nation (its own website or the Tribal Leaders Directory of the Bureau of Indian Affairs), never one the applicant gives. An email address at the nation's domain is only a hint. Proof stays in the private bucket.

**Four levels, one nation each.** Steward (publishes, and adds and removes people), Editor (publishes), Drafter (writes; an editor publishes) and Reviewer (comments and approves for the nation). They map onto the existing levels: full, full, contribute and comment on that nation's record. A place can cover the whole page or named parts of it.

**Delegation.** A steward adds people only to their own nation's team, at up to their own level and parts. The server takes the nation from the page's address and checks the steward's own place on that nation every time, so no form value can reach another nation. Every place ends after two years at most and can be renewed. A steward cannot end the place of someone the project confirmed directly with the nation's office. People a steward added keep their places when the steward leaves.

**Override.** The lead author can add, change or end any place, can lower anyone's access with an ordinary grant (which comes before a team place), and can suspend a person together with everyone they added, and everyone those people added.

**Log.** Every request, confirmation, place given, changed or ended, and suspension is written to the sealed activity log under the nation's team. Each team sees its own entries.

**Built in stages.** This record covers teams and delegation (the first stage). Editing and publishing, with the nation's own words live at once, a 3-day hold on new contact details, and statements beside government records, come next; then the project's review queue, emails to nations' offices, and a nightly copy into git. Teams open to nations once the project domain can send email, because sign-in codes and notices to offices need it.

## Consequences

- Migration 0015 adds `nation_team_members` and `nation_team_applications`.
- Places count as grants on the nation's record in `grantsOf` (`site/src/lib/server/access.ts`), so every existing check, including reviews, sees them; anyone on a team approves the record in the nation's capacity.
- New pages: `/profile/nation-team` (ask to join), `/workspace/nation-teams` (the lead author's list), `/workspace/nation-teams/requests/<reference>` (confirm or decline) and `/workspace/nation-teams/<nation>` (the team).
- The "Nation reviewer" role stays for people the project adds by hand; a person new to the project who joins a team gets that role for the team's nation.

## Sources

- Lead author's requests, project thread "Let approved people edit their nation's page", Nov. 23, 2026.
- [Project charter](../charter.md), commitments 2, 4, 5 and 6.
- [Requests from Native nations](../requests.md), principles and review steps.
- United Nations Declaration on the Rights of Indigenous Peoples, G.A. Res. 61/295, art. 18 (Sept. 13, 2007).
- Global Indigenous Data Alliance, *CARE Principles for Indigenous Data Governance* (Sept. 2019), [gida-global.org/care](https://www.gida-global.org/care).
