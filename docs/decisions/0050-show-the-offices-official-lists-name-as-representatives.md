# 0050. Show the offices that official lists name as each nation's representatives

- **Status:** Accepted
- **Date:** 2026-11-23
- **Extends:** decision records [0041](0041-nation-teams-keep-their-own-pages.md) and [0042](0042-governance-facts-from-governing-documents.md)

## Context

Trevor Goldsmith asked on Nov. 23, 2026: "Do tribes have verified representatives? Is that a common thing? If so, we could include that info?", and then: "We should use that federal list and state lists from the Indian affair commissions."

No single register of "verified representatives" exists. Each Native nation decides for itself who speaks for it, under its own constitution, laws or traditions. Governments keep lists of who holds each nation's leading office so they know whom to write to:

- The Bureau of Indian Affairs keeps the Tribal Leaders Directory, which "provides contact information for each federally recognized Tribe" ([Tribal Leaders Directory](https://www.bia.gov/service/tribal-leaders-directory)). Its data service gives each nation's leader by name and title ([feature service](https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0)). The directory has no page for a single nation: its map and its CSV download cover every nation at once.
- Some states' Indian affairs commissions or offices publish a list of the Tribes the state recognizes, with each Tribe's leader. As read on Nov. 23, 2026, five do: Alabama, Louisiana, North Carolina, South Carolina and Virginia. Connecticut, Georgia, Maryland and New Jersey publish pages about their Tribes or their commissions that name no Tribe's leader; the Massachusetts and Vermont pages refused the project's page fetch. Many states with only federally recognized nations publish leader lists too, which the project has not used yet ([research session](../../research/sessions/2026/2026-11-23-official-representatives.md)).

The site's rule is that it never shows a leader's personal name or address (charter, commitment 1; the leader's office title alone was added to nation pages under decision record 0042). Leaders' emails are kept only in the private address book.

## Decision

- Each nation's profile has a `representatives` list: the office each official list names as the nation's leader, the body that keeps the list, a link to the list, and the name the list uses for the nation. The person who holds the office is never recorded. The list itself names who holds it now.
- Titles are recorded without the holder's own form, as for governance facts: Chairman, Chairwoman and Chair become Chairperson, and words about the holder such as "acting" are dropped. Vice, assistant and staff offices are left out. An office a list shows as vacant is kept, with a note.
- A nation page opens its Government section with "Official representatives": each office, "Listed by" the list (linked), and the name to look up there. A head of government title from the same list is not shown twice.
- When a person asks to join a nation's team, the request page in the workspace shows the offices these lists name and the office email and phone on the nation's page, so the project confirms the request with one of them (decision record 0041).
- `scripts/representatives/apply.py` writes the lists and one search log per nation under `research/search-logs/representatives/`. What was read from each state is in `research/representatives/state-listings.json`.

## Consequences

- 613 of 947 profiles name at least one office: 572 from the federal directory and 56 from the five state lists (some nations are on both).
- A listing is not a statement that the person may act for the nation in every matter; it is the office the government writes to. The page says only that the list names the office.
- Leaders change after elections. The federal titles were checked against the live directory on Nov. 23, 2026 with no change; state lists are re-read by hand. The private address book already checks the federal directory for changes (`Check now`).
- States with leader lists for federally recognized nations (for example Arizona, New Mexico, Nevada, Washington and Wisconsin) can be added as more lists, one file entry per state.

## Sources

- Trevor Goldsmith, project thread on saving data for offline use, Nov. 23, 2026 (the two messages quoted above).
- U.S. Dep't of the Interior, Bureau of Indian Affairs, *Tribal Leaders Directory*, https://www.bia.gov/service/tribal-leaders-directory (accessed Nov. 23, 2026).
- The state lists named in [`research/representatives/state-listings.json`](../../research/representatives/state-listings.json) and the [research session of Nov. 23, 2026](../../research/sessions/2026/2026-11-23-official-representatives.md).
- Decision records [0041](0041-nation-teams-keep-their-own-pages.md) and [0042](0042-governance-facts-from-governing-documents.md); [project charter](../charter.md), commitment 1.
