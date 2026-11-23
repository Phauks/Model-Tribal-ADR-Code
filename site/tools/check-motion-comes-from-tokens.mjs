// Fails if any source file sets its own motion timing. Every transition and
// animation takes its duration and easing from the motion tokens in
// site/design-tokens.json (the --motion-* custom properties), and every
// script animation goes through src/lib/motion.ts, so one change to the
// tokens changes all motion and the reader's Reduce motion setting reaches
// all of it (site/DESIGN.md, section 6, "Motion").
//
// Run from site/:  node tools/check-motion-comes-from-tokens.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const folders = ['src'];
const checkedSuffixes = new Set(['.svelte', '.css', '.ts', '.js', '.html']);
// The motion module is the one place that may start animations from a script.
const motionModule = path.normalize('src/lib/motion.ts');

// A transition or animation declaration, possibly over several lines.
const motionDeclaration = /\b(?:transition|animation)(?:-(?:duration|delay|timing-function))?\s*:\s*([^;{}]*)[;}]/g;
const timeLiteral = /(?<![\w.-])(?!0+(?:\.0+)?m?s\b)\d*\.?\d+m?s\b/;
const easingLiteral = /\b(?:ease(?:-in|-out|-in-out)?|linear|step-start|step-end)\b|\b(?:cubic-bezier|steps|linear)\(/;

// Script animation that must go through src/lib/motion.ts.
const scriptPatterns = [
	{ name: 'import from svelte/transition, svelte/animate, svelte/easing or svelte/motion', pattern: /from\s+['"]svelte\/(?:transition|animate|easing|motion)['"]/ },
	{ name: 'element.animate() call', pattern: /\.animate\(\s*\[/ },
	{ name: 'startViewTransition() call', pattern: /\bstartViewTransition\(/ }
];

function filesUnder(folder) {
	const found = [];
	for (const name of readdirSync(folder)) {
		const full = path.join(folder, name);
		if (statSync(full).isDirectory()) found.push(...filesUnder(full));
		else if (checkedSuffixes.has(path.extname(name))) found.push(full);
	}
	return found;
}

function lineOf(text, index) {
	return text.slice(0, index).split('\n').length;
}

let problems = 0;
function report(file, line, message) {
	console.error(`${file}:${line}: ${message}`);
	problems += 1;
}

for (const file of folders.flatMap(filesUnder)) {
	if (path.normalize(file) === motionModule) continue;
	const text = readFileSync(file, 'utf8');

	if (['.svelte', '.css', '.html'].includes(path.extname(file))) {
		motionDeclaration.lastIndex = 0;
		for (const match of text.matchAll(motionDeclaration)) {
			const value = match[1];
			if (timeLiteral.test(value)) {
				report(file, lineOf(text, match.index), 'motion time written out; use a --motion-duration-* token');
			}
			if (easingLiteral.test(value)) {
				report(file, lineOf(text, match.index), 'easing written out; use a --motion-easing-* token');
			}
		}
	}

	text.split('\n').forEach((line, index) => {
		for (const { name, pattern } of scriptPatterns) {
			if (pattern.test(line)) report(file, index + 1, `${name}; use src/lib/motion.ts instead`);
		}
	});
}

if (problems > 0) {
	console.error(`\n${problems} motion setting(s) not taken from the motion tokens.`);
	process.exit(1);
}
console.log('All motion takes its timing from the motion tokens.');
