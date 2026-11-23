// Checks the left sidebar in a browser (src/lib/components/SiteSidebar.svelte):
// the sections alone in the first column, the section's pages in the second,
// its filter, nothing loaded after the page, the phone menu, a hidden sidebar
// and the page without JavaScript. Run
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
const column = `${wide} .pages-column .pages-scroll`;

// 1. A nation's page: the section's panel lies over the sections and lists
//    the Nations pages and every nation, with this one marked.
{
	const { context, page, errors } = await newPage();
	const requests = [];
	page.on('request', (request) => {
		// Lists the page itself asks for, such as the timeline's published
		// Foundations essays, are not the sidebar's.
		const { pathname } = new URL(request.url());
		if (pathname.endsWith('.json') && pathname !== '/foundations/published.json') requests.push(request.url());
	});
	await page.goto(`${base}/nations/navajo-nation`, { waitUntil: 'networkidle' });
	check((await page.locator(`${wide} .sections-column .outline`).count()) === 0, 'The list of sections lists pages inside a section');
	check((await page.locator(`${wide} .sections-column .sections button.fold`).count()) === 0, 'The list of sections has carets');
	check(!(await page.locator(`${wide} .sections-column`).isVisible()), 'The list of sections shows beside the section\'s panel');
	check(await page.locator(column).isVisible(), 'The section\'s panel does not show');
	const pages = await page.locator(`${column} > ul.outline > li > .entry > a`).evaluateAll((list) => list.map((a) => a.getAttribute('href')));
	check(['/nations', '/nations/map', '/nations/timeline', '/nations/recourse', '/nations/data'].every((link) => pages.includes(link)), `Nations pages missing from the second column: ${pages.join(', ')}`);
	const nations = await page.locator(`${column} .entries a[href^='/nations/']`).count();
	check(nations > 500, `The second column lists ${nations} nations`);
	const current = await page.locator(`${column} a[aria-current='page']`).first().getAttribute('href');
	check(current === '/nations/navajo-nation', `The nation's page is not marked as current: ${current}`);
	check(await page.locator(`${column} a[aria-current='page']`).first().isVisible(), 'The nation being read is not in view in the second column');
	check(requests.length === 0, `The sidebar loaded ${requests.join(', ')} after the page`);
	check(errors.length === 0, `Errors on a nation's page: ${errors.join('; ')}`);
	await context.close();
}

// 2. The filter keeps the entries whose names hold every word typed.
{
	const { context, page, errors } = await newPage();
	await page.goto(`${base}/nations/map`, { waitUntil: 'networkidle' });
	await page.locator(`${column} input[type='search']`).fill('navajo');
	const shown = await page.locator(`${column} .entries a`).evaluateAll((list) => list.map((a) => a.textContent.trim()));
	check(shown.length > 0 && shown.every((name) => /navajo/i.test(name)), `The filter shows ${shown.join(', ')}`);
	await page.locator(`${column} input[type='search']`).fill('zzzz');
	check(await page.locator(`${column} .none`).isVisible(), 'A filter with no matches does not say so');
	check(errors.length === 0, `Errors while filtering: ${errors.join('; ')}`);
	await context.close();
}

// 3. Outside a section there is no second column.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/charter`, { waitUntil: 'networkidle' });
	check((await page.locator(column).count()) === 0, 'A page outside the sections has a second column');
	await context.close();
}

// 4. Phones: the menu opens on the section's pages, switches to all the
//    sections, and closes when a link is chosen and on Escape.
{
	const { context, page } = await newPage({ viewport: { width: 390, height: 844 } });
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	const menu = page.locator('.sidebar-narrow');
	await menu.locator('summary').click();
	check(await menu.evaluate((element) => element.open), 'The phone menu did not open');
	check(await menu.locator('.phone-column a[href^="/glossary/"]').first().isVisible(), 'The phone menu does not open on the section’s pages');
	await page.keyboard.press('Escape');
	check(!(await menu.evaluate((element) => element.open)), 'Escape did not close the phone menu');
	await menu.locator('summary').click();
	await menu.getByRole('button', { name: 'All sections' }).click();
	await menu.locator('.sections > li > a[href="/nations"]').click();
	await page.waitForURL(`${base}/nations`);
	await page.waitForTimeout(300);
	check(!(await menu.evaluate((element) => element.open)), 'The phone menu stayed open after choosing a page');
	await menu.locator('summary').click();
	const box = await menu.getByRole('button', { name: 'All sections' }).boundingBox();
	check(box && box.height >= 44, `The phone menu's switch is smaller than 44 px: ${JSON.stringify(box)}`);
	await context.close();
}

