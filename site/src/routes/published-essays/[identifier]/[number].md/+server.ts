/**
 * One published essay version as Markdown, exactly as saved, for the git
 * copy and the print and ebook builds (docs/editing.md). Only listed
 * publications are served.
 */
import { error } from '@sveltejs/kit';
import { publications, readVersionText } from '#lib/server/essays.ts';
import { storageForPages } from '#lib/server/essay-pages.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const number = Number(params.number);
	if (!Number.isInteger(number) || number < 1) error(404, 'No such publication.');
	const { database, bucket } = storageForPages();
	const row = (await publications(database, params.identifier, true)).find((candidate) => candidate.number === number);
	if (!row?.object_key) error(404, 'No such publication.');
	const text = await readVersionText(bucket, { object_key: row.object_key });
	return new Response(text, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
			'X-Content-SHA256': row.sha256 ?? ''
		}
	});
};
