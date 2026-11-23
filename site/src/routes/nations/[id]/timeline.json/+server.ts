import { error, json } from '@sveltejs/kit';
import { nations } from '#lib/server/content.ts';
import { nationTimelineFile } from '#lib/server/timeline.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// One nation's timeline as JSON, for the Download menu on its page.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const rows = nationTimelineFile(params.id);
	if (!rows) error(404, 'No published record has that identifier.');
	return json(rows, { headers: { 'content-disposition': `attachment; filename="${params.id}-timeline.json"` } });
};
