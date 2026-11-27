// Checks the site's navigation in a browser (design/navigation-models, model C):
// the section bar under the masthead and its menus, which open on hover
// (SectionBar.svelte, design/section-menus), the
// side column of where the reader is (SiteSidebar.svelte), the phone strip
// and its sheets, a hidden column and the pages without JavaScript. Run
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

const bar = '.section-bar';
const column = '.sidebar-wide .local-column';

// 1. A nation's page: the bar marks Nations; the column lists the nation's
//    own pages under "‹ Nations", then its headings, and no list of nations.
{
	const { context, page, errors } = await newPage();
	const requests = [];
	page.on('request', (request) => {
		// Lists the page itself asks for, such as the timeline's published
		// Foundations essays, are not the navigation's.
		const { pathname } = new URL(request.url());
		if (pathname.endsWith('.json') && pathname !== '/foundations/published.json') requests.push(request.url());
	});
	await page.goto(`${base}/nations/navajo-nation`, { waitUntil: 'networkidle' });
	const sections = await page.locator(`${bar} summary`).evaluateAll((list) => list.map((summary) => summary.textContent.replace(/\(.*\)/, '').trim()));
	check(sections.join('|') === 'Nations|Federal Law|Courts and Cases|Library|Writing|About', `The section bar lists ${sections.join(', ')}`);
	check((await page.locator(`${bar} summary.current`).textContent()).includes('Nations'), 'The section bar does not mark Nations');
	check(await page.locator(`${column} .back-link[href='/nations']`).isVisible(), 'The column has no way back to Nations');
	check((await page.locator(`${column} .local-title`).textContent()).trim() === 'Navajo Nation', 'The column does not name the nation');
	const current = await page.locator(`${column} .local-link[aria-current='page']`).getAttribute('href');
	check(current === '/nations/navajo-nation', `The nation page is not marked as current: ${current}`);
	check(await page.locator(`${column} .local-link[href='/nations/navajo-nation/opinions'] .count-badge`).isVisible(), 'Court opinions has no count');
	check((await page.locator(`${column} .headings a[href^='#']`).count()) > 5, 'The column does not list the page’s headings');
	check((await page.locator(`${column} a[href^='/nations/hopi']`).count()) === 0, 'The column still lists other nations');
	check(requests.length === 0, `The navigation loaded ${requests.join(', ')} after the page`);
	check(errors.length === 0, `Errors on a nation's page: ${errors.join('; ')}`);
	await context.close();
}

// 2. A nation's court opinions keep the nation in the column.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/nations/navajo-nation/opinions`, { waitUntil: 'networkidle' });
	const current = await page.locator(`${column} .local-link[aria-current='page']`).getAttribute('href');
	check(current === '/nations/navajo-nation/opinions', `The opinions page is not marked in the nation's pages: ${current}`);
	await context.close();
}

// 3. A menu opens when the mouse rests on its section, with nothing shading
//    the page, and closes when the mouse leaves; one opens at a time, with
//    icons and counts. A click, Enter and Space open it too. It closes on
//    Escape, on a click outside and when a link is followed.
{
	const { context, page, errors } = await newPage();
	await page.goto(`${base}/charter`, { waitUntil: 'networkidle' });
	const nations = page.locator(`${bar} details`).first();
	const federal = page.locator(`${bar} details`).nth(1);
	const isOpen = (menu) => menu.evaluate((element) => element.open);
	await nations.locator('summary').hover();
	await page.waitForTimeout(400);
	check(await nations.locator('.menu-panel').isVisible(), 'The Nations menu does not open on hover');
	check((await page.locator('.shade').count()) === 0, 'A shade covers the page behind an open menu');
	check(await nations.locator(".menu-group a[href='/nations'] .count-badge").isVisible(), 'The Directory has no count');
	check((await nations.locator('.menu-link svg').count()) === (await nations.locator('.menu-link').count()), 'A link in the menu has no icon');
	check((await nations.locator('#go-to-nation').count()) === 0, 'The Nations menu still has "Go to a nation"');
	// A click on a menu the mouse just opened keeps it open.
	await nations.locator('summary').click();
	check(await isOpen(nations), 'A click shut the menu the mouse had just opened');
	await federal.locator('summary').hover();
	await page.waitForTimeout(100);
	check(!(await isOpen(nations)) && (await isOpen(federal)), 'Moving to another section does not switch menus');
	await page.mouse.move(640, 760);
	await page.waitForTimeout(600);
	check(!(await isOpen(federal)), 'The menu stays open after the mouse leaves it');
	// From the keyboard: Enter opens, the mouse leaving does not close it, Escape does.
	await federal.locator('summary').focus();
	await page.keyboard.press('Enter');
	check(await isOpen(federal), 'Enter does not open the menu');
	await page.mouse.move(640, 700);
	await page.waitForTimeout(600);
	check(await isOpen(federal), 'A menu opened from the keyboard closed when the mouse moved');
	await page.keyboard.press('Escape');
	check(!(await isOpen(federal)), 'Escape does not close the menu');
	await page.keyboard.press('Space');
	check(await isOpen(federal), 'Space does not open the menu');
	await page.keyboard.press('Escape');
	await nations.locator('summary').click();
	await page.mouse.click(640, 700);
	check(!(await isOpen(nations)), 'A click outside does not close the menu');
	await nations.locator('summary').hover();
	await page.waitForTimeout(400);
	await nations.locator(".menu-group a[href='/nations/map']").click();
	await page.waitForURL(`${base}/nations/map`);
	await page.waitForTimeout(300);
	check(!(await isOpen(nations)), 'The menu stayed open after following a link');
	check(errors.length === 0, `Errors in the menus: ${errors.join('; ')}`);
	await context.close();
}

