import { error } from '@sveltejs/kit';
import { heldFileAnswer } from '#lib/server/file-scans.ts';
import { openProblemPhoto } from '#lib/server/book-order-problems.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

// A photo a buyer sent with a problem (docs/book-orders.md, "Your orders and
// problems"), for the lead author to see and pass to Lulu. It came from
// outside, so it opens only through the scan door (site/SCANNING.md), and
// only the image types checked on upload are served.
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-book-orders');
	const { database, bucket } = storage(event);
	const photo = await openProblemPhoto(database, bucket, event.params.problem);
	if (!photo) error(404, 'No photo.');
	if (photo.opened.state !== 'ready') {
		const answer = heldFileAnswer(photo.opened);
		error(answer.status, answer.message);
	}
	return new Response(photo.opened.object.body as unknown as ReadableStream, {
		headers: {
			'content-type': photo.type,
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox",
			'cache-control': 'private, no-store'
		}
	});
};
