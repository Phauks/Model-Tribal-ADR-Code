import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheForReaders, currentTexts, renderedVersion } from '#lib/server/essay-pages.ts';
import { allListedPublications, latestVersion, listEssays, publishVersion, readVersionText, saveVersion } from '#lib/server/essays.ts';
import { sessionCookie } from '#lib/server/accounts.ts';
import { signedInHintCookie } from '#lib/signed-in-hint.ts';
import { testDatabase } from './database.ts';

const worker = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock('virtual:essay-library', () => ({
	essayBoxFacts: { laws: {}, cases: {} },
	essayCaseLinks: {},
	essayCaseNames: {},
	essayOpinions: {},
	essayTerms: {},
	essaysInGit: { 'ii-beta': 'From git.\n', 'i-zeta': 'Only in git.\n' }
}));
vi.mock('$app/env', () => ({ version: 'test-build', building: false, dev: false }));
vi.mock('cloudflare:workers', () => ({ env: worker.env, waitUntil: () => {} }));

/** A bucket that counts how often each file is read. */
function countingBucket(files: Record<string, string>): R2Bucket & { reads: string[] } {
	const reads: string[] = [];
	return {
		reads,
		async get(key: string) {
			reads.push(key);
			return key in files ? { text: async () => files[key] } : null;
		}
	} as unknown as R2Bucket & { reads: string[] };
}

/** A stand-in for the Worker's default cache. */
function memoryCache() {
	const kept = new Map<string, string>();
	return {
		kept,
		async match(key: string) {
			const body = kept.get(key);
			return body === undefined ? undefined : new Response(body);
		},
		async put(key: string, response: Response) {
			kept.set(key, await response.text());
		}
	};
}

const essay = '---\ntitle: "Timeline"\npart: i\n---\n\n# Timeline\n\nOne paragraph.\n';
const row = { object_key: 'essays/i-timeline/1.md', sha256: 'a'.repeat(64) };

describe('rendering a published essay', () => {
	let cache: ReturnType<typeof memoryCache>;
	beforeEach(() => {
		cache = memoryCache();
		(globalThis as { caches?: unknown }).caches = { default: cache };
	});
	afterEach(() => {
		delete (globalThis as { caches?: unknown }).caches;
	});

	it('reads the text once, and not at all once the rendering is in the cache', async () => {
		const bucket = countingBucket({ [row.object_key]: essay });
		const first = await renderedVersion(bucket, row);
		expect(bucket.reads).toEqual([row.object_key]);
		expect(cache.kept.size).toBe(1);
		const second = await renderedVersion(bucket, row);
		expect(second).toEqual(first);
		expect(bucket.reads).toEqual([row.object_key]);
	});

	it('renders the same without a cache', async () => {
		const bucket = countingBucket({ [row.object_key]: essay });
		const cached = await renderedVersion(bucket, row);
		delete (globalThis as { caches?: unknown }).caches;
		expect(await renderedVersion(bucket, row)).toEqual(cached);
	});
});

describe('caching a public essay page', () => {
	function request(cookies: Record<string, string>) {
		const headers: Record<string, string>[] = [];
		cacheForReaders({ cookies: { get: (name: string) => cookies[name] }, setHeaders: (set) => headers.push(set) });
		return headers;
	}

	it('lets browsers keep the page for a minute when nobody is signed in', () => {
		expect(request({})).toEqual([{ 'cache-control': 'public, max-age=60' }]);
	});

	it('sends no caching header to someone who is or may be signed in', () => {
		expect(request({ [sessionCookie]: 'session' })).toEqual([]);
		expect(request({ [signedInHintCookie]: '1' })).toEqual([]);
	});
});

/** A bucket kept in memory, enough for saving versions. */
function memoryBucket(): R2Bucket {
	const files = new Map<string, string>();
	return {
		async put(key: string, value: string, options?: { onlyIf?: Headers }) {
			if (options?.onlyIf?.get('If-None-Match') === '*' && files.has(key)) return null;
			files.set(key, value);
			return { key };
		},
		async head(key: string) {
			return files.has(key) ? { key } : null;
		},
		async get(key: string) {
			const value = files.get(key);
			return value === undefined ? null : { text: async () => value };
		}
	} as unknown as R2Bucket;
}

describe('the texts a generated page is built from', () => {
	let database: D1Database;
	let bucket: R2Bucket;

	/** The texts as they were read before, one essay at a time. */
	async function oneAtATime(which: 'published' | 'saved'): Promise<[string, string][]> {
		const texts: Record<string, string> = { 'ii-beta': 'From git.\n', 'i-zeta': 'Only in git.\n' };
		if (which === 'published') {
			const newest = new Map<string, { object_key?: string | null }>();
			for (const row of await allListedPublications(database)) newest.set(row.essay_identifier, row);
			for (const [identifier, row] of newest) if (row.object_key) texts[identifier] = await readVersionText(bucket, { object_key: row.object_key });
		} else {
			for (const essay of await listEssays(database)) {
				const row = await latestVersion(database, essay.identifier);
				if (row) texts[essay.identifier] = await readVersionText(bucket, row);
			}
		}
		return Object.entries(texts);
	}

	async function save(identifier: string, text: string, basedOn: number | null) {
		return saveVersion(database, bucket, { identifier, text, basedOn, personIdentifier: 'lead', origin: 'editor' });
	}

	beforeEach(async () => {
		database = testDatabase();
		bucket = memoryBucket();
		worker.env.database = database;
		worker.env.sourceDocuments = bucket;
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
			.run();
		// More essays than are read at once, so the reads come in several groups.
		const identifiers = ['i-timeline', 'ii-beta', 'i-alpha', 'iii-gamma', 'i-delta', 'ii-epsilon', 'i-eta', 'iii-theta'];
		for (const identifier of identifiers) {
			await save(identifier, `---\ntitle: "${identifier}"\n---\n\nFirst.\n`, null);
			await save(identifier, `---\ntitle: "${identifier}"\n---\n\nSecond.\n`, 1);
		}
		for (const identifier of identifiers.slice(0, 5)) await publishVersion(database, identifier, 1, 'lead');
		await publishVersion(database, 'i-timeline', 2, 'lead');
	});

	afterEach(() => {
		delete worker.env.database;
		delete worker.env.sourceDocuments;
	});

	it('gives the newest published texts, in the same order as reading one at a time', async () => {
		expect(Object.entries(await currentTexts('published'))).toEqual(await oneAtATime('published'));
		expect((await currentTexts('published'))['i-timeline']).toContain('Second.');
		expect((await currentTexts('published'))['i-alpha']).toContain('First.');
	});

	it('gives the newest saved texts, in the same order as reading one at a time', async () => {
		expect(Object.entries(await currentTexts('saved'))).toEqual(await oneAtATime('saved'));
		expect((await currentTexts('saved'))['i-alpha']).toContain('Second.');
	});
});
