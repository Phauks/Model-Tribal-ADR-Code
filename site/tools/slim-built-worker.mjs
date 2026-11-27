// Takes out of the built Worker what it carries twice or never runs, after
// every other step of the build (package.json "build"). Run from site/:
//   node tools/slim-built-worker.mjs
//
// Cloudflare counts every JavaScript file beside the Worker toward its
// 64 MiB limit (the built wrangler.json uploads them all as modules), so
// size the Worker never uses still counts (tools/check-worker-size.mjs).
// By Nov. 27, 2026 the adapter's output held the list of every prerendered
// page, 31,000 addresses and 1.8 MB, three times:
//
// - server/manifest.js, the manifest SvelteKit used while it prerendered,
//   which nothing in the Worker imports. It and server/manifest-full.js are
//   deleted.
// - server.js, the Worker's own manifest (prerendered_routes), and
//   index.js, the adapter's entry, which checks the same list to send
//   prerendered pages to the static files. index.js is rewritten to use
//   the list in server.js.
//
// Each step checks that the output has the form it expects and leaves it as
// it is otherwise, saying so: a SvelteKit update may change it, and the
// Worker is still right, only bigger.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const workerFolder = '.svelte-kit/cloudflare/worker';

/**
 * Every JavaScript file in a folder, by its path relative to the folder.
 * @param {string} folder
 * @returns {string[]}
 */
function scripts(folder) {
	/** @type {string[]} */
	const found = [];
	/** @param {string} current */
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.js')) found.push(path.relative(folder, full));
		}
	};
	walk(folder);
	return found;
}

/**
 * Whether any script but the file itself names it in an import.
 * @param {string} file
 * @param {Record<string, string>} sources each script's text, by its path
 */
export function isImported(file, sources) {
	const name = path.basename(file).replaceAll('.', '\\.');
	const naming = new RegExp(`(?:from\\s*|import\\s*\\(\\s*|import\\s+)["'][^"']*/${name}["']`);
	return Object.entries(sources).some(([other, source]) => other !== file && naming.test(source));
}

const prerenderedInManifest = /^(\s*)prerendered_routes: new Set\((\[[^\n]*\])\),$/m;
const prerenderedInEntry = /^const prerendered = new Set\((\[[^\n]*\])\);$/m;
const manifestStart = /^const manifest = \(\(\) => \{$/m;

/**
 * server.js exporting its manifest, and index.js reading the prerendered
 * pages from it instead of from a copy of its own; undefined when either is
 * not as expected or the two lists differ.
 * @param {string} serverSource
 * @param {string} entrySource
 * @returns {{ server: string, entry: string } | undefined}
 */
export function sharePrerenderedList(serverSource, entrySource) {
	const inManifest = prerenderedInManifest.exec(serverSource);
	const inEntry = prerenderedInEntry.exec(entrySource);
	if (!inManifest || !inEntry || !manifestStart.test(serverSource)) return undefined;
	if (!/^import \{ server \} from '\.\/server\.js';$/m.test(entrySource)) return undefined;
	if (inManifest[2] !== inEntry[1]) return undefined;
	return {
		server: serverSource.replace(manifestStart, 'export const manifest = (() => {'),
		entry: entrySource
			.replace(/^import \{ server \} from '\.\/server\.js';$/m, "import { server, manifest as serverManifest } from './server.js';")
			.replace(prerenderedInEntry, () => '// The same list as the manifest in server.js (tools/slim-built-worker.mjs).\nconst prerendered = serverManifest.prerendered_routes;')
	};
}

function main() {
	if (!existsSync(path.join(workerFolder, 'wrangler.json'))) {
		console.error(`${workerFolder}/wrangler.json is missing; run vite build first.`);
		process.exit(1);
	}
	const sources = Object.fromEntries(scripts(workerFolder).map((file) => [file, readFileSync(path.join(workerFolder, file), 'utf8')]));
	let saved = 0;

	for (const file of ['server/manifest.js', 'server/manifest-full.js']) {
		if (!(file in sources)) continue;
		if (isImported(file, sources)) {
			console.log(`Kept ${file}: another file imports it.`);
			continue;
		}
		saved += Buffer.byteLength(sources[file]);
		rmSync(path.join(workerFolder, file));
		rmSync(path.join(workerFolder, `${file}.map`), { force: true });
	}

	const shared = sources['server.js'] && sources['index.js'] ? sharePrerenderedList(sources['server.js'], sources['index.js']) : undefined;
	if (shared) {
		saved += Buffer.byteLength(sources['index.js']) - Buffer.byteLength(shared.entry);
		writeFileSync(path.join(workerFolder, 'server.js'), shared.server);
		writeFileSync(path.join(workerFolder, 'index.js'), shared.entry);
	} else {
		console.log('Kept the list of prerendered pages in index.js: server.js and index.js are not as this step expects.');
	}
	console.log(`Slimmed the built Worker by ${(saved / 1024 / 1024).toFixed(1)} MiB.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
