/**
 * Reports what a Worker's handlers throw and records when each last ran
 * (site/ERRORS.md, "Worker runs"). The live, scanner, Wayback and source
 * watch Workers wrap their default export in reported(), and their Durable
 * Objects' alarms in runReported(), so every Worker reports the way the site
 * does (src/lib/server/report.ts) and the Service checks page can say when
 * each scheduled run and alarm last ran and last failed.
 *
 * Each scheduled run and alarm writes one row in the worker_runs table when
 * it ends, whether it finished or failed. A fetch handler writes only its
 * failures, since a row for every request would cost a database write each
 * time. A run that dies without ending, such as one stopped at its time
 * limit, writes nothing, so a run that is late shows on the page as late.
 *
 * Nothing here changes what a handler does: a scheduled run or alarm that
 * throws still throws, after it is reported and recorded, so the dashboard's
 * cron events and the platform's alarm retries see it as before. A fetch
 * handler that throws answers 500 with the reference instead of Cloudflare's
 * error page.
 *
 * This file imports nothing from the Worker runtime, so every Worker can use
 * it with its own bindings.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { cut, isMissingTable, messageOf, withoutSecrets } from '../problems.ts';
import { report, type ProblemSource } from './report.ts';

/** The bindings reported() reads: the site's database, where the Worker has one. */
export interface RunEnvironment {
	database?: D1Database;
}

interface Keeper {
	waitUntil(work: Promise<unknown>): void;
}

interface ScheduledEvent {
	cron: string;
	scheduledTime: number;
}

/** A Worker's handlers, as reported() takes and returns them. */
export interface WorkerHandlers<Environment, Context extends Keeper, Controller extends ScheduledEvent> {
	fetch?(request: Request, environment: Environment, context: Context): Response | Promise<Response>;
	scheduled?(controller: Controller, environment: Environment, context: Context): void | Promise<void>;
}

export interface ReportedOptions<Controller extends ScheduledEvent> {
	/** Names a scheduled run for its cron trigger, for a Worker with more than one, such as scheduled:rebuild. Defaults to scheduled. */
	scheduledHandler?: (controller: Controller) => string;
}

/** Where a run happens: the Worker's short name, the handler, and the database to record it in. */
export interface RunPlace {
	source: ProblemSource;
	/** Such as scheduled, scheduled:rebuild, alarm:ScanDesk or fetch. */
	handler: string;
	/** The code to report a failure under when the error carries none; defaults to <source>.<kind of handler>, such as scanner.alarm. */
	code?: string;
	database?: D1Database;
}

export type RunOutcome = 'finished' | 'failed';

export interface RunRecord {
	started: Date;
	milliseconds: number;
	outcome: RunOutcome;
	failure?: { code: string; reference: string; message: string };
}

const messageLength = 500;

function defaultCode(place: RunPlace): string {
	return place.code ?? `${place.source}.${place.handler.split(':')[0]}`;
}

/** Tables already found missing in this copy of the Worker, so the warning is logged once, not every minute. */
let warnedMissingTable = false;

/** Writes a run's row. Its own failure is reported, and never hides the run's. */
export async function recordRun(database: D1Database | undefined, place: RunPlace, run: RunRecord): Promise<void> {
	if (!database) return;
	try {
		await database
			.prepare(
				`INSERT INTO worker_runs (worker, handler, last_started, last_milliseconds, last_outcome, runs, failures, last_failed, last_failure_code, last_failure_reference, last_failure_message)
				VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
				ON CONFLICT (worker, handler) DO UPDATE SET
					last_started = excluded.last_started,
					last_milliseconds = excluded.last_milliseconds,
					last_outcome = excluded.last_outcome,
					runs = worker_runs.runs + 1,
					failures = worker_runs.failures + excluded.failures,
					last_failed = coalesce(excluded.last_failed, worker_runs.last_failed),
					last_failure_code = coalesce(excluded.last_failure_code, worker_runs.last_failure_code),
					last_failure_reference = coalesce(excluded.last_failure_reference, worker_runs.last_failure_reference),
					last_failure_message = coalesce(excluded.last_failure_message, worker_runs.last_failure_message)`
			)
			.bind(
				place.source,
				place.handler,
				run.started.toISOString(),
				Math.round(run.milliseconds),
				run.outcome,
				run.outcome === 'failed' ? 1 : 0,
				run.failure ? run.started.toISOString() : null,
				run.failure?.code ?? null,
				run.failure?.reference ?? null,
				run.failure ? cut(run.failure.message, messageLength) : null
			)
			.run();
	} catch (problem) {
		if (isMissingTable(problem)) {
			if (!warnedMissingTable) console.warn({ problem: 'worker-runs.missing', source: place.source, message: 'The worker_runs table is missing; apply migration 20261127T1000_add_worker_runs.' });
			warnedMissingTable = true;
			return;
		}
		report(problem, { code: 'worker-runs.record', source: place.source, place: place.handler });
	}
}

/**
 * Runs a scheduled run or an alarm: reports what it throws, records the run,
 * and returns or throws what the work did. The writes are waited for, so they
 * finish before a Durable Object can be put to sleep.
 */
