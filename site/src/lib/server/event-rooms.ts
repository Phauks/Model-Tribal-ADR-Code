/**
 * The events video room in the database, and the run that copies its
 * recordings into the private bucket
 * (migrations/20261123T0452_add_event_video_rooms.sql; site/COLLABORATION.md,
 * "The video room").
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { RecordingChoice } from '#lib/event-calendar.ts';
import type { RecordingWatchers, RoomStyle } from '#lib/event-rooms.ts';
import { requestScan } from './file-scans.ts';
import { meetingRecordings, type Fetcher, type RemoteRecording, type VideoRoomSettings } from './realtime-kit.ts';

export interface EventRoom {
	eventIdentifier: string;
	style: RoomStyle;
	watchers: RecordingWatchers;
	meeting: string | null;
	createdAt: string;
	updatedAt: string;
}

const roomColumns = `event_identifier AS eventIdentifier, style, watchers, meeting, created_at AS createdAt, updated_at AS updatedAt`;

/** The event's room, or undefined when the event does not use the site's own room. */
export async function roomOf(database: D1Database, eventIdentifier: string): Promise<EventRoom | undefined> {
	return (await database.prepare(`SELECT ${roomColumns} FROM calendar_rooms WHERE event_identifier = ?`).bind(eventIdentifier).first<EventRoom>()) ?? undefined;
}

/** Turns the room on for an event, or changes its style or who may watch its recordings. */
export async function saveRoom(
	database: D1Database,
	eventIdentifier: string,
	input: { style: RoomStyle; watchers: RecordingWatchers },
	time: Date = new Date()
): Promise<void> {
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO calendar_rooms (event_identifier, style, watchers, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (event_identifier) DO UPDATE SET style = excluded.style, watchers = excluded.watchers, updated_at = excluded.updated_at`
		)
		.bind(eventIdentifier, input.style, input.watchers, at, at)
		.run();
}

/**
 * Turns the room off. A room that has recordings stays, so a recording is
 * never lost by turning the room off; returns whether it was removed.
 */
export async function removeRoom(database: D1Database, eventIdentifier: string): Promise<boolean> {
	const result = await database
		.prepare(
			`DELETE FROM calendar_rooms WHERE event_identifier = ?
			 AND NOT EXISTS (SELECT 1 FROM calendar_recordings WHERE event_identifier = ?)`
		)
		.bind(eventIdentifier, eventIdentifier)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/**
 * Keeps the RealtimeKit meeting made for a room. If two people opened the
 * room at the same moment and two meetings were made, the first one kept wins
 * and both get it back.
 */
export async function keepMeeting(database: D1Database, eventIdentifier: string, meeting: string, time: Date = new Date()): Promise<string> {
	await database
		.prepare('UPDATE calendar_rooms SET meeting = ?, updated_at = ? WHERE event_identifier = ? AND meeting IS NULL')
		.bind(meeting, time.toISOString(), eventIdentifier)
		.run();
	const kept = await database.prepare('SELECT meeting FROM calendar_rooms WHERE event_identifier = ?').bind(eventIdentifier).first<{ meeting: string | null }>();
	return kept?.meeting ?? meeting;
}

export interface RoomPerson {
	eventIdentifier: string;
	accountIdentifier: string;
	role: 'host' | 'guest';
	participant: string | null;
	toldRecording: RecordingChoice;
	toldAt: string;
	lastJoinedAt: string;
}

const personColumns = `event_identifier AS eventIdentifier, account_identifier AS accountIdentifier, role, participant,
	told_recording AS toldRecording, told_at AS toldAt, last_joined_at AS lastJoinedAt`;

export async function roomPerson(database: D1Database, eventIdentifier: string, accountIdentifier: string): Promise<RoomPerson | undefined> {
	return (
		(await database
			.prepare(`SELECT ${personColumns} FROM calendar_room_people WHERE event_identifier = ? AND account_identifier = ?`)
			.bind(eventIdentifier, accountIdentifier)
			.first<RoomPerson>()) ?? undefined
	);
}

/**
 * Notes that a person was told about recording and let in. This is the log of
 * who was told what (like Magna Carta's meetings): each visit records the
 * event's recording choice at that moment.
 */
export async function noteRoomVisit(
	database: D1Database,
	input: { eventIdentifier: string; accountIdentifier: string; role: 'host' | 'guest'; toldRecording: RecordingChoice; participant?: string | null },
	time: Date = new Date()
): Promise<void> {
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO calendar_room_people (event_identifier, account_identifier, role, participant, told_recording, told_at, last_joined_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (event_identifier, account_identifier) DO UPDATE SET
				role = excluded.role,
				participant = COALESCE(excluded.participant, calendar_room_people.participant),
				told_recording = excluded.told_recording, told_at = excluded.told_at, last_joined_at = excluded.last_joined_at`
		)
		.bind(input.eventIdentifier, input.accountIdentifier, input.role, input.participant ?? null, input.toldRecording, at, at)
		.run();
}

