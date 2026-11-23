import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { materialOf } from '#lib/server/event-calendar.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import type { RequestHandler } from './$types';
import { findEvent } from '../../find-event.ts';

/**
 * One of an event's materials, such as its written materials or slides, from
 * the private bucket. Open to everyone who can see the event, and only once
 * the virus check has passed (site/SCANNING.md). Always a download.
 */
export const GET: RequestHandler = async (event) => {
	const found = await findEvent(event);
	const environment = workerEnvironment();
	const database = environment.database;
	const bucket = environment.sourceDocuments;
	if (!database || !bucket) error(503, 'The database is not connected.');
	const material = await materialOf(database, found.identifier, event.params.material);
	if (!material) error(404, 'There is no file at this address.');
	return serveUploadFile(
		event.request,
		bucket,
		{ key: material.objectKey, name: material.fileName, mediaType: material.contentType, kind: 'document' },
		{ inline: false, cacheControl: 'private, no-store', scan: await fileScan(database, material.objectKey) }
	);
};
