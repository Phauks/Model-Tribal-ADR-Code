/**
 * Checks of the services the site depends on, for the lead author's Service
 * checks page (/workspace/service-checks). Trevor asked on Nov. 22, 2026 for
 * one place to verify linked services such as Lulu and Zoho.
 *
 * Each check reads a setting or binding and, where the service offers a
 * harmless way to prove the connection, uses it: Lulu and Stripe are asked
 * for something read-only, and the outreach mailbox (Zoho) is signed in to
 * over SMTP and left without sending anything. No check changes data, sends
 * mail or moves money. Secrets are never shown, only whether they are set.
 *
 * Everything outside is passed in (fetch, the socket opener, the migration
 * list), so the checks run in tests without the network.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { latestScan, readableScanTime, readScannerVersion, scannerName, scannerVersionWords } from './file-scans.ts';
import { forgetLuluToken, luluAccessToken, luluSettings } from './lulu.ts';
import { storedSecret, type StoredSecret } from './stored-secrets.ts';
import { isTestKey, stripeSettings } from './stripe.ts';

export type CheckState = 'working' | 'warning' | 'problem' | 'off';

export const checkStateLabels: Record<CheckState, string> = {
	working: 'Working',
	warning: 'Needs a look',
	problem: 'Not working',
	off: 'Not set up'
};

export interface CheckResult {
	key: string;
	group: string;
	name: string;
	state: CheckState;
	summary: string;
	details: string[];
	/** What to do about it, when something is wrong or off. */
	fix?: string;
	milliseconds: number;
}

/** A TCP connection, as Cloudflare's connect() returns it. */
export interface CheckSocket {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
	close(): Promise<void>;
	startTls?(): CheckSocket;
}

export type SocketOpener = (host: string, port: number, security: 'tls' | 'starttls') => CheckSocket | Promise<CheckSocket>;

export interface CheckContext {
	environment: WorkerEnvironment;
	fetcher: typeof fetch;
	openSocket?: SocketOpener;
	/** Every migration file the site was built with, such as 0021_file_scans.sql. */
	migrationFiles: readonly string[];
	now?: Date;
	/** Each check gives up after this long. */
	timeoutMilliseconds?: number;
}

type Outcome = Omit<CheckResult, 'key' | 'group' | 'name' | 'milliseconds'>;

interface Check {
	key: string;
	group: string;
	name: string;
	run(context: CheckContext): Promise<Outcome>;
}

function message(problem: unknown): string {
	return problem instanceof Error ? problem.message : String(problem);
}

/**
 * A setting by name. The project inbox's settings (MAIL_*, OUTREACH_*) are
 * read this way because they are declared with the inbox itself (site/MAIL.md),
 * which may land before or after this page.
 */
function setting(environment: WorkerEnvironment, name: string): unknown {
	return (environment as unknown as Record<string, unknown>)[name];
}

function text(environment: WorkerEnvironment, name: string): string | undefined {
	const value = setting(environment, name);
	return typeof value === 'string' && value !== '' ? value : undefined;
}

function missing(environment: WorkerEnvironment, names: readonly string[]): string[] {
	return names.filter((name) => !setting(environment, name));
}

const settingsPlace = 'Cloudflare dashboard: Workers & Pages > model-tribal-adr-code > Settings > Variables and Secrets';

