/**
 * Two-step sign-in: an authenticator app and backup codes
 * (site/COLLABORATION.md, "Two-step sign-in").
 *
 * The authenticator app makes a six-digit code every 30 seconds from a secret
 * the site and the app share, using the time-based one-time password method
 * of RFC 6238 with SHA-1, six digits and 30-second steps, the settings every
 * common authenticator app reads from a QR code. A code is accepted for the
 * step before and after the current one, to allow for a clock that is a
 * little off, and never twice (NIST SP 800-63B-4, section 3.1.4.1).
 *
 * The shared secret is kept encrypted with AES-GCM under a key derived from
 * the Worker's PASSWORD_KEY secret, when that is set (NIST SP 800-63B-4,
 * section 3.1.4.1, asks that these secrets be protected; it is kept, not
 * hashed, because the site has to make the same codes as the app). Until the
 * key is set the secret is kept as it is, and it is encrypted the next time
 * it is used after the key is set.
 *
 * Backup codes are ten random codes of ten characters (50 bits each), shown
 * once and kept only as SHA-256 hashes. Each works once.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { now } from './identifiers.ts';
import { sha256 } from './sign-in-secrets.ts';

/* Base32 (RFC 4648), which authenticator apps use for the secret -------- */

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let text = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			text += base32Alphabet[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) text += base32Alphabet[(value << (5 - bits)) & 31];
	return text;
}

export function fromBase32(text: string): Uint8Array<ArrayBuffer> {
	const clean = text.toUpperCase().replace(/[\s=-]/g, '');
	const bytes: number[] = [];
	let bits = 0;
	let value = 0;
	for (const character of clean) {
		const index = base32Alphabet.indexOf(character);
		if (index < 0) throw new Error('Not base32');
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return new Uint8Array(bytes);
}

/* Authenticator codes --------------------------------------------------- */

/** Seconds in each step, and the digits in each code. */
export const stepSeconds = 30;
export const authenticatorDigits = 6;

/** A new shared secret: 20 random bytes (160 bits), as RFC 4226 recommends, in base32. */
export function newAuthenticatorSecret(): string {
	return base32(crypto.getRandomValues(new Uint8Array(20)));
}

/** The step number for a time: whole 30-second steps since 1970. */
export function stepAt(time: number): number {
	return Math.floor(time / 1000 / stepSeconds);
}

/** The code an authenticator app shows for a secret during a step (RFC 4226, section 5.3). */
export async function authenticatorCode(secret: string, step: number): Promise<string> {
	const key = await crypto.subtle.importKey('raw', fromBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
	const counter = new Uint8Array(8);
	new DataView(counter.buffer).setBigUint64(0, BigInt(step));
	const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
	const offset = digest[digest.length - 1] & 15;
	const number =
		((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
	return String(number % 10 ** authenticatorDigits).padStart(authenticatorDigits, '0');
}

/**
 * The step a typed code matches, if it is right for this step or the one
 * before or after, and later than the last step used.
 */
export async function matchingStep(
	secret: string,
	typed: string,
	lastStep: number | null,
	time = Date.now()
): Promise<number | undefined> {
	if (!/^\d{6}$/.test(typed)) return undefined;
	const current = stepAt(time);
	let found: number | undefined;
	// Every step is checked, so the time taken does not show which one matched.
	for (const step of [current - 1, current, current + 1]) {
		const code = await authenticatorCode(secret, step);
		if (sameText(code, typed) && (lastStep === null || step > lastStep) && found === undefined) found = step;
	}
	return found;
}

function sameText(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return difference === 0;
}

/** The name the app shows for the account. */
export const issuerName = 'Model Tribal ADR Code';

/** The address a QR code holds, in the "otpauth" form authenticator apps read. */
export function authenticatorLink(secret: string, email: string): string {
	const label = encodeURIComponent(`${issuerName}:${email}`);
	const parameters = new URLSearchParams({
		secret,
		issuer: issuerName,
		algorithm: 'SHA1',
		digits: String(authenticatorDigits),
		period: String(stepSeconds)
	});
	return `otpauth://totp/${label}?${parameters.toString().replace(/\+/g, '%20')}`;
}

/** The secret in groups of four, for typing into an app by hand. */
export function groupedSecret(secret: string): string {
	return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

/* Keeping the secret ---------------------------------------------------- */

const sealedPrefix = 'sealed:';
const plainPrefix = 'plain:';

async function sealingKey(passwordKey: string): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passwordKey), 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: new Uint8Array(0),
			info: new TextEncoder().encode('model-tribal-adr-code authenticator secrets')
		},
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
}

/** The secret as it is stored: encrypted when there is a key, as it is otherwise. */
export async function sealSecret(secret: string, passwordKey: string | undefined): Promise<string> {
	if (!passwordKey) return `${plainPrefix}${secret}`;
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, await sealingKey(passwordKey), new TextEncoder().encode(secret))
	);
	const joined = new Uint8Array(nonce.length + sealed.length);
	joined.set(nonce);
	joined.set(sealed, nonce.length);
	return `${sealedPrefix}${toBase64(joined)}`;
}

