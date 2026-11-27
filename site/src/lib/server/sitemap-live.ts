/**
 * The sitemap's parts as a crawler gets them (src/lib/sitemap.ts): the
 * pages the build listed, less what nations chose to hide, with what changed
 * since the build added from the database. Runs in the Worker.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { filterSitemapEntries } from '../restricted-files.ts';
import { builtIndexPath, builtPartPath, dayOf, essaysPart, latestDay, withNationChanges, type BuiltSitemapIndex, type BuiltSitemapPart, type SitemapEntry } from '../sitemap.ts';
import { essayPath, listEssays } from './essays.ts';
import { siteRestrictions } from './site-restrictions.ts';

type Assets = { fetch(request: Request | string): Promise<Response> };

/** The day each nation's page last changed by its own team's published changes (src/lib/server/nation-page-changes.ts), live by now. */
export async function nationChangeDays(database: D1Database | undefined, time = new Date().toISOString()): Promise<Map<string, string>> {
	if (!database) return new Map();
	try {
		const { results } = await database
			.prepare("SELECT nation_identifier AS nation, MAX(live_at) AS live FROM nation_page_changes WHERE status = 'published' AND live_at <= ? GROUP BY nation_identifier")
			.bind(time)
			.all<{ nation: string; live: string | null }>();
		return new Map(results.flatMap((row) => (dayOf(row.live) ? [[row.nation, dayOf(row.live)!] as [string, string]] : [])));
	} catch (problem) {
		console.error('Nation page changes could not be read for the sitemap', problem);
		return new Map();
	}
}

/** The published essays, foundations and back matter, each dated by its newest listed publication. The About pages are in the build's own list. */
export async function essayEntries(database: D1Database | undefined): Promise<SitemapEntry[]> {
	if (!database) return [];
	try {
		return (await listEssays(database))
			.filter((essay) => essay.published && essay.part !== 'about')
			.map((essay) => ({ path: essayPath(essay.identifier, essay.part), ...(dayOf(essay.published!.publishedAt) ? { lastmod: dayOf(essay.published!.publishedAt) } : {}) }));
	} catch (problem) {
		console.error('Essays could not be read for the sitemap', problem);
		return [];
	}
}

async function builtJson<T>(assets: Assets, origin: string, path: string): Promise<T | undefined> {
	const response = await assets.fetch(new URL(path, origin).toString());
	if (!response.ok) {
		await response.body?.cancel();
		return undefined;
	}
	return (await response.json()) as T;
}

/** The index's parts: the build's, with each one's newest date moved by nations' own changes, and the essays when any are published. */
export async function livePartList(database: D1Database | undefined, assets: Assets, origin: string): Promise<{ name: string; lastmod?: string }[] | undefined> {
	const built = await builtJson<BuiltSitemapIndex>(assets, origin, builtIndexPath);
	if (!built) return undefined;
	const nations = latestDay([...(await nationChangeDays(database)).values()]);
	const parts: { name: string; lastmod?: string }[] = built.parts.map((part) => {
		const lastmod = part.name === 'nations' ? latestDay([part.lastmod, nations]) : part.lastmod;
		return { name: part.name, ...(lastmod ? { lastmod } : {}) };
	});
	const essays = await essayEntries(database);
	if (essays.length > 0) {
		const lastmod = latestDay(essays.map((entry) => entry.lastmod));
		parts.push({ name: essaysPart, ...(lastmod ? { lastmod } : {}) });
	}
	return parts;
}

/** One part's pages as a crawler gets them, or undefined when there is no such part. */
export async function livePart(name: string, database: D1Database | undefined, assets: Assets, origin: string): Promise<SitemapEntry[] | undefined> {
	if (name === essaysPart) {
		const essays = await essayEntries(database);
		return essays.length > 0 ? essays : undefined;
	}
	const built = await builtJson<BuiltSitemapPart>(assets, origin, builtPartPath(name));
	if (!built) return undefined;
	const restrictions = await siteRestrictions(database, assets, origin);
	const shown = restrictions ? filterSitemapEntries(built.entries, restrictions) : built.entries;
	return withNationChanges(shown, await nationChangeDays(database));
}