const database: Check = {
	key: 'database',
	group: 'Cloudflare',
	name: 'Database (D1)',
	async run({ environment, migrationFiles }) {
		if (!environment.database) return { state: 'problem', summary: 'The database binding is missing.', details: [], fix: 'Add the D1 binding "database" in site/wrangler.jsonc.' };
		await environment.database.prepare('SELECT 1').first();
		let applied: string[];
		try {
			const { results } = await (environment.database as D1Database)
				.prepare('SELECT name FROM d1_migrations ORDER BY id')
				.all<{ name: string }>();
			applied = results.map((row) => row.name);
		} catch {
			return {
				state: 'warning',
				summary: 'The database answers, but it has no record of which migrations were applied.',
				details: ['The table d1_migrations, which Wrangler keeps, was not found.'],
				fix: 'Apply migrations with: npx wrangler d1 migrations apply database --remote'
			};
		}
		const notApplied = migrationFiles.filter((file) => !applied.includes(file));
		if (notApplied.length > 0) {
			return {
				state: 'problem',
				summary: `${notApplied.length} ${notApplied.length === 1 ? 'migration is' : 'migrations are'} in this build but not applied to the live database, so the pages that use them will fail.`,
				details: notApplied.map((file) => `Not applied: ${file}`),
				fix: 'From the site folder: npx wrangler d1 migrations apply database --remote'
			};
		}
		return { state: 'working', summary: `The database answers, and all ${migrationFiles.length} migrations in this build are applied.`, details: [] };
	}
};

const bucket: Check = {
	key: 'bucket',
	group: 'Cloudflare',
	name: 'File storage (R2)',
	async run({ environment }) {
		if (!environment.sourceDocuments) return { state: 'problem', summary: 'The bucket binding is missing.', details: [], fix: 'Add the R2 binding "sourceDocuments" in site/wrangler.jsonc.' };
		await environment.sourceDocuments.list({ limit: 1 });
		return { state: 'working', summary: 'The private bucket answers.', details: [] };
	}
};

const liveEditing: Check = {
	key: 'live-editing',
	group: 'Cloudflare',
	name: 'Live editing rooms',
	async run({ environment }) {
		return environment.essayRooms
			? { state: 'working', summary: 'Bound to the model-tribal-adr-code-live Worker. Open an essay to test a room.', details: [] }
			: { state: 'warning', summary: 'The essayRooms binding is missing, so essays open without live co-editing.', details: [], fix: 'Deploy the live Worker (site/live) and keep the binding in site/wrangler.jsonc.' };
	}
};

const rateLimits: Check = {
	key: 'rate-limits',
	group: 'Cloudflare',
	name: 'Rate limits',
	async run({ environment }) {
		const names = ['requestFormLimit', 'workspaceChangeLimit', 'signInLimit', 'signInNetworkLimit', 'uploadLimit'] as const;
		const absent = names.filter((name) => !environment[name]);
		return absent.length === 0
			? { state: 'working', summary: `All ${names.length} limits are bound.`, details: [] }
			: { state: 'warning', summary: 'Some limits are not bound, so those forms are not slowed down for spam.', details: absent.map((name) => `Missing: ${name}`), fix: 'Check the ratelimits list in site/wrangler.jsonc.' };
	}
};

function emailCheck(key: string, name: string, binding: 'signInEmail' | 'updateEmail', from: 'SIGN_IN_EMAIL_FROM' | 'UPDATE_EMAIL_FROM', use: string): Check {
	return {
		key,
		group: 'Email',
		name,
		async run({ environment }) {
			const address = environment[from];
			if (!address) return { state: 'off', summary: `Off: ${from} is empty, so ${use} are not sent.`, details: [], fix: 'Waits on the project domain (docs/domain-to-do.md). Then onboard it in Cloudflare Email Service and set the address in site/wrangler.jsonc.' };
			if (!environment[binding]) return { state: 'problem', summary: `${from} is set but the ${binding} binding is missing.`, details: [], fix: 'Add it to send_email in site/wrangler.jsonc.' };
			return { state: 'working', summary: `On, from ${address}. This check does not send a message.`, details: [] };
		}
	};
}

const siteAddress: Check = {
	key: 'site-address',
	group: 'Site',
	name: 'Public address',
	async run({ environment }) {
		const address = environment.SITE_ADDRESS;
		if (!address) return { state: 'problem', summary: 'SITE_ADDRESS is empty, so links in emails cannot be made.', details: [], fix: 'Set it in site/wrangler.jsonc.' };
		if (address.includes('.workers.dev')) return { state: 'warning', summary: `Still the Cloudflare address, ${address}.`, details: [], fix: 'Change SITE_ADDRESS once the project domain is picked (docs/domain-to-do.md).' };
		return { state: 'working', summary: address, details: [] };
	}
};

