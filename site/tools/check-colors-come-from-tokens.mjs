// Fails if any source file names a color of its own. Every color must come
// from site/design-tokens.json through a --color-* custom property, so a
// palette change touches only the tokens file (site/DESIGN.md, section 7).
//
// Run from site/:  node tools/check-colors-come-from-tokens.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const folders = ['src'];
const checkedSuffixes = new Set(['.svelte', '.css', '.ts', '.js', '.html']);
// The token converter is the one place allowed to handle color values.
const allowedFiles = new Set([path.normalize('src/lib/design-tokens.ts')]);

const colorPatterns = [
	{ name: 'hexadecimal color', pattern: /(?<![\w&/-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![\w-])/g },
	{ name: 'color function', pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g },
	{
		name: 'named color',
		pattern:
			/(?:color|background|background-color|border(?:-[a-z]+)*|outline|fill|stroke|box-shadow)\s*:\s*[^;]*\b(?:white|black|red|green|blue|yellow|orange|purple|gray|grey|teal|navy)\b/g
	}
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

let problems = 0;
for (const file of folders.flatMap(filesUnder)) {
	if (allowedFiles.has(path.normalize(file))) continue;
	const lines = readFileSync(file, 'utf8').split('\n');
	lines.forEach((line, index) => {
		for (const { name, pattern } of colorPatterns) {
			pattern.lastIndex = 0;
			if (pattern.test(line)) {
				console.error(`${file}:${index + 1}: ${name} found; use a --color-* token instead`);
				problems += 1;
			}
		}
	});
}

if (problems > 0) {
	console.error(`\n${problems} color(s) not taken from design-tokens.json.`);
	process.exit(1);
}
console.log('Every color comes from design-tokens.json.');
