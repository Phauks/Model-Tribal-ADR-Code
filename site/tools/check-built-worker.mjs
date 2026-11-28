// Checks that the built Worker starts and that the steps after `vite build`
// patched it as they should (package.json "build"). Run from site/ after
// `npm run build`:
//   node tools/check-built-worker.mjs
//
// The Cloudflare adapter makes a Worker with only a fetch handler; the build
// then wraps it five times (tools/add-scheduled-run.mjs,
// tools/split-large-files.mjs, tools/add-nation-page-changes.mjs,
// tools/add-mail-handlers.mjs, tools/add-edge-cache.mjs). Those
// steps rely on how the adapter lays out its output, so a new adapter could
// break them without any error at build time. The adapter's version is
// pinned in package.json for that reason; this check is what to run after
// changing it.
//
// It starts the built Worker with `wrangler dev` on the local copy of the
// database (migrated first, never the live one), then asks for a
// prerendered page, a page only the Worker answers, a nation page (which the
// Worker answers first) and each file split into parts, runs two of the scheduled handler's cron triggers
// and hands the email handler a message.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { builtConfiguration, startLocalWorker } from './local-worker.mjs';
import { migrateLocally } from './seed-local-database.mjs';
import { mailCron } from './add-mail-handlers.mjs';
import { scheduledPaths } from './add-scheduled-run.mjs';
import { partsListFile } from './split-large-files.mjs';

const problems = [];
const check = (condition, message) => {
	if (!condition) problems.push(message);
};

// 1. The entry files wrap one another in the order the build wrote them.
const workerFolder = path.dirname(builtConfiguration);
const staticFolder = path.join(workerFolder, '..', 'client');
const configuration = JSON.parse(readFileSync(builtConfiguration, 'utf8'));
const chain = ['edge-cache-entry.js', 'mail-entry.js', 'nation-pages-entry.js', 'joined-files-entry.js', 'scheduled-entry.js', 'index.js'];
check(configuration.main === chain[0], `The built Worker's main file is ${configuration.main}, not ${chain[0]}`);
for (const [index, entry] of chain.slice(0, -1).entries()) {
	const source = readFileSync(path.join(workerFolder, entry), 'utf8');
	check(source.includes(`'./${chain[index + 1]}'`) || source.includes(`"./${chain[index + 1]}"`), `${entry} does not wrap ${chain[index + 1]}`);
}
check(configuration.cache?.enabled === true, 'Workers Cache is not switched on in the built configuration');
const edgeEntry = readFileSync(path.join(workerFolder, chain[0]), 'utf8');
check(edgeEntry.includes('withEdgeCachePolicy(worker)'), `${chain[0]} does not add the edge cache policy`);
const mailEntry = readFileSync(path.join(workerFolder, chain[1]), 'utf8');
for (const handler of ['fetch', 'email', 'scheduled', 'queue']) {
	check(new RegExp(`async ${handler}\\(`).test(mailEntry), `${chain[1]} has no ${handler} handler`);
}
check(
	Array.isArray(configuration.assets?.run_worker_first) && configuration.assets.run_worker_first.includes('/nations/*'),
	'The Worker does not run first for nation pages'
);

// 2. The Worker starts and answers.
migrateLocally();
const started = Date.now();
const worker = await startLocalWorker({ testScheduled: true });
try {
	const get = async (address, init) => {
		const response = await fetch(`${worker.base}${address}`, { redirect: 'manual', signal: AbortSignal.timeout(60_000), ...init });
		return { status: response.status, text: await response.text(), headers: response.headers };
	};

	const home = await get('/');
	check(home.status === 200 && home.text.includes('<h1'), `/ answered ${home.status}`);
	const signIn = await get('/sign-in');
	check(signIn.status === 200 && /<form/.test(signIn.text), `/sign-in, which only the Worker answers, answered ${signIn.status}`);
	// The edge may keep a built record page but never a signed-in page (tools/edge-cache-worker.js).
	check(signIn.headers.get('cloudflare-cdn-cache-control') === 'no-store', `/sign-in told the edge ${signIn.headers.get('cloudflare-cdn-cache-control')}, not no-store`);
	const casePage = await get('/cases/worcester-v-georgia');
	check(casePage.status === 200 && /^public, max-age=\d+$/.test(casePage.headers.get('cloudflare-cdn-cache-control') ?? ''), `A case page answered ${casePage.status} and told the edge ${casePage.headers.get('cloudflare-cdn-cache-control')}`);
	const nation = await get('/nations/hannahville-indian-community');
	check(nation.status === 200 && nation.text.includes('<h1'), `A nation page answered ${nation.status}`);

	// Each file split into parts answers at its own address with the whole file, and its parts are not served (tools/split-large-files.mjs).
	const split = JSON.parse(readFileSync(path.join(staticFolder, partsListFile), 'utf8'));
	for (const [address, file] of Object.entries(split)) {
		const response = await fetch(`${worker.base}${address}`, { signal: AbortSignal.timeout(120_000) });
		const body = Buffer.from(await response.arrayBuffer());
		const sha256 = createHash('sha256').update(body).digest('hex');
		check(response.status === 200 && body.length === file.bytes && sha256 === file.sha256, `${address}, split into parts, answered ${response.status} with ${body.length} bytes of SHA-256 ${sha256}`);
		const part = await get(file.parts[0]);
		check(part.status === 404, `${file.parts[0]}, a part of ${address}, answered ${part.status}, not 404`);
	}

	// 3. The scheduled handler runs the mail run and another cron trigger's run.
	const otherCron = Object.keys(scheduledPaths).find((cron) => [scheduledPaths[cron]].flat().includes('/events/scheduled'));
	for (const cron of [mailCron, otherCron]) {
		const run = await get(`/cdn-cgi/handler/scheduled?cron=${encodeURIComponent(cron)}`);
		check(run.status === 200, `The scheduled handler failed for "${cron}": ${run.status} ${run.text.slice(0, 300)}`);
	}

	// 4. The email handler takes a message. The inbox is switched off on a
	//    local copy (MAIL_DOMAIN is empty), so the handler turns it away, and
	//    Wrangler answers 400 "Worker rejected email": a run of the handler
	//    all the same.
	const message = [
		'From: Fixture Sender <sender@example.org>',
		'To: contact@example.org',
		'Subject: Built Worker check',
		`Message-ID: <built-worker-check-${Date.now()}@example.org>`,
		`Date: ${new Date().toUTCString()}`,
		'Content-Type: text/plain; charset=utf-8',
		'',
		'A message from tools/check-built-worker.mjs.'
	].join('\r\n');
	const email = await get('/cdn-cgi/handler/email?from=sender%40example.org&to=contact%40example.org', {
		method: 'POST',
		body: message
	});
	check(
		email.status === 200 || (email.status === 400 && email.text.includes('Worker rejected email')),
		`The email handler failed: ${email.status} ${email.text.slice(0, 300)}`
	);
} finally {
	await worker.stop();
}

if (problems.length > 0) {
	console.error(`${problems.length} problem(s) with the built Worker:\n- ${problems.join('\n- ')}`);
	process.exit(1);
}
console.log(`The built Worker started and its fetch, scheduled and email handlers answered (${Math.round((Date.now() - started) / 1000)} s).`);
