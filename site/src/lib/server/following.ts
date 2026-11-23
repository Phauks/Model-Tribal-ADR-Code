/**
 * Following pages: the database side (site/COLLABORATION.md, "Following
 * pages"; migrations/0009_following.sql; shared rules in src/lib/following.ts).
 *
 * How an update is found. Nation pages and the model code are built ahead of
 * time, so the build lists each followable page with a fingerprint of what it
 * shows readers (vite.config.ts, "followable-pages"). Essays are published
 * from the workspace, so their fingerprint is the newest listed publication.
 * `checkForUpdates` compares both with the fingerprints last seen and records
 * an update for each followed page whose fingerprint changed. It runs every
 * hour (the Worker's scheduled run, tools/add-scheduled-run.mjs), the first
 * time a new build answers a signed-in reader, and right after an essay is
 * published or held back.
 *
 * Nothing stored here holds a page's text or title. Titles come from the live
 * site when a notice is shown, and a page that is no longer on the site is
 * shown without one.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import { followKindOf, followLimit, isEmailChoice, type EmailChoice, type FollowKind } from '#lib/following.ts';
import { allListedPublications, essayPath } from './essays.ts';

/** One page built with the site that can be followed. */
export interface FollowablePage {
	address: string;
	kind: FollowKind;
	title: string;
	/** A hash of what the page shows readers. */
	fingerprint: string;
}

/** What the build says about the followable pages (virtual:followable-pages). */
export interface FollowableBuild {
	/** When the site was built, as an ISO 8601 date and time. Later builds win. */
	builtAt: string;
	/** A hash of every page's address and fingerprint. */
	buildHash: string;
	/**
	 * Raised whenever the way fingerprints are worked out changes, so that the
	 * change is not mistaken for every page being updated at once.
	 */
	fingerprintVersion: number;
	pages: FollowablePage[];
}

/** A page a notice or the Following page can name: built with the site, or a published essay. */
export type PageDirectory = Map<string, Pick<FollowablePage, 'kind' | 'title'>>;

function now(): string {
	return new Date().toISOString();
}

/** Each essay readers can see, with the newest listed publication as its fingerprint. */
export async function essayPages(database: D1Database): Promise<FollowablePage[]> {
	const newest = new Map<string, Awaited<ReturnType<typeof allListedPublications>>[number]>();
	for (const row of await allListedPublications(database)) {
		const seen = newest.get(row.essay_identifier);
		if (!seen || row.number > seen.number) newest.set(row.essay_identifier, row);
	}
	return [...newest.values()].map((row) => ({
		address: essayPath(row.essay_identifier, row.part),
		kind: 'essay' as const,
		title: row.title || row.essay_identifier,
		// The text's hash: publishing the same text again is not an update.
		fingerprint: row.sha256 ?? `${row.number}`
	}));
}

/** Every page that can be followed now, by address. */
export function pageDirectory(build: FollowableBuild, essays: FollowablePage[]): PageDirectory {
	const directory: PageDirectory = new Map();
	for (const page of [...build.pages, ...essays]) directory.set(page.address, { kind: page.kind, title: page.title });
	return directory;
}

// ---------------------------------------------------------------------------
// Following and unfollowing

export type FollowResult = 'following' | 'not-followable' | 'too-many';

export async function follow(
	database: D1Database,
	accountIdentifier: string,
	address: string,
	directory: PageDirectory
): Promise<FollowResult> {
	if (!followKindOf(address) || !directory.has(address)) return 'not-followable';
	const count = await database
		.prepare('SELECT COUNT(*) AS count FROM follows WHERE account_identifier = ?')
		.bind(accountIdentifier)
		.first<{ count: number }>();
	if ((count?.count ?? 0) >= followLimit) return 'too-many';
	await database
		.prepare(
			`INSERT INTO follows (account_identifier, address, followed_at, since_update)
			 VALUES (?, ?, ?, (SELECT COALESCE(MAX(identifier), 0) FROM page_updates))
			 ON CONFLICT (account_identifier, address) DO NOTHING`
		)
		.bind(accountIdentifier, address, now())
		.run();
	return 'following';
}

