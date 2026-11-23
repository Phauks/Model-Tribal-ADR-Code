/**
 * Accounts, sign-in codes and sessions for the site's own sign-in
 * (site/COLLABORATION.md, "How sign-in works"; decision record 0024).
 *
 * An account proves only that someone receives mail at an address. What they
 * may do is decided separately: workspace access by the `people` table
 * (src/lib/server/people.ts), and a contributor profile by
 * `contributor_profiles`.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { newIdentifier, now } from './identifiers.ts';
import { passwordHash, passwordIterations, randomCode, randomToken, sameHash, sha256 } from './sign-in-secrets.ts';

export interface Account {
	identifier: string;
	email: string;
	hasPassword: boolean;
}

/** How long each kind of code or link works. */
export const codeLifetimeMinutes = { email: 15, invitation: 7 * 24 * 60, operator: 60 } as const;
export type CodeOrigin = keyof typeof codeLifetimeMinutes;

/** Wrong codes allowed before a code stops working. Six digits and five tries: 1 in 200,000. */
export const maximumWrongAttempts = 5;

/** Sessions end 12 hours after sign-in, or after 4 hours without use. */
export const sessionHours = 12;
export const inactivityHours = 4;

/**
 * The session cookie. HTTP-only, Secure and SameSite=Lax, and named with the
 * `__Host-` prefix, which browsers accept only from this exact host, over
 * HTTPS, for the whole site (NIST SP 800-63B-4, section 5.1). See
 * src/lib/server/sign-in.ts.
 */
export const sessionCookie = '__Host-session';

/** The cookie's name before Nov. 23, 2026, removed when seen. */
export const oldSessionCookie = 'session';

const minutes = (count: number) => count * 60 * 1000;

/** Normalizes an address as typed: trimmed, NFC. Case is ignored by the database. */
export function cleanEmail(email: string): string {
	return email.normalize('NFC').trim();
}

