/**
 * The malware scanner (site/SCANNING.md): the site's interface
 * (src/lib/server/file-scans.ts), the verdict policy, the providers, and the
 * scan desk working through the file_scans table.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	fileScan,
	fileScans,
	forgetScan,
	heldFileAnswer,
	latestScan,
	mayServe,
	openScannedFile,
	readScannerVersion,
	releaseByHand,
	requestScan,
	scanAgain,
	scanStatusWords,
	stillScanning,
	storeSentFile,
	type FileScan
} from '#lib/server/file-scans.ts';
import { chooseProvider, containerProvider, httpProvider, noScanning, type Fetcher } from '#lib/server/scanning/providers.ts';
import { DeskObject, maximumAttempts, retryDelayMinutes, runScans, type DeskSetup } from '#lib/server/scanning/scan-desk.ts';
import { readRawScanResult, ScanFaultError, type RawScanResult, type ScanProvider } from '#lib/server/scanning/scan-port.ts';
import { computeVerdict, matchCounts, projectScanPolicy } from '#lib/server/scanning/verdict.ts';
import { testDatabase } from './database.ts';

const cleanFacts: RawScanResult = {
	engineVersion: 'engine/1+yara-rules/20261120+clamav-db/28191',
	clam: { state: 'clean' },
	heuristic: { kind: 'none' },
	matches: [],
	timings: { clamdMs: 4, yaraMs: 2 }
};

function memoryBucket(): R2Bucket & { files: Map<string, { bytes: Uint8Array; etag: string }> } {
	const files = new Map<string, { bytes: Uint8Array; etag: string }>();
	let version = 0;
	return {
		files,
		async put(key: string, value: string | Uint8Array) {
			const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
			version += 1;
			files.set(key, { bytes, etag: `etag-${version}` });
		},
		async get(key: string) {
			const file = files.get(key);
			if (!file) return null;
			return {
				key,
				size: file.bytes.byteLength,
				etag: file.etag,
				httpMetadata: { contentType: 'application/pdf' },
				body: new Blob([file.bytes as Uint8Array<ArrayBuffer>]).stream()
			};
		}
	} as unknown as R2Bucket & { files: Map<string, { bytes: Uint8Array; etag: string }> };
}

/** A provider that reads the whole body and answers as told. */
function fakeProvider(answer: (text: string) => RawScanResult | Error): ScanProvider & { seen: string[] } {
	const seen: string[] = [];
	return {
		name: 'container',
		seen,
		async scan(body) {
			const text = await new Response(body as ReadableStream).text();
			seen.push(text);
			const result = answer(text);
			if (result instanceof Error) throw result;
			return result;
		}
	};
}

async function addPerson(database: D1Database, identifier: string) {
	await database
		.prepare(
			`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES (?, ?, ?, 'lead-author', 'active', '2026-11-23T00:00:00Z')`
		)
		.bind(identifier, `${identifier}@example.org`, identifier)
		.run();
}

