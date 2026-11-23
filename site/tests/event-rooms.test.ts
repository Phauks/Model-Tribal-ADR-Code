/**
 * The events video room: who may enter, what they are told about recording,
 * the calls to RealtimeKit, and the run that copies recordings into the
 * private bucket and puts them in line for the virus check.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { durationWords, recordingNotice, roomAccess, roomClosesAt, roomIsOpen, roomPreset } from '#lib/event-rooms.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import { changeEventStatus, createEvent, eventByIdentifier, type CalendarEvent } from '#lib/server/event-calendar.ts';
import {
	keepMeeting,
	mayWatchRecordings,
	noteRoomVisit,
	recordingObjectKey,
	recordingsOf,
	removeRoom,
	roomOf,
	roomPerson,
	saveRoom,
	setRecordingHidden,
	syncRoomRecordings
} from '#lib/server/event-rooms.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { addParticipant, createMeeting, meetingRecordings, refreshParticipantToken, videoRoomSettings, type Fetcher } from '#lib/server/realtime-kit.ts';
import { testDatabase } from './database.ts';

const hour = 3_600_000;
const today = new Date('2027-03-01T12:00:00.000Z');
const at = (hours: number) => new Date(today.getTime() + hours * hour);
const settings = { account: 'account-1', application: 'app-1', token: 'secret-token' };

const event = { status: 'published', startsAt: at(10).toISOString(), endsAt: at(12).toISOString() };

describe('who may enter a room', () => {
	const guest = { event, host: false, signedIn: true, seatKinds: 1, registration: { status: 'registered', attendance: 'online' } };

	it('opens 30 minutes before the start and closes two hours after the end', () => {
		expect(roomIsOpen(event, at(9.4))).toBe(false);
		expect(roomIsOpen(event, at(9.5))).toBe(true);
		expect(roomIsOpen(event, at(13.9))).toBe(true);
		expect(roomIsOpen(event, at(14))).toBe(false);
		expect(roomClosesAt(event).toISOString()).toBe(at(14).toISOString());
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

describe('the recording notice', () => {
	it('asks for agreement when the room is or may be recorded, and says who may watch', () => {
		const recorded = recordingNotice('recorded', 'registered');
		expect(recorded.needsAgreement).toBe(true);
		expect(recorded.text).toContain('the people who registered for this event');
		expect(recorded.text).toContain('tone');
		expect(recordingNotice('undecided', 'hosts').needsAgreement).toBe(true);
		expect(recordingNotice('undecided', 'hosts').text).toContain('only the people running');
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
	it('stays off until all three settings are set', () => {
		expect(videoRoomSettings({})).toBeNull();
		expect(videoRoomSettings({ VIDEO_ROOM_ACCOUNT: 'a', VIDEO_ROOM_APPLICATION: 'b' })).toBeNull();
		expect(videoRoomSettings({ VIDEO_ROOM_ACCOUNT: 'a', VIDEO_ROOM_APPLICATION: 'b', VIDEO_ROOM_TOKEN: ' c ' })).toEqual({ account: 'a', application: 'b', token: 'c' });
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
		await saveRoom(database, calendarEvent.identifier, { style: 'webinar', watchers: 'registered' }, today);
	});

	it('keeps the first meeting made for a room', async () => {
		expect(await keepMeeting(database, calendarEvent.identifier, 'meeting-1', today)).toBe('meeting-1');
		expect(await keepMeeting(database, calendarEvent.identifier, 'meeting-2', today)).toBe('meeting-1');
		expect((await roomOf(database, calendarEvent.identifier))?.meeting).toBe('meeting-1');
	});

	it('keeps what each person was told, and their participant id across visits', async () => {
		await noteRoomVisit(database, { eventIdentifier: calendarEvent.identifier, accountIdentifier: account, role: 'guest', toldRecording: 'undecided', participant: 'p-1' }, at(9.6));
		await noteRoomVisit(database, { eventIdentifier: calendarEvent.identifier, accountIdentifier: account, role: 'guest', toldRecording: 'recorded' }, at(10));
		const person = await roomPerson(database, calendarEvent.identifier, account);
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
		expect((await fileScan(database, key))?.purpose).toBe('event-recording');
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
		expect(await roomOf(database, calendarEvent.identifier)).toBeDefined();
	});

	it('turns a room without recordings off', async () => {
		expect(await removeRoom(database, calendarEvent.identifier)).toBe(true);
		expect(await roomOf(database, calendarEvent.identifier)).toBeUndefined();
	});
});
