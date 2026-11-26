// Checks the shared table's tools in a browser (src/lib/components/DataTable.svelte), as Trevor approved them on Nov. 24, 2026: filters on the column headers instead of a separate area, no search box on the Native nations table, a list of columns to hide and add, a Sum row at the bottom of a table that has a total, and recognition badges that open their source. Build a table uses the same tools. At desktop and phone widths it uses each tool as a reader would and checks what the table shows, that each menu opens inside the screen, and that the page address keeps the choices. Run from site/ after `npm run build`:
//   node tools/check-table-tools.mjs
//
// The prerendered pages are served from the build output, as Cloudflare serves them, and opened in Chromium through Playwright. Set CHROMIUM_PATH to use a Chromium that is already installed. Set SCREENSHOTS to a folder to save a picture of each step there.

import { createServer } from 'node:http';
import { existsSync, mkdirSync, statSync } from 'node:fs';
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
const base = process.env.SITE_ADDRESS ?? `http://127.0.0.1:${server.address().port}`;

const screenshots = process.env.SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
const check = (condition, message) => {
	if (!condition) problems.push(message);
};

const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'phone', width: 390, height: 844 }
];

async function picture(page, name) {
	if (screenshots) await page.screenshot({ path: path.join(screenshots, `${name}.png`) });
}

/** Picks a choice by its label in one of the builder's dropdowns (src/lib/components/Dropdown.svelte), as a reader would. */
async function choose(page, box, label) {
	await page.locator(box).click();
	const list = await page.locator(box).getAttribute('aria-controls');
	await page.locator(`[id="${list}"]`).getByRole('option', { name: label, exact: true }).click();
}

/** The open menu's box, or undefined when none is open. */
const openMenu = (page) =>
	page.evaluate(() => {
		const menu = document.querySelector('.table-popover:popover-open, .recognition-explanation:popover-open');
		if (!menu) return undefined;
		const box = menu.getBoundingClientRect();
		return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, screen: document.documentElement.clientWidth, height: innerHeight };
	});

function checkInside(where, box) {
	check(Boolean(box), `${where}: the menu did not open`);
	if (!box) return;
	check(box.left >= 0 && box.right <= box.screen + 1, `${where}: the menu runs past the side of the screen (${Math.round(box.left)} to ${Math.round(box.right)} on ${box.screen})`);
	check(box.bottom <= box.height + 1, `${where}: the menu runs below the screen`);
}

const count = (page) => page.locator('.table-count').first().textContent();

