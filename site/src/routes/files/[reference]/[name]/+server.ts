/**
 * A filed file on the site's pages (docs/uploads.md): a picture, recording
 * or video shown on a nation page, a story or an essay, or a document to
 * download. Served to everyone only once it is filed for everyone (or its
 * embargo has passed, or its essay is published). Reviewers can always see
 * it, and an essay figure is shown to anyone with comment access to its essay. The name in the address is for people and is not checked.
 */
import { error } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import { isPublicFile, maySeeFiledFile, scanOfKey, uploadByReference } from '#lib/server/uploads.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	if (!isUploadReference(event.params.reference)) error(404, 'Not found.');
	const { database, bucket } = storage(event);
	const upload = await uploadByReference(database, event.params.reference);
	if (!upload || upload.source !== 'file' || !upload.kind || !upload.filed_key) error(404, 'Not found.');
	const everyone = await isPublicFile(database, upload);
	if (!everyone && !(await maySeeFiledFile(database, event.locals.person, upload))) error(404, 'Not found.');
	return serveUploadFile(
		event.request,
		bucket,
		{
			key: upload.filed_key,
			name: upload.file_name ?? upload.reference,
			mediaType: upload.media_type ?? 'application/octet-stream',
			kind: upload.kind
		},
		// An hour for everyone, so a file taken down stops being served soon; never cached when private.
		{
			inline: true,
			cacheControl: everyone ? 'public, max-age=3600' : 'private, no-store',
			scan: await scanOfKey(database, upload.filed_key)
		}
	);
};
