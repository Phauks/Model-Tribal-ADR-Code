/**
 * The live editing room (src/lib/server/live/essay-room.ts), run in Node
 * with stand-ins for the Durable Object's storage and sockets, and real
 * Yjs documents playing the browsers.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, DurableObjectState, R2Bucket, WebSocket as WorkerWebSocket } from '@cloudflare/workers-types/index.ts';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { updateYFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import * as Y from 'yjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { essaySchema, parseEssay, serializeEssay as serializeForTest } from '#lib/essays/document.ts';
import { bodyFragment, closeCodes, frontMatterText, messageTypes, type RoomFacts } from '#lib/essays/live-protocol.ts';
import { splitFrontMatter } from '#lib/essays/syntax.ts';
import { latestVersion, readVersionText, saveVersion, versions } from '#lib/server/essays.ts';
import { EssayRoom, quietBeforeSaving, type RoomLevel, type Visitor } from '#lib/server/live/essay-room.ts';
import { versionBlame } from '#lib/server/essay-credits.ts';
import { testDatabase } from './database.ts';

function memoryBucket(): R2Bucket {
	const files = new Map<string, string>();
	return {
		async put(key: string, value: string, options?: { onlyIf?: Headers }) {
			if (options?.onlyIf?.get('If-None-Match') === '*' && files.has(key)) return null;
			files.set(key, value);
			return { key };
		},
		async head(key: string) {
			return files.has(key) ? { key } : null;
		},
		async get(key: string) {
			const value = files.get(key);
			return value === undefined ? null : { text: async () => value, json: async () => JSON.parse(value) };
		},
		async list({ prefix }: { prefix: string }) {
			return { objects: [...files.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })), truncated: false };
		}
	} as unknown as R2Bucket;
}

/** Durable Object storage backed by Node's SQLite, as in the runtime: SQL, an alarm and synchronous transactions. */
function roomStorage() {
	const database = new DatabaseSync(':memory:');
	let alarm: number | null = null;
	const sql = {
		exec(query: string, ...bindings: (string | number | null | Uint8Array)[]) {
			const rows = database.prepare(query).all(...bindings) as Record<string, unknown>[];
			return {
				toArray: () => rows,
				one: () => {
					if (rows.length !== 1) throw new Error(`Expected one row, got ${rows.length}`);
					return rows[0];
				},
				[Symbol.iterator]: () => rows[Symbol.iterator]()
			};
		}
	};
	return {
		sql,
		getAlarm: async () => alarm,
		setAlarm: async (at: number) => {
			alarm = at;
		},
		deleteAlarm: async () => {
			alarm = null;
		},
		transactionSync<T>(work: () => T): T {
			database.exec('BEGIN');
			try {
				const result = work();
				database.exec('COMMIT');
				return result;
			} catch (problem) {
				database.exec('ROLLBACK');
				throw problem;
			}
		},
		get alarm() {
			return alarm;
		}
	};
}

class TestSocket {
	sent: Uint8Array[] = [];
	closed: { code: number; reason: string } | undefined;
	private attachment: unknown = null;
	send(message: Uint8Array) {
		if (this.closed) throw new Error('closed');
		this.sent.push(message);
	}
	close(code: number, reason: string) {
		this.closed ??= { code, reason };
	}
	serializeAttachment(value: unknown) {
		this.attachment = structuredClone(value);
	}
	deserializeAttachment() {
		return structuredClone(this.attachment);
	}
}

function roomContext(storage: ReturnType<typeof roomStorage>) {
	const sockets: TestSocket[] = [];
	const context = {
		storage,
		sockets,
		blockConcurrencyWhile: async <T>(work: () => Promise<T>) => work(),
		getWebSockets: () => sockets.filter((socket) => !socket.closed),
		acceptWebSocket: (socket: TestSocket) => sockets.push(socket)
	};
	return context;
}

