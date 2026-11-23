/**
 * The scan desk: the one Durable Object in the scanner Worker
 * (site/scanner/worker.ts) that works through the file_scans table
 * (migrations/0021_file_scans.sql). It takes the files that are waiting, one
 * at a time, reads each from the bucket, hands it to the provider
 * (providers.ts), and writes the verdict (verdict.ts) back.
 *
 * Its alarm does the work, because an alarm may run for up to 15 minutes and
 * is retried if it fails (Cloudflare, "Durable Objects: Alarms"), while a
 * request's leftover work is cut off 30 seconds after the response. The
 * Worker's cron wakes the desk every minute; the desk then sets its alarm
 * for the first file due.
 *
 * A file is never marked clean unless the provider scanned the whole object
 * and found nothing. Every other path, including every error, leaves the file
 * held: waiting, retrying, failed, cannot-scan or flagged.
 */
import type { D1Database, R2Bucket, R2ObjectBody } from '@cloudflare/workers-types/index.ts';
import type { FileScan } from '../file-scans.ts';
import { ScanFaultError, type ScanProvider } from './scan-port.ts';
import { TooLargeForProviderError } from './providers.ts';
import { computeVerdict, projectScanPolicy, type ScanPolicy } from './verdict.ts';

/** After this many tries without an answer a file is marked failed, for a person to look at. */
export const maximumAttempts = 8;

/** Minutes to wait after each failed try: about a day in all before giving up. */
const retryMinutes = [1, 5, 15, 60, 180, 360, 720];

/** A file left "scanning" this long was dropped by a desk that stopped; it is taken up again. */
const abandonedAfterMs = 30 * 60 * 1000;

/** The largest file sent to the scanner unless SCAN_SIZE_LIMIT_MB says otherwise: 2 GiB, what the engine's ClamAV is set to take. */
export const defaultSizeLimitBytes = 2048 * 1024 * 1024;

export interface DeskSetup {
	database: D1Database;
	bucket: R2Bucket;
	provider: ScanProvider;
	sizeLimitBytes: number;
	policy?: ScanPolicy;
	now?: () => Date;
}

export interface DeskRound {
	/** Files finished this round, with any result. */
	finished: number;
	/** Files still waiting when the round stopped for time. */
	moreWaiting: boolean;
	/** When the next file is due to be tried again, if any. */
	nextTryAt: string | null;
}

/** Minutes to wait before the next try after this many attempts. */
export function retryDelayMinutes(attempts: number): number {
	return retryMinutes[Math.min(Math.max(attempts, 1), retryMinutes.length) - 1];
}

/** The next file to scan, oldest first, or null. */
async function nextDue(database: D1Database, now: Date): Promise<Pick<FileScan, 'objectKey' | 'attempts'> & { status: string } | null> {
	const nowText = now.toISOString();
	const abandoned = new Date(now.getTime() - abandonedAfterMs).toISOString();
	const row = await database
		.prepare(
			`SELECT object_key, attempts, status FROM file_scans
			 WHERE status = 'waiting'
				OR (status = 'retrying' AND (next_try_at IS NULL OR next_try_at <= ?))
				OR (status = 'scanning' AND started_at <= ?)
			 ORDER BY requested_at, object_key
			 LIMIT 1`
		)
		.bind(nowText, abandoned)
		.first<{ object_key: string; attempts: number; status: string }>();
	return row ? { objectKey: row.object_key, attempts: row.attempts, status: row.status } : null;
}

type Outcome =
	| { status: 'clean'; activeContent: boolean }
	| { status: 'flagged' | 'cannot-scan'; reason: string }
	| { status: 'retry'; reason: string };

/**
 * Scans one file and records the result. Takes the row only if it is still
 * in the state it was found in, so two desks (there is only one, but a
 * deploy can overlap) never scan the same file at once.
 */
