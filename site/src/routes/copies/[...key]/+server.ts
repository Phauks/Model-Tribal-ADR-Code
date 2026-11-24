/**
 * Serves a copy of a public document, such as a Statutes at Large page, from
 * the private sourceDocuments bucket (src/lib/public-copies.ts). Only copies
 * on the build-time list are served; any other key is "not found", whatever
 * the bucket holds.
 */
import { error } from '@sveltejs/kit';
import { publicCopies } from 'virtual:public-copies';
import { workerEnvironment } from '#lib/server/environment.ts';
import { servePublicCopy } from '#lib/server/public-copy-serving.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const byKey = new Map(publicCopies.map((copy) => [copy.key, copy]));

export const GET: RequestHandler = async ({ params, request }) => {
	const copy = byKey.get(params.key);
	if (!copy) error(404, 'This site keeps no copy at this address.');
	const bucket = workerEnvironment().sourceDocuments;
	if (!bucket) {
		// A redacted opinion has no address to send a reader to: its original still has the names in it.
		if (!copy.links[0]) error(503, 'This copy is not available right now.');
		return new Response(null, { status: 302, headers: { Location: copy.links[0], 'Cache-Control': 'no-store' } });
	}
	return servePublicCopy(request, copy, bucket);
};