const leadAuthor: Check = {
	key: 'lead-author',
	group: 'Site',
	name: 'First lead author',
	async run({ environment }) {
		return environment.LEAD_AUTHOR_EMAIL
			? { state: 'working', summary: 'LEAD_AUTHOR_EMAIL is set (not shown).', details: [] }
			: { state: 'warning', summary: 'LEAD_AUTHOR_EMAIL is not set.', details: [], fix: `Add it as a Secret in the ${settingsPlace}.` };
	}
};

/** The site's own keys, each a binding to a secret in Cloudflare Secrets Store (src/lib/server/stored-secrets.ts). */
const siteKeyBindings = [
	['passwordKey', 'Password key', 'MODEL_TRIBAL_CODE_PASSWORD_KEY'],
	['mailSigningKey', 'Mail link key', 'MODEL_TRIBAL_CODE_MAIL_SIGNING_KEY'],
	['bookFileLinkKey', 'Book file link key', 'MODEL_TRIBAL_CODE_BOOK_FILE_LINK_KEY']
] as const;

const siteKeys: Check = {
	key: 'site-keys',
	group: 'Cloudflare',
	name: 'Site keys (Secrets Store)',
	async run({ environment }) {
		const details: string[] = [];
		const unread: string[] = [];
		for (const [binding, label, secretName] of siteKeyBindings) {
			const value = await storedSecret(setting(environment, binding) as StoredSecret | undefined);
			if (value) details.push(`${label}: readable (not shown)`);
			else {
				details.push(`${label}: cannot be read (binding ${binding}, secret ${secretName})`);
				unread.push(label);
			}
		}
		if (!unread.length) return { state: 'working', summary: 'Every site key can be read.', details };
		return {
			state: 'problem',
			summary: `${unread.join(', ')} cannot be read.`,
			details,
			fix: 'Check that each secret exists in Cloudflare Secrets Store with the Workers scope (site/wrangler.jsonc, "secrets_store_secrets").'
		};
	}
};

const bookOrders: Check = {
	key: 'book-orders',
	group: 'Book orders',
	name: 'Ordering switch',
	async run({ environment }) {
		const mode = environment.BOOK_ORDERS;
		if (mode !== 'test' && mode !== 'live') return { state: 'off', summary: 'Off: BOOK_ORDERS is neither "test" nor "live", so nobody can order a copy.', details: [], fix: 'Set BOOK_ORDERS to "test" with Lulu sandbox and Stripe test keys first (docs/book-orders.md).' };
		const details: string[] = [];
		for (const name of missing(environment, ['BOOK_ORDERS_CONTACT_EMAIL', 'bookFileLinkKey'])) details.push(`Not set: ${name}`);
		const lulu = luluSettings(environment);
		const stripe = stripeSettings(environment);
		if (!lulu) details.push('Lulu settings are incomplete.');
		if (!stripe) details.push('Stripe settings are incomplete.');
		if (mode === 'test' && lulu?.environment === 'production') details.push('Ordering is in test mode but Lulu is set to production.');
		if (mode === 'test' && stripe && !isTestKey(stripe)) details.push('Ordering is in test mode but the Stripe key is a live key.');
		if (mode === 'live' && lulu?.environment === 'sandbox') details.push('Ordering is live but Lulu is set to the sandbox.');
		if (mode === 'live' && stripe && isTestKey(stripe)) details.push('Ordering is live but the Stripe key is a test key.');
		if (details.length > 0) return { state: 'problem', summary: `BOOK_ORDERS is "${mode}", but the settings do not match.`, details, fix: `Fix them in the ${settingsPlace}.` };
		return { state: 'working', summary: `On, in ${mode} mode, with matching Lulu and Stripe settings.`, details: [] };
	}
};

