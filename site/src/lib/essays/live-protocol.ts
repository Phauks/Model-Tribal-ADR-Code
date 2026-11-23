/**
 * What the browser and the live editing room agree on: the names of the
 * shared parts of an essay, the message types on the connection, and the
 * close codes the room uses when it refuses or ends a connection.
 *
 * The connection speaks the y-websocket protocol (sync, awareness and
 * query-awareness messages, in the y-protocols encoding), plus one message
 * type of the project's own that carries facts about the room as JSON.
 * The room is the EssayRoom Durable Object (src/lib/server/live/essay-room.ts),
 * which runs in its own Worker (live/wrangler.jsonc); the browser side is
 * src/lib/essays/live.ts.
 */

/** The Y.XmlFragment that holds the essay's body, edited with y-prosemirror. */
export const bodyFragment = 'body';

/** The Y.Text that holds the essay's front matter (the YAML between the --- lines), without the --- lines. */
export const frontMatterText = 'frontMatter';

/** Message types: the first number of every message on the connection. */
export const messageTypes = {
	sync: 0,
	awareness: 1,
	authentication: 2,
	queryAwareness: 3,
	/** The project's own: a RoomFacts object as JSON. */
	room: 100
} as const;

/** Facts about the room, sent when someone joins and after every saved version. */
export interface RoomFacts {
	/**
	 * Names this room's copy of the essay. It changes only if the room's
	 * stored copy is started again from scratch; a browser holding text from
	 * a different copy must not send it, or the essay would be doubled.
	 */
	seed: string;
	/** The newest saved version the room's text builds on. */
	version: number;
	/** When the room last saved a version, or null if it has not saved one. */
	savedAt: string | null;
	/** Who edited the text the room last saved, as names, or null. */
	savedBy: string | null;
	/** Whether this connection's changes are accepted (contribute or full access). */
	canEdit: boolean;
	/** Whether the room holds changes not yet saved as a version. */
	unsaved: boolean;
}

/**
 * Close codes. Codes 4400 to 4499 tell y-websocket not to try again
 * (node_modules/y-websocket/src/y-websocket.js, defaultShouldReconnect), so
 * every refusal uses one, with a sentence for the person as the reason.
 */
export const closeCodes = {
	badRequest: 4400,
	signedOut: 4401,
	noAccess: 4403,
	noText: 4404,
	tooLarge: 4413
} as const;

/** The largest message the room accepts, in bytes: more than any essay (largestEssayBytes) needs. */
export const largestMessageBytes = 8 * 1024 * 1024;
