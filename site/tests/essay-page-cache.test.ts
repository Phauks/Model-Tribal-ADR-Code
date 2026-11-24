import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheForReaders, renderedVersion } from '#lib/server/essay-pages.ts';
import { sessionCookie } from '#lib/server/accounts.ts';
import { signedInHintCookie } from '#lib/signed-in-hint.ts';

vi.mock('virtual:essay-library', () => ({
	essayBoxFacts: { laws: {}, cases: {} },
	essayCaseLinks: {},
	essayCaseNames: {},
	essayCitations: {},
	essayOpinions: {},
	essayTerms: {},
	essaysInGit: {}
}));
vi.mock('$app/env', () => ({ version: 'test-build', building: false, dev: false }));
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => {} }));

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
