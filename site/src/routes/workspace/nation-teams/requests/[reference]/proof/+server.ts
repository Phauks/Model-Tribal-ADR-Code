import { error } from '@sveltejs/kit';
import { proofOf } from '#lib/server/nation-teams.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/**
 * Downloads the proof sent with a request to join a nation's team, for the
 * lead author only. Always downloaded, never shown as a page of this site,
 * and never cached, so an uploaded file cannot run in the site's name.
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-people');
	const { database, bucket } = storage(event);
	const proof = await proofOf(database, event.params.reference);
	if (!proof) error(404, 'No such file.');
	const object = await bucket.get(proof.key);
	if (!object) error(404, 'The file is no longer stored.');
	// Header values must be plain ASCII; the full name goes in filename*.
	const plainName = proof.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': proof.type,
			'content-disposition': `attachment; filename="${plainName}"; filename*=UTF-8''${encodeURIComponent(proof.name)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'no-store'
		}
	});
};