export interface RoomVisitor extends RoomPerson {
	name: string;
}

/** Who was let into a room and what each was told, for the hosts. */
export async function roomVisitors(database: D1Database, eventIdentifier: string): Promise<RoomVisitor[]> {
	const { results } = await database
		.prepare(
			`SELECT ${personColumns.replaceAll('event_identifier', 'p.event_identifier').replaceAll('account_identifier', 'p.account_identifier')},
				COALESCE(
					(SELECT r.name FROM calendar_registrations r WHERE r.event_identifier = p.event_identifier AND r.account_identifier = p.account_identifier ORDER BY r.registered_at DESC LIMIT 1),
					(SELECT people.display_name FROM people WHERE people.sign_in_subject = p.account_identifier),
					'Someone signed in'
				) AS name
			 FROM calendar_room_people p WHERE p.event_identifier = ? ORDER BY p.told_at`
		)
		.bind(eventIdentifier)
		.all<RoomVisitor>();
	return results;
}

export interface EventRecording {
	identifier: string;
	eventIdentifier: string;
	status: string;
	startedAt: string | null;
	stoppedAt: string | null;
	durationSeconds: number | null;
	sizeBytes: number | null;
	objectKey: string | null;
	copiedAt: string | null;
	copyAttempts: number;
	copyProblem: string | null;
	hidden: boolean;
}

interface RecordingRow extends Omit<EventRecording, 'hidden'> {
	hidden: number;
}

const recordingColumns = `identifier, event_identifier AS eventIdentifier, status, started_at AS startedAt, stopped_at AS stoppedAt,
	duration_seconds AS durationSeconds, size_bytes AS sizeBytes, object_key AS objectKey, copied_at AS copiedAt,
	copy_attempts AS copyAttempts, copy_problem AS copyProblem, hidden`;

function recordingOf(row: RecordingRow): EventRecording {
	return { ...row, hidden: row.hidden === 1 };
}

export async function recordingsOf(database: D1Database, eventIdentifier: string): Promise<EventRecording[]> {
	const { results } = await database
		.prepare(`SELECT ${recordingColumns} FROM calendar_recordings WHERE event_identifier = ? ORDER BY COALESCE(started_at, created_at)`)
		.bind(eventIdentifier)
		.all<RecordingRow>();
	return results.map(recordingOf);
}

export async function recordingOfEvent(database: D1Database, eventIdentifier: string, identifier: string): Promise<EventRecording | undefined> {
	const row = await database
		.prepare(`SELECT ${recordingColumns} FROM calendar_recordings WHERE event_identifier = ? AND identifier = ?`)
		.bind(eventIdentifier, identifier)
		.first<RecordingRow>();
	return row ? recordingOf(row) : undefined;
}