/** A rough check that text is an email address. Delivery is the real test. */
export function looksLikeEmail(email: string): boolean {
	return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

interface AccountRow {
	identifier: string;
	email: string;
	passwordHash: string | null;
	passwordSalt: string | null;
	passwordIterations: number | null;
	passwordKeyed: number;
}

const accountColumns = `identifier, email, password_hash AS passwordHash, password_salt AS passwordSalt,
	password_iterations AS passwordIterations, password_keyed AS passwordKeyed`;

function toAccount(row: AccountRow): Account {
	return { identifier: row.identifier, email: row.email, hasPassword: Boolean(row.passwordHash) };
}

export async function accountByEmail(database: D1Database, email: string): Promise<Account | undefined> {
	const row = await database
		.prepare(`SELECT ${accountColumns} FROM accounts WHERE email = ?`)
		.bind(cleanEmail(email))
		.first<AccountRow>();
	return row ? toAccount(row) : undefined;
}

/**
 * The account for an address whose owner has just proved they receive mail
 * there, made if this is their first sign-in.
 */
export async function verifiedAccount(database: D1Database, email: string): Promise<Account> {
	const address = cleanEmail(email);
	const time = now();
	await database
		.prepare(
			`INSERT INTO accounts (identifier, email, email_verified_at, created_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT (email) DO UPDATE SET email_verified_at = excluded.email_verified_at`
		)
		.bind(newIdentifier(), address, time, time)
		.run();
	const account = await accountByEmail(database, address);
	if (!account) throw new Error('The account could not be saved.');
	return account;
}

// A fixed salt used only to spend the same time on an address with no
// password as on one with a password, so the time taken does not reveal
// which addresses have accounts.
const unusedSalt = 'no-account-has-this-salt';

/**
 * The Worker's secret password key (PASSWORD_KEY, set in the Cloudflare
 * dashboard as a secret; src/lib/server/sign-in-secrets.ts, passwordHash), or
 * nothing while it is not set. A key shorter than 32 characters is ignored.
 */
export function usablePasswordKey(key: string | undefined): string | undefined {
	const trimmed = key?.trim();
	return trimmed && trimmed.length >= 32 ? trimmed : undefined;
}

async function hashFor(row: AccountRow, password: string, key: string | undefined): Promise<string> {
	return passwordHash(
		password,
		row.passwordSalt!,
		row.passwordIterations ?? passwordIterations,
		row.passwordKeyed ? key : undefined
	);
}

/**
 * The account if the password is right, otherwise nothing. A right password
 * kept with fewer rounds than today, or before the password key was set, is
 * hashed again the current way, so older passwords grow stronger as people
 * sign in. A hash made with the key cannot be checked without it, so the key
 * must not be removed once set.
 */
export async function checkPassword(
	database: D1Database,
	email: string,
	password: string,
	key?: string
): Promise<Account | undefined> {
	const row = await database
		.prepare(`SELECT ${accountColumns} FROM accounts WHERE email = ?`)
		.bind(cleanEmail(email))
		.first<AccountRow>();
	if (!row?.passwordHash || !row.passwordSalt) {
		await passwordHash(password, unusedSalt, passwordIterations, key);
		return undefined;
	}
	if (row.passwordKeyed && !key) {
		console.error('A password was made with the password key, but PASSWORD_KEY is not set.');
		return undefined;
	}
	if (!sameHash(await hashFor(row, password, key), row.passwordHash)) return undefined;
	if ((row.passwordIterations ?? 0) < passwordIterations || (key && !row.passwordKeyed)) {
		await storePassword(database, row.identifier, password, key);
	}
	return toAccount(row);
}

async function storePassword(database: D1Database, accountIdentifier: string, password: string, key: string | undefined) {
	const salt = randomToken(16);
	const hash = await passwordHash(password, salt, passwordIterations, key);
	return database
		.prepare(
			`UPDATE accounts SET password_hash = ?, password_salt = ?, password_iterations = ?, password_keyed = ?
			 WHERE identifier = ?`
		)
		.bind(hash, salt, passwordIterations, key ? 1 : 0, accountIdentifier)
		.run();
}

/**
 * Sets or replaces an account's password, and signs out every other browser
 * signed in to the account, so a changed password locks out anyone who had it.
 * It also clears any count of wrong passwords for the address.
 */
export async function setPassword(
	database: D1Database,
	accountIdentifier: string,
	password: string,
	keepSessionTokenHash: string | undefined,
	key?: string
): Promise<void> {
	const salt = randomToken(16);
	const hash = await passwordHash(password, salt, passwordIterations, key);
	await database.batch([
		database
			.prepare(
				`UPDATE accounts SET password_hash = ?, password_salt = ?, password_iterations = ?, password_keyed = ?,
				 password_changed_at = ? WHERE identifier = ?`
			)
			.bind(hash, salt, passwordIterations, key ? 1 : 0, now(), accountIdentifier),
		database
			.prepare('DELETE FROM password_failures WHERE email = (SELECT email FROM accounts WHERE identifier = ?)')
			.bind(accountIdentifier),
		database
			.prepare('DELETE FROM sessions WHERE account_identifier = ? AND token_hash != ?')
			.bind(accountIdentifier, keepSessionTokenHash ?? '')
	]);
}

/* Wrong passwords ------------------------------------------------------ */

/** Wrong passwords in a row before each pause, and before password sign-in is switched off. */
export const failuresBeforePause = 10;
export const failuresBeforeOff = 100;

/** The first pause, in minutes; each later pause is twice as long, up to a day. */
export const firstPauseMinutes = 15;
const longestPauseMinutes = 24 * 60;

export type PasswordGate =
	| { state: 'open' }
	| { state: 'paused'; until: string }
	| { state: 'off' };

/** Whether password sign-in may be tried for this address now. */
export async function passwordGate(database: D1Database, email: string): Promise<PasswordGate> {
	const row = await database
		.prepare('SELECT consecutive, paused_until AS pausedUntil FROM password_failures WHERE email = ?')
		.bind(cleanEmail(email))
		.first<{ consecutive: number; pausedUntil: string | null }>();
	if (!row) return { state: 'open' };
	if (row.consecutive >= failuresBeforeOff) return { state: 'off' };
	if (row.pausedUntil && row.pausedUntil > now()) return { state: 'paused', until: row.pausedUntil };
	return { state: 'open' };
}

/** Counts a wrong password for an address, and pauses or switches off password sign-in when it is time. */
export async function recordWrongPassword(database: D1Database, email: string): Promise<PasswordGate> {
	const address = cleanEmail(email);
	const time = new Date();
	const row = await database
		.prepare(
			`INSERT INTO password_failures (email, consecutive, last_failed_at) VALUES (?, 1, ?)
			 ON CONFLICT (email) DO UPDATE SET consecutive = consecutive + 1, last_failed_at = excluded.last_failed_at
			 RETURNING consecutive`
		)
		.bind(address, time.toISOString())
		.first<{ consecutive: number }>();
	const count = row?.consecutive ?? 1;
	if (count >= failuresBeforeOff) return { state: 'off' };
	if (count % failuresBeforePause !== 0) return { state: 'open' };
	const pauses = count / failuresBeforePause;
	const pauseMinutes = Math.min(firstPauseMinutes * 2 ** (pauses - 1), longestPauseMinutes);
	const until = new Date(time.getTime() + minutes(pauseMinutes)).toISOString();
	await database.prepare('UPDATE password_failures SET paused_until = ? WHERE email = ?').bind(until, address).run();
	return { state: 'paused', until };
}

/** Clears the count after a right password. */
export async function clearWrongPasswords(database: D1Database, email: string): Promise<void> {
	await database.prepare('DELETE FROM password_failures WHERE email = ?').bind(cleanEmail(email)).run();
}

export type PasswordResult =
	| { outcome: 'accepted'; account: Account }
	| { outcome: 'wrong' }
	| { outcome: 'paused'; until: string }
	| { outcome: 'off' };

function closed(gate: PasswordGate): PasswordResult {
	return gate.state === 'paused' ? { outcome: 'paused', until: gate.until } : { outcome: 'off' };
}

/**
 * Checks a password the way every form that asks for one should: refused
 * without checking while password sign-in is paused or off for the address,
 * and counted when wrong.
 */
export async function tryPassword(
	database: D1Database,
	email: string,
	password: string,
	key?: string
): Promise<PasswordResult> {
	const gate = await passwordGate(database, email);
	if (gate.state !== 'open') return closed(gate);
	const account = await checkPassword(database, email, password, key);
	if (account) {
		await clearWrongPasswords(database, email);
		return { outcome: 'accepted', account };
	}
	const after = await recordWrongPassword(database, email);
	return after.state === 'open' ? { outcome: 'wrong' } : closed(after);
}

/** Removes an account's password. Code sign-in keeps working. */
export async function removePassword(
	database: D1Database,
	accountIdentifier: string,
	keepSessionTokenHash: string | undefined
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE accounts SET password_hash = NULL, password_salt = NULL, password_iterations = NULL,
				 password_keyed = 0, password_changed_at = ? WHERE identifier = ?`
			)
			.bind(now(), accountIdentifier),
		database
			.prepare('DELETE FROM sessions WHERE account_identifier = ? AND token_hash != ?')
			.bind(accountIdentifier, keepSessionTokenHash ?? '')
	]);
}

/* Codes and links ------------------------------------------------------- */

export interface IssuedCode {
	/** Six digits, for codes sent by email; empty for links made by hand. */
	code: string | undefined;
	/** The token for the link /sign-in/link?token=… */
	linkToken: string;
	expiresAt: string;
}

/**
 * Makes a code and a link for an address. Asking again replaces any earlier
 * code of the same kind for that address, so only the newest one works.
 */
export async function issueCode(
	database: D1Database,
	email: string,
	origin: CodeOrigin,
	createdBy: string | null = null
): Promise<IssuedCode> {
	const address = cleanEmail(email);
	const code = origin === 'email' ? randomCode() : undefined;
	const linkToken = randomToken();
	const created = new Date();
	const expiresAt = new Date(created.getTime() + minutes(codeLifetimeMinutes[origin])).toISOString();
	await database.batch([
		database
			.prepare('DELETE FROM sign_in_codes WHERE (email = ? AND origin = ?) OR expires_at < ?')
			.bind(address, origin, created.toISOString()),
		database
			.prepare(
				`INSERT INTO sign_in_codes (identifier, email, code_hash, link_hash, origin, created_by, created_at, expires_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				newIdentifier(),
				address,
				code ? await sha256(`${address.toLocaleLowerCase('en-US')}:${code}`) : null,
				await sha256(linkToken),
				origin,
				createdBy,
				created.toISOString(),
				expiresAt
			)
	]);
	return { code, linkToken, expiresAt };
}