describe('the verdict', () => {
	it('flags a ClamAV signature, a counting YARA rule, or an archive built to attack a scanner', () => {
		expect(computeVerdict({ ...cleanFacts, clam: { state: 'infected', signature: 'Win.Test.EICAR_HDB-1' } })).toEqual({
			verdict: 'flagged',
			reason: 'Win.Test.EICAR_HDB-1'
		});
		const rule = { ruleId: 'MAL_Dropper', tier: 'core' as const, score: 80, isSuspicious: false };
		expect(computeVerdict({ ...cleanFacts, matches: [rule] })).toEqual({ verdict: 'flagged', reason: 'MAL_Dropper' });
		expect(computeVerdict({ ...cleanFacts, heuristic: { kind: 'structural', reason: 'decompression-bomb' } })).toEqual({
			verdict: 'flagged',
			reason: 'decompression-bomb'
		});
	});

	it('weighs YARA rules by tier and, for suspicious ones, by score', () => {
		expect(matchCounts({ ruleId: 'a', tier: 'full', score: 90, isSuspicious: false }, projectScanPolicy)).toBe(false);
		expect(matchCounts({ ruleId: 'a', tier: 'extended', score: 74, isSuspicious: true }, projectScanPolicy)).toBe(false);
		expect(matchCounts({ ruleId: 'a', tier: 'extended', score: 75, isSuspicious: true }, projectScanPolicy)).toBe(true);
	});

	it('holds a locked file and a file ClamAV stopped short on, without calling either a virus', () => {
		expect(computeVerdict({ ...cleanFacts, heuristic: { kind: 'encrypted' } })).toEqual({ verdict: 'cannot-scan', reason: 'encrypted' });
		expect(computeVerdict({ ...cleanFacts, clam: { state: 'infected', signature: 'Heuristics.Limits.Exceeded.MaxScanTime' } })).toEqual({
			verdict: 'cannot-scan',
			reason: 'limits-exceeded'
		});
		// A real finding still wins over a limit.
		expect(
			computeVerdict({
				...cleanFacts,
				clam: { state: 'infected', signature: 'Heuristics.Limits.Exceeded.MaxFileSize' },
				heuristic: { kind: 'structural', reason: 'archive-nesting' }
			})
		).toEqual({ verdict: 'flagged', reason: 'archive-nesting' });
	});

	it('never calls an unanswered scan clean', () => {
		expect(computeVerdict({ ...cleanFacts, engineVersion: null, clam: { state: 'unavailable' } })).toEqual({
			verdict: 'cannot-scan',
			reason: 'no-engine'
		});
		expect(() => computeVerdict({ ...cleanFacts, clam: { state: 'unavailable' } })).toThrow(ScanFaultError);
	});

	it('marks active content on a clean file', () => {
		expect(computeVerdict({ ...cleanFacts, heuristic: { kind: 'active-content' } })).toEqual({ verdict: 'clean', activeContent: true });
		expect(computeVerdict(cleanFacts)).toEqual({ verdict: 'clean', activeContent: false });
	});
});

describe('reading a provider’s answer', () => {
	it('accepts the engine’s JSON and refuses anything else as a fault', () => {
		expect(readRawScanResult(JSON.parse(JSON.stringify(cleanFacts)))).toEqual(cleanFacts);
		expect(() => readRawScanResult({ ...cleanFacts, clam: { state: 'fine' } })).toThrow(ScanFaultError);
		expect(() => readRawScanResult({ ...cleanFacts, heuristic: { kind: 'structural', reason: 'made-up' } })).toThrow(ScanFaultError);
		expect(() => readRawScanResult({ ...cleanFacts, matches: [{ ruleId: 'x' }] })).toThrow(ScanFaultError);
		expect(() => readRawScanResult('clean')).toThrow(ScanFaultError);
	});
});

