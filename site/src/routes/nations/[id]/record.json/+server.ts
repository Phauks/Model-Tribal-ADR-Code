import { error, json } from '@sveltejs/kit';
import { nations } from '#lib/server/content.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// One nation's record as JSON, for the masthead's Download link on its page
// (src/lib/page-downloads.ts). Only published records are built, the same ones the
// page shows; the record carries every fact's citation.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const record = nations().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No published record has that identifier.');
	// A withdrawn page shows only its name and status, so its download holds no more.
	const withdrawn = record.review?.status === 'withdrawn-at-request';
	const body = withdrawn ? { id: record.id, names: { official: record.names.official }, review: record.review } : record;
	return json(body, {
		headers: { 'content-disposition': `attachment; filename="${record.id}.json"` }
	});
};
