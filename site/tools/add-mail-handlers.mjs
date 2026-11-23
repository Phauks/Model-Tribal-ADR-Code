// Adds the project inbox's handlers to the built Worker, after `vite build`.
// Run from site/:
//   node tools/add-mail-handlers.mjs
//
// The SvelteKit adapter for Cloudflare makes a Worker with a fetch handler
// only. The inbox also needs (site/MAIL.md):
//
// - email: mail from Cloudflare Email Routing;
// - scheduled: the run every five minutes (wrangler.jsonc, "triggers");
// - queue: delivery events from Cloudflare Email Service;
// - and, in fetch, one-click unsubscribe requests (RFC 8058), which mail
//   programs post without an Origin header, so SvelteKit's check against
//   forms from other sites would refuse them.
//
// This writes a small entry file that wraps whatever the built Worker's main
// file is (the adapter's index.js, or an entry another build step wrote), so
// it must run last. Each handler passes its work to a route under
// /mail/internal/ inside the same copy of the Worker, with a random token
// made at the first run and kept only in that copy's memory
// (src/lib/server/mail/internal-run.ts), so nothing outside can start a run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const workerFolder = '.svelte-kit/cloudflare/worker';
const configPath = path.join(workerFolder, 'wrangler.json');
const entryName = 'mail-entry.js';

// The same key and header as src/lib/server/mail/internal-run.ts; tests/mail-handlers.test.ts checks they agree.
export const mailRunTokenKey = 'model-tribal-adr-code.mail-run-token';
export const mailRunHeader = 'x-mail-run';
// The cron expression of the mail run in wrangler.jsonc.
export const mailCron = '*/5 * * * *';

/** @param {string} innerMain The built Worker's main file, which the entry wraps. */
export function entrySource(innerMain) {
	return `// Written by tools/add-mail-handlers.mjs after the build.
import worker from ${JSON.stringify(`./${innerMain}`)};

// Workers may not make random values at start-up, so the token is made by
// the first run in this copy of the Worker, and kept for the next.
function runToken() {
	const key = ${JSON.stringify(mailRunTokenKey)};
	if (typeof globalThis[key] !== 'string') {
		globalThis[key] = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
	}
	return globalThis[key];
}

async function internal(env, context, address, body, contentType) {
	const site = (env.SITE_ADDRESS || 'https://mail.invalid').replace(/\\/+$/, '');
	const request = new Request(site + address, {
		method: 'POST',
		headers: { ${JSON.stringify(mailRunHeader)}: runToken(), origin: site, 'content-type': contentType },
		body
	});
	const response = await worker.fetch(request, env, context);
	if (!response.ok) throw new Error(\`The mail run at \${address} failed: \${response.status} \${await response.text()}\`);
	return response.json();
}

const oneClick = /^\\/mail\\/unsubscribe\\/[a-z2-7]+\\/one-click$/;

export default {
	...worker,
	async fetch(request, env, context) {
		if (request.method === 'POST' && oneClick.test(new URL(request.url).pathname)) {
			request = new Request(request.url, { method: 'POST', headers: { 'content-type': 'application/x-one-click-unsubscribe' }, body: '' });
		}
		return worker.fetch(request, env, context);
	},
	async email(message, env, context) {
		// The raw stream can be read only once.
		const raw = await new Response(message.raw).arrayBuffer();
		const query = \`?from=\${encodeURIComponent(message.from)}&to=\${encodeURIComponent(message.to)}\`;
		if (!env.mailFiles) {
			const result = await internal(env, context, '/mail/internal/arrive' + query, raw, 'message/rfc822');
			if (result.outcome === 'rejected') message.setReject(result.reason);
			return;
		}
		// Kept whole in the mail bucket before anything else (site/MAIL.md, "When something fails"). If even this fails, the
		// handler fails, and Email Routing records an error for the message.
		const key = 'mail/incoming/' + crypto.randomUUID() + '.eml';
		await env.mailFiles.put(key, raw, {
			httpMetadata: { contentType: 'message/rfc822' },
			customMetadata: { from: String(message.from).slice(0, 500), to: String(message.to).slice(0, 500) }
		});
		try {
			const result = await internal(env, context, '/mail/internal/arrive?key=' + encodeURIComponent(key), '', 'text/plain');
			if (result.outcome === 'rejected') message.setReject(result.reason);
		} catch (problem) {
			// The message is kept; the mail run files it later.
			console.error('Filing failed; the message is kept for the mail run', problem);
		}
	},
	async scheduled(controller, env, context) {
		if (controller.cron === ${JSON.stringify(mailCron)}) {
			console.log('Mail run', JSON.stringify(await internal(env, context, '/mail/internal/tick', '{}', 'application/json')));
			return;
		}
		if (worker.scheduled) return worker.scheduled(controller, env, context);
	},
	async queue(batch, env, context) {
		await internal(env, context, '/mail/internal/delivery', JSON.stringify(batch.messages.map((item) => item.body)), 'application/json');
		batch.ackAll();
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
	if (typeof config.main !== 'string' || config.main === entryName) {
		console.error(`Expected the built Worker's main file to be another build's entry, found ${config.main}.`);
		process.exit(1);
	}
	writeFileSync(path.join(workerFolder, entryName), entrySource(config.main));
	config.main = entryName;
	writeFileSync(configPath, JSON.stringify(config, null, 2));
	console.log(`Added the mail handlers: ${path.join(workerFolder, entryName)}`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) main();