describe('the providers', () => {
	function engine(respond: (request: Request) => Promise<Response>): Fetcher & { requests: Request[] } {
		const requests: Request[] = [];
		return {
			requests,
			fetch: async (request) => {
				requests.push(request);
				return respond(request);
			}
		};
	}

	it('sends the file to the container engine after waking it, with its size and type', async () => {
		let woken = 0;
		const fetcher = engine(async (request) => {
			expect(await request.text()).toBe('file bytes');
			return Response.json(cleanFacts);
		});
		const provider = containerProvider(fetcher, { wake: async () => void (woken += 1) });
		const result = await provider.scan(new Blob(['file bytes']).stream(), { sizeBytes: 10, mediaType: 'application/pdf' });
		expect(result).toEqual(cleanFacts);
		expect(woken).toBe(1);
		const url = new URL(fetcher.requests[0].url);
		expect(url.pathname).toBe('/scan');
		expect(url.searchParams.get('size')).toBe('10');
		expect(url.searchParams.get('contentType')).toBe('application/pdf');
	});

	it('turns an engine that does not start or answer into a fault, never a result', async () => {
		const asleep = containerProvider(engine(async () => Response.json(cleanFacts)), {
			wake: async () => {
				throw new Error('port 8080 not ready');
			}
		});
		await expect(asleep.scan(new Blob(['x']).stream(), { sizeBytes: 1, mediaType: null })).rejects.toThrow(ScanFaultError);
		const broken = containerProvider(engine(async () => new Response('scan engine unavailable; retry', { status: 503 })));
		await expect(broken.scan(new Blob(['x']).stream(), { sizeBytes: 1, mediaType: null })).rejects.toThrow(ScanFaultError);
		const garbled = containerProvider(engine(async () => new Response('<html>', { status: 200 })));
		await expect(garbled.scan(new Blob(['x']).stream(), { sizeBytes: 1, mediaType: null })).rejects.toThrow(ScanFaultError);
	});

	it('sends the key to an http provider as a bearer token', async () => {
		const fetcher = engine(async () => Response.json(cleanFacts));
		const provider = httpProvider({ address: 'https://scanner.example.org/scan', token: 'secret', fetcher });
		await provider.scan(new Blob(['x']).stream(), { sizeBytes: 1, mediaType: null });
		expect(fetcher.requests[0].headers.get('authorization')).toBe('Bearer secret');
		expect(new URL(fetcher.requests[0].url).host).toBe('scanner.example.org');
	});

	it('is chosen by SCAN_PROVIDER, and a setup mistake falls back to holding files', () => {
		const container = { fetcher: engine(async () => Response.json(cleanFacts)) };
		expect(chooseProvider({}, container).name).toBe('container');
		expect(chooseProvider({ SCAN_PROVIDER: 'http', SCAN_HTTP_ADDRESS: 'https://scanner.example.org/scan' }, container).name).toBe('http');
		expect(chooseProvider({ SCAN_PROVIDER: 'http' }, container)).toBe(noScanning);
		expect(chooseProvider({ SCAN_PROVIDER: 'off' }, container)).toBe(noScanning);
		expect(chooseProvider({ SCAN_PROVIDER: 'virustotal' }, container)).toBe(noScanning);
		expect(chooseProvider({}, null)).toBe(noScanning);
	});
});

