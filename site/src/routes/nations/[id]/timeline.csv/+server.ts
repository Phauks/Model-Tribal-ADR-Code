import { error } from '@sveltejs/kit';
import { nations } from '#lib/server/content.ts';
import { nationTimelineFile } from '#lib/server/timeline.ts';
import { timelineCsv } from '#lib/timeline.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// One nation's timeline as CSV, for the Download menu on its page.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const rows = nationTimelineFile(params.id);
	if (!rows) error(404, 'No published record has that identifier.');
	return new Response(timelineCsv(rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${params.id}-timeline.csv"`
		}
	});
};