export async function runReported<Value>(place: RunPlace, work: () => Value | Promise<Value>): Promise<Value> {
	const started = new Date();
	const clock = Date.now();
	try {
		const value = await work();
		await recordRun(place.database, place, { started, milliseconds: Date.now() - clock, outcome: 'finished' });
		return value;
	} catch (problem) {
		const kept: Promise<unknown>[] = [];
		const { code, reference } = report(problem, { code: defaultCode(place), source: place.source, place: place.handler, database: place.database, keep: (write) => kept.push(write) });
		await Promise.all([
			...kept,
			recordRun(place.database, place, { started, milliseconds: Date.now() - clock, outcome: 'failed', failure: { code, reference, message: withoutSecrets(messageOf(problem)) } })
		]);
		throw problem;
	}
}

/**
 * Wraps a Worker's default export. Its scheduled runs are reported and
 * recorded (runReported); a fetch that throws is reported, recorded as a
 * failure, and answered with 500 and the reference.
 */
export function reported<Environment extends RunEnvironment, Context extends Keeper, Controller extends ScheduledEvent>(
	source: ProblemSource,
	handlers: WorkerHandlers<Environment, Context, Controller>,
	options: ReportedOptions<Controller> = {}
): WorkerHandlers<Environment, Context, Controller> {
	const wrapped: WorkerHandlers<Environment, Context, Controller> = {};
	const { fetch: answer, scheduled: run } = handlers;
	if (answer) {
		wrapped.fetch = async (request, environment, context) => {
			const started = new Date();
			try {
				return await answer.call(handlers, request, environment, context);
			} catch (problem) {
				const place: RunPlace = { source, handler: 'fetch', database: environment.database };
				const { code, reference } = report(problem, {
					code: defaultCode(place),
					source,
					place: 'fetch',
					path: new URL(request.url).pathname,
					method: request.method,
					status: 500,
					database: environment.database,
					keep: (write) => context.waitUntil(write)
				});
				context.waitUntil(recordRun(environment.database, place, { started, milliseconds: Date.now() - started.getTime(), outcome: 'failed', failure: { code, reference, message: withoutSecrets(messageOf(problem)) } }));
				return new Response(`Something went wrong. Reference ${reference}.`, {
					status: 500,
					headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
				});
			}
		};
	}
	if (run) {
		wrapped.scheduled = (controller, environment, context) =>
			runReported({ source, handler: options.scheduledHandler?.(controller) ?? 'scheduled', database: environment.database }, () => run.call(handlers, controller, environment, context));
	}
	return wrapped;
}

/* Reading the runs, for the Service checks page --------------------------- */

export interface WorkerRunRow {
	worker: string;
	handler: string;
	lastStarted: string;
	lastMilliseconds: number | null;
	lastOutcome: RunOutcome;
	runs: number;
	failures: number;
	lastFailed: string | null;
	lastFailureCode: string | null;
	lastFailureReference: string | null;
	lastFailureMessage: string | null;
}

export async function workerRuns(database: D1Database): Promise<WorkerRunRow[]> {
	const { results } = await database
		.prepare(
			`SELECT worker, handler, last_started, last_milliseconds, last_outcome, runs, failures, last_failed, last_failure_code, last_failure_reference, last_failure_message
			FROM worker_runs ORDER BY worker, handler`
		)
		.all<{
			worker: string;
			handler: string;
			last_started: string;
			last_milliseconds: number | null;
			last_outcome: RunOutcome;
			runs: number;
			failures: number;
			last_failed: string | null;
			last_failure_code: string | null;
			last_failure_reference: string | null;
			last_failure_message: string | null;
		}>();
	return results.map((row) => ({
		worker: row.worker,
		handler: row.handler,
		lastStarted: row.last_started,
		lastMilliseconds: row.last_milliseconds,
		lastOutcome: row.last_outcome,
		runs: row.runs,
		failures: row.failures,
		lastFailed: row.last_failed,
		lastFailureCode: row.last_failure_code,
		lastFailureReference: row.last_failure_reference,
		lastFailureMessage: row.last_failure_message
	}));
}

/** Each Worker's name in the Cloudflare dashboard, by its short name (docs/cloudflare-names.md). */
export const workerNames: Record<string, string> = {
	live: 'tribal-law-project-live',
	scanner: 'tribal-law-project-scanner',
	wayback: 'tribal-law-project-wayback',
	radar: 'tribal-law-project-radar'
};

/** A scheduled run the Service checks page expects, and how late it may be before the page says so. */
export interface ExpectedRun {
	worker: keyof typeof workerNames & string;
	handler: string;
	/** The cron trigger in that Worker's wrangler.jsonc; tests/reported.test.ts checks they agree. */
	cron: string;
	/** When it runs, in words. */
	when: string;
	lateAfterMinutes: number;
}

export const expectedRuns: readonly ExpectedRun[] = [
	{ worker: 'scanner', handler: 'scheduled:wake', cron: '* * * * *', when: 'every minute', lateAfterMinutes: 10 },
	{ worker: 'scanner', handler: 'scheduled:rebuild', cron: '23 6 * * *', when: 'every day at 06:23 UTC', lateAfterMinutes: 26 * 60 },
	{ worker: 'wayback', handler: 'scheduled', cron: '* * * * *', when: 'every minute', lateAfterMinutes: 10 },
	{ worker: 'radar', handler: 'scheduled', cron: '* * * * *', when: 'every minute', lateAfterMinutes: 10 }
];
