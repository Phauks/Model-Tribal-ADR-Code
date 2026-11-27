// Decides which prerendered pages the accessibility check opens for a pull
// request or a push, so it checks the pages the change can affect instead of
// all of them. The nightly run and runs started by hand still check every
// page (.github/workflows/checks.yml).
//
//   node site/tools/accessibility-scope.mjs < changed-files.txt
//     prints the scope for the changed files (one path per line, relative to
//     the repository root): "all", or "sample" followed by what to add to the
//     sample, such as "sample page:/glossary/* tree:/nations/map record:/nations/*=karuk-tribe".
//
//   node tools/accessibility-scope.mjs --pick "<scope>" --out <file>   (from site/, after the build)
//     writes the pages the scope covers to <file>, one per line, and prints
//     how many there are.
//
// Every scope checks a sample of every kind of page: each top-level page, and
// four pages of each folder of pages (the first, the middle, the last and the
// largest), so a change to the layout, a shared component or the colors is
// checked on every page template in both themes. On top of the sample:
//
// - a changed route file adds the pages it renders: a +page file the pages of
//   its route ("page:"), any other file in a route folder every page under it
//   ("tree:"). A route with more than 150 pages adds 150 spread evenly through
//   it and its 10 largest pages, so a change to the nation page template
//   checks about 160 of the 976 nation pages, not all of them;
// - a changed content/ record adds its own page in the families that show
//   that folder ("record:");
// - a change to the check or its rules checks every page.

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pagePaths } from './built-pages.mjs';

/** Files whose change can change what the check reports on any page. */
const everyPage = ['site/tools/accessibility-rules.mjs', 'site/tools/check-accessibility.mjs', 'site/tools/built-pages.mjs'];

/**
 * The page addresses that show the records of each content/ folder, as route
 * patterns ("*" is one segment). A record's page is the one whose last segment
 * is the record's file name. Folders not listed are covered by the sample and
 * the nightly run.
 */
/** @type {Record<string, string[]>} */
const recordPages = {
	tribes: ['/nations/*'],
	glossary: ['/glossary/*'],
	stories: ['/stories/*'],
	forms: ['/forms/*'],
	essays: ['/essays/*', '/published-essays/*'],
	biographies: ['/biographies/*'],
	'supreme-court': ['/supreme-court/*'],
	law: ['/laws/*']
};

/** More changed records than this in one folder check the folder's routes instead. */
const mostRecords = 100;
/** A route with more pages than this is checked on a spread of them. */
const mostPagesPerRoute = 150;
const largestPagesPerRoute = 10;

/**
 * The route pattern of a folder under site/src/routes: groups dropped, parameters as "*".
 * @param {string} folder
 */
function routePattern(folder) {
	const segments = folder
		.split('/')
		.filter((segment) => segment && !/^\(.*\)$/.test(segment))
		.map((segment) => (/^\[\.\.\..*\]$/.test(segment) ? '**' : /\[.*\]/.test(segment) ? '*' : segment));
	return `/${segments.join('/')}`;
}

/**
 * The scope for a list of changed files.
 * @param {string[]} files
 * @returns {string}
 */
export function scopeFor(files) {
	/** @type {Set<string>} */
	const additions = new Set();
	/** @type {Map<string, Set<string>>} */
	const records = new Map();
	for (const file of files) {
		if (everyPage.includes(file)) return 'all';
		const route = /^site\/src\/routes\/(.*)$/.exec(file);
		if (route) {
			const folder = path.posix.dirname(route[1]);
			const pattern = routePattern(folder === '.' ? '' : folder);
			const base = path.posix.basename(route[1]);
			// The root layout and files beside it are on every page: the sample covers them.
			if (pattern === '/' && !base.startsWith('+page')) continue;
			additions.add(`${base.startsWith('+page') ? 'page' : 'tree'}:${pattern}`);
			continue;
		}
		const content = /^content\/([^/]+)\/(?:.*\/)?([^/]+)\.(?:ya?ml|md)$/.exec(file);
		if (content && recordPages[content[1]]) {
			if (!records.has(content[1])) records.set(content[1], new Set());
			records.get(content[1])?.add(content[2]);
		}
	}
	for (const [folder, names] of records) {
		for (const pattern of recordPages[folder]) {
			if (names.size > mostRecords) additions.add(`page:${pattern}`);
			else for (const name of names) additions.add(`record:${pattern}=${name}`);
		}
	}
	return ['sample', ...[...additions].sort()].join(' ');
}

