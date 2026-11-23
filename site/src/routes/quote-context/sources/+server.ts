/**
 * Which of a page's quoted sources readers can open in context: the source
 * records with the text of a document the website serves
 * (src/lib/server/quote-context.ts). The essay page asks once and shows the
 * "Show the paragraph" button only under those quotations.
 *
 * GET /quote-context/sources?keys=<key>,<key>,...
 */
import { error, json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { sourcesWithPublicText } from '#lib/server/quote-context.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	const keys = (url.searchParams.get('keys') ?? '').split(',').map((key) => key.trim()).filter(Boolean);
	if (keys.length > 300) error(400, 'Ask about at most 300 sources at once.');
	const database = workerEnvironment().sourceLibrary;
	if (!database) return json({ sources: [] });
	const sources = await sourcesWithPublicText(database, keys).catch((problem) => {
		console.error('Quoted sources could not be read', problem);
		return [];
	});
	return json({ sources }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
};
