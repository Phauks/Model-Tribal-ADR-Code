/**
 * The live editing room for one essay: a Cloudflare Durable Object that
 * holds the essay as a Yjs document while people edit it together, passes
 * each change to everyone in the room, and saves a version of the essay
 * after each pause in the editing.
 *
 * One room per essay, named "essay:<id>" (src/lib/server/live-editing.ts).
 * The room runs in its own Worker, model-tribal-adr-code-live
 * (live/wrangler.jsonc), so that the many deploys of the website do not
 * restart rooms in the middle of someone's typing. The website checks who
 * is connecting and passes their name and level on the essay in headers;
 * the room trusts those headers because only the website can reach it.
 *
 * How the text is kept (decision record 0021, versioning option A from the
 * editing review of Nov. 23, 2026):
 *
 * - The room starts from the newest saved version in the bucket, never from
 *   a browser's copy.
 * - Every change is written to the room's own SQLite storage before it is
 *   passed on, so a restart of the room loses nothing.
 * - About a minute after the typing stops (or after ten minutes of steady
 *   typing, or a few seconds after the last person leaves) the room saves
 *   one version through saveVersion, the same function the editor's Save
 *   uses, with a note naming who edited. Typing does not make a version per
 *   keystroke or per automatic save.
 * - If someone saved a version some other way in the meantime (git, a
 *   restore, the editor without the live room), the room combines the two
 *   texts paragraph by paragraph (mergeThreeWay) and brings the other
 *   version's changes into the room. If both changed the same paragraph,
 *   the room's text is saved on top and the note says so; the other
 *   version stays in the history.
 *
 * The connection speaks the y-websocket protocol (src/lib/essays/live-protocol.ts),
 * handled here by hand rather than with a library so the room can refuse
 * changes from people with comment access, and so it can put each
 * person's real name on their cursor.
 */
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { prosemirrorToYXmlFragment, updateYFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import * as Y from 'yjs';
import type {
	D1Database,
	DurableObjectState,
	R2Bucket,
	Request as WorkerRequest,
	Response as WorkerResponse,
	SqlStorage,
	WebSocket as WorkerWebSocket
} from '@cloudflare/workers-types/index.ts';
import { essaySchema, parseEssay, writeEssay } from '../../essays/document.ts';
import {
	bodyFragment,
	closeCodes,
	frontMatterText,
	largestMessageBytes,
	messageTypes,
	type RoomFacts
} from '../../essays/live-protocol.ts';
import { mergeThreeWay } from '../../essays/merge.ts';
import { compressOverlay, overlayKey, overlayOf } from '../../essays/word-blame.ts';
import { joinFrontMatter, splitFrontMatter } from '../../essays/syntax.ts';
import { SaveConflict, isEssayIdentifier, latestVersion, readVersionText, saveVersion, version, type VersionRow } from '../essays.ts';

/** The bindings the room's Worker has (live/wrangler.jsonc). */
export interface RoomEnvironment {
	database: D1Database;
	sourceDocuments: R2Bucket;
}

export type RoomLevel = 'comment' | 'contribute' | 'full';

/** Who is on one connection, as the website said when they joined. Kept on the socket, so it survives the room sleeping. */
export interface Visitor {
	essay: string;
	person: string;
	name: string;
	level: RoomLevel;
	/** When their session ends, in milliseconds since 1970; the room closes the connection after that. */
	sessionEnds: number;
	/** The awareness entries (cursor and name) this connection has sent, by Yjs client id. */
	clients: Record<string, { clock: number; state: string | null }>;
}

/** Headers the website sends with a connection (src/lib/server/live-editing.ts). */
export const visitorHeaders = {
	essay: 'x-live-essay',
	person: 'x-live-person',
	name: 'x-live-name',
	level: 'x-live-level',
	sessionEnds: 'x-live-session-ends'
} as const;

/** Save a version once nobody has typed for this long. */
export const quietBeforeSaving = 60_000;
/** But never leave changes unsaved longer than this, however steady the typing. */
export const longestUnsaved = 10 * 60_000;
/** Save this soon after the last person leaves. */
export const afterEveryoneLeaves = 5_000;
/** Try again this long after a save fails. */
const afterProblem = 60_000;
/** Storage rows hold at most 2 MB (Cloudflare, "Durable Objects limits"), so larger data is split into pieces this size. */
const pieceBytes = 1_000_000;
/** Awareness entries larger than this are dropped; a name, a color and a cursor take a few hundred bytes. */
const largestPresenceBytes = 4096;
/** Yjs client ids one connection may speak for (one per open editor; a few, to allow for reloads). */
const mostClientsPerConnection = 8;

/** Marks a change the room made itself (starting the text, or bringing in a saved version), as opposed to one from a person. */
const roomOrigin = Symbol('room');

/** The most turns between people one save replays to tell who typed what. */
const mostTurnsReplayed = 400;

/** A room document's text, written the way the editor's Save writes it. */
function textOf(document: Y.Doc, baseText: string): string {
	const body = yXmlFragmentToProseMirrorRootNode(document.getXmlFragment(bodyFragment), essaySchema);
	const frontMatter = document.getText(frontMatterText).toString();
	return tidy(joinFrontMatter(frontMatter, writeEssay(body, splitFrontMatter(baseText).body)));
}

/** Text as saveVersion stores it, so that texts can be compared before saving. */
function tidy(text: string): string {
	return text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\s*$/, '\n');
}

function joinedNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function visitorFromHeaders(headers: { get(name: string): string | null }): Visitor | null {
	const essay = headers.get(visitorHeaders.essay) ?? '';
	const person = headers.get(visitorHeaders.person) ?? '';
	const level = headers.get(visitorHeaders.level) ?? '';
	const sessionEnds = Number(headers.get(visitorHeaders.sessionEnds));
	let name = '';
	try {
		name = decodeURIComponent(headers.get(visitorHeaders.name) ?? '');
	} catch {
		return null;
	}
	if (!isEssayIdentifier(essay) || !person || !Number.isFinite(sessionEnds)) return null;
	if (level !== 'comment' && level !== 'contribute' && level !== 'full') return null;
	return { essay, person, name: name || 'A co-author', level, sessionEnds, clients: {} };
}

const canEdit = (visitor: Visitor) => visitor.level === 'contribute' || visitor.level === 'full';

export class EssayRoom {
	private readonly sql: SqlStorage;
	private document = new Y.Doc();
	/** The text of the version the room builds on, read once from the bucket. */
	private base: { number: number; text: string } | undefined;
	private alarmSet = false;
	private preparing: Promise<void> | undefined;
	private saving: Promise<void> | undefined;

	constructor(
		private readonly context: DurableObjectState,
		private readonly environment: RoomEnvironment
	) {
		this.sql = context.storage.sql;
		void context.blockConcurrencyWhile(async () => {
			this.createTables();
			this.load();
			this.alarmSet = (await context.storage.getAlarm()) !== null;
		});
	}

	// --- Storage -----------------------------------------------------------

	private createTables(): void {
		this.sql.exec(`CREATE TABLE IF NOT EXISTS facts (name TEXT PRIMARY KEY, value TEXT NOT NULL)`);
		// The whole Yjs document as of the last save, in pieces.
		this.sql.exec(`CREATE TABLE IF NOT EXISTS snapshot (piece INTEGER PRIMARY KEY, data BLOB NOT NULL)`);
		// Each change since then. A change larger than one row is split
		// across rows that follow each other; "continues" marks every piece
		// but the last. "person" is null for changes the room made itself.
		this.sql.exec(
			`CREATE TABLE IF NOT EXISTS changes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				data BLOB NOT NULL,
				continues INTEGER NOT NULL DEFAULT 0,
				at INTEGER NOT NULL,
				person TEXT,
				name TEXT
			)`
		);
	}

	private fact(name: string): string | undefined {
		const row = this.sql.exec<{ value: string }>('SELECT value FROM facts WHERE name = ?', name).toArray()[0];
		return row?.value;
	}

