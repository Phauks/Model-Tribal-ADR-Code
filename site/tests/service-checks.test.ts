import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runServiceChecks, trySmtpSignIn, type CheckSocket } from '../src/lib/server/service-checks.ts';
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

	it('turns a check that throws into a result instead of stopping the page', async () => {
		const env = environment({ sourceDocuments: { list: async () => { throw new Error('bucket gone'); } } });
		const result = await check('bucket', env);
		expect(result).toMatchObject({ state: 'problem', summary: 'The check failed: bucket gone' });
	});
});
