/**
 * Joining an essay's live editing room from the browser.
 *
 * ```ts
 * const room = joinEssayRoom('i-legal-history-timeline', { basedOn: 12, user: { name, color } });
 * const stop = room.subscribe((status) => { ... });   // a Svelte store, too: $room
 * await room.whenSynced;                               // the room's text is in room.document
 * // Create the editor only now, with ySyncPlugin(room.fragment), yCursorPlugin(room.awareness)
 * // and yUndoPlugin() from y-prosemirror, and make it read-only unless status.canEdit.
 * room.onSaved(({ version, savedBy }) => { ... });     // the room saved a version
 * room.destroy();                                      // when the editor closes
 * ```
 *
 * The room (src/lib/server/live/essay-room.ts) starts from the newest saved
 * version and saves versions by itself after each pause, so an editor in a
 * room does not save through /save: the room's versions replace automatic
 * saves. The body is a Y.XmlFragment for y-prosemirror with the schema in
 * document.ts; the front matter is a Y.Text without the --- lines.
 *
 * Never put text into the room's document before `whenSynced`: the room's
 * copy is the starting point, and anything added before it arrives would
 * be added to it, not replace it.
 */
import * as decoding from 'lib0/decoding';
import type { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { bodyFragment, frontMatterText, messageTypes, type RoomFacts } from './live-protocol.ts';

export type LiveStatus =
	/** Opening the connection, or waiting for the room's text. */
	| { state: 'connecting' }
	/** In the room with its text. */
	| {
			state: 'live';
			/** Whether this person's changes are kept (contribute or full access); otherwise show the text read-only. */
			canEdit: boolean;
			/** The newest saved version the room's text builds on. */
			version: number;
			/** Whether `version` is newer than the `basedOn` the editor opened with. */
			newerThanYours: boolean;
			/** Whether the room holds changes it has not saved as a version yet. */
			unsaved: boolean;
	  }
	/** The connection dropped; y-websocket is trying again. Changes made meanwhile are sent when it is back. */
	| { state: 'offline' }
	/** The room refused or ended the connection for good, with a sentence to show the person. */
	| { state: 'refused'; code: number; reason: string };

export interface SavedVersion {
	version: number;
	/** Who edited the saved text, as names, or null when the version came from elsewhere (git, a restore). */
	savedBy: string | null;
	savedAt: string | null;
}

export interface EssayRoom {
	readonly document: Y.Doc;
	/** The name of the body's Y.XmlFragment in `document`. */
	readonly fragmentName: typeof bodyFragment;
	readonly fragment: Y.XmlFragment;
	readonly frontMatter: Y.Text;
	/** Names and cursors, for yCursorPlugin. The room replaces each person's name with the one the website knows. */
	readonly awareness: Awareness;
	readonly status: LiveStatus;
	/** Resolves once the room's text has arrived; rejects if the room refuses the connection first. */
	readonly whenSynced: Promise<void>;
	/** Calls `listener` now and on every change of status (the Svelte store contract). */
	subscribe(listener: (status: LiveStatus) => void): () => void;
	/** Calls `listener` each time the room's version changes after joining. */
	onSaved(listener: (saved: SavedVersion) => void): () => void;
	/** Leaves the room and stops trying to reconnect. */
	destroy(): void;
}

export interface JoinOptions {
	/** The version the editor opened with, to tell whether the room is newer. */
	basedOn?: number | null;
	/** Shown to others on this person's cursor until the room puts the website's name on it. */
	user?: { name: string; tone?: string; color?: string };
	/** The site's origin; defaults to the page's. */
	origin?: string;
}

export function joinEssayRoom(identifier: string, options: JoinOptions = {}): EssayRoom {
	const origin = new URL(options.origin ?? globalThis.location.origin);
	const serverUrl = `${origin.protocol === 'https:' ? 'wss' : 'ws'}://${origin.host}/workspace/essays/${encodeURIComponent(identifier)}`;
	const document = new Y.Doc();
	// Tabs of one browser share changes directly too (BroadcastChannel), so
	// two editors of one essay in one browser stay in step even offline.
	const provider = new WebsocketProvider(serverUrl, 'live', document, { maxBackoffTime: 10_000 });
	if (options.user) provider.awareness.setLocalStateField('user', options.user);

	let status: LiveStatus = { state: 'connecting' };
	let facts: RoomFacts | undefined;
	let firstSeed: string | undefined;
	let everLive = false;
	const listeners = new Set<(status: LiveStatus) => void>();
	const savedListeners = new Set<(saved: SavedVersion) => void>();

	let settle: { resolve: () => void; reject: (problem: Error) => void };
	const whenSynced = new Promise<void>((resolve, reject) => {
		settle = { resolve, reject };
	});
	// Callers that never await it should not see an unhandled rejection.
	whenSynced.catch(() => undefined);

	function setStatus(next: LiveStatus) {
		status = next;
		for (const listener of listeners) listener(status);
	}

	function update() {
		if (status.state === 'refused') return;
		// Before the first sync the room is still opening; after it, any
		// gap is a lost connection that y-websocket is mending.
		if (!provider.synced || !facts) setStatus({ state: everLive ? 'offline' : 'connecting' });
		else {
			everLive = true;
			setStatus({
				state: 'live',
				canEdit: facts.canEdit,
				version: facts.version,
				newerThanYours: options.basedOn != null && facts.version > options.basedOn,
				unsaved: facts.unsaved
			});
			settle.resolve();
		}
	}

	function refuse(code: number, reason: string) {
		setStatus({ state: 'refused', code, reason });
		settle.reject(new Error(reason));
	}

	// The room's own message: facts about the room, on joining and after each save.
	provider.messageHandlers[messageTypes.room] = (_encoder, decoder) => {
		const next = JSON.parse(decoding.readVarString(decoder)) as RoomFacts;
		firstSeed ??= next.seed;
		if (next.seed !== firstSeed) {
			// The room's copy started over: sending this document's changes
			// would double the text. Stop before answering the room.
			provider.disconnect();
			refuse(0, 'The live room started over. Reload the editor to continue.');
			return;
		}
		const before = facts;
		facts = next;
		if (before && before.version !== next.version) {
			for (const listener of savedListeners) listener({ version: next.version, savedBy: next.savedBy, savedAt: next.savedAt });
		}
		update();
	};

	provider.on('status', update);
	provider.on('sync', update);
	provider.on('closed', ({ code, reason }) => refuse(code, reason || 'The live room closed the connection.'));

	return {
		document,
		fragmentName: bodyFragment,
		fragment: document.getXmlFragment(bodyFragment),
		frontMatter: document.getText(frontMatterText),
		awareness: provider.awareness,
		get status() {
			return status;
		},
		whenSynced,
		subscribe(listener) {
			listeners.add(listener);
			listener(status);
			return () => listeners.delete(listener);
		},
		onSaved(listener) {
			savedListeners.add(listener);
			return () => savedListeners.delete(listener);
		},
		destroy() {
			listeners.clear();
			savedListeners.clear();
			provider.destroy();
			document.destroy();
		}
	};
}
