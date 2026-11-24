import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeCodes } from '#lib/essays/live-protocol.ts';
import type { AccessLevel } from '#lib/permissions.ts';
import { setGrant } from '#lib/server/access.ts';
import type { ActiveSession } from '#lib/server/accounts.ts';
import { isLiveEditingRequest, notifyLiveRoom, openLiveEditing } from '#lib/server/live-editing.ts';
import { visitorHeaders } from '#lib/server/live/essay-room.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));
vi.mock('virtual:essay-library', () => ({ essaysInGit: {} }));

const site = 'https://example.org';
const essay = 'i-key-cases-digest';
const now = new Date('2026-11-24T12:00:00Z');

/**
 * Stand-ins for the Workers runtime: a WebSocket pair whose server end
 * records how it was closed, and a Response that takes status 101, which
 * Node's own Response refuses.
 */
class FakeResponse {
	readonly status: number;
	readonly webSocket: unknown;
	constructor(_body: unknown, init: { status?: number; webSocket?: unknown } = {}) {
		this.status = init.status ?? 200;
		this.webSocket = init.webSocket;
	}
}
class FakeWebSocketPair {
	0: { end: 'client'; closed?: { code: number; reason: string } };
	1: { accepted: boolean; accept(): void; close(code: number, reason: string): void };
	constructor() {
		const client: FakeWebSocketPair[0] = { end: 'client' };
		this[0] = client;
		this[1] = {
			accepted: false,
			accept() {
				this.accepted = true;
			},
			close(code, reason) {
				if (!this.accepted) throw new Error('Closed before it was accepted');
				client.closed = { code, reason };
			}
		};
	}
}

/** How a refused connection was closed. */
function closing(response: Response): { status: number; code?: number; reason?: string } {
	const answer = response as unknown as FakeResponse;
	const client = answer.webSocket as FakeWebSocketPair[0] | undefined;
	return { status: answer.status, code: client?.closed?.code, reason: client?.closed?.reason };
}

interface RoomCall {
	name: string;
	address: string;
	init: { method?: string; headers: Headers | Record<string, string> };
}

/** A stand-in for the EssayRoom namespace that records each call. */
function rooms(answer: (call: RoomCall) => unknown = () => ({ status: 101, fromRoom: true })) {
	const calls: RoomCall[] = [];
	return {
		calls,
		getByName: (name: string) => ({
			fetch: async (address: string, init: RoomCall['init']) => {
				const call = { name, address, init };
				calls.push(call);
				return answer(call);
			}
		})
	};
}

let database: D1Database;
let lead: SignedInPerson;
let writer: SignedInPerson;
let reader: SignedInPerson;

