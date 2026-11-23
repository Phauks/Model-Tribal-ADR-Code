/**
 * What a nation's page says when one of its legal sections (courts, laws,
 * jurisdiction) has nothing to show. Trevor asked on Nov. 22, 2026 that every
 * nation's page always show these sections and say plainly when none were
 * found, so a reader can see whether recourse may be available.
 *
 * The page never says that a court or a law does not exist: a nation can hear
 * disputes through its council, or publish its laws only on paper. Until a
 * search is finished it says only "None Identified" (Trevor, Nov. 23, 2026).
 * Once the nation's search log records a finished search, it says what was
 * found and how far the search went (research/search-logs/, decision record 0025).
 */
import { readableDate } from './readable-date.ts';

/** The parts of a search log that the page reports. */
export interface SearchSummary {
	status: 'found' | 'none-found' | 'partly-searched' | 'not-searched';
	lastSearched?: string;
	/** Each distinct address searched, counted once. */
	places: number;
	/** The kinds of place searched, most searched first. */
	placeKinds: string[];
}

export interface EmptyNote {
	/** The short answer, such as "None found". */
	text: string;
	/** How far the search went, in a sentence or two; empty when no search is finished. */
	note: string;
}

/** Kinds of place a reader would recognize, in the words the page uses. */
const placeKindNames: Record<string, string> = {
	'nation-website': 'the nation’s website',
	'nation-code-site': 'the nation’s code site',
	'bureau-of-indian-affairs-list': 'the Bureau of Indian Affairs’ list',
	'national-indian-law-library': 'the National Indian Law Library',
	'state-court-directory': 'state court directories',
	'court-website': 'court websites',
	'tribal-court-site': 'Tribal court websites',
	'intertribal-organization': 'intertribal organizations’ sites',
	'web-search': 'a web search'
};

function list(names: string[]): string {
	if (names.length <= 2) return names.join(' and ');
	return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * The note for an empty section. `what` names what was looked for, with its
 * article ("a court or other forum"); `mayStillExist` says why one may exist
 * all the same.
 */
export function emptySectionNote(
	what: string,
	mayStillExist: string,
	summary: SearchSummary | undefined
): EmptyNote {
	const when = summary?.lastSearched ? `, most recently on ${readableDate(summary.lastSearched)}` : '';
	const kinds = list((summary?.placeKinds ?? []).map((kind) => placeKindNames[kind]).filter(Boolean).slice(0, 3));
	const where = kinds ? `, including ${kinds}` : '';
	const places = summary?.places === 1 ? 'one place' : `${summary?.places ?? 0} places`;
	switch (summary?.status) {
		case 'none-found':
			return {
				text: 'None found',
				note: `The project searched ${places} for ${what}${where}${when}, and found none. ${mayStillExist}`
			};
		case 'found':
			return {
				text: 'None shown yet',
				note: `A search${summary.lastSearched ? ` on ${readableDate(summary.lastSearched)}` : ''} found a lead on ${what}, which is being checked before it is shown here.`
			};
		default:
			// Until a search is finished, just the short answer (Trevor, Nov. 23, 2026).
			return { text: 'None Identified', note: '' };
	}
}