	private setFacts(facts: Record<string, string | number | null>): void {
		for (const [name, value] of Object.entries(facts)) {
			if (value === null) this.sql.exec('DELETE FROM facts WHERE name = ?', name);
			else this.sql.exec('INSERT OR REPLACE INTO facts (name, value) VALUES (?, ?)', name, String(value));
		}
	}

	/** Rebuilds the document from storage: the snapshot, then every change after it. */
	private load(): void {
		const document = new Y.Doc();
		const snapshot = this.sql.exec<{ data: ArrayBuffer }>('SELECT data FROM snapshot ORDER BY piece').toArray();
		if (snapshot.length > 0) Y.applyUpdate(document, joinPieces(snapshot.map((row) => row.data)), roomOrigin);
		let pieces: ArrayBuffer[] = [];
		for (const row of this.sql.exec<{ data: ArrayBuffer; continues: number }>('SELECT data, continues FROM changes ORDER BY id')) {
			pieces.push(row.data);
			if (row.continues) continue;
			Y.applyUpdate(document, joinPieces(pieces), roomOrigin);
			pieces = [];
		}
		document.on('update', (update: Uint8Array, origin: unknown) => this.changed(update, origin));
		this.document = document;
	}

	private storeChange(update: Uint8Array, visitor: Visitor | undefined): void {
		const at = Date.now();
		for (let start = 0; start < update.byteLength; start += pieceBytes) {
			const end = Math.min(start + pieceBytes, update.byteLength);
			this.sql.exec(
				'INSERT INTO changes (data, continues, at, person, name) VALUES (?, ?, ?, ?, ?)',
				update.slice(start, end),
				end < update.byteLength ? 1 : 0,
				at,
				visitor?.person ?? null,
				visitor?.name ?? null
			);
		}
	}

	/**
	 * Writes the whole document as the new snapshot and forgets the changes
	 * up to `upTo`, which the snapshot now holds. Later changes stay: they
	 * are in the snapshot too, and applying them again on load does nothing.
	 */
	private compact(upTo: number): void {
		const state = Y.encodeStateAsUpdate(this.document);
		this.context.storage.transactionSync(() => {
			this.sql.exec('DELETE FROM snapshot');
			for (let start = 0, piece = 0; start < state.byteLength; start += pieceBytes, piece += 1) {
				this.sql.exec('INSERT INTO snapshot (piece, data) VALUES (?, ?)', piece, state.slice(start, start + pieceBytes));
			}
			this.sql.exec('DELETE FROM changes WHERE id <= ?', upTo);
		});
	}

	private lastChangeIdentifier(): number {
		return this.sql.exec<{ id: number | null }>('SELECT max(id) AS id FROM changes').one().id ?? 0;
	}

	/** Whether people have changed the text since the room last saved a version. */
	unsaved(): boolean {
		return this.sql.exec('SELECT 1 FROM changes WHERE person IS NOT NULL LIMIT 1').toArray().length > 0;
	}

	// --- Connections ---------------------------------------------------------

	/** A connection from the website (src/lib/server/live-editing.ts), or a request to look for a newer saved version. */
	async fetch(request: WorkerRequest): Promise<WorkerResponse> {
		const url = new URL(request.url);
		if (url.pathname === '/refresh' && request.method === 'POST') {
			const essay = request.headers.get(visitorHeaders.essay) ?? '';
			if (this.fact('essay') === essay) await this.catchUp({ evenIfUnsaved: true });
			return new Response(null, { status: 204 }) as unknown as WorkerResponse;
		}
		if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
			return new Response('This address takes WebSocket connections only.', { status: 426 }) as unknown as WorkerResponse;
		}
		const visitor = visitorFromHeaders(request.headers);
		if (!visitor) return new Response('Missing or malformed visitor headers.', { status: 400 }) as unknown as WorkerResponse;

