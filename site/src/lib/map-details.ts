import type { RecognitionBadge } from './recognition-badges.ts';

/**
 * What the details beside or under a map show for the place or nation a reader chose on it (MapDetails.svelte): the Map page's side column, and the map on a nation's page (Trevor, 2026-11-24, mockups 3A and 5).
 */

/** One linked nation in a count's list: its page, or the part of it that holds the fact and its sources. */
export type MapDetailsNation = { id: string; name: string; href: string };

/** A fact in the details. A count of nations opens to those nations (mockup 3A). */
export type MapDetailsLine = { label: string; value: string; nations?: MapDetailsNation[] };

/** A line of a nation's contact, from its preview file (/nations/<id>/preview.json). */
export type MapDetailsContact = { label: string; lines: string[]; link?: string; external?: boolean };

export type MapDetails = {
	kind: string;
	title: string;
	/** The nation the details are about, when they are about one. */
	nation?: string;
	badges?: RecognitionBadge[];
	lines: MapDetailsLine[];
	/** The nations the place's entry names, which a place with one nation uses to open that nation's details. */
	nations?: { id: string; name: string; badges?: RecognitionBadge[] }[];
	page?: { href: string; label: string };
};

/** A count of nations that opens to them, in name order; given a section, each goes to that part of the nation's page. */
export function nationsLine(label: string, nations: { id: string; name: string }[], section?: string): MapDetailsLine {
	const sorted = [...nations].sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }));
	return {
		label,
		value: sorted.length.toLocaleString('en-US'),
		nations: sorted.map((nation) => ({ id: nation.id, name: nation.name, href: `/nations/${nation.id}${section ? `#${section}` : ''}` }))
	};
}
