/**
 * Checks of the services the site depends on, for the lead author's Service
 * checks page (/workspace/service-checks). Trevor asked on Nov. 22, 2026 for
 * one place to verify linked services such as Lulu and Zoho.
 *
 * Every binding in site/wrangler.jsonc and every outside service the Worker
 * calls has a check of its own (Trevor, Nov. 24, 2026: "verify all service
 * checks include all services, ie, that we separately include both r2
 * buckets"). tests/service-checks.test.ts fails when a binding is added to
 * wrangler.jsonc without a check here.
 *
 * Each check reads a setting or binding and, where the service offers a
 * harmless way to prove the connection, uses it: databases and buckets are
 * read, Lulu, Stripe and RealtimeKit are asked for something read-only, the
 * map and directory services are asked for one small answer, and the
 * outreach mailbox (Zoho) is signed in to over SMTP and left without sending
 * anything. No check changes data, sends mail or moves money. Secrets are
 * never shown, only whether they are set.
 *
 * Everything outside is passed in (fetch, the socket opener, the migration
 * list), so the checks run in tests without the network.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { readWaybackStatus, waybackWorkerAddress } from './wayback.ts';
import { latestScan, readableScanTime, readScannerVersion, scannerName, scannerVersionWords } from './file-scans.ts';
import { alaskaDirectoryLink, federalDirectoryLink } from './address-book.ts';
import { forgetLuluToken, luluAccessToken, luluSettings } from './lulu.ts';
import { imageryAddress, mapImagery, type MapImageryName } from './map-imagery.ts';
import { tileSets } from './map-tile-serving.ts';
import { pwnedPasswordsRange } from './password-checks.ts';
import { readMeetingTotal, videoRoomSettings } from './realtime-kit.ts';
import { giftSettingChecks, giftState } from './sponsors.ts';
import { isTestKey, stripeSettings } from './stripe.ts';
import { latestPublication, latestRebuild } from './site-text.ts';
import { dollars } from './watch/model-prices.ts';
import { readWatchProgress, watchState, watchStateWords, watchWorkerAddress, type WatchProgress } from './watch/progress.ts';

export type CheckState = 'working' | 'warning' | 'problem' | 'off';

export const checkStateLabels: Record<CheckState, string> = {
	working: 'Working',
	warning: 'Needs a look',
	problem: 'Not working',
	off: 'Not set up'
};

/**
 * The thing a check looks at, named as it is in the Cloudflare dashboard or
 * by the outside service, so the page says which bucket, database or Worker
 * a row is about (Trevor, Nov. 26, 2026: "we show 6 storage locations, but i
 * am not entirely sure which one each refers to").
 */
export interface CheckTarget {
	/** As the dashboard or the service names it, such as tribal-law-project-files. */
	name: string;
	/** A short word for its kind, such as R2 bucket, D1 database or Worker. */
	kind: string;
	/** The part of it the check looks at, such as a folder or a table, or a limit. */
	part?: string;
}

/** What a check is about, shown on every row whatever its outcome. */
interface CheckDescription {
	target: CheckTarget;
	/** What the site uses it for. */
	use: string;
	/** What the check does, in a sentence. */
	test: string;
}