// 4b. "All sections" goes out of a section's panel to the sections, and the caret beside the section goes back in.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/nations/map`, { waitUntil: 'networkidle' });
	await page.locator(`${wide} .pages-column button.back`).click();
	check(await page.locator(`${wide} .sections-column`).isVisible(), '"All sections" does not show the sections');
	check(!(await page.locator(column).isVisible()), '"All sections" leaves the section\'s panel showing');
	await page.locator(`${wide} .sections-column button.drill`).click();
	check(await page.locator(column).isVisible(), 'The caret beside the section does not go back into its panel');
	await context.close();
}

// 4c. The page beside the sidebar keeps its place between pages with and without a section's panel.
{
	const { context, page } = await newPage();
	const placeOf = async (address) => {
		await page.goto(`${base}${address}`, { waitUntil: 'networkidle' });
		return page.locator('main').evaluate((main) => {
			const box = main.getBoundingClientRect();
			return `${Math.round(box.left)}+${Math.round(box.width)}`;
		});
	};
	const places = [await placeOf('/'), await placeOf('/nations'), await placeOf('/charter'), await placeOf('/glossary')];
	check(new Set(places).size === 1, `The page moves between pages: ${places.join(', ')}`);
	await context.close();
}

// 5. The masthead's button and Ctrl+\ hide and show the sidebar; hidden, it is gone and stays hidden from the first paint.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	const button = page.locator('.masthead .sidebar-toggle');
	check((await button.getAttribute('aria-expanded')) === 'true', 'The masthead\'s sidebar button does not start expanded');
	await button.click();
	check(!(await page.locator(wide).isVisible()), 'The masthead\'s button does not hide the sidebar');
	const width = await page.locator('main').evaluate((main) => Math.round(main.getBoundingClientRect().left));
	check(width === 0, `With the sidebar hidden the page starts ${width} px from the left`);
	await page.reload({ waitUntil: 'commit' });
	await page.waitForSelector(wide, { state: 'attached' });
	check(!(await page.locator(wide).isVisible()), 'A hidden sidebar showed before the script ran');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('Control+Backslash');
	check(await page.locator(wide).isVisible(), 'Ctrl+\\ does not show the sidebar again');
	await context.close();
}

// 5b. The sections fold like the Workspace group, and a shut list stays shut from the first paint.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/charter`, { waitUntil: 'networkidle' });
	const caret = page.locator(`${wide} .sections-column .group-heading button.fold`);
	const list = page.locator(`${wide} .sections-column ul.sections`);
	check((await caret.getAttribute('aria-expanded')) === 'true', 'The sections do not start open');
	await caret.click();
	check(!(await list.isVisible()), 'The caret does not shut the sections');
	await page.reload({ waitUntil: 'commit' });
	await page.waitForSelector(`${wide} .sections-column ul.sections`, { state: 'attached' });
	check(!(await list.isVisible()), 'Shut sections showed before the script ran');
	await page.waitForLoadState('networkidle');
	check((await caret.getAttribute('aria-expanded')) === 'false', 'The sections did not stay shut on the next page');
	await caret.click();
	check(await list.isVisible(), 'The caret does not open the sections again');
	await context.close();
}

// 6. Without JavaScript: no carets or filter, and the section being read lists its pages.
{
	const { context, page } = await newPage({ javaScriptEnabled: false });
	await page.goto(`${base}/nations/map`, { waitUntil: 'load' });
	check((await page.locator(`${wide} button.fold`).filter({ visible: true }).count()) === 0, 'Carets show without JavaScript');
	check(!(await page.locator(`${column} .filter`).isVisible()), 'The filter shows without JavaScript');
	check(await page.locator(`${column} a[href='/nations/recourse']`).isVisible(), 'The section being read does not list its pages without JavaScript');
	await context.close();
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} sidebar problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log('The sidebar passed every check.');
