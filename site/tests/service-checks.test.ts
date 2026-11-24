import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runServiceChecks, serviceChecks, trySmtpSignIn, type CheckSocket } from '../src/lib/server/service-checks.ts';
import { testDatabase } from './database.ts';

const migrationFiles = readdirSync(path.resolve(import.meta.dirname, '../migrations'))
	.filter((name) => name.endsWith('.sql'))
	.sort();

const bucket = { list: async () => ({ objects: [] }) };

function environment(extra: Record<string, unknown> = {}): WorkerEnvironment {
	return { database: testDatabase(), sourceDocuments: bucket, ...extra } as unknown as WorkerEnvironment;
}

const noNetwork: typeof fetch = async () => {
	throw new Error('No network in tests');
};

async function check(key: string, env: WorkerEnvironment, fetcher: typeof fetch = noNetwork, openSocket?: Parameters<typeof runServiceChecks>[0]['openSocket']) {
	const [result] = await runServiceChecks({ environment: env, fetcher, migrationFiles, openSocket }, key);
	return result;
}

/** A pretend SMTP server: answers each command line from a script. */
function smtpServer(answers: Record<string, string>, greeting = '220 smtp.example.org ESMTP'): { socket: CheckSocket; heard: string[] } {
	const heard: string[] = [];
	const encoder = new TextEncoder();
	let push: (text: string) => void = () => undefined;
	const readable = new ReadableStream<Uint8Array>({
		start(controller) {
			push = (text) => controller.enqueue(encoder.encode(text));
			push(`${greeting}\r\n`);
		}
	});
	const writable = new WritableStream<Uint8Array>({
		write(chunk) {
			const line = new TextDecoder().decode(chunk).trim();
			heard.push(line);
			const verb = line.split(' ')[0];
			push(`${answers[verb] ?? '500 Unknown'}\r\n`);
		}
	});
	return { socket: { readable, writable, close: async () => undefined }, heard };
}