async function addPerson(identifier: string, displayName: string, role: SignedInPerson['role']): Promise<SignedInPerson> {
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES (?, ?, ?, ?, 'active', '2026-11-20T00:00:00Z')`)
		.bind(identifier, `${identifier}@example.org`, displayName, role)
		.run();
	return { identifier, displayName, email: `${identifier}@example.org`, role, nationIdentifier: null };
}

function grant(person: SignedInPerson, level: AccessLevel, expiresAt: string | null = null) {
	return setGrant(database, { personIdentifier: person.identifier, subjectKind: 'essay', subjectIdentifier: essay, level, expiresAt, note: null }, lead);
}

const session = (expiresAt: string) => ({ expiresAt }) as ActiveSession;

function liveRequest({
	person,
	identifier = essay,
	origin = site,
	sessionEnds = '2026-12-01T00:00:00Z'
}: {
	person: SignedInPerson | undefined;
	identifier?: string;
	origin?: string | null;
	sessionEnds?: string | null;
}) {
	const url = new URL(`${site}/workspace/essays/${identifier}/live`);
	const headers = new Headers({ upgrade: 'websocket' });
	if (origin !== null) headers.set('origin', origin);
	return {
		request: new Request(url, { headers }),
		url,
		locals: { person, session: sessionEnds === null ? undefined : session(sessionEnds), twoStepNeeded: false } as App.Locals
	};
}

function headerOf(call: RoomCall, name: string): string | null {
	return new Headers(call.init.headers).get(name);
}

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'], now });
	vi.stubGlobal('Response', FakeResponse);
	vi.stubGlobal('WebSocketPair', FakeWebSocketPair);
	for (const key of Object.keys(bindings)) delete bindings[key];
	database = testDatabase();
	bindings.database = database;
	lead = await addPerson('lead', 'Lead Author', 'lead-author');
	writer = await addPerson('writer', 'Rosa Núñez', 'contributor');
	reader = await addPerson('reader', 'Reader', 'co-author');
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('isLiveEditingRequest', () => {
	const request = (headers: Record<string, string>) => new Request(`${site}/x`, { headers });

	it('takes a WebSocket upgrade to an essay’s live address', () => {
		expect(isLiveEditingRequest(request({ upgrade: 'websocket' }), new URL(`${site}/workspace/essays/${essay}/live`))).toBe(true);
		expect(isLiveEditingRequest(request({ upgrade: 'WebSocket' }), new URL(`${site}/workspace/essays/${essay}/live`))).toBe(true);
	});

	it('leaves ordinary requests and other addresses to SvelteKit', () => {
		expect(isLiveEditingRequest(request({}), new URL(`${site}/workspace/essays/${essay}/live`))).toBe(false);
		expect(isLiveEditingRequest(request({ upgrade: 'websocket' }), new URL(`${site}/workspace/essays/${essay}`))).toBe(false);
		expect(isLiveEditingRequest(request({ upgrade: 'websocket' }), new URL(`${site}/workspace/essays/${essay}/live/more`))).toBe(false);
		expect(isLiveEditingRequest(request({ upgrade: 'websocket' }), new URL(`${site}/workspace/essays/a/b/live`))).toBe(false);
	});
});

describe('openLiveEditing', () => {
	it('refuses a connection opened from another site, or with no origin, before anything else', async () => {
		bindings.essayRooms = rooms();
		for (const origin of ['https://elsewhere.example', null]) {
			const answer = closing(await openLiveEditing(liveRequest({ person: lead, origin })));
			expect(answer).toEqual({ status: 101, code: closeCodes.noAccess, reason: 'Live editing opens only from this site’s own pages.' });
		}
	});

	it('refuses an address that cannot be an essay', async () => {
		expect(closing(await openLiveEditing(liveRequest({ person: lead, identifier: 'Not_An_Essay' })))).toMatchObject({ code: closeCodes.badRequest });
	});

	it('asks someone signed out, or without a session, to sign in again', async () => {
		for (const request of [liveRequest({ person: undefined }), liveRequest({ person: lead, sessionEnds: null })]) {
			expect(closing(await openLiveEditing(request))).toEqual({ status: 101, code: closeCodes.signedOut, reason: 'Sign in again to edit live.' });
		}
	});

	it('refuses someone with no access to the essay, and never reaches the room', async () => {
		const namespace = rooms();
		bindings.essayRooms = namespace;
		expect(closing(await openLiveEditing(liveRequest({ person: writer })))).toMatchObject({ code: closeCodes.noAccess, reason: 'You do not have access to this essay.' });
		expect(namespace.calls).toEqual([]);
	});

	it('refuses someone whose grant has expired, or whose own grant takes away their role’s access', async () => {
		bindings.essayRooms = rooms();
		await grant(writer, 'full', '2026-11-01T00:00:00.000Z');
		expect(closing(await openLiveEditing(liveRequest({ person: writer })))).toMatchObject({ code: closeCodes.noAccess });
		await grant(reader, 'no-access');
		expect(closing(await openLiveEditing(liveRequest({ person: reader })))).toMatchObject({ code: closeCodes.noAccess });
	});

	it('hands the connection to the essay’s own room with the person’s name and level', async () => {
		const namespace = rooms();
		bindings.essayRooms = namespace;
		await grant(writer, 'contribute');
		const answer = (await openLiveEditing(liveRequest({ person: writer }))) as unknown as { fromRoom: boolean };
		expect(answer.fromRoom).toBe(true);
		const [call] = namespace.calls;
		expect(call.name).toBe(`essay:${essay}`);
		expect(call.address).toBe('https://essay-room/connect');
		expect(headerOf(call, 'upgrade')).toBe('websocket');
		expect(headerOf(call, visitorHeaders.essay)).toBe(essay);
		expect(headerOf(call, visitorHeaders.person)).toBe('writer');
		expect(decodeURIComponent(headerOf(call, visitorHeaders.name)!)).toBe('Rosa Núñez');
		expect(headerOf(call, visitorHeaders.level)).toBe('contribute');
	});

	it('gives each person their own level: comment by role, full for the lead author', async () => {
		const namespace = rooms();
		bindings.essayRooms = namespace;
		await openLiveEditing(liveRequest({ person: reader }));
		await openLiveEditing(liveRequest({ person: lead }));
		expect(namespace.calls.map((call) => headerOf(call, visitorHeaders.level))).toEqual(['comment', 'full']);
	});

	it('tells the room to close the connection when the session would end', async () => {
		const namespace = rooms();
		bindings.essayRooms = namespace;
		// A session that ends in an hour ends then.
		await openLiveEditing(liveRequest({ person: lead, sessionEnds: '2026-11-24T13:00:00Z' }));
		// A longer one ends after four hours without use, since a live connection does not count as use.
		await openLiveEditing(liveRequest({ person: lead, sessionEnds: '2026-12-24T00:00:00Z' }));
		expect(namespace.calls.map((call) => Number(headerOf(call, visitorHeaders.sessionEnds)))).toEqual([
			Date.parse('2026-11-24T13:00:00Z'),
			Date.parse('2026-11-24T16:00:00Z')
		]);
	});

	it('asks the editor to try again later when live editing is not set up or the room does not answer', async () => {
		expect(closing(await openLiveEditing(liveRequest({ person: lead })))).toMatchObject({ code: 4503 });
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		bindings.essayRooms = rooms(() => {
			throw new Error('No answer');
		});
		expect(closing(await openLiveEditing(liveRequest({ person: lead })))).toEqual({
			status: 101,
			code: 4503,
			reason: 'The live editing room did not answer. Trying again.'
		});
		expect(quiet).toHaveBeenCalledOnce();
	});
});

describe('notifyLiveRoom', () => {
	it('asks the essay’s room to look for a new version', async () => {
		const namespace = rooms();
		bindings.essayRooms = namespace;
		await notifyLiveRoom(essay);
		const [call] = namespace.calls;
		expect(call).toMatchObject({ name: `essay:${essay}`, address: 'https://essay-room/refresh', init: { method: 'POST' } });
		expect(headerOf(call, visitorHeaders.essay)).toBe(essay);
	});

	it('does nothing when live editing is not set up, and only logs a room that does not answer', async () => {
		await expect(notifyLiveRoom(essay)).resolves.toBeUndefined();
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		bindings.essayRooms = rooms(() => {
			throw new Error('No answer');
		});
		await expect(notifyLiveRoom(essay)).resolves.toBeUndefined();
		expect(quiet).toHaveBeenCalledOnce();
	});
});
