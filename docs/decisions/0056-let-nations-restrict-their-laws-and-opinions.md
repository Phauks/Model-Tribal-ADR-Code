# 0056. Let a nation choose how the site shows its own laws and court opinions

- **Status:** Accepted
- **Date:** 2026-11-24
- **Extends:** decision records [0041](0041-nation-teams-keep-their-own-pages.md) (nation editors) and [0047](0047-show-tribal-court-opinions-from-the-caselaw-access-project.md) (the nations' court opinions); [charter](../charter.md), commitment 6

## Context

The charter says a Native nation may ask that material about it be restricted or removed, and that the nation's request wins (commitment 6; CARE's "Authority to control"). Until now a nation did that through the private request form, one item at a time, and the project made the change by hand. Once a nation has claimed its page through its team (decision record 0041), its own people can make the choice directly. Trevor Goldsmith asked for this on Nov. 24, 2026, approved the mockups in `design/nation-restrictions/` the same day, and chose the scope: a nation restricts its own laws and its own courts' opinions; federal and state law and cases stay shown.

## Decision

- **Levels.** Each of the nation's items is shown in one of three ways. *Show*: listed, with this site's copy (the behavior before this decision). *Cite only*: listed by name and citation, linked to where the original is kept (for opinions, the Caselaw Access Project), with no copy on this site and no words drawn from the text, such as an opinion's "Mentions". *Hide*: not listed; the section says once "Some items are not listed at the nation's request," with no count and no names, and the copy's address answers without naming it.
- **Kinds.** The team sets a level for each kind, and may set any item apart from its kind. Items added later follow their kind. The kinds are the nation's laws (constitutions, codes, ordinances, resolutions), its courts' opinions, and its agreements. Agreements may be shown or cited only, not hidden, because the Secretary of the Interior publishes notice of each approved gaming compact in the Federal Register (25 U.S.C. § 2710(d)(8)(D)).
- **Federal and state law and cases are always shown.** Judges' opinions carry no copyright and official legal texts are free to copy (*Banks v. Manchester*, 128 U.S. 244 (1888); *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020)), and a reader looking for recourse needs them. A nation can add its statement beside them, as it already can (decision record 0041).
- **Who.** Editors and stewards whose place covers the whole page, and the lead author, change the levels on the team's "Laws and cases" page (`/workspace/nation-teams/<nation>/laws-and-cases`). Everyone on the team can see them. A nation that has not claimed its page still uses the request form.
- **In force at once, read by the project afterwards.** A save takes effect at once ("Protect first, review second", `docs/requests.md`). The project reads each save within 7 days on "Changes made by nations" (`/workspace/nation-pages`), where it can mark it read, ask the team a question, or suspend the person who made it. There is no undo: the nation has the last word over its own material, and a leadership dispute freezes the page instead.
- **Stored in the database, never in git.** Every save is a row of `nation_restriction_changes` (migration `20261124T0905_add_nation_restrictions.sql`) with the settings, what changed, the team's note, who and when; the newest row is in force. Each save and each of the project's answers also goes in the sealed activity log (decision record 0023). The git history is public, and a list of restricted items would point at exactly what a nation wanted out of view.
- **The strictest choice wins.** A copy that belongs to several nations follows the strictest of their choices, and the project's own privacy holds (for children named in opinions, `research/analyses/2026-11-24-tribal-child-cases-privacy.md`) are a floor a nation's "Show" never lifts.
- **Where it reaches now.** The Worker reads the choices on each request (`src/lib/server/nation-restrictions.ts`). The nation's page and its table of opinions take hidden items off with a style before the page runs and then redraw with cited items linked to their originals and the counts corrected (`tools/nation-page-changes-worker.js`, `src/lib/server/nation-page-overlay.ts`). The copy (`/copies/<key>`) and its page (`/copies/view/<key>`) stop serving the text, the nation's ZIP download leaves the file out, and the nation's offline list drops it, so a device saving the nation's documents does not fetch it. Copies of a nation's laws and opinions are cached for five minutes instead of a day, so a choice shows within minutes.
- **Where it reaches next.** Files made when the site is built (the search index, the copies list and its CSV, the copies' details files, data sets, timelines, the printed book) and the names in the built page's own source follow in a second step, which needs the build to read the choices from the database. That step waits for a build secret only Trevor can set.

## Consequences

- Until the second step lands, a hidden item's name and link stay in the built page's source and in the files made at build time, though no page shows them and its copy is not served. The team's page says that search, downloads and data sets follow at the next site update; that line becomes true with the second step.
- A book already printed cannot change; the next edition follows the choices.
- The list of a nation's restrictable items is built with the site (`/nations/<id>/restrictable.json`), so an item added in a later build appears on the team's page then, following its kind.
- The project keeps its private copy of every source it cites (standing rule), including hidden ones, unless the nation asks through the request form for it to be deleted.

## Sources

- [Charter](../charter.md), commitment 6, and [requests](../requests.md), "Protect first, review second".
- *Banks v. Manchester*, 128 U.S. 244 (1888).
- *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020).
- 25 U.S.C. § 2710(d)(8)(D) (notice of approved Tribal-State compacts in the Federal Register).
- Global Indigenous Data Alliance, [CARE Principles for Indigenous Data Governance](https://www.gida-global.org/care) ("Authority to control").
