import { describe, expect, it } from 'vitest';
import { entrySource } from '../tools/add-edge-cache.mjs';
import { edgeCacheRules, edgeHeader, edgePolicy, tagHeader, withEdgeCachePolicy } from '../tools/edge-cache-worker.js';
import { keptAnswer, type AnswerStore } from '../src/lib/server/kept-answers.ts';
import { keptTileKey, tileSets } from '../src/lib/server/map-tile-serving.ts';

const ok = (headers: Record<string, string> = {}, status = 200) => new Response(status === 204 ? null : 'body', { status, headers });

describe('what the edge may keep', () => {
	it('keeps the record pages the Worker draws from built data, and their data for moves within the site', () => {
		for (const path of [
			'/cases/worcester-v-georgia',
			'/cases/worcester-v-georgia/__data.json',
			'/laws/treaty-with-the-cheyenne-and-arapaho-1867',
			'/biographies/a-c-hunt',
			'/supreme-court/justices/abe-fortas',
			'/presidents/andrew-jackson',
			'/supreme-court/marshall-court',
			'/supreme-court/portraits/abe-fortas'
		]) {
			const policy = edgePolicy('GET', path, ok());
			expect(policy.control, path).toMatch(/^public, max-age=\d+$/);
			expect(policy.tags, path).toEqual(['record-pages']);
		}
	});

	it('keeps map tiles, empty tiles included, map pictures and the map’s fonts and icons', () => {
		expect(edgePolicy('GET', '/map-tiles/basemap-20261122/6/15/24.mvt', ok()).tags).toEqual(['map-tiles']);
		expect(edgePolicy('GET', '/map-tiles/scan-1909-efc0c917deec/6/15/24.webp', ok()).tags).toEqual(['map-tiles']);
		expect(edgePolicy('GET', '/map-tiles/basemap-20261122/6/15/24.mvt', ok({}, 204)).control).toMatch(/^public/);
		expect(edgePolicy('GET', '/map-tiles/imagery/satellite/6/15/24', ok()).control).toMatch(/^public/);
		expect(edgePolicy('GET', '/map-tiles/assets/sprites/white.json', ok()).control).toMatch(/^public/);
	});

	it('keeps the search files only briefly, under the tag a nation’s new choice purges', () => {
		const policy = edgePolicy('GET', '/search/index.json', ok());
		expect(policy).toEqual({ control: 'public, max-age=300', tags: ['nation-restrictions'] });
		expect(edgePolicy('GET', '/search/records.json', ok()).tags).toEqual(['nation-restrictions']);
		// The sitemap leaves out what nations hid, so it is purged with them (src/lib/sitemap.ts).
		expect(edgePolicy('GET', '/sitemap.xml', ok())).toEqual({ control: 'public, max-age=3600', tags: ['nation-restrictions'] });
		expect(edgePolicy('GET', '/sitemaps/source-documents.xml', ok()).tags).toEqual(['nation-restrictions']);
		expect(edgePolicy('GET', '/sitemaps/cases-2.xml', ok()).tags).toEqual(['nation-restrictions']);
		// The lists as built are never served, so never kept.
		expect(edgePolicy('GET', '/sitemaps/built/parts.json', ok()).control).toBe('no-store');
	});

	it('keeps the home page row of sponsors five minutes, but never a sponsor’s own pages', () => {
		expect(edgePolicy('GET', '/sponsor/row.json', ok())).toEqual({ control: 'public, max-age=300', tags: ['sponsors'] });
		expect(edgePolicy('GET', '/sponsor', ok()).control).toBe('no-store');
		expect(edgePolicy('GET', '/account/sponsorship', ok()).control).toBe('no-store');
	});

	it('never keeps a signed-in, personal or changing page', () => {
		// The private and signed-in prefixes of src/hooks.server.ts, and other pages that change between deploys.
		const prefixes = [
			'/workspace', '/profile', '/account', '/sign-in', '/sign-out', '/requests', '/following', '/uploads', '/orders', '/book/orders',
			'/book/files', '/events', '/rooms', '/sponsorship', '/files', '/sponsorship/invite', '/changes', '/nations', '/essays', '/foundations',
			'/site-text', '/mail', '/restricted-pages', '/restricted-files', '/copies', '/published-essays', '/sponsors', '/store', '/book', '/starred'
		];
		for (const prefix of prefixes) {
			for (const path of [prefix, `${prefix}/x`, `${prefix}/x/__data.json`]) {
				expect(edgePolicy('GET', path, ok()).control, path).toBe('no-store');
			}
		}
		expect(edgePolicy('GET', '/', ok()).control).toBe('no-store');
	});

	it('never keeps an answer that sets a cookie, says private or no-store, or varies on everything', () => {
		const path = '/cases/worcester-v-georgia';
		expect(edgePolicy('GET', path, ok({ 'set-cookie': 'a=b' })).control).toBe('no-store');
		expect(edgePolicy('GET', path, ok({ 'cache-control': 'private' })).control).toBe('no-store');
		expect(edgePolicy('GET', path, ok({ 'cache-control': 'no-store' })).control).toBe('no-store');
		expect(edgePolicy('GET', path, ok({ vary: '*' })).control).toBe('no-store');
	});

	it('keeps only answers that went well, and only for reading', () => {
		expect(edgePolicy('GET', '/cases/no-such-case', ok({}, 404)).control).toBe('no-store');
		expect(edgePolicy('GET', '/cases/worcester-v-georgia', ok({}, 503)).control).toBe('no-store');
		expect(edgePolicy('POST', '/cases/worcester-v-georgia', ok()).control).toBe('no-store');
		expect(edgePolicy('HEAD', '/cases/worcester-v-georgia', ok()).control).toMatch(/^public/);
	});

	it('has rules only for addresses under the families named', () => {
		for (const rule of edgeCacheRules) expect(rule.pattern.source.startsWith('^\\/')).toBe(true);
	});
});

