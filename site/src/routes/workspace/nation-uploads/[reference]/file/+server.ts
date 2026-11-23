/**
 * A file people sent about the nation, for that nation's reviewer. "?show"
 * plays a picture, recording or video in the page; otherwise the file is
 * downloaded. A picture is always the copy without its location.
 */
import { error } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import { nationUpload } from '#lib/server/uploads.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const person = requirePermission(event, 'comment-on-nation-uploads');
	const { database, bucket } = storage(event);
	if (!isUploadReference(event.params.reference)) error(404, 'There is no such file.');
	const found = await nationUpload(database, person, event.params.reference);
	const upload = found?.upload;
	if (!upload || upload.source !== 'file' || !upload.kind) error(404, 'There is no file for this upload.');
	const key = upload.preview_key ?? upload.original_key;
	if (!key) error(404, 'There is no file for this upload.');
	return serveUploadFile(
		event.request,
		bucket,
		{
			key,
			name: upload.file_name ?? upload.reference,
			mediaType: upload.media_type ?? 'application/octet-stream',
			kind: upload.kind
		},
		{ inline: event.url.searchParams.has('show'), cacheControl: 'private, no-store' }
	);
};
