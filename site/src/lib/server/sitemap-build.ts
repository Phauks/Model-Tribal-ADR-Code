/**
 * Lists the pages for the sitemap when the site is built (src/lib/sitemap.ts,
 * docs/sitemap.md). Trevor asked on Nov. 26, 2026 that it keep itself up to
 * date, so it starts from the same lists search does: every item of every
 * collection in the registry (src/lib/server/collections.ts) and every page
 * search finds (src/lib/server/search-index.ts). A new collection, or a new
 * record in one, is in the sitemap from the next build with no change here.
 *
 * What is left out:
 *
 * - Anything the collections leave out: records held for a privacy review
 *   (Tribal court opinions held back or waiting to be redacted, the Interior
 *   Board's probate and minors' decisions, state court opinions about
 *   children and estates), restricted nation records and those waiting for a
 *   nation's approval. They are never in these lists to begin with; the tests
 *   check it (tests/sitemap.test.ts).
 * - Private and signed-in pages (src/lib/private-pages.ts) and tools that
 *   hold nothing to read, such as search itself.
 * - Stubs (src/lib/stubs.ts), only while sitemapLeavesOutStubs
 *   (src/lib/sitemap.ts) says so. They are listed now.
 * - Files, views of a page with a query, and other sites' pages.
 *
 * What nations chose to hide is left out when the sitemap is asked for
 * (src/routes/sitemaps/[part].xml), since the build cannot know it.
 *
 * Each page's date is the newest merged change to the files it is made from
 * (git), or the day its copy was taken; a page with no such file has none.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPrivatePage } from '../private-pages.ts';
import { copyPagePath, copyPagePrefix } from '../public-copies.ts';
import { pageAddressOfFile } from '../page-history.ts';
import { latestDay, splitPart, type BuiltSitemapIndex, type BuiltSitemapPart, type SitemapEntry } from '../sitemap.ts';
import { collections } from './collections.ts';
import { publicCopies, repositoryRoot, sourceFile, sources } from './content.ts';
import { savedCopyFor } from './markdown.ts';
import { pageFiles } from './page-history-build.ts';
import { itemLink, searchIndex } from './search-index.ts';

/** Pages search lists that a search engine should not: each with the reason. */
export const notInSitemap: Record<string, string> = {
	'/search': 'search itself',
	'/starred': 'a reader’s own list, kept on their device',
	'/offline': 'a tool for saving pages, with nothing to read',
	'/verify': 'a tool for checking a downloaded file'
};

/** The parts, in the order the index lists them; a page goes in the first whose test it passes. */
export const sitemapPartTests: { name: string; test: (path: string) => boolean }[] = [
	{ name: 'nations', test: (page) => page === '/nations' || page.startsWith('/nations/') },
	{ name: 'laws', test: (page) => page.startsWith('/laws/') },
	{ name: 'people', test: (page) => /^\/(?:biographies|people|presidents|supreme-court\/justices)(?:\/|$)/.test(page) },
	{ name: 'cases', test: (page) => /^\/(?:cases|courts|supreme-court)(?:\/|$)/.test(page) },
	{ name: 'source-documents', test: (page) => page.startsWith('/copies/') },
	{ name: 'pages', test: () => true }
];

export const partOf = (page: string) => sitemapPartTests.find((part) => part.test(page))!.name;

/**
 * A link as the page it opens, or undefined when it is not a page of this
 * site a search engine should list: another site, a view with a query, a
 * file (a copy's page at /copies/view/ is a page, though its address ends in
 * the file's name), a private page or a tool.
 */
export function sitemapPath(link: string | undefined): string | undefined {
	if (!link || !link.startsWith('/') || link.startsWith('//')) return undefined;
	if (link.includes('?')) return undefined;
	const page = link.split('#')[0] || '/';
	if (!page.startsWith(copyPagePrefix) && /\.[a-z0-9]{1,5}$/i.test(page)) return undefined;
	if (isPrivatePage(page) || notInSitemap[page]) return undefined;
	return page;
}

// ----- When each file last changed -----

/** Reads `git log --format=%x1e%H%x09%cI --name-only` output: the newest day each file changed, leaving out any file whose newest change is a shallow clone's cut-off commit, whose date is not when the file changed. */
export function parseFileDays(log: string, shallow: ReadonlySet<string> = new Set()): Map<string, string> {
	const days = new Map<string, string>();
	const seen = new Set<string>();
	for (const chunk of log.split('\x1e')) {
		const [header, ...files] = chunk.split('\n');
		const [hash, committed] = header.split('\t');
		if (!hash || !committed) continue;
		for (const line of files) {
			const file = line.trim();
			if (!file || seen.has(file)) continue;
			seen.add(file);
			if (!shallow.has(hash)) days.set(file, committed.slice(0, 10));
		}
	}
	return days;
}