async function readJson(response: Response): Promise<unknown> {
	const text = await response.text();
	try {
		return text ? JSON.parse(text) : undefined;
	} catch {
		return undefined;
	}
}

const lulu: Check = {
	key: 'lulu',
	group: 'Book orders',
	name: 'Lulu Print API',
	async run({ environment, fetcher }) {
		const settings = luluSettings(environment);
		if (!settings) {
			const absent = missing(environment, ['LULU_ENVIRONMENT', 'LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET']);
			return { state: 'off', summary: 'Not set up.', details: absent.map((name) => `Not set: ${name}`), fix: `Make a Lulu API client (sandbox first), then add its key and secret in the ${settingsPlace} (docs/book-orders.md).` };
		}
		forgetLuluToken();
		const token = await luluAccessToken(settings, fetcher);
		const details = [`Signed in to Lulu's ${settings.environment} with the client key.`];
		const base = settings.environment === 'sandbox' ? 'https://api.sandbox.lulu.com' : 'https://api.lulu.com';
		const response = await fetcher(`${base}/webhooks/`, { headers: { authorization: `Bearer ${token}`, 'cache-control': 'no-cache' } });
		if (!response.ok) {
			return { state: 'warning', summary: `Signed in, but the webhook list could not be read (${response.status}).`, details, fix: 'Check the API client in the Lulu developer portal.' };
		}
		const body = (await readJson(response)) as { results?: { url?: string; is_active?: boolean; topics?: string[] }[] } | { url?: string; is_active?: boolean; topics?: string[] }[] | undefined;
		const hooks = Array.isArray(body) ? body : (body?.results ?? []);
		const ours = hooks.find((hook) => hook.url?.endsWith('/book/printer-webhook') && hook.is_active !== false);
		if (!ours) {
			return { state: 'warning', summary: 'Signed in, but no active webhook points at /book/printer-webhook, so print status changes will not reach the site.', details, fix: 'Register it once with POST /webhooks/ for topic PRINT_JOB_STATUS_CHANGED (docs/book-orders.md).' };
		}
		details.push(`Webhook: ${ours.url}`);
		if (environment.SITE_ADDRESS && !ours.url?.startsWith(environment.SITE_ADDRESS.replace(/\/$/, ''))) {
			return { state: 'warning', summary: 'The Lulu webhook points at a different address from SITE_ADDRESS.', details, fix: 'Update the webhook after a change of domain.' };
		}
		return { state: 'working', summary: `Signed in to Lulu's ${settings.environment}; the print status webhook is registered.`, details };
	}
};

