import { error } from '@sveltejs/kit';
import { proofOf } from '#lib/server/nation-teams.ts';
import { heldFileAnswer, openScannedFile } from '#lib/server/file-scans.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/**
 * Downloads the proof sent with a request to join a nation's team, for the
 * lead author only. Always downloaded, never shown as a page of this site,
 * and never cached, so an uploaded file cannot run in the site's name. Held
 * until the virus check passes (site/SCANNING.md).
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-people');
	const { database, bucket } = storage(event);
	const proof = await proofOf(database, event.params.reference);
	if (!proof) error(404, 'No such file.');
	const opened = await openScannedFile(database, bucket, proof.key);
	if (opened.state !== 'ready') {
		const answer = heldFileAnswer(opened);
		error(answer.status, answer.message);
	}
	const object = opened.object;
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
