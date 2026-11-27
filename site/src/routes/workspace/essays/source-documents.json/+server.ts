/**
 * Links to the documents of the sources an essay cites (the original, an
 * archived copy, the copy this site keeps), for the editor's Sources panel
 * and the line shown when the cursor is on a citation. The editor asks only
 * for the keys it needs: every source's links at once would be about a
 * megabyte. Any signed-in workspace member may read it: it holds only what
 * the public pages already show.
 */
import { json } from '@sveltejs/kit';
import { citationsFor } from '#lib/server/essay-citations.ts';
import { requirePersonForData } from '#lib/server/workspace.ts';
import { sourceDocuments, type SourceDocuments } from '#lib/essays/source-documents.ts';
import { keyPattern } from '#lib/essays/syntax.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const key = new RegExp(`^${keyPattern}$`);

export const GET: RequestHandler = async (event) => {
	requirePersonForData(event);
	const keys = (event.url.searchParams.get('keys') ?? '')
		.split(',')
		.filter((candidate) => key.test(candidate))
		.slice(0, 500);
	const citations = await citationsFor(keys);
	const documents: Record<string, SourceDocuments> = {};
	for (const wanted of keys) {
		const html = citations.get(wanted);
		documents[wanted] = html ? sourceDocuments(html) : {};
	}
	return json(documents, { headers: { 'Cache-Control': 'private, max-age=3600' } });
};
