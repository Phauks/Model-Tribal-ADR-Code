/**
 * One piece of a file, sent as the request body (docs/uploads.md). Each is
 * at most 10 MB, well under the Workers request size limit.
 */
import { error, json } from '@sveltejs/kit';
import { pieceBytes } from '#lib/uploads.ts';
import { answering, senderUpload } from '#lib/server/upload-requests.ts';
import { receivePiece } from '#lib/server/uploads.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const PUT: RequestHandler = (event) =>
	answering(async () => {
		const { database, bucket } = storage(event);
		const upload = await senderUpload(event, database);
		const declared = Number(event.request.headers.get('content-length') ?? 0);
		if (declared > pieceBytes) error(413, 'This piece is too large.');
		const bytes = new Uint8Array(await event.request.arrayBuffer());
		if (bytes.byteLength > pieceBytes) error(413, 'This piece is too large.');
		const outcome = await receivePiece(database, bucket, upload, Number(event.params.number), bytes);
		return json(outcome, { status: outcome.accepted ? 200 : 422, headers: { 'cache-control': 'no-store' } });
	});
