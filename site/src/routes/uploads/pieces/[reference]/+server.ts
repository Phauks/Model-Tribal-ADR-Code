/** Which pieces of a file have arrived, so the Send files page can pick up where it stopped. */
import { json } from '@sveltejs/kit';
import { senderUpload } from '#lib/server/upload-requests.ts';
import { pieceCount, receivedPieces } from '#lib/server/uploads.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const { database } = storage(event);
	const upload = await senderUpload(event, database);
	return json(
		{
			status: upload.status,
			pieceCount: upload.size_bytes ? pieceCount(upload.size_bytes) : 0,
			received: upload.status === 'sending' ? await receivedPieces(database, upload) : []
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