/**
 * Whether a page matches a route pattern, exactly or (for a tree) anywhere under it.
 * @param {string} page
 * @param {string} pattern
 * @param {{ tree?: boolean }} [options]
 */
function matches(page, pattern, { tree = false } = {}) {
	const want = pattern.split('/').filter(Boolean);
	const have = page.split('/').filter(Boolean);
	for (let index = 0; index < want.length; index += 1) {
		if (want[index] === '**') return true;
		if (index >= have.length) return false;
		if (want[index] !== '*' && want[index] !== have[index]) return false;
	}
	return tree ? true : have.length === want.length;
}

/**
 * The folder a page sits in, or the page itself for a top-level page.
 * @param {string} page
 */
function folderOf(page) {
	const cut = page.lastIndexOf('/');
	return cut <= 0 ? page : page.slice(0, cut);
}

/**
 * The pages a scope covers, from the built pages under `output`.
 * @param {string} scope
 * @param {string} output
 * @returns {string[]}
 */
export function pagesFor(scope, output) {
	const all = pagePaths(output);
	const [kind, ...additions] = scope.trim().split(/\s+/);
	if (kind === 'all') return all;
	if (kind !== 'sample') throw new Error(`Unknown accessibility scope "${scope}"`);

	/** @type {Map<string, number>} */
	const sizes = new Map();
	/** @param {string} page */
	const size = (page) => {
		if (!sizes.has(page)) {
			let found = 0;
			for (const candidate of page === '/' ? ['index.html'] : [`${page.slice(1)}.html`, `${page.slice(1)}/index.html`]) {
				try {
					found = statSync(path.join(output, candidate)).size;
					break;
				} catch {
					// Try the next way the page can be written.
				}
			}
			sizes.set(page, found);
		}
		return sizes.get(page) ?? 0;
	};
	/** @param {string[]} pages @param {number} count */
	const largest = (pages, count) => [...pages].sort((a, b) => size(b) - size(a)).slice(0, count);

	/** @type {Set<string>} */
	const chosen = new Set();
	/** @type {Map<string, string[]>} */
	const folders = new Map();
	for (const page of all) {
		const folder = folderOf(page);
		if (!folders.has(folder)) folders.set(folder, []);
		folders.get(folder)?.push(page);
	}
	for (const pages of folders.values()) {
		if (pages.length <= 4) {
			for (const page of pages) chosen.add(page);
			continue;
		}
		chosen.add(pages[0]);
		chosen.add(pages[Math.floor(pages.length / 2)]);
		chosen.add(pages[pages.length - 1]);
		chosen.add(largest(pages, 1)[0]);
	}

	for (const addition of additions) {
		const [type, rest] = addition.split(/:(.*)/s);
		if (type === 'record') {
			const [pattern, name] = rest.split('=');
			for (const page of all) if (matches(page, pattern) && page.endsWith(`/${name}`)) chosen.add(page);
			continue;
		}
		if (type !== 'page' && type !== 'tree') throw new Error(`Unknown accessibility scope part "${addition}"`);
		const pages = all.filter((page) => matches(page, rest, { tree: type === 'tree' }));
		if (pages.length <= mostPagesPerRoute) {
			for (const page of pages) chosen.add(page);
			continue;
		}
		const step = pages.length / mostPagesPerRoute;
		for (let index = 0; index < mostPagesPerRoute; index += 1) chosen.add(pages[Math.floor(index * step)]);
		for (const page of largest(pages, largestPagesPerRoute)) chosen.add(page);
	}
	return all.filter((page) => chosen.has(page));
}

/** @param {string} name */
function argument(name) {
	const index = process.argv.indexOf(name);
	return index > -1 ? process.argv[index + 1] : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const pick = argument('--pick');
	if (pick === undefined) {
		const files = readFileSync(0, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
		console.log(scopeFor(files));
	} else {
		const pages = pagesFor(pick, path.resolve('.svelte-kit/cloudflare/client'));
		const out = argument('--out');
		if (out) writeFileSync(out, `${pages.join('\n')}\n`);
		console.log(pages.length);
	}
}