export async function unfollow(database: D1Database, accountIdentifier: string, address: string): Promise<void> {
	await database
		.prepare('DELETE FROM follows WHERE account_identifier = ? AND address = ?')
		.bind(accountIdentifier, address)
		.run();
}

export async function isFollowing(database: D1Database, accountIdentifier: string, address: string): Promise<boolean> {
	const row = await database
		.prepare('SELECT 1 AS yes FROM follows WHERE account_identifier = ? AND address = ?')
		.bind(accountIdentifier, address)
		.first<{ yes: number }>();
	return Boolean(row);
}

export interface FollowedPage {
	address: string;
	followedAt: string;
	/** From the live site; undefined when the page is no longer on it. */
	title: string | undefined;
	kind: FollowKind | undefined;
}

/** The pages an account follows, most recently followed first. */
export async function followedPages(
	database: D1Database,
	accountIdentifier: string,
	directory: PageDirectory
): Promise<FollowedPage[]> {
	const { results } = await database
		.prepare('SELECT address, followed_at FROM follows WHERE account_identifier = ? ORDER BY followed_at DESC, address')
		.bind(accountIdentifier)
		.all<{ address: string; followed_at: string }>();
	return results.map((row) => {
		const page = directory.get(row.address);
		return { address: row.address, followedAt: row.followed_at, title: page?.title, kind: page?.kind ?? followKindOf(row.address) };
	});
}

// ---------------------------------------------------------------------------
// Notices on the site

export interface Notice {
	identifier: number;
	address: string;
	kind: FollowKind;
	updatedAt: string;
	unread: boolean;
}

const noticeQuery = `
	SELECT u.identifier, u.address, u.kind, u.updated_at,
		u.identifier > COALESCE(s.last_read_update, 0) AS unread
	FROM page_updates u
	JOIN follows f ON f.address = u.address AND f.account_identifier = ?1
	LEFT JOIN follow_settings s ON s.account_identifier = ?1
	WHERE u.identifier > f.since_update`;

/** The newest notices for an account, newest first. */
export async function noticesFor(database: D1Database, accountIdentifier: string, limit = 100): Promise<Notice[]> {
	const { results } = await database
		.prepare(`${noticeQuery} ORDER BY u.identifier DESC LIMIT ?2`)
		.bind(accountIdentifier, limit)
		.all<{ identifier: number; address: string; kind: FollowKind; updated_at: string; unread: number }>();
	return results.map((row) => ({
		identifier: row.identifier,
		address: row.address,
		kind: row.kind,
		updatedAt: row.updated_at,
		unread: Boolean(row.unread)
	}));
}

