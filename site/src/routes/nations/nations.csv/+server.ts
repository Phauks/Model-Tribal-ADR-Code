import { entityTypeLabels } from '#lib/nation-labels.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
import type { RequestHandler } from './$types';

// The Native nations index as one CSV file, for the masthead's Download link on the
// index pages (src/lib/page-downloads.ts). Built with the site.
export const prerender = true;

/** Quotes a value for CSV (RFC 4180, section 2). */
function field(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export const GET: RequestHandler = () => {
	const header = ['identifier', 'name', 'group', 'recognition', 'legal_basis', 'states', 'review_status', 'page'];
	// Addresses are written from the site's root, since the file is built before the site has a domain.
	const lines = nationIndexRows().map((row) =>
		[
			row.id,
			row.name,
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
			.map(field)
			.join(',')
	);
	return new Response(`${[header.join(','), ...lines].join('\r\n')}\r\n`, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="native-nations.csv"'
		}
	});
};
