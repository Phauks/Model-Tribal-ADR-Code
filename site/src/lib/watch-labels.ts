/**
 * Words for the source watch's review page (/workspace/watch): the names of
 * the collections and nation page parts an item may join, its proposed
 * action, and its hosting rule. The collection names are the titles in
 * src/lib/server/collections.ts, which reads the records and so cannot run in
 * the browser; tests/source-watch-review.test.ts checks the two agree.
 */

export const collectionTitles: Record<string, string> = {
	'native-nations': 'Native Nations',
	'governing-documents': 'Governing Document Histories',
	'tribal-constitutions': 'Constitutions',
	'tribal-codes': 'Codes and Laws',
	'intergovernmental-agreements': 'Compacts and Agreements',
	stories: 'Stories',
	treaties: 'Treaties and Agreements',
	'federal-statutes': 'Statutes',
	'federal-regulations': 'Regulations',
	'united-states-code-sections': 'U.S. Code Sections (Title 25)',
	'regulation-sections': 'Regulation Sections (25 C.F.R.)',
	'executive-orders': 'Executive Orders',
	'federal-register-notices': 'Federal Register Notices',
	'supreme-court-cases': 'U.S. Supreme Court Cases',
	'other-court-cases': 'Other Court Cases',
	'tribal-court-opinions': 'Tribal Court Opinions',
	'supreme-courts': 'U.S. Supreme Courts',
	courts: 'Courts',
	biographies: 'Biographies',
	justices: 'U.S. Supreme Court Justices',
	presidents: 'U.S. Presidents',
	'source-copies': 'Source Documents',
	charts: 'Charts',
	'glossary-terms': 'Glossary Terms',
	forms: 'Forms'
};

/** A collection's title, or a nation page part as "Nation page: land establishment". */
export function feedLabel(feed: string): string {
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
