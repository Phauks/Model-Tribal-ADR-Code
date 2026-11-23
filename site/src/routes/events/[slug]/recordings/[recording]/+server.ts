import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { registrationFor } from '#lib/server/event-calendar.ts';
import { mayWatchRecordings, recordingOfRoom, roomOfEvent } from '#lib/server/video-rooms.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import type { RequestHandler } from './$types';
import { findEvent, isHost } from '../../find-event.ts';

/**
 * One recording of an event's room, from the private bucket, to the people
 * the event allows, and only once the virus check has passed
 * (site/SCANNING.md). Byte ranges let the player seek.
 */
export const GET: RequestHandler = async (event) => {
	const found = await findEvent(event);
	const environment = workerEnvironment();
	const database = environment.database;
	const bucket = environment.sourceDocuments;
	if (!database || !bucket) error(503, 'The database is not connected.');
	const room = await roomOfEvent(database, found.identifier);
	const recording = room ? await recordingOfRoom(database, room.identifier, event.params.recording) : undefined;
	if (!room || !recording || !recording.objectKey) error(404, 'There is no recording at this address.');
	const host = isHost(event.locals.person);
	const account = event.locals.account;
	const own = account ? await registrationFor(database, found.identifier, account.subject) : undefined;
	const allowed = mayWatchRecordings(room, { signedIn: Boolean(account), host, registered: own?.status === 'registered' });
	if (!allowed || (recording.hidden && !host)) error(404, 'There is no recording at this address.');
	return serveUploadFile(
		event.request,
		bucket,
		{ key: recording.objectKey, name: `${found.slug}-recording.mp4`, mediaType: 'video/mp4', kind: 'video' },
		{ inline: event.url.searchParams.get('download') !== '1', cacheControl: 'private, no-store', scan: await fileScan(database, recording.objectKey) }
	);
};