/** Whether a stored secret is kept without encryption. */
export function isPlain(stored: string): boolean {
	return stored.startsWith(plainPrefix);
}

/** The secret from its stored form, or nothing if it cannot be opened (for example, the key was removed). */
export async function openSecret(stored: string, passwordKey: string | undefined): Promise<string | undefined> {
	if (stored.startsWith(plainPrefix)) return stored.slice(plainPrefix.length);
	if (!stored.startsWith(sealedPrefix)) return undefined;
	if (!passwordKey) {
		console.error('An authenticator secret is encrypted but PASSWORD_KEY is not set, so it cannot be checked.');
		return undefined;
	}
	try {
		const joined = fromBase64(stored.slice(sealedPrefix.length));
		const opened = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: joined.slice(0, 12) },
			await sealingKey(passwordKey),
			joined.slice(12)
		);
		return new TextDecoder().decode(opened);
	} catch (problem) {
		console.error('An authenticator secret could not be opened; was PASSWORD_KEY changed?', problem);
		return undefined;
	}
}

/* Backup codes ---------------------------------------------------------- */

/** Crockford's base32: no I, L, O or U, so codes are hard to misread. */
const backupAlphabet = '0123456789abcdefghjkmnpqrstvwxyz';
export const backupCodeCount = 10;

/** Ten new backup codes, written as two groups of five, such as "7k2mq-x9d4r". */
export function newBackupCodes(): string[] {
	return Array.from({ length: backupCodeCount }, () => {
		const bytes = crypto.getRandomValues(new Uint8Array(10));
		const characters = Array.from(bytes, (byte) => backupAlphabet[byte & 31]).join('');
		return `${characters.slice(0, 5)}-${characters.slice(5)}`;
	});
}

/** A typed backup code as it is hashed: lower case, no spaces or dashes, and misread letters mended. */
export function cleanBackupCode(typed: string): string {
	return typed
		.toLowerCase()
		.replace(/[\s-]/g, '')
		.replace(/o/g, '0')
		.replace(/[il]/g, '1');
}

function looksLikeBackupCode(clean: string): boolean {
	return clean.length === 10 && [...clean].every((character) => backupAlphabet.includes(character));
}

/* Accounts -------------------------------------------------------------- */

export interface TwoStepState {
	/** Whether an authenticator app is set up. */
	on: boolean;
	addedAt: string | null;
	backupCodesLeft: number;
}

export async function twoStepState(database: D1Database, accountIdentifier: string): Promise<TwoStepState> {
	const row = await database
		.prepare(
			`SELECT authenticator_secret AS secret, authenticator_added_at AS addedAt,
				(SELECT count(*) FROM backup_codes WHERE account_identifier = accounts.identifier AND used_at IS NULL) AS left
			 FROM accounts WHERE identifier = ?`
		)
		.bind(accountIdentifier)
		.first<{ secret: string | null; addedAt: string | null; left: number }>();
	return { on: Boolean(row?.secret), addedAt: row?.addedAt ?? null, backupCodesLeft: row?.left ?? 0 };
}

