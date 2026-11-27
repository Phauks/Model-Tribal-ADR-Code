import { afterEach, describe, expect, it, vi } from 'vitest';
import { causeChain, codeOf, isMissingTable, isReference, messageOf, newReference, Problem, problemOf, withoutSecrets } from '../src/lib/problems.ts';
import { countProblem, logEntry, problemsSince, report } from '../src/lib/server/report.ts';
import { browserProblem, isBrowserNoise, isNetworkFailure, sendProblem } from '../src/lib/problem-reports.ts';
import { runServiceChecks } from '../src/lib/server/service-checks.ts';
import { catchesIn } from '../tools/check-silent-catches.mjs';
import { testDatabase } from './database.ts';

afterEach(() => vi.restoreAllMocks());

describe('the shared error type', () => {
	it('keeps a code, words for the reader and the cause', () => {
		const cause = new Error('D1_ERROR: too many SQL variables');
		const problem = new Problem('search.fill', 'The search tables could not be filled', { cause, reader: 'Search is slow right now.' });
		expect(problem.code).toBe('search.fill');
		expect(problem.reader).toBe('Search is slow right now.');
		expect(causeChain(problem)).toEqual(['The search tables could not be filled', 'D1_ERROR: too many SQL variables']);
	});

	it('turns a code it cannot use into unexpected', () => {
		expect(new Problem('Not A Code!', 'x').code).toBe('unexpected');
	});

	it('reads anything thrown', () => {
		expect(messageOf(new Error('broke'))).toBe('broke');
		expect(messageOf(new TypeError(''))).toBe('TypeError');
		expect(messageOf('plain words')).toBe('plain words');
		expect(messageOf({ message: 'from an object' })).toBe('from an object');
		expect(codeOf(new Problem('map.style', 'x'))).toBe('map.style');
		expect(codeOf(new Error('x'), 'map.tiles')).toBe('map.tiles');
		expect(problemOf('words', 'map.tiles').code).toBe('map.tiles');
	});

	it('spots a missing table anywhere in the chain', () => {
		expect(isMissingTable(new Error('outer', { cause: new Error('D1_ERROR: no such table: problems') }))).toBe(true);
		expect(isMissingTable(new Error('D1_ERROR: database is locked'))).toBe(false);
	});

	it('makes references a reader can read out', () => {
		const reference = newReference();
		expect(isReference(reference)).toBe(true);
		expect(reference).toMatch(/^P-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
		expect(reference).not.toMatch(/[ILOU]/);
	});
});

describe('taking secrets out of what is logged', () => {
	it('drops queries, emails, tokens and secret-looking pairs', () => {
		const text = withoutSecrets(
			'GET https://triballawproject.org/sign-in/link?code=123456&email=a@b.org failed for person@example.org with Bearer abc.def.ghi; password=hunter2 api_key=XYZ key 9f8e7d6c5b4a39281706f5e4d3c2b1a0aa'
		);
		expect(text).toContain('https://triballawproject.org/sign-in/link?…');
		expect(text).not.toContain('123456');
		expect(text).not.toContain('person@example.org');
		expect(text).toContain('[email]');
		expect(text).toContain('Bearer [secret]');
		expect(text).toContain('password=[secret]');
		expect(text).toContain('api_key=[secret]');
		expect(text).not.toContain('9f8e7d6c5b4a39281706f5e4d3c2b1a0aa');
	});

	it('keeps ordinary words, paths and slugs', () => {
		const text = 'Could not read nations/nigc-declination-letter-karuk-tribe-of-california-2016-11-10 at /nations/karuk-tribe (status=500)';
		expect(withoutSecrets(text)).toBe(text);
	});

	it('leaves secret-looking fields out of the details', () => {
		const entry = logEntry(new Error('x'), { details: { token: 'abc', SESSION_COOKIE: 'def', nation: 'karuk-tribe', count: 3 } });
		expect(entry.details).toEqual({ nation: 'karuk-tribe', count: 3 });
	});
});

describe('reporting a problem', () => {
	it('logs one line with the code, reference, place and causes', () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const cause = new Error('D1_ERROR: too big');
		const { code, reference } = report(new Error('Filling failed', { cause }), { code: 'search.fill', place: '/search/query', path: '/search/query?q=navajo' });
		expect(code).toBe('search.fill');
		expect(isReference(reference)).toBe(true);
		const [entry] = logged.mock.calls[0] as [Record<string, unknown>];
		expect(entry).toMatchObject({ problem: 'search.fill', reference, source: 'site', place: '/search/query', path: '/search/query', message: 'Filling failed', causes: ['D1_ERROR: too big'] });
	});

	it('keeps a reference already shown to the reader', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(report(new Error('x'), { reference: 'P-4F7K-92QD' }).reference).toBe('P-4F7K-92QD');
	});

	it('counts each code, source and place in the problems table', async () => {
		const database = testDatabase();
		const first = logEntry(new Problem('map.style', 'A color is missing'), { source: 'browser', place: '/nations/map' });
		const second = logEntry(new Problem('map.style', 'A color is still missing'), { source: 'browser', place: '/nations/map' });
		await countProblem(database, first, new Date('2026-11-27T08:00:00Z'));
		await countProblem(database, second, new Date('2026-11-27T09:00:00Z'));
		const rows = await problemsSince(database, new Date('2026-11-27T00:00:00Z'));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ code: 'map.style', source: 'browser', place: '/nations/map', count: 2, firstSeen: '2026-11-27T08:00:00.000Z', lastReference: second.reference, lastMessage: 'A color is still missing' });
	});

	it('waits for the count with keep, and logs a count that fails without hiding the problem', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kept: Promise<unknown>[] = [];
		const broken = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 is down'); } }) }) } as never;
		report(new Error('the real problem'), { database: broken, keep: (work) => kept.push(work) });
		await Promise.all(kept);
		expect(logged).toHaveBeenCalledTimes(2);
		expect((logged.mock.calls[0]?.[0] as { message: string }).message).toBe('the real problem');
		expect((logged.mock.calls[1]?.[0] as { problem: string }).problem).toBe('problems.count');
	});
});