export async function unreadCount(database: D1Database, accountIdentifier: string): Promise<number> {
	const row = await database
		.prepare(`SELECT COUNT(*) AS count FROM (${noticeQuery}) WHERE unread`)
		.bind(accountIdentifier)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

/** Marks every notice up to `upTo` as seen. */
export async function markNoticesRead(database: D1Database, accountIdentifier: string, upTo: number): Promise<void> {
	await database
		.prepare(
			`INSERT INTO follow_settings (account_identifier, last_read_update, updated_at) VALUES (?1, ?2, ?3)
			 ON CONFLICT (account_identifier) DO UPDATE SET
				last_read_update = MAX(last_read_update, excluded.last_read_update), updated_at = excluded.updated_at`
		)
		.bind(accountIdentifier, upTo, now())
		.run();
}

// ---------------------------------------------------------------------------
// Email settings

export interface FollowSettings {
	email: EmailChoice;
	lastEmailedAt: string | null;
}

export const defaultEmailChoice: EmailChoice = 'daily';

export async function settingsFor(database: D1Database, accountIdentifier: string): Promise<FollowSettings> {
	const row = await database
		.prepare('SELECT email, last_emailed_at FROM follow_settings WHERE account_identifier = ?')
		.bind(accountIdentifier)
		.first<{ email: string; last_emailed_at: string | null }>();
	return {
		email: isEmailChoice(row?.email) ? row.email : defaultEmailChoice,
		lastEmailedAt: row?.last_emailed_at ?? null
	};
}

export async function setEmailChoice(database: D1Database, accountIdentifier: string, choice: EmailChoice): Promise<void> {
	await database
		.prepare(
			`INSERT INTO follow_settings (account_identifier, email, updated_at) VALUES (?1, ?2, ?3)
			 ON CONFLICT (account_identifier) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at`
		)
		.bind(accountIdentifier, choice, now())
		.run();
}

/** Turns emails off from the link in an email. True when the token matched an account. */
export async function turnOffEmailByToken(database: D1Database, token: string): Promise<boolean> {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
	const result = await database
		.prepare(`UPDATE follow_settings SET email = 'off', updated_at = ? WHERE email_off_token = ?`)
		.bind(now(), token)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Finding updates

export interface CheckResult {
	/** Whether this run compared a new build of the site. */
	comparedBuild: boolean;
	/** Updates recorded for followed pages. */
	updates: number;
}

/**
 * Compares the fingerprints of the built pages and the essays with the ones
 * last seen, and records an update for each followed page that changed. Safe
 * to run often and from several copies of the Worker at once.
 */
export async function checkForUpdates(
	database: D1Database,
	build: FollowableBuild,
	essays: FollowablePage[],
	at = now()
): Promise<CheckResult> {
	const comparedBuild = await compareBuild(database, build, at);
	const essayUpdates = await compareEssays(database, essays, at);
	return { comparedBuild: comparedBuild.compared, updates: comparedBuild.updates + essayUpdates };
}

interface CheckRow {
	built_at: string;
	build_hash: string;
	fingerprint_version: number;
}

async function compareBuild(
	database: D1Database,
	build: FollowableBuild,
	at: string
): Promise<{ compared: boolean; updates: number }> {
	const last = await database
		.prepare('SELECT built_at, build_hash, fingerprint_version FROM following_checks WHERE name = ?')
		.bind('site')
		.first<CheckRow>();
	// An older build still answering during a deploy never undoes a newer one.
	if (last && (last.built_at >= build.builtAt || last.build_hash === build.buildHash)) return { compared: false, updates: 0 };

	const { results: stored } = await database
		.prepare(`SELECT address, fingerprint FROM page_fingerprints WHERE source = 'build'`)
		.all<{ address: string; fingerprint: string }>();
	const before = new Map(stored.map((row) => [row.address, row.fingerprint]));
	const current = new Set(build.pages.map((page) => page.address));
	// The first comparison, or one after the fingerprints were worked out
	// differently, only records them: nothing is reported as changed.
	const reportChanges = Boolean(last) && last?.fingerprint_version === build.fingerprintVersion;
	const changed = build.pages.filter((page) => before.has(page.address) && before.get(page.address) !== page.fingerprint);
	const written = build.pages.filter((page) => before.get(page.address) !== page.fingerprint);
	const removed = [...before.keys()].filter((address) => !current.has(address));

	const token = randomToken();
	// Only the run that claimed this build writes: the claim's token is parameter number `slot`.
	const claimed = (slot: number) => `EXISTS (SELECT 1 FROM following_checks WHERE name = 'site' AND run_token = ?${slot})`;
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`INSERT INTO following_checks (name, built_at, build_hash, fingerprint_version, run_token, checked_at)
				 VALUES ('site', ?1, ?2, ?3, ?4, ?5)
				 ON CONFLICT (name) DO UPDATE SET
					built_at = excluded.built_at, build_hash = excluded.build_hash,
					fingerprint_version = excluded.fingerprint_version, run_token = excluded.run_token,
					checked_at = excluded.checked_at
				 WHERE following_checks.built_at < excluded.built_at AND following_checks.build_hash <> excluded.build_hash`
			)
			.bind(build.builtAt, build.buildHash, build.fingerprintVersion, token, at)
	];
	if (reportChanges && changed.length > 0) {
		statements.push(
			database
				.prepare(
					`INSERT INTO page_updates (address, kind, updated_at)
					 SELECT j.value ->> '$.address', j.value ->> '$.kind', ?1
					 FROM json_each(?2) AS j
					 WHERE EXISTS (SELECT 1 FROM follows f WHERE f.address = j.value ->> '$.address')
					 AND ${claimed(3)}
					 ORDER BY j.key`
				)
				.bind(at, JSON.stringify(changed.map(({ address, kind }) => ({ address, kind }))), token)
		);
	}
	if (written.length > 0) {
		statements.push(
			database
				.prepare(
					`INSERT INTO page_fingerprints (address, source, fingerprint, seen_at)
					 SELECT j.value ->> '$.address', 'build', j.value ->> '$.fingerprint', ?1
					 FROM json_each(?2) AS j
					 WHERE ${claimed(3)}
					 ON CONFLICT (address) DO UPDATE SET
						source = excluded.source, fingerprint = excluded.fingerprint, seen_at = excluded.seen_at`
				)
				.bind(at, JSON.stringify(written.map(({ address, fingerprint }) => ({ address, fingerprint }))), token)
		);
	}
	if (removed.length > 0) {
		statements.push(
			database
				.prepare(
					`DELETE FROM page_fingerprints
					 WHERE source = 'build' AND address IN (SELECT value FROM json_each(?1))
					 AND ${claimed(2)}`
				)
				.bind(JSON.stringify(removed), token)
		);
	}
	await database.batch(statements);
	const won = await database
		.prepare(`SELECT 1 AS yes FROM following_checks WHERE name = 'site' AND run_token = ?`)
		.bind(token)
		.first<{ yes: number }>();
	if (!won) return { compared: false, updates: 0 };
	return { compared: true, updates: reportChanges ? await countFollowed(database, changed) : 0 };
}

