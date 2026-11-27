/**
 * The text of a case's opinions, each on its own, for the folding sections
 * of the case's page (src/lib/components/CaseOpinions.svelte; Trevor chose
 * design B on Nov. 27, 2026, design/case-opinion-reader/).
 *
 * The text is read from the copy of the opinions this site already serves at
 * /copies/<key>, the one the case's built data names, never from anywhere a
 * reader can choose. So whatever governs that copy governs this: it must be
 * on the build-time list of served copies, a nation's "Cite only" or "Hide"
 * stops it as it stops the copy (src/lib/server/nation-restrictions.ts), and
 * the bucket's file must be the one indexed, byte for byte. Nothing of the text is in the
 * Worker's code or the page's built data.
 */
import { error, json } from '@sveltejs/kit';
import type { CasePage } from '#lib/server/case-pages.ts';
import { builtPageData } from '#lib/server/page-data.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { servedCopy } from '#lib/server/copy-list.ts';
import { copyLevel } from '#lib/server/nation-restrictions.ts';
import { hexDigest } from '#lib/server/public-copy-serving.ts';
import { opinionTexts, type CaseOpinionTexts } from '#lib/opinion-text.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url }) => {
	const page = await builtPageData<CasePage>('cases', params.id, url);
	const copy = page.opinionCopy ? await servedCopy(page.opinionCopy) : undefined;
	if (!copy || copy.mediaType !== 'text/html') error(404, 'This site does not keep the text of this case’s opinions.');
	const environment = workerEnvironment();
	if ((await copyLevel(environment.database, copy)) !== 'show') error(404, 'This case’s opinions are not shown on this site.');
	const bucket = environment.sourceDocuments;
	if (!bucket) error(503, 'The opinions cannot be read right now.');
	const stored = await bucket.get(copy.key);
	const bytes = stored ? await stored.arrayBuffer() : undefined;
	// Only the file indexed with the site: a copy replaced in the bucket before its deploy is not shown until then.
	if (!bytes || bytes.byteLength !== copy.bytes || (await hexDigest(bytes)) !== copy.sha256) error(503, 'The opinions cannot be read right now.');
	const opinions = opinionTexts(new TextDecoder().decode(bytes));
	if (opinions.length === 0) error(503, 'The opinions cannot be read right now.');
	const body: CaseOpinionTexts = { opinions };
	return json(body, {
		headers: {
			// The same for every reader until the copy changes; a nation's choice applies within minutes (tools/edge-cache-worker.js).
			'cache-control': copy.restrict ? 'public, max-age=300' : 'public, max-age=86400'
		}
	});
};
