/**
 * The reading version of a copy this site keeps (src/lib/reading-text.ts):
 * its words as page text in the site's own type, with the citations in them
 * linked (src/lib/text-links.ts), for the document text card
 * (src/lib/components/DocumentText.svelte) and for its downloads.
 *
 *   /copies/reading/<key>.json   what the card shows
 *   /copies/reading/<key>.md     the reading version as Markdown
 *   /copies/reading/<key>.html   the reading version as a web page of its own
 *
 * The words are read from the copy this site already serves at
 * /copies/<key>, so whatever governs that copy governs this: it must be on
 * the build-time list of served copies, a nation's "Cite only" or "Hide"
 * stops it as it stops the copy (src/lib/server/nation-restrictions.ts), and
 * the bucket's file must be the one indexed, byte for byte. The served file
 * is never changed: its SHA-256 must match the publisher's.
 */
import { error, json } from '@sveltejs/kit';
import { readingHtmlDocument, readingMarkdown, readingText } from '#lib/reading-text.ts';
import { linkCitations, citationKeys } from '#lib/text-links.ts';
import { hiddenCopyMessage } from '#lib/nation-restrictions.ts';
import { copyPath } from '#lib/public-copies.ts';
import { readableDate } from '#lib/readable-date.ts';
import { suggestionPath, type ReadingAnswer, type ReadingRestricted } from '#lib/document-text.ts';
import { copyDetailsOf } from '#lib/server/copy-details.ts';
import { servedCopy } from '#lib/server/copy-list.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { copyLevel } from '#lib/server/nation-restrictions.ts';
import { hexDigest } from '#lib/server/public-copy-serving.ts';
import { textLinkPages } from '#lib/server/text-link-pages.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const formats = { json: 'application/json', md: 'text/markdown; charset=utf-8', html: 'text/html; charset=utf-8' } as const;

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const asked = /^(.+)\.(json|md|html)$/.exec(params.key);
	if (!asked) error(404, 'Ask for the reading version as .json, .md or .html.');
	const [, key, format] = asked as unknown as [string, string, keyof typeof formats];
	const copy = await servedCopy(key);
	if (!copy || (copy.mediaType !== 'text/plain' && copy.mediaType !== 'text/html')) error(404, 'This site keeps no text at this address.');
	const environment = workerEnvironment();
	const level = await copyLevel(environment.database, copy);
	if (level === 'hide') error(404, hiddenCopyMessage);
	if (level === 'cite') {
		const body: ReadingRestricted = { restricted: 'cite' };
		return json(body, { status: 403, headers: { 'cache-control': 'no-store' } });
	}
	const bucket = environment.sourceDocuments;
	if (!bucket) error(503, 'The text cannot be read right now.');
	const stored = await bucket.get(copy.key);
	const bytes = stored ? await stored.arrayBuffer() : undefined;
	// Only the file indexed with the site: a copy replaced in the bucket before its deploy is not shown until then.
	if (!bytes || bytes.byteLength !== copy.bytes || (await hexDigest(bytes)) !== copy.sha256) error(503, 'The text cannot be read right now.');
	let words: string;
	try {
		words = new TextDecoder(copy.charset ?? 'utf-8').decode(bytes);
	} catch {
		words = new TextDecoder().decode(bytes);
	}
	const original = copy.links.at(-1) ?? copy.links[0];
	const reading = readingText(words, copy.mediaType, original, suggestionPath(copy.key));
	if (!reading) error(404, 'This site keeps no text at this address.');
	// "section 5321 of this title" in a text of Title 25 of the Code (?title=25).
	const codeTitle = /^\d{1,2}$/.test(url.searchParams.get('title') ?? '') ? (url.searchParams.get('title') as string) : undefined;
	try {
		const pages = await textLinkPages(citationKeys(reading.html, { codeTitle }));
		reading.html = linkCitations(reading.html, pages, { codeTitle });
	} catch {
		// Without the index the text still shows, its citations plain.
	}
	const caching = { 'cache-control': copy.restrict ? 'public, max-age=300' : 'public, max-age=86400' };
	if (format === 'json') {
		const body: ReadingAnswer = reading;
		return json(body, { headers: caching });
	}
	const details = await copyDetailsOf(copy, url, fetch);
	const about = {
		title: details?.opinion?.name ?? details?.title ?? key.split('/').at(-1) ?? key,
		citation: details?.citation ? details.citation.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&') : details?.opinion?.citation,
		original: details?.opinion?.namesReplaced ? undefined : original,
		copy: copyPath(copy),
		sha256: copy.sha256,
		captured: details?.captured ? readableDate(details.captured) : undefined
	};
	const site = url.origin;
	const name = `${(key.split('/').at(-1) ?? 'document').replace(/\.[a-z]+$/i, '')}.${format}`;
	const body = format === 'md' ? readingMarkdown(reading, about, site) : readingHtmlDocument(reading, about, site);
	return new Response(body, {
		headers: {
			...caching,
			'content-type': formats[format],
			'content-disposition': `attachment; filename="${name.replace(/[^\w.-]/g, '_')}"`,
			// A web page of words only: nothing in it runs or loads.
			...(format === 'html' ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
			'x-content-type-options': 'nosniff'
		}
	});
};
