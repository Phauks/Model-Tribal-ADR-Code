/**
 * The website's side of live editing: checks who is opening a live
 * connection to an essay, then hands the connection to that essay's room
 * (the EssayRoom Durable Object in the tribal-law-project-live Worker,
 * src/lib/server/live/essay-room.ts) with the person's name and level.
 *
 * The browser connects to /workspace/essays/<id>/live with a WebSocket
 * (src/lib/essays/live.ts). hooks.server.ts sends that request here before
 * SvelteKit routes it, because a WebSocket answer cannot take the headers
 * SvelteKit and the hook add to other responses.
 */
import { inactivityHours } from './accounts.ts';
import { workerEnvironment } from './environment.ts';
import { isEssayIdentifier } from './essays.ts';
import { levelOn } from './essay-workspace.ts';
import { visitorHeaders } from './live/essay-room.ts';
import { closeCodes } from '../essays/live-protocol.ts';
import { atLeast } from '../permissions.ts';

const livePath = /^\/workspace\/essays\/([^/]+)\/live$/;

/** Whether a request is a browser opening a live editing connection. */
export function isLiveEditingRequest(request: Request, url: URL): boolean {
	return livePath.test(url.pathname) && request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}

/** The room for one essay: one Durable Object per essay, found by name. */
function room(identifier: string) {
	const rooms = workerEnvironment().essayRooms;
	return rooms?.getByName(`essay:${identifier}`);
}

/**
 * Answers a live editing connection: hands it to the essay's room, or opens
 * and at once closes it with a reason the editor can show. A refusal is
 * sent as a closed WebSocket, not an error page, because browsers do not
 * let a page read why a WebSocket handshake failed.
 */
export async function openLiveEditing(event: {
	request: Request;
	url: URL;
	locals: App.Locals;
}): Promise<Response> {
	const identifier = livePath.exec(event.url.pathname)?.[1] ?? '';
	// Browsers always send Origin with a WebSocket, and a page on another
	// site may open one; the session cookie (SameSite=Lax) is not sent from
	// there, but this check does not rely on that.
	if (event.request.headers.get('origin') !== event.url.origin) {
		return refuse(closeCodes.noAccess, 'Live editing opens only from this site’s own pages.');
	}
	if (!isEssayIdentifier(identifier)) return refuse(closeCodes.badRequest, 'No essay has this address.');
	const person = event.locals.person;
	const session = event.locals.session;
	if (!person || !session) return refuse(closeCodes.signedOut, 'Sign in again to edit live.');
	const { database } = workerEnvironment();
	const level = await levelOn(database, person, identifier);
	if (!atLeast(level, 'comment')) {
		return refuse(closeCodes.noAccess, 'You do not have access to this essay.');
	}
	const stub = room(identifier);
	// 4503: y-websocket tries again later (only 4400 to 4499 stop it).
	if (!stub) return refuse(4503, 'Live editing is not available here yet.');

	// The room closes the connection when the session would end: at its
	// expiry, or after the hours without use that end any session (a live
	// connection does not count as use, so people sign in again as usual).
	const sessionEnds = Math.min(Date.parse(session.expiresAt), Date.now() + inactivityHours * 60 * 60 * 1000);
	const headers = new Headers({
		upgrade: 'websocket',
		[visitorHeaders.essay]: identifier,
		[visitorHeaders.person]: person.identifier,
		[visitorHeaders.name]: encodeURIComponent(person.displayName),
		[visitorHeaders.level]: level === 'full' ? 'full' : level === 'contribute' ? 'contribute' : 'comment',
		[visitorHeaders.sessionEnds]: String(sessionEnds)
	});
	try {
		return (await stub.fetch('https://essay-room/connect', { headers })) as unknown as Response;
	} catch (problem) {
		console.error('Could not reach the live editing room', problem);
		return refuse(4503, 'The live editing room did not answer. Trying again.');
	}
}

/**
 * Asks an essay's room to look for a version saved another way (a restore,
 * the git text), so people editing live see it without waiting for the
 * room's next save. Does nothing if live editing is not set up.
 */
export async function notifyLiveRoom(identifier: string): Promise<void> {
	const stub = room(identifier);
	if (!stub) return;
	try {
		await stub.fetch('https://essay-room/refresh', {
			method: 'POST',
			headers: { [visitorHeaders.essay]: identifier }
		});
	} catch (problem) {
		console.error('Could not tell the live editing room about a new version', problem);
	}
}

function refuse(code: number, reason: string): Response {
	const { WebSocketPair } = globalThis as unknown as {
		WebSocketPair: new () => Record<0 | 1, WebSocket & { accept(): void }>;
	};
	const { 0: client, 1: server } = new WebSocketPair();
	server.accept();
	server.close(code, reason);
	return new Response(null, { status: 101, webSocket: client } as ResponseInit);
}
