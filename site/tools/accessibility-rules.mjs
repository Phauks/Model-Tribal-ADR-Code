// What both accessibility checks share (tools/check-accessibility.mjs for the
// prerendered pages, tools/check-accessibility-live.mjs for the pages the
// Worker answers and the open menus and dialogs): axe-core itself, the WCAG
// rules it is run with, the two themes, and waiting for a page to settle.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
// The WCAG 2.0, 2.1 and 2.2 level A and AA rules that axe-core automates.
export const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export const themes = ['light', 'dark'];

/**
 * Waits until nothing in the page has changed for `quiet` milliseconds, or
 * `longest` at the most. Some controls (Report a problem, the map's zoom
 * buttons) are added by the page's script just after the load event, so
 * axe-core should see the page only once it stops changing.
 */
export async function waitUntilSettled(page, { quiet = 250, longest = 3_000 } = {}) {
	await page.evaluate(
		({ quiet, longest }) =>
			new Promise((resolve) => {
				let timer;
				const observer = new MutationObserver(() => {
					clearTimeout(timer);
					timer = setTimeout(done, quiet);
				});
				const done = () => {
					observer.disconnect();
					clearTimeout(cap);
					resolve();
				};
				const cap = setTimeout(done, longest);
				observer.observe(document, { subtree: true, childList: true, attributes: true });
				timer = setTimeout(done, quiet);
			}),
		{ quiet, longest }
	);
}

/**
 * Lays out every part of the page, as it is laid out once a reader scrolls to it. Long lists such as
 * the timeline's rows use `content-visibility: auto`, so the browser skips the rows off screen until
 * they come near it (src/lib/components/Timeline.svelte). axe-core measures elements wherever they
 * are, and on a skipped row it found the citation markers' targets too small and took minutes on the
 * full timeline (Nov. 27, 2026), though each row is drawn the same as any other once on screen. A
 * constructed style sheet is used because the Content Security Policy refuses a <style> element.
 */
function drawEverything() {
	const sheet = new CSSStyleSheet();
	sheet.replaceSync('* { content-visibility: visible !important; }');
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

/**
 * Runs axe-core on the page as it is now, in each theme, and returns what it
 * found: the theme, the rule, its help text and the elements, each as its
 * CSS selector. The site's dark theme follows the device setting through CSS
 * media queries, so switching the emulated color scheme restyles the page in
 * place, as it does in a browser. The page is left in the first theme.
 */
export async function axeViolations(page) {
	// Run axe from the testing side rather than as a <script> in the page: the site's
	// Content Security Policy refuses inline scripts it has no hash for (decision record 0055).
	if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(axeSource);
	await page.evaluate(drawEverything);
	const found = [];
	for (const theme of themes) {
		await page.emulateMedia({ colorScheme: theme });
		const violations = await page.evaluate(
			async (runOnly) =>
				(
					await window.axe.run(document, {
						runOnly: { type: 'tag', values: runOnly },
						// Only failures are reported, so axe-core need not
						// describe every element that passed.
						resultTypes: ['violations']
					})
				).violations,
			tags
		);
		for (const violation of violations) {
			found.push({
				theme,
				id: violation.id,
				help: violation.help,
				targets: violation.nodes.map((node) => node.target.join(' '))
			});
		}
	}
	await page.emulateMedia({ colorScheme: themes[0] });
	return found;
}

/** One line for a problem axe-core found, naming the page and up to three elements. */
export function describeViolation(where, { theme, id, help, targets }) {
	return `${where} (${theme}): ${id}, ${help} [${targets.length}] ${targets.slice(0, 3).join('; ')}`;
}