export type CodeResult = { outcome: 'accepted'; email: string } | { outcome: 'wrong' | 'expired' | 'too-many' };

/** Checks a six-digit code typed for an address. A right code works once. */
export async function useCode(database: D1Database, email: string, code: string): Promise<CodeResult> {
	const address = cleanEmail(email);
	const row = await database
		.prepare(
			`SELECT identifier, code_hash AS codeHash, wrong_attempts AS wrongAttempts, expires_at AS expiresAt
			 FROM sign_in_codes WHERE email = ? AND origin = 'email' ORDER BY created_at DESC LIMIT 1`
		)
		.bind(address)
		.first<{ identifier: string; codeHash: string; wrongAttempts: number; expiresAt: string }>();
	if (!row || row.expiresAt < now()) return { outcome: 'expired' };
	if (row.wrongAttempts >= maximumWrongAttempts) return { outcome: 'too-many' };
	const typed = code.replace(/\s+/g, '');
	const hash = await sha256(`${address.toLocaleLowerCase('en-US')}:${typed}`);
	if (!sameHash(hash, row.codeHash)) {
		await database
			.prepare('UPDATE sign_in_codes SET wrong_attempts = wrong_attempts + 1 WHERE identifier = ?')
			.bind(row.identifier)
			.run();
		return { outcome: row.wrongAttempts + 1 >= maximumWrongAttempts ? 'too-many' : 'wrong' };
	}
	// Deleting the row is what makes the code single-use: if two requests race,
	// only the one whose delete removes the row signs in.
	const { meta } = await database.prepare('DELETE FROM sign_in_codes WHERE identifier = ?').bind(row.identifier).run();
	if (meta.changes !== 1) return { outcome: 'expired' };
	return { outcome: 'accepted', email: address };
}

