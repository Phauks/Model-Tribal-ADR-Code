// Checks the timeline's layout buttons in a browser (src/lib/components/Timeline.svelte): on a
// nation's page and on the full timeline, at desktop and phone widths, a reader can switch the
// timeline across and back down the page, and every toolbar button can be clicked rather than
// lying under something else. Trevor found on Nov. 24, 2026 that once across, the nation page's
// timeline could not be switched back: its toolbar sits on the line of the section heading, and the
// folding section clipped it away. Run from site/ after `npm run build`:
//   node tools/check-timeline.mjs
//
// The prerendered pages are served from the build output, as Cloudflare serves them, and opened in
// Chromium through Playwright. Set CHROMIUM_PATH to use a Chromium that is already installed.
//
// The full timeline lists about ten thousand entries, so starting it and switching its layout take
// seconds on a busy machine. The check waits on what the page says rather than on a fixed delay:
// the timeline carries data-ready once its scripts have started and the reader's saved layout is
// applied, and each step waits for the browser to finish its work before the next click. The clicks
// may take as long as they need (a button under something else still fails, after the wait); on
// Nov. 26 and 27, 2026 a three-second limit failed now and then on pages nothing had changed.

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

const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'phone', width: 390, height: 844 }
];
const pages = ['/nations/navajo-nation', '/nations/timeline'];

/** Each toolbar button that is not the topmost element at its middle, by its label. */
async function coveredButtons(page) {
	return page.evaluate(() => {
		const covered = [];
		for (const button of document.querySelectorAll('.timeline .toolbar button, .timeline .toolbar a')) {
			// A button the page hides at this width, such as Filters on a wide screen, is not drawn at all.
			if (button.getClientRects().length === 0) continue;
			button.scrollIntoView({ block: 'center' });
			const box = button.getBoundingClientRect();
			const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
			if (box.width === 0 || !top || !(button === top || button.contains(top))) covered.push(button.getAttribute('aria-label'));
		}
		return covered;
	});
}

const isDown = (page) => page.evaluate(() => !!document.querySelector('.timeline.down'));

/** How long a step of the full timeline may take on a slow machine before it counts as broken. */
const patience = 30_000;

/** Waits until the timeline's scripts have started, and then until the browser has nothing left to do. */
async function settled(page) {
	await page.locator('.timeline[data-ready]').first().waitFor({ timeout: patience });
	await page.evaluate(
		(timeout) => new Promise((resolve) => requestAnimationFrame(() => requestIdleCallback(() => resolve(undefined), { timeout }))),
		patience
	);
}

for (const viewport of viewports) {
	for (const path of pages) {
		const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: viewport.width, height: viewport.height } });
		await context.route((url) => url.origin !== base, (route) => route.abort());
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(String(error)));
		const where = `${path} (${viewport.name})`;
		await page.goto(base + path, { waitUntil: 'load' });
		await settled(page);
		check(await isDown(page), `${where}: the timeline should open down the page`);

		for (const [label, down] of [
			['Across', false],
			['Down the page', true],
			['Across', false]
		]) {
			const button = page.getByRole('button', { name: label, exact: true }).first();
			try {
				// A real click at the button's middle, which fails if anything lies over it.
				await button.click({ timeout: patience });
			} catch {
				check(false, `${where}: "${label}" could not be clicked`);
				continue;
			}
			await settled(page);
			check((await isDown(page)) === down, `${where}: after "${label}" the timeline should run ${down ? 'down the page' : 'across'}`);
			const covered = await coveredButtons(page);
			check(covered.length === 0, `${where}: ${down ? 'down the page' : 'across'}, toolbar buttons lie under something else: ${covered.join(', ')}`);
		}

		// The choice is remembered: reload, still across, and back down again.
		await page.reload({ waitUntil: 'load' });
		await settled(page);
		check(!(await isDown(page)), `${where}: after reloading, the timeline should stay across`);
		try {
			await page.getByRole('button', { name: 'Down the page', exact: true }).first().click({ timeout: patience });
			await settled(page);
			check(await isDown(page), `${where}: after reloading, "Down the page" should turn the timeline back`);
		} catch {
			check(false, `${where}: after reloading, "Down the page" could not be clicked`);
		}
		check(errors.length === 0, `${where}: script errors: ${errors.join('; ')}`);
		await context.close();
	}
}

// The filters stay held apart from the list (FilterSheet.svelte; Trevor, Nov. 27, 2026: "only scroll
// through timeline part, do not scroll through the filters"). Far down the list, on a wide screen the
// filters' column is still on screen, and on a phone the Filters icon is still at the top of the screen,
// opens the sheet, and Escape closes it and gives focus back to the icon.
const filterPages = [
	{ path: '/nations/timeline', form: '#timeline-filters' },
	{ path: '/supreme-court/timeline', form: '#supreme-timeline-filters' }
];
for (const viewport of viewports) {
	for (const { path, form } of filterPages) {
		const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: viewport.width, height: viewport.height } });
		await context.route((url) => url.origin !== base, (route) => route.abort());
		const page = await context.newPage();
		const where = `${path} (${viewport.name}), filters`;
		await page.goto(base + path, { waitUntil: 'load' });
		if (path === '/nations/timeline') await settled(page);
		else await page.waitForTimeout(1000);
		await page.evaluate(() => window.scrollTo(0, 3000));
		await page.waitForTimeout(300);
		if (viewport.name === 'desktop') {
			const box = await page.locator(form).boundingBox();
			check(!!box && box.y >= 0 && box.y < 100, `${where}: the filters should stay at the top of the window as the list scrolls (top at ${box?.y})`);
		} else {
			const button = page.locator(`[aria-controls="${form.slice(1)}"]`).first();
			const box = await button.boundingBox();
			check(!!box && box.y >= 0 && box.y + box.height <= viewport.height, `${where}: the Filters icon should stay on screen as the list scrolls`);
			try {
				await button.click({ timeout: patience });
				check(await page.locator(form).isVisible(), `${where}: the Filters icon should open the filters`);
				await page.keyboard.press('Escape');
				check(!(await page.locator(form).isVisible()), `${where}: Escape should close the filters`);
				check(await button.evaluate((element) => element === document.activeElement), `${where}: closing the filters should give focus back to the Filters icon`);
			} catch {
				check(false, `${where}: the Filters icon could not be clicked`);
			}
		}
		await context.close();
	}
}

await browser.close();
server.close();
if (problems.length > 0) {
	console.error(`${problems.length} timeline problem(s):\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log(`The timeline's layout buttons passed on ${pages.length} pages at ${viewports.length} widths, and the filters stayed apart from the list on ${filterPages.length} pages.`);
