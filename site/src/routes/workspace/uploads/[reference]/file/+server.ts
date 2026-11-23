/**
 * A file people sent, for reviewers. "?show" plays a picture, recording or
 * video in the review page; otherwise the file is downloaded. "?original"
 * gives the file exactly as sent, rather than a picture's copy without its
 * location.
 */
import { error } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import { uploadByReference } from '#lib/server/uploads.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'review-uploads');
	const { database, bucket } = storage(event);
	if (!isUploadReference(event.params.reference)) error(404, 'There is no such upload.');
	const upload = await uploadByReference(database, event.params.reference);
	if (!upload || upload.source !== 'file' || !upload.kind || upload.deleted_at) error(404, 'There is no file for this upload.');
	const original = event.url.searchParams.has('original');
	const key = original ? upload.original_key : (upload.preview_key ?? upload.original_key);
	if (!key) error(404, 'There is no file for this upload.');
	return serveUploadFile(
		event.request,
		bucket,
		{
			key,
			name: upload.file_name ?? `${upload.reference}`,
			mediaType: upload.media_type ?? 'application/octet-stream',
			kind: upload.kind
		},
		{ inline: event.url.searchParams.has('show') && !original, cacheControl: 'private, no-store' }
	);
};
