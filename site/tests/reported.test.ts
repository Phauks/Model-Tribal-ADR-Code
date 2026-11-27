import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Problem } from '../src/lib/problems.ts';
import { problemsSince } from '../src/lib/server/report.ts';
import { expectedRuns, reported, runReported, workerNames, workerRuns } from '../src/lib/server/reported.ts';
import { runServiceChecks } from '../src/lib/server/service-checks.ts';
import { testDatabase } from './database.ts';

afterEach(() => vi.restoreAllMocks());

/** A context whose waitUntil work the test can wait for. */
function keeper() {
	const kept: Promise<unknown>[] = [];
	return { context: { waitUntil: (work: Promise<unknown>) => void kept.push(work) }, settled: () => Promise.all(kept) };
}

describe('reported Worker handlers', () => {
	it('records a scheduled run that finishes', async () => {
		const database = testDatabase();
		const { context } = keeper();
		const worker = reported('wayback', { scheduled: async () => undefined });
		await worker.scheduled!({ cron: '* * * * *', scheduledTime: 0 }, { database }, context);
		const [row] = await workerRuns(database);
		expect(row).toMatchObject({ worker: 'wayback', handler: 'scheduled', lastOutcome: 'finished', runs: 1, failures: 0, lastFailed: null });
	});

	it('reports and records a run that throws, throws it again, and keeps the last failure after a run that finishes', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const database = testDatabase();
		const { context } = keeper();
		let fail = true;
		const worker = reported(
			'scanner',
			{
				scheduled: async () => {
					if (fail) throw new Problem('scanner.rebuild', 'The rebuild hook answered with status 500.');
				}
			},
			{ scheduledHandler: (controller) => (controller.cron === '23 6 * * *' ? 'scheduled:rebuild' : 'scheduled:wake') }
		);
		await expect(worker.scheduled!({ cron: '23 6 * * *', scheduledTime: 0 }, { database }, context)).rejects.toThrow('status 500');
		const entry = logged.mock.calls[0]?.[0] as { problem: string; source: string; place: string; reference: string };
		expect(entry).toMatchObject({ problem: 'scanner.rebuild', source: 'scanner', place: 'scheduled:rebuild' });
		fail = false;
		await worker.scheduled!({ cron: '23 6 * * *', scheduledTime: 0 }, { database }, context);
		const [row] = await workerRuns(database);
		expect(row).toMatchObject({
			worker: 'scanner',
			handler: 'scheduled:rebuild',
			lastOutcome: 'finished',
			runs: 2,
			failures: 1,
			lastFailureCode: 'scanner.rebuild',
			lastFailureReference: entry.reference,
			lastFailureMessage: 'The rebuild hook answered with status 500.'
		});
		const [counted] = await problemsSince(database, new Date(0));
		expect(counted).toMatchObject({ code: 'scanner.rebuild', source: 'scanner', place: 'scheduled:rebuild', count: 1 });
	});

	it('answers a fetch that throws with 500 and the reference, and records only the failure', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const database = testDatabase();
		const { context, settled } = keeper();
		let fail = false;
		const worker = reported('radar', {
			fetch: async () => {
				if (fail) throw new Error('The bucket did not answer');
				return new Response('ok');
			}
		});
		expect((await worker.fetch!(new Request('https://radar.example/status.json?key=secret'), { database }, context)).status).toBe(200);
		await settled();
		expect(await workerRuns(database)).toEqual([]);
		fail = true;
		const answer = await worker.fetch!(new Request('https://radar.example/status.json?key=secret'), { database }, context);
		await settled();
		expect(answer.status).toBe(500);
		const entry = logged.mock.calls[0]?.[0] as { problem: string; reference: string; path: string };
		expect(entry).toMatchObject({ problem: 'radar.fetch', path: '/status.json' });
		expect(await answer.text()).toBe(`Something went wrong. Reference ${entry.reference}.`);
		const [row] = await workerRuns(database);
		expect(row).toMatchObject({ worker: 'radar', handler: 'fetch', lastOutcome: 'failed', failures: 1, lastFailureReference: entry.reference });
	});

	it('records an alarm, and works without a database', async () => {
		const database = testDatabase();
		expect(await runReported({ source: 'live', handler: 'alarm:EssayRoom', database }, () => 7)).toBe(7);
		expect(await runReported({ source: 'live', handler: 'alarm:EssayRoom' }, () => 8)).toBe(8);
		const [row] = await workerRuns(database);
		expect(row).toMatchObject({ worker: 'live', handler: 'alarm:EssayRoom', runs: 1 });
	});

	it('warns once, and goes on, when the table is missing', async () => {
		const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const missing = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1_ERROR: no such table: worker_runs'); } }) }) } as never;
		await runReported({ source: 'wayback', handler: 'scheduled', database: missing }, () => undefined);
		await runReported({ source: 'wayback', handler: 'scheduled', database: missing }, () => undefined);
		expect(warned).toHaveBeenCalledTimes(1);
	});
});

