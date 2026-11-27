/**
 * The one way the site and its Workers report a problem (site/ERRORS.md).
 * Each report is one log line in Cloudflare's Workers Logs, an object whose
 * fields can be filtered on there (code, reference, source, place), and,
 * when a database is at hand, one row per code and place in the `problems`
 * table, which the Service checks page reads.
 *
 * Nothing secret is logged: fields with secret-looking names are dropped,
 * and messages and stacks pass through withoutSecrets (src/lib/problems.ts).
 *
 * This file imports nothing from the Worker runtime, so every Worker can use
 * it with its own bindings. The site Worker calls it through
 * src/lib/server/report-here.ts, which supplies its own database and
 * keeps the database write going after the answer has gone.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { causeChain, codeOf, cut, isReference, isSecretField, messageOf, newReference, unexpectedCode, withoutSecrets } from '../problems.ts';

/** Where a report comes from: the site Worker, a reader's browser, or another Worker by its short name. */
export type ProblemSource = 'site' | 'browser' | 'wayback' | 'radar' | 'scanner' | 'live' | (string & {});

export interface ReportContext {
	/** The code to use when the error carries none of its own. */
	code?: string;
	/** Defaults to 'site'. */
	source?: ProblemSource;
	/** What was running: a route such as /nations/[id], or a handler such as scheduled:daily. */
	place?: string | null;
	/** The page or address being answered, without its query. */
	path?: string;
	method?: string;
	status?: number;
	/** A reference already shown to the reader, to keep instead of making a new one. */
	reference?: string;
	/** Anything else worth logging. Fields with secret-looking names are dropped. */
	details?: Record<string, unknown>;
	/** Where to count it. Without one the problem is only logged. */
	database?: D1Database;
	/** Keeps the database write going after the answer, such as ExecutionContext.waitUntil. Without one the write is not waited for. */
	keep?: (work: Promise<unknown>) => void;
	/** The time to record; defaults to now. */
	now?: Date;
}

export interface ProblemLogEntry {
	problem: string;
	reference: string;
	source: string;
	place: string;
	message: string;
	causes: string[];
	path?: string;
	method?: string;
	status?: number;
	stack?: string;
	details?: Record<string, unknown>;
}

export interface Reported {
	code: string;
	reference: string;
}

/** The longest message kept, and the longest stack logged. */
const messageLength = 500;
const stackLength = 2000;

/** The log line for a problem, with secrets taken out. Exported for tests. */
export function logEntry(problem: unknown, context: ReportContext = {}): ProblemLogEntry {
	const code = codeOf(problem, context.code ?? unexpectedCode);
	const causes = causeChain(problem).map((message) => cut(withoutSecrets(message), messageLength));
	const entry: ProblemLogEntry = {
		problem: code,
		reference: isReference(context.reference) ? context.reference : newReference(),
		source: context.source ?? 'site',
		place: context.place ?? context.path ?? 'unknown',
		message: causes[0] ?? cut(withoutSecrets(messageOf(problem)), messageLength),
		causes: causes.slice(1)
	};
	if (context.path) entry.path = withoutSecrets(context.path.split('?')[0] ?? context.path);
	if (context.method) entry.method = context.method;
	if (context.status) entry.status = context.status;
	if (problem instanceof Error && problem.stack) entry.stack = cut(withoutSecrets(problem.stack), stackLength);
	if (context.details) entry.details = safeDetails(context.details);
	return entry;
}

/** Details without secret-looking fields, and with their words checked, one level deep. */
function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
	const safe: Record<string, unknown> = {};
	for (const [name, value] of Object.entries(details)) {
		if (isSecretField(name)) continue;
		if (typeof value === 'string') safe[name] = cut(withoutSecrets(value), messageLength);
		else if (typeof value === 'number' || typeof value === 'boolean' || value === null) safe[name] = value;
		else if (value !== undefined) safe[name] = cut(withoutSecrets(safeJson(value)), messageLength);
	}
	return safe;
}

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		// expected: a value with a cycle is logged by its kind.
		return Object.prototype.toString.call(value);
	}
}

/**
 * Reports a problem: logs it, counts it when a database is given, and
 * returns its code and the reference a reader can be shown.
 */
export function report(problem: unknown, context: ReportContext = {}): Reported {
	const entry = logEntry(problem, context);
	console.error(entry);
	if (context.database) {
		const work = countProblem(context.database, entry, context.now ?? new Date()).catch((failure: unknown) => {
			// Counting must never hide the problem itself, which is already logged above.
			console.error({ ...logEntry(failure, { code: 'problems.count', source: entry.source, place: 'report' }), about: entry.reference });
		});
		if (context.keep) context.keep(work);
		else void work;
	}
	return { code: entry.problem, reference: entry.reference };
}

/** Adds one to a problem's row, keeping its latest reference, message and path. */
export async function countProblem(database: D1Database, entry: ProblemLogEntry, now: Date): Promise<void> {
	await database
		.prepare(
			`INSERT INTO problems (code, source, place, first_seen, last_seen, count, last_reference, last_message, last_path)
			VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
			ON CONFLICT (code, source, place) DO UPDATE SET
				last_seen = excluded.last_seen,
				count = problems.count + 1,
				last_reference = excluded.last_reference,
				last_message = excluded.last_message,
				last_path = excluded.last_path`
		)
		.bind(entry.problem, entry.source, cut(entry.place, 200), now.toISOString(), now.toISOString(), entry.reference, entry.message, entry.path ?? null)
		.run();
}

export interface ProblemRow {
	code: string;
	source: string;
	place: string;
	firstSeen: string;
	lastSeen: string;
	count: number;
	lastReference: string;
	lastMessage: string;
	lastPath: string | null;
}

/** The problems seen since a time, most recent first. */
export async function problemsSince(database: D1Database, since: Date, limit = 50): Promise<ProblemRow[]> {
	const { results } = await database
		.prepare(
			`SELECT code, source, place, first_seen, last_seen, count, last_reference, last_message, last_path
			FROM problems WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT ?`
		)
		.bind(since.toISOString(), limit)
		.all<{ code: string; source: string; place: string; first_seen: string; last_seen: string; count: number; last_reference: string; last_message: string; last_path: string | null }>();
	return results.map((row) => ({
		code: row.code,
		source: row.source,
		place: row.place,
		firstSeen: row.first_seen,
		lastSeen: row.last_seen,
		count: row.count,
		lastReference: row.last_reference,
		lastMessage: row.last_message,
		lastPath: row.last_path
	}));
}