describe('service checks', () => {
	it('reports every migration as not applied when the database has no record of them', async () => {
		const result = await check('database', environment());
		expect(result.state).toBe('warning');
	});

	it('names the migrations not applied to the live database', async () => {
		const env = environment();
		await env.database.prepare('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, applied_at TEXT)').run();
		for (const name of migrationFiles.slice(0, -1)) await env.database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(name).run();
		const result = await check('database', env);
		expect(result.state).toBe('problem');
		expect(result.details).toEqual([`Not applied: ${migrationFiles.at(-1)}`]);
		await env.database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(migrationFiles.at(-1) ?? '').run();
		expect((await check('database', env)).state).toBe('working');
	});

	it('shows services that are not set up as off, without calling them', async () => {
		const env = environment();
		for (const key of ['lulu', 'stripe', 'outreach', 'inbox', 'book-orders', 'sign-in-email']) {
			expect((await check(key, env)).state, key).toBe('off');
		}
	});

	it('flags book ordering in test mode with a live Stripe key', async () => {
		const result = await check(
			'book-orders',
			environment({
				BOOK_ORDERS: 'test',
				BOOK_ORDERS_CONTACT_EMAIL: 'books@example.org',
				BOOK_FILE_LINK_SECRET: 'x',
				LULU_ENVIRONMENT: 'sandbox',
				LULU_CLIENT_KEY: 'k',
				LULU_CLIENT_SECRET: 's',
				STRIPE_SECRET_KEY: 'sk_live_abc',
				STRIPE_WEBHOOK_SECRET: 'whsec'
			})
		);
		expect(result.state).toBe('problem');
		expect(result.details).toContain('Ordering is in test mode but the Stripe key is a live key.');
	});

	it('proves the Stripe key and finds the payment webhook', async () => {
		const asked: string[] = [];
		const fetcher: typeof fetch = async (input) => {
			const address = String(input);
			asked.push(address);
			if (address.endsWith('/v1/balance')) return Response.json({ object: 'balance' });
			return Response.json({
				data: [{ url: 'https://example.org/book/payment-webhook', status: 'enabled', enabled_events: ['checkout.session.completed', 'checkout.session.expired'] }]
			});
		};
		const result = await check('stripe', environment({ STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec' }), fetcher);
		expect(result.state).toBe('working');
		expect(result.summary).toContain('test mode');
		expect(asked.every((address) => address.startsWith('https://api.stripe.com/v1/'))).toBe(true);
	});

	it('says when Stripe refuses the key', async () => {
		const fetcher: typeof fetch = async () => new Response('{}', { status: 401 });
		expect((await check('stripe', environment({ STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec' }), fetcher)).state).toBe('problem');
	});

	it('signs in to Lulu and warns when no print status webhook is registered', async () => {
		const fetcher: typeof fetch = async (input) => {
			const address = String(input);
			if (address.includes('/openid-connect/token')) return Response.json({ access_token: 't', expires_in: 300 });
			return Response.json({ results: [] });
		};
		const result = await check('lulu', environment({ LULU_ENVIRONMENT: 'sandbox', LULU_CLIENT_KEY: 'k', LULU_CLIENT_SECRET: 's' }), fetcher);
		expect(result.state).toBe('warning');
		expect(result.details).toContain("Signed in to Lulu's sandbox with the client key.");
	});

	it('signs in to the outreach mailbox over SMTP and quits without sending', async () => {
		const server = smtpServer({ EHLO: '250 smtp.example.org', AUTH: '235 Authentication successful', QUIT: '221 Bye' });
		const result = await check(
			'outreach',
			environment({ OUTREACH_CARRIER: 'smtp', OUTREACH_FROM: 'outreach@example.org', OUTREACH_SMTP_HOST: 'smtp.example.org', OUTREACH_SMTP_PASSWORD: 'app-password' }),
			noNetwork,
			async () => server.socket
		);
		expect(result.state).toBe('working');
		expect(server.heard.map((line) => line.split(' ')[0])).toEqual(['EHLO', 'AUTH', 'QUIT']);
		expect(server.heard.some((line) => line.startsWith('MAIL') || line.startsWith('DATA'))).toBe(false);
		// The password is never shown in the result.
		expect(JSON.stringify(result)).not.toContain('app-password');
	});

	it('reports a refused mailbox password as not working', async () => {
		const server = smtpServer({ EHLO: '250 ok', AUTH: '535 Authentication failed' });
		await expect(
			trySmtpSignIn(async () => server.socket, { host: 'smtp.example.org', port: 465, username: 'a@example.org', password: 'wrong', clientName: 'example.org' })
		).rejects.toThrow('Sign-in: the server answered 535');
	});

	it('flags files that have waited for the scanner for more than 30 minutes', async () => {
		const env = environment();
		await env.database
			.prepare(`INSERT INTO file_scans (object_key, purpose, status, requested_at) VALUES ('uploads/a/original', 'upload', 'waiting', '2026-11-22T00:00:00Z')`)
			.run();
		const [result] = await runServiceChecks({ environment: env, fetcher: noNetwork, migrationFiles, now: new Date('2026-11-22T01:00:00Z') }, 'scanner');
		expect(result.state).toBe('problem');
	});

	it('shows which scanner last checked a file, and warns when its signatures are old', async () => {
		const env = environment();
		await env.database
			.prepare(
				`INSERT INTO file_scans (object_key, purpose, status, provider, engine_version, requested_at, finished_at)
				 VALUES ('requests/r/1', 'request-file', 'clean', 'container', 'engine/1+yara-rules/20261120+clamav-db/28191-20261122', '2026-11-23T04:50:00Z', '2026-11-23T04:51:09Z')`
			)
			.run();
		const [fresh] = await runServiceChecks({ environment: env, fetcher: noNetwork, migrationFiles, now: new Date('2026-11-23T05:00:00Z') }, 'scanner');
		expect(fresh.state).toBe('working');
		expect(fresh.details.slice(0, 2)).toEqual([
			'Last file checked Nov. 23, 2026, 04:51 UTC (request-file) by the project’s scanner (ClamAV and YARA).',
			'Versions: ClamAV signatures 28191 of Nov. 22, 2026, YARA Forge rules of Nov. 20, 2026, engine 1.'
		]);
		const [stale] = await runServiceChecks({ environment: env, fetcher: noNetwork, migrationFiles, now: new Date('2026-12-05T05:00:00Z') }, 'scanner');
		expect(stale).toMatchObject({ state: 'warning', summary: 'The last scan used ClamAV signatures 13 days old.' });
	});

	it('turns a check that throws into a result instead of stopping the page', async () => {
		const env = environment({ sourceDocuments: { list: async () => { throw new Error('bucket gone'); } } });
		const result = await check('source-documents-bucket', env);
		expect(result).toMatchObject({ state: 'problem', summary: 'The check failed: bucket gone' });
	});

	it('has a check of its own for every binding in wrangler.jsonc', () => {
		const config = readJsonc(path.resolve(import.meta.dirname, '../wrangler.jsonc')) as {
			d1_databases?: { binding: string }[];
			r2_buckets?: { binding: string }[];
			durable_objects?: { bindings: { name: string }[] };
			ratelimits?: { name: string }[];
			send_email?: { name: string }[];
			kv_namespaces?: { binding: string }[];
			queues?: { producers?: { binding: string }[] };
			services?: { binding: string }[];
		};
		const bindings = [
			...(config.d1_databases ?? []).map((entry) => entry.binding),
			...(config.r2_buckets ?? []).map((entry) => entry.binding),
			...(config.durable_objects?.bindings ?? []).map((entry) => entry.name),
			...(config.ratelimits ?? []).map((entry) => entry.name),
			...(config.send_email ?? []).map((entry) => entry.name),
			...(config.kv_namespaces ?? []).map((entry) => entry.binding),
			...(config.queues?.producers ?? []).map((entry) => entry.binding),
			...(config.services ?? []).map((entry) => entry.binding)
		];
		expect(bindings).toContain('mailFiles');
		const covered = serviceChecks.map((item) => item.binding).filter(Boolean);
		expect(bindings.filter((binding) => !covered.includes(binding))).toEqual([]);
		// One check for each binding, so two buckets never share one row.
		expect(new Set(covered).size).toBe(covered.length);
	});

	it('checks each bucket on its own', async () => {
		const env = environment({ mailFiles: { list: async () => { throw new Error('mail bucket gone'); } } });
		expect((await check('source-documents-bucket', env)).state).toBe('working');
		expect(await check('mail-bucket', env)).toMatchObject({ state: 'problem', summary: 'The check failed: mail bucket gone' });
		expect((await check('mail-bucket', environment())).state).toBe('problem');
	});

	it('counts the source library', async () => {
		const library = testDatabase();
		await library.prepare('CREATE TABLE documents (document_id TEXT)').run();
		await library.prepare('CREATE TABLE pages (passage_id INTEGER)').run();
		await library.prepare("INSERT INTO documents VALUES ('a')").run();
		await library.prepare('INSERT INTO pages VALUES (1)').run();
		expect(await check('source-library', environment({ sourceLibrary: library }))).toMatchObject({ state: 'working', summary: 'The library database answers: 1 documents, 1 pages.' });
		expect((await check('source-library', environment())).state).toBe('problem');
	});

	it('reaches the live editing room and the scanner desk', async () => {
		const asked: string[] = [];
		const namespace = (status: number) => ({
			getByName: (name: string) => ({ fetch: async (address: string) => (asked.push(`${name} ${address}`), new Response(null, { status })) }),
			idFromName: (name: string) => name,
			get: (name: string) => ({ fetch: async (address: string) => (asked.push(`${name} ${address}`), new Response(null, { status })) })
		});
		expect((await check('live-editing', environment({ essayRooms: namespace(426) }))).state).toBe('working');
		expect((await check('live-editing', environment({ essayRooms: namespace(500) }))).state).toBe('problem');
		expect((await check('scanner-desk', environment({ scanDesks: namespace(202) }))).state).toBe('working');
		expect(asked).toEqual(['service-check https://room/service-check', 'service-check https://room/service-check', 'desk https://desk/wake']);
	});

	it('looks for each map tile file in the bucket', async () => {
		const env = environment({ sourceDocuments: { list: bucket.list, head: async (key: string) => (key.includes('land-areas') ? { size: 2_097_152 } : null) } });
		const result = await check('map-tiles', env);
		expect(result.state).toBe('problem');
		expect(result.details.some((line) => line.startsWith('Missing: map-tiles/'))).toBe(true);
	});

	it('tries each rate limit with a key of its own', async () => {
		const keys: string[] = [];
		const limit = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) };
		expect((await check('upload-limit', environment({ uploadLimit: limit }))).state).toBe('working');
		expect(keys).toEqual(['service-check']);
		expect((await check('sign-in-limit', environment())).state).toBe('warning');
	});

	it('asks each map picture service and directory for one small answer', async () => {
		const asked: string[] = [];
		const fetcher: typeof fetch = async (input) => {
			const address = String(input);
			asked.push(address);
			if (address.includes('carto.nationalmap.gov')) return Response.json({ layers: [] });
			if (address.includes('nationalmap.gov')) return new Response('jpeg', { headers: { 'content-type': 'image/jpeg' } });
			if (address.includes('pwnedpasswords')) return new Response('0018A45C4D1DEF81644B54AB7F969B88D65:1');
			return Response.json({ count: 574 });
		};
		for (const key of ['map-imagery-satellite', 'map-imagery-terrain', 'map-imagery-contours', 'breached-passwords', 'federal-directory', 'alaska-directory']) {
			expect((await check(key, environment(), fetcher)).state, key).toBe('working');
		}
		expect(asked.filter((address) => address.includes('/tile/0/0/0'))).toHaveLength(2);
		expect(asked.filter((address) => address === 'https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer?f=json')).toHaveLength(1);
		expect(asked.filter((address) => address.includes('returnCountOnly=true'))).toHaveLength(2);
	});

	it('shows the video room and sponsor gifts as off until they are set up', async () => {
		expect((await check('video-rooms', environment())).state).toBe('off');
		expect((await check('sponsor-gifts', environment())).state).toBe('off');
	});

	it('reads one page of meetings from RealtimeKit without making one', async () => {
		const asked: { method: string; address: string }[] = [];
		const fetcher: typeof fetch = async (input, init) => {
			asked.push({ method: init?.method ?? 'GET', address: String(input) });
			return Response.json({ success: true, data: [], paging: { total_count: 3 } });
		};
		const result = await check('video-rooms', environment({ VIDEO_ROOM_TOKEN: 't', VIDEO_ROOM_ACCOUNT: 'a', VIDEO_ROOM_APPLICATION: 'b' }), fetcher);
		expect(result.state).toBe('working');
		expect(result.details).toContain('Meetings made so far: 3');
		expect(asked).toEqual([{ method: 'GET', address: 'https://api.cloudflare.com/client/v4/accounts/a/realtime/kit/b/meetings?per_page=1&page_no=1' }]);
	});
});

/** Reads a JSON file with comments, such as wrangler.jsonc. */
function readJsonc(file: string): unknown {
	const source = readFileSync(file, 'utf8');
	let out = '';
	let inString = false;
	for (let index = 0; index < source.length; index++) {
		const character = source[index];
		if (inString) {
			out += character;
			if (character === '\\') out += source[++index];
			else if (character === '"') inString = false;
		} else if (character === '"') {
			inString = true;
			out += character;
		} else if (character === '/' && source[index + 1] === '/') {
			while (index < source.length && source[index] !== '\n') index++;
			out += '\n';
		} else if (character === '/' && source[index + 1] === '*') {
			index = source.indexOf('*/', index + 2) + 1;
		} else out += character;
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}