export type LinkResult = { outcome: 'accepted'; email: string; origin: CodeOrigin } | { outcome: 'expired' };

/** The address a sign-in link was made for, if it still works. A link works once. */
export async function useLink(database: D1Database, token: string): Promise<LinkResult> {
	if (!token || token.length > 100) return { outcome: 'expired' };
	const row = await database
		.prepare(
			`SELECT identifier, email, origin, expires_at AS expiresAt FROM sign_in_codes WHERE link_hash = ?`
		)
		.bind(await sha256(token))
		.first<{ identifier: string; email: string; origin: CodeOrigin; expiresAt: string }>();
	if (!row || row.expiresAt < now()) return { outcome: 'expired' };
	const { meta } = await database.prepare('DELETE FROM sign_in_codes WHERE identifier = ?').bind(row.identifier).run();
	if (meta.changes !== 1) return { outcome: 'expired' };
	return { outcome: 'accepted', email: row.email, origin: row.origin };
}

/** Whether a link token still works, without using it up (for the confirmation page). */
export async function linkStillWorks(database: D1Database, token: string): Promise<boolean> {
	if (!token || token.length > 100) return false;
	const row = await database
		.prepare('SELECT expires_at AS expiresAt FROM sign_in_codes WHERE link_hash = ?')
		.bind(await sha256(token))
		.first<{ expiresAt: string }>();
	return Boolean(row && row.expiresAt >= now());
}

/* Sessions ------------------------------------------------------------- */

