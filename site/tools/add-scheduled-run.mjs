// Adds a scheduled handler to the built Worker, after `vite build`. Run from site/:
//   node tools/add-scheduled-run.mjs
//
// The SvelteKit adapter for Cloudflare makes a Worker with a fetch handler
// only, so the hourly cron trigger in wrangler.jsonc ("triggers") would have
// nothing to call. This writes a small entry file beside the adapter's
// index.js that keeps its fetch handler and adds `scheduled`, then points
// the built Wrangler configuration at it. The scheduled handler passes the
// run to the address scheduledPaths names for its cron trigger (the hourly
// /following/scheduled, the weekly /address-book/scheduled, /events/scheduled every 15 minutes) inside the same copy of the Worker, with a
// random token made when that copy starts and kept only in its memory
// (src/lib/server/scheduled-run.ts), so nothing outside can start a run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const workerFolder = '.svelte-kit/cloudflare/worker';
const configPath = path.join(workerFolder, 'wrangler.json');
const entryName = 'scheduled-entry.js';

// The same key and header as src/lib/server/scheduled-run.ts; tests/scheduled-run.test.ts checks they agree.
export const scheduledTokenKey = 'model-tribal-adr-code.scheduled-run-token';
export const scheduledTokenHeader = 'x-scheduled-run';

// Which address inside the Worker each cron trigger in wrangler.jsonc runs.
// The weekly one checks the private address book against the federal and
// Alaska directories and the nation pages (src/lib/server/address-book.ts).
export const scheduledPaths = {
	'17 * * * *': '/following/scheduled',
	'41 9 * * 1': '/address-book/scheduled',
	'4,19,34,49 * * * *': '/events/scheduled'
};

export function entrySource() {
	return `// Written by tools/add-scheduled-run.mjs after the build.
import worker from './index.js';

// Workers may not make random values at start-up, so the token is made by
// the first scheduled run in this copy of the Worker, and kept for the next.
function runToken() {
	const key = ${JSON.stringify(scheduledTokenKey)};
	if (typeof globalThis[key] !== 'string') {
		globalThis[key] = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
	}
	return globalThis[key];
}

export default {
	fetch: worker.fetch,
	async scheduled(controller, env, context) {
		const token = runToken();
		const site = (env.SITE_ADDRESS || 'https://scheduled.invalid').replace(/\\/+$/, '');
		const paths = ${JSON.stringify(scheduledPaths)};
		const target = paths[controller.cron] ?? '/following/scheduled';
		const request = new Request(\`\${site}\${target}\`, {
			method: 'POST',
			// The site's own origin and a JSON body, so SvelteKit's and the site's
			// checks against changes sent from other sites let the run through.
			headers: { ${JSON.stringify(scheduledTokenHeader)}: token, origin: site, 'content-type': 'application/json' },
			body: '{}'
		});
		const response = await worker.fetch(request, env, context);
		if (!response.ok) throw new Error(\`The scheduled run of \${target} failed: \${response.status} \${await response.text()}\`);
		console.log('Scheduled run', controller.cron, target, await response.text());
	}
};
`;
}

function main() {
	if (!existsSync(configPath)) {
		console.error(`${configPath} is missing; run vite build first.`);
		process.exit(1);
	}
	const config = JSON.parse(readFileSync(configPath, 'utf8'));
	if (config.main !== 'index.js' && config.main !== entryName) {
		console.error(`Expected the built Worker's main file to be index.js, found ${config.main}.`);
		process.exit(1);
	}
	writeFileSync(path.join(workerFolder, entryName), entrySource());
	config.main = entryName;
	writeFileSync(configPath, JSON.stringify(config, null, 2));
	console.log(`Added a scheduled handler: ${path.join(workerFolder, entryName)}`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) main();