/** A browser in the room: a Yjs document kept in step over a TestSocket. */
class TestBrowser {
	readonly document = new Y.Doc();
	readonly socket = new TestSocket();
	facts: RoomFacts | undefined;
	awareness = new Map<number, { clock: number; state: unknown }>();
	private read = 0;
	private pending: Promise<void>[] = [];

	constructor(
		private readonly room: EssayRoom,
		readonly visitor: Visitor
	) {
		this.document.on('update', (update: Uint8Array, origin: unknown) => {
			if (origin === this) return;
			this.send(messageTypes.sync, 2, update);
		});
	}

	private send(type: number, ...parts: (number | Uint8Array | string)[]) {
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, type);
		for (const part of parts) {
			if (typeof part === 'number') encoding.writeVarUint(encoder, part);
			else if (typeof part === 'string') encoding.writeVarString(encoder, part);
			else encoding.writeVarUint8Array(encoder, part);
		}
		const message = encoding.toUint8Array(encoder);
		// A closed connection delivers nothing more.
		if (this.socket.closed) return;
		this.pending.push(this.room.webSocketMessage(this.socket as unknown as WorkerWebSocket, message.slice().buffer));
	}

	/** Joins as y-websocket does: the server greets, the browser sends step 1 and answers the server's step 1. */
	async join() {
		this.socket.serializeAttachment(this.visitor);
		roomContexts.get(this.room)!.acceptWebSocket(this.socket);
		await this.room.join(this.socket as unknown as WorkerWebSocket, this.visitor);
		this.send(messageTypes.sync, 0, Y.encodeStateVector(this.document));
		await this.settle();
	}

	/** Reads everything the room sent, answering as y-websocket would, until nothing is left. */
	async settle() {
		for (let rounds = 0; rounds < 20; rounds += 1) {
			await Promise.all(this.pending.splice(0));
			if (this.read >= this.socket.sent.length) return;
			while (this.read < this.socket.sent.length) this.receive(this.socket.sent[this.read++]);
		}
	}

	private receive(message: Uint8Array) {
		const decoder = decoding.createDecoder(message);
		const type = decoding.readVarUint(decoder);
		if (type === messageTypes.room) this.facts = JSON.parse(decoding.readVarString(decoder));
		else if (type === messageTypes.sync) {
			const kind = decoding.readVarUint(decoder);
			const data = decoding.readVarUint8Array(decoder);
			if (kind === 0) this.send(messageTypes.sync, 1, Y.encodeStateAsUpdate(this.document, data));
			else Y.applyUpdate(this.document, data, this);
		} else if (type === messageTypes.awareness) {
			const update = decoding.createDecoder(decoding.readVarUint8Array(decoder));
			const count = decoding.readVarUint(update);
			for (let index = 0; index < count; index += 1) {
				const client = decoding.readVarUint(update);
				const clock = decoding.readVarUint(update);
				const state = JSON.parse(decoding.readVarString(update));
				if (state === null) this.awareness.delete(client);
				else this.awareness.set(client, { clock, state });
			}
		}
	}

	sendAwareness(client: number, clock: number, state: unknown) {
		const update = encoding.createEncoder();
		encoding.writeVarUint(update, 1);
		encoding.writeVarUint(update, client);
		encoding.writeVarUint(update, clock);
		encoding.writeVarString(update, JSON.stringify(state));
		this.send(messageTypes.awareness, encoding.toUint8Array(update));
	}

	/** Edits the body as the editor would: a new ProseMirror document, written into the shared fragment. */
	editBody(change: (body: string) => string) {
		const fragment = this.document.getXmlFragment(bodyFragment);
		const current = yXmlFragmentToProseMirrorRootNode(fragment, essaySchema);
		const json = JSON.stringify(current.toJSON());
		const edited = parseEssay(change(serializeForTest(current)));
		if (JSON.stringify(edited.toJSON()) === json) throw new Error('The test edit changed nothing.');
		this.document.transact(() => updateYFragment(this.document, fragment, edited, { mapping: new Map(), isOMark: new Map() }));
	}

	text(): string {
		return this.document.getText(frontMatterText).toString();
	}
}


