/**
 * Reports a problem from the site Worker (src/lib/server/report.ts) with the
 * site's own database, keeping the count going after the answer has gone.
 * Only code that runs in the Worker may call it; while the site is built
 * there is no database, and the problem is only logged.
 */
import { env, waitUntil } from 'cloudflare:workers';
import { report, type ReportContext, type Reported } from './report.ts';

export function reportHere(problem: unknown, context: Omit<ReportContext, 'database' | 'keep'> = {}): Reported {
	const database = (env as Partial<WorkerEnvironment> | undefined)?.database;
	return report(problem, { ...context, database, keep: database ? waitUntil : undefined });
}
