import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import { joinedRoom, mayWatchRecordings, recordingOfRoom } from '#lib/server/video-rooms.ts';
import type { RequestHandler } from './$types';
import { findRoom, hostsRoom } from '../../../find-room.ts';

/**
 * One recording of a room of its own, from the private bucket, to the people
 * the room allows, and only once the virus check has passed
 * (site/SCANNING.md). Byte ranges let the player seek.
 */
export const GET: RequestHandler = async (event) => {
	const environment = workerEnvironment();
	const database = environment.database;
	const bucket = environment.sourceDocuments;
	if (!database || !bucket) error(503, 'The database is not connected.');
	const room = await findRoom(database, event.params.room);
	const recording = await recordingOfRoom(database, room.identifier, event.params.recording);
	if (!recording || !recording.objectKey) error(404, 'There is no recording at this address.');
	const account = event.locals.account;
	const host = hostsRoom(room, event.locals.person, account);
	const joined = account ? await joinedRoom(database, room.identifier, account.subject) : false;
	const allowed = mayWatchRecordings(room, { signedIn: Boolean(account), host, joined });
	if (!allowed || (recording.hidden && !host)) error(404, 'There is no recording at this address.');
	return serveUploadFile(
		event.request,
		bucket,
		{ key: recording.objectKey, name: 'room-recording.mp4', mediaType: 'video/mp4', kind: 'video' },
		{ inline: event.url.searchParams.get('download') !== '1', cacheControl: 'private, no-store', scan: await fileScan(database, recording.objectKey) }
	);
};