/** Starts setting up an app: a new secret, kept until a code from the app confirms it. */
export async function startAuthenticatorSetUp(
	database: D1Database,
	accountIdentifier: string,
	passwordKey: string | undefined
): Promise<string> {
	const secret = newAuthenticatorSecret();
	await database
		.prepare('UPDATE accounts SET authenticator_new_secret = ? WHERE identifier = ?')
		.bind(await sealSecret(secret, passwordKey), accountIdentifier)
		.run();
	return secret;
}

/** The secret being set up, if setting up has started. */
export async function newAuthenticatorSecretFor(
	database: D1Database,
	accountIdentifier: string,
	passwordKey: string | undefined
): Promise<string | undefined> {
	const row = await database
		.prepare('SELECT authenticator_new_secret AS stored FROM accounts WHERE identifier = ?')
		.bind(accountIdentifier)
		.first<{ stored: string | null }>();
	return row?.stored ? openSecret(row.stored, passwordKey) : undefined;
}

function backupCodeStatements(database: D1Database, accountIdentifier: string, hashes: string[]) {
	return [
		database.prepare('DELETE FROM backup_codes WHERE account_identifier = ?').bind(accountIdentifier),
		...hashes.map((hash) =>
			database
				.prepare('INSERT INTO backup_codes (account_identifier, code_hash, created_at) VALUES (?, ?, ?)')
				.bind(accountIdentifier, hash, now())
		)
	];
}

export type SetUpResult = { outcome: 'done'; backupCodes: string[] } | { outcome: 'wrong' } | { outcome: 'not-started' };

/**
 * Finishes setting up an app once the person types a code it shows. The new
 * app replaces any earlier one, new backup codes replace the old ones, this
 * browser counts as having passed the second step, and every other browser
 * is signed out.
 */
export async function finishAuthenticatorSetUp(
	database: D1Database,
	accountIdentifier: string,
	typed: string,
	passwordKey: string | undefined,
	keepSessionHash: string | undefined,
	time = Date.now()
): Promise<SetUpResult> {
	const secret = await newAuthenticatorSecretFor(database, accountIdentifier, passwordKey);
	if (!secret) return { outcome: 'not-started' };
	const step = await matchingStep(secret, typed.replace(/\s+/g, ''), null, time);
	if (step === undefined) return { outcome: 'wrong' };
	const backupCodes = newBackupCodes();
	const hashes = await Promise.all(backupCodes.map((code) => sha256(cleanBackupCode(code))));
	await database.batch([
		database
			.prepare(
				`UPDATE accounts SET authenticator_secret = ?, authenticator_new_secret = NULL,
					authenticator_added_at = ?, authenticator_last_step = ? WHERE identifier = ?`
			)
			.bind(await sealSecret(secret, passwordKey), new Date(time).toISOString(), step, accountIdentifier),
		...backupCodeStatements(database, accountIdentifier, hashes),
		database
			.prepare("UPDATE sessions SET second_step = 'done' WHERE account_identifier = ? AND token_hash = ?")
			.bind(accountIdentifier, keepSessionHash ?? ''),
		database
			.prepare('DELETE FROM sessions WHERE account_identifier = ? AND token_hash != ?')
			.bind(accountIdentifier, keepSessionHash ?? '')
	]);
	return { outcome: 'done', backupCodes };
}

/** New backup codes in place of the old ones, which stop working. */
export async function replaceBackupCodes(database: D1Database, accountIdentifier: string): Promise<string[]> {
	const backupCodes = newBackupCodes();
	const hashes = await Promise.all(backupCodes.map((code) => sha256(cleanBackupCode(code))));
	await database.batch(backupCodeStatements(database, accountIdentifier, hashes));
	return backupCodes;
}

