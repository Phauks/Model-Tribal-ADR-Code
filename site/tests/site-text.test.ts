import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteTextEntry } from '#lib/site-text-markers.ts';
import { loadPublishedSiteText } from '#lib/server/site-text-build.ts';
import {
	checkMissedRebuild,
	drafts,
	history,
	pieceStates,
	publish,
	publishedSiteText,
	requestRebuild,
	saveVersion,
	undoLatestPublication
} from '#lib/server/site-text.ts';
import { testDatabase } from './database.ts';

let database: D1Database;

const label: SiteTextEntry = { key: 'aaaaaaaaaa', file: 'src/routes/sponsor/+page.svelte', line: 122, words: 'Native nations with their own page' };
const heading: SiteTextEntry = { key: 'bbbbbbbbbb', file: 'src/routes/sponsor/+page.svelte', line: 134, words: 'More you can fund' };
const catalog = new Map([label, heading].map((entry) => [entry.key, entry]));

beforeEach(async () => {
	database = testDatabase();
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-24T00:00:00Z')`)
		.run();
});

const save = (entry: SiteTextEntry, words: string | null) => saveVersion(database, { entry, words, page: '/sponsor', personIdentifier: 'lead' });

describe('site text', () => {
	it('saves drafts, publishes them, and serves only published words', async () => {
		await save(label, 'Identified   Native Nations ');
		expect((await drafts(database)).map((state) => state.draft?.words)).toEqual(['Identified Native Nations']);
		expect(await publishedSiteText(database)).toEqual({ publication: 0, texts: {} });

		expect(await publish(database, 'lead')).toBe(1);
		expect(await drafts(database)).toEqual([]);
		expect(await publishedSiteText(database)).toEqual({ publication: 1, texts: { aaaaaaaaaa: 'Identified Native Nations' } });
		expect(await publish(database, 'lead')).toBeNull();
	});

	it('treats the built-in words as no edit, and a version that matches the published words as no draft', async () => {
		await save(label, 'Native nations with their own page');
		expect((await pieceStates(database)).get(label.key)?.draft).toBeNull();
		await save(label, 'Identified Native Nations');
		await publish(database, 'lead');
		await save(label, 'Something else');
		await save(label, 'Identified Native Nations');
		expect(await drafts(database)).toEqual([]);
	});

	it('undoes the newest publication, back to earlier words or the built-in words', async () => {
		await save(label, 'First');
		await publish(database, 'lead');
		await save(label, 'Second');
		await save(heading, 'Fund more');
		await publish(database, 'lead');
		expect((await publishedSiteText(database)).texts).toEqual({ aaaaaaaaaa: 'Second', bbbbbbbbbb: 'Fund more' });

		expect(await undoLatestPublication(database, 'lead', catalog)).toBe(3);
		expect(await publishedSiteText(database)).toEqual({ publication: 3, texts: { aaaaaaaaaa: 'First' } });
		expect(await drafts(database)).toEqual([]);
		const versions = await history(database, heading.key);
		expect(versions.map((version) => [version.words, version.publications])).toEqual([
			[null, [3]],
			['Fund more', [2]]
		]);
	});

	it('publishes only the named drafts when asked', async () => {
		await save(label, 'One');
		await save(heading, 'Two');
		await publish(database, 'lead', [heading.key]);
		expect((await publishedSiteText(database)).texts).toEqual({ bbbbbbbbbb: 'Two' });
		expect((await drafts(database)).map((state) => state.key)).toEqual([label.key]);
	});

	it('never changes or deletes a version', async () => {
		await save(label, 'One');
		await expect(database.prepare("UPDATE site_text_versions SET words = 'x'").run()).rejects.toThrow();
		await expect(database.prepare('DELETE FROM site_text_versions').run()).rejects.toThrow();
	});
});

describe('rebuilds', () => {
	it('asks through the deploy hook and records the answer', async () => {
		const calls: string[] = [];
		const fetcher = (async (address: string) => {
			calls.push(address);
			return new Response(null, { status: 200 });
		}) as unknown as typeof fetch;
		expect(await requestRebuild(database, 'https://hook.example', 1, 'published', fetcher)).toBe('asked');
		expect(await requestRebuild(database, undefined, 1, 'published', fetcher)).toBe('no deploy hook');
		expect(calls).toEqual(['https://hook.example']);
	});

	it('asks again when a publication has not reached the pages, after waiting, three times at most', async () => {
		const fetcher = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
		await save(label, 'One');
		await publish(database, 'lead');
		expect((await checkMissedRebuild(database, 'https://hook.example', 1, new Date(), fetcher)).outcome).toBe('up to date');
		await requestRebuild(database, 'https://hook.example', 1, 'published', fetcher);
		expect((await checkMissedRebuild(database, 'https://hook.example', 0, new Date(), fetcher)).outcome).toBe('waiting for the build');
		let later = Date.now();
		for (let ask = 0; ask < 3; ask++) {
			later += 31 * 60 * 1000;
			expect((await checkMissedRebuild(database, 'https://hook.example', 0, new Date(later), fetcher)).outcome).toBe('asked');
		}
		later += 31 * 60 * 1000;
		expect((await checkMissedRebuild(database, 'https://hook.example', 0, new Date(later), fetcher)).outcome).toMatch(/^gave up/);
	});
});

describe('loadPublishedSiteText', () => {
	const site = process.cwd();
	it('builds with the built-in words off Cloudflare', async () => {
		expect(await loadPublishedSiteText(site, {})).toEqual({ publication: 0, texts: {} });
	});
	it('reads the live site on Cloudflare, and treats 404 as nothing published', async () => {
		const answer = (status: number, body?: unknown) => (async () => new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof fetch;
		expect(await loadPublishedSiteText(site, { WORKERS_CI: '1' }, answer(200, { publication: 4, texts: { abcdefghij: 'Hi' } }))).toEqual({ publication: 4, texts: { abcdefghij: 'Hi' } });
		expect(await loadPublishedSiteText(site, { WORKERS_CI: '1' }, answer(404))).toEqual({ publication: 0, texts: {} });
	});
});
