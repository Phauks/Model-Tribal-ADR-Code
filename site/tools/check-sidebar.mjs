// Checks the left sidebar in a browser (src/lib/components/SiteSidebar.svelte):
// what it lists inside a section, remembered sections, a list that fails to
// load, the phone menu, a hidden sidebar and the page without JavaScript. Run
// from site/ after `npm run build`:
//   node tools/check-sidebar.mjs
//
// The prerendered pages are served from the build output, as Cloudflare serves
// them, and opened in Chromium through Playwright. Set CHROMIUM_PATH to use a
// Chromium that is already installed.

import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const output = path.resolve('.svelte-kit/cloudflare/client');
const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2'
};

function fileFor(pathname) {
	const clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
	const candidates = clean === '/' ? ['index.html'] : [clean.slice(1), `${clean.slice(1)}.html`, `${clean.slice(1)}/index.html`];
	for (const candidate of candidates) {
		const full = path.join(output, candidate);
		if (!full.startsWith(output)) return undefined;
		if (existsSync(full) && statSync(full).isFile()) return full;
	}
	return undefined;
}

const server = createServer(async (request, response) => {
	const file = fileFor(new URL(request.url, 'http://localhost').pathname);
	if (!file) return response.writeHead(404).end();
	response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
	response.end(await readFile(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
const check = (condition, message) => {
	if (!condition) problems.push(message);
};

async function newPage(options = {}) {
	const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 }, ...options });
	await context.route((url) => url.origin !== base, (route) => route.abort());
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	return { context, page, errors };
}

const wide = '.sidebar-wide';
const sidebarRequests = (page) => {
	const seen = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/sidebar/')) seen.push(request.url());
	});
	return seen;
};

// 1. Inside a section: the section's pages stay, and a nation's page sits under Directory.
{
	const { context, page, errors } = await newPage();
	await page.goto(`${base}/nations/navajo-nation`, { waitUntil: 'networkidle' });
	const links = await page.locator(`${wide} .sections > li.current .outline[data-depth='1'] > li > .entry > a`).evaluateAll((list) => list.map((a) => a.getAttribute('href')));
	check(links.includes('/nations') && links.includes('/nations/map'), `Nations pages missing on a nation's page: ${links.join(', ')}`);
	const current = await page.locator(`${wide} a[aria-current='page']`).first().getAttribute('href');
	check(current === '/nations/navajo-nation', `The nation's page is not marked as current: ${current}`);
	check(errors.length === 0, `Errors on a nation's page: ${errors.join('; ')}`);
	await context.close();
}

// 2. A remembered section opens on the next page, with one request for its list.
{
	const { context, page, errors } = await newPage();
	const requests = sidebarRequests(page);
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	await page.evaluate(() => localStorage.setItem('sidebar-open-sections', JSON.stringify({ '/library': true, '/glossary': false })));
	requests.length = 0;
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForTimeout(500);
	const library = page.locator(wide).getByRole('button', { name: 'Pages in Library' });
	const glossary = page.locator(wide).getByRole('button', { name: 'Pages in Glossary' });
	check((await library.getAttribute('aria-expanded')) === 'true', 'A remembered open section did not open');
	check((await glossary.getAttribute('aria-expanded')) === 'false', 'A remembered shut section (the one being read) did not stay shut');
	check(requests.length === 1, `Expected one request for the Library list, saw ${requests.length}`);
	check(errors.length === 0, `Errors with remembered sections: ${errors.join('; ')}`);
	await context.close();
}

// 3. A list that fails to load says so, is fetched once, and again only when reopened.
{
	const { context, page, errors } = await newPage();
	await context.route(`${base}/sidebar/**`, (route) => route.fulfill({ status: 500, body: '' }));
	const requests = sidebarRequests(page);
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	const nations = page.locator(wide).getByRole('button', { name: 'Pages in Nations' });
	await nations.click();
	await page.waitForTimeout(800);
	check(await page.locator(`${wide} .pages-note`).filter({ hasText: 'Could not load' }).isVisible(), 'A failed list does not say so');
	check(requests.length === 1, `A failed list was fetched ${requests.length} times`);
	await nations.click();
	await nations.click();
	await page.waitForTimeout(500);
	check(requests.length === 2, `Reopening a failed list should fetch it once more, saw ${requests.length} requests`);
	check(errors.length === 0, `Errors with a failed list: ${errors.join('; ')}`);
	await context.close();
}

// 4. Phones: the menu closes when a link in it is chosen, and on Escape.
{
	const { context, page } = await newPage({ viewport: { width: 390, height: 844 } });
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	const menu = page.locator('.sidebar-narrow');
	await menu.locator('summary').click();
	check(await menu.evaluate((element) => element.open), 'The phone menu did not open');
	await page.keyboard.press('Escape');
	check(!(await menu.evaluate((element) => element.open)), 'Escape did not close the phone menu');
	await menu.locator('summary').click();
	await menu.locator('.sections a[href="/nations"]').click();
	await page.waitForURL(`${base}/nations`);
	await page.waitForTimeout(300);
	check(!(await menu.evaluate((element) => element.open)), 'The phone menu stayed open after choosing a page');
	await menu.locator('summary').click();
	const fold = menu.getByRole('button', { name: 'Pages in Library' });
	const box = await fold.boundingBox();
	check(box && box.width >= 44 && box.height >= 44, `A phone caret is smaller than 44 px: ${JSON.stringify(box)}`);
	await context.close();
}

// 5. A hidden sidebar stays hidden from the first paint.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	await page.evaluate(() => localStorage.setItem('sidebar-hidden', 'true'));
	await page.reload({ waitUntil: 'commit' });
	await page.waitForSelector(`${wide} > nav`, { state: 'attached' });
	const shownEarly = await page.locator(`${wide} > nav`).isVisible();
	check(!shownEarly, 'A hidden sidebar showed before the script ran');
	await context.close();
}

// 6. Without JavaScript: no carets, and the section being read shows its pages.
{
	const { context, page } = await newPage({ javaScriptEnabled: false });
	await page.goto(`${base}/nations/map`, { waitUntil: 'load' });
	check((await page.locator(`${wide} button.fold`).filter({ visible: true }).count()) === 0, 'Carets show without JavaScript');
	check(await page.locator(`${wide} a[href='/nations/recourse']`).isVisible(), 'The section being read is shut without JavaScript');
	await context.close();
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} sidebar problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log('The sidebar passed every check.');