// 4. A section's page: the column lists the section's pages in its groups.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/nations/map`, { waitUntil: 'networkidle' });
	const links = await page.locator(`${column} .local-link`).evaluateAll((list) => list.map((a) => a.getAttribute('href')));
	check(['/nations', '/nations/recourse', '/nations/timeline', '/nations/data'].every((link) => links.includes(link)), `Nations pages missing from the column: ${links.join(', ')}`);
	check((await page.locator(`${column} .local-link[aria-current='page']`).getAttribute('href')) === '/nations/map', 'The map is not marked in the column');
	await context.close();
}

// 5. The page beside the column keeps its place from page to page.
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

// 6. Phones: Menu opens the sections as a sheet, the section being read
//    open; the name beside it opens where the reader is. Each closes when a
//    link is followed and on Escape.
{
	const { context, page } = await newPage({ viewport: { width: 390, height: 844 } });
	await page.goto(`${base}/nations/navajo-nation`, { waitUntil: 'networkidle' });
	check(!(await page.locator(bar).isVisible()), 'The section bar shows on a phone');
	const menu = page.locator('.sidebar-narrow .menu-sheet');
	const local = page.locator('.sidebar-narrow .local-sheet');
	check((await local.locator(':scope > summary').textContent()).includes('Navajo Nation'), 'The phone strip does not name the nation');
	await menu.locator(':scope > summary').click();
	check(await menu.locator('.phone-sections details[open] a[href="/nations/map"]').isVisible(), 'The Menu sheet does not open on the section being read');
	const box = await menu.locator('.phone-sections summary').nth(1).boundingBox();
	check(box && box.height >= 44, `A section in the Menu sheet is smaller than 44 px: ${JSON.stringify(box)}`);
	await page.keyboard.press('Escape');
	check(!(await menu.evaluate((element) => element.open)), 'Escape did not close the Menu sheet');
	await local.locator(':scope > summary').click();
	check(await local.locator('.headings a[href^="#"]').first().isVisible(), 'The local sheet does not list the headings');
	await local.locator('.local-link[href="/nations/navajo-nation/opinions"]').click();
	await page.waitForURL(`${base}/nations/navajo-nation/opinions`);
	await page.waitForTimeout(300);
	check(!(await page.locator('.sidebar-narrow .local-sheet').evaluate((element) => element.open)), 'The local sheet stayed open after choosing a page');
	await context.close();
}

// 7. The masthead's button and Ctrl+\ hide and show the column; hidden, it is gone and stays hidden from the first paint.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/glossary`, { waitUntil: 'networkidle' });
	const wide = '.sidebar-wide';
	const button = page.locator('.masthead .sidebar-toggle');
	check((await button.getAttribute('aria-expanded')) === 'true', 'The masthead\'s sidebar button does not start expanded');
	await button.click();
	check(!(await page.locator(wide).isVisible()), 'The masthead\'s button does not hide the column');
	const width = await page.locator('main').evaluate((main) => Math.round(main.getBoundingClientRect().left));
	check(width === 0, `With the column hidden the page starts ${width} px from the left`);
	await page.reload({ waitUntil: 'commit' });
	await page.waitForSelector(wide, { state: 'attached' });
	check(!(await page.locator(wide).isVisible()), 'A hidden column showed before the script ran');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('Control+Backslash');
	check(await page.locator(wide).isVisible(), 'Ctrl+\\ does not show the column again');
	await context.close();
}

// 8. Without JavaScript the menus still open, and the column lists the section's pages.
{
	const { context, page } = await newPage({ javaScriptEnabled: false });
	await page.goto(`${base}/nations/map`, { waitUntil: 'load' });
	await page.locator(`${bar} summary`).nth(1).click();
	check(await page.locator(`${bar} details[open] .menu-panel a[href='/stats/treaties']`).isVisible(), 'The Federal law menu does not open without JavaScript');
	check(await page.locator(`${column} a[href='/nations/recourse']`).isVisible(), 'The column does not list the section\'s pages without JavaScript');
	await context.close();
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} navigation problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log('The navigation passed every check.');
