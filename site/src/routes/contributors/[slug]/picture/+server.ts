import { error } from '@sveltejs/kit';
import { contributorPictureKey } from '#lib/server/contributor-pages.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { openScannedFile } from '#lib/server/file-scans.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The picture on a contributor's page, served from the private bucket only
 * while the page shows it (docs/contributor-profiles.md, "Profile pictures")
 * and once the virus check passes (site/SCANNING.md).
 */
export const GET: RequestHandler = async ({ params }) => {
	const { database, sourceDocuments: bucket } = workerEnvironment();
	const key = database && bucket ? await contributorPictureKey(database, params.slug) : undefined;
	const opened = key ? await openScannedFile(database!, bucket!, key) : null;
	if (!opened || opened.state !== 'ready') error(404, 'There is no picture here.');
	const object = opened.object;
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
