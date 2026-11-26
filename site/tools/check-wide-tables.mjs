// Checks that a data table never goes over the side of the screen (src/lib/components/DataTable.svelte, src/lib/tables/resizable-columns.ts). Trevor asked on Nov. 24, 2026: "if you expand the table, it should always keep the end of the table locked, so you cannot go over the side". Widening a column made the whole page scroll sideways (text placed inside a cell sat out past the table's box), and on a phone the full-screen table scrolled sideways as a whole, controls and all.
//
// On the Native nations table and the Supreme Court page's Justices table, at desktop and phone widths, this widens the first column by keyboard and by dragging, and opens the table full screen, both with the browser's full screen and filling the window (as on an iPhone). Each time: the page does not scroll sideways, the table's box ends inside the screen, a widened column keeps the end of the table where it was, and in full screen the sideways scroll bar is on the screen. Run from site/ after `npm run build`:
//   node tools/check-wide-tables.mjs
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
// Court pages (/supreme-court/roberts-court) are drawn on request now (src/lib/server/page-data.ts), so this static server can't serve them; the Supreme Court page's own tables use the same component.
const pages = ['/nations', '/supreme-court'];

/** Where the first table's box and the table end, and how far the page and the full-screen frame scroll sideways. */
function measure(page) {
	return page.evaluate(() => {
		const frame = document.querySelector('.data-table');
		const box = frame.querySelector('.table-scroll');
		const table = box.querySelector('table');
		const root = document.documentElement;
		const screen = document.fullscreenElement ?? (frame.classList.contains('filling-window') ? frame : undefined);
		return {
			screenWidth: root.clientWidth,
			screenHeight: innerHeight,
			pageWidth: root.scrollWidth,
			boxRight: box.getBoundingClientRect().right,
			boxBottom: box.getBoundingClientRect().bottom,
			boxScrolls: box.scrollWidth > box.clientWidth + 1,
			tableWidth: table.getBoundingClientRect().width,
			firstColumn: table.tHead.rows[0].cells[0].getBoundingClientRect().width,
			frameSideways: screen ? screen.scrollWidth - screen.clientWidth : 0,
			fullScreen: Boolean(screen)
		};
	});
}

async function picture(page, name) {
	if (screenshots) await page.screenshot({ path: path.join(screenshots, `${name}.png`) });
}

/** Everything that should hold however the table was changed. */
function checkLocked(where, now) {
	check(now.pageWidth <= now.screenWidth + 1, `${where}: the page scrolls sideways (${now.pageWidth} px wide on a ${now.screenWidth} px screen)`);
	check(now.boxRight <= now.screenWidth + 1, `${where}: the table's box ends past the screen (${Math.round(now.boxRight)} px on a ${now.screenWidth} px screen)`);
}

for (const viewport of viewports) {
	for (const pagePath of pages) {
		for (const fullScreenKind of ['browser', 'window']) {
			const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: viewport.width, height: viewport.height } });
			await context.route((url) => !url.href.startsWith(base), (route) => route.abort());
			// Without the browser's full screen, as on an iPhone, the table fills the window instead.
			if (fullScreenKind === 'window') await context.addInitScript(() => delete Element.prototype.requestFullscreen);
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', (error) => errors.push(String(error)));
			const where = `${pagePath} (${viewport.name}${fullScreenKind === 'window' ? ', filling the window' : ''})`;
			const name = `${viewport.name}-${pagePath.replace(/\W+/g, '-').replace(/^-/, '')}`;
			await page.goto(base + pagePath, { waitUntil: 'load' });
			const handle = page.locator('.data-table .column-resizer').first();
			await handle.waitFor();
			const before = await measure(page);
			checkLocked(`${where}, as it opens`, before);
			if (fullScreenKind === 'browser') await picture(page, `${name}-1-as-it-opens`);

			// Widen the first column by keyboard, far more than there is room for.
			await handle.focus();
			for (let press = 0; press < 20; press += 1) await page.keyboard.press('Shift+ArrowRight');
			const widened = await measure(page);
			checkLocked(`${where}, first column widened by keyboard`, widened);
			check(Math.abs(widened.tableWidth - before.tableWidth) <= 2, `${where}: widening a column by keyboard moved the end of the table (${Math.round(before.tableWidth)} px to ${Math.round(widened.tableWidth)} px)`);
			// Where the table fits its box, the column does widen, taking room from the others.
			if (!before.boxScrolls) check(widened.firstColumn > before.firstColumn + 20, `${where}: the first column did not widen (${Math.round(before.firstColumn)} px to ${Math.round(widened.firstColumn)} px)`);
			if (fullScreenKind === 'browser') await picture(page, `${name}-2-column-widened`);

			// Drag the second column's handle well past the side of the screen.
			const second = page.locator('.data-table .column-resizer').nth(1);
			await second.scrollIntoViewIfNeeded();
			const grip = await second.boundingBox();
			await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
			await page.mouse.down();
			await page.mouse.move(viewport.width + 600, grip.y + grip.height / 2, { steps: 8 });
			await page.mouse.up();
			const dragged = await measure(page);
			checkLocked(`${where}, second column dragged wider`, dragged);
			check(Math.abs(dragged.tableWidth - before.tableWidth) <= 2, `${where}: dragging a column wider moved the end of the table (${Math.round(before.tableWidth)} px to ${Math.round(dragged.tableWidth)} px)`);

			// Full screen: the table's box, with its sideways scroll bar, stays on the screen, and nothing around it scrolls sideways.
			await page.getByRole('button', { name: 'Full screen', exact: true }).first().click();
			await page.waitForFunction(() => document.fullscreenElement || document.querySelector('.data-table.filling-window'));
			const full = await measure(page);
			check(full.fullScreen, `${where}: the table did not go full screen`);
			checkLocked(`${where}, full screen`, full);
			check(full.frameSideways <= 1, `${where}: full screen, the table and its controls scroll sideways together (${full.frameSideways} px)`);
			check(full.boxBottom <= full.screenHeight + 1, `${where}: full screen, the table's box runs below the screen, so its sideways scroll bar is out of sight`);
			if (fullScreenKind === 'browser') await picture(page, `${name}-3-full-screen`);

			// Leave full screen; the page is as it was.
			await page.getByRole('button', { name: 'Leave full screen', exact: true }).first().click();
			await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector('.data-table.filling-window'));
			checkLocked(`${where}, after leaving full screen`, await measure(page));

			check(errors.length === 0, `${where}: script errors: ${errors.join('; ')}`);
			await context.close();
		}
	}
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} wide table problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log(`Tables stayed within the screen on ${pages.length} pages at ${viewports.length} widths, with both kinds of full screen.`);
