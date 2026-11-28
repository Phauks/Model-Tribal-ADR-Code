// Splits the built static files too large for Cloudflare into parts, and wraps the built Worker so each still answers at its own address with the same bytes (tools/joined-files-worker.js). Run from site/ after tools/add-scheduled-run.mjs and before tools/add-nation-page-changes.mjs (package.json "build"):
//   node tools/split-large-files.mjs
//
// Cloudflare refuses a static file over 25 MiB, and tools/check-worker-size.mjs fails one over 20 MiB. On Nov. 28, 2026 three files the build makes had grown past that, and they grow with every data pull: the list of every copy (/copies/list.csv, 21 MiB), the list of United States documents to save offline (/copies/offline/federal.json, 24 MiB) and the finder's index of every page (/offline-catalog/index.json, 21 MiB). Any built file over splitOver is split into parts of partBytes, so the next file to grow past the limit is split too, and a file split into more parts as it grows. The scripts and styles in /_app/ are left whole, for the size check to name: a script that large needs splitting where it is made, and its parts would lose the caching /_app/immutable/ has.
//
// The parts go under /page-data/private/parts/, which readers cannot ask for (tools/nation-page-changes-worker.js, privateData), so a part of the list of copies cannot show a copy a nation chose to hide: the list goes out only as src/routes/restricted-files filters it. Each part keeps the file's extension, so Cloudflare gives it the file's type. The parts of every split file are listed, with the file's size and SHA-256, in /page-data/private/parts.json.
//
// It runs after tools/write-checksums.mjs, which reads the whole list of copies, and it wraps the entry inside the nation page changes, so a file the Worker filters reaches the joining wrapper only as /restricted-files/<address>.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const mebibyte = 1024 * 1024;
/** A file over this size is split: where tools/check-worker-size.mjs fails one, 5 MiB under Cloudflare's limit. */
export const splitOver = 20 * mebibyte;
/** The size of each part but the last. */
export const partBytes = 8 * mebibyte;

const output = '.svelte-kit/cloudflare/client';
const workerFolder = '.svelte-kit/cloudflare/worker';
const configPath = path.join(workerFolder, 'wrangler.json');
const entryName = 'joined-files-entry.js';
const helperName = 'joined-files.js';
/** Where the parts are kept, and the list of them (tools/joined-files-worker.js, partsListAddress). */
export const partsFolder = 'page-data/private/parts';
export const partsListFile = 'page-data/private/parts.json';

/** @param {string} innerEntry the entry the build made before this step, such as scheduled-entry.js */
export function entrySource(innerEntry) {
	return `// Written by tools/split-large-files.mjs after the build.
import worker from './${innerEntry}';
import { withJoinedFiles } from './${helperName}';

export default withJoinedFiles(worker);
`;
}

/**
 * The parts' addresses for a file of this size: /page-data/private/parts/copies/list.csv/1.csv and on.
 * @param {string} address the file's address, such as /copies/list.csv
 * @param {number} bytes
 */
export function partAddresses(address, bytes) {
	const extension = path.posix.extname(address);
	const count = Math.max(1, Math.ceil(bytes / partBytes));
	return Array.from({ length: count }, (_, index) => `/${partsFolder}${address}/${index + 1}${extension}`);
}

/** @param {string} folder @returns {string[]} every file under the folder, relative to it */
function filesUnder(folder) {
	/** @type {string[]} */
	const found = [];
	/** @param {string} current */
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile()) found.push(full);
		}
	};
	walk(folder);
	return found;
}

/**
 * Splits every file over splitOver in the folder and writes the list of parts.
 * @param {string} folder the built static files
 * @returns {Record<string, { bytes: number, sha256: string, parts: string[] }>} the split files, by address
 */
export function splitLargeFiles(folder) {
	rmSync(path.join(folder, partsFolder), { recursive: true, force: true });
	/** @type {Record<string, { bytes: number, sha256: string, parts: string[] }>} */
	const split = {};
	for (const full of filesUnder(folder)) {
		const bytes = statSync(full).size;
		if (bytes <= splitOver) continue;
		const address = `/${path.relative(folder, full).split(path.sep).join('/')}`;
		if (address.startsWith('/_app/')) continue;
		const content = readFileSync(full);
		const parts = partAddresses(address, bytes);
		parts.forEach((part, index) => {
			const target = path.join(folder, part.slice(1));
			mkdirSync(path.dirname(target), { recursive: true });
			writeFileSync(target, content.subarray(index * partBytes, (index + 1) * partBytes));
		});
		split[address] = { bytes, sha256: createHash('sha256').update(content).digest('hex'), parts };
		rmSync(full);
	}
	writeFileSync(path.join(folder, partsListFile), `${JSON.stringify(split, null, '\t')}\n`);
	return split;
}

function main() {
	if (!existsSync(configPath) || !existsSync(output)) {
		console.error(`${configPath} is missing; run vite build first.`);
		process.exit(1);
	}
	const config = JSON.parse(readFileSync(configPath, 'utf8'));
	if (config.main === entryName) {
		console.log('The large files are already split.');
		return;
	}
	if (config.main !== 'scheduled-entry.js') {
		console.error(`Expected the built Worker's main file to be scheduled-entry.js, found ${config.main}: this step must wrap the Worker inside the nation page changes.`);
		process.exit(1);
	}
	const split = splitLargeFiles(output);
	copyFileSync('tools/joined-files-worker.js', path.join(workerFolder, helperName));
	writeFileSync(path.join(workerFolder, entryName), entrySource(config.main));
	config.main = entryName;
	writeFileSync(configPath, JSON.stringify(config, null, 2));
	for (const [address, file] of Object.entries(split)) console.log(`Split ${address} (${(file.bytes / mebibyte).toFixed(1)} MiB) into ${file.parts.length} parts.`);
	console.log(`Added joined files: ${path.join(workerFolder, entryName)}`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) main();