const roomContexts = new Map<EssayRoom, ReturnType<typeof roomContext>>();

function openRoom(storage = roomStorage()) {
	const context = roomContext(storage);
	const room = new EssayRoom(
		context as unknown as DurableObjectState,
		{ database, sourceDocuments: bucket }
	);
	roomContexts.set(room, context);
	return { room, context, storage };
}

function visitor(name: string, level: RoomLevel = 'contribute', person = name.toLowerCase()): Visitor {
	return { essay: 'tribal-courts', person, name, level, sessionEnds: Date.now() + 3_600_000, clients: {} };
}

const essayText = `---
title: Tribal courts
---

# Tribal courts

The first paragraph.

The second paragraph.

The third paragraph.
`;

let database: D1Database;
let bucket: R2Bucket;

beforeEach(async () => {
	database = testDatabase();
	bucket = memoryBucket();
	for (const person of ['dana', 'lee', 'sam']) {
		await database
			.prepare(
				"INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES (?, ?, ?, 'co-author', 'active', '2026-11-23T00:00:00Z')"
			)
			.bind(person, `${person}@example.org`, person)
			.run();
	}
	await saveVersion(database, bucket, { identifier: 'tribal-courts', text: essayText, basedOn: null, personIdentifier: null, origin: 'git' });
});

afterEach(() => {
	vi.useRealTimers();
	roomContexts.clear();
});

describe('starting a room', () => {
	it('starts from the newest saved version and keeps its text exactly', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, visitor('Dana'));
		await dana.join();
		expect(dana.facts).toMatchObject({ version: 1, canEdit: true, unsaved: false, savedAt: null });
		expect(dana.facts?.seed).toMatch(/^[0-9a-f-]{36}$/);
		expect(dana.text()).toBe('title: Tribal courts');
		expect(room.currentText(essayText)).toBe(essayText);
		expect(room.unsaved()).toBe(false);
	});

	it('refuses an essay with no saved version', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, { ...visitor('Dana'), essay: 'no-such-essay' });
		await dana.join();
		expect(dana.socket.closed?.code).toBe(closeCodes.noText);
	});

	const files = ['essays', 'back-matter'].flatMap((folder) => {
		const folderPath = path.resolve(import.meta.dirname, '../../content', folder);
		return readdirSync(folderPath)
			.filter((name) => name.endsWith('.md') && name !== 'README.md')
			.map((name) => path.join(folderPath, name));
	});
	it.each(files)('round-trips %s through the room unchanged', async (file) => {
		const text = readFileSync(file, 'utf8');
		const identifier = path.basename(file, '.md');
		const saved = await saveVersion(database, bucket, { identifier, text, basedOn: null, personIdentifier: null, origin: 'git' });
		const stored = await readVersionText(bucket, saved.version);
		const { room } = openRoom();
		const dana = new TestBrowser(room, { ...visitor('Dana'), essay: identifier });
		await dana.join();
		expect(dana.socket.closed).toBeUndefined();
		expect(room.currentText(stored)).toBe(stored);
		expect(splitFrontMatter(stored).frontMatter).toBe(dana.text());
	});
});

