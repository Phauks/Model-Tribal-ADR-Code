/**
 * Words for the source watch's review page (/workspace/watch): the name of a
 * collection or nation page part an item may join, its proposed action, and
 * its hosting rule. Collection names come from the collections registry
 * (src/lib/server/collections.ts), which the page's server code reads and
 * passes in, so a new collection is named without a change here.
 */

/** A collection's title, or a nation page part as "Nation page: land establishment". */
export function feedLabel(feed: string, collectionTitles: Record<string, string>): string {
	if (feed.startsWith('nation:')) return `Nation page: ${feed.slice('nation:'.length).replace(/_/g, ' ')}`;
	return collectionTitles[feed] ?? feed;
}

export const proposedLabels: Record<string, string> = {
	add: 'Add',
	'new-version': 'New version',
	'same-as': 'Same as?',
	note: 'Note',
	none: 'None'
};

export const hostingLabels: Record<string, string> = {
	serve: 'Serve (U.S. government work)',
	private: 'Private copy only',
	'link-only': 'Link only',
	'by-consent': 'Only with the nation’s consent'
};

export const sensitivityLabels: Record<string, string> = {
	'child-or-family-case': 'Child or family matter',
	'protection-order': 'Protection order',
	'nation-restriction': 'Nation restricts this',
	'rights-not-settled': 'Rights not settled',
	'tribal-court-opinion': 'Tribal court opinion'
};
