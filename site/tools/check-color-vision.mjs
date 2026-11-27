// Fails if two colors that readers must tell apart look too alike to a reader
// with a color vision deficiency. It runs every such set in
// site/design-tokens.json, in both themes, through the published simulation
// models in tools/color-vision.mjs and measures the CIEDE2000 difference of
// every pair.
//
// Color is never the only cue on the site (site/DESIGN.md, "Color vision"):
// pie slices carry numbers and the timeline's kinds carry icons. This check
// keeps the colors themselves apart too, so a later palette change has to
// pass a measured test rather than a claim.
//
// Run from site/:  node tools/check-color-vision.mjs

import { readFileSync } from 'node:fs';
import { closestPair, visions } from './color-vision.mjs';

/**
 * The sets checked: colors that stand for different things side by side.
 * Sets left out on purpose: the map's shades are steps of one scale with the
 * count or a shape beside them, and status and track colors always come with
 * their words.
 */
const sets = [
	{
		name: 'Chart slices',
		tokens: ['chart-series-1', 'chart-series-2', 'chart-series-3', 'chart-series-4', 'chart-series-5', 'chart-series-6', 'chart-series-7']
	},
	{ name: 'Timeline kinds', tokens: ['timeline-treaty', 'timeline-document', 'timeline-case', 'timeline-opinion', 'timeline-federal'] }
];

/**
 * The smallest CIEDE2000 difference allowed between any two colors of a set.
 * 10 is the project's working floor for small chart marks (the color vision
 * write-up, section 4); the Okabe-Ito palette clears it. Blue-yellow
 * deficiency is far rarer and no seven-color palette keeps 10 apart for it,
 * so its floor is 8 (Okabe-Ito: 8.1). No set of colors stays apart with no
 * color vision at all, which is why the site never relies on color alone; that
 * row is reported, not enforced.
 */
const floors = { typical: 10, protanopia: 10, deuteranopia: 10, protanomaly: 10, deuteranomaly: 10, tritanopia: 8 };

const tokens = JSON.parse(readFileSync(new URL('../design-tokens.json', import.meta.url), 'utf8'));
let failures = 0;

for (const theme of ['light', 'dark']) {
	for (const set of sets) {
		const colors = Object.fromEntries(set.tokens.map((token) => [token, tokens.color[theme][token].$value]));
		console.log(`${set.name}, ${theme}:`);
		for (const vision of visions) {
			const closest = closestPair(colors, vision);
			const floor = /** @type {Record<string, number>} */ (floors)[vision];
			const failed = floor !== undefined && closest.difference < floor;
			if (failed) failures++;
			const verdict = floor === undefined ? 'reported only' : failed ? `FAILS, under ${floor}` : `at least ${floor}`;
			console.log(`  ${vision.padEnd(14)} ${closest.difference.toFixed(1).padStart(5)}  ${closest.first} / ${closest.second}  (${verdict})`);
		}
	}
}

if (failures > 0) {
	console.error(
		`\n${failures} of the checks above failed: some colors look too alike for some readers. Change the colors in design-tokens.json until each closest pair clears its floor.`
	);
	process.exit(1);
}
console.log('\nEvery set of colors stays apart for each kind of color vision checked.');
