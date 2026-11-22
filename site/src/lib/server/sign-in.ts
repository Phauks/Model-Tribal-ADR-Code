/**
 * Finishing a sign-in and keeping the session cookie
 * (site/COLLABORATION.md, "How sign-in works"; decision record 0024).
 *
 * The site signs people in itself: a code or link sent by email, a password,
 * or a link the lead author made for someone they invited. Accounts and
 * sessions are in the site's own database (src/lib/server/accounts.ts). No
 * outside sign-in service is involved and no secret has to be set.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { Cookies } from '@sveltejs/kit';
import {
	endAllSessions,
	sessionCookie,
	startSession,
	type Account,
	type SessionMethod
} from './accounts.ts';
import { matchSignIn } from './people.ts';
import { markSignedIn } from './signed-in-hint.ts';

/**
 * A path inside this site to return to after signing in, or the workspace.
 * Only paths that start with a single "/" are accepted, so a crafted link
 * cannot send someone to another site after they sign in.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
	if (!candidate) return '/workspace';
	if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
		return '/workspace';
	}
	try {
		const parsed = new URL(candidate, 'https://site.invalid');
		if (parsed.origin !== 'https://site.invalid') return '/workspace';
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return '/workspace';
	}
}

/** Sets the session cookie: HTTP-only, so page scripts cannot read it; SameSite=Lax; Secure except on localhost. */
export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(sessionCookie, token, { path: '/', httpOnly: true, sameSite: 'lax', expires: expiresAt });
}

export function clearSessionCookie(cookies: Cookies): void {
	if (cookies.get(sessionCookie) !== undefined) cookies.delete(sessionCookie, { path: '/' });
}

export type FinishedSignIn =
	| { outcome: 'signed-in'; destination: string }
	| { outcome: 'refused'; reason: 'removed' };

/**
 * Starts a session for someone who has just proved who they are, and works
 * out where they go next. Someone with workspace access goes where they were
 * heading. Someone without it goes to their contributor profile, where they
 * can register to help (docs/contributor-profiles.md). Someone whose access
 * was removed is not signed in.
 */
export async function finishSignIn(
	database: D1Database,
	cookies: Cookies,
	account: Account,
	method: SessionMethod,
	returnTo: string,
	leadAuthorEmail: string | undefined
): Promise<FinishedSignIn> {
	const match = await matchSignIn(
		database,
		{ subject: account.identifier, email: account.email, emailVerified: true, name: undefined },
		leadAuthorEmail
	);
	if (match.outcome === 'removed' || match.outcome === 'different-account') {
		await endAllSessions(database, account.identifier);
		return { outcome: 'refused', reason: 'removed' };
	}
	const { token, expiresAt } = await startSession(database, account.identifier, method);
	setSessionCookie(cookies, token, expiresAt);
	markSignedIn(cookies);
	if (match.outcome === 'signed-in') return { outcome: 'signed-in', destination: returnTo };
	return { outcome: 'signed-in', destination: returnTo.startsWith('/profile') ? returnTo : '/profile' };
}