export async function setRecordingHidden(database: D1Database, eventIdentifier: string, identifier: string, hidden: boolean, time: Date = new Date()): Promise<boolean> {
	const result = await database
		.prepare('UPDATE calendar_recordings SET hidden = ?, updated_at = ? WHERE event_identifier = ? AND identifier = ?')
		.bind(hidden ? 1 : 0, time.toISOString(), eventIdentifier, identifier)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Where our copy of a recording is kept in the private bucket. */
export function recordingObjectKey(eventIdentifier: string, identifier: string): string {
	return `event-recordings/${eventIdentifier}/${identifier}.mp4`;
}

/**
 * Who may watch a room's recordings. Hosts always may, hidden recordings
 * included; others only what the event's setting allows, and never before the
 * virus check passes (checked where the file is served).
 */
export function mayWatchRecordings(
	room: Pick<EventRoom, 'watchers'>,
	viewer: { signedIn: boolean; host: boolean; registered: boolean }
): boolean {
	if (viewer.host) return true;
	if (!viewer.signedIn) return false;
	if (room.watchers === 'signed-in') return true;
	if (room.watchers === 'registered') return viewer.registered;
	return false;
}

/** Records what RealtimeKit says about a recording, keeping our own copy's details. */
async function noteRecording(database: D1Database, eventIdentifier: string, recording: RemoteRecording, time: Date): Promise<void> {
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO calendar_recordings (identifier, event_identifier, status, started_at, stopped_at, duration_seconds, size_bytes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (identifier) DO UPDATE SET
				status = excluded.status, started_at = excluded.started_at, stopped_at = excluded.stopped_at,
				duration_seconds = excluded.duration_seconds, size_bytes = COALESCE(excluded.size_bytes, calendar_recordings.size_bytes),
				updated_at = excluded.updated_at
			 WHERE calendar_recordings.event_identifier = excluded.event_identifier`
		)
		.bind(recording.identifier, eventIdentifier, recording.status, recording.startedAt, recording.stoppedAt, recording.durationSeconds, recording.sizeBytes, at, at)
		.run();
}

/** RealtimeKit keeps a recording for seven days (Cloudflare, "Recording Guide"); after that there is nothing to copy. */
export const remoteKeptDays = 7;
/** Tries to copy one recording this many times before leaving it to a host. */
export const copyAttemptsAllowed = 5;

/**
 * Streams a file into the bucket. R2 needs to know a stream's length, so the
 * bytes pass through a FixedLengthStream of the size the download gives
 * (Cloudflare, "R2 Workers API reference", put).
 */
async function storeStream(bucket: R2Bucket, key: string, body: ReadableStream, length: number): Promise<void> {
	const FixedLength = (globalThis as { FixedLengthStream?: new (length: number) => TransformStream }).FixedLengthStream;
	if (!FixedLength) {
		await bucket.put(key, body as never, { httpMetadata: { contentType: 'video/mp4' } });
		return;
	}
	const { readable, writable } = new FixedLength(length);
	await Promise.all([body.pipeTo(writable), bucket.put(key, readable as never, { httpMetadata: { contentType: 'video/mp4' } })]);
}

export interface RecordingRunResult {
	rooms: number;
	seen: number;
	copied: number;
	failed: number;
}

/**
 * The part of the events run that looks after recordings: for each room used
 * in the last seven days, ask RealtimeKit what recordings it has, note them,
 * and copy at most `copyLimit` finished ones into the private bucket, each
 * then held for the virus check. Copies are few, and one at a time, so a run
 * stays short.
 */
export async function syncRoomRecordings(
	context: { database: D1Database; bucket: R2Bucket; settings: VideoRoomSettings; fetcher?: Fetcher },
	time: Date = new Date(),
	copyLimit = 1
): Promise<RecordingRunResult> {
	const fetcher = context.fetcher ?? fetch;
	const since = new Date(time.getTime() - (remoteKeptDays + 1) * 24 * 3600_000).toISOString();
	const soon = new Date(time.getTime() + 3600_000).toISOString();
	const { results: rooms } = await context.database
		.prepare(
			`SELECT r.event_identifier AS eventIdentifier, r.meeting FROM calendar_rooms r
			 JOIN calendar_events e ON e.identifier = r.event_identifier
			 WHERE r.meeting IS NOT NULL AND e.ends_at >= ? AND e.starts_at <= ?`
		)
		.bind(since, soon)
		.all<{ eventIdentifier: string; meeting: string }>();
	const result: RecordingRunResult = { rooms: rooms.length, seen: 0, copied: 0, failed: 0 };
	const downloads = new Map<string, { eventIdentifier: string; recording: RemoteRecording }>();
	for (const room of rooms) {
		let remote: RemoteRecording[];
		try {
			remote = await meetingRecordings(context.settings, room.meeting, fetcher);
		} catch (problem) {
			console.error('Could not list the recordings of a room', room.eventIdentifier, problem);
			result.failed += 1;
			continue;
		}
		for (const recording of remote) {
			result.seen += 1;
			await noteRecording(context.database, room.eventIdentifier, recording, time);
			if (recording.status === 'UPLOADED' && recording.downloadAddress) downloads.set(recording.identifier, { eventIdentifier: room.eventIdentifier, recording });
		}
	}
	if (downloads.size === 0) return result;
	const { results: waiting } = await context.database
		.prepare(
			`SELECT identifier FROM calendar_recordings
			 WHERE status = 'UPLOADED' AND object_key IS NULL AND copy_attempts < ?
			 ORDER BY COALESCE(stopped_at, created_at)`
		)
		.bind(copyAttemptsAllowed)
		.all<{ identifier: string }>();
	for (const { identifier } of waiting) {
		if (result.copied >= copyLimit) break;
		const found = downloads.get(identifier);
		if (!found) continue;
		const key = recordingObjectKey(found.eventIdentifier, identifier);
		try {
			const response = await fetcher(found.recording.downloadAddress as string);
			if (!response.ok || !response.body) throw new Error(`the download answered ${response.status}`);
			const length = Number(response.headers.get('content-length') ?? found.recording.sizeBytes ?? Number.NaN);
			if (!Number.isFinite(length) || length <= 0) throw new Error('the download did not say its size');
			await storeStream(context.bucket, key, response.body as ReadableStream, length);
			await context.database
				.prepare('UPDATE calendar_recordings SET object_key = ?, copied_at = ?, size_bytes = ?, copy_problem = NULL, updated_at = ? WHERE identifier = ?')
				.bind(key, time.toISOString(), length, time.toISOString(), identifier)
				.run();
			await requestScan(context.database, { objectKey: key, purpose: 'event-recording', subject: found.eventIdentifier }, time);
			result.copied += 1;
		} catch (problem) {
			result.failed += 1;
			const message = problem instanceof Error ? problem.message : String(problem);
			await context.database
				.prepare('UPDATE calendar_recordings SET copy_attempts = copy_attempts + 1, copy_problem = ?, updated_at = ? WHERE identifier = ?')
				.bind(message.slice(0, 300), time.toISOString(), identifier)
				.run();
		}
	}
	return result;
}
