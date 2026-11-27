import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Story credits format citations through a module the site build makes; the sitemap doesn't need it.
vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));
import { parseCsv } from '#lib/csv.ts';
import { disallowedPrefixes, privatePrefixes, signedInPrefixes } from '#lib/private-pages.ts';
import { copyItemId } from '#lib/nation-restrictions.ts';
import { copyPagePath } from '#lib/public-copies.ts';
import { filterSitemapEntries, type SiteRestrictions } from '#lib/restricted-files.ts';
import { openToSearchEngines, robotsText } from '#lib/search-engines.ts';
import { indexXml, maxEntriesPerPart, sitemapLeavesOutStubs, partNamePattern, splitPart, urlsetXml, withNationChanges, type BuiltSitemapPart, type SitemapEntry } from '#lib/sitemap.ts';
import { collections } from '#lib/server/collections.ts';
import { nationsForReview, publicCopies, repositoryRoot, sources } from '#lib/server/content.ts';
import { itemLink } from '#lib/server/search-index.ts';
import { notInSitemap, parseFileDays, partOf, sitemapIndexFile, sitemapParts, sitemapPath } from '#lib/server/sitemap-build.ts';
import { heldBackOpinionCount } from '#lib/server/tribal-court-opinions.ts';

// Trevor chose on Nov. 26, 2026 to build the sitemap now and keep the site
// closed, and asked that it keep itself up to date (docs/sitemap.md).

const read = (file: string) => readFileSync(path.join(repositoryRoot, file), 'utf8');

/** A page the tests treat as a stub, to check stubs can be left out (sitemapLeavesOutStubs; the build gives the real list, src/lib/server/sitemap-files.ts). */
const stubForTest = '/cases/worcester-v-georgia';

let parts: BuiltSitemapPart[];
let pages: Set<string>;

beforeAll(() => {
	parts = sitemapParts(new Set([stubForTest]));
	pages = new Set(parts.flatMap((part) => part.entries.map((entry) => entry.path)));
	// Reading every record the first time takes a while.
}, 120_000);

