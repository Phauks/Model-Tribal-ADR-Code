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
//    own pages, then its headings, and no list of nations and no "‹ Nations"
//    (the section bar already goes there).
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
	// Each section's name links to its own page, and the chevron beside it opens its menu (Trevor, Nov. 27, 2026).
	const sections = await page.locator(`${bar} .section-name`).evaluateAll((list) => list.map((link) => `${link.textContent.trim()} ${link.getAttribute('href')}`));
	check(sections.join('|') === 'Nations /nations|Federal Law /laws|Courts and Cases /cases|Library /library|Writing /writing|About /about', `The section bar lists ${sections.join(', ')}`);
	check((await page.locator(`${bar} .section-tab.current .section-name`).textContent()).includes('Nations'), 'The section bar does not mark Nations');
	check((await page.locator(`${bar} .section-name[aria-current]`).getAttribute('aria-current')) === 'true', 'The Nations name does not say the reader is in that section');
	const chevrons = await page.locator(`${bar} summary`).evaluateAll((list) => list.map((summary) => summary.textContent.trim()));
	check(chevrons.join('|') === 'Nations menu|Federal Law menu|Courts and Cases menu|Library menu|Writing menu|About menu', `The chevrons are named ${chevrons.join(', ')}`);
	const chevron = await page.locator(`${bar} summary`).first().boundingBox();
	check(chevron && chevron.width >= 24 && chevron.height >= 24, `A chevron is smaller than 24 px: ${JSON.stringify(chevron)}`);
	check((await page.locator(`${bar} .section-home, ${bar} .menu-side`).count()) === 0, 'A menu still has an "All of …" link');
	check((await page.locator(`${column} a[href='/nations']`).count()) === 0, 'The column links back to Nations, which the section bar already does');
	check((await page.locator(`${column} .local-title`).textContent()).trim() === 'Navajo Nation', 'The column does not name the nation');
	const current = page.locator(`${column} .local-link[aria-current='page']`);
	check((await current.textContent()).trim() === 'Nation Page', `The nation page is not marked as current: ${await current.textContent()}`);
	check((await current.evaluate((element) => element.tagName)) !== 'A' && (await page.locator(`${column} a[href='/nations/navajo-nation']`).count()) === 0, 'The column links the nation page to itself');
	check((await page.locator(`${column} a[href='#glance-heading']`).count()) === 0, 'The column lists Key facts');
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
	const current = page.locator(`${column} .local-link[aria-current='page']`);
	check((await current.textContent()).includes('Court Opinions') && (await current.evaluate((element) => element.tagName)) !== 'A', `The opinions page is not marked, unlinked, in the nation's pages: ${await current.textContent()}`);
	check(await page.locator(`${column} a.local-link[href='/nations/navajo-nation']`).isVisible(), 'The opinions page does not link back to the nation page');
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
	// Resting on the name opens the menu, as resting on the chevron does.
	await page.locator(`${bar} .section-name[href='/nations']`).hover();
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
	// A click on the name goes to the section's own page.
	await page.locator(`${bar} .section-name[href='/laws']`).click();
	await page.waitForURL(`${base}/laws`);
	check((await page.locator('main h1').textContent()).trim() === 'Federal law', 'A click on Federal Law does not open its page');
	check(await page.locator("main .card a[href='/stats/treaties']").isVisible(), 'The Federal law page does not list its pages');
	// From the keyboard the name and the chevron are each one stop for Tab.
	await page.locator(`${bar} .section-name[href='/nations']`).focus();
	await page.keyboard.press('Tab');
	check(await nations.locator('summary').evaluate((summary) => summary === document.activeElement), 'Tab from a section\'s name does not reach its chevron');
	check(errors.length === 0, `Errors in the menus: ${errors.join('; ')}`);
	await context.close();
}

