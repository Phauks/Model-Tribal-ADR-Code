// Lets the built Worker add a nation's own published changes to its
// prerendered page, after `vite build` and tools/add-scheduled-run.mjs. Run
// from site/:
//   node tools/add-nation-page-changes.mjs
//
// It copies tools/nation-page-changes-worker.js beside the built Worker,
// writes an entry file that wraps the current entry with it, points the
// built Wrangler configuration at that entry, and asks Cloudflare to run the
// Worker first for nation pages and nations' offline lists. Without that, the
// static assets would answer /nations/<id> before the Worker saw it (decision
// record 0041, "Stage 2").

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const workerFolder = '.svelte-kit/cloudflare/worker';
const configPath = path.join(workerFolder, 'wrangler.json');
const entryName = 'nation-pages-entry.js';
const helperName = 'nation-page-changes.js';
export const workerFirstPaths = ['/nations/*', '/copies/offline/nations/*'];

/** @param {string} innerEntry the entry the build made, such as scheduled-entry.js */
export function entrySource(innerEntry) {
	return `// Written by tools/add-nation-page-changes.mjs after the build.
import worker from './${innerEntry}';
import { withNationPageChanges } from './${helperName}';

export default withNationPageChanges(worker);
`;
}

/**
 * The built configuration with the new entry and the Worker run first for nation pages.
 * @param {{ main?: string, assets?: { run_worker_first?: boolean | string[], [key: string]: unknown }, [key: string]: unknown }} config
 */
export function wrappedConfig(config) {
	const runFirst = config.assets?.run_worker_first;
	const paths = Array.isArray(runFirst) ? runFirst : runFirst === true ? null : [];
	return {
		...config,
		main: entryName,
		assets: { ...config.assets, run_worker_first: paths === null ? true : [...new Set([...paths, ...workerFirstPaths])] }
	};
}

function main() {
	if (!existsSync(configPath)) {
		console.error(`${configPath} is missing; run vite build first.`);
		process.exit(1);
	}
	const config = JSON.parse(readFileSync(configPath, 'utf8'));
	if (config.main === entryName) {
		console.log('Nation page changes are already added.');
		return;
	}
	copyFileSync('tools/nation-page-changes-worker.js', path.join(workerFolder, helperName));
	writeFileSync(path.join(workerFolder, entryName), entrySource(config.main));
	writeFileSync(configPath, JSON.stringify(wrappedConfig(config), null, 2));
	console.log(`Added nation page changes: ${path.join(workerFolder, entryName)}`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) main();
