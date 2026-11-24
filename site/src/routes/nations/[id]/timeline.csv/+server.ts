import { error } from '@sveltejs/kit';
import { nations } from '#lib/server/content.ts';
import { nationTimelineFile } from '#lib/server/timeline.ts';
import { timelineCsv } from '#lib/timeline.ts';
import type { EntryGenerator, RequestHandler } from './$types';
import { csvResponse } from '#lib/csv.ts';

// One nation's timeline as CSV, for the Download menu on its page.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const rows = nationTimelineFile(params.id);
	if (!rows) error(404, 'No published record has that identifier.');
	return csvResponse(timelineCsv(rows), { fileName: `${params.id}-timeline.csv` });
};
