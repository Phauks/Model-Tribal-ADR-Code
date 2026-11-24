import { entityTypeLabels } from '#lib/nation-labels.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
import type { RequestHandler } from './$types';
import { csvDocument, csvResponse } from '#lib/csv.ts';

// The Native nations index as one CSV file, for the masthead's Download menu on the
// index pages (src/lib/page-downloads.ts). Built with the site.
export const prerender = true;

export const GET: RequestHandler = () => {
	const header = ['identifier', 'name', 'listed_name', 'group', 'recognition', 'legal_basis', 'states', 'review_status', 'page'];
	// Addresses are written from the site's root, since the file is built before the site has a domain.
	const lines = nationIndexRows().map((row) =>
		[
			row.id,
			row.name,
			row.listedName,
			entityTypeLabels[row.entityType] ?? row.entityType,
			row.recognition.map((view) => view.label).join('; '),
			row.recognition
				.map((view) => view.legalBasis.map((part) => part.text).join(''))
				.filter(Boolean)
				.join('; '),
			row.states.join('; '),
			row.review,
			`/nations/${row.id}`
		]
	);
	return csvResponse(csvDocument([header, ...lines]), { fileName: 'native-nations.csv' });
};