/** Turns two-step sign-in off: the app's secret and the backup codes are deleted. */
export async function turnOffTwoStep(database: D1Database, accountIdentifier: string): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE accounts SET authenticator_secret = NULL, authenticator_new_secret = NULL,
					authenticator_added_at = NULL, authenticator_last_step = NULL WHERE identifier = ?`
			)
			.bind(accountIdentifier),
		database.prepare('DELETE FROM backup_codes WHERE account_identifier = ?').bind(accountIdentifier),
		database
			.prepare("UPDATE sessions SET second_step = 'none' WHERE account_identifier = ? AND second_step = 'done'")
			.bind(accountIdentifier)
	]);
}

/* The second step at sign-in ------------------------------------------- */

/** Wrong codes allowed on one sign-in before it has to start again. */
export const wrongSecondStepsAllowed = 5;

export type SecondStepResult =
	| { outcome: 'accepted'; usedBackupCode: boolean; backupCodesLeft: number }
	| { outcome: 'wrong' }
	| { outcome: 'too-many' }
	| { outcome: 'unavailable' };

/**
 * Checks the code typed at the second step: a code from the app, or a backup
 * code. A right one completes the sign-in; after five wrong ones the
 * session is ended and the person starts again.
 */
export async function trySecondStep(
	database: D1Database,
	accountIdentifier: string,
	sessionHash: string,
	typed: string,
	passwordKey: string | undefined,
	time = Date.now()
): Promise<SecondStepResult> {
	const row = await database
		.prepare('SELECT authenticator_secret AS stored, authenticator_last_step AS lastStep FROM accounts WHERE identifier = ?')
		.bind(accountIdentifier)
		.first<{ stored: string | null; lastStep: number | null }>();
	if (!row?.stored) return { outcome: 'unavailable' };

	const digits = typed.replace(/\s+/g, '');
	let accepted = false;
	let usedBackupCode = false;
	if (/^\d{6}$/.test(digits)) {
		const secret = await openSecret(row.stored, passwordKey);
		const step = secret ? await matchingStep(secret, digits, row.lastStep, time) : undefined;
		if (secret && step !== undefined) {
			// The UPDATE only succeeds if no other sign-in used this step first.
			const { meta } = await database
				.prepare(
					`UPDATE accounts SET authenticator_last_step = ?
					 WHERE identifier = ? AND (authenticator_last_step IS NULL OR authenticator_last_step < ?)`
				)
				.bind(step, accountIdentifier, step)
				.run();
			accepted = meta.changes === 1;
			// Encrypt a secret kept as it is, now that it can be.
			if (accepted && passwordKey && isPlain(row.stored)) {
				await database
					.prepare('UPDATE accounts SET authenticator_secret = ? WHERE identifier = ?')
					.bind(await sealSecret(secret, passwordKey), accountIdentifier)
					.run();
			}
		}
	} else {
		const clean = cleanBackupCode(typed);
		if (looksLikeBackupCode(clean)) {
			const { meta } = await database
				.prepare(
					'UPDATE backup_codes SET used_at = ? WHERE account_identifier = ? AND code_hash = ? AND used_at IS NULL'
				)
				.bind(new Date(time).toISOString(), accountIdentifier, await sha256(clean))
				.run();
			accepted = meta.changes === 1;
			usedBackupCode = accepted;
		}
	}

	if (accepted) {
		await database
			.prepare("UPDATE sessions SET second_step = 'done', wrong_second_steps = 0 WHERE token_hash = ?")
			.bind(sessionHash)
			.run();
		const { backupCodesLeft } = await twoStepState(database, accountIdentifier);
		return { outcome: 'accepted', usedBackupCode, backupCodesLeft };
	}

	const counted = await database
		.prepare('UPDATE sessions SET wrong_second_steps = wrong_second_steps + 1 WHERE token_hash = ? RETURNING wrong_second_steps AS wrong')
		.bind(sessionHash)
		.first<{ wrong: number }>();
	if (!counted || counted.wrong >= wrongSecondStepsAllowed) {
		await database.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(sessionHash).run();
		return { outcome: 'too-many' };
	}
	return { outcome: 'wrong' };
}