		const { WebSocketPair } = globalThis as unknown as { WebSocketPair: new () => Record<0 | 1, WorkerWebSocket> };
		const { 0: client, 1: server } = new WebSocketPair();
		this.context.acceptWebSocket(server);
		server.serializeAttachment(visitor);
		await this.join(server, visitor);
		return new Response(null, { status: 101, webSocket: client } as ResponseInit) as unknown as WorkerResponse;
	}

	/** Sets up the room if needed, then greets a new connection: the room's facts, the server's state vector, and who else is here. */
	async join(socket: WorkerWebSocket, visitor: Visitor): Promise<void> {
		const essay = this.fact('essay');
		if (essay && essay !== visitor.essay) {
			socket.close(closeCodes.badRequest, 'This room belongs to another essay.');
			return;
		}
		try {
			if (!essay) await this.start(visitor.essay);
			else await this.catchUp({ evenIfUnsaved: false });
		} catch (problem) {
			console.error('Could not open the live room', problem);
			socket.close(1011, 'The live room could not open the essay. Try again in a minute.');
			return;
		}
		if (!this.fact('essay')) {
			socket.close(closeCodes.noText, 'This essay has no saved version yet. Save it once, then try again.');
			return;
		}
		socket.send(this.factsMessage(visitor));
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageTypes.sync);
		encoding.writeVarUint(encoder, 0);
		encoding.writeVarUint8Array(encoder, Y.encodeStateVector(this.document));
		socket.send(encoding.toUint8Array(encoder));
		const present = this.presence();
		if (present.length > 0) socket.send(awarenessMessage(present));
	}

	async webSocketMessage(socket: WorkerWebSocket, message: ArrayBuffer | string): Promise<void> {
		if (typeof message === 'string') return;
		const visitor = socket.deserializeAttachment() as Visitor;
		if (Date.now() > visitor.sessionEnds) {
			socket.close(closeCodes.signedOut, 'Your session ended. Sign in again to keep editing.');
			return;
		}
		if (message.byteLength > largestMessageBytes) {
			socket.close(closeCodes.tooLarge, 'That change is too large to send in one piece.');
			return;
		}
		try {
			const decoder = decoding.createDecoder(new Uint8Array(message));
			switch (decoding.readVarUint(decoder)) {
				case messageTypes.sync:
					this.receiveSync(socket, visitor, decoder);
					break;
				case messageTypes.awareness:
					this.receiveAwareness(socket, visitor, decoding.readVarUint8Array(decoder));
					break;
				case messageTypes.queryAwareness:
					socket.send(awarenessMessage(this.presence()));
					break;
				default:
				// Authentication messages and anything else: the website has already checked who this is.
			}
		} catch (problem) {
			console.error('Could not read a live editing message', problem);
			socket.close(closeCodes.badRequest, 'The room could not read a message from this editor. Reload the page.');
		}
	}

	async webSocketClose(socket: WorkerWebSocket): Promise<void> {
		this.leave(socket);
	}

	async webSocketError(socket: WorkerWebSocket): Promise<void> {
		this.leave(socket);
	}

	private leave(socket: WorkerWebSocket): void {
		const visitor = socket.deserializeAttachment() as Visitor | null;
		const others = this.sockets().filter((other) => other !== socket);
		if (visitor) {
			const gone = Object.entries(visitor.clients).map(([client, entry]) => ({
				client: Number(client),
				clock: entry.clock + 1,
				state: null
			}));
			if (gone.length > 0) this.broadcast(awarenessMessage(gone), others);
		}
		if (others.length === 0 && this.unsaved()) {
			this.alarmSet = true;
			void this.context.storage.setAlarm(Date.now() + afterEveryoneLeaves);
		}
	}

	private sockets(): WorkerWebSocket[] {
		return this.context.getWebSockets();
	}

	private broadcast(message: Uint8Array, sockets = this.sockets()): void {
		for (const socket of sockets) {
			try {
				socket.send(message);
			} catch {
				// A socket that is closing; its close handler tidies up.
			}
		}
	}

	// --- Sync ----------------------------------------------------------------

	private receiveSync(socket: WorkerWebSocket, visitor: Visitor, decoder: decoding.Decoder): void {
		const kind = decoding.readVarUint(decoder);
		if (kind === 0) {
			// Step 1: the browser says what it has; answer with what it lacks.
			const stateVector = decoding.readVarUint8Array(decoder);
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, messageTypes.sync);
			encoding.writeVarUint(encoder, 1);
			encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(this.document, stateVector));
			socket.send(encoding.toUint8Array(encoder));
		} else if (kind === 1 || kind === 2) {
			// Step 2 or an update: changes from the browser. People with
			// comment access can read along but their changes are not kept.
			const update = decoding.readVarUint8Array(decoder);
			if (!canEdit(visitor)) return;
			Y.applyUpdate(this.document, update, { socket, visitor });
		}
	}

	/** Every change to the document, from a person or from the room: store it, pass it on, and plan a save. */
	private changed(update: Uint8Array, origin: unknown): void {
		const from = origin && typeof origin === 'object' && 'socket' in origin ? (origin as { socket: WorkerWebSocket; visitor: Visitor }) : undefined;
		this.storeChange(update, from?.visitor);
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageTypes.sync);
		encoding.writeVarUint(encoder, 2);
		encoding.writeVarUint8Array(encoder, update);
		this.broadcast(
			encoding.toUint8Array(encoder),
			this.sockets().filter((socket) => socket !== from?.socket)
		);
		if (from && !this.alarmSet) {
			this.alarmSet = true;
			void this.context.storage.setAlarm(Date.now() + quietBeforeSaving);
		}
	}

	// --- Awareness (names and cursors) -----------------------------------------

	private receiveAwareness(socket: WorkerWebSocket, visitor: Visitor, update: Uint8Array): void {
		const decoder = decoding.createDecoder(update);
		const count = decoding.readVarUint(decoder);
		const accepted: { client: number; clock: number; state: string | null }[] = [];
		const others = this.sockets().filter((other) => other !== socket);
		for (let index = 0; index < count; index += 1) {
			const client = decoding.readVarUint(decoder);
			const clock = decoding.readVarUint(decoder);
			const stateText = decoding.readVarString(decoder);
			// A client id belongs to the connection that first sent it,
			// except that the same person may take it over after a reconnect.
			const holder = others.find((other) => String(client) in ((other.deserializeAttachment() as Visitor | null)?.clients ?? {}));
			if (holder) {
				const held = holder.deserializeAttachment() as Visitor;
				if (held.person !== visitor.person) continue;
				delete held.clients[client];
				holder.serializeAttachment(held);
			}
			if (!(String(client) in visitor.clients) && Object.keys(visitor.clients).length >= mostClientsPerConnection) continue;
			const state = withRealName(stateText, visitor.name);
			if (state !== null && new TextEncoder().encode(state).byteLength > largestPresenceBytes) continue;
			visitor.clients[client] = { clock, state };
			accepted.push({ client, clock, state });
		}
		socket.serializeAttachment(visitor);
		// Sent back to the sender too: y-websocket reconnects when it hears
		// nothing for 30 seconds, and its own awareness renewals every 15
		// seconds are what keep a quiet connection talking.
		if (accepted.length > 0) this.broadcast(awarenessMessage(accepted));
	}

	private presence(): { client: number; clock: number; state: string | null }[] {
		const entries = [];
		for (const socket of this.sockets()) {
			const visitor = socket.deserializeAttachment() as Visitor | null;
			for (const [client, entry] of Object.entries(visitor?.clients ?? {})) {
				if (entry.state !== null) entries.push({ client: Number(client), clock: entry.clock, state: entry.state });
			}
		}
		return entries;
	}

	// --- Facts -----------------------------------------------------------------

	facts(visitor: Visitor): RoomFacts {
		return {
			seed: this.fact('seed') ?? '',
			version: Number(this.fact('version') ?? 0),
			savedAt: this.fact('savedAt') ?? null,
			savedBy: this.fact('savedBy') ?? null,
			canEdit: canEdit(visitor),
			unsaved: this.unsaved()
		};
	}

	private factsMessage(visitor: Visitor): Uint8Array {
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageTypes.room);
		encoding.writeVarString(encoder, JSON.stringify(this.facts(visitor)));
		return encoding.toUint8Array(encoder);
	}

	private broadcastFacts(): void {
		for (const socket of this.sockets()) {
			const visitor = socket.deserializeAttachment() as Visitor | null;
			if (!visitor) continue;
			try {
				socket.send(this.factsMessage(visitor));
			} catch {
				// Closing.
			}
		}
	}

	// --- Text ------------------------------------------------------------------

	/** The essay's text as the room holds it now, written the way the editor's Save writes it. */
	currentText(baseText: string): string {
		return textOf(this.document, baseText);
	}

	/**
	 * The room's text as each person left it, from the last snapshot through
	 * the changes up to `upTo`, for who typed which words (word-blame.ts,
	 * overlayOf). Undefined when people took turns too often to replay.
	 */
	private turns(upTo: number, baseText: string): { start: string; steps: { person: string | null; text: string }[] } | undefined {
		const document = new Y.Doc();
		const snapshot = this.sql.exec<{ data: ArrayBuffer }>('SELECT data FROM snapshot ORDER BY piece').toArray();
		if (snapshot.length > 0) Y.applyUpdate(document, joinPieces(snapshot.map((row) => row.data)), roomOrigin);
		const start = textOf(document, baseText);
		const steps: { person: string | null; text: string }[] = [];
		let person: string | null | undefined;
		let pieces: ArrayBuffer[] = [];
		for (const row of this.sql.exec<{ data: ArrayBuffer; continues: number; person: string | null }>(
			'SELECT data, continues, person FROM changes WHERE id <= ? ORDER BY id',
			upTo
		)) {
			pieces.push(row.data);
			if (row.continues) continue;
			if (person !== undefined && row.person !== person) {
				steps.push({ person, text: textOf(document, baseText) });
				if (steps.length > mostTurnsReplayed) {
					document.destroy();
					return undefined;
				}
			}
			person = row.person;
			Y.applyUpdate(document, joinPieces(pieces), roomOrigin);
			pieces = [];
		}
		if (person !== undefined) steps.push({ person, text: textOf(document, baseText) });
		document.destroy();
		return { start, steps };
	}

	private async baseText(): Promise<string> {
		const number = Number(this.fact('version') ?? 0);
		if (this.base?.number === number) return this.base.text;
		const essay = this.fact('essay') ?? '';
		const row = await version(this.environment.database, essay, number);
		if (!row) throw new Error(`Version ${number} of ${essay} is missing.`);
		const text = tidy(await readVersionText(this.environment.sourceDocuments, row));
		this.base = { number, text };
		return text;
	}

	/**
	 * Changes the room's text from `fromText` to `toText`, as a set of
	 * changes rather than a new document, so cursors stay put and nobody's
	 * editor starts over. If the room's text has moved on from `fromText`
	 * in the meantime, those later edits are kept where the paragraphs allow.
	 */
	private replaceText(fromText: string, toText: string, baseText: string): void {
		const current = this.currentText(baseText);
		let target = toText;
		if (current !== fromText) {
			const merged = mergeThreeWay(fromText, current, toText);
			if (merged.merged) target = tidy(merged.text);
		}
		if (target === current) return;
		const { frontMatter, body } = splitFrontMatter(target);
		this.document.transact(() => {
			updateYFragment(this.document, this.document.getXmlFragment(bodyFragment), parseEssay(body), {
				mapping: new Map(),
				isOMark: new Map()
			});
			const text = this.document.getText(frontMatterText);
			if (text.toString() !== frontMatter) {
				text.delete(0, text.length);
				text.insert(0, frontMatter);
			}
		}, roomOrigin);
	}

	/** Starts an empty room from the newest saved version of the essay. */
	private async start(essay: string): Promise<void> {
		this.preparing ??= (async () => {
			try {
				if (this.fact('essay')) return;
				const latest = await latestVersion(this.environment.database, essay);
				if (!latest) return;
				const text = tidy(await readVersionText(this.environment.sourceDocuments, latest));
				if (this.fact('essay')) return;
				const { frontMatter, body } = splitFrontMatter(text);
				this.document.transact(() => {
					prosemirrorToYXmlFragment(parseEssay(body), this.document.getXmlFragment(bodyFragment));
					this.document.getText(frontMatterText).insert(0, frontMatter);
				}, roomOrigin);
				this.compact(this.lastChangeIdentifier());
				this.setFacts({ essay, seed: crypto.randomUUID(), version: latest.number, savedAt: null, savedBy: null });
				this.base = { number: latest.number, text };
			} finally {
				this.preparing = undefined;
			}
		})();
		await this.preparing;
	}

	/**
	 * Looks for a version saved some other way since the room's base. With
	 * no unsaved changes in the room, the room takes that version's text;
	 * with unsaved changes, it saves now, which combines the two.
	 */
	async catchUp({ evenIfUnsaved }: { evenIfUnsaved: boolean }): Promise<void> {
		if (this.unsaved()) {
			if (evenIfUnsaved) await this.save();
			return;
		}
		this.preparing ??= (async () => {
			try {
				const essay = this.fact('essay') ?? '';
				const latest = await latestVersion(this.environment.database, essay);
				if (!latest || latest.number === Number(this.fact('version'))) return;
				await this.bringIn(latest);
			} finally {
				this.preparing = undefined;
			}
		})();
		await this.preparing;
	}

	private async bringIn(latest: VersionRow): Promise<void> {
		const baseText = await this.baseText();
		const theirs = tidy(await readVersionText(this.environment.sourceDocuments, latest));
		this.replaceText(baseText, theirs, baseText);
		this.setFacts({ version: latest.number });
		this.base = { number: latest.number, text: theirs };
		// The room's own changes are kept in the snapshot at once; changes
		// people made while the version was being read stay unsaved.
		if (!this.unsaved()) this.compact(this.lastChangeIdentifier());
		this.broadcastFacts();
	}

	// --- Saving ----------------------------------------------------------------

	async alarm(): Promise<void> {
		this.alarmSet = false;
		const span = this.sql
			.exec<{ first: number | null; last: number | null }>(
				'SELECT min(at) AS first, max(at) AS last FROM changes WHERE person IS NOT NULL'
			)
			.one();
		if (span.first === null || span.last === null) return;
		const now = Date.now();
		const due =
			this.sockets().length === 0 || now - span.last >= quietBeforeSaving - 1_000 || now - span.first >= longestUnsaved;
		if (!due) {
			this.setAlarm(Math.min(span.last + quietBeforeSaving, span.first + longestUnsaved));
			return;
		}
		try {
			await this.save();
		} catch (problem) {
			console.error('The live room could not save a version', problem);
			this.setAlarm(Date.now() + afterProblem);
			return;
		}
		if (this.unsaved()) this.setAlarm(Date.now() + quietBeforeSaving);
	}

	private setAlarm(at: number): void {
		this.alarmSet = true;
		void this.context.storage.setAlarm(at);
	}

	/** Saves the room's text as a new version, if people changed it. One save at a time. */
	async save(): Promise<void> {
		this.saving ??= this.saveNow().finally(() => {
			this.saving = undefined;
		});
		await this.saving;
	}

	private async saveNow(): Promise<void> {
		if (!this.unsaved()) return;
		const essay = this.fact('essay') ?? '';
		const baseText = await this.baseText();
		// Read the changes and the text together, with no waiting between,
		// so the save covers exactly the changes up to `upTo`.
		const upTo = this.lastChangeIdentifier();
		const ours = this.currentText(baseText);
		const editors = this.sql
			.exec<{ person: string; name: string }>(
				`SELECT person, name FROM changes WHERE person IS NOT NULL AND id <= ?
				 GROUP BY person ORDER BY max(id) DESC`,
				upTo
			)
			.toArray();
		const names = joinedNames(editors.map((editor) => editor.name));
		// With more than one person, who typed what, so each is credited for their own words.
		const turns = editors.length > 1 ? this.turns(upTo, baseText) : undefined;
		let note = `Edited live by ${names}`;
		let basedOn = Number(this.fact('version'));
		let ancestor = baseText;
		let text = ours;
		let saved: { version: VersionRow; unchanged: boolean } | undefined;
		for (let attempt = 0; !saved; attempt += 1) {
			try {
				saved = await saveVersion(this.environment.database, this.environment.sourceDocuments, {
					identifier: essay,
					text,
					basedOn,
					personIdentifier: editors[0]?.person ?? null,
					origin: 'editor',
					note
				});
			} catch (problem) {
				if (!(problem instanceof SaveConflict) || attempt >= 3) throw problem;
				// Someone saved a version another way since the room's base.
				const latest = await latestVersion(this.environment.database, essay);
				if (!latest) throw problem;
				const theirs = tidy(await readVersionText(this.environment.sourceDocuments, latest));
				const merged = mergeThreeWay(ancestor, text, theirs);
				note = merged.merged
					? `Edited live by ${names}, combined with version ${latest.number}`
					: `Edited live by ${names}, saved over version ${latest.number}, which changed the same paragraphs (version ${latest.number} is kept in the history)`;
				if (merged.merged) text = tidy(merged.text);
				basedOn = latest.number;
				ancestor = theirs;
			}
		}
		const savedText = tidy(text);
		if (turns && !saved.unchanged) {
			try {
				const overlay = compressOverlay(overlayOf(turns.start, turns.steps, savedText));
				await this.environment.sourceDocuments.put(overlayKey(essay, saved.version.number), JSON.stringify(overlay), {
					httpMetadata: { contentType: 'application/json' }
				});
			} catch (problem) {
				// The version is saved; its new words are credited to the person who saved last.
				console.error('Who typed what could not be kept', problem);
			}
		}
		if (savedText !== ours) this.replaceText(ours, savedText, baseText);
		this.base = { number: saved.version.number, text: savedText };
		this.setFacts(
			saved.unchanged
				? { version: saved.version.number }
				: { version: saved.version.number, savedAt: saved.version.created_at, savedBy: names }
		);
		// Changes people made while the version was being saved stay for the next save.
		this.compact(this.unsaved() ? upTo : this.lastChangeIdentifier());
		this.broadcastFacts();
	}
}