describe('editing together', () => {
	it('passes changes between browsers and saves one version naming the editors', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, visitor('Dana'));
		const lee = new TestBrowser(room, visitor('Lee'));
		await dana.join();
		await lee.join();

		dana.editBody((body) => body.replace('The first paragraph.', 'The first paragraph, edited by Dana.'));
		await dana.settle();
		await lee.settle();
		lee.editBody((body) => body.replace('The third paragraph.', 'The third paragraph, edited by Lee.'));
		await lee.settle();
		await dana.settle();
		expect(serializeForTest(yXmlFragmentToProseMirrorRootNode(dana.document.getXmlFragment(bodyFragment), essaySchema))).toContain(
			'edited by Lee'
		);
		expect(room.unsaved()).toBe(true);

		await room.save();
		await dana.settle();
		const latest = await latestVersion(database, 'tribal-courts');
		expect(latest).toMatchObject({ number: 2, origin: 'editor', person_identifier: 'lee', note: 'Edited live by Lee and Dana' });
		const text = await readVersionText(bucket, latest!);
		expect(text).toBe(
			essayText
				.replace('The first paragraph.', 'The first paragraph, edited by Dana.')
				.replace('The third paragraph.', 'The third paragraph, edited by Lee.')
		);
		expect(dana.facts).toMatchObject({ version: 2, savedBy: 'Lee and Dana', unsaved: false });
		expect(room.unsaved()).toBe(false);

		// Nothing new: no second version.
		await room.save();
		expect(await versions(database, 'tribal-courts')).toHaveLength(2);

		// Each is credited for the words they typed, though the version names only Lee.
		const blame = await versionBlame(database, bucket, 'tribal-courts', 2);
		const who = blame!.blame.paragraphs.map((paragraph) =>
			paragraph.words.flatMap(([person, , count]) => new Array(count).fill(blame!.blame.people[person]))
		);
		expect(who[1]).toEqual([null, null, null, 'dana', 'dana', 'dana']);
		expect(who[3]).toEqual([null, null, null, 'lee', 'lee', 'lee']);
	});

	it('lets people with comment access read along but keeps none of their changes', async () => {
		const { room } = openRoom();
		const sam = new TestBrowser(room, visitor('Sam', 'comment'));
		await sam.join();
		expect(sam.facts?.canEdit).toBe(false);
		sam.editBody((body) => body.replace('The second paragraph.', 'Changed by someone who may only comment.'));
		await sam.settle();
		expect(room.unsaved()).toBe(false);
		expect(room.currentText(essayText)).toBe(essayText);
	});

	it('keeps unsaved changes when the room restarts', async () => {
		const storage = roomStorage();
		const first = openRoom(storage);
		const dana = new TestBrowser(first.room, visitor('Dana'));
		await dana.join();
		dana.editBody((body) => body.replace('The second paragraph.', 'The second paragraph, before a restart.'));
		await dana.settle();

		const second = openRoom(storage);
		expect(second.room.unsaved()).toBe(true);
		expect(second.room.currentText(essayText)).toContain('before a restart');
		await second.room.save();
		expect((await latestVersion(database, 'tribal-courts'))?.number).toBe(2);
	});

	it('waits for a quiet minute before saving, then saves', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
		const { room, storage } = openRoom();
		const dana = new TestBrowser(room, visitor('Dana'));
		await dana.join();
		dana.editBody((body) => body.replace('The second paragraph.', 'Typed at noon.'));
		await dana.settle();
		expect(storage.alarm).toBe(Date.now() + quietBeforeSaving);

		vi.setSystemTime(new Date('2026-11-23T12:00:30Z'));
		dana.editBody((body) => body.replace('Typed at noon.', 'Typed at noon and half a minute.'));
		await dana.settle();
		vi.setSystemTime(new Date('2026-11-23T12:01:00Z'));
		await room.alarm();
		expect(await versions(database, 'tribal-courts')).toHaveLength(1);
		expect(storage.alarm).toBe(new Date('2026-11-23T12:01:30Z').getTime());

		vi.setSystemTime(new Date('2026-11-23T12:01:30Z'));
		await room.alarm();
		expect(await versions(database, 'tribal-courts')).toHaveLength(2);
	});
});