export interface CheckResult extends CheckDescription {
	key: string;
	group: string;
	name: string;
	binding?: string;
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

type Outcome = Omit<CheckResult, 'key' | 'group' | 'name' | 'binding' | 'milliseconds' | keyof CheckDescription>;

interface Check extends CheckDescription {
	key: string;
	group: string;
	name: string;
	/** The wrangler.jsonc binding this check covers, if it covers one. */
	binding?: string;
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

const settingsPlace = 'Cloudflare dashboard: Workers & Pages > tribal-law-project-site > Settings > Variables and Secrets';

const database: Check = {
	key: 'database',
	group: 'Storage',
	name: 'Main database',
	binding: 'database',
	target: { name: 'tribal-law-project', kind: 'D1 database' },
	use: 'Accounts, essays, records, the workspace and everything else the site writes',
	test: 'Runs a one-line query, then compares the migrations the database has applied with the migration files in this build.',
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

const sourceLibrary: Check = {
	key: 'source-library',
	group: 'Storage',
	name: 'Source library database',
	binding: 'sourceLibrary',
	target: { name: 'tribal-law-project-library', kind: 'D1 database' },
	use: 'The searchable text of the source library’s documents and pages',
	test: 'Counts the documents and pages.',
	async run({ environment }) {
		const library = environment.sourceLibrary;
		if (!library) return { state: 'problem', summary: 'The sourceLibrary binding is missing, so the library search finds nothing.', details: [], fix: 'Add the D1 binding "sourceLibrary" in site/wrangler.jsonc.' };
		let counts: { documents: number; pages: number } | null;
		try {
			counts = await library
				.prepare('SELECT (SELECT COUNT(*) FROM documents) AS documents, (SELECT COUNT(*) FROM pages) AS pages')
				.first<{ documents: number; pages: number }>();
		} catch {
			return { state: 'warning', summary: 'The library database answers, but its tables are missing.', details: [], fix: 'Load it from scripts/library/ (src/lib/server/source-library.ts).' };
		}
		const documents = counts?.documents ?? 0;
		if (documents === 0) return { state: 'warning', summary: 'The library database answers, but holds no documents.', details: [], fix: 'Load it from scripts/library/ (src/lib/server/source-library.ts).' };
		return { state: 'working', summary: `The library database answers: ${documents.toLocaleString('en-US')} documents, ${(counts?.pages ?? 0).toLocaleString('en-US')} pages.`, details: [] };
	}
};

type BucketBinding = 'sourceDocuments' | 'mailFiles';

function bucketCheck(key: string, name: string, binding: BucketBinding, bucketName: string, use: string, keeps: string): Check {
	return {
		key,
		group: 'Storage',
		name,
		binding,
		target: { name: bucketName, kind: 'R2 bucket' },
		use: keeps,
		test: 'Lists one file. Nothing is read or written.',
		async run({ environment }) {
			const bucket = environment[binding];
			if (!bucket) return { state: 'problem', summary: `The ${binding} binding is missing, so ${use} cannot be read or kept.`, details: [], fix: `Add the R2 binding "${binding}" for ${bucketName} in site/wrangler.jsonc.` };
			const listed = await bucket.list({ limit: 1 });
			return { state: 'working', summary: `The bucket answers${listed.objects.length === 0 ? ', and is empty' : ''}.`, details: [] };
		}
	};
}

const mapTiles: Check = {
	key: 'map-tiles',
	group: 'Storage',
	name: 'Map tiles',
	target: { name: 'tribal-law-project-files', kind: 'R2 bucket', part: 'map-tiles/' },
	use: 'The map’s land areas, states and base map, served from the site’s own copy',
	test: 'Looks up each tile file the site expects (geography/map-tiles.json) without downloading it.',
	async run({ environment }) {
		const bucket = environment.sourceDocuments;
		if (!bucket) return { state: 'problem', summary: 'The sourceDocuments binding is missing, so the map has no tiles.', details: [] };
		const details: string[] = [];
		const absent: string[] = [];
		for (const tileSet of tileSets.values()) {
			const object = await bucket.head(tileSet.key);
			if (object) details.push(`${tileSet.key}: ${(object.size / 1_048_576).toFixed(1)} MB`);
			else absent.push(tileSet.key);
		}
		if (absent.length > 0) {
			return { state: 'problem', summary: `${absent.length} of ${tileSets.size} tile files are not in the bucket, so the map falls back to the drawn map.`, details: [...details, ...absent.map((key) => `Missing: ${key}`)], fix: 'Upload the files tools/build-map-tiles.mjs wrote (site/geography/map-tiles.json).' };
		}
		return { state: 'working', summary: `All ${tileSets.size} tile files are in the bucket.`, details };
	}
};

const siteFiles: Check = {
	key: 'site-files',
	group: 'Storage',
	name: 'Built pages and files',
	binding: 'ASSETS',
	target: { name: 'tribal-law-project-site', kind: 'Static assets' },
	use: 'The built pages, scripts, fonts and pictures, which ZIP downloads and saved copies read',
	test: 'Asks the site’s own built files for robots.txt.',
	async run({ environment }) {
		if (!environment.ASSETS) return { state: 'warning', summary: 'The ASSETS binding is missing, so the ZIP downloads and saved copies cannot read the built files.', details: [], fix: 'It is set by @sveltejs/adapter-cloudflare when the site is built; check the build.' };
		const response = await environment.ASSETS.fetch('https://assets.local/robots.txt');
		await response.body?.cancel();
		return response.ok
			? { state: 'working', summary: 'The built site’s files answer.', details: [] }
			: { state: 'problem', summary: `The built site’s files answered ${response.status}.`, details: [] };
	}
};

const liveEditing: Check = {
	key: 'live-editing',
	group: 'Workers',
	name: 'Live editing rooms',
	binding: 'essayRooms',
	target: { name: 'tribal-law-project-live', kind: 'Worker', part: 'EssayRoom' },
	use: 'Live co-editing of essays',
	test: 'Sends a plain request to a test room of its own, which the Worker should refuse with 426. Nobody is joined to a room.',
	async run({ environment }) {
		const rooms = environment.essayRooms;
		if (!rooms) return { state: 'warning', summary: 'The essayRooms binding is missing, so essays open without live co-editing.', details: [], fix: 'Deploy the live Worker (site/live) and keep the binding in site/wrangler.jsonc.' };
		// A room of its own, never an essay's ("essay:<id>"). A plain request
		// is refused with 426, which proves the live Worker is deployed and
		// answering without joining anyone to a room.
		const response = await rooms.getByName('service-check').fetch('https://room/service-check');
		await response.body?.cancel();
		return response.status === 426
			? { state: 'working', summary: 'The tribal-law-project-live Worker answers.', details: [] }
			: { state: 'problem', summary: `The live Worker answered ${response.status} instead of 426.`, details: [], fix: 'Deploy the live Worker again (site/live).' };
	}
};

const scannerDesk: Check = {
	key: 'scanner-desk',
	group: 'Workers',
	name: 'Malware scanner wake-up',
	binding: 'scanDesks',
	target: { name: 'tribal-law-project-scanner', kind: 'Worker', part: 'ScanDesk' },
	use: 'Waking the malware scanner as soon as a file is sent',
	test: 'Sends the same wake-up a sent file sends, which does nothing when no file is waiting.',
	async run({ environment }) {
		const desks = environment.scanDesks;
		if (!desks) return { state: 'warning', summary: 'The scanDesks binding is missing, so sent files wait for the scanner’s next minute round.', details: [], fix: 'Deploy the scanner Worker (site/scanner) and keep the binding in site/wrangler.jsonc.' };
		// The same nudge a sent file gives (src/lib/server/scanner-wake.ts): the desk looks for files waiting, and does nothing if there are none.
		const response = await desks.get(desks.idFromName('desk')).fetch('https://desk/wake', { method: 'POST' });
		await response.body?.cancel();
		return response.status === 202
			? { state: 'working', summary: 'The tribal-law-project-scanner Worker answers.', details: [] }
			: { state: 'problem', summary: `The scanner Worker answered ${response.status} instead of 202.`, details: [], fix: 'Deploy the scanner Worker again (site/SCANNING.md).' };
	}
};

type RateLimitBinding = 'requestFormLimit' | 'workspaceChangeLimit' | 'signInLimit' | 'signInNetworkLimit' | 'uploadLimit';

/** Each limit names how many a minute it allows and whom it counts, as site/wrangler.jsonc sets it (Trevor, Nov. 26, 2026: "rate limits should denote the limits"). */
function rateLimitCheck(key: string, name: string, binding: RateLimitBinding, use: string, perMinute: number, counted: string): Check {
	const allows = `${perMinute.toLocaleString('en-US')} a minute for each ${counted}`;
	return {
		key,
		group: 'Rate limits',
		name,
		binding,
		target: { name: binding, kind: 'Rate limit' },
		use: `Slowing down ${use}`,
		test: 'Spends one request under a key nobody else uses, so no person is counted.',
		async run({ environment }) {
			const limit = environment[binding];
			if (!limit) return { state: 'warning', summary: `The ${binding} binding is missing, so nothing slows down ${use}.`, details: [], fix: 'Check the ratelimits list in site/wrangler.jsonc.' };
			// A key nobody else uses, so the check never counts against a person.
			const { success } = await limit.limit({ key: 'service-check' });
			return success
				? { state: 'working', summary: `Allows ${allows}. The test request went through.`, details: [] }
				: { state: 'warning', summary: `Allows ${allows}, but the test request was turned away. Check again in a minute.`, details: [] };
		}
	};
}

function emailCheck(key: string, name: string, binding: 'signInEmail' | 'updateEmail', from: 'SIGN_IN_EMAIL_FROM' | 'UPDATE_EMAIL_FROM', use: string): Check {
	return {
		key,
		group: 'Email',
		name,
		binding,
		target: { name: 'Cloudflare Email Service', kind: 'Email', part: from },
		use: `Sending ${use}`,
		test: `Checks that ${from} is set and the ${binding} binding is there. Nothing is sent.`,
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
	group: 'Settings',
	name: 'Public address',
	target: { name: 'SITE_ADDRESS', kind: 'Setting' },
	use: 'Links in emails and the address Lulu and Stripe send updates to',
	test: 'Reads the setting and flags a workers.dev address.',
	async run({ environment }) {
		const address = environment.SITE_ADDRESS;
		if (!address) return { state: 'problem', summary: 'SITE_ADDRESS is empty, so links in emails cannot be made.', details: [], fix: 'Set it in site/wrangler.jsonc.' };
		if (address.includes('.workers.dev')) return { state: 'warning', summary: `Still the Cloudflare address, ${address}.`, details: [], fix: 'Change SITE_ADDRESS once the project domain is picked (docs/domain-to-do.md).' };
		return { state: 'working', summary: address, details: [] };
	}
};

const leadAuthor: Check = {
	key: 'lead-author',
	group: 'Settings',
	name: 'First lead author',
	target: { name: 'LEAD_AUTHOR_EMAIL', kind: 'Secret' },
	use: 'Making the first lead author’s account',
	test: 'Checks that it is set. The value is never shown.',
	async run({ environment }) {
		return environment.LEAD_AUTHOR_EMAIL
			? { state: 'working', summary: 'LEAD_AUTHOR_EMAIL is set (not shown).', details: [] }
			: { state: 'warning', summary: 'LEAD_AUTHOR_EMAIL is not set.', details: [], fix: `Add it as a Secret in the ${settingsPlace}.` };
	}
};

const passwordKey: Check = {
	key: 'password-key',
	group: 'Settings',
	name: 'Password key',
	target: { name: 'PASSWORD_KEY', kind: 'Secret' },
	use: 'An optional secret key added to password hashes and authenticator secrets',
	test: 'Checks whether it is set and, if so, that it is at least 32 characters long. The value is never shown.',
	async run({ environment }) {
		const key = environment.PASSWORD_KEY;
		// Trevor chose on Nov. 26, 2026 not to use one, so as not to have to keep track of it: unset is a choice, not a fault.
		if (!key) return { state: 'off', summary: 'Not used, by choice: passwords and authenticator secrets are kept without an added secret key.', details: [] };
		if (key.length < 32) return { state: 'warning', summary: `PASSWORD_KEY is set (not shown) but shorter than 32 characters.`, details: [], fix: 'It cannot be changed without breaking existing passwords; ask before replacing it.' };
		return { state: 'working', summary: 'PASSWORD_KEY is set (not shown).', details: [] };
	}
};

const bookOrders: Check = {
	key: 'book-orders',
	group: 'Payments',
	name: 'Book ordering switch',
	target: { name: 'BOOK_ORDERS', kind: 'Setting' },
	use: 'Opening book orders, in test or live mode',
	test: 'Reads the mode and checks that the Lulu and Stripe settings are in the same mode.',
	async run({ environment }) {
		const mode = environment.BOOK_ORDERS;
		if (mode !== 'test' && mode !== 'live') return { state: 'off', summary: 'Off: BOOK_ORDERS is neither "test" nor "live", so nobody can order a copy.', details: [], fix: 'Set BOOK_ORDERS to "test" with Lulu sandbox and Stripe test keys first (docs/book-orders.md).' };
		const details: string[] = [];
		for (const name of missing(environment, ['BOOK_ORDERS_CONTACT_EMAIL', 'BOOK_FILE_LINK_SECRET'])) details.push(`Not set: ${name}`);
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
	group: 'Payments',
	name: 'Lulu Print API',
	target: { name: 'Lulu', kind: 'Outside service', part: 'sandbox or production, as LULU_ENVIRONMENT says' },
	use: 'Printing and shipping ordered books',
	test: 'Signs in with the client key and reads the webhook list. Nothing is ordered.',
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
	group: 'Payments',
	name: 'Stripe',
	target: { name: 'Stripe', kind: 'Outside service', part: 'STRIPE_SECRET_KEY' },
	use: 'Taking payment for book orders',
	test: 'Reads the balance and the webhook list with the key. Nothing is charged.',
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
	name: 'Outreach mailbox (Zoho)',
	target: { name: 'Zoho Mail', kind: 'Outside service', part: 'SMTP' },
	use: 'Sending outreach letters from the project’s own mailbox',
	test: 'Signs in to the mail server and quits without sending anything.',
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
	binding: 'projectEmail',
	target: { name: 'Cloudflare Email Routing', kind: 'Email', part: 'MAIL_DOMAIN' },
	use: 'Receiving mail at the project’s domain and sending replies from the workspace',
	test: 'Checks the domain setting, the projectEmail binding and MAIL_SIGNING_KEY. Nothing is sent.',
	async run({ environment }) {
		const domain = text(environment, 'MAIL_DOMAIN');
		if (!domain) return { state: 'off', summary: 'Off: MAIL_DOMAIN is empty.', details: [], fix: 'Waits on the project domain and the inbox (site/MAIL.md, "Switching email on").' };
		const details = [`Domain: ${domain}`];
		if (!setting(environment, 'projectEmail')) return { state: 'problem', summary: 'MAIL_DOMAIN is set but the projectEmail binding is missing, so replies cannot be sent.', details };
		if (!text(environment, 'MAIL_SIGNING_KEY')) return { state: 'problem', summary: 'MAIL_SIGNING_KEY is not set.', details, fix: `Add it as a Secret in the ${settingsPlace}.` };
		return { state: 'working', summary: `On for ${domain}. This check does not send a message.`, details };
	}
};

const scanner: Check = {
	key: 'scanner',
	group: 'Workers',
	name: 'Malware scanner queue',
	target: { name: 'tribal-law-project', kind: 'D1 database', part: 'file_scans table' },
	use: 'Holding sent files until the malware scanner clears them',
	test: 'Counts files by scan status, flags any that waited over 30 minutes, and reads the age of the last scan’s virus signatures.',
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
			return { state: 'problem', summary: `Files have waited for a scan since ${oldest}, so they are held from reviewers.`, details, fix: 'Check that the tribal-law-project-scanner Worker is deployed and its cron runs (site/SCANNING.md).' };
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

const sponsorGifts: Check = {
	key: 'sponsor-gifts',
	group: 'Payments',
	name: 'Sponsor gifts',
	target: { name: 'Stripe', kind: 'Outside service', part: 'SPONSOR_GIFTS' },
	use: 'Taking sponsors’ gifts',
	test: 'Checks the gift settings, then that Stripe’s webhook for /sponsorship/payment-webhook is enabled. Nothing is charged.',
	async run({ environment, fetcher }) {
		const settings = giftSettingChecks(environment);
		const mode = environment.SPONSOR_GIFTS;
		if (mode !== 'test' && mode !== 'live') return { state: 'off', summary: 'Off: SPONSOR_GIFTS is neither "test" nor "live", so the gift form is closed.', details: [], fix: 'Set SPONSOR_GIFTS to "test" with a Stripe test key first (docs/sponsorship.md).' };
		const wrong = settings.filter((item) => !item.ok);
		const details = settings.map((item) => `${item.name}: ${item.detail}`);
		if (wrong.length > 0 || !giftState(environment).open) return { state: 'problem', summary: `SPONSOR_GIFTS is "${mode}", but the gift form stays closed.`, details, fix: `Fix the settings marked above in the ${settingsPlace}.` };
		const key = environment.STRIPE_SECRET_KEY as string;
		const endpoints = await fetcher('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers: { authorization: `Bearer ${key}` } });
		if (!endpoints.ok) return { state: 'warning', summary: `On in ${mode} mode, but Stripe’s webhook list could not be read (${endpoints.status}).`, details, fix: 'A restricted key needs read access to webhook endpoints for this check.' };
		const list = ((await readJson(endpoints)) as { data?: { url?: string; status?: string }[] } | undefined)?.data ?? [];
		const ours = list.find((endpoint) => endpoint.url?.endsWith('/sponsorship/payment-webhook'));
		if (!ours || ours.status !== 'enabled') return { state: 'warning', summary: `On in ${mode} mode, but no enabled Stripe webhook points at /sponsorship/payment-webhook, so gifts are not recorded.`, details, fix: 'Add the endpoint in Stripe (docs/sponsorship.md).' };
		return { state: 'working', summary: `On in ${mode} mode; the gift webhook is enabled.`, details: [...details, `Webhook: ${ours.url}`] };
	}
};

const videoRooms: Check = {
	key: 'video-rooms',
	group: 'Outside services',
	name: 'Video rooms',
	target: { name: 'Cloudflare RealtimeKit', kind: 'Outside service', part: 'VIDEO_ROOM_TOKEN' },
	use: 'Video rooms for events',
	test: 'Reads the app’s meeting count with the token. No meeting is made.',
	async run({ environment, fetcher }) {
		const settings = videoRoomSettings(environment);
		if (!settings) return { state: 'off', summary: 'Off: VIDEO_ROOM_TOKEN is not set, so events have no video room.', details: [], fix: `Add an API token with the Realtime permission as the Secret VIDEO_ROOM_TOKEN in the ${settingsPlace} (COLLABORATION.md, "The video room").` };
		const { place, total } = await readMeetingTotal(settings, fetcher);
		const details = [`Cloudflare RealtimeKit app: ${place.application}`];
		if (total !== null) details.push(`Meetings made so far: ${total}`);
		return { state: 'working', summary: 'The token reaches the RealtimeKit app and can read its meetings. No meeting was made.', details };
	}
};

const imageryNames: Record<MapImageryName, string> = {
	satellite: 'Satellite map pictures',
	terrain: 'Terrain map pictures',
	contours: 'Contour lines'
};

const imageryUses: Record<MapImageryName, string> = {
	satellite: 'The satellite base map',
	terrain: 'The terrain base map',
	contours: 'The contour lines layer'
};

function imageryServiceName(name: MapImageryName): string {
	const source = mapImagery[name];
	return source.kind === 'tiles' ? source.service : (new URL(source.address).pathname.split('/').at(-3) ?? source.address);
}

function imageryCheck(name: MapImageryName): Check {
	return {
		key: `map-imagery-${name}`,
		group: 'Outside services',
		name: imageryNames[name],
		target: { name: 'The National Map (U.S. Geological Survey)', kind: 'Outside service', part: imageryServiceName(name) },
		use: imageryUses[name],
		test: mapImagery[name].kind === 'drawn' ? 'Asks for the service’s description, since drawing a picture can take longer than the check waits.' : 'Asks for the one picture of the whole world, at zoom 0.',
		async run({ fetcher }) {
			const source = mapImagery[name];
			const details = [`U.S. Geological Survey, The National Map: ${source.kind === 'tiles' ? source.service : new URL(source.address).pathname.split('/').at(-3)}`];
			if (source.kind === 'drawn') {
				// A drawn picture can take the survey longer than the check's ten seconds, so this asks for the service's description, which proves it is up.
				const response = await fetcher(`${source.address.replace(/\/export$/, '')}?f=json`, { headers: { 'cache-control': 'no-cache' } });
				const body = response.ok ? ((await readJson(response)) as { error?: { message?: string }; layers?: unknown[] } | undefined) : (await response.body?.cancel(), undefined);
				if (!response.ok || !body || body.error) return { state: 'problem', summary: `The National Map answered ${body?.error?.message ?? response.status}, so the ${name} layer shows nothing.`, details, fix: 'Usually brief; check https://www.usgs.gov/the-national-map-data-delivery if it lasts.' };
				return { state: 'working', summary: 'The U.S. Geological Survey’s contour service answers.', details };
			}
			// The one picture of the whole world, at zoom 0.
			const response = await fetcher(imageryAddress(name, 0, 0, 0), { headers: { 'cache-control': 'no-cache' } });
			const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
			await response.body?.cancel();
			if (!response.ok) return { state: 'problem', summary: `The National Map answered ${response.status}, so the ${name} base map shows nothing.`, details, fix: 'Usually brief; check https://www.usgs.gov/the-national-map-data-delivery if it lasts.' };
			if (!type.startsWith('image/')) return { state: 'warning', summary: `The National Map answered with ${type || 'no type'} instead of a picture.`, details };
			return { state: 'working', summary: 'The U.S. Geological Survey sent a picture.', details };
		}
	};
}

const waybackCaptures: Check = {
	key: 'wayback-captures',
	group: 'Workers',
	name: 'Wayback captures',
	binding: 'waybackWorker',
	target: { name: 'tribal-law-project-wayback', kind: 'Worker' },
	use: 'Saving cited links to the Internet Archive’s Wayback Machine',
	test: 'Asks the Worker for its progress: when it last ran, what it saved and what failed.',
	async run({ environment }) {
		const read = await readWaybackStatus(environment.waybackWorker);
		if ('problem' in read) {
			return { state: environment.waybackWorker ? 'problem' : 'off', summary: `${read.problem} Source links are saved only by the slower archive workflow.`, details: [], fix: 'Deploy the Worker from site/wayback, add its two archive.org key secrets, and keep the waybackWorker service binding in site/wrangler.jsonc (site/WAYBACK.md, "Setting it up").' };
		}
		const { status } = read;
		const details = [
			`${status.captured.toLocaleString('en-US')} captured (${status.capturedLast24Hours.toLocaleString('en-US')} in the last 24 hours), ${status.left.toLocaleString('en-US')} left, ${status.waiting} being saved now.`,
			`${status.failedWillRetry} failed and will be tried again; ${status.gaveUp} given up after three tries; ${status.markedByHand} marked by hand (workspace, Wayback captures). Progress page: ${waybackWorkerAddress}/`
		];
		switch (status.state) {
			case 'not-running':
				// The cron runs every minute even with nothing left, so a stale run means the schedule stopped.
				return { state: 'problem', summary: status.minutesSinceLastRun === null ? 'The Wayback Worker has not run yet.' : `The Wayback Worker last ran ${status.minutesSinceLastRun} minutes ago; it runs every minute, even with nothing to save.`, details, fix: 'Check the Worker’s cron trigger and its logs in the Cloudflare dashboard (site/WAYBACK.md).' };
			case 'keys-refused':
				return { state: 'problem', summary: status.lastError ?? 'The archive.org keys are missing or refused.', details, fix: 'Add or replace the ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY secrets on the tribal-law-project-wayback Worker (site/WAYBACK.md).' };
			case 'paused-daily-limit':
				return { state: 'warning', summary: 'The Wayback Worker reached the Archive’s daily limit and starts again within the hour.', details };
			case 'idle':
				return { state: 'working', summary: 'The Wayback Worker is running and has nothing left to save.', details };
			default:
				return { state: 'working', summary: `The Wayback Worker is running (${status.stateWords.toLocaleLowerCase('en-US')}): ${status.left.toLocaleString('en-US')} left.`, details };
		}
	}
};

/** The watch Worker's progress, which it writes to the source documents bucket every minute (src/lib/server/watch/progress.ts). */
async function watchProgress(environment: WorkerEnvironment): Promise<WatchProgress | null | { problem: string }> {
	if (!environment.sourceDocuments) return { problem: 'The sourceDocuments bucket binding is missing.' };
	try {
		return await readWatchProgress(environment.sourceDocuments);
	} catch (problem) {
		return { problem: `Its progress could not be read: ${message(problem)}` };
	}
}

const watchSetup = 'Deploy the Worker from site/watch with Workers Builds (site/watch/README.md, "Setting it up").';

const sourceWatch: Check = {
	key: 'source-watch',
	group: 'Workers',
	name: 'Source watch',
	target: { name: 'tribal-law-project-watch', kind: 'Worker' },
	use: 'Finding new Federal Register documents, eCFR changes and changed cited links',
	test: 'Reads the progress file the Worker writes to tribal-law-project-files every minute.',
	async run({ environment, now = new Date() }) {
		const progress = await watchProgress(environment);
		if (progress && 'problem' in progress) return { state: 'problem', summary: progress.problem, details: [] };
		const { state, minutesSinceTick } = watchState(progress, now);
		if (!progress) return { state: 'off', summary: 'The source watch has not run yet, so new Federal Register documents, eCFR changes and changed cited links are not found.', details: [], fix: watchSetup };
		const counts = progress.counts ?? {};
		const watchers = Object.entries(progress.watchers);
		const failing = watchers.filter(([, watcher]) => watcher.enabled && watcher.lastOutcome === 'failed');
		const details = [
			`${(counts['to-review'] ?? 0).toLocaleString('en-US')} to review, ${(counts.held ?? 0).toLocaleString('en-US')} held, ${(counts['waiting-for-model'] ?? 0).toLocaleString('en-US')} waiting for a model.`,
			`${watchers.filter(([, watcher]) => watcher.enabled).length} of ${watchers.length} watchers on. Progress page: ${watchWorkerAddress}/`,
			...failing.map(([identifier, watcher]) => `${watcher.title} (${identifier}) failed: ${watcher.lastProblem ?? 'no reason given'}`),
			progress.knownIndex ? `Records index from the site build of ${progress.knownIndex.madeAt}.` : 'No records index yet, so nothing found is matched against the records; the site writes it within the hour after a build.'
		];
		switch (state) {
			case 'not-running':
				return { state: 'problem', summary: `The source watch last ran ${minutesSinceTick} minutes ago; it runs every minute.`, details, fix: 'Check the tribal-law-project-watch Worker’s cron trigger and its logs in the Cloudflare dashboard.' };
			case 'idle':
				return { state: 'warning', summary: 'The source watch is running, but every watcher is off.', details, fix: 'Clear WATCH_TURN_OFF on the tribal-law-project-watch Worker.' };
			case 'problem':
				return { state: 'warning', summary: progress.lastError ?? `${failing.length} watcher${failing.length === 1 ? '' : 's'} failed on the last run.`, details };
			default:
				return { state: progress.knownIndex ? 'working' : 'warning', summary: `${watchStateWords[state]}.`, details };
		}
	}
};

const sourceWatchModels: Check = {
	key: 'source-watch-models',
	group: 'Workers',
	name: 'Source watch models',
	target: { name: 'tribal-law-project-watch', kind: 'Worker', part: 'Workers AI' },
	use: 'Sorting what the source watch finds when its rules cannot decide',
	test: 'Reads the model, its last problem and 30 days of spending from the same progress file.',
	async run({ environment, now = new Date() }) {
		const progress = await watchProgress(environment);
		if (progress && 'problem' in progress) return { state: 'problem', summary: progress.problem, details: [] };
		if (!progress) return { state: 'off', summary: 'The source watch has not run yet.', details: [], fix: watchSetup };
		const models = progress.models;
		const spend = models.spend30Days ?? [];
		const total = spend.reduce((sum, row) => sum + row.costMicrodollars, 0);
		const details = [
			...spend.map((row) => `${row.model}: ${row.calls.toLocaleString('en-US')} calls, ${dollars(row.costMicrodollars)} in the last 30 days.`),
			...(spend.length > 1 ? [`Together: ${dollars(total)} in the last 30 days.`] : []),
			...(models.lastSample ? [`Last weekly sample check ${models.lastSample.at}: ${models.lastSample.checked} checked, ${models.lastSample.disagreed} disagreed with the cheaper model.`] : [])
		];
		const fix = 'Set WATCH_TRIAGE_PROVIDER to workers-ai on the tribal-law-project-watch Worker (Settings > Variables and Secrets), or remove it to use the default (site/watch/README.md, "Models").';
		if (models.provider === 'none') return { state: 'off', summary: 'Triage by model is off, so items the rules cannot decide go to people.', details, fix };
		if (!models.ready) return { state: 'problem', summary: models.problem ?? 'The triage provider is not ready.', details, fix };
		const recentProblem = models.lastProblemAt && now.getTime() - Date.parse(models.lastProblemAt) < 3_600_000;
		if (recentProblem) return { state: 'problem', summary: `The models did not answer: ${models.problem ?? 'no reason given'}`, details, fix: models.provider === 'ai-gateway' ? 'Check the gateway’s logs and the credit balance in the Cloudflare dashboard (AI > AI Gateway > source-watch). Waiting items stay waiting until it answers.' : 'Check the Worker’s logs in the Cloudflare dashboard (Workers & Pages > tribal-law-project-watch > Logs). Waiting items stay waiting until the model answers.' };
		return { state: 'working', summary: `${models.cheapModel ?? 'The cheap model'} sorts the middle band ${models.provider === 'ai-gateway' ? `through AI Gateway ${models.gateway ?? ''}` : 'on Workers AI'}${models.lastCallAt ? `; last call ${models.lastCallAt}` : '; no calls yet'}.`, details };
	}
};

const breachedPasswords: Check = {
	key: 'breached-passwords',
	group: 'Outside services',
	name: 'Breached password list',
	target: { name: 'Have I Been Pwned', kind: 'Outside service', part: 'api.pwnedpasswords.com' },
	use: 'Turning away passwords known from data breaches',
	test: 'Asks for the hashes starting 00000, which is nobody’s password.',
	async run({ fetcher }) {
		// The first five characters of a hash, as the site sends for a new password; "00000" is nobody's password.
		const response = await fetcher(`${pwnedPasswordsRange}00000`, { headers: { 'add-padding': 'true', 'user-agent': 'model-tribal-adr-code-password-check' } });
		await response.body?.cancel();
		return response.ok
			? { state: 'working', summary: 'Have I Been Pwned answers, so new passwords are checked against known breaches.', details: [] }
			: { state: 'warning', summary: `Have I Been Pwned answered ${response.status}, so new passwords are not checked against breaches for now.`, details: [], fix: 'Sign-up and password changes still work; they skip this check until it answers.' };
	}
};

function directoryCheck(key: string, name: string, keeper: string, link: string): Check {
	return {
		key,
		group: 'Outside services',
		name,
		target: { name: keeper.replace(/^The /, ''), kind: 'Outside service', part: new URL(link).hostname },
		use: 'The weekly check of the address book against official contacts',
		test: 'Asks for the number of entries.',
		async run({ fetcher }) {
			const query = new URLSearchParams({ where: '1=1', returnCountOnly: 'true', f: 'json' });
			const response = await fetcher(`${link}/query?${query}`);
			if (!response.ok) {
				await response.body?.cancel();
				return { state: 'problem', summary: `The directory answered ${response.status}, so the weekly address book check cannot read it.`, details: [link] };
			}
			const body = (await readJson(response)) as { count?: number; error?: { message?: string } } | undefined;
			if (typeof body?.count !== 'number') return { state: 'problem', summary: `The directory did not give a count${body?.error?.message ? `: ${body.error.message}` : ''}.`, details: [link], fix: 'Its address may have moved; update it in src/lib/server/address-book.ts.' };
			if (body.count === 0) return { state: 'warning', summary: 'The directory answers but lists nobody.', details: [link] };
			return { state: 'working', summary: `${keeper}’s directory answers and lists ${body.count.toLocaleString('en-US')} entries.`, details: [link] };
		}
	};
}

const siteTextRebuilds: Check = {
	key: 'site-text',
	group: 'Workers',
	name: 'Site text rebuilds',
	target: { name: 'tribal-law-project-site', kind: 'Worker', part: 'deploy hook' },
	use: 'Rebuilding the site when site text is published',
	test: 'Checks that SITE_REBUILD_HOOK_URL is set and reads the outcome of the last rebuild request. It does not start a rebuild.',
	async run({ environment }) {
		const fix = `Create a deploy hook for the website (Workers & Pages > tribal-law-project-site > Settings > Builds > Deploy Hooks) and save its address as the secret SITE_REBUILD_HOOK_URL (${settingsPlace}).`;
		let publication: number;
		let last: Awaited<ReturnType<typeof latestRebuild>>;
		try {
			publication = await latestPublication(environment.database);
			last = await latestRebuild(environment.database);
		} catch {
			return { state: 'off', summary: 'The site text tables are missing.', details: [], fix: 'Apply migration 20261124T0119_add_site_text.sql.' };
		}
		const details = [
			publication ? `Newest publication: ${publication}.` : 'Nothing published yet.',
			...(last ? [`Last rebuild asked for publication ${last.publication} at ${last.requestedAt}: ${last.outcome}.`] : [])
		];
		if (!text(environment, 'SITE_REBUILD_HOOK_URL')) {
			return { state: 'off', summary: 'No deploy hook, so published site text goes live with the next code change.', details, fix };
		}
		if (last && last.outcome !== 'asked') {
			return { state: 'warning', summary: 'The last rebuild could not be asked for.', details, fix: `Check the deploy hook. ${fix}` };
		}
		return { state: 'working', summary: 'Publishing site text rebuilds the site.', details };
	}
};

export const serviceChecks: readonly Check[] = [
	database,
	sourceLibrary,
	bucketCheck('source-documents-bucket', 'Files bucket', 'sourceDocuments', 'tribal-law-project-files', 'source documents and sent files', 'Source documents, sent files, map tiles, the library’s change files and the Workers’ progress files'),
	bucketCheck('mail-bucket', 'Mail bucket', 'mailFiles', 'tribal-law-project-mail', 'the project inbox’s messages and attachments', 'The project inbox’s messages and attachments'),
	mapTiles,
	siteFiles,
	liveEditing,
	scannerDesk,
	scanner,
	waybackCaptures,
	sourceWatch,
	sourceWatchModels,
	siteTextRebuilds,
	rateLimitCheck('request-form-limit', 'Request and order forms', 'requestFormLimit', 'the request form, self-help forms and book quotes and orders', 5, 'network address'),
	rateLimitCheck('workspace-change-limit', 'Workspace changes', 'workspaceChangeLimit', 'making changes in the workspace and following pages', 30, 'person'),
	rateLimitCheck('sign-in-limit', 'Sign-in, by email address', 'signInLimit', 'guessing codes and passwords for one address', 5, 'email address and step'),
	rateLimitCheck('sign-in-network-limit', 'Sign-in, by network address', 'signInNetworkLimit', 'guessing from one network address', 30, 'network address and step'),
	rateLimitCheck('upload-limit', 'Uploads', 'uploadLimit', 'starting uploads', 600, 'account'),
	siteAddress,
	leadAuthor,
	passwordKey,
	emailCheck('sign-in-email', 'Sign-in codes', 'signInEmail', 'SIGN_IN_EMAIL_FROM', 'sign-in codes'),
	emailCheck('update-email', 'Followed-page summaries', 'updateEmail', 'UPDATE_EMAIL_FROM', 'summaries of followed pages'),
	inbox,
	outreach,
	videoRooms,
	imageryCheck('satellite'),
	imageryCheck('terrain'),
	imageryCheck('contours'),
	breachedPasswords,
	directoryCheck('federal-directory', 'Tribal Leaders Directory', 'The Bureau of Indian Affairs', federalDirectoryLink),
	directoryCheck('alaska-directory', 'Alaska tribes directory', 'The State of Alaska', alaskaDirectoryLink),
	bookOrders,
	lulu,
	stripe,
	sponsorGifts
];

/**
 * The databases and buckets the site used before the Nov. 26, 2026 move to
 * new ones under the new names (docs/cloudflare-names.md). The site has no
 * binding to them, so nothing checks them; the page lists them so their names
 * are not mistaken for the ones in use. Remove each once it is deleted.
 */
export const oldResources: readonly (CheckTarget & { title: string; replacedBy: string; note?: string })[] = [
	{ name: 'model-tribal-adr-code', kind: 'D1 database', title: 'Old main database', replacedBy: 'tribal-law-project', note: 'Only the Wayback Worker’s temporary copy code still reads it.' },
	{ name: 'model-tribal-adr-code-library', kind: 'D1 database', title: 'Old source library database', replacedBy: 'tribal-law-project-library' },
	{ name: 'model-tribal-adr-code-sources', kind: 'R2 bucket', title: 'Old files bucket', replacedBy: 'tribal-law-project-files', note: 'Only the Wayback Worker’s temporary copy code still reads it.' },
	{ name: 'model-tribal-adr-code-mail', kind: 'R2 bucket', title: 'Old mail bucket', replacedBy: 'tribal-law-project-mail' }
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
			return {
				key: check.key,
				group: check.group,
				name: check.name,
				...(check.binding ? { binding: check.binding } : {}),
				target: check.target,
				use: check.use,
				test: check.test,
				...outcome,
				milliseconds: Date.now() - started
			};
		})
	);
}