/** A sanitized awareness state: the person's name is the one the website knows, whatever the browser sent. */
function withRealName(stateText: string, name: string): string | null {
	let state: unknown;
	try {
		state = JSON.parse(stateText);
	} catch {
		return null;
	}
	if (state === null || typeof state !== 'object' || Array.isArray(state)) return null;
	const record = state as Record<string, unknown>;
	const user = record.user && typeof record.user === 'object' && !Array.isArray(record.user) ? record.user : {};
	return JSON.stringify({ ...record, user: { ...user, name } });
}

function awarenessMessage(entries: { client: number; clock: number; state: string | null }[]): Uint8Array {
	const update = encoding.createEncoder();
	encoding.writeVarUint(update, entries.length);
	for (const entry of entries) {
		encoding.writeVarUint(update, entry.client);
		encoding.writeVarUint(update, entry.clock);
		encoding.writeVarString(update, entry.state ?? 'null');
	}
	const encoder = encoding.createEncoder();
	encoding.writeVarUint(encoder, messageTypes.awareness);
	encoding.writeVarUint8Array(encoder, encoding.toUint8Array(update));
	return encoding.toUint8Array(encoder);
}

function joinPieces(pieces: ArrayBuffer[]): Uint8Array {
	if (pieces.length === 1) return new Uint8Array(pieces[0]);
	const total = pieces.reduce((sum, piece) => sum + piece.byteLength, 0);
	const joined = new Uint8Array(total);
	let offset = 0;
	for (const piece of pieces) {
		joined.set(new Uint8Array(piece), offset);
		offset += piece.byteLength;
	}
	return joined;
}
