/**
 * What a nation's page says when one of its legal sections (courts, laws,
 * jurisdiction) has nothing to show. Trevor asked on Nov. 22, 2026 that every
 * nation's page always show these sections and say plainly when none were
 * found, so a reader can see whether recourse may be available.
 *
 * The page never says that a court or a law does not exist: a nation can hear
 * disputes through its council, or publish its laws only on paper. So it says
 * only "None Identified".
 */

export interface EmptyNote {
	/** The short answer: "None Identified". */
	text: string;
}

/**
 * What an empty section says, whatever the search log records (Trevor, Nov.
 * 24, 2026: "we don't need to attest" how far the search went, "just say,
 * None Identified"). The search logs stay in research/search-logs/.
 */
export const noneIdentified: EmptyNote = { text: 'None Identified' };
