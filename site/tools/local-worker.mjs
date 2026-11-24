// Starts the built Worker on this computer with `wrangler dev`, as
// `npm run preview` does but without building first, for the checks that
// need the pages the Worker answers (tools/check-built-worker.mjs,
// tools/check-accessibility-live.mjs). Run `npm run build` first. It uses
// the local copies of the database and buckets, never the live ones.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';

export const builtConfiguration = '.svelte-kit/cloudflare/worker/wrangler.json';

async function freePort() {
	const server = createServer();
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();
	await new Promise((resolve) => server.close(resolve));
	return port;
}

/**
 * Starts `wrangler dev` and waits until the Worker answers. Returns its
 * address and a function that stops it. Wrangler's output is kept and shown
 * only if the Worker does not start.
 *
 * @param {{ testScheduled?: boolean, waitAtMost?: number }} options
 *   testScheduled: let /cdn-cgi/handler/scheduled run the scheduled handler.
 */
export async function startLocalWorker({ testScheduled = false, waitAtMost = 120_000 } = {}) {
	if (!existsSync(builtConfiguration)) {
		throw new Error(`${builtConfiguration} does not exist. Run npm run build first.`);
	}
	const port = await freePort();
	const argumentsList = ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--show-interactive-dev-session=false', '--log-level', 'warn'];
	if (testScheduled) argumentsList.push('--test-scheduled');
	const child = spawn('npx', argumentsList, {
		// Its own process group, so stopping it also stops workerd.
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, CI: process.env.CI ?? '1', WRANGLER_SEND_METRICS: 'false' }
	});
	let log = '';
	child.stdout.on('data', (chunk) => (log += chunk));
	child.stderr.on('data', (chunk) => (log += chunk));
	let exited = false;
	child.on('exit', () => (exited = true));

	const stop = async () => {
		if (exited) return;
		try {
			process.kill(-child.pid, 'SIGTERM');
		} catch {
			return;
		}
		const deadline = Date.now() + 10_000;
		while (!exited && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
		if (!exited) {
			try {
				process.kill(-child.pid, 'SIGKILL');
			} catch {
				// Already gone.
			}
		}
	};

	const base = `http://127.0.0.1:${port}`;
	const deadline = Date.now() + waitAtMost;
	while (Date.now() < deadline) {
		if (exited) break;
		try {
			await fetch(`${base}/`, { signal: AbortSignal.timeout(5_000) });
			return { base, stop, log: () => log };
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	await stop();
	throw new Error(`The built Worker did not start${exited ? '' : ` within ${waitAtMost / 1000} s`}. Wrangler said:\n${log}`);
}
