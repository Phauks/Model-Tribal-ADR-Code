/**
 * Serves a copy of a public document, such as a Statutes at Large page, from
 * the private sourceDocuments bucket (src/lib/public-copies.ts). Only copies
 * on the build-time list are served; any other key is "not found", whatever
 * the bucket holds. A copy of a nation's law or court opinion is not served
 * when the nation has chosen "Cite only" or "Hide" for it
 * (src/lib/nation-restrictions.ts): "Cite only" sends the reader to the
 * copy's page, which links to where the original is kept, and "Hide" answers
 * without naming it.
 */
import { error, redirect } from '@sveltejs/kit';
import { publicCopies } from 'virtual:public-copies';
import { hiddenCopyMessage } from '#lib/nation-restrictions.ts';
import { copyPagePath } from '#lib/public-copies.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { copyLevel } from '#lib/server/nation-restrictions.ts';
import { servePublicCopy } from '#lib/server/public-copy-serving.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const byKey = new Map(publicCopies.map((copy) => [copy.key, copy]));

export const GET: RequestHandler = async ({ params, request, setHeaders }) => {
	const copy = byKey.get(params.key);
	if (!copy) error(404, 'This site keeps no copy at this address.');
	const environment = workerEnvironment();
	const level = await copyLevel(environment.database, copy);
	if (level !== 'show') {
		setHeaders({ 'cache-control': 'no-store' });
		if (level === 'hide') error(404, hiddenCopyMessage);
		redirect(302, copyPagePath(copy));
	}
	const bucket = environment.sourceDocuments;
	if (!bucket) {
		// A redacted opinion has no address to send a reader to: its original still has the names in it.
		if (!copy.links[0]) error(503, 'This copy is not available right now.');
		return new Response(null, { status: 302, headers: { Location: copy.links[0], 'Cache-Control': 'no-store' } });
	}
	const response = await servePublicCopy(request, copy, bucket);
	// A nation may restrict its laws and opinions at any time, and the change should show within minutes.
	if (copy.restrict && response.headers.get('Cache-Control')?.startsWith('public')) response.headers.set('Cache-Control', 'public, max-age=300');
	return response;
};
