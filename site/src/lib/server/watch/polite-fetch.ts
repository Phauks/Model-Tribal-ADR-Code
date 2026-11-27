/**
 * Every request a watcher makes goes through here (docs/source-watch.md,
 * "Politeness, terms and cost of fetching"): it asks the host's desk for a
 * slot (robots.txt, spacing, back-off), waits for it, sends the request with
 * the project's honest name and any conditional headers, and tells the desk
 * how the host answered.
 */
import type { Ticket, TicketRequest } from './host-desk.ts';

/** How the watcher names itself to every host, with a page explaining it. */
export const watchUserAgent = 'TribalLawProjectWatch/1.0 (+https://triballawproject.org/about/watch)';
/** Each request gives up after this long, so one slow host cannot hold up a run. */
export const requestTimeoutMilliseconds = 30_000;
/** The longest a run waits for a slot before it stops and leaves the rest for later. */
export const longestWaitMilliseconds = 45_000;

/** The host desks, as the Worker reaches them (site/watch/host-desk.ts). */
export interface Desks {
	ticket(host: string, request: TicketRequest): Promise<Ticket>;
	report(host: string, status: number, retryAfter: string | null): Promise<void>;
}

/** The host turned the request away for now; try again at `retryAt`. */
export class ComeBackLater extends Error {
	constructor(
		readonly host: string,
		readonly retryAt: number,
		reason: string
	) {
		super(reason);
		this.name = 'ComeBackLater';
	}
}

/** robots.txt does not allow the request. */
export class NotAllowed extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = 'NotAllowed';
	}
}

export interface PoliteAnswer {
	response: Response;
	/** False when the host's robots.txt or content signals say no model may read its text. */
	modelMayRead: boolean;
}

export interface PoliteFetchOptions {
	accept?: string;
	conditional?: { entityTag?: string | null; lastModified?: string | null };
	/** The least spacing for this host, such as an API's published limit. */
	spacingSeconds?: number;
}

export function hostOf(address: string): string {
	return new URL(address).hostname.toLowerCase();
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function politeFetch(desks: Desks, address: string, options: PoliteFetchOptions = {}, fetcher: typeof fetch = fetch): Promise<PoliteAnswer> {
	const parsed = new URL(address);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new NotAllowed(`Only web addresses are fetched, not ${parsed.protocol}`);
	const host = parsed.hostname.toLowerCase();
	const ticket = await desks.ticket(host, { path: `${parsed.pathname}${parsed.search}`, spacingSeconds: options.spacingSeconds, longestWaitMilliseconds });
	if (!ticket.go) {
		if ('refused' in ticket) throw new NotAllowed(ticket.refused);
		throw new ComeBackLater(host, ticket.retryAt, ticket.reason);
	}
	if (ticket.waitMilliseconds > 0) await sleep(ticket.waitMilliseconds);
	const headers = new Headers({ 'user-agent': watchUserAgent, accept: options.accept ?? '*/*' });
	if (options.conditional?.entityTag) headers.set('if-none-match', options.conditional.entityTag);
	if (options.conditional?.lastModified) headers.set('if-modified-since', options.conditional.lastModified);
	let response: Response;
	try {
		response = await fetcher(address, { headers, redirect: 'follow', signal: AbortSignal.timeout(requestTimeoutMilliseconds) });
	} catch (problem) {
		await desks.report(host, 599, null);
		throw problem;
	}
	await desks.report(host, response.status, response.headers.get('retry-after'));
	if (response.status === 429 || response.status === 503) {
		await response.body?.cancel();
		throw new ComeBackLater(host, Date.now() + 60_000, `${host} answered ${response.status}`);
	}
	return { response, modelMayRead: ticket.modelMayRead };
}