describe('the sitemap grows with the collections', () => {
	it('lists every page of every collection, so a new record or collection is in it from the next build', () => {
		const missing: string[] = [];
		for (const collection of collections) {
			for (const item of collection.items()) {
				for (const link of [item.href, itemLink(item)]) {
					const page = sitemapPath(link);
					if (page && page !== stubForTest && !pages.has(page)) missing.push(`${collection.identifier}: ${page}`);
				}
			}
		}
		expect(missing.slice(0, 20)).toEqual([]);
	});

	it('lists the home page and the site’s own pages', () => {
		for (const page of ['/', '/nations', '/nations/map', '/glossary', '/stats', '/supreme-court', '/charter']) expect(pages.has(page), page).toBe(true);
	});

	it('lists each page once, in the part its address belongs to', () => {
		const all = parts.flatMap((part) => part.entries.map((entry) => entry.path));
		expect(new Set(all).size).toBe(all.length);
		for (const part of parts) for (const entry of part.entries) expect(part.name.replace(/-\d+$/, '')).toBe(partOf(entry.path));
	});

	it('keeps every part within the protocol’s limits', () => {
		for (const part of parts) {
			expect(part.name).toMatch(partNamePattern);
			expect(part.entries.length).toBeLessThanOrEqual(maxEntriesPerPart);
			expect(new TextEncoder().encode(urlsetXml('https://triballawproject.org', part.entries)).length).toBeLessThan(50 * 1024 * 1024);
		}
	});

	it('splits a part longer than the limit into numbered parts', () => {
		const entries = Array.from({ length: 5 }, (_, index) => ({ path: `/cases/${index}` }));
		expect(splitPart('cases', entries, 2).map((part) => [part.name, part.entries.length])).toEqual([
			['cases', 2],
			['cases-2', 2],
			['cases-3', 1]
		]);
	});

	it('dates pages by when they last changed, and only with real days', () => {
		const dated = parts.flatMap((part) => part.entries).filter((entry) => entry.lastmod);
		for (const entry of dated) expect(entry.lastmod, entry.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		const index = sitemapIndexFile(parts);
		expect(index.parts.map((part) => part.name)).toEqual(parts.map((part) => part.name));
	});
});

describe('held, restricted and private pages never appear', () => {
	it('leaves out every copy held for a privacy review, and every copy not cleared to share', () => {
		const rows = parseCsv(read('research/capture-index.csv'));
		const held = rows.filter((row) => /held back for a privacy review/i.test(row.rights));
		expect(held.length).toBeGreaterThan(0);
		for (const row of rows.filter((candidate) => candidate.redistribution !== 'yes' || held.includes(candidate))) {
			expect(pages.has(copyPagePath({ key: row.key })), row.key).toBe(false);
		}
	});

	it('leaves out Tribal court opinions held back or waiting to be redacted, and lists the redacted ones only as filed with initials', () => {
		const served = new Set(publicCopies().map((copy) => copy.key));
		const opinions = parseCsv(read('research/tribal-court-opinions/opinions.csv'));
		const held = opinions.filter((row) => !row.copy_key || !served.has(row.copy_key));
		expect(held.length).toBe(heldBackOpinionCount());
		for (const row of held) if (row.copy_key) expect(pages.has(copyPagePath({ key: row.copy_key })), row.copy_key).toBe(false);
		// An opinion that needed names replaced is shown only once the redacted page is filed (scripts/caselaw/redact_opinions.py, "file").
		const filed = new Map(parseCsv(read('research/tribal-court-opinions/redacted.csv')).map((row) => [row.key, row.status]));
		const namesReplaced = new Set(publicCopies().filter((copy) => copy.namesReplaced).map((copy) => copy.key));
		for (const [key, status] of filed) {
			if (status === 'redacted' && pages.has(copyPagePath({ key }))) expect(namesReplaced.has(key), key).toBe(true);
			if (status !== 'redacted' && status !== 'nothing to replace') expect(pages.has(copyPagePath({ key })), key).toBe(false);
		}
	});

	it('lists only copies the site serves', () => {
		const served = new Set(publicCopies().map(copyPagePath));
		for (const page of pages) if (page.startsWith('/copies/')) expect(served.has(page), page).toBe(true);
	});

	it('leaves out the Interior Board’s decisions held back (probate appeals and minors)', () => {
		const held = new Set(parseCsv(read('research/ibia/held-back.csv')).map((row) => row.citation));
		expect(held.size).toBeGreaterThan(0);
		for (const record of sources().values()) {
			const citation = record.citation as { 'container-title'?: string; volume?: string; page?: string };
			if (citation['container-title'] !== 'IBIA') continue;
			const cite = `${citation.volume} IBIA ${citation.page}`;
			if (held.has(cite)) expect(pages.has(`/cases/${record.key}`), cite).toBe(false);
		}
	});

	it('lists no state court opinion whose caption names a child or protected person', () => {
		// The words scripts/caselaw/state_court_opinions.py holds a case for, less the estate words, since estate cases are shown (Trevor, Nov. 26, 2026).
		const childCaption = /\b(?:adoption|custody|guardianship|welfare of|interest of|dependency|dependent|neglected|delinquen|juvenile|minor|child(?:ren)?|infant|parental rights|paternity|protective order|protection order|commitment of|mental health|incompeten)\b/i;
		const listed = [...sources().values()].filter((record) => (record.topics ?? []).includes('state-court-indian-law') && pages.has(`/cases/${record.key}`));
		expect(listed.length).toBeGreaterThan(0);
		expect(listed.filter((record) => childCaption.test(record.citation.title ?? '')).map((record) => record.key)).toEqual([]);
	});

	it('leaves out nations that are restricted or still wait for the nation’s approval', () => {
		const published = new Set(nationsForReview().filter((nation) => nation.published).map((nation) => nation.id));
		for (const nation of nationsForReview().filter((nation) => !nation.published)) expect(pages.has(`/nations/${nation.id}`), nation.id).toBe(false);
		for (const page of pages) {
			const nation = /^\/nations\/([a-z0-9-]+)$/.exec(page)?.[1];
			if (nation && nationsForReview().some((candidate) => candidate.id === nation)) expect(published.has(nation), nation).toBe(true);
		}
	});

	it('leaves out every private and signed-in page', () => {
		for (const page of pages) {
			for (const prefix of [...privatePrefixes, ...signedInPrefixes]) expect(page === prefix || page.startsWith(`${prefix}/`), page).toBe(false);
		}
		for (const page of Object.keys(notInSitemap)) expect(pages.has(page), page).toBe(false);
	});

	it('can leave out stubs, and leaves out files, views with a query and other sites', () => {
		expect(pages.has(stubForTest)).toBe(false);
		// Stubs are listed (docs/sitemap.md, "Stubs"); the switch takes them out.
		expect(sitemapLeavesOutStubs).toBe(false);
		expect(sitemapParts(new Set()).some((part) => part.entries.some((entry) => entry.path === stubForTest))).toBe(true);
		expect(sitemapPath('/nations/map?cession=1')).toBeUndefined();
		expect(sitemapPath('/copies/historic-maps/royce-1899/ca000001.jpg')).toBeUndefined();
		expect(sitemapPath('https://www.bia.gov/')).toBeUndefined();
		expect(sitemapPath('//example.org/')).toBeUndefined();
		expect(sitemapPath('/copies/view/constitutions/catawba-indian-nation/2b820c66ebb60487.pdf')).toBe('/copies/view/constitutions/catawba-indian-nation/2b820c66ebb60487.pdf');
		expect(sitemapPath('/nations/navajo-nation#document-constitution')).toBe('/nations/navajo-nation');
		expect(sitemapPath('/workspace/inbox')).toBeUndefined();
	});

	it('leaves out what a nation hid or asked to cite only, when asked for', () => {
		const copies = parts.find((part) => part.name === 'source-documents')!.entries;
		const [hidden, cited, kept] = copies;
		const withCopy = parts.flatMap((part) => part.entries).find((entry) => entry.copy && entry.copy !== hidden.path)!;
		const restrictions: SiteRestrictions = {
			stamp: 'test',
			levels: new Map([
				[copyItemId(hidden.path), 'hide'],
				[copyItemId(cited.path), 'cite'],
				[copyItemId(withCopy.copy!), 'hide']
			]),
			items: new Map(),
			hiddenDocuments: new Set()
		};
		const shown = new Set(filterSitemapEntries(parts.flatMap((part) => part.entries), restrictions).map((entry) => entry.path));
		expect(shown.has(hidden.path)).toBe(false);
		expect(shown.has(cited.path)).toBe(false);
		expect(shown.has(withCopy.path)).toBe(false);
		expect(shown.has(kept.path)).toBe(true);
		expect(shown.has('/nations')).toBe(true);
	});
});

describe('the XML', () => {
	it('writes full addresses, escaped, with dates only where known', () => {
		const xml = urlsetXml('https://triballawproject.org/', [{ path: '/a?b&c' }, { path: '/d', lastmod: '2026-11-26', copy: '/copies/view/x.pdf' }]);
		expect(xml).toContain('<loc>https://triballawproject.org/a?b&amp;c</loc></url>');
		expect(xml).toContain('<url><loc>https://triballawproject.org/d</loc><lastmod>2026-11-26</lastmod></url>');
		expect(xml).not.toContain('x.pdf');
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
	});

	it('writes an index of the parts', () => {
		const xml = indexXml('https://triballawproject.org', [{ name: 'nations', lastmod: '2026-11-26' }, { name: 'essays' }]);
		expect(xml).toContain('<sitemap><loc>https://triballawproject.org/sitemaps/nations.xml</loc><lastmod>2026-11-26</lastmod></sitemap>');
		expect(xml).toContain('<sitemap><loc>https://triballawproject.org/sitemaps/essays.xml</loc></sitemap>');
	});

	it('moves a nation’s date when its own team publishes a change', () => {
		const entries: SitemapEntry[] = [{ path: '/nations/navajo-nation', lastmod: '2026-11-20' }, { path: '/nations/hopi-tribe', lastmod: '2026-11-25' }, { path: '/glossary/tribe' }];
		const changed = new Map([
			['navajo-nation', '2026-11-26'],
			['hopi-tribe', '2026-11-01']
		]);
		expect(withNationChanges(entries, changed)).toEqual([{ path: '/nations/navajo-nation', lastmod: '2026-11-26' }, { path: '/nations/hopi-tribe', lastmod: '2026-11-25' }, { path: '/glossary/tribe' }]);
	});
});

describe('dates from git', () => {
	it('takes each file’s newest change, and no date from a shallow clone’s cut-off commit', () => {
		const log = ['', 'aaa\t2026-11-26T10:00:00+00:00\ncontent/tribes/n/navajo-nation.yaml\n', 'bbb\t2026-11-20T10:00:00+00:00\ncontent/tribes/n/navajo-nation.yaml\ncontent/tribes/h/hopi-tribe.yaml\n', 'ccc\t2026-11-01T10:00:00+00:00\ncontent/glossary/tribe.yaml\n'].join('\x1e');
		const days = parseFileDays(log, new Set(['ccc']));
		expect(days.get('content/tribes/n/navajo-nation.yaml')).toBe('2026-11-26');
		expect(days.get('content/tribes/h/hopi-tribe.yaml')).toBe('2026-11-20');
		expect(days.has('content/glossary/tribe.yaml')).toBe(false);
	});
});

describe('closed to search engines until the first release', () => {
	it('is closed now (open it at the first release: docs/sitemap.md)', () => {
		expect(openToSearchEngines).toBe(false);
	});

	it('closed, asks every crawler to stay out and keeps the Sitemap line commented out', () => {
		const text = robotsText('https://triballawproject.org', disallowedPrefixes(), false);
		expect(text).toMatch(/^User-agent: \*\nDisallow: \/$/m);
		expect(text).toContain('# Sitemap: https://triballawproject.org/sitemap.xml');
		expect(text).not.toMatch(/^Sitemap:/m);
	});

	it('open, lets crawlers in except for private and signed-in pages, and names the sitemap', () => {
		const text = robotsText('https://triballawproject.org/', disallowedPrefixes(), true);
		expect(text).not.toMatch(/^Disallow: \/$/m);
		expect(text).toMatch(/^Sitemap: https:\/\/triballawproject\.org\/sitemap\.xml$/m);
		for (const prefix of [...privatePrefixes, ...signedInPrefixes]) {
			const covered = disallowedPrefixes().some((disallowed) => prefix === disallowed || prefix.startsWith(`${disallowed}/`));
			expect(covered, prefix).toBe(true);
		}
		expect(text).toContain('Disallow: /workspace\n');
		expect(text).not.toContain('Disallow: /sponsorship/invite');
	});
});
