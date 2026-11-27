// Fails when a file has more silent catches than it had when the rule began
// (site/ERRORS.md, "No silent fallbacks"; Trevor approved it on Nov. 27, 2026).
//
// A catch, whether `catch { … }` or `.catch(…)`, is silent unless it:
// - throws, or answers with an HTTP error (error(404, …), fail(…), redirect(…), a 4xx or 5xx status);
// - reports the problem (report, reportHere, sendProblem) or logs it (console.error, console.warn);
// - keeps it to show the reader, in a variable or field named for a problem, a failure or an error; or
// - says why dropping it is right, with a comment that starts `expected:`, such as
//   `// expected: a reader's own text that is not JSON is ignored.`
//
// The files had 321 silent catches when this check began. Each file may keep
// as many as tools/silent-catches-baseline.json lists, and no more, so the
// number only falls. After fixing some, run with --update to lower the
// baseline (it never raises a file's number unless given --allow-more).
//
// Run from site/:  node tools/check-silent-catches.mjs [--update] [--list <file>]

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const site = path.resolve(import.meta.dirname, '..');
const baselineFile = path.join(site, 'tools/silent-catches-baseline.json');
const folders = ['src', 'live', 'scanner', 'wayback', 'watch'];
const skipFolders = new Set(['node_modules', 'engine', '.svelte-kit']);

/** @param {string} folder @returns {string[]} */
function filesUnder(folder) {
	/** @type {string[]} */
	const found = [];
	if (!existsSync(folder)) return found;
	for (const name of readdirSync(folder)) {
		const full = path.join(folder, name);
		if (statSync(full).isDirectory()) {
			if (!skipFolders.has(name)) found.push(...filesUnder(full));
		} else if (/\.(ts|js|mjs|svelte)$/.test(name) && !name.endsWith('.d.ts')) found.push(full);
	}
	return found;
}

/**
 * The text between a bracket and its partner.
 * @param {string} text @param {number} start @param {string} open @param {string} close
 */
function enclosed(text, start, open, close) {
	let depth = 0;
	for (let index = start; index < text.length; index++) {
		const character = text[index];
		if (character === open) depth++;
		else if (character === close) {
			depth--;
			if (depth === 0) return text.slice(start + 1, index);
		}
	}
	return text.slice(start + 1, start + 400);
}

const withoutComments = (/** @type {string} */ text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const handledPatterns = [
	/\bthrow\b/,
	/\b(?:error|fail)\(\s*\d/,
	/\bfail\(/,
	/\bredirect\(/,
	/\bstatus:\s*[45]\d\d/,
	/\b(?:report|reportHere|sendProblem)\(/,
	/\bconsole\.(?:error|warn)\(/,
	/\b\w*(?:problem|Problem|fail|Fail|error|Error|trouble)\w*\s*(?:[:=](?!=)|\+=)/,
	/\bon(?:fail|error)\b/,
	/\bfail\b/
];

/**
 * Every catch in a text, with its line and whether it is silent.
 * @param {string} text
 * @returns {{ line: number, silent: boolean }[]}
 */
export function catchesIn(text) {
	/** @type {{ line: number, silent: boolean }[]} */
	const found = [];
	/** @param {number} index @param {string} body */
	const consider = (index, body) => {
		const line = text.slice(0, index).split('\n').length;
		if (/\bexpected:/i.test(body)) return found.push({ line, silent: false });
		const code = withoutComments(body);
		found.push({ line, silent: !handledPatterns.some((pattern) => pattern.test(code)) });
	};
	for (const match of text.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{/g)) {
		consider(match.index ?? 0, enclosed(text, (match.index ?? 0) + match[0].length - 1, '{', '}'));
	}
	for (const match of text.matchAll(/\.catch\(/g)) {
		consider(match.index ?? 0, enclosed(text, (match.index ?? 0) + match[0].length - 1, '(', ')'));
	}
	return found;
}

function countAll() {
	/** @type {Record<string, number>} */
	const counts = {};
	/** @type {Record<string, number[]>} */
	const lines = {};
	for (const folder of folders) {
		for (const file of filesUnder(path.join(site, folder))) {
			const relative = path.relative(site, file).split(path.sep).join('/');
			const silent = catchesIn(readFileSync(file, 'utf8')).filter((item) => item.silent);
			if (silent.length > 0) {
				counts[relative] = silent.length;
				lines[relative] = silent.map((item) => item.line);
			}
		}
	}
	return { counts, lines };
}

/** @param {Record<string, number>} object */
function sorted(object) {
	return Object.fromEntries(Object.entries(object).sort(([first], [second]) => first.localeCompare(second)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
	const { counts, lines } = countAll();
	const listIndex = process.argv.indexOf('--list');
	if (listIndex > -1) {
		const file = process.argv[listIndex + 1];
		console.log(`${file}: silent catches at lines ${(lines[file] ?? []).join(', ') || 'none'}`);
		process.exit(0);
	}
	/** @type {Record<string, number>} */
	const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {};
	const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
	if (process.argv.includes('--update')) {
		const allowMore = process.argv.includes('--allow-more');
		/** @type {Record<string, number>} */
		const next = {};
		for (const [file, count] of Object.entries(counts)) next[file] = allowMore ? count : Math.min(count, baseline[file] ?? count);
		writeFileSync(baselineFile, `${JSON.stringify(sorted(next), null, '\t')}\n`);
		console.log(`Wrote ${path.relative(site, baselineFile)}: ${total} silent catches in ${Object.keys(next).length} files.`);
		process.exit(0);
	}
	const over = Object.entries(counts).filter(([file, count]) => count > (baseline[file] ?? 0));
	const under = Object.entries(baseline).filter(([file, count]) => (counts[file] ?? 0) < count);
	for (const [file, count] of over) {
		console.error(`${file}: ${count} silent catches, more than the ${baseline[file] ?? 0} allowed (lines ${(lines[file] ?? []).join(', ')}).`);
	}
	if (over.length > 0) {
		console.error('\nReport the problem, show it, throw it, or say why dropping it is right with an `expected:` comment (site/ERRORS.md, "No silent fallbacks").');
		process.exit(1);
	}
	if (under.length > 0) console.log(`${under.length} files now have fewer silent catches than the baseline; run with --update to lower it.`);
	console.log(`Silent catches: ${total}, none more than the baseline allows.`);
}
