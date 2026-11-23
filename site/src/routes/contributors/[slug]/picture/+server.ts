import { error } from '@sveltejs/kit';
import { contributorPictureKey } from '#lib/server/contributor-pages.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The picture on a contributor's page, served from the private bucket only
 * while the page shows it (docs/contributor-profiles.md, "Profile pictures").
 */
export const GET: RequestHandler = async ({ params }) => {
	const { database, sourceDocuments: bucket } = workerEnvironment();
	const key = database && bucket ? await contributorPictureKey(database, params.slug) : undefined;
	const object = key ? await bucket!.get(key) : null;
	if (!object) error(404, 'There is no picture here.');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': 'image/jpeg',
			// The page's address for the picture changes when the picture does.
			'cache-control': 'public, max-age=86400',
			'x-content-type-options': 'nosniff',
			'content-disposition': 'inline'
		}
	});
};
