/**
 * The video rooms in the database, their invite links, letting people in,
 * and the run that copies recordings into the private bucket
 * (migrations/20261123T1750_add_standalone_video_rooms.sql;
 * site/COLLABORATION.md, "The video room").
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { eventMoment, type RecordingChoice } from '#lib/event-calendar.ts';
import {
	durationWords,
	instantRoomHours,
	recordingStatusWords,
	roomPreset,
	type RecordingWatchers,
	type RoomRole,
	type RoomStyle,
	type RoomVisibility,
	type RoomWindow
} from '#lib/video-rooms.ts';
import { fileScans, requestScan, scanStatusWords } from './file-scans.ts';
import { newIdentifier } from './identifiers.ts';
import { addParticipant, createMeeting, meetingRecordings, refreshParticipantToken, type Fetcher, type RemoteRecording, type VideoRoomSettings } from './realtime-kit.ts';
import { randomToken, sha256 } from './sign-in-secrets.ts';

export interface VideoRoom {
	identifier: string;
	eventIdentifier: string | null;
	title: string;
	visibility: RoomVisibility;
	style: RoomStyle;
	recording: RecordingChoice | null;
	watchers: RecordingWatchers;
	startsAt: string | null;
	closesAt: string | null;
	timeZone: string;
	meeting: string | null;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}

/** A room of its own, which always has its own times and recording choice. */
export interface StandaloneRoom extends VideoRoom {
	eventIdentifier: null;
	visibility: 'public' | 'private';
	recording: RecordingChoice;
	startsAt: string;
	closesAt: string;
}

export function isStandalone(room: VideoRoom): room is StandaloneRoom {
	return room.visibility !== 'event';
}

const roomColumns = `identifier, event_identifier AS eventIdentifier, title, visibility, style, recording, watchers,
	starts_at AS startsAt, closes_at AS closesAt, time_zone AS timeZone, meeting, created_by AS createdBy,
	created_at AS createdAt, updated_at AS updatedAt`;

export async function roomByIdentifier(database: D1Database, identifier: string): Promise<VideoRoom | undefined> {
	return (await database.prepare(`SELECT ${roomColumns} FROM video_rooms WHERE identifier = ?`).bind(identifier).first<VideoRoom>()) ?? undefined;
}

/** The event's room, or undefined when the event does not use the site's own room. */
export async function roomOfEvent(database: D1Database, eventIdentifier: string): Promise<VideoRoom | undefined> {
	return (await database.prepare(`SELECT ${roomColumns} FROM video_rooms WHERE event_identifier = ?`).bind(eventIdentifier).first<VideoRoom>()) ?? undefined;
}

/** Turns the room on for an event, or changes its style or who may watch its recordings. */
export async function saveEventRoom(
	database: D1Database,
	event: { identifier: string; title: string; timeZone: string },
	input: { style: RoomStyle; watchers: RecordingWatchers },
	time: Date = new Date()
): Promise<void> {
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO video_rooms (identifier, event_identifier, title, visibility, style, watchers, time_zone, created_at, updated_at)
			 VALUES (?, ?, ?, 'event', ?, ?, ?, ?, ?)
			 ON CONFLICT (event_identifier) DO UPDATE SET title = excluded.title, style = excluded.style, watchers = excluded.watchers,
				time_zone = excluded.time_zone, updated_at = excluded.updated_at`
		)
		.bind(event.identifier, event.identifier, event.title, input.style, input.watchers, event.timeZone, at, at)
		.run();
}

/**
 * Turns a room off. A room that has recordings stays, so a recording is
 * never lost this way; returns whether it was removed.
 */
export async function removeRoom(database: D1Database, identifier: string): Promise<boolean> {
	const result = await database
		.prepare(
			`DELETE FROM video_rooms WHERE identifier = ?
			 AND NOT EXISTS (SELECT 1 FROM video_room_recordings WHERE room_identifier = ?)`
		)
		.bind(identifier, identifier)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

export interface StandaloneRoomInput {
	title: string;
	visibility: 'public' | 'private';
	style: RoomStyle;
	watchers: RecordingWatchers;
	startsAt: Date;
	closesAt: Date;
	timeZone: string;
}

/**
 * Makes a room of its own and returns its identifier. Nobody decides about
 * recording beforehand: everyone is told the room may be recorded, and the
 * hosts start and stop recording in the call (Trevor, Nov. 23, 2026).
 */
export async function createRoom(database: D1Database, input: StandaloneRoomInput, createdBy: string | null, time: Date = new Date()): Promise<string> {
	const identifier = newIdentifier();
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO video_rooms (identifier, title, visibility, style, recording, watchers, starts_at, closes_at, time_zone, created_by, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'undecided', ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			identifier,
			input.title.slice(0, 200),
			input.visibility,
			input.style,
			input.watchers,
			input.startsAt.toISOString(),
			input.closesAt.toISOString(),
			input.timeZone,
			createdBy,
			at,
			at
		)
		.run();
	return identifier;
}

/** Changes a room of its own. An event's room is changed from the event. */
export async function updateRoom(database: D1Database, identifier: string, input: StandaloneRoomInput, time: Date = new Date()): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE video_rooms SET title = ?, visibility = ?, style = ?, recording = 'undecided', watchers = ?, starts_at = ?, closes_at = ?, time_zone = ?, updated_at = ?
			 WHERE identifier = ? AND visibility <> 'event'`
		)
		.bind(
			input.title.slice(0, 200),
			input.visibility,
			input.style,
			input.watchers,
			input.startsAt.toISOString(),
			input.closesAt.toISOString(),
			input.timeZone,
			time.toISOString(),
			identifier
		)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** The default title of an instant room, such as "Room started 9:45 AM". */