const stripe: Check = {
	key: 'stripe',
	group: 'Book orders',
	name: 'Stripe',
	async run({ environment, fetcher }) {
		const settings = stripeSettings(environment);
		if (!settings) {
			const absent = missing(environment, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
			return { state: 'off', summary: 'Not set up.', details: absent.map((name) => `Not set: ${name}`), fix: `Use test keys first; add them in the ${settingsPlace} (docs/book-orders.md).` };
		}
		const headers = { authorization: `Bearer ${settings.secretKey}` };
		const balance = await fetcher('https://api.stripe.com/v1/balance', { headers });
		if (balance.status === 401) return { state: 'problem', summary: 'Stripe refused the secret key.', details: [], fix: `Make a new key in Stripe and replace STRIPE_SECRET_KEY in the ${settingsPlace}.` };
		if (!balance.ok && balance.status !== 403) return { state: 'problem', summary: `Stripe answered ${balance.status}.`, details: [] };
		const mode = isTestKey(settings) ? 'test' : 'live';
		const details = [`The key is a ${mode} key.`];
		const endpoints = await fetcher('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers });
		if (!endpoints.ok) return { state: 'warning', summary: `The key works (${mode} mode), but the webhook list could not be read (${endpoints.status}).`, details, fix: 'A restricted key needs read access to webhook endpoints for this check.' };
		const list = ((await readJson(endpoints)) as { data?: { url?: string; status?: string; enabled_events?: string[] }[] } | undefined)?.data ?? [];
		const ours = list.find((endpoint) => endpoint.url?.endsWith('/book/payment-webhook'));
		if (!ours) return { state: 'warning', summary: `The key works (${mode} mode), but no webhook endpoint points at /book/payment-webhook, so paid orders will not be sent to print.`, details, fix: 'Add the endpoint in Stripe for checkout.session.completed and checkout.session.expired (docs/book-orders.md).' };
		details.push(`Webhook: ${ours.url} (${ours.status ?? 'unknown status'})`);
		const events = ours.enabled_events ?? [];
		const wanted = ['checkout.session.completed', 'checkout.session.expired'].filter((event) => !events.includes(event) && !events.includes('*'));
		if (ours.status !== 'enabled' || wanted.length > 0) {
			return { state: 'warning', summary: 'The payment webhook is not enabled for every event the site needs.', details: [...details, ...wanted.map((event) => `Not sent: ${event}`)], fix: 'Edit the endpoint in Stripe.' };
		}
		return { state: 'working', summary: `The key works (${mode} mode) and the payment webhook is enabled.`, details };
	}
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Signs in to an SMTP server and quits without sending: proves the host, port, user name and password. */
export async function trySmtpSignIn(
	openSocket: SocketOpener,
	connection: { host: string; port: number; username: string; password: string; clientName: string }
): Promise<{ greeting: string; steps: string[] }> {
	const security = connection.port === 587 ? 'starttls' : 'tls';
	let socket = await openSocket(connection.host, connection.port, security);
	let reader = socket.readable.getReader();
	let writer = socket.writable.getWriter();
	let buffer = '';
	const steps: string[] = [];

	async function reply(): Promise<{ code: number; text: string }> {
		const lines: string[] = [];
		for (;;) {
			const end = buffer.indexOf('\r\n');
			if (end === -1) {
				const { value, done } = await reader.read();
				if (done) throw new Error('The mail server closed the connection.');
				buffer += decoder.decode(value, { stream: true });
				continue;
			}
			const line = buffer.slice(0, end);
			buffer = buffer.slice(end + 2);
			lines.push(line);
			if (/^\d{3}( |$)/.test(line)) return { code: Number(line.slice(0, 3)), text: lines.map((item) => item.slice(4)).join(' ') };
		}
	}
	async function command(line: string, codes: number[], step: string): Promise<{ code: number; text: string }> {
		if (line) await writer.write(encoder.encode(`${line}\r\n`));
		const answer = await reply();
		if (!codes.includes(answer.code)) throw new Error(`${step}: the server answered ${answer.code} ${answer.text}`);
		steps.push(`${step}: ${answer.code}`);
		return answer;
	}

	try {
		const greeting = await command('', [220], 'Greeting');
		await command(`EHLO ${connection.clientName}`, [250], 'EHLO');
		if (security === 'starttls') {
			await command('STARTTLS', [220], 'STARTTLS');
			if (!socket.startTls) throw new Error('This connection cannot start TLS.');
			reader.releaseLock();
			writer.releaseLock();
			socket = socket.startTls();
			reader = socket.readable.getReader();
			writer = socket.writable.getWriter();
			buffer = '';
			await command(`EHLO ${connection.clientName}`, [250], 'EHLO after TLS');
		}
		const plain = btoa(`\u0000${connection.username}\u0000${connection.password}`);
		await command(`AUTH PLAIN ${plain}`, [235], 'Sign-in');
		await command('QUIT', [221], 'QUIT').catch(() => undefined);
		return { greeting: greeting.text, steps };
	} finally {
		try {
			reader.releaseLock();
			writer.releaseLock();
		} catch {
			// Already released.
		}
		await socket.close().catch(() => undefined);
	}
}

const outreach: Check = {
	key: 'outreach',
	group: 'Email',
	name: 'Outreach mailbox (Zoho, over SMTP)',
	async run({ environment, openSocket }) {
		const host = text(environment, 'OUTREACH_SMTP_HOST');
		const password = text(environment, 'OUTREACH_SMTP_PASSWORD');
		const username = text(environment, 'OUTREACH_SMTP_USERNAME') ?? text(environment, 'OUTREACH_FROM');
		const carrier = text(environment, 'OUTREACH_CARRIER');
		if (!host || !password || !username) {
			const absent = missing(environment, ['OUTREACH_CARRIER', 'OUTREACH_FROM', 'OUTREACH_SMTP_HOST', 'OUTREACH_SMTP_PASSWORD']);
			return { state: 'off', summary: 'Not set up.', details: absent.map((name) => `Not set: ${name}`), fix: `Comes with the project inbox (site/MAIL.md): make the Zoho mailbox and an app password, then add the OUTREACH settings in the ${settingsPlace}.` };
		}
		if (!openSocket) return { state: 'warning', summary: 'Set, but this copy of the site cannot open connections to test it.', details: [] };
		const port = Number(text(environment, 'OUTREACH_SMTP_PORT')) || 465;
		const details = [`Server: ${host}:${port}`, `User name: ${username}`];
		if (carrier !== 'smtp') details.push(`OUTREACH_CARRIER is "${carrier ?? ''}", not "smtp", so outreach is not sent this way yet.`);
		try {
			const result = await trySmtpSignIn(openSocket, { host, port, username, password, clientName: new URL(environment.SITE_ADDRESS || 'https://localhost').hostname });
			return {
				state: carrier === 'smtp' ? 'working' : 'warning',
				summary: 'Signed in to the outreach mailbox and quit without sending anything.',
				details: [...details, `Greeting: ${result.greeting}`, ...result.steps]
			};
		} catch (problem) {
			return { state: 'problem', summary: `Could not sign in: ${message(problem)}`, details, fix: 'Check the host, port and app password in Zoho Mail (Settings > Security > App passwords) and in the Cloudflare dashboard.' };
		}
	}
};

const inbox: Check = {
	key: 'inbox',
	group: 'Email',
	name: 'Project inbox',
	async run({ environment }) {
		const domain = text(environment, 'MAIL_DOMAIN');
		if (!domain) return { state: 'off', summary: 'Off: MAIL_DOMAIN is empty.', details: [], fix: 'Waits on the project domain and the inbox (site/MAIL.md, "Switching email on").' };
		const details = [`Domain: ${domain}`];
		if (!setting(environment, 'projectEmail')) return { state: 'problem', summary: 'MAIL_DOMAIN is set but the projectEmail binding is missing, so replies cannot be sent.', details };
		if (!(await storedSecret(environment.mailSigningKey))) return { state: 'problem', summary: 'The mail link key cannot be read.', details, fix: 'Check the mailSigningKey binding in site/wrangler.jsonc and its secret in Cloudflare Secrets Store.' };
		return { state: 'working', summary: `On for ${domain}. This check does not send a message.`, details };
	}
};

const scanner: Check = {
	key: 'scanner',
	group: 'Cloudflare',
	name: 'Malware scanner queue',
	async run({ environment, now = new Date() }) {
		let rows: { status: string; count: number; oldest: string | null }[];
		try {
			const result = await environment.database
				.prepare('SELECT status, COUNT(*) AS count, MIN(requested_at) AS oldest FROM file_scans GROUP BY status')
				.all<{ status: string; count: number; oldest: string | null }>();
			rows = result.results;
		} catch {
			return { state: 'off', summary: 'The file_scans table is missing.', details: [], fix: 'Apply migration 0021 and deploy the scanner Worker (site/SCANNING.md).' };
		}
		const count = (status: string) => rows.find((row) => row.status === status)?.count ?? 0;
		const waiting = rows.filter((row) => ['waiting', 'scanning', 'retrying'].includes(row.status));
		const oldest = waiting.map((row) => row.oldest).filter((value): value is string => Boolean(value)).sort()[0];
		// Which scanner last checked a file, and with which signatures (site/SCANNING.md).
		const last = await latestScan(environment.database);
		const version = readScannerVersion(last?.engineVersion ?? null);
		const details = [
			...(last
				? [
						`Last file checked ${readableScanTime(last.finishedAt!)} (${last.purpose}) by ${scannerName(last.provider)}.`,
						`Versions: ${scannerVersionWords(version) ?? last.engineVersion}.`
					]
				: ['No file has been checked yet, so the scanner’s version is not known.']),
			...rows.map((row) => `${row.status}: ${row.count}`)
		];
		const signatureAgeDays = version?.clamavDatabaseDate
			? Math.floor((now.getTime() - Date.parse(`${version.clamavDatabaseDate}T00:00:00Z`)) / 86_400_000)
			: null;
		if (oldest && now.getTime() - Date.parse(oldest) > 30 * 60_000) {
			return { state: 'problem', summary: `Files have waited for a scan since ${oldest}, so they are held from reviewers.`, details, fix: 'Check that the model-tribal-adr-code-scanner Worker is deployed and its cron runs (site/SCANNING.md).' };
		}
		if (count('failed') > 0) return { state: 'warning', summary: `${count('failed')} ${count('failed') === 1 ? 'file' : 'files'} could not be scanned after several tries.`, details, fix: 'Scan again or release by hand from the upload page.' };
		if (signatureAgeDays !== null && signatureAgeDays > 7) {
			return {
				state: 'warning',
				summary: `The last scan used ClamAV signatures ${signatureAgeDays} days old.`,
				details,
				fix: 'Set the SCAN_REBUILD_HOOK_URL secret on the scanner Worker so it rebuilds with fresh signatures every day (site/SCANNING.md, "Setting it up").'
			};
		}
		if (rows.length === 0) return { state: 'working', summary: 'No files have been sent for scanning yet.', details };
		return { state: 'working', summary: 'Nothing has waited more than 30 minutes.', details };
	}
};

export const serviceChecks: readonly Check[] = [
	database,
	bucket,
	liveEditing,
	rateLimits,
	scanner,
	siteAddress,
	leadAuthor,
	siteKeys,
	emailCheck('sign-in-email', 'Sign-in codes', 'signInEmail', 'SIGN_IN_EMAIL_FROM', 'sign-in codes'),
	emailCheck('update-email', 'Followed-page summaries', 'updateEmail', 'UPDATE_EMAIL_FROM', 'summaries of followed pages'),
	inbox,
	outreach,
	bookOrders,
	lulu,
	stripe
];

/** Runs every check at once; one that throws or runs too long counts as not working, without stopping the rest. */
export async function runServiceChecks(context: CheckContext, only?: string): Promise<CheckResult[]> {
	const limit = context.timeoutMilliseconds ?? 10_000;
	const chosen = only ? serviceChecks.filter((check) => check.key === only) : serviceChecks;
	return Promise.all(
		chosen.map(async (check) => {
			const started = Date.now();
			let timer: ReturnType<typeof setTimeout> | undefined;
			const timeout = new Promise<Outcome>((resolve) => {
				timer = setTimeout(() => resolve({ state: 'problem', summary: `No answer within ${Math.round(limit / 1000)} seconds.`, details: [] }), limit);
			});
			let outcome: Outcome;
			try {
				outcome = await Promise.race([check.run(context), timeout]);
			} catch (problem) {
				outcome = { state: 'problem', summary: `The check failed: ${message(problem)}`, details: [] };
			} finally {
				clearTimeout(timer);
			}
			return { key: check.key, group: check.group, name: check.name, ...outcome, milliseconds: Date.now() - started };
		})
	);
}
