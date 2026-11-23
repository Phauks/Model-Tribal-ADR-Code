/**
 * Serves a picture a nation's team added to its page, from the private
 * bucket. Only pictures in the version live now are served, so a picture the
 * nation removed stops showing at once. Pages start with no pictures: the
 * project does not choose pictures for nations (Trevor, Nov. 23, 2026). A
 * picture is served only once the virus check passes (site/SCANNING.md).
 */
import { error } from '@sveltejs/kit';
import { pictureKey } from '#lib/nation-page-changes.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { openScannedFile } from '#lib/server/file-scans.ts';
import { liveChanges } from '#lib/server/nation-page-changes.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const { database, sourceDocuments } = workerEnvironment();
	if (!database || !sourceDocuments) error(503, 'Pictures cannot be served right now.');
	const live = await liveChanges(database, params.id);
	const picture = live.pictures?.content.pictures.find((candidate) => candidate.identifier === params.picture);
	if (!picture) error(404, 'No such picture on this page.');
	const opened = await openScannedFile(database, sourceDocuments, pictureKey(params.id, picture.identifier));
	if (opened.state !== 'ready') error(404, 'No such picture on this page.');
	const stored = opened.object;
	return new Response(await stored.arrayBuffer(), {
		headers: {
			'Content-Type': picture.type,
			// Five minutes, so a picture the nation removes stops showing soon.
			'Cache-Control': 'public, max-age=300',
			'X-Content-Type-Options': 'nosniff',
			'Cross-Origin-Resource-Policy': 'same-origin'
		}
	});
};
