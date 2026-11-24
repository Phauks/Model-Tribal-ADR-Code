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

**Built in stages.** Teams and delegation came first, then editing and publishing (below); then the project's review queue and emails to nations' offices. Nations' changes are not copied into git: its history is public and permanent, and a nation must be able to take its words back (the lead author's rule that nation pages get no public history). Recent changes lists them by part and name, never the words. Teams open to nations once the project domain can send email, because sign-in codes and notices to offices need it.

**Stage 2: editing and publishing.** The rule is "who said it". The nation's own words, a note on its courts, its statements beside government records and its pictures go live when an editor publishes them. New contacts wait 3 days, unless a second editor for the nation approves them, so nobody can quietly send a nation's mail somewhere else. Any editor can hide a part of the page at once. Facts cited to government records are never edited by a nation; its statement stands beside them. Nations may add pictures, but pages start with none and the project does not choose pictures for nations (the lead author, Nov. 23, 2026). Each publish keeps the earlier versions, which an editor can put back; the history stays private to the team and the project. Because nation pages are prerendered, the Worker adds the live changes to each page as it is sent.


**Stage 3: the project reads after the fact.** The project reads every published change within 7 days, on its own page in the workspace. It can mark a change read, undo it with a note the team sees (the page goes back to the version before), pause the nation's publishing while it asks the team a question, or suspend the person who published it with everyone they added. A pause never stops a nation from hiding part of its page. Editors and the lead author review; only the lead author suspends.

**Claimed pages and problem reports.** Like a map listing, a nation's page says "Unclaimed", with a link to claim it, until someone the project confirmed with the nation's office keeps it; then it says "Claimed by the nation" (the lead author, Nov. 23, 2026, replacing the line that said the nation had not reviewed the page). Problem reports about a claimed page go to the nation's team as well as the project: the team sees what was reported, and who sent it only when the sender ticked "Share my name and contact details with the nation's team", and answers; the project steps in when the team has not answered within 7 days. The claimed badge's panel has "Write to the team", which sends a message the same way with that box ticked from the start, and a team that claims a page agrees to answer such messages (the lead author, Nov. 23, 2026: "If you claim a page, you have to be willing to take the input"). Requests to restrict or remove material stay with the project.

## Consequences

- Migration 0015 adds `nation_team_members` and `nation_team_applications`.
- Places count as grants on the nation's record in `grantsOf` (`site/src/lib/server/access.ts`), so every existing check, including reviews, sees them; anyone on a team approves the record in the nation's capacity.
- New pages: `/profile/nation-team` (ask to join), `/workspace/nation-teams` (the lead author's list), `/workspace/nation-teams/requests/<reference>` (confirm or decline) and `/workspace/nation-teams/<nation>` (the team).
- Stage 2: migration 0020 adds `nation_page_changes` and `nation_team_report_answers`; new pages `/workspace/nation-teams/<nation>/edit` and `/workspace/nation-teams/<nation>/changes`; `/nations/<id>/changes.json` and `/nations/<id>/pictures/<picture>` are served by the Worker, and `tools/add-nation-page-changes.mjs` makes the Worker run first for `/nations/*`.
- Stage 3: migration 20261123T0438_add_nation_page_review.sql adds `nation_page_reviews` and `nation_page_pauses`; new page `/workspace/nation-pages`, permission `review-nation-pages` for the lead author and editors.
- The "Nation reviewer" role stays for people the project adds by hand; a person new to the project who joins a team gets that role for the team's nation.

## Sources

- Lead author's requests, project thread "Let approved people edit their nation's page", Nov. 23, 2026.
- [Project charter](../charter.md), commitments 2, 4, 5 and 6.
- [Requests from Native nations](../requests.md), principles and review steps.
- United Nations Declaration on the Rights of Indigenous Peoples, G.A. Res. 61/295, art. 18 (Sept. 13, 2007).
- Global Indigenous Data Alliance, *CARE Principles for Indigenous Data Governance* (Sept. 2019), [gida-global.org/care](https://www.gida-global.org/care).
