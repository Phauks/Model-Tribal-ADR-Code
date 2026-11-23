/** Joins the pieces once all have arrived and puts the file in line for review. */
import { json } from '@sveltejs/kit';
import { answering, senderUpload } from '#lib/server/upload-requests.ts';
import { wakeScanner } from '#lib/server/scanner-wake.ts';
import { finishUpload } from '#lib/server/uploads.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = (event) =>
	answering(async () => {
		const { database, bucket } = storage(event);
		const upload = await senderUpload(event, database);
		const status = await finishUpload(database, bucket, upload);
		if (status === 'checking') wakeScanner();
		return json({ status, reference: upload.reference }, { headers: { 'cache-control': 'no-store' } });
	});