export function instantRoomTitle(time: Date, timeZone: string): string {
	const clock = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(time);
	return `Room started ${clock.replace(/ /g, ' ')}`;
}

/**
 * Starts a private room now, open for a few hours, with one guest invite
 * link to share. Returns the room and the link's secret, which is shown once.
 */
export async function startInstantRoom(
	database: D1Database,
	input: { title?: string; style?: RoomStyle; timeZone: string; createdBy: string | null },
	time: Date = new Date()
): Promise<{ room: string; secret: string }> {
	const title = input.title?.trim() || instantRoomTitle(time, input.timeZone);
	const room = await createRoom(
		database,
		{
			title,
			visibility: 'private',
			style: input.style ?? 'discussion',
			watchers: 'hosts',
			startsAt: time,
			closesAt: new Date(time.getTime() + instantRoomHours * 3_600_000),
			timeZone: input.timeZone
		},
		input.createdBy,
		time
	);
	const { secret } = await createInvite(database, { room, name: 'Guest', role: 'guest', createdBy: input.createdBy }, time);
	return { room, secret };
}

/** Closes a room of its own now. Tokens already given out stop working at the old closing time at the latest. */
export async function closeRoom(database: D1Database, identifier: string, time: Date = new Date()): Promise<boolean> {
	const at = time.toISOString();
	const result = await database
		.prepare(`UPDATE video_rooms SET closes_at = ?, updated_at = ? WHERE identifier = ? AND visibility <> 'event' AND closes_at > ?`)
		.bind(at, at, identifier, at)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Keeps a room of its own open this many hours longer, counted from now if it has already closed. */
export async function keepRoomOpen(database: D1Database, identifier: string, hours: number, time: Date = new Date()): Promise<boolean> {
	const at = time.toISOString();
	const result = await database
		.prepare(
			`UPDATE video_rooms SET closes_at = strftime('%Y-%m-%dT%H:%M:%fZ', max(closes_at, ?), ?), updated_at = ?
			 WHERE identifier = ? AND visibility <> 'event'`
		)
		.bind(at, `+${Math.round(hours * 60)} minutes`, at, identifier)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

export interface RoomListing extends StandaloneRoom {
	visitors: number;
	recordings: number;
}

/** The rooms of their own, still open or about to open first, then the closed ones, newest first. */
export async function standaloneRooms(database: D1Database, filter: { visibility?: 'public' | 'private'; openAt?: Date; createdBy?: string } = {}): Promise<RoomListing[]> {
	const conditions = ["visibility <> 'event'"];
	const values: unknown[] = [];
	if (filter.visibility) {
		conditions.push('visibility = ?');
		values.push(filter.visibility);
	}
	if (filter.openAt) {
		conditions.push('closes_at > ?');
		values.push(filter.openAt.toISOString());
	}
	if (filter.createdBy) {
		conditions.push('created_by = ?');
		values.push(filter.createdBy);
	}
	const { results } = await database
		.prepare(
			`SELECT ${roomColumns},
				(SELECT count(*) FROM video_room_people p WHERE p.room_identifier = video_rooms.identifier) AS visitors,
				(SELECT count(*) FROM video_room_recordings r WHERE r.room_identifier = video_rooms.identifier) AS recordings
			 FROM video_rooms WHERE ${conditions.join(' AND ')}
			 ORDER BY closes_at DESC LIMIT 200`
		)
		.bind(...values)
		.all<RoomListing>();
	return results;
}

/**
 * Keeps the RealtimeKit meeting made for a room. If two people opened the
 * room at the same moment and two meetings were made, the first one kept wins
 * and both get it back.
 */
export async function keepMeeting(database: D1Database, room: string, meeting: string, time: Date = new Date()): Promise<string> {
	await database.prepare('UPDATE video_rooms SET meeting = ?, updated_at = ? WHERE identifier = ? AND meeting IS NULL').bind(meeting, time.toISOString(), room).run();
	const kept = await database.prepare('SELECT meeting FROM video_rooms WHERE identifier = ?').bind(room).first<{ meeting: string | null }>();
	return kept?.meeting ?? meeting;
}

export interface RoomInvite {
	identifier: string;
	roomIdentifier: string;
	name: string;
	role: RoomRole;
	createdAt: string;
	revokedAt: string | null;
	lastUsedAt: string | null;
}

const inviteColumns = `identifier, room_identifier AS roomIdentifier, name, role, created_at AS createdAt, revoked_at AS revokedAt, last_used_at AS lastUsedAt`;

/** Makes an invite link. Only a hash of its secret is kept, so the secret is returned once, to show the host. */
export async function createInvite(
	database: D1Database,
	input: { room: string; name: string; role: RoomRole; createdBy: string | null },
	time: Date = new Date()
): Promise<{ identifier: string; secret: string }> {
	const identifier = newIdentifier();
	const secret = randomToken();
	await database
		.prepare(
			`INSERT INTO video_room_invites (identifier, room_identifier, name, role, token_hash, created_by, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(identifier, input.room, input.name.trim().slice(0, 120) || 'Guest', input.role, await sha256(secret), input.createdBy, time.toISOString())
		.run();
	return { identifier, secret };
}

/** The address of an invite link, on this site. */
export function invitePath(room: string, secret: string): string {
	return `/rooms/${room}/invite/${secret}`;
}

/** The invite this secret belongs to, in this room. */
export async function inviteBySecret(database: D1Database, room: string, secret: string): Promise<RoomInvite | undefined> {
	return (
		(await database
			.prepare(`SELECT ${inviteColumns} FROM video_room_invites WHERE room_identifier = ? AND token_hash = ?`)
			.bind(room, await sha256(secret))
			.first<RoomInvite>()) ?? undefined
	);
}

export async function invitesOf(database: D1Database, room: string): Promise<RoomInvite[]> {
	const { results } = await database.prepare(`SELECT ${inviteColumns} FROM video_room_invites WHERE room_identifier = ? ORDER BY created_at`).bind(room).all<RoomInvite>();
	return results;
}

/** Turns an invite link off for good. */
export async function revokeInvite(database: D1Database, room: string, identifier: string, time: Date = new Date()): Promise<boolean> {
	const result = await database
		.prepare('UPDATE video_room_invites SET revoked_at = ? WHERE room_identifier = ? AND identifier = ? AND revoked_at IS NULL')
		.bind(time.toISOString(), room, identifier)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/**
 * Someone let in with an account, or with an invite link. One link can be
 * passed to several people (an instant room has one to share), so someone
 * with a link is also told apart by a random key kept in their browser.
 */
export type Visitor = { kind: 'account'; identifier: string } | { kind: 'invite'; identifier: string; browser: string };

function visitorKey(visitor: Visitor): string {
	return visitor.kind === 'account' ? `account:${visitor.identifier}` : `invite:${visitor.identifier}:${visitor.browser}`;
}

export interface RoomPerson {
	roomIdentifier: string;
	visitor: string;
	accountIdentifier: string | null;
	inviteIdentifier: string | null;
	name: string;
	role: RoomRole;
	participant: string | null;
	toldRecording: RecordingChoice;
	toldAt: string;
	lastJoinedAt: string;
}

const personColumns = `room_identifier AS roomIdentifier, visitor, account_identifier AS accountIdentifier, invite_identifier AS inviteIdentifier,
	name, role, participant, told_recording AS toldRecording, told_at AS toldAt, last_joined_at AS lastJoinedAt`;

export async function roomPerson(database: D1Database, room: string, visitor: Visitor): Promise<RoomPerson | undefined> {
	return (
		(await database
			.prepare(`SELECT ${personColumns} FROM video_room_people WHERE room_identifier = ? AND visitor = ?`)
			.bind(room, visitorKey(visitor))
			.first<RoomPerson>()) ?? undefined
	);
}

/** Whether someone with this account was let into the room, for who may watch its recordings. */
export async function joinedRoom(database: D1Database, room: string, accountIdentifier: string): Promise<boolean> {
	return Boolean(await roomPerson(database, room, { kind: 'account', identifier: accountIdentifier }));
}

/**
 * Notes that a person was told about recording and let in. This is the log of
 * who was told what (like Magna Carta's meetings): each visit records the
 * room's recording choice at that moment.
 */
export async function noteRoomVisit(
	database: D1Database,
	input: { room: string; visitor: Visitor; name: string; role: RoomRole; toldRecording: RecordingChoice; participant?: string | null },
	time: Date = new Date()
): Promise<void> {
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO video_room_people (room_identifier, visitor, account_identifier, invite_identifier, name, role, participant, told_recording, told_at, last_joined_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (room_identifier, visitor) DO UPDATE SET
				name = excluded.name, role = excluded.role,
				participant = COALESCE(excluded.participant, video_room_people.participant),
				told_recording = excluded.told_recording, told_at = excluded.told_at, last_joined_at = excluded.last_joined_at`
		)
		.bind(
			input.room,
			visitorKey(input.visitor),
			input.visitor.kind === 'account' ? input.visitor.identifier : null,
			input.visitor.kind === 'invite' ? input.visitor.identifier : null,
			input.name.slice(0, 200),
			input.role,
			input.participant ?? null,
			input.toldRecording,
			at,
			at
		)
		.run();
	if (input.visitor.kind === 'invite') {
		await database.prepare('UPDATE video_room_invites SET last_used_at = ? WHERE identifier = ?').bind(at, input.visitor.identifier).run();
	}
}

/** Who was let into a room and what each was told, for the hosts. */
export async function roomVisitors(database: D1Database, room: string): Promise<RoomPerson[]> {
	const { results } = await database.prepare(`SELECT ${personColumns} FROM video_room_people WHERE room_identifier = ? ORDER BY told_at`).bind(room).all<RoomPerson>();
	return results;
}

/** The participant id RealtimeKit is given: an account identifier or an invite's, never an email address. */
export function participantIdentifier(visitor: Visitor): string {
	return visitor.kind === 'account' ? visitor.identifier : `invite-${visitor.identifier}-${visitor.browser}`;
}

/**
 * Lets someone into a room: makes the room's RealtimeKit meeting if this is
 * the first time it is opened, adds the person to it (or gives them a fresh
 * token if they were added before with the same role), and notes what they
 * were told. Returns the token their browser joins with, which stops working
 * when the room closes.
 */
export async function letIntoRoom(
	context: { database: D1Database; settings: VideoRoomSettings; fetcher?: Fetcher },
	input: { room: VideoRoom; window: RoomWindow; visitor: Visitor; name: string; role: RoomRole; toldRecording: RecordingChoice },
	time: Date = new Date()
): Promise<string> {
	const { database, settings } = context;
	const fetcher = context.fetcher ?? fetch;
	const meeting = input.room.meeting ?? (await keepMeeting(database, input.room.identifier, await createMeeting(settings, input.room.title, fetcher), time));
	const before = await roomPerson(database, input.room.identifier, input.visitor);
	const closes = new Date(input.window.closesAt);
	let token: string;
	let participant: string | null = before?.participant ?? null;
	if (participant && before?.role === input.role) {
		token = await refreshParticipantToken(settings, { meeting, participant, closes, time }, fetcher);
	} else {
		const added = await addParticipant(
			settings,
			{
				meeting,
				accountIdentifier: participantIdentifier(input.visitor),
				name: input.name,
				preset: roomPreset(input.room.style, input.role),
				closes,
				time
			},
			fetcher
		);
		participant = added.participant;
		token = added.token;
	}
	await noteRoomVisit(database, { room: input.room.identifier, visitor: input.visitor, name: input.name, role: input.role, toldRecording: input.toldRecording, participant }, time);
	return token;
}

export interface RoomRecording {
	identifier: string;
	roomIdentifier: string;
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

interface RecordingRow extends Omit<RoomRecording, 'hidden'> {
	hidden: number;
}

const recordingColumns = `identifier, room_identifier AS roomIdentifier, status, started_at AS startedAt, stopped_at AS stoppedAt,
	duration_seconds AS durationSeconds, size_bytes AS sizeBytes, object_key AS objectKey, copied_at AS copiedAt,
	copy_attempts AS copyAttempts, copy_problem AS copyProblem, hidden`;

function recordingOf(row: RecordingRow): RoomRecording {
	return { ...row, hidden: row.hidden === 1 };
}

export async function recordingsOf(database: D1Database, room: string): Promise<RoomRecording[]> {
	const { results } = await database
		.prepare(`SELECT ${recordingColumns} FROM video_room_recordings WHERE room_identifier = ? ORDER BY COALESCE(started_at, created_at)`)
		.bind(room)
		.all<RecordingRow>();
	return results.map(recordingOf);
}

export async function recordingOfRoom(database: D1Database, room: string, identifier: string): Promise<RoomRecording | undefined> {
	const row = await database
		.prepare(`SELECT ${recordingColumns} FROM video_room_recordings WHERE room_identifier = ? AND identifier = ?`)
		.bind(room, identifier)
		.first<RecordingRow>();
	return row ? recordingOf(row) : undefined;
}

export async function setRecordingHidden(database: D1Database, room: string, identifier: string, hidden: boolean, time: Date = new Date()): Promise<boolean> {
	const result = await database
		.prepare('UPDATE video_room_recordings SET hidden = ?, updated_at = ? WHERE room_identifier = ? AND identifier = ?')
		.bind(hidden ? 1 : 0, time.toISOString(), room, identifier)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Where our copy of a recording is kept in the private bucket. */
export function recordingObjectKey(room: string, identifier: string): string {
	return `room-recordings/${room}/${identifier}.mp4`;
}

/**
 * Who may watch a room's recordings. Hosts always may, hidden recordings
 * included; others only what the room's setting allows, and never before the
 * virus check passes (checked where the file is served).
 */
export function mayWatchRecordings(
	room: Pick<VideoRoom, 'watchers'>,
	viewer: { signedIn: boolean; host: boolean; registered?: boolean; joined?: boolean }
): boolean {
	if (viewer.host) return true;
	if (!viewer.signedIn) return false;
	if (room.watchers === 'signed-in') return true;
	if (room.watchers === 'registered') return viewer.registered === true;
	if (room.watchers === 'joined') return viewer.joined === true;
	return false;
}

/** Records what RealtimeKit says about a recording, keeping our own copy's details. */
async function noteRecording(database: D1Database, room: string, recording: RemoteRecording, time: Date): Promise<void> {
	const at = time.toISOString();
	await database
		.prepare(
			`INSERT INTO video_room_recordings (identifier, room_identifier, status, started_at, stopped_at, duration_seconds, size_bytes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (identifier) DO UPDATE SET
				status = excluded.status, started_at = excluded.started_at, stopped_at = excluded.stopped_at,
				duration_seconds = excluded.duration_seconds, size_bytes = COALESCE(excluded.size_bytes, video_room_recordings.size_bytes),
				updated_at = excluded.updated_at
			 WHERE video_room_recordings.room_identifier = excluded.room_identifier`
		)
		.bind(recording.identifier, room, recording.status, recording.startedAt, recording.stoppedAt, recording.durationSeconds, recording.sizeBytes, at, at)
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
 * in the last seven days, event rooms and rooms of their own alike, ask
 * RealtimeKit what recordings it has, note them, and copy at most
 * `copyLimit` finished ones into the private bucket, each then held for the
 * virus check. Copies are few, and one at a time, so a run stays short.
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
			`SELECT r.identifier, r.meeting FROM video_rooms r
			 LEFT JOIN calendar_events e ON e.identifier = r.event_identifier
			 WHERE r.meeting IS NOT NULL
			   AND COALESCE(r.closes_at, e.ends_at) >= ? AND COALESCE(r.starts_at, e.starts_at) <= ?`
		)
		.bind(since, soon)
		.all<{ identifier: string; meeting: string }>();
	const result: RecordingRunResult = { rooms: rooms.length, seen: 0, copied: 0, failed: 0 };
	const downloads = new Map<string, { room: string; recording: RemoteRecording }>();
	for (const room of rooms) {
		let remote: RemoteRecording[];
		try {
			remote = await meetingRecordings(context.settings, room.meeting, fetcher);
		} catch (problem) {
			console.error('Could not list the recordings of a room', room.identifier, problem);
			result.failed += 1;
			continue;
		}
		for (const recording of remote) {
			result.seen += 1;
			await noteRecording(context.database, room.identifier, recording, time);
			if (recording.status === 'UPLOADED' && recording.downloadAddress) downloads.set(recording.identifier, { room: room.identifier, recording });
		}
	}
	if (downloads.size === 0) return result;
	const { results: waiting } = await context.database
		.prepare(
			`SELECT identifier FROM video_room_recordings
			 WHERE status = 'UPLOADED' AND object_key IS NULL AND copy_attempts < ?
			 ORDER BY COALESCE(stopped_at, created_at)`
		)
		.bind(copyAttemptsAllowed)
		.all<{ identifier: string }>();
	for (const { identifier } of waiting) {
		if (result.copied >= copyLimit) break;
		const found = downloads.get(identifier);
		if (!found) continue;
		const key = recordingObjectKey(found.room, identifier);
		try {
			const response = await fetcher(found.recording.downloadAddress as string);
			if (!response.ok || !response.body) throw new Error(`the download answered ${response.status}`);
			const length = Number(response.headers.get('content-length') ?? found.recording.sizeBytes ?? Number.NaN);
			if (!Number.isFinite(length) || length <= 0) throw new Error('the download did not say its size');
			await storeStream(context.bucket, key, response.body as ReadableStream, length);
			await context.database
				.prepare('UPDATE video_room_recordings SET object_key = ?, copied_at = ?, size_bytes = ?, copy_problem = NULL, updated_at = ? WHERE identifier = ?')
				.bind(key, time.toISOString(), length, time.toISOString(), identifier)
				.run();
			await requestScan(context.database, { objectKey: key, purpose: 'room-recording', subject: found.room }, time);
			result.copied += 1;
		} catch (problem) {
			result.failed += 1;
			const message = problem instanceof Error ? problem.message : String(problem);
			await context.database
				.prepare('UPDATE video_room_recordings SET copy_attempts = copy_attempts + 1, copy_problem = ?, updated_at = ? WHERE identifier = ?')
				.bind(message.slice(0, 300), time.toISOString(), identifier)
				.run();
		}
	}
	return result;
}

/** A room's recordings and the log of who was told what, as the hosts see them in the workspace. */
export async function roomRecordsForHosts(
	database: D1Database,
	room: Pick<VideoRoom, 'identifier' | 'timeZone'>,
	recordingAddress: (identifier: string) => string
): Promise<{
	recordings: { identifier: string; when: string; length: string; status: string; address: string | null; hidden: boolean }[];
	visitors: { name: string; role: string; how: string; told: string; toldAt: string }[];
}> {
	const [recordings, visitors] = await Promise.all([recordingsOf(database, room.identifier), roomVisitors(database, room.identifier)]);
	const scans = await fileScans(
		database,
		recordings.flatMap((recording) => (recording.objectKey ? [recording.objectKey] : []))
	);
	return {
		recordings: recordings.map((recording) => {
			const scan = recording.objectKey ? (scans.get(recording.objectKey) ?? null) : null;
			return {
				identifier: recording.identifier,
				when: recording.startedAt ? eventMoment(recording.startedAt, room.timeZone) : '',
				length: durationWords(recording.durationSeconds),
				status: recording.objectKey
					? scanStatusWords(scan).label
					: recording.copyProblem
						? `Not copied yet: ${recording.copyProblem}`
						: (recordingStatusWords[recording.status] ?? recording.status),
				address: recording.objectKey ? recordingAddress(recording.identifier) : null,
				hidden: recording.hidden
			};
		}),
		visitors: visitors.map((visitor) => ({
			name: visitor.name,
			role: visitor.role === 'host' ? 'Host' : 'Guest',
			how: visitor.inviteIdentifier ? 'Invite link' : 'Signed in',
			told: { recorded: 'Recorded', 'not-recorded': 'Not recorded', undecided: 'May be recorded' }[visitor.toldRecording],
			toldAt: eventMoment(visitor.toldAt, room.timeZone)
		}))
	};
}
