// Runs axe-core on every built page, in the light and the dark theme
// (site/DESIGN.md, section 9). Run from site/ after `npm run build`:
//   node tools/check-accessibility.mjs [--pages /,/nations/map | --pages-file pages.txt] [--workers 2] [--shard 1/4]
//
// The prerendered pages are served from the build output by a small local
// server and opened in Chromium through Playwright. Each page is checked
// against the WCAG 2.0, 2.1 and 2.2 level A and AA rules that axe-core
// automates. Automated checks find only part of the problems; the manual
// checks in DESIGN.md section 9 still apply.
//
// Each page is loaded once and checked in both themes: the site's dark theme
// follows the device setting through CSS media queries, so switching the
// emulated color scheme restyles the page in place, as it does in a browser.
//
// The check must never hang the CI job. Every page has an overall time limit;
// a page that runs over it is closed, a fresh tab tries it once more, and a
// second failure is reported as a problem. Requests to other hosts are blocked
// so the page's load event depends only on the build. If no page finishes for
// several minutes the check stops with the pages it was working on.
//
// The pages the Worker answers, and menus and dialogs while open, are checked
// by tools/check-accessibility-live.mjs.
//
// --shard K/N (or ACCESSIBILITY_SHARD) checks every Nth page starting at the
// Kth, so N CI jobs can split the pages between them and finish sooner.
// --pages-file reads the pages to check from a file, one per line; pull
// requests pass the list tools/accessibility-scope.mjs picks.
//
// Set CHROMIUM_PATH to use a Chromium that is already installed. Set
// ACCESSIBILITY_WORKERS (or pass --workers) to change how many pages are
// checked at once; the default leaves one processor for the browser and server.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { axeViolations, describeViolation, themes, waitUntilSettled } from './accessibility-rules.mjs';
import { pagePaths } from './built-pages.mjs';

const output = path.resolve('.svelte-kit/cloudflare/client');

/** Time limits, in milliseconds. */
const limits = {
	// Loading one page. Pages load in well under a second when nothing is wrong.
	navigation: 30_000,
	// After loading, the page counts as settled once nothing in it has changed
	// for this long, or after the longer time at the most.
	settle: 250,
	settleAtMost: 3_000,
	// Everything for one page: loading it and running axe-core in both themes.
	page: 90_000,
	// Closing a tab or the browser, which can stall when the browser is stuck.
	close: 10_000,
	// No page finished in this long: something is stuck, so stop.
	stalled: 5 * 60_000
};
const attemptsPerPage = 2;
// A tab's memory grows with every page it shows (about 30 MB a page here), and
// a tab that runs out of memory crashes. Each tab is replaced after this many
// pages so its memory is given back.
const pagesPerTab = 20;

function argument(name) {
	const index = process.argv.indexOf(name);
	return index > -1 ? process.argv[index + 1] : undefined;
}

const requestedWorkers = Number(argument('--workers') ?? process.env.ACCESSIBILITY_WORKERS);
const workers =
	Number.isInteger(requestedWorkers) && requestedWorkers > 0
		? requestedWorkers
		: Math.min(3, Math.max(1, availableParallelism() - 1));

if (!existsSync(output)) {
	console.error(`${output} does not exist. Run npm run build first.`);
	process.exit(1);
}

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.webmanifest': 'application/manifest+json',
	'.txt': 'text/plain; charset=utf-8'
};

/** The file a path is served from, as Cloudflare serves prerendered pages. */
function fileFor(pathname) {
	const clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
	const candidates =
		clean === '/'
			? ['index.html']
			: [clean.slice(1), `${clean.slice(1)}.html`, `${clean.slice(1)}/index.html`];
	for (const candidate of candidates) {
		const full = path.join(output, candidate);
		if (!full.startsWith(output)) return undefined;
		if (existsSync(full) && statSync(full).isFile()) return full;
	}
	return undefined;
}

/** Rejects with `message` if `promise` has not settled within `milliseconds`. */
function withLimit(promise, milliseconds, message) {
	let timer;
	const limit = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), milliseconds);
	});
	return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

const pagesArgument = argument('--pages');
const pagesFile = argument('--pages-file');
const shardArgument = argument('--shard') ?? process.env.ACCESSIBILITY_SHARD;
const [shardNumber, shardCount] = (shardArgument ?? '1/1').split('/').map(Number);
if (!(shardCount >= 1 && shardNumber >= 1 && shardNumber <= shardCount)) {
	throw new Error(`--shard must look like 2/4, not ${shardArgument}`);
}
const listed = pagesArgument
	? pagesArgument.split(',')
	: pagesFile
		? readFileSync(pagesFile, 'utf8').split('\n').filter(Boolean)
		: pagePaths(output);
const pages = listed.filter(
	(_, index) => index % shardCount === shardNumber - 1
);