describe('holding and releasing files', () => {
	let database: D1Database;
	beforeEach(() => {
		database = testDatabase();
	});

	it('holds a file from the moment it is put in line until it is scanned clean, for those bytes only', async () => {
		expect(mayServe(null)).toBe(false);
		await requestScan(database, { objectKey: 'uploads/a/original', purpose: 'upload', subject: 'U-20261123-AAAAAA' });
		const waiting = await fileScan(database, 'uploads/a/original');
		expect(waiting).toMatchObject({ status: 'waiting', purpose: 'upload', subject: 'U-20261123-AAAAAA', attempts: 0 });
		expect(mayServe(waiting)).toBe(false);
		expect(stillScanning(waiting)).toBe(true);
		expect(scanStatusWords(waiting).label).toBe('Waiting for the virus check');

		const clean: FileScan = { ...waiting!, status: 'clean', objectEtag: 'etag-1' };
		expect(mayServe(clean, { etag: 'etag-1' })).toBe(true);
		expect(mayServe(clean, { etag: 'etag-2' })).toBe(false);
		expect(mayServe({ ...clean, status: 'flagged' }, { etag: 'etag-1' })).toBe(false);
	});

	it('starts over when the same file is put in line again', async () => {
		await requestScan(database, { objectKey: 'k', purpose: 'upload' });
		await database.prepare(`UPDATE file_scans SET status = 'clean', object_etag = 'old', attempts = 1`).run();
		await requestScan(database, { objectKey: 'k', purpose: 'upload' });
		expect(await fileScan(database, 'k')).toMatchObject({ status: 'waiting', objectEtag: null, attempts: 0 });
	});

	it('reads many scans at once', async () => {
		const keys = Array.from({ length: 150 }, (_, index) => `mail/m/attachments/${index}`);
		for (const key of keys) await requestScan(database, { objectKey: key, purpose: 'mail-attachment' });
		const found = await fileScans(database, [...keys, 'never-requested']);
		expect(found.size).toBe(150);
		expect(found.has('never-requested')).toBe(false);
	});

	it('lets a reviewer release only a file that could not be scanned, never one where something was found', async () => {
		await addPerson(database, 'lead');
		await requestScan(database, { objectKey: 'big', purpose: 'upload' });
		await requestScan(database, { objectKey: 'bad', purpose: 'upload' });
		await requestScan(database, { objectKey: 'gone', purpose: 'upload' });
		await database.prepare(`UPDATE file_scans SET status = 'cannot-scan', reason = 'too-large' WHERE object_key = 'big'`).run();
		await database.prepare(`UPDATE file_scans SET status = 'flagged', reason = 'Win.Test.EICAR_HDB-1' WHERE object_key = 'bad'`).run();
		await database.prepare(`UPDATE file_scans SET status = 'cannot-scan', reason = 'missing' WHERE object_key = 'gone'`).run();

		expect(await releaseByHand(database, 'big', 'lead', 'A two-hour recording from the nation’s own office.')).toBe(true);
		expect(await releaseByHand(database, 'bad', 'lead', 'Looks fine to me')).toBe(false);
		expect(await releaseByHand(database, 'gone', 'lead', '')).toBe(false);
		const released = await fileScan(database, 'big');
		expect(released).toMatchObject({ status: 'released-by-hand', releasedBy: 'lead' });
		expect(mayServe(released)).toBe(true);
		expect(scanStatusWords(released).label).toBe('Released without a check');

		expect(await scanAgain(database, 'bad')).toBe(false);
		expect(await scanAgain(database, 'big')).toBe(true);
		expect(await fileScan(database, 'big')).toMatchObject({ status: 'waiting', releasedBy: null });

		await forgetScan(database, 'big');
		expect(await fileScan(database, 'big')).toBeNull();
	});
});