for (const viewport of viewports) {
	const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: viewport.width, height: viewport.height } });
	await context.route((url) => !url.href.startsWith(base), (route) => route.abort());
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	const at = (what) => `${what} (${viewport.name})`;

	// The Native nations table: no search box, a filter on each column header.
	await page.goto(`${base}/nations`, { waitUntil: 'load' });
	const nations = page.locator('.data-table').first();
	await nations.locator('.filter-button').first().waitFor();
	check((await nations.locator('input[type="search"]').count()) === 0, at('/nations: the table still has its own search box'));
	check((await page.getByRole('button', { name: 'Add filter' }).count()) === 0, at('/nations: the "Add filter" bar is still there'));
	for (const header of ['Name', 'Recognition', 'States', 'Region', 'Review status']) {
		check((await nations.getByRole('button', { name: `Filter ${header}`, exact: true }).count()) === 1, at(`/nations: the ${header} column has no filter on its header`));
	}
	const all = await count(page);
	await picture(page, `${viewport.name}-1-nations`);

	// Tick one value: the rows narrow, the funnel shows it, and the address keeps it.
	await nations.getByRole('button', { name: 'Filter Recognition', exact: true }).click();
	checkInside(at('/nations, Recognition filter'), await openMenu(page));
	await page.locator('.table-popover:popover-open label', { hasText: /^\s*Federal\s*\d/ }).click();
	const federal = await count(page);
	check(federal !== all && /^Showing [\d,]+ of /.test(federal ?? ''), at(`/nations: ticking Federal did not narrow the table (${all} then ${federal})`));
	check(new URL(page.url()).searchParams.getAll('nations.recognition').includes('Federal'), at('/nations: the address does not keep the Federal filter'));
	const under = await page.evaluate(() => {
		const button = document.querySelector('.data-table .filter-button.open');
		const menu = document.querySelector('.table-popover:popover-open');
		return button && menu ? menu.getBoundingClientRect().top - button.getBoundingClientRect().bottom : undefined;
	});
	check(under !== undefined && under >= 0 && under <= 12, at(`/nations: after ticking a value, the menu no longer sits under its button (${under} px)`));
	await picture(page, `${viewport.name}-2-recognition-filter`);
	await page.keyboard.press('Escape');
	check(!(await openMenu(page)), at('/nations: Escape did not close the filter'));
	check((await nations.getByRole('button', { name: 'Filter Recognition, filtered', exact: true }).count()) === 1, at('/nations: the Recognition funnel does not show that it filters'));

	// The Name column's "Contains" box.
	await nations.getByRole('button', { name: 'Filter Name', exact: true }).click();
	// Typed into the box itself: the menu puts the focus there a moment after it opens, and on a slow machine keys pressed straight after the click would land before it (main went red this way on Nov. 24, 2026).
	await page.locator('.table-popover:popover-open input[type="text"]').fill('Paiute');
	await page.waitForFunction((text) => document.querySelector('.table-count')?.textContent !== text, federal, { timeout: 3000 }).catch(() => {});
	const paiute = await nations.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.cells[0].textContent ?? ''));
	check(paiute.length > 0 && paiute.every((name) => /paiute/i.test(name)), at(`/nations: "Contains Paiute" left names without it: ${paiute.filter((name) => !/paiute/i.test(name)).slice(0, 3).join('; ')}`));
	checkInside(at('/nations, Name filter'), await openMenu(page));
	await page.keyboard.press('Escape');

	// After a reload the filters are still there; "Show all" takes them away.
	await page.reload({ waitUntil: 'load' });
	await nations.locator('.filter-button').first().waitFor();
	await page.waitForFunction((text) => document.querySelector('.table-count')?.textContent !== text, all, { timeout: 3000 }).catch(() => {});
	check((await nations.getByRole('button', { name: 'Filter Name, filtered', exact: true }).count()) === 1, at('/nations: after reloading, the Name filter is gone'));
	await page.getByRole('button', { name: 'Show all' }).first().click();
	check((await nations.locator('.filter-button.active').count()) === 0, at('/nations: "Show all" left a filter on'));

	// Hide a column and add one; the address keeps the columns, and the widths handles follow.
	await nations.getByRole('button', { name: 'Columns', exact: true }).click();
	checkInside(at('/nations, Columns'), await openMenu(page));
	check(await page.locator('.table-popover:popover-open label', { hasText: 'Name' }).first().locator('input').isDisabled(), at('/nations: the Name column can be hidden'));
	await page.locator('.table-popover:popover-open label', { hasText: 'Review status' }).click();
	await page.locator('.table-popover:popover-open label', { hasText: 'Citizens' }).click();
	await picture(page, `${viewport.name}-3-columns`);
	await page.keyboard.press('Escape');
	const headers = async () => (await nations.locator('thead th').allTextContents()).map((text) => text.trim());
	let shown = await headers();
	check(!shown.includes('Review status') && shown.includes('Citizens'), at(`/nations: after hiding Review status and adding Citizens the headers are ${shown.join(', ')}`));
	check(new URL(page.url()).searchParams.get('nations.columns') === 'name,recognition,states,region,citizens', at(`/nations: the address keeps the columns as ${new URL(page.url()).searchParams.get('nations.columns')}`));
	await page.waitForTimeout(100);
	check((await nations.locator('thead .column-resizer').count()) === shown.length, at('/nations: the column width handles do not follow the columns shown'));
	await page.reload({ waitUntil: 'load' });
	await nations.locator('.filter-button').first().waitFor();
	await page.waitForFunction(() => [...document.querySelectorAll('.data-table thead th')].some((th) => th.textContent.includes('Citizens')), undefined, { timeout: 3000 }).catch(() => {});
	shown = await headers();
	check(shown.includes('Citizens') && !shown.includes('Review status'), at('/nations: after reloading, the columns chosen are gone'));
	await nations.getByRole('button', { name: 'Columns', exact: true }).click();
	await page.locator('.table-popover:popover-open').getByRole('button', { name: 'Reset columns' }).click();
	await page.keyboard.press('Escape');
	shown = await headers();
	check(shown.includes('Review status') && !shown.includes('Citizens'), at('/nations: "Reset columns" did not bring back the default columns'));

	// A recognition badge opens its source; the source is not beside it.
	const firstRecognition = nations.locator('tbody tr').first().locator('td').first();
	check(!/Fed\. Reg\./.test(await firstRecognition.innerText()), at('/nations: the recognition source still sits beside the badge'));
	await nations.locator('.recognition-badge-button').first().click();
	const explanation = page.locator('.recognition-explanation:popover-open');
	check((await explanation.count()) === 1 && (await explanation.locator('a').count()) > 0, at('/nations: the badge did not open its source'));
	checkInside(at('/nations, recognition badge'), await openMenu(page));
	await picture(page, `${viewport.name}-4-badge`);
	await page.keyboard.press('Escape');

	// The Sum row on a chart's table: at the bottom however it is sorted, and the total line gives way to it.
	await page.goto(`${base}/nations/data/dispute-resolution`, { waitUntil: 'load' });
	const chart = page.locator('figure.chart').filter({ hasText: 'Provisions by method' }).first();
	await chart.getByRole('button', { name: 'Table', exact: true }).click();
	const sum = chart.locator('tfoot.sum-row');
	check((await sum.count()) === 1, at('/nations/data/dispute-resolution: the table has no Sum row'));
	check((await chart.locator('.chart-total').count()) === 0, at('/nations/data/dispute-resolution: the "Total:" line still shows under the table'));
	const values = await chart.locator('tbody tr').evaluateAll((rows) => rows.map((row) => Number(row.cells[row.cells.length - 1].textContent.replaceAll(',', ''))));
	const total = values.reduce((sum, value) => sum + value, 0);
	check((await sum.locator('td').last().textContent())?.trim() === total.toLocaleString('en-US'), at(`/nations/data/dispute-resolution: the Sum row does not read ${total.toLocaleString('en-US')}`));
	await chart.locator('thead th').last().locator('button.sort-button').click();
	check(await chart.evaluate((figure) => figure.querySelector('table').lastElementChild?.matches('tfoot.sum-row')), at('/nations/data/dispute-resolution: after sorting, the Sum row is not at the bottom'));
	await chart.scrollIntoViewIfNeeded();
	await picture(page, `${viewport.name}-5-sum-row`);
	await chart.getByRole('button', { name: 'Bars', exact: true }).click();
	check((await chart.locator('.chart-total').count()) === 1, at('/nations/data/dispute-resolution: the bars lost their "Total:" line'));

	// Other prebuilt tables filter from their headers too. The Court pages' tables (/supreme-court/burger-court) are drawn on request, so tools/check-accessibility-live.mjs opens their column filter on the Worker instead.
	await page.goto(`${base}/biographies`, { waitUntil: 'load' });
	const people = page.locator('.data-table').first();
	await people.locator('.filter-button').first().waitFor();
	await people.getByRole('button', { name: 'Filter Nation', exact: true }).click();
	checkInside(at('/biographies, Nation filter'), await openMenu(page));
	await picture(page, `${viewport.name}-6-biographies`);

	// Build a table uses the same tools (Trevor, Nov. 24, 2026: one flow for readers and the team): the shared table's list of columns and header filters ungrouped, the same filter menus from one funnel when grouped, and the Sum row under a two-way table.
	await page.goto(`${base}/nations/data/build?data=courts`, { waitUntil: 'load' });
	const built = page.locator('.data-table').first();
	await built.locator('.filter-button').first().waitFor();
	check((await page.getByRole('button', { name: 'Add filter' }).count()) === 0, at('/nations/data/build: the "Add filter" bar is still there'));
	check((await page.getByRole('button', { name: 'Columns', exact: true }).count()) === 1, at('/nations/data/build: there is a second list of columns beside the table\'s own'));
	const builtAll = await count(page);
	await built.getByRole('button', { name: 'Columns', exact: true }).click();
	checkInside(at('/nations/data/build, Columns'), await openMenu(page));
	await page.locator('.table-popover:popover-open label', { hasText: 'Region' }).click();
	await page.keyboard.press('Escape');
	check((await built.locator('thead th').allTextContents()).some((text) => text.includes('Region')), at('/nations/data/build: adding Region did not show it'));
	check((new URL(page.url()).searchParams.get('columns') ?? '').split(',').includes('region'), at(`/nations/data/build: the address keeps the columns as ${new URL(page.url()).searchParams.get('columns')}`));
	await built.getByRole('button', { name: 'Filter Kind', exact: true }).click();
	checkInside(at('/nations/data/build, Kind filter'), await openMenu(page));
	await page.locator('.table-popover:popover-open label', { hasText: /^\s*Peacemaking program\s*\d/ }).click();
	await page.locator('.table-popover:popover-open label', { hasText: /^\s*Tribal court\s*\d/ }).click();
	await picture(page, `${viewport.name}-7-builder-filter`);
	await page.keyboard.press('Escape');
	const builtFiltered = await count(page);
	check(builtFiltered !== builtAll, at(`/nations/data/build: ticking two kinds did not narrow the table (${builtAll} then ${builtFiltered})`));
	check(new URL(page.url()).searchParams.getAll('where.kind').join('|') === 'Peacemaking program|Tribal court', at(`/nations/data/build: the address keeps the kinds as ${new URL(page.url()).searchParams.getAll('where.kind').join('|')}`));
	const kinds = await built.locator('tbody tr').evaluateAll((rows, column) => [...new Set(rows.map((row) => row.cells[column].textContent.trim()))], 2);
	check(kinds.every((kind) => kind === 'Peacemaking program' || kind === 'Tribal court'), at(`/nations/data/build: kinds left after filtering: ${kinds.join(', ')}`));

	// Grouped: the filter carries over, and the one funnel opens the same menus.
	await choose(page, '#builder-group', 'States');
	await page.locator('figure.chart').first().waitFor();
	check((await page.getByRole('button', { name: 'Filters, filtered', exact: true }).count()) === 1, at('/nations/data/build: grouped, the funnel does not show the Kind filter'));
	await page.getByRole('button', { name: 'Filters, filtered', exact: true }).click();
	checkInside(at('/nations/data/build, grouped Filters'), await openMenu(page));
	await page.locator('.table-popover:popover-open').getByRole('button', { name: /^Kind/ }).click();
	const ticked = await page.locator('.table-popover:popover-open input[type="checkbox"]:checked').count();
	check(ticked === 2, at(`/nations/data/build: grouped, the Kind menu shows ${ticked} values ticked`));
	checkInside(at('/nations/data/build, grouped Kind filter'), await openMenu(page));
	await picture(page, `${viewport.name}-8-builder-grouped-filter`);
	await page.keyboard.press('Escape');
	await choose(page, '#builder-group', 'Kind');
	await choose(page, '#builder-across', 'Group');
	const cross = page.locator('.data-table').first();
	await cross.locator('tfoot.sum-row').waitFor({ timeout: 3000 }).catch(() => {});
	check((await cross.locator('tfoot.sum-row').count()) === 1, at('/nations/data/build: the two-way table has no Sum row'));
	const crossTotals = await cross.locator('tbody tr').evaluateAll((rows) => rows.reduce((sum, row) => sum + Number(row.cells[row.cells.length - 1].textContent.replaceAll(',', '') || 0), 0));
	check((await cross.locator('tfoot.sum-row td').last().textContent())?.trim() === crossTotals.toLocaleString('en-US'), at(`/nations/data/build: the two-way table's Sum row does not read ${crossTotals}`));
	await cross.scrollIntoViewIfNeeded();
	await picture(page, `${viewport.name}-9-builder-sum-row`);

	// Back to the rows: the filter is still on its header.
	await choose(page, '#builder-group', 'None');
	await built.locator('.filter-button').first().waitFor();
	check((await built.getByRole('button', { name: 'Filter Kind, filtered', exact: true }).count()) === 1, at('/nations/data/build: ungrouped again, the Kind filter is gone'));

	check(errors.length === 0, at(`script errors: ${errors.join('; ')}`));
	await context.close();
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} table tool problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log(`The table tools passed at ${viewports.length} widths.`);