const server = createServer(async (request, response) => {
	try {
		const file = fileFor(new URL(request.url, 'http://localhost').pathname);
		if (!file) {
			response.writeHead(404).end();
			return;
		}
		const body = await readFile(file);
		response.writeHead(200, {
			'content-type': types[path.extname(file)] ?? 'application/octet-stream'
		});
		response.end(body);
	} catch {
		if (!response.headersSent) response.writeHead(500);
		response.end();
	}
});
// Keep idle connections open longer than the browser does, so the browser never
// sends a request on a connection the server has just closed.
server.keepAliveTimeout = 120_000;
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(
	process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
// Service workers are blocked so every page is read from the build, not a cache.
const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
context.setDefaultNavigationTimeout(limits.navigation);
context.setDefaultTimeout(limits.navigation);
// Only the local server may answer: a request to another host could hold up
// the load event, and the check should not depend on other sites.
await context.route(
	(url) => url.origin !== base,
	(route) => route.abort('blockedbyclient')
);

const problems = [];
const timings = [];
const inProgress = new Map();
const started = Date.now();
let finished = 0;
let lastFinished = Date.now();

/** Loads one page and runs axe-core on it in each theme. */
async function checkPage(page, pathname) {
	await page.emulateMedia({ colorScheme: themes[0] });
	const response = await page.goto(base + pathname, { waitUntil: 'load' });
	if (!response?.ok()) return [`${pathname}: not a prerendered page in the build`];
	// Some controls (Report a problem, the map's zoom buttons) are added by the
	// page's script just after the load event. Wait until the page stops
	// changing so axe-core sees them, and sees the same page in both themes.
	await waitUntilSettled(page, { quiet: limits.settle, longest: limits.settleAtMost });
	const found = (await axeViolations(page)).map((violation) => describeViolation(pathname, violation));
	return found;
}

async function closeQuietly(page) {
	await withLimit(page.close(), limits.close, 'close timed out').catch(() => {});
}

const queue = [...pages];

async function worker(number) {
	let page = await context.newPage();
	let pagesInTab = 0;
	while (queue.length > 0) {
		if (pagesInTab >= pagesPerTab) {
			await closeQuietly(page);
			page = await context.newPage();
			pagesInTab = 0;
		}
		// Another worker may have taken the last page while this one was opening a tab.
		const pathname = queue.shift();
		if (pathname === undefined) break;
		pagesInTab += 1;
		const pageStarted = Date.now();
		inProgress.set(number, { pathname, since: pageStarted });
		let lastError;
		for (let attempt = 1; attempt <= attemptsPerPage; attempt += 1) {
			try {
				const found = await withLimit(
					checkPage(page, pathname),
					limits.page,
					`took longer than ${limits.page / 1000} s`
				);
				problems.push(...found);
				lastError = undefined;
				break;
			} catch (error) {
				lastError = error;
				console.error(`${pathname}: attempt ${attempt} failed: ${error.message.split('\n')[0]}`);
				// The tab may have crashed or still be busy with the page, so
				// start a fresh one.
				await closeQuietly(page);
				page = await context.newPage();
				pagesInTab = 1;
			}
		}
		if (lastError) {
			problems.push(`${pathname}: could not be checked: ${lastError.message.split('\n')[0]}`);
		}
		timings.push({ pathname, milliseconds: Date.now() - pageStarted });
		inProgress.delete(number);
		finished += 1;
		lastFinished = Date.now();
		if (finished % 100 === 0) {
			const seconds = Math.round((Date.now() - started) / 1000);
			console.log(`${finished} of ${pages.length} pages checked, ${seconds} s.`);
		}
	}
	await closeQuietly(page);
}

const watchdog = setInterval(() => {
	if (Date.now() - lastFinished < limits.stalled) return;
	const stuck = [...inProgress.values()]
		.map(({ pathname, since }) => `${pathname} (${Math.round((Date.now() - since) / 1000)} s)`)
		.join(', ');
	console.error(
		`No page finished in ${limits.stalled / 60_000} minutes; stopping. Still working on: ${stuck || 'nothing'}.`
	);
	process.exit(1);
}, 10_000);

await Promise.all(Array.from({ length: workers }, (_, index) => worker(index)));

clearInterval(watchdog);
await withLimit(browser.close(), limits.close, 'browser close timed out').catch(() => {});
server.closeAllConnections();
server.close();

const seconds = Math.round((Date.now() - started) / 1000);
const slowest = timings
	.sort((a, b) => b.milliseconds - a.milliseconds)
	.slice(0, 5)
	.map(({ pathname, milliseconds }) => `${pathname} ${(milliseconds / 1000).toFixed(1)} s`)
	.join(', ');
if (problems.length > 0) {
	console.error(problems.join('\n'));
	console.error(`\n${problems.length} accessibility problem(s) found by axe-core.`);
	process.exit(1);
}
console.log(
	`Accessibility checked with axe-core: ${pages.length} pages in ${themes.length} themes, ${workers} at a time, ${seconds} s.`
);
console.log(`Slowest pages: ${slowest}.`);
process.exit(0);