async function countFollowed(database: D1Database, pages: Pick<FollowablePage, 'address'>[]): Promise<number> {
	if (pages.length === 0) return 0;
	const row = await database
		.prepare('SELECT COUNT(DISTINCT address) AS count FROM follows WHERE address IN (SELECT value FROM json_each(?))')
		.bind(JSON.stringify(pages.map((page) => page.address)))
		.first<{ count: number }>();
	return row?.count ?? 0;
}

/**
 * Essays change when one is published or held back. Each changed essay is
 * written with its old fingerprint as a condition, so two copies of the
 * Worker comparing at once record the update only once.
 */
async function compareEssays(database: D1Database, essays: FollowablePage[], at: string): Promise<number> {
	const { results: stored } = await database
		.prepare(`SELECT address, fingerprint FROM page_fingerprints WHERE source = 'essay'`)
		.all<{ address: string; fingerprint: string }>();
	const before = new Map(stored.map((row) => [row.address, row.fingerprint]));
	const statements: D1PreparedStatement[] = [];
	let updates = 0;
	for (const page of essays) {
		const old = before.get(page.address);
		if (old === page.fingerprint) continue;
		if (old === undefined) {
			// A newly published essay: nobody can follow it yet.
			statements.push(
				database
					.prepare(
						`INSERT INTO page_fingerprints (address, source, fingerprint, seen_at) VALUES (?, 'essay', ?, ?)
						 ON CONFLICT (address) DO NOTHING`
					)
					.bind(page.address, page.fingerprint, at)
			);
			continue;
		}
		statements.push(
			database
				.prepare(
					`INSERT INTO page_updates (address, kind, updated_at)
					 SELECT ?1, 'essay', ?2
					 WHERE EXISTS (SELECT 1 FROM page_fingerprints WHERE address = ?1 AND fingerprint = ?3)
					 AND EXISTS (SELECT 1 FROM follows WHERE address = ?1)`
				)
				.bind(page.address, at, old),
			database
				.prepare('UPDATE page_fingerprints SET fingerprint = ?, seen_at = ? WHERE address = ? AND fingerprint = ?')
				.bind(page.fingerprint, at, page.address, old)
		);
		updates += 1;
	}
	// An essay that is no longer listed keeps its fingerprint, so listing it
	// again counts as an update only if its text changed.
	if (statements.length > 0) await database.batch(statements);
	return updates;
}

// ---------------------------------------------------------------------------
// Summary emails

export interface DigestPage {
	address: string;
	title: string;
	kind: FollowKind;
	/** The newest update to the page in this email. */
	updatedAt: string;
}

export interface Digest {
	accountIdentifier: string;
	email: string;
	choice: Exclude<EmailChoice, 'off'>;
	/** The newest update the email covers. */
	upTo: number;
	pages: DigestPage[];
	/** The token in the "Stop these emails" link. */
	emailOffToken: string;
}