async function scanOne(setup: DeskSetup, due: { objectKey: string; attempts: number; status: string }): Promise<boolean> {
	const { database, bucket, provider } = setup;
	const now = setup.now ?? (() => new Date());
	const attempts = due.attempts + 1;
	const taken = await database
		.prepare(
			`UPDATE file_scans SET status = 'scanning', started_at = ?, attempts = ?, provider = ?
			 WHERE object_key = ? AND status = ? AND attempts = ?`
		)
		.bind(now().toISOString(), attempts, provider.name, due.objectKey, due.status, due.attempts)
		.run();
	if (taken.meta.changes === 0) return false;

	let object: R2ObjectBody | null = null;
	let outcome: Outcome;
	let engineVersion: string | null = null;
	try {
		object = await bucket.get(due.objectKey);
		if (!object) outcome = { status: 'cannot-scan', reason: 'missing' };
		else if (object.size > setup.sizeLimitBytes) {
			await object.body.cancel();
			outcome = { status: 'cannot-scan', reason: 'too-large' };
		} else {
			const raw = await provider.scan(object.body as unknown as ReadableStream<Uint8Array>, {
				sizeBytes: object.size,
				mediaType: object.httpMetadata?.contentType ?? null
			});
			engineVersion = raw.engineVersion;
			const verdict = computeVerdict(raw, setup.policy ?? projectScanPolicy);
			if (verdict.verdict === 'clean') outcome = { status: 'clean', activeContent: verdict.activeContent };
			else if (verdict.verdict === 'flagged') outcome = { status: 'flagged', reason: verdict.reason };
			else if (verdict.reason === 'no-engine') outcome = { status: 'retry', reason: 'no-engine' };
			else outcome = { status: 'cannot-scan', reason: verdict.reason };
		}
	} catch (problem) {
		if (problem instanceof TooLargeForProviderError) outcome = { status: 'cannot-scan', reason: 'too-large' };
		else {
			const message = problem instanceof Error ? problem.message : String(problem);
			outcome = { status: 'retry', reason: (problem instanceof ScanFaultError ? message : `Unexpected: ${message}`).slice(0, 500) };
		}
	}

	const finishedAt = now();
	const etag = object?.etag ?? null;
	const size = object?.size ?? null;
	if (outcome.status === 'retry') {
		const giveUp = attempts >= maximumAttempts;
		const next = new Date(finishedAt.getTime() + retryDelayMinutes(attempts) * 60_000).toISOString();
		await database
			.prepare(
				`UPDATE file_scans SET status = ?, reason = ?, next_try_at = ?, finished_at = ?, object_etag = ?, size_bytes = ?, engine_version = ?
				 WHERE object_key = ? AND status = 'scanning' AND attempts = ?`
			)
			.bind(giveUp ? 'failed' : 'retrying', outcome.reason, giveUp ? null : next, giveUp ? finishedAt.toISOString() : null, etag, size, engineVersion, due.objectKey, attempts)
			.run();
	} else {
		await database
			.prepare(
				`UPDATE file_scans SET status = ?, reason = ?, active_content = ?, next_try_at = NULL, finished_at = ?, object_etag = ?, size_bytes = ?, engine_version = ?
				 WHERE object_key = ? AND status = 'scanning' AND attempts = ?`
			)
			.bind(
				outcome.status,
				outcome.status === 'clean' ? null : outcome.reason,
				outcome.status === 'clean' && outcome.activeContent ? 1 : 0,
				finishedAt.toISOString(),
				etag,
				size,
				engineVersion,
				due.objectKey,
				attempts
			)
			.run();
	}
	return true;
}

/**
 * Scans waiting files until none is due or the deadline passes. With the
 * "off" provider nothing is taken: files stay waiting, held, until a
 * provider is set.
 */
export async function runScans(setup: DeskSetup, deadline: number): Promise<DeskRound> {
	const now = setup.now ?? (() => new Date());
	let finished = 0;
	if (setup.provider.name !== 'off') {
		while (now().getTime() < deadline) {
			const due = await nextDue(setup.database, now());
			if (!due) break;
			if (await scanOne(setup, due)) finished += 1;
		}
	}
	const moreWaiting = setup.provider.name !== 'off' && (await nextDue(setup.database, now())) !== null;
	const next = await setup.database
		.prepare(`SELECT MIN(next_try_at) AS next FROM file_scans WHERE status = 'retrying'`)
		.first<{ next: string | null }>();
	return { finished, moreWaiting, nextTryAt: next?.next ?? null };
}

/** How long one alarm works before handing over to the next: well inside the 15-minute alarm limit. */
export const roundMs = 11 * 60 * 1000;

/** The parts of the Durable Object state the desk uses. */
export interface DeskState {
	storage: {
		getAlarm(): Promise<number | null>;
		setAlarm(scheduledTime: number): Promise<void>;
	};
}

/**
 * The Durable Object. Kept free of Cloudflare-only imports, like the live
 * editing room, so it runs in the site's tests; site/scanner/worker.ts
 * exports it to the runtime.
 */
export class DeskObject {
	constructor(
		private readonly state: DeskState,
		private readonly setup: () => DeskSetup
	) {}

	/** Any request wakes the desk: it sets its alarm for now, unless one is due sooner. */
	async fetch(): Promise<Response> {
		await this.wake(Date.now());
		return new Response('Scanning will start shortly.', { status: 202 });
	}

	private async wake(at: number): Promise<void> {
		const current = await this.state.storage.getAlarm();
		if (current === null || current > at) await this.state.storage.setAlarm(at);
	}

	async alarm(): Promise<void> {
		let round: DeskRound;
		try {
			const setup = this.setup();
			const started = (setup.now ?? (() => new Date()))().getTime();
			round = await runScans(setup, started + roundMs);
		} catch (problem) {
			// The database or bucket did not answer. Try again in a minute rather
			// than lean on the platform's own alarm retries, which stop after six.
			console.error('Scan desk round failed', problem);
			await this.state.storage.setAlarm(Date.now() + 60_000);
			return;
		}
		if (round.moreWaiting) await this.state.storage.setAlarm(Date.now() + 1000);
		else if (round.nextTryAt) await this.state.storage.setAlarm(Math.max(Date.parse(round.nextTryAt), Date.now() + 1000));
	}
}
