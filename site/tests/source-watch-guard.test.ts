/**
 * The source watch's guard (docs/source-watch.md, "Every collection and data
 * type, and its watcher"): every collection in src/lib/server/collections.ts
 * and every top-level field of a nation profile (schemas/tribe.schema.json)
 * is fed by a watcher or listed in notWatched with a reason, never both, and
 * every watcher's definition is complete.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSchedule } from '../src/lib/server/watch/schedule.ts';
import { notWatched, watcherNamed, watchers } from '../watch/watchers/index.ts';

const site = path.resolve(import.meta.dirname, '..');
const collectionsSource = readFileSync(path.join(site, 'src/lib/server/collections.ts'), 'utf8');
const collectionIdentifiers = [...collectionsSource.matchAll(/identifier: '([a-z0-9-]+)'/g)].map((match) => match[1]);
const nationSchema = JSON.parse(readFileSync(path.join(site, '../schemas/tribe.schema.json'), 'utf8')) as { properties: Record<string, unknown> };
const nationFeeds = Object.keys(nationSchema.properties).map((field) => `nation:${field}`);
const everyFeed = [...collectionIdentifiers, ...nationFeeds];

const watchedFeeds = new Set(watchers.flatMap((watcher) => watcher.feeds));
const notWatchedFeeds = new Set(notWatched.map((entry) => entry.feed));

describe('the source watch guard', () => {
	it('reads the collections and the nation profile fields', () => {
		expect(collectionIdentifiers.length).toBeGreaterThan(15);
		expect(nationFeeds).toContain('nation:recognition');
	});

	it('has a watcher or a reason for every collection and nation profile field', () => {
		const neither = everyFeed.filter((feed) => !watchedFeeds.has(feed) && !notWatchedFeeds.has(feed));
		expect(neither, 'Add a watcher in site/watch/watchers that feeds these, or list them in notWatched with a reason').toEqual([]);
	});

	it('never lists a watched feed as not watched', () => {
		expect([...notWatchedFeeds].filter((feed) => watchedFeeds.has(feed)), 'Take these out of notWatched: a watcher feeds them').toEqual([]);
	});

	it('names only collections and fields that exist', () => {
		const known = new Set(everyFeed);
		const strays = [...watchedFeeds, ...notWatchedFeeds].filter((feed) => !known.has(feed));
		expect(strays, 'These feeds are neither a collection nor a nation profile field').toEqual([]);
	});

	it('gives every entry in notWatched a kind and a reason', () => {
		for (const entry of notWatched) {
			expect(['planned', 'never', 'derived'], entry.feed).toContain(entry.kind);
			expect(entry.reason.length, entry.feed).toBeGreaterThan(10);
		}
		expect(new Set(notWatched.map((entry) => entry.feed)).size).toBe(notWatched.length);
	});

	it('gives every watcher a complete definition', () => {
		expect(new Set(watchers.map((watcher) => watcher.identifier)).size).toBe(watchers.length);
		for (const watcher of watchers) {
			expect(watcher.identifier, watcher.identifier).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(watcherNamed(watcher.identifier)).toBe(watcher);
			expect(watcher.title.length, watcher.identifier).toBeGreaterThan(2);
			expect([1, 2, 3, 'nations'], watcher.identifier).toContain(watcher.tier);
			expect(['api', 'feed', 'sitemap', 'page', 'email', 'bulk', 'by-hand'], watcher.identifier).toContain(watcher.driver);
			expect(['serve', 'private', 'link-only', 'by-consent'], watcher.identifier).toContain(watcher.hosting);
			expect(readSchedule(watcher.schedule), watcher.identifier).not.toHaveProperty('problem');
			expect(watcher.feeds.length, watcher.identifier).toBeGreaterThan(0);
			expect(watcher.hosts.length, watcher.identifier).toBeGreaterThan(0);
			for (const host of watcher.hosts) expect(host, watcher.identifier).toMatch(/^([a-z0-9.-]+|\*)$/);
			expect(watcher.documentation.length, watcher.identifier).toBeGreaterThan(0);
			for (const link of watcher.documentation) expect(link, watcher.identifier).toMatch(/^https:\/\//);
			if (watcher.enabled && watcher.enabled !== true) expect(watcher.enabled.off.length, watcher.identifier).toBeGreaterThan(10);
		}
	});
});
