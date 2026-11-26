/**
 * The sitemap (https://www.sitemaps.org/protocol.html): an index at
 * /sitemap.xml naming one file per part of the site, /sitemaps/<part>.xml,
 * each listing at most 50,000 pages, the protocol's limit for one file. The
 * build lists the pages (src/lib/server/sitemap-build.ts) into files the
 * Worker reads, and the Worker writes the XML when a crawler asks
 * (src/routes/sitemap.xml, src/routes/sitemaps/[part].xml), after leaving out
 * what nations chose to hide and adding what changed since the build:
 * published essays and nations' own page changes. docs/sitemap.md has the
 * whole design.
 *
 * Everything here is pure, so the tests can run it on the files as built.
 */

/** One page: its address on the site and, when known, the day it last changed (YYYY-MM-DD). */
export interface SitemapEntry {
	path: string;
	lastmod?: string;
	/** The copy a case's or law's page shows (/copies/view/…), so a nation hiding that copy takes the page out too. Never written into the XML. */
	copy?: string;
}

/** One part as the build writes it, at /sitemaps/built/<part>.json. */
export interface BuiltSitemapPart {
	name: string;
	entries: SitemapEntry[];
}

/** The parts the build wrote, at /sitemaps/built/parts.json. */
export interface BuiltSitemapIndex {
	builtAt: string;
	parts: { name: string; count: number; lastmod?: string }[];
}

/** The protocol's limit on addresses in one file. */
export const maxEntriesPerPart = 50_000;

/** Published essays, foundations and back matter, read from the database when asked for: whether an essay is published is not known when the site is built. */
export const essaysPart = 'essays';

export const sitemapPartPath = (name: string) => `/sitemaps/${name}.xml`;
export const builtPartPath = (name: string) => `/sitemaps/built/${name}.json`;
export const builtIndexPath = '/sitemaps/built/parts.json';

/** A part's name: lower-case words and an optional number, such as "cases" or "cases-2". */
export const partNamePattern = /^[a-z]+(?:-[a-z]+)*(?:-\d+)?$/;

const xmlEscapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escaped = (text: string) => text.replace(/[&<>"']/g, (character) => xmlEscapes[character]);

/** The newest of some days, or undefined when none is known. */
export function latestDay(days: (string | undefined | null)[]): string | undefined {
	let latest: string | undefined;
	for (const day of days) if (day && (!latest || day > latest)) latest = day;
	return latest;
}

/** The day of an ISO 8601 time, such as "2026-11-26" for "2026-11-26T20:06:25+00:00". */
export function dayOf(time: string | undefined | null): string | undefined {
	return time && /^\d{4}-\d{2}-\d{2}/.test(time) ? time.slice(0, 10) : undefined;
}

/** One part's XML: each page's full address and, when known, when it last changed. */
export function urlsetXml(origin: string, entries: SitemapEntry[]): string {
	const site = origin.replace(/\/+$/, '');
	const lines = entries.map((entry) => `<url><loc>${escaped(site + entry.path)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}</url>`);
	return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...lines, '</urlset>', ''].join('\n');
}

/** The index's XML: each part's full address and, when known, when its newest page changed. */
export function indexXml(origin: string, parts: { name: string; lastmod?: string }[]): string {
	const site = origin.replace(/\/+$/, '');
	const lines = parts.map((part) => `<sitemap><loc>${escaped(site + sitemapPartPath(part.name))}</loc>${part.lastmod ? `<lastmod>${part.lastmod}</lastmod>` : ''}</sitemap>`);
	return ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...lines, '</sitemapindex>', ''].join('\n');
}

/** The nation a page is about, for /nations/<id>, so a nation's own published changes can move its date. */
export function nationOfPath(path: string): string | undefined {
	return /^\/nations\/([a-z0-9-]+)$/.exec(path)?.[1];
}

/** Each nation's page dated by the newest of its built date and its own published changes (day per nation). */
export function withNationChanges(entries: SitemapEntry[], changed: ReadonlyMap<string, string>): SitemapEntry[] {
	if (changed.size === 0) return entries;
	return entries.map((entry) => {
		const nation = nationOfPath(entry.path);
		const day = nation ? changed.get(nation) : undefined;
		const lastmod = latestDay([entry.lastmod, day]);
		return lastmod === entry.lastmod ? entry : { ...entry, lastmod };
	});
}

/** Splits a list into parts of at most `size`: "cases", then "cases-2" and on when it is longer. */
export function splitPart(name: string, entries: SitemapEntry[], size = maxEntriesPerPart): BuiltSitemapPart[] {
	const parts: BuiltSitemapPart[] = [];
	for (let start = 0; start < entries.length; start += size) {
		const number = start / size + 1;
		parts.push({ name: number === 1 ? name : `${name}-${number}`, entries: entries.slice(start, start + size) });
	}
	return parts;
}
