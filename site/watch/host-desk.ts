/**
 * The host desk as a Durable Object (docs/source-watch.md, "Politeness"). The
 * Worker keeps one per host, named by the host, and every request a watcher
 * makes to that host asks it for a slot first (src/lib/server/watch/polite-fetch.ts).
 * Its thinking is in src/lib/server/watch/host-desk.ts; this file keeps the
 * state and reads the host's robots.txt once a day.
 *
 * A robots.txt that cannot be read (a 5xx, a 429 or no answer) makes the
 * whole host off-limits (RFC 9309, section 2.3.1.4); the desk tries it again
 * after an hour and, until then, tells callers to come back rather than
 * refusing them for good.
 */
import type { DurableObjectStorage } from '@cloudflare/workers-types/index.ts';
import { DurableObject } from 'cloudflare:workers';
import { newDeskState, reportAnswer, robotsAreStale, takeTicket, type DeskState, type Ticket, type TicketRequest } from '../src/lib/server/watch/host-desk.ts';
import { watchUserAgent } from '../src/lib/server/watch/polite-fetch.ts';
import { robotsFromAnswer } from '../src/lib/server/watch/robots.ts';

const stateKey = 'state';
/** A robots.txt that could not be read is tried again after this long. */
export const unreachableRobotsRetryMilliseconds = 3_600_000;
/** robots.txt files past this size are cut (RFC 9309 asks crawlers to read at least 500 kibibytes). */
const robotsSizeLimit = 512 * 1024;

/** The desk's state as the progress page shows it. */
export interface DeskSummary {
	host: string;
	robotsReadAt: string | null;
	robotsUnreachable: boolean;
	backoffUntil: string | null;
	requestsToday: number;
	lastStatus: number | null;
}

export class HostDesk extends DurableObject {
	private state: DeskState | null = null;

	/** The desk's own Durable Object storage (not a bucket), typed so the scan guard can tell. */
	private get storage(): DurableObjectStorage {
		return this.ctx.storage as unknown as DurableObjectStorage;
	}

	private async load(host: string): Promise<DeskState> {
		if (!this.state) this.state = (await this.storage.get<DeskState>(stateKey)) ?? newDeskState(host);
		return this.state;
	}

	private async save(state: DeskState): Promise<void> {
		await this.storage.put(stateKey, state);
	}

	/** Reads robots.txt when it is a day old, or an hour after it could not be read. Other callers wait meanwhile. */
	private async freshRobots(state: DeskState, now: number): Promise<void> {
		const unreachableAndDue = state.robots.unreachable === true && state.robotsReadAt !== null && now - state.robotsReadAt > unreachableRobotsRetryMilliseconds;
		if (!robotsAreStale(state, now) && !unreachableAndDue) return;
		await this.ctx.blockConcurrencyWhile(async () => {
			let status: number | null = null;
			let text = '';
			try {
				const response = await fetch(`https://${state.host}/robots.txt`, { headers: { 'user-agent': watchUserAgent, accept: 'text/plain, */*' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
				status = response.status;
				if (response.ok) text = (await response.text()).slice(0, robotsSizeLimit);
				else await response.body?.cancel();
			} catch {
				status = null;
			}
			state.robots = robotsFromAnswer(status, text);
			state.robotsReadAt = Date.now();
			// Reading robots.txt is a request too.
			state.nextFreeAt = Math.max(state.nextFreeAt, Date.now() + 1000);
			await this.save(state);
		});
	}

	async ticket(host: string, request: TicketRequest): Promise<Ticket> {
		const state = await this.load(host);
		await this.freshRobots(state, Date.now());
		if (state.robots.unreachable) {
			return { go: false, retryAt: (state.robotsReadAt ?? Date.now()) + unreachableRobotsRetryMilliseconds, reason: `${host}/robots.txt could not be read; trying again later` };
		}
		const ticket = takeTicket(state, request, Date.now());
		if (ticket.go) await this.save(state);
		return ticket;
	}

	async report(host: string, status: number, retryAfter: string | null): Promise<void> {
		const state = await this.load(host);
		reportAnswer(state, status, retryAfter, Date.now());
		await this.save(state);
	}

	async summary(host: string): Promise<DeskSummary> {
		const state = await this.load(host);
		const today = new Date().toISOString().slice(0, 10);
		return {
			host: state.host,
			robotsReadAt: state.robotsReadAt ? new Date(state.robotsReadAt).toISOString() : null,
			robotsUnreachable: state.robots.unreachable === true,
			backoffUntil: state.backoffUntil > Date.now() ? new Date(state.backoffUntil).toISOString() : null,
			requestsToday: state.day === today ? state.dayCount : 0,
			lastStatus: state.lastStatus
		};
	}
}