describe('storing and opening sent files', () => {
	let database: D1Database;
	let bucket: ReturnType<typeof memoryBucket>;
	beforeEach(() => {
		database = testDatabase();
		bucket = memoryBucket();
	});

	async function markClean(objectKey: string): Promise<void> {
		const etag = bucket.files.get(objectKey)!.etag;
		await database.prepare(`UPDATE file_scans SET status = 'clean', object_etag = ? WHERE object_key = ?`).bind(etag, objectKey).run();
	}

	it('stores a sent file and holds it in one step', async () => {
		await storeSentFile(database, bucket, { objectKey: 'requests/r/1', purpose: 'request-file', subject: 'R-1', bytes: new Uint8Array([1, 2]) });
		expect(bucket.files.has('requests/r/1')).toBe(true);
		expect(await fileScan(database, 'requests/r/1')).toMatchObject({ status: 'waiting', purpose: 'request-file', subject: 'R-1' });
	});

	it('leaves nothing behind if the file cannot be put in line', async () => {
		const deleted: string[] = [];
		const failing = {
			...bucket,
			put: bucket.put,
			delete: async (key: string) => void deleted.push(key),
			files: bucket.files
		} as unknown as R2Bucket;
		const broken = { prepare: () => ({ bind: () => ({ run: async () => Promise.reject(new Error('no table')) }) }) } as unknown as D1Database;
		await expect(storeSentFile(broken, failing, { objectKey: 'requests/r/2', purpose: 'request-file', bytes: new Uint8Array([1]) })).rejects.toThrow('no table');
		expect(deleted).toEqual(['requests/r/2']);
	});

	it('opens a file only once it is clean, and only the bytes that were scanned', async () => {
		let reads = 0;
		const counting = { ...bucket, get: async (key: string) => ((reads += 1), bucket.get(key)) } as unknown as R2Bucket;
		await storeSentFile(database, bucket, { objectKey: 'nation-pages/n/pictures/p', purpose: 'nation-picture', bytes: new Uint8Array([1]) });

		const waiting = await openScannedFile(database, counting, 'nation-pages/n/pictures/p');
		expect(waiting.state).toBe('held');
		// A held file is not even read from the bucket.
		expect(reads).toBe(0);
		if (waiting.state === 'ready') throw new Error('not held');
		expect(heldFileAnswer(waiting)).toEqual({
			status: 403,
			message: 'Waiting for the virus check. The file is in line for the virus check and is held until it passes.'
		});

		await markClean('nation-pages/n/pictures/p');
		const ready = await openScannedFile(database, counting, 'nation-pages/n/pictures/p');
		expect(ready.state).toBe('ready');

		// Replaced behind the scanner's back: held again.
		await bucket.put('nation-pages/n/pictures/p', 'other bytes');
		expect((await openScannedFile(database, counting, 'nation-pages/n/pictures/p')).state).toBe('held');
	});

	it('holds a file that was never put in line, and says when a cleared file is gone', async () => {
		await bucket.put('profile-pictures/x/1.jpg', 'picture');
		const never = await openScannedFile(database, bucket, 'profile-pictures/x/1.jpg');
		expect(never).toEqual({ state: 'held', scan: null });

		await requestScan(database, { objectKey: 'profile-pictures/x/1.jpg', purpose: 'profile-picture' });
		await markClean('profile-pictures/x/1.jpg');
		bucket.files.delete('profile-pictures/x/1.jpg');
		const gone = await openScannedFile(database, bucket, 'profile-pictures/x/1.jpg');
		expect(gone.state).toBe('missing');
		if (gone.state === 'ready') throw new Error('not missing');
		expect(heldFileAnswer(gone).status).toBe(404);
	});

	it('never opens a flagged file', async () => {
		await storeSentFile(database, bucket, { objectKey: 'requests/r/3', purpose: 'request-file', bytes: new Uint8Array([1]) });
		await database.prepare(`UPDATE file_scans SET status = 'flagged', reason = 'Eicar-Test-Signature' WHERE object_key = ?`).bind('requests/r/3').run();
		const opened = await openScannedFile(database, bucket, 'requests/r/3');
		expect(opened.state).toBe('held');
		if (opened.state === 'ready') throw new Error('not held');
		expect(heldFileAnswer(opened).message).toContain('Virus found');
	});
});