let fileDayCache: Map<string, string> | undefined;

/** The newest day each file in content/ changed, from one read of git's log. Empty without git, as in some builds on a computer. */
export function fileDays(): Map<string, string> {
	if (fileDayCache) return fileDayCache;
	try {
		const run = (args: string[]) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 512 * 1024 * 1024 });
		const shallowFile = path.resolve(repositoryRoot, run(['rev-parse', '--git-path', 'shallow']).trim());
		const shallow = new Set(existsSync(shallowFile) ? readFileSync(shallowFile, 'utf8').split('\n').filter(Boolean) : []);
		fileDayCache = parseFileDays(run(['-c', 'core.quotepath=off', 'log', '--first-parent', '--format=%x1e%H%x09%cI', '--name-only', 'HEAD', '--', 'content']), shallow);
	} catch {
		fileDayCache = new Map();
	}
	return fileDayCache;
}

// ----- The pages -----

/** Every address the collections and search reach, before anything is left out. */
export function reachedLinks(): string[] {
	const links: string[] = ['/'];
	for (const collection of collections) {
		for (const item of collection.items()) {
			if (item.href) links.push(item.href);
			const page = itemLink(item);
			if (page) links.push(page);
		}
	}
	for (const entry of searchIndex()) links.push(entry.link);
	return links;
}

/** The files each page is made from, so its date can be found. */
function filesByPage(days: ReadonlyMap<string, string>): Map<string, string[]> {
	const files = new Map<string, string[]>();
	const add = (page: string | undefined, file: string | undefined) => {
		if (page && file) files.set(page, [...(files.get(page) ?? []), file]);
	};
	for (const [file, pages] of pageFiles()) for (const page of pages) add(page, file);
	for (const [key] of sources()) {
		add(`/cases/${key}`, sourceFile(key));
		add(`/laws/${key}`, sourceFile(key));
	}
	// Nations, stories and glossary terms (src/lib/page-history.ts), and biographies.
	for (const file of days.keys()) {
		add(pageAddressOfFile(file), file);
		const biography = /^content\/biographies\/([a-z0-9-]+)\.yaml$/.exec(file);
		if (biography) add(`/biographies/${biography[1]}`, file);
	}
	return files;
}

/** Every page for the sitemap, in the order of the lists it comes from, each once, less any stubs' pages given (src/lib/server/sitemap-files.ts, sitemapLeavesOutStubs). */
export function sitemapEntries(stubs: ReadonlySet<string>): (SitemapEntry & { part: string })[] {
	const pages = [...new Set(reachedLinks().map(sitemapPath).filter((page): page is string => Boolean(page)))].filter((page) => !stubs.has(page));
	const days = fileDays();
	const files = filesByPage(days);
	const copyDays = new Map(publicCopies().map((copy) => [copyPagePath(copy), copy.captured]));
	return pages.map((page) => {
		const record = /^\/(?:cases|laws)\/([^/]+)$/.exec(page);
		const copy = record ? savedCopyFor(sources().get(record[1])) : undefined;
		const lastmod = latestDay([...(files.get(page) ?? []).map((file) => days.get(file)), copyDays.get(page)]);
		return { path: page, part: partOf(page), ...(lastmod ? { lastmod } : {}), ...(copy ? { copy: copyPagePath(copy) } : {}) };
	});
}

/** The parts as the build writes them, each split at the protocol's limit. */
export function sitemapParts(stubs: ReadonlySet<string>, size?: number): BuiltSitemapPart[] {
	const entries = sitemapEntries(stubs);
	return sitemapPartTests.flatMap(({ name }) =>
		splitPart(
			name,
			entries.filter((entry) => entry.part === name).map(({ part: _part, ...entry }) => entry),
			size
		)
	);
}

/** The list of parts the index names, with how many pages each has and its newest date. */
export function sitemapIndexFile(parts: BuiltSitemapPart[], builtAt = new Date()): BuiltSitemapIndex {
	return {
		builtAt: builtAt.toISOString(),
		parts: parts.map((part) => {
			const lastmod = latestDay(part.entries.map((entry) => entry.lastmod));
			return { name: part.name, count: part.entries.length, ...(lastmod ? { lastmod } : {}) };
		})
	};
}