const intervals: Record<Exclude<EmailChoice, 'off'>, number> = {
	// A little under a day and a week, so an hourly run never slips a day.
	daily: 23 * 60 * 60 * 1000,
	weekly: (7 * 24 - 1) * 60 * 60 * 1000
};

/**
 * The summary emails due now: for each account that wants email, whose last
 * email was long enough ago, the followed pages updated since then. A page
 * that is no longer on the site is left out, since its notice has no title or
 * link to give.
 */
export async function dueDigests(
	database: D1Database,
	directory: PageDirectory,
	at = new Date(),
	limit = 100
): Promise<Digest[]> {
	const { results } = await database
		.prepare(
			`SELECT a.identifier AS account, a.email AS email, COALESCE(s.email, ?1) AS choice,
				s.last_emailed_at AS last_emailed_at, s.email_off_token AS token,
				u.identifier AS update_identifier, u.address AS address, u.kind AS kind, u.updated_at AS updated_at
			 FROM follows f
			 JOIN accounts a ON a.identifier = f.account_identifier
			 LEFT JOIN follow_settings s ON s.account_identifier = f.account_identifier
			 JOIN page_updates u ON u.address = f.address
				AND u.identifier > f.since_update
				AND u.identifier > COALESCE(s.last_emailed_update, 0)
			 WHERE COALESCE(s.email, ?1) <> 'off'
			 ORDER BY a.identifier, u.identifier`
		)
		.bind(defaultEmailChoice)
		.all<{
			account: string;
			email: string;
			choice: string;
			last_emailed_at: string | null;
			token: string | null;
			update_identifier: number;
			address: string;
			kind: FollowKind;
			updated_at: string;
		}>();
	const digests = new Map<string, Digest>();
	for (const row of results) {
		if (!isEmailChoice(row.choice) || row.choice === 'off') continue;
		if (row.last_emailed_at && at.getTime() - Date.parse(row.last_emailed_at) < intervals[row.choice]) continue;
		let digest = digests.get(row.account);
		if (!digest) {
			if (digests.size >= limit) continue;
			digest = {
				accountIdentifier: row.account,
				email: row.email,
				choice: row.choice,
				upTo: 0,
				pages: [],
				emailOffToken: row.token ?? ''
			};
			digests.set(row.account, digest);
		}
		digest.upTo = Math.max(digest.upTo, row.update_identifier);
		const page = directory.get(row.address);
		if (!page) continue;
		const listed = digest.pages.find((entry) => entry.address === row.address);
		if (listed) listed.updatedAt = row.updated_at;
		else digest.pages.push({ address: row.address, title: page.title, kind: row.kind, updatedAt: row.updated_at });
	}
	// Each email needs a lasting "Stop these emails" token.
	for (const digest of digests.values()) {
		if (digest.emailOffToken) continue;
		digest.emailOffToken = randomToken();
		await database
			.prepare(
				`INSERT INTO follow_settings (account_identifier, email_off_token, updated_at) VALUES (?1, ?2, ?3)
				 ON CONFLICT (account_identifier) DO UPDATE SET
					email_off_token = COALESCE(follow_settings.email_off_token, excluded.email_off_token)`
			)
			.bind(digest.accountIdentifier, digest.emailOffToken, at.toISOString())
			.run();
		const kept = await database
			.prepare('SELECT email_off_token AS token FROM follow_settings WHERE account_identifier = ?')
			.bind(digest.accountIdentifier)
			.first<{ token: string }>();
		if (kept?.token) digest.emailOffToken = kept.token;
	}
	return [...digests.values()];
}

/** Records that an account's summary went out (or had nothing left to say). */
export async function recordDigestSent(database: D1Database, digest: Digest, at = new Date()): Promise<void> {
	await database
		.prepare(
			`INSERT INTO follow_settings (account_identifier, last_emailed_update, last_emailed_at, updated_at) VALUES (?1, ?2, ?3, ?3)
			 ON CONFLICT (account_identifier) DO UPDATE SET
				last_emailed_update = MAX(last_emailed_update, excluded.last_emailed_update),
				last_emailed_at = excluded.last_emailed_at`
		)
		.bind(digest.accountIdentifier, digest.upTo, at.toISOString())
		.run();
}