describe('expected runs', () => {
	it('match each Worker’s cron triggers and dashboard name', () => {
		const folders: Record<string, string> = { live: 'live', scanner: 'scanner', wayback: 'wayback', radar: 'watch' };
		for (const [worker, folder] of Object.entries(folders)) {
			const source = readFileSync(path.resolve(import.meta.dirname, `../${folder}/wrangler.jsonc`), 'utf8');
			expect(source, worker).toContain(`"name": "${workerNames[worker]}"`);
			const crons = [...(source.match(/"crons":\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((match) => match[1]);
			expect(crons.sort(), worker).toEqual(expectedRuns.filter((run) => run.worker === worker).map((run) => run.cron).sort());
		}
	});

	it('give every Worker with a scheduled run or alarm the database to record it in', () => {
		for (const folder of ['live', 'scanner', 'wayback', 'watch']) {
			const source = readFileSync(path.resolve(import.meta.dirname, `../${folder}/wrangler.jsonc`), 'utf8');
			expect(source, folder).toMatch(/"binding":\s*"database"/);
		}
	});
});

describe('the Scheduled runs and alarms service check', () => {
	const now = new Date('2026-11-27T10:00:00Z');
	const run = async (database: ReturnType<typeof testDatabase>) =>
		(await runServiceChecks({ environment: { database } as unknown as WorkerEnvironment, fetcher: fetch, migrationFiles: [], now }, 'worker-runs'))[0]!;

	async function record(database: ReturnType<typeof testDatabase>, worker: string, handler: string, started: string, outcome: 'finished' | 'failed' = 'finished') {
		await database
			.prepare(
				`INSERT INTO worker_runs (worker, handler, last_started, last_milliseconds, last_outcome, runs, failures, last_failed, last_failure_code, last_failure_reference, last_failure_message)
				VALUES (?, ?, ?, 1200, ?, 10, ?, ?, ?, ?, ?)`
			)
			.bind(worker, handler, started, outcome, outcome === 'failed' ? 1 : 0, outcome === 'failed' ? started : null, outcome === 'failed' ? 'wayback.keys' : null, outcome === 'failed' ? 'P-4F7K-92QD' : null, outcome === 'failed' ? 'Save Page Now refused the archive.org keys' : null)
			.run();
	}

	it('says a run that has never been recorded is late', async () => {
		const result = await run(testDatabase());
		expect(result.state).toBe('problem');
		expect(result.summary).toBe(`Of ${expectedRuns.length} scheduled runs, ${expectedRuns.length} late or never recorded.`);
		expect(result.details[0]).toBe('tribal-law-project-scanner scheduled wake (every minute): has not recorded a run yet.');
	});

	it('is working when every run is on time, and says which failed last time', async () => {
		const database = testDatabase();
		await record(database, 'scanner', 'scheduled:wake', '2026-11-27T09:59:00.000Z');
		await record(database, 'scanner', 'scheduled:rebuild', '2026-11-27T06:23:00.000Z');
		await record(database, 'wayback', 'scheduled', '2026-11-27T09:59:00.000Z');
		await record(database, 'radar', 'scheduled', '2026-11-27T09:59:00.000Z');
		const working = await run(database);
		expect(working.state).toBe('working');
		expect(working.details).toContain('tribal-law-project-wayback scheduled run (every minute): last ran 2026-11-27 09:59 UTC, finished in 1.2 s. Never failed. 0 of 10 runs failed.');

		await record(database, 'scanner', 'alarm:ScanDesk', '2026-11-27T09:30:00.000Z', 'failed');
		const alarm = await run(database);
		expect(alarm.state).toBe('warning');
		expect(alarm.summary).toBe('Every scheduled run is on time, but these failed in the last day: tribal-law-project-scanner ScanDesk alarm.');

		await database.prepare(`DELETE FROM worker_runs WHERE worker = 'wayback'`).run();
		await record(database, 'wayback', 'scheduled', '2026-11-27T09:59:00.000Z', 'failed');
		const failed = await run(database);
		expect(failed.state).toBe('problem');
		expect(failed.summary).toBe(`Of ${expectedRuns.length} scheduled runs, 1 failed last time.`);
		expect(failed.details).toContain(
			'tribal-law-project-wayback scheduled run (every minute): last ran 2026-11-27 09:59 UTC, failed in 1.2 s. Last failed 2026-11-27 09:59 UTC (wayback.keys, P-4F7K-92QD): Save Page Now refused the archive.org keys. 1 of 10 runs failed.'
		);
	});
});