// 4. The column never repeats the top navigation (Trevor, Nov. 27, 2026:
//    "left nav becomes navigation for pages beneath, it should not be double
//    nav for what is already in the top nav"), and the home page, or a page
//    with nothing beneath it, has no column at all.
{
	const { context, page } = await newPage();
	for (const address of ['/nations/map', '/nations/navajo-nation', '/stats/treaties', '/supreme-court', '/cases', '/glossary', '/library', '/writing', '/charter']) {
		await page.goto(`${base}${address}`, { waitUntil: 'networkidle' });
		const top = new Set(await page.locator(`${bar} a[href]`).evaluateAll((list) => list.map((a) => a.getAttribute('href'))));
		const repeats = (await page.locator(`${column} a[href]`).evaluateAll((list) => list.map((a) => a.getAttribute('href')))).filter((link) => top.has(link));
		check(repeats.length === 0, `On ${address} the column repeats the top navigation: ${repeats.join(', ')}`);
	}
	await page.goto(`${base}/`, { waitUntil: 'networkidle' });
	check(!(await page.locator('.sidebar-wide').isVisible()), 'The home page has a column');
	const left = await page.locator('main').evaluate((main) => Math.round(main.getBoundingClientRect().left));
	check(left === 0, `With no column the home page starts ${left} px from the left`);
	check(!(await page.locator('.masthead .sidebar-toggle').isVisible()), 'The home page shows the sidebar button with no column to hide');
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
	const places = [await placeOf('/nations/navajo-nation'), await placeOf('/nations/navajo-nation/opinions'), await placeOf('/charter')];
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
	check(box && box.height >= 44 && box.width >= 44, `A section's chevron in the Menu sheet is smaller than 44 px: ${JSON.stringify(box)}`);
	const name = await menu.locator('.phone-sections .phone-name').nth(1).boundingBox();
	check(name && name.height >= 44, `A section's name in the Menu sheet is smaller than 44 px: ${JSON.stringify(name)}`);
	check((await menu.locator('.phone-sections .phone-name[href="/laws"]').count()) === 1, 'Federal Law in the Menu sheet does not link to its page');
	check((await menu.locator('.phone-home').count()) === 0, 'The Menu sheet still has an "All of …" link');
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
	await page.goto(`${base}/charter`, { waitUntil: 'networkidle' });
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

// 8. Without JavaScript the menus still open, and the column lists the nation's pages.
{
	const { context, page } = await newPage({ javaScriptEnabled: false });
	await page.goto(`${base}/nations/navajo-nation`, { waitUntil: 'load' });
	await page.locator(`${bar} summary`).nth(1).click();
	check(await page.locator(`${bar} details[open] .menu-panel a[href='/stats/treaties']`).isVisible(), 'The Federal law menu does not open without JavaScript');
	check(await page.locator(`${column} a[href='/nations/navajo-nation/opinions']`).isVisible(), 'The column does not list the nation\'s pages without JavaScript');
	await context.close();
}

// 9. Signed in with workspace access (the signed-in hint the Worker sets,
//    src/lib/signed-in-hint.ts): the Workspace is the section bar's last tab,
//    with its menu; the profile button opens the account menu; and the column
//    holds only where the reader is (design/sidebar-workspace-profile, option B).
{
	const { context, page, errors } = await newPage();
	await context.addCookies([{ name: 'signed-in-hint', value: 'overview.inbox.requests.people.access', url: base }]);
	await page.goto(`${base}/nations/navajo-nation`, { waitUntil: 'networkidle' });
	const sections = await page.locator(`${bar} .section-name`).evaluateAll((list) => list.map((link) => link.textContent.trim()));
	check(sections.join('|') === 'Nations|Federal Law|Courts and Cases|Library|Writing|About|Workspace', `Signed in, the section bar lists ${sections.join(', ')}`);
	const workspace = page.locator(`${bar} details[data-key='workspace']`);
	await workspace.locator('summary').click();
	const links = await workspace.locator('.menu-link').evaluateAll((list) => list.map((a) => a.getAttribute('href')));
	check(links.join('|') === '/workspace/inbox|/workspace/requests|/workspace/people|/workspace/access', `The Workspace menu lists ${links.join(', ')}`);
	check(await page.locator(`${bar} .section-name[href='/workspace']`).isVisible(), 'The Workspace name does not link to its Overview');
	await page.keyboard.press('Escape');
	check((await page.locator(`${column} a[href^='/account'], ${column} a[href^='/workspace'], ${column} a[href='/starred']`).count()) === 0, 'The column still lists the account or workspace pages');
	await page.locator('.masthead .account-button').click();
	const account = await page.locator('#account-links a').evaluateAll((list) => list.map((a) => a.getAttribute('href')));
	check(account.includes('/profile') && account.includes('/following') && account.includes('/starred') && account.includes('/account/data'), `The account menu lists ${account.join(', ')}`);
	check(await page.locator('#account-links form[action="/sign-out"] button').isVisible(), 'The account menu has no Sign out');
	await page.keyboard.press('Escape');
	check(await page.locator('#account-links').isHidden(), 'Escape does not close the account menu');
	check(errors.length === 0, `Errors signed in: ${errors.join('; ')}`);
	await context.close();
}

// 10. Signed out there is no Workspace tab, and Recent Changes is in the About menu.
{
	const { context, page } = await newPage();
	await page.goto(`${base}/charter`, { waitUntil: 'networkidle' });
	check((await page.locator(`${bar} details[data-key='workspace']`).count()) === 0, 'Signed out, the section bar has a Workspace tab');
	check((await page.locator(`${bar} details[data-key='about'] a[href='/changes']`).count()) === 1, 'The About menu has no Recent Changes');
	await context.close();
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} navigation problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log('The navigation passed every check.');
