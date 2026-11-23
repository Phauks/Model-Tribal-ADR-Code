/**
 * The video rooms: who may enter an event's room and a room of its own, what
 * they are told about recording, invite links, instant rooms, the calls to
 * RealtimeKit, and the run that copies recordings into the private bucket and
 * puts them in line for the virus check.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	durationWords,
	eventRoomWindow,
	recordingNotice,
	roomAccess,
	roomClosesAt,
	roomIsOpen,
	roomPreset,
	standaloneRoomAccess
} from '#lib/video-rooms.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import { changeEventStatus, createEvent, eventByIdentifier, type CalendarEvent } from '#lib/server/event-calendar.ts';
import {
	closeRoom,
	createInvite,
	createRoom,
	inviteBySecret,
	keepMeeting,
	keepRoomOpen,
	letIntoRoom,
	mayWatchRecordings,
	noteRoomVisit,
	recordingObjectKey,
	recordingsOf,
	removeRoom,
	revokeInvite,
	roomByIdentifier,
	roomOfEvent,
	roomPerson,
	roomVisitors,
	saveEventRoom,
	setRecordingHidden,
	standaloneRooms,
	startInstantRoom,
	syncRoomRecordings,
	type StandaloneRoom
} from '#lib/server/video-rooms.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import {
	addParticipant,
	createMeeting,
	endActiveSession,
	forgetVideoRoomPlaces,
	meetingRecordings,
	refreshParticipantToken,
	videoRoomAppName,
	videoRoomPlace,
	videoRoomSettings,
	type Fetcher
} from '#lib/server/realtime-kit.ts';
import { testDatabase } from './database.ts';

const hour = 3_600_000;
const today = new Date('2027-03-01T12:00:00.000Z');
const at = (hours: number) => new Date(today.getTime() + hours * hour);
const settings = { account: 'account-1', application: 'app-1', token: 'secret-token' };

const event = { status: 'published', startsAt: at(10).toISOString(), endsAt: at(12).toISOString() };

describe('who may enter a room', () => {
	const guest = { event, host: false, signedIn: true, seatKinds: 1, registration: { status: 'registered', attendance: 'online' } };

	it('opens 30 minutes before the start and closes two hours after the end', () => {
		const window = eventRoomWindow(event);
		expect(roomIsOpen(window, at(9.4))).toBe(false);
		expect(roomIsOpen(window, at(9.5))).toBe(true);
		expect(roomIsOpen(window, at(13.9))).toBe(true);
		expect(roomIsOpen(window, at(14))).toBe(false);
		expect(roomClosesAt(window).toISOString()).toBe(at(14).toISOString());
	});

	it('lets in people with an online seat while it is open', () => {
		expect(roomAccess(guest, at(10))).toEqual({ kind: 'guest' });
		expect(roomAccess(guest, at(9))).toEqual({ kind: 'refused', reason: 'not-open-yet' });
		expect(roomAccess(guest, at(14))).toEqual({ kind: 'refused', reason: 'over' });
	});

	it('refuses people without an online seat, and people signed out', () => {
		expect(roomAccess({ ...guest, registration: { status: 'registered', attendance: 'in-person' } }, at(10))).toEqual({ kind: 'refused', reason: 'not-online' });
		expect(roomAccess({ ...guest, registration: { status: 'waitlisted', attendance: 'online' } }, at(10))).toEqual({ kind: 'refused', reason: 'not-registered' });
		expect(roomAccess({ ...guest, registration: null }, at(10))).toEqual({ kind: 'refused', reason: 'not-registered' });
		expect(roomAccess({ ...guest, signedIn: false }, at(10))).toEqual({ kind: 'refused', reason: 'sign-in' });
	});

	it('lets anyone signed in into an event with no seats', () => {
		expect(roomAccess({ ...guest, seatKinds: 0, registration: null }, at(10))).toEqual({ kind: 'guest' });
	});

	it('lets hosts in early, even to a draft, but not into a cancelled or finished event', () => {
		const host = { ...guest, host: true, registration: null };
		expect(roomAccess(host, at(-48))).toEqual({ kind: 'host' });
		expect(roomAccess({ ...host, event: { ...event, status: 'draft' } }, at(1))).toEqual({ kind: 'host' });
		expect(roomAccess({ ...host, event: { ...event, status: 'cancelled' } }, at(10))).toEqual({ kind: 'refused', reason: 'cancelled' });
		expect(roomAccess(host, at(15))).toEqual({ kind: 'refused', reason: 'over' });
	});

	it('uses the app’s default presets', () => {
		expect(roomPreset('webinar', 'host')).toBe('webinar_presenter');
		expect(roomPreset('webinar', 'guest')).toBe('webinar_viewer');
		expect(roomPreset('discussion', 'host')).toBe('group_call_host');
		expect(roomPreset('discussion', 'guest')).toBe('group_call_participant');
	});
});

describe('who may enter a room of its own', () => {
	const room = { visibility: 'private' as const, startsAt: at(10).toISOString(), closesAt: at(12).toISOString() };

	it('lets its hosts in any time before it closes', () => {
		expect(standaloneRoomAccess({ room, host: true, signedIn: true }, at(1))).toEqual({ kind: 'host' });
		expect(standaloneRoomAccess({ room, host: true, signedIn: true }, at(12))).toEqual({ kind: 'refused', reason: 'closed' });
	});

	it('lets nobody else into a private room without an invite link, signed in or not', () => {
		expect(standaloneRoomAccess({ room, host: false, signedIn: true }, at(10))).toEqual({ kind: 'refused', reason: 'private' });
		expect(standaloneRoomAccess({ room, host: false, signedIn: false }, at(10))).toEqual({ kind: 'refused', reason: 'private' });
	});

	it('lets someone with a link in with the link’s role, from 30 minutes before, without an account', () => {
		const invite = { role: 'guest' as const, revoked: false };
		expect(standaloneRoomAccess({ room, host: false, signedIn: false, invite }, at(9.4))).toEqual({ kind: 'refused', reason: 'not-open-yet' });
		expect(standaloneRoomAccess({ room, host: false, signedIn: false, invite }, at(9.5))).toEqual({ kind: 'guest' });
		expect(standaloneRoomAccess({ room, host: false, signedIn: false, invite: { role: 'host', revoked: false } }, at(10))).toEqual({ kind: 'host' });
		expect(standaloneRoomAccess({ room, host: false, signedIn: false, invite: { ...invite, revoked: true } }, at(10))).toEqual({ kind: 'refused', reason: 'invite-ended' });
		expect(standaloneRoomAccess({ room, host: false, signedIn: false, invite }, at(12))).toEqual({ kind: 'refused', reason: 'closed' });
	});

	it('lets anyone signed in into a public room while it is open', () => {
		const open = { ...room, visibility: 'public' as const };
		expect(standaloneRoomAccess({ room: open, host: false, signedIn: true }, at(10))).toEqual({ kind: 'guest' });
		expect(standaloneRoomAccess({ room: open, host: false, signedIn: false }, at(10))).toEqual({ kind: 'refused', reason: 'sign-in' });
		expect(standaloneRoomAccess({ room: open, host: false, signedIn: true }, at(9))).toEqual({ kind: 'refused', reason: 'not-open-yet' });
	});
});

describe('the recording notice', () => {
	it('asks for agreement when the room is or may be recorded, and says who may watch', () => {
		const recorded = recordingNotice('recorded', 'registered');
		expect(recorded.needsAgreement).toBe(true);
		expect(recorded.text).toContain('the people who registered for this event');
		expect(recorded.text).toContain('tone');
		expect(recordingNotice('undecided', 'hosts').needsAgreement).toBe(true);
		expect(recordingNotice('undecided', 'hosts').text).toContain('only the people running');
	});

	it('speaks of a room, and of its hosts, for a room of its own', () => {
		const notice = recordingNotice('recorded', 'hosts', 'room');
		expect(notice.heading).toBe('This room is recorded');
		expect(notice.text).toContain('only the room’s hosts');
		expect(recordingNotice('recorded', 'joined', 'room').text).toContain('the people who joined this room');
	});

	it('still says what happens if a recording starts in a room not to be recorded', () => {
		const notice = recordingNotice('not-recorded', 'signed-in');
		expect(notice.needsAgreement).toBe(false);
		expect(notice.text).toContain('recording mark');
	});

	it('puts a length in words', () => {
		expect(durationWords(3840)).toBe('1 hour 4 minutes');
		expect(durationWords(7200)).toBe('2 hours');
		expect(durationWords(20)).toBe('under a minute');
		expect(durationWords(null)).toBe('');
	});
});

describe('who may watch recordings', () => {
	it('follows the room’s setting, and always lets hosts watch', () => {
		const viewer = { signedIn: true, host: false, registered: false };
		expect(mayWatchRecordings({ watchers: 'hosts' }, viewer)).toBe(false);
		expect(mayWatchRecordings({ watchers: 'hosts' }, { ...viewer, host: true })).toBe(true);
		expect(mayWatchRecordings({ watchers: 'registered' }, viewer)).toBe(false);
		expect(mayWatchRecordings({ watchers: 'registered' }, { ...viewer, registered: true })).toBe(true);
		expect(mayWatchRecordings({ watchers: 'signed-in' }, viewer)).toBe(true);
		expect(mayWatchRecordings({ watchers: 'signed-in' }, { ...viewer, signedIn: false })).toBe(false);
		expect(mayWatchRecordings({ watchers: 'joined' }, viewer)).toBe(false);
		expect(mayWatchRecordings({ watchers: 'joined' }, { ...viewer, joined: true })).toBe(true);
	});
});

interface Call {
	address: string;
	method: string;
	body: unknown;
	authorization: string | null;
}

function fakeApi(answers: (call: Call) => Response): { fetcher: Fetcher; calls: Call[] } {
	const calls: Call[] = [];
	const fetcher: Fetcher = async (address, init) => {
		const call = {
			address,
			method: init?.method ?? 'GET',
			body: init?.body ? JSON.parse(String(init.body)) : undefined,
			authorization: new Headers(init?.headers).get('authorization')
		};
		calls.push(call);
		return answers(call);
	};
	return { fetcher, calls };
}

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

describe('calls to RealtimeKit', () => {
	it('stays off until the token is set, and needs nothing else', () => {
		expect(videoRoomSettings({})).toBeNull();
		expect(videoRoomSettings({ VIDEO_ROOM_ACCOUNT: 'a', VIDEO_ROOM_APPLICATION: 'b' })).toBeNull();
		expect(videoRoomSettings({ VIDEO_ROOM_TOKEN: ' c ' })).toEqual({ token: 'c' });
		expect(videoRoomSettings({ VIDEO_ROOM_ACCOUNT: 'a', VIDEO_ROOM_APPLICATION: 'b', VIDEO_ROOM_TOKEN: ' c ' })).toEqual({ account: 'a', application: 'b', token: 'c' });
	});

	it('finds the account and the dashboard’s app from the token, once', async () => {
		forgetVideoRoomPlaces();
		const api = fakeApi((call) => {
			if (call.address.endsWith('/client/v4/accounts')) return new Response(JSON.stringify({ success: true, result: [{ id: 'account-9' }] }));
			if (call.address.endsWith('/realtime/kit/apps')) return ok([{ id: 'app-9', name: 'my-first-app' }]);
			return ok({ id: 'meeting-1' });
		});
		const only = { token: 'only-token' };
		expect(await videoRoomPlace(only, api.fetcher)).toEqual({ account: 'account-9', application: 'app-9' });
		expect(await createMeeting(only, 'A room', api.fetcher)).toBe('meeting-1');
		expect(api.calls.map((call) => `${call.method} ${call.address.replace('https://api.cloudflare.com/client/v4', '')}`)).toEqual([
			'GET /accounts',
			'GET /accounts/account-9/realtime/kit/apps',
			'POST /accounts/account-9/realtime/kit/app-9/meetings'
		]);
	});

	it('never makes an app itself, since only the dashboard’s apps come with the presets', async () => {
		forgetVideoRoomPlaces();
		const api = fakeApi(() => ok([]));
		await expect(videoRoomPlace({ token: 't0', account: 'account-1' }, api.fetcher)).rejects.toThrow(/Make one in the Cloudflare dashboard/);
		expect(api.calls.every((call) => call.method === 'GET')).toBe(true);
	});

	it('uses the site’s own app when the account has several, and asks for a setting when it cannot tell', async () => {
		forgetVideoRoomPlaces();
		const apps = [
			{ id: 'other', name: 'Something else', created_at: '2026-01-01T00:00:00Z' },
			{ id: 'ours', name: videoRoomAppName, created_at: '2026-02-01T00:00:00Z' }
		];
		const api = fakeApi(() => ok(apps));
		expect(await videoRoomPlace({ token: 't1', account: 'account-1' }, api.fetcher)).toEqual({ account: 'account-1', application: 'ours' });
		const unclear = fakeApi(() => ok([{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }]));
		await expect(videoRoomPlace({ token: 't2', account: 'account-1' }, unclear.fetcher)).rejects.toThrow(/VIDEO_ROOM_APPLICATION/);
		// A failed lookup is tried again next time.
		await expect(videoRoomPlace({ token: 't2', account: 'account-1' }, fakeApi(() => ok([{ id: 'z', name: 'Z' }])).fetcher)).resolves.toEqual({ account: 'account-1', application: 'z' });
	});

	it('makes a meeting and adds a person by account id, with a token that ends when the room closes', async () => {
		const api = fakeApi((call) => (call.address.endsWith('/meetings') ? ok({ id: 'meeting-1' }) : ok({ id: 'participant-1', token: 'join-token' })));
		expect(await createMeeting(settings, 'Peacemaking in practice', api.fetcher)).toBe('meeting-1');
		const added = await addParticipant(
			settings,
			{ meeting: 'meeting-1', accountIdentifier: 'account-x', name: 'Ada', preset: 'webinar_viewer', closes: at(14), time: at(10) },
			api.fetcher
		);
		expect(added).toEqual({ participant: 'participant-1', token: 'join-token' });
		expect(api.calls[0].address).toBe('https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings');
		expect(api.calls[0].authorization).toBe('Bearer secret-token');
		expect(api.calls[1].body).toEqual({
			name: 'Ada',
			preset_name: 'webinar_viewer',
			custom_participant_id: 'account-x',
			token: { not_before: new Date(at(10).getTime() - 60_000).toISOString(), expires_on: at(14).toISOString() }
		});
	});

	it('refreshes a token for someone already added', async () => {
		const api = fakeApi(() => ok({ token: 'fresh' }));
		expect(await refreshParticipantToken(settings, { meeting: 'm', participant: 'p', closes: at(14), time: at(10) }, api.fetcher)).toBe('fresh');
		expect(api.calls[0].address).toMatch(/\/meetings\/m\/participants\/p\/token$/);
	});

	it('reports RealtimeKit’s refusals', async () => {
		const api = fakeApi(() => new Response(JSON.stringify({ success: false, errors: [{ message: 'Unauthorized' }] }), { status: 401 }));
		await expect(createMeeting(settings, 'x', api.fetcher)).rejects.toThrow(/401.*Unauthorized/);
	});

	it('ends a live call for everyone, and says when nobody was in it', async () => {
		const api = fakeApi(() => ok({}));
		expect(await endActiveSession(settings, 'meeting-1', api.fetcher)).toBe(true);
		expect(api.calls[0]).toMatchObject({ method: 'POST' });
		expect(api.calls[0].address).toMatch(/\/meetings\/meeting-1\/active-session\/kick-all$/);
		const empty = fakeApi(() => new Response(JSON.stringify({ success: false, error: { message: 'No active session' } }), { status: 404 }));
		expect(await endActiveSession(settings, 'meeting-1', empty.fetcher)).toBe(false);
	});

	it('lists a meeting’s whole-room recordings and leaves out track recordings', async () => {
		const api = fakeApi(() =>
			ok([
				{ id: 'r1', status: 'UPLOADED', started_time: at(10).toISOString(), stopped_time: at(11).toISOString(), file_size: '2048', download_url: 'https://files.example/r1.mp4' },
				{ id: 'r2', status: 'RECORDING', type: 'TRACK' }
			])
		);
		const found = await meetingRecordings(settings, 'meeting-1', api.fetcher);
		expect(found).toEqual([
			{ identifier: 'r1', status: 'UPLOADED', startedAt: at(10).toISOString(), stoppedAt: at(11).toISOString(), durationSeconds: 3600, sizeBytes: 2048, downloadAddress: 'https://files.example/r1.mp4' }
		]);
		expect(api.calls[0].address).toContain('/recordings?meeting_id=meeting-1');
	});
});

describe('rooms and recordings in the database', () => {
	let database: D1Database;
	let calendarEvent: CalendarEvent;
	let account: string;

	beforeEach(async () => {
		database = testDatabase();
		account = (await verifiedAccount(database, 'ada@example.org')).identifier;
		const created = await createEvent(
			database,
			{
				slug: 'peacemaking-in-practice',
				title: 'Peacemaking in practice',
				summary: '',
				description: '',
				kind: 'talk',
				startsAt: at(10).toISOString(),
				endsAt: at(12).toISOString(),
				timeZone: 'America/Los_Angeles',
				venueName: null,
				venueAddress: null,
				onlineLink: null,
				recordingLink: null,
				recording: 'recorded',
				accessNotes: '',
				registrationClosesAt: null
			},
			null,
			today
		);
		if (!created.saved) throw new Error(created.problem);
		await changeEventStatus(database, (await eventByIdentifier(database, created.identifier)) as CalendarEvent, 'publish', null, today);
		calendarEvent = (await eventByIdentifier(database, created.identifier)) as CalendarEvent;
		await saveEventRoom(database, calendarEvent, { style: 'webinar', watchers: 'registered' }, today);
	});

	it('keeps the first meeting made for a room', async () => {
		expect(await keepMeeting(database, calendarEvent.identifier, 'meeting-1', today)).toBe('meeting-1');
		expect(await keepMeeting(database, calendarEvent.identifier, 'meeting-2', today)).toBe('meeting-1');
		expect((await roomOfEvent(database, calendarEvent.identifier))?.meeting).toBe('meeting-1');
	});

	it('keeps what each person was told, and their participant id across visits', async () => {
		const visitor = { kind: 'account' as const, identifier: account };
		await noteRoomVisit(database, { room: calendarEvent.identifier, visitor, name: 'Ada', role: 'guest', toldRecording: 'undecided', participant: 'p-1' }, at(9.6));
		await noteRoomVisit(database, { room: calendarEvent.identifier, visitor, name: 'Ada', role: 'guest', toldRecording: 'recorded' }, at(10));
		const person = await roomPerson(database, calendarEvent.identifier, visitor);
		expect(person).toMatchObject({ participant: 'p-1', toldRecording: 'recorded', toldAt: at(10).toISOString() });
	});

	it('copies a finished recording into the bucket once, and holds it for the virus check', async () => {
		await keepMeeting(database, calendarEvent.identifier, 'meeting-1', today);
		const bytes = new TextEncoder().encode('not really a video');
		const api = fakeApi((call) =>
			call.address.startsWith('https://files.example/')
				? new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
				: ok([{ id: 'r1', status: 'UPLOADED', started_time: at(10).toISOString(), stopped_time: at(11).toISOString(), download_url: 'https://files.example/r1.mp4' }])
		);
		const stored = new Map<string, Uint8Array>();
		const bucket = {
			put: async (key: string, value: ReadableStream) => {
				stored.set(key, new Uint8Array(await new Response(value).arrayBuffer()));
				return null;
			}
		} as unknown as R2Bucket;

		const first = await syncRoomRecordings({ database, bucket, settings, fetcher: api.fetcher }, at(11.5));
		expect(first).toMatchObject({ rooms: 1, seen: 1, copied: 1, failed: 0 });
		const key = recordingObjectKey(calendarEvent.identifier, 'r1');
		expect(new TextDecoder().decode(stored.get(key))).toBe('not really a video');
		expect((await fileScan(database, key))?.status).toBe('waiting');
		expect((await fileScan(database, key))?.purpose).toBe('room-recording');
		const [recording] = await recordingsOf(database, calendarEvent.identifier);
		expect(recording).toMatchObject({ identifier: 'r1', objectKey: key, durationSeconds: 3600, sizeBytes: bytes.length });

		const second = await syncRoomRecordings({ database, bucket, settings, fetcher: api.fetcher }, at(11.75));
		expect(second.copied).toBe(0);
		expect(api.calls.filter((call) => call.address.startsWith('https://files.example/'))).toHaveLength(1);
	});

	it('notes a failed copy and tries again on the next run', async () => {
		await keepMeeting(database, calendarEvent.identifier, 'meeting-1', today);
		const api = fakeApi((call) =>
			call.address.startsWith('https://files.example/')
				? new Response('gone', { status: 404 })
				: ok([{ id: 'r1', status: 'UPLOADED', download_url: 'https://files.example/r1.mp4' }])
		);
		const bucket = { put: async () => null } as unknown as R2Bucket;
		const result = await syncRoomRecordings({ database, bucket, settings, fetcher: api.fetcher }, at(11.5));
		expect(result.failed).toBe(1);
		const [recording] = await recordingsOf(database, calendarEvent.identifier);
		expect(recording).toMatchObject({ objectKey: null, copyAttempts: 1, copyProblem: 'the download answered 404' });
	});

	it('leaves rooms alone a week after their event', async () => {
		await keepMeeting(database, calendarEvent.identifier, 'meeting-1', today);
		const api = fakeApi(() => ok([]));
		const bucket = { put: async () => null } as unknown as R2Bucket;
		expect((await syncRoomRecordings({ database, bucket, settings, fetcher: api.fetcher }, at(12 + 24 * 9))).rooms).toBe(0);
		expect(api.calls).toHaveLength(0);
	});

	it('hides a recording, and keeps a room with recordings when it is turned off', async () => {
		await keepMeeting(database, calendarEvent.identifier, 'meeting-1', today);
		const api = fakeApi(() => ok([{ id: 'r1', status: 'RECORDING' }]));
		await syncRoomRecordings({ database, bucket: { put: async () => null } as unknown as R2Bucket, settings, fetcher: api.fetcher }, at(10.5));
		expect(await setRecordingHidden(database, calendarEvent.identifier, 'r1', true, at(11))).toBe(true);
		expect((await recordingsOf(database, calendarEvent.identifier))[0].hidden).toBe(true);
		expect(await removeRoom(database, calendarEvent.identifier)).toBe(false);
		expect(await roomOfEvent(database, calendarEvent.identifier)).toBeDefined();
	});

	it('turns a room without recordings off', async () => {
		expect(await removeRoom(database, calendarEvent.identifier)).toBe(true);
		expect(await roomOfEvent(database, calendarEvent.identifier)).toBeUndefined();
	});
});

describe('rooms of their own', () => {
	let database: D1Database;
	let host: string;

	beforeEach(async () => {
		database = testDatabase();
		host = (await verifiedAccount(database, 'host@example.org')).identifier;
	});

	/** RealtimeKit as the tests see it: a new meeting id for each meeting, a new participant for each person added. */
	function realtimeKit() {
		let meetings = 0;
		let participants = 0;
		return fakeApi((call) => {
			if (call.address.endsWith('/meetings')) return ok({ id: `meeting-${++meetings}` });
			if (call.address.endsWith('/token')) return ok({ token: 'fresh-token' });
			if (call.address.endsWith('/participants')) return ok({ id: `participant-${++participants}`, token: `token-${participants}` });
			return ok([]);
		});
	}

	it('starts an instant room: private, open now for four hours, with a guest link', async () => {
		const started = await startInstantRoom(database, { recording: 'undecided', timeZone: 'America/Los_Angeles', createdBy: host }, at(0));
		const room = (await roomByIdentifier(database, started.room)) as StandaloneRoom;
		expect(room).toMatchObject({ visibility: 'private', recording: 'undecided', watchers: 'hosts', style: 'discussion', createdBy: host });
		expect(room.startsAt).toBe(at(0).toISOString());
		expect(room.closesAt).toBe(at(4).toISOString());
		expect(room.title).toMatch(/^Room started /);
		const invite = await inviteBySecret(database, started.room, started.secret);
		expect(invite).toMatchObject({ role: 'guest', name: 'Guest', revokedAt: null });
		expect(await inviteBySecret(database, started.room, 'not-the-secret-not-the-secret-not-the')).toBeUndefined();
		expect(await inviteBySecret(database, 'another-room', started.secret)).toBeUndefined();
	});

	it('runs several rooms at once, each with its own meeting', async () => {
		const api = realtimeKit();
		const first = (await roomByIdentifier(database, (await startInstantRoom(database, { recording: 'recorded', timeZone: 'America/Los_Angeles', createdBy: host }, at(0))).room)) as StandaloneRoom;
		const second = (await roomByIdentifier(database, (await startInstantRoom(database, { recording: 'recorded', timeZone: 'America/Los_Angeles', createdBy: host }, at(0))).room)) as StandaloneRoom;
		const visitor = { kind: 'account' as const, identifier: host };
		const input = { visitor, name: 'Host', role: 'host' as const, toldRecording: 'recorded' as const };
		await letIntoRoom({ database, settings, fetcher: api.fetcher }, { ...input, room: first, window: first }, at(0.1));
		await letIntoRoom({ database, settings, fetcher: api.fetcher }, { ...input, room: second, window: second }, at(0.1));
		expect((await roomByIdentifier(database, first.identifier))?.meeting).toBe('meeting-1');
		expect((await roomByIdentifier(database, second.identifier))?.meeting).toBe('meeting-2');
	});

	it('lets two people in on one shared link as two people, and the same browser back in as the same person', async () => {
		const api = realtimeKit();
		const started = await startInstantRoom(database, { recording: 'recorded', timeZone: 'America/Los_Angeles', createdBy: host }, at(0));
		let room = (await roomByIdentifier(database, started.room)) as StandaloneRoom;
		const invite = (await inviteBySecret(database, room.identifier, started.secret))!;
		const join = async (browser: string, name: string) => {
			room = (await roomByIdentifier(database, started.room)) as StandaloneRoom;
			return letIntoRoom(
				{ database, settings, fetcher: api.fetcher },
				{ room, window: room, visitor: { kind: 'invite', identifier: invite.identifier, browser }, name, role: 'guest', toldRecording: 'recorded' },
				at(0.2)
			);
		};
		expect(await join('browser-aaaaaaaa', 'Elder Ruth')).toBe('token-1');
		expect(await join('browser-bbbbbbbb', 'Sam')).toBe('token-2');
		expect(await join('browser-aaaaaaaa', 'Elder Ruth')).toBe('fresh-token');
		const added = api.calls.filter((call) => call.address.endsWith('/participants'));
		expect(added.map((call) => (call.body as { custom_participant_id: string }).custom_participant_id)).toEqual([
			`invite-${invite.identifier}-browser-aaaaaaaa`,
			`invite-${invite.identifier}-browser-bbbbbbbb`
		]);
		expect((added[0].body as { token: { expires_on: string } }).token.expires_on).toBe(at(4).toISOString());
		const visitors = await roomVisitors(database, room.identifier);
		expect(visitors.map((visitor) => [visitor.name, visitor.inviteIdentifier, visitor.accountIdentifier, visitor.toldRecording])).toEqual([
			['Elder Ruth', invite.identifier, null, 'recorded'],
			['Sam', invite.identifier, null, 'recorded']
		]);
		expect((await inviteBySecret(database, room.identifier, started.secret))?.lastUsedAt).toBe(at(0.2).toISOString());
	});

	it('turns an invite link off for good', async () => {
		const room = await createRoom(
			database,
			{ title: 'Interview', visibility: 'private', style: 'discussion', recording: 'recorded', watchers: 'hosts', startsAt: at(10), closesAt: at(12), timeZone: 'America/Denver' },
			host,
			today
		);
		const made = await createInvite(database, { room, name: 'A peacemaker', role: 'guest', createdBy: host }, today);
		expect(await revokeInvite(database, room, made.identifier, at(1))).toBe(true);
		expect(await revokeInvite(database, room, made.identifier, at(2))).toBe(false);
		expect((await inviteBySecret(database, room, made.secret))?.revokedAt).toBe(at(1).toISOString());
	});

	it('closes a room now, and keeps one open longer, counting from now once it has closed', async () => {
		const room = await createRoom(
			database,
			{ title: 'Talking circle', visibility: 'public', style: 'discussion', recording: 'not-recorded', watchers: 'hosts', startsAt: at(0), closesAt: at(2), timeZone: 'America/Chicago' },
			host,
			today
		);
		expect(await keepRoomOpen(database, room, 1, at(1))).toBe(true);
		expect((await roomByIdentifier(database, room))?.closesAt).toBe(at(3).toISOString());
		expect(await closeRoom(database, room, at(1.5))).toBe(true);
		expect((await roomByIdentifier(database, room))?.closesAt).toBe(at(1.5).toISOString());
		expect(await closeRoom(database, room, at(1.6))).toBe(false);
		await keepRoomOpen(database, room, 1, at(5));
		expect((await roomByIdentifier(database, room))?.closesAt).toBe(at(6).toISOString());
	});

	it('lists only public rooms still open on the Rooms page', async () => {
		const room = { style: 'discussion' as const, recording: 'recorded' as const, watchers: 'hosts' as const, timeZone: 'America/Los_Angeles' };
		await createRoom(database, { ...room, title: 'Open public', visibility: 'public', startsAt: at(0), closesAt: at(2) }, host, today);
		await createRoom(database, { ...room, title: 'Closed public', visibility: 'public', startsAt: at(-3), closesAt: at(-1) }, host, today);
		await createRoom(database, { ...room, title: 'Interview', visibility: 'private', startsAt: at(0), closesAt: at(2) }, host, today);
		const listed = await standaloneRooms(database, { visibility: 'public', openAt: at(1) });
		expect(listed.map((item) => item.title)).toEqual(['Open public']);
		expect((await standaloneRooms(database, { createdBy: host })).map((item) => item.title).sort()).toEqual(['Closed public', 'Interview', 'Open public']);
	});

	it('copies the recordings of a room of its own, keyed by the room', async () => {
		const room = await createRoom(
			database,
			{ title: 'Interview', visibility: 'private', style: 'discussion', recording: 'recorded', watchers: 'hosts', startsAt: at(10), closesAt: at(12), timeZone: 'America/Denver' },
			host,
			today
		);
		await keepMeeting(database, room, 'meeting-9', today);
		const bytes = new TextEncoder().encode('an interview');
		const api = fakeApi((call) =>
			call.address.startsWith('https://files.example/')
				? new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
				: ok([{ id: 'r9', status: 'UPLOADED', download_url: 'https://files.example/r9.mp4' }])
		);
		const bucket = { put: async () => null } as unknown as R2Bucket;
		expect(await syncRoomRecordings({ database, bucket, settings, fetcher: api.fetcher }, at(12.5))).toMatchObject({ rooms: 1, copied: 1 });
		const key = recordingObjectKey(room, 'r9');
		expect(key).toBe(`room-recordings/${room}/r9.mp4`);
		expect((await fileScan(database, key))?.subject).toBe(room);
		expect(await removeRoom(database, room)).toBe(false);
	});
});