describe('problems in the browser', () => {
	it('sends the code, reference and path without the query', () => {
		const body = browserProblem(new Error('boom at https://triballawproject.org/x?token=abc'), { path: '/nations/map?view=lands', reference: 'P-4F7K-92QD' });
		expect(body).toMatchObject({ code: 'browser.unexpected', reference: 'P-4F7K-92QD', path: '/nations/map', message: 'boom at https://triballawproject.org/x?…' });
	});

	it('ignores noise from the browser itself', () => {
		expect(isBrowserNoise('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
		expect(isBrowserNoise('Script error.')).toBe(true);
		expect(isBrowserNoise('x is not a function')).toBe(false);
	});

	it('only notes a request the network dropped, and sends the rest', () => {
		expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
		expect(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
		expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true);
		expect(isNetworkFailure(new SyntaxError('Unexpected token < in JSON at position 0'))).toBe(false);
		expect(isNetworkFailure(new TypeError('list.nations is undefined'))).toBe(false);

		const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const beacon = vi.fn(() => true);
		vi.stubGlobal('navigator', { onLine: true, sendBeacon: beacon });
		try {
			expect(sendProblem(new TypeError('Failed to fetch'), { code: 'nations.names', path: '/uploads/send' })).toMatch(/^P-/);
			expect(warned).toHaveBeenCalledTimes(1);
			expect(beacon).not.toHaveBeenCalled();
			sendProblem(new SyntaxError('Unexpected token < in JSON at position 0'), { code: 'nations.names', path: '/uploads/send' });
			expect(logged).toHaveBeenCalledTimes(1);
			expect(beacon).toHaveBeenCalledTimes(1);
			sendProblem(new DOMException('The operation was aborted.', 'AbortError'), { code: 'search.query', path: '/search' });
			expect(warned).toHaveBeenCalledTimes(1);
			expect(logged).toHaveBeenCalledTimes(1);
			expect(beacon).toHaveBeenCalledTimes(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('the Problems service check', () => {
	it('says nothing has gone wrong, then lists what has', async () => {
		const database = testDatabase();
		const environment = { database } as unknown as WorkerEnvironment;
		const now = new Date('2026-11-27T10:00:00Z');
		const run = async () => (await runServiceChecks({ environment, fetcher: fetch, migrationFiles: [], now }, 'recent-problems'))[0]!;
		expect((await run()).state).toBe('working');
		await countProblem(database, logEntry(new Problem('search.fill', 'too big'), { place: 'after the response' }), new Date('2026-11-27T09:00:00Z'));
		const result = await run();
		expect(result.state).toBe('warning');
		expect(result.summary).toBe('1 kind of problem reported 1 time in the last 7 days.');
		expect(result.details[0]).toMatch(/^search\.fill \(site, after the response\): 1 since 2026-11-27, last 2026-11-27 09:00 UTC, P-[0-9A-Z]{4}-[0-9A-Z]{4}\. too big$/);
	});
});

describe('the silent catches check', () => {
	it('tells silent catches from handled ones', () => {
		const silent = (code: string) => catchesIn(code).map((item: { silent: boolean }) => item.silent);
		expect(silent('try { a(); } catch { }')).toEqual([true]);
		expect(silent('try { a(); } catch { return undefined; }')).toEqual([true]);
		expect(silent('p.catch(() => undefined);')).toEqual([true]);
		expect(silent('try { a(); } catch { /* expected: storage is blocked in private windows. */ }')).toEqual([false]);
		expect(silent('p.catch(() => { /* expected: best-effort cleanup */ });')).toEqual([false]);
		expect(silent('try { a(); } catch (problem) { reportHere(problem, { code: "x" }); }')).toEqual([false]);
		expect(silent('try { a(); } catch (problem) { throw new Problem("x", "y", { cause: problem }); }')).toEqual([false]);
		expect(silent('try { a(); } catch { problem = "Could not save."; }')).toEqual([false]);
		expect(silent('try { a(); } catch { error(404, "Not found"); }')).toEqual([false]);
		expect(silent('try { a(); } catch (problem) { return caught(problem); }')).toEqual([false]);
		expect(silent("try { a(); } catch { saving = 'failed'; }")).toEqual([false]);
		expect(silent("try { a(); } catch { saving = 'idle'; }")).toEqual([true]);
	});
});