describe('the wrapper around the built Worker', () => {
	const inner = (response: () => Response) => ({ fetch: async () => response(), scheduled: async () => undefined, email: async () => undefined });

	it('tells the edge how long it may keep a kept page, under its tag', async () => {
		const worker = withEdgeCachePolicy(inner(() => ok()));
		const answer = await worker.fetch(new Request('https://triballawproject.org/cases/worcester-v-georgia'), {}, {});
		expect(answer.headers.get(edgeHeader)).toMatch(/^public, max-age=\d+$/);
		expect(answer.headers.get(tagHeader)).toBe('record-pages');
		expect(await answer.text()).toBe('body');
	});

	it('tells the edge even on an answer whose headers cannot change', async () => {
		// A redirect's headers are immutable, like those of an answer from the static files.
		const worker = withEdgeCachePolicy(inner(() => Response.redirect('https://triballawproject.org/cases', 308)));
		const answer = await worker.fetch(new Request('https://triballawproject.org/cases/'), {}, {});
		expect(answer.status).toBe(308);
		expect(answer.headers.get(edgeHeader)).toBe('no-store');
	});

	it('marks everything else no-store and drops a tag the page gave', async () => {
		const worker = withEdgeCachePolicy(inner(() => ok({ 'cache-tag': 'record-pages' })));
		const answer = await worker.fetch(new Request('https://triballawproject.org/workspace'), {}, {});
		expect(answer.headers.get(edgeHeader)).toBe('no-store');
		expect(answer.headers.has(tagHeader)).toBe(false);
	});

	it('keeps the Worker’s other handlers', () => {
		const worker = withEdgeCachePolicy(inner(() => ok()));
		expect(typeof worker.scheduled).toBe('function');
		expect(typeof worker.email).toBe('function');
	});

	it('is wrapped around the entry before it', () => {
		expect(entrySource('mail-entry.js')).toContain("import worker from './mail-entry.js';");
		expect(entrySource('mail-entry.js')).toContain('export default withEdgeCachePolicy(worker);');
	});
});

describe('tiles kept across deploys', () => {
	function memoryStore() {
		const kept = new Map<string, Response>();
		const store: AnswerStore = {
			async match(key) {
				return kept.get(key)?.clone();
			},
			async put(key, response) {
				kept.set(key, response);
			}
		};
		return { store, kept };
	}
	const now = (work: Promise<unknown>) => void work;

	it('keeps a tile and answers from the kept copy next time', async () => {
		const { store, kept } = memoryStore();
		let made = 0;
		const make = async () => {
			made += 1;
			return ok({ 'cache-control': 'public, max-age=31536000, immutable' });
		};
		await keptAnswer('k', make, { store, later: now, statuses: [200, 204] });
		const second = await keptAnswer('k', make, { store, later: now, statuses: [200, 204] });
		expect(made).toBe(1);
		expect(kept.size).toBe(1);
		expect(await second.text()).toBe('body');
	});

	it('does not keep a failure or an answer marked no-store', async () => {
		const { store, kept } = memoryStore();
		await keptAnswer('a', async () => ok({}, 404), { store, later: now, statuses: [200, 204] });
		await keptAnswer('b', async () => ok({ 'cache-control': 'no-store' }), { store, later: now, statuses: [200, 204] });
		expect(kept.size).toBe(0);
	});

	it('works without a cache, as when the site is built', async () => {
		const answer = await keptAnswer('k', async () => ok(), { store: undefined, later: now, statuses: [200] });
		expect(answer.status).toBe(200);
	});

	it('keys a tile by every tile set served, and has no key for a set not served', () => {
		const set = [...tileSets.keys()][0];
		const key = keptTileKey('https://triballawproject.org', set, 3, 1, 2) ?? '';
		for (const name of tileSets.keys()) expect(decodeURIComponent(key)).toContain(name);
		expect(keptTileKey('https://triballawproject.org', 'land-areas-withdrawn', 3, 1, 2)).toBeUndefined();
		expect(keptTileKey('https://triballawproject.org', set, 3, 9, 2)).toBeUndefined();
	});
});
