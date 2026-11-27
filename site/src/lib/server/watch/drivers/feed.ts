/**
 * The feed and sitemap drivers (docs/source-watch.md, "Watchers"). A feed
 * watcher keeps the newest entry's date as its cursor and reports entries
 * after it; a sitemap watcher keeps each address's lastmod in the page memory
 * and reports addresses whose lastmod moved.
 */
import type { CheckContext, Feed, FoundItem } from '../watcher.ts';
import { readFeed, readSitemap, type FeedEntry } from './markup.ts';

export async function readFeedSince(context: CheckContext, address: string, options: { feeds?: Feed[]; keep?: (entry: FeedEntry) => boolean } = {}): Promise<{ items: FoundItem[]; cursor: string | null }> {
	const { response, modelMayRead } = await context.fetch(address, { accept: 'application/rss+xml, application/atom+xml, application/xml' });
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`${new URL(address).hostname} answered ${response.status}`);
	}
	const entries = readFeed(await response.text());
	const since = context.cursor ?? '';
	const fresh = entries.filter((entry) => (entry.date ?? '') > since && (options.keep?.(entry) ?? true));
	const newest = entries.reduce((latest, entry) => ((entry.date ?? '') > latest ? (entry.date ?? '') : latest), since);
	return {
		cursor: newest || context.cursor,
		items: fresh.map((entry) => ({
			sourceIdentifier: entry.identifier || entry.link || entry.title,
			kind: 'feed-entry',
			title: entry.title,
			date: entry.date ?? undefined,
			link: entry.link ?? undefined,
			summary: entry.summary ?? undefined,
			feeds: options.feeds,
			noModelText: !modelMayRead
		}))
	};
}

/** Reports the addresses in a sitemap (following an index one level) whose lastmod is newer than last time. */
export async function readSitemapChanges(context: CheckContext, address: string, options: { feeds?: Feed[]; keep?: (address: string) => boolean; mostSitemaps?: number } = {}): Promise<FoundItem[]> {
	const items: FoundItem[] = [];
	const read = async (sitemapAddress: string) => {
		const { response, modelMayRead } = await context.fetch(sitemapAddress, { accept: 'application/xml, text/xml' });
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`${new URL(sitemapAddress).hostname} answered ${response.status}`);
		}
		return { sitemap: readSitemap(await response.text()), modelMayRead };
	};
	const first = await read(address);
	const sitemaps = first.sitemap.index ? first.sitemap.entries.slice(0, options.mostSitemaps ?? 20).map((entry) => entry.address) : [];
	const lists = first.sitemap.index ? await Promise.all(sitemaps.map(read)) : [first];
	for (const { sitemap, modelMayRead } of lists) {
		for (const entry of sitemap.entries) {
			if (options.keep && !options.keep(entry.address)) continue;
			const memory = await context.pages.read(entry.address);
			if (memory?.lastModified === entry.lastModified) continue;
			await context.pages.write(entry.address, { entityTag: null, lastModified: entry.lastModified, sha256: memory?.sha256 ?? null, captureKey: memory?.captureKey ?? null, status: null, checkedAt: context.now.toISOString() });
			// The first reading of a sitemap only records where things stand.
			if (!memory) continue;
			items.push({ sourceIdentifier: `${entry.address}#${entry.lastModified ?? context.now.toISOString().slice(0, 10)}`, kind: 'sitemap-change', title: entry.address, link: entry.address, date: entry.lastModified?.slice(0, 10), feeds: options.feeds, noModelText: !modelMayRead });
		}
	}
	return items;
}