describe('the scan desk', () => {
	let database: D1Database;
	let bucket: ReturnType<typeof memoryBucket>;
	let clock: Date;
	const setup = (provider: ScanProvider, extra: Partial<DeskSetup> = {}): DeskSetup => ({
		database,
		bucket,
		provider,
		sizeLimitBytes: 1000,
		now: () => clock,
		...extra
	});

	beforeEach(() => {
		database = testDatabase();
		bucket = memoryBucket();
		clock = new Date('2026-11-23T04:00:00Z');
	});

	it('scans each waiting file and records clean, flagged and locked files', async () => {
		await bucket.put('uploads/good/original', 'a report');
		await bucket.put('uploads/bad/original', 'EICAR');
		await bucket.put('uploads/locked/original', 'LOCKED');
		for (const key of ['uploads/good/original', 'uploads/bad/original', 'uploads/locked/original']) {
			await requestScan(database, { objectKey: key, purpose: 'upload' });
		}
		const provider = fakeProvider((text) =>
			text === 'EICAR'
				? { ...cleanFacts, clam: { state: 'infected', signature: 'Win.Test.EICAR_HDB-1' } }
				: text === 'LOCKED'
					? { ...cleanFacts, heuristic: { kind: 'encrypted' } }
					: cleanFacts
		);
		const round = await runScans(setup(provider), Number.POSITIVE_INFINITY);
		expect(round).toEqual({ finished: 3, moreWaiting: false, nextTryAt: null });
		expect(provider.seen.sort()).toEqual(['EICAR', 'LOCKED', 'a report']);

		const scans = await fileScans(database, ['uploads/good/original', 'uploads/bad/original', 'uploads/locked/original']);
		const good = scans.get('uploads/good/original')!;
		expect(good).toMatchObject({ status: 'clean', provider: 'container', engineVersion: cleanFacts.engineVersion, attempts: 1 });
		expect(mayServe(good, { etag: bucket.files.get('uploads/good/original')!.etag })).toBe(true);
		expect(scans.get('uploads/bad/original')).toMatchObject({ status: 'flagged', reason: 'Win.Test.EICAR_HDB-1' });
		expect(scans.get('uploads/locked/original')).toMatchObject({ status: 'cannot-scan', reason: 'encrypted' });

		// Replacing the bytes after the scan holds the file again.
		await bucket.put('uploads/good/original', 'different bytes');
		expect(mayServe(good, { etag: bucket.files.get('uploads/good/original')!.etag })).toBe(false);
	});

	it('holds files that are too large or missing without sending them', async () => {
		await bucket.put('uploads/video/original', 'x'.repeat(1001));
		await requestScan(database, { objectKey: 'uploads/video/original', purpose: 'upload' });
		await requestScan(database, { objectKey: 'uploads/nowhere/original', purpose: 'upload' });
		const provider = fakeProvider(() => cleanFacts);
		await runScans(setup(provider), Number.POSITIVE_INFINITY);
		expect(provider.seen).toEqual([]);
		expect(await fileScan(database, 'uploads/video/original')).toMatchObject({ status: 'cannot-scan', reason: 'too-large', sizeBytes: 1001 });
		expect(await fileScan(database, 'uploads/nowhere/original')).toMatchObject({ status: 'cannot-scan', reason: 'missing' });
	});

	it('tries again later when the engine does not answer, and gives up after the last try', async () => {
		await bucket.put('mail/m/attachments/1', 'an attachment');
		await requestScan(database, { objectKey: 'mail/m/attachments/1', purpose: 'mail-attachment' });
		const provider = fakeProvider(() => new ScanFaultError('The scanner answered with status 503.'));

		let round = await runScans(setup(provider), Number.POSITIVE_INFINITY);
		let scan = await fileScan(database, 'mail/m/attachments/1');
		expect(scan).toMatchObject({ status: 'retrying', attempts: 1, reason: 'The scanner answered with status 503.' });
		expect(round.nextTryAt).toBe('2026-11-23T04:01:00.000Z');
		expect(mayServe(scan)).toBe(false);

		// Not due yet: nothing is tried.
		round = await runScans(setup(provider), Number.POSITIVE_INFINITY);
		expect(round.finished).toBe(0);

		for (let attempt = 2; attempt <= maximumAttempts; attempt += 1) {
			clock = new Date(Date.parse(scan!.nextTryAt!) + 1000);
			await runScans(setup(provider), Number.POSITIVE_INFINITY);
			scan = await fileScan(database, 'mail/m/attachments/1');
		}
		expect(scan).toMatchObject({ status: 'failed', attempts: maximumAttempts, nextTryAt: null });
		expect(provider.seen).toHaveLength(maximumAttempts);
		expect(retryDelayMinutes(1)).toBe(1);
		expect(retryDelayMinutes(50)).toBe(720);
	});

	it('takes up a file a stopped desk left half done', async () => {
		await bucket.put('k', 'bytes');
		await requestScan(database, { objectKey: 'k', purpose: 'upload' });
		await database.prepare(`UPDATE file_scans SET status = 'scanning', attempts = 1, started_at = '2026-11-23T03:00:00.000Z'`).run();
		await runScans(setup(fakeProvider(() => cleanFacts)), Number.POSITIVE_INFINITY);
		expect(await fileScan(database, 'k')).toMatchObject({ status: 'clean', attempts: 2 });
	});

	it('scans nothing when scanning is off, so every file stays held', async () => {
		await bucket.put('k', 'bytes');
		await requestScan(database, { objectKey: 'k', purpose: 'upload' });
		const round = await runScans(setup(noScanning), Number.POSITIVE_INFINITY);
		expect(round).toEqual({ finished: 0, moreWaiting: false, nextTryAt: null });
		expect(await fileScan(database, 'k')).toMatchObject({ status: 'waiting' });
	});

	it('stops at its deadline and asks for another round', async () => {
		for (const key of ['a', 'b', 'c']) {
			await bucket.put(key, key);
			await requestScan(database, { objectKey: key, purpose: 'upload' });
		}
		const provider = fakeProvider(() => {
			clock = new Date(clock.getTime() + 60_000);
			return cleanFacts;
		});
		const round = await runScans(setup(provider), clock.getTime() + 90_000);
		expect(round.finished).toBe(2);
		expect(round.moreWaiting).toBe(true);
	});

	it('sets its alarm when woken, and again for the next file due', async () => {
		let alarm: number | null = null;
		const state = {
			storage: {
				getAlarm: async () => alarm,
				setAlarm: async (time: number) => void (alarm = time)
			}
		};
		// A clock ahead of the real one, since the desk never sets an alarm in the past.
		clock = new Date('2030-01-01T00:00:00Z');
		await bucket.put('k', 'bytes');
		await requestScan(database, { objectKey: 'k', purpose: 'upload' });
		const desk = new DeskObject(state, () => setup(fakeProvider(() => new ScanFaultError('asleep'))));
		const response = await desk.fetch();
		expect(response.status).toBe(202);
		expect(alarm).not.toBeNull();
		alarm = null;
		await desk.alarm();
		expect(alarm).toBe(Date.parse('2030-01-01T00:01:00.000Z'));
	});
});

