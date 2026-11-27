// Tells Cloudflare's edge which of the Worker's answers it may keep, after
// every other step of the build (package.json "build"). Run from site/:
//   node tools/add-edge-cache.mjs
//
// It copies tools/edge-cache-worker.js beside the built Worker and writes an
// entry file that wraps the current entry with it, so the wrapper sees every
// answer the Worker gives a reader, whichever step made it
// (docs/edge-caching.md).

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const workerFolder = '.svelte-kit/cloudflare/worker';
const configPath = path.join(workerFolder, 'wrangler.json');
export const entryName = 'edge-cache-entry.js';
const helperName = 'edge-cache.js';

/** @param {string} innerEntry the entry the build made before this step, such as mail-entry.js */
export function entrySource(innerEntry) {
	return `// Written by tools/add-edge-cache.mjs after the build.
import worker from './${innerEntry}';
import { withEdgeCachePolicy } from './${helperName}';

export default withEdgeCachePolicy(worker);
`;
}

function main() {
	if (!existsSync(configPath)) {
		console.error(`${configPath} is missing; run vite build first.`);
		process.exit(1);
	}
	const config = JSON.parse(readFileSync(configPath, 'utf8'));
	if (typeof config.main !== 'string' || config.main === entryName) {
		console.error(`Expected the built Worker's main file to be another step's entry, found ${config.main}.`);
		process.exit(1);
	}
	if (config.cache?.enabled !== true) {
		console.error('Workers Cache is not switched on in the built configuration ("cache" in wrangler.jsonc).');
		process.exit(1);
	}
	copyFileSync('tools/edge-cache-worker.js', path.join(workerFolder, helperName));
	writeFileSync(path.join(workerFolder, entryName), entrySource(config.main));
	config.main = entryName;
	writeFileSync(configPath, JSON.stringify(config, null, 2));
	console.log(`Added the edge cache policy: ${path.join(workerFolder, entryName)}`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) main();