export type SessionMethod = 'code' | 'link' | 'password';

/** Starts a session and returns the token for the cookie. */
export async function startSession(
	database: D1Database,
	accountIdentifier: string,
	method: SessionMethod,
	/** The browser and system, such as "Firefox on Windows" (src/lib/device-label.ts). */
	device: string | null = null
): Promise<{ token: string; expiresAt: Date }> {
	const token = randomToken();
	const started = new Date();
	const expiresAt = new Date(started.getTime() + sessionHours * 60 * 60 * 1000);
	await database.batch([
		// Ended sessions are removed here, so the table does not grow.
		database.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(started.toISOString()),
		database
			.prepare(
				`INSERT INTO sessions (token_hash, account_identifier, created_at, last_seen_at, expires_at, method, device)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(await sha256(token), accountIdentifier, started.toISOString(), started.toISOString(), expiresAt.toISOString(), method, device),
		database
			.prepare('UPDATE accounts SET last_signed_in_at = ? WHERE identifier = ?')
			.bind(started.toISOString(), accountIdentifier)
	]);
	return { token, expiresAt };
}

export interface ActiveSession {
	account: Account;
	tokenHash: string;
	expiresAt: string;
	/** How the session started. */
	method: SessionMethod;
	/** When the session started. */
	startedAt: string;
}

/** How long after a code or link sign-in the person may choose a new password without the old one. */
export const recentProofMinutes = 10;

/**
 * Whether this session began with a code or a link from the last few minutes.
 * That proves the person receives mail at the address (or was sent a link by
 * the lead author) just now, which is enough to replace a forgotten password.
 */
export function provedRecently(session: ActiveSession | undefined, time = Date.now()): boolean {
	if (!session || (session.method !== 'code' && session.method !== 'link')) return false;
	return time - Date.parse(session.startedAt) <= minutes(recentProofMinutes);
}

/**
 * The account signed in with this session token, if the session has not
 * ended. Use keeps it alive up to its 12-hour limit.
 */
export async function sessionAccount(database: D1Database, token: string | undefined): Promise<ActiveSession | undefined> {
	if (!token || token.length > 100) return undefined;
	const tokenHash = await sha256(token);
	const row = await database
		.prepare(
			`SELECT accounts.identifier, accounts.email, accounts.password_hash AS passwordHash,
				sessions.last_seen_at AS lastSeenAt, sessions.expires_at AS expiresAt,
				sessions.method, sessions.created_at AS startedAt
			 FROM sessions JOIN accounts ON accounts.identifier = sessions.account_identifier
			 WHERE sessions.token_hash = ?`
		)
		.bind(tokenHash)
		.first<{
			identifier: string;
			email: string;
			passwordHash: string | null;
			lastSeenAt: string;
			expiresAt: string;
			method: SessionMethod;
			startedAt: string;
		}>();
	if (!row) return undefined;
	const time = Date.now();
	const idleSince = Date.parse(row.lastSeenAt);
	if (Date.parse(row.expiresAt) <= time || time - idleSince > inactivityHours * 60 * 60 * 1000) {
		await database.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
		return undefined;
	}
	// Recording every page view would mean a write per request; once every
	// five minutes is enough to measure four hours without use.
	if (time - idleSince > minutes(5)) {
		await database
			.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
			.bind(new Date(time).toISOString(), tokenHash)
			.run();
	}
	return {
		account: { identifier: row.identifier, email: row.email, hasPassword: Boolean(row.passwordHash) },
		tokenHash,
		expiresAt: row.expiresAt,
		method: row.method,
		startedAt: row.startedAt
	};
}

/** Ends one session. */
export async function endSession(database: D1Database, token: string | undefined): Promise<void> {
	if (!token || token.length > 100) return;
	await database.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

/** Ends every session of an account, for example when the person's access is removed. */
export async function endAllSessions(database: D1Database, accountIdentifier: string): Promise<void> {
	await database.prepare('DELETE FROM sessions WHERE account_identifier = ?').bind(accountIdentifier).run();
}
