/**
 * The host's desk (docs/source-watch.md, "Politeness"): one Durable Object
 * per host that every watcher's request to that host goes through. It keeps
 * the host's robots.txt (read once a day), spaces requests, counts them by
 * day, and backs off when the host asks it to. This file is the desk's
 * thinking, kept apart from the Durable Object (site/watch/host-desk.ts) so
 * it can be tested without one.
 *
 * Spacing between two requests to one host is the longest of: the host's
 * robots.txt Crawl-delay; what the watcher asks for (an API's published
 * limit); and a default of 5 seconds for government hosts and 30 seconds
 * for any other, since a nation's own site is often small and hosted cheaply.
 * On 429 or 503 the desk waits as long as Retry-After says, or backs off from
 * 1 minute, doubling, to at most 6 hours.
 */
import { allowEverything, crawlDelaySeconds, mayFetch, modelMayRead, type Robots } from './robots.ts';

export const governmentSpacingSeconds = 5;
export const otherSpacingSeconds = 30;
export const robotsLifetimeMilliseconds = 24 * 3_600_000;
const firstBackoffMilliseconds = 60_000;
const longestBackoffMilliseconds = 6 * 3_600_000;

export interface DeskState {
	host: string;
	robots: Robots;
	robotsReadAt: number | null;
	/** The earliest time the next request may go. */
	nextFreeAt: number;
	/** No request before this, after the host asked the desk to wait. */
	backoffUntil: number;
	backoffLevel: number;
	/** Requests per UTC day, for the progress page. */
	day: string;
	dayCount: number;
	lastStatus: number | null;
}

export function newDeskState(host: string): DeskState {
	return { host, robots: allowEverything, robotsReadAt: null, nextFreeAt: 0, backoffUntil: 0, backoffLevel: 0, day: '', dayCount: 0, lastStatus: null };
}

/** Government hosts get the shorter default spacing. */
export function isGovernmentHost(host: string): boolean {
	return /\.(gov|mil)$/i.test(host) || /(^|\.)(congress|uscourts|supremecourt)\.gov$/i.test(host);
}

export function defaultSpacingSeconds(host: string): number {
	return isGovernmentHost(host) ? governmentSpacingSeconds : otherSpacingSeconds;
}

export function robotsAreStale(state: DeskState, now: number): boolean {
	return state.robotsReadAt === null || now - state.robotsReadAt > robotsLifetimeMilliseconds;
}

export interface TicketRequest {
	/** The path and query to fetch, for the robots.txt check. */
	path: string;
	/** The least spacing the watcher wants for this host, such as an API's limit. */
	spacingSeconds?: number;
	/** The longest the caller can wait now; past this it gets a time to come back instead. */
	longestWaitMilliseconds: number;
}

export type Ticket =
	/** Go after this long; the slot is held. */
	| { go: true; waitMilliseconds: number; modelMayRead: boolean }
	/** Not now: come back at this time. Nothing is held. */
	| { go: false; retryAt: number; reason: string }
	/** Never: robots.txt says no. */
	| { go: false; refused: string };

/** Asks for a slot to fetch a path. Holds the slot when it is close enough, so requests from two watchers never bunch up. */
export function takeTicket(state: DeskState, request: TicketRequest, now: number): Ticket {
	if (!mayFetch(state.robots, request.path)) {
		return { go: false, refused: state.robots.unreachable ? `${state.host}/robots.txt could not be read, so the site is treated as off-limits until it answers` : `${state.host}/robots.txt does not allow ${request.path}` };
	}
	if (state.backoffUntil > now && state.backoffUntil - now > request.longestWaitMilliseconds) {
		return { go: false, retryAt: state.backoffUntil, reason: `${state.host} asked us to wait` };
	}
	const spacing = Math.max(crawlDelaySeconds(state.robots) ?? 0, request.spacingSeconds ?? 0, defaultSpacingSeconds(state.host)) * 1000;
	const slot = Math.max(now, state.nextFreeAt, state.backoffUntil);
	if (slot - now > request.longestWaitMilliseconds) return { go: false, retryAt: slot, reason: `${state.host} is busy with other requests` };
	state.nextFreeAt = slot + spacing;
	const day = new Date(slot).toISOString().slice(0, 10);
	if (state.day !== day) {
		state.day = day;
		state.dayCount = 0;
	}
	state.dayCount += 1;
	return { go: true, waitMilliseconds: slot - now, modelMayRead: modelMayRead(state.robots, request.path) };
}

/** Reads a Retry-After header: seconds, or an HTTP date. */
export function retryAfterMilliseconds(header: string | null, now: number): number | null {
	if (!header) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
	const date = Date.parse(header);
	return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** Records how the host answered, backing off on 429 and 503. */
export function reportAnswer(state: DeskState, status: number, retryAfter: string | null, now: number): void {
	state.lastStatus = status;
	if (status === 429 || status === 503) {
		const asked = retryAfterMilliseconds(retryAfter, now);
		const backoff = Math.min(longestBackoffMilliseconds, asked ?? firstBackoffMilliseconds * 2 ** state.backoffLevel);
		state.backoffUntil = Math.max(state.backoffUntil, now + backoff);
		state.backoffLevel = Math.min(state.backoffLevel + 1, 12);
	} else if (status < 500) {
		state.backoffLevel = 0;
	}
}
