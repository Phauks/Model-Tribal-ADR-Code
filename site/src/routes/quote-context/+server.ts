/**
 * A quotation in its paragraph, with the paragraph before and after, for the
 * "Show the paragraph" button under each quotation in an essay
 * (src/lib/essays/quote-context-view.ts). Only documents the website serves
 * at /copies/ are read (src/lib/server/quote-context.ts), so the answer is
 * the same for everyone and is kept in the Worker's cache for a day.
 *
 * GET /quote-context?source=<record key>&quote=<the quoted words>
 */
import { error, json } from '@sveltejs/kit';
import { version as siteBuild } from '$app/env';
import { workerEnvironment } from '#lib/server/environment.ts';
import { findQuotation, isSourceKey, longestQuotation } from '#lib/server/quote-context.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const day = 24 * 60 * 60;

export const GET: RequestHandler = async ({ url }) => {
	const source = url.searchParams.get('source') ?? '';
	const quote = (url.searchParams.get('quote') ?? '').normalize('NFC').trim();
	if (!isSourceKey(source)) error(400, 'Name the source by its key.');
	if (!quote || quote.length > longestQuotation) error(400, 'Send the quoted words.');
	const database = workerEnvironment().sourceLibrary;
	if (!database) error(503, 'The source library is not connected.');

	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = `https://quote-context.invalid/${encodeURIComponent(siteBuild)}/${encodeURIComponent(source)}?${new URLSearchParams({ quote })}`;
	const cached = cache ? await cache.match(cacheKey).catch(() => undefined) : undefined;
	if (cached) return cached;

	const { found, documents } = await findQuotation(database, source, quote, { publicOnly: true });
	// When the words are not found, the copy looked in is still named, for the reader to read it whole.
	const answer = found ?? { document: documents[0] ?? null, context: null };
	const response = json(answer, { headers: { 'Cache-Control': `public, max-age=${day}` } });
	if (cache) await cache.put(cacheKey, response.clone()).catch(() => undefined);
	return response;
};
