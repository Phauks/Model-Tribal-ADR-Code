/**
 * Short-lived challenges that wait for the browser's answer (decision record
 * 0062): the random challenge a passkey signs, and the state, nonce and PKCE
 * verifier of a Google or Microsoft sign-in. The browser keeps a random
 * handle in an HTTP-only cookie; the database keeps the details under the
 * handle's hash (migrations/20261126T2310_add_passkeys_and_outside_sign_ins.sql).
 * Each challenge works once, in the browser that started it, for ten minutes.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { Cookies } from '@sveltejs/kit';
import { randomToken, sha256 } from './sign-in-secrets.ts';

export type ChallengePurpose = 'passkey-sign-in' | 'passkey-add' | 'google' | 'microsoft';

export const challengeMinutes = 10;

/** One cookie for each purpose, so starting one kind does not cancel another. */
export function challengeCookie(purpose: ChallengePurpose): string {
	return `__Host-challenge-${purpose}`;
}

export interface StartedChallenge<Details> {
	details: Details;
	accountIdentifier: string | null;
}

/** Keeps a challenge's details and gives the browser its handle. */
export async function startChallenge<Details>(
	database: D1Database,
	cookies: Cookies,
	purpose: ChallengePurpose,
	details: Details,
	accountIdentifier: string | null = null
): Promise<void> {
	const handle = randomToken();
	const created = new Date();
	const expires = new Date(created.getTime() + challengeMinutes * 60 * 1000);
	await database.batch([
		// Old challenges are removed here, so the table does not grow.
		database.prepare('DELETE FROM sign_in_challenges WHERE expires_at < ?').bind(created.toISOString()),
		database
			.prepare(
				`INSERT INTO sign_in_challenges (handle_hash, purpose, details, account_identifier, created_at, expires_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(await sha256(handle), purpose, JSON.stringify(details), accountIdentifier, created.toISOString(), expires.toISOString())
	]);
	cookies.set(challengeCookie(purpose), handle, {
		path: '/',
		httpOnly: true,
		secure: true,
		// Lax, so the cookie comes back when Google or Microsoft sends the browser back here.
		sameSite: 'lax',
		maxAge: challengeMinutes * 60
	});
}

/**
 * The challenge this browser started for a purpose, used up by reading it.
 * Nothing when there is none, it has run out, or it was used already.
 */
export async function takeChallenge<Details>(
	database: D1Database,
	cookies: Cookies,
	purpose: ChallengePurpose
): Promise<StartedChallenge<Details> | undefined> {
	const handle = cookies.get(challengeCookie(purpose));
	if (handle !== undefined) cookies.delete(challengeCookie(purpose), { path: '/', secure: true });
	if (!handle || handle.length > 100) return undefined;
	const row = await database
		.prepare(
			`DELETE FROM sign_in_challenges WHERE handle_hash = ? AND purpose = ?
			 RETURNING details, account_identifier AS accountIdentifier, expires_at AS expiresAt`
		)
		.bind(await sha256(handle), purpose)
		.first<{ details: string; accountIdentifier: string | null; expiresAt: string }>();
	if (!row || row.expiresAt < new Date().toISOString()) return undefined;
	return { details: JSON.parse(row.details) as Details, accountIdentifier: row.accountIdentifier };
}