describe('versions saved another way', () => {
	it('combines a version saved meanwhile with the room’s changes, and brings it into the room', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, visitor('Dana'));
		await dana.join();
		dana.editBody((body) => body.replace('The first paragraph.', 'The room changed the first paragraph.'));
		await dana.settle();

		const elsewhere = essayText.replace('The third paragraph.', 'Git changed the third paragraph.');
		await saveVersion(database, bucket, { identifier: 'tribal-courts', text: elsewhere, basedOn: 1, personIdentifier: null, origin: 'git' });

		await room.save();
		await dana.settle();
		const latest = await latestVersion(database, 'tribal-courts');
		expect(latest).toMatchObject({ number: 3, note: 'Edited live by Dana, combined with version 2' });
		const combined = essayText
			.replace('The first paragraph.', 'The room changed the first paragraph.')
			.replace('The third paragraph.', 'Git changed the third paragraph.');
		expect(await readVersionText(bucket, latest!)).toBe(combined);
		expect(room.currentText(combined)).toBe(combined);
		expect(serializeForTest(yXmlFragmentToProseMirrorRootNode(dana.document.getXmlFragment(bodyFragment), essaySchema))).toContain(
			'Git changed the third paragraph.'
		);
	});

	it('saves over a version that changed the same paragraph, and says so', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, visitor('Dana'));
		await dana.join();
		dana.editBody((body) => body.replace('The first paragraph.', 'The room’s first paragraph.'));
		await dana.settle();
		await saveVersion(database, bucket, {
			identifier: 'tribal-courts',
			text: essayText.replace('The first paragraph.', 'Another first paragraph.'),
			basedOn: 1,
			personIdentifier: null,
			origin: 'git'
		});
		await room.save();
		const latest = await latestVersion(database, 'tribal-courts');
		expect(latest?.note).toContain('saved over version 2');
		expect(await readVersionText(bucket, latest!)).toContain('The room’s first paragraph.');
	});

	it('takes a newer version when someone joins a room with nothing unsaved', async () => {
		const storage = roomStorage();
		const first = openRoom(storage);
		await new TestBrowser(first.room, visitor('Dana')).join();
		const newer = essayText.replace('The second paragraph.', 'Restored text.');
		await saveVersion(database, bucket, { identifier: 'tribal-courts', text: newer, basedOn: 1, personIdentifier: null, origin: 'restore' });

		const { room } = openRoom(storage);
		const lee = new TestBrowser(room, visitor('Lee'));
		await lee.join();
		expect(lee.facts?.version).toBe(2);
		expect(room.currentText(newer)).toBe(newer);
		expect(room.unsaved()).toBe(false);
	});
});

describe('names and cursors', () => {
	it('puts the name the website knows on each cursor, echoes it to everyone, and clears it on leaving', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, visitor('Dana'));
		const lee = new TestBrowser(room, visitor('Lee'));
		await dana.join();
		await lee.join();
		dana.sendAwareness(dana.document.clientID, 1, { user: { name: 'Someone Else', color: '#0F4C54' }, cursor: null });
		await dana.settle();
		await lee.settle();
		expect(lee.awareness.get(dana.document.clientID)?.state).toEqual({ user: { name: 'Dana', color: '#0F4C54' }, cursor: null });
		expect(dana.awareness.has(dana.document.clientID)).toBe(true);

		// Lee cannot speak for Dana's client.
		lee.sendAwareness(dana.document.clientID, 2, { user: { name: 'Lee' } });
		await lee.settle();
		expect(lee.awareness.get(dana.document.clientID)?.state).toMatchObject({ user: { name: 'Dana' } });

		dana.socket.close(1000, 'Closed');
		await room.webSocketClose(dana.socket as unknown as WorkerWebSocket);
		await lee.settle();
		expect(lee.awareness.has(dana.document.clientID)).toBe(false);
	});

	it('closes the connection once the session has ended', async () => {
		const { room } = openRoom();
		const dana = new TestBrowser(room, { ...visitor('Dana'), sessionEnds: Date.now() - 1 });
		await dana.join();
		expect(dana.socket.closed?.code).toBe(closeCodes.signedOut);
	});
});