describe('which scanner checked a file', () => {
	it('reads the engine’s version string', () => {
		expect(readScannerVersion('engine/1+yara-rules/20261120+clamav-db/28191-20261122')).toEqual({
			engine: '1',
			yaraRules: '2026-11-20',
			clamavDatabase: '28191',
			clamavDatabaseDate: '2026-11-22'
		});
		expect(readScannerVersion('engine/1+yara-rules/off+clamav-db/28191')).toEqual({
			engine: '1',
			yaraRules: 'none',
			clamavDatabase: '28191',
			clamavDatabaseDate: null
		});
		expect(readScannerVersion(null)).toBeNull();
	});

	it('says when, by which scanner and with which signatures', async () => {
		const database = testDatabase();
		await requestScan(database, { objectKey: 'requests/r/1', purpose: 'request-file' });
		expect(scanStatusWords(await fileScan(database, 'requests/r/1')).checkedBy).toBeNull();
		await database
			.prepare(
				`UPDATE file_scans SET status = 'clean', provider = 'container', finished_at = '2026-11-23T04:51:09.000Z',
				 engine_version = 'engine/1+yara-rules/20261120+clamav-db/28191-20261122' WHERE object_key = ?`
			)
			.bind('requests/r/1')
			.run();
		const scan = await fileScan(database, 'requests/r/1');
		expect(scanStatusWords(scan).checkedBy).toBe(
			'Checked Nov. 23, 2026, 04:51 UTC by the project’s scanner (ClamAV and YARA): ClamAV signatures 28191 of Nov. 22, 2026, YARA Forge rules of Nov. 20, 2026, engine 1.'
		);
		expect((await latestScan(database))?.objectKey).toBe('requests/r/1');
	});
});
