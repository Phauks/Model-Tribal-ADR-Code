/**
 * Finishing a sign-in and keeping the session cookie
 * (site/COLLABORATION.md, "How sign-in works"; decision record 0024).
 *
 * The site signs people in itself: a code or link sent by email, a password,
 * a passkey, or a link the lead author made for someone they invited.
 * Accounts and sessions are in the site's own database
 * (src/lib/server/accounts.ts). Google and Microsoft can also vouch for
 * someone (src/lib/server/outside-sign-in.ts), but the session is still the
 * site's own.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { Cookies } from '@sveltejs/kit';
import {
	endAllSessions,
	oldSessionCookie,
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
		// expected: an address that cannot be read goes to the workspace.
		return '/workspace';
	}
}

/**
 * Sets the session cookie: HTTP-only, so page scripts cannot read it;
 * SameSite=Lax; and Secure, which its `__Host-` name requires. Browsers treat
 * http://localhost as secure, so this works on a copy running on this
 * computer too.
 */
export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(sessionCookie, token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', expires: expiresAt });
}

export function clearSessionCookie(cookies: Cookies): void {
	if (cookies.get(sessionCookie) !== undefined) cookies.delete(sessionCookie, { path: '/', secure: true });
	if (cookies.get(oldSessionCookie) !== undefined) cookies.delete(oldSessionCookie, { path: '/' });
}

export type FinishedSignIn =
	| { outcome: 'signed-in'; destination: string }
	| { outcome: 'refused'; reason: 'removed' };

export interface SignInChoices {
	/** The browser and system, kept with the session for Account, Sign-in and security. */
	device?: string | null;
	/** The "Keep me signed in" box was ticked. */
	keep?: boolean;
}

/** The page for the second step, coming back to a destination afterwards. */
export function secondStepPage(destination: string): string {
	return `/sign-in/two-step?returnTo=${encodeURIComponent(destination)}`;
}

/**
 * Starts a session for someone who has just proved who they are, and works
 * out where they go next. Someone with workspace access goes where they were
 * heading. Someone without it goes there too, unless it was the workspace:
 * then they go to their contributor profile, where they can register to help
 * (docs/contributor-profiles.md). Someone whose access was removed is not
 * signed in.
 *
 * Someone with an authenticator app set up goes to the second step first;
 * until they pass it the session reaches nothing else
 * (src/lib/server/two-step.ts). "Keep me signed in" gives a 30-day session
 * only to someone without workspace access: workspace sessions stay at 12
 * hours.
 */
export async function finishSignIn(
	database: D1Database,
	cookies: Cookies,
	account: Account,
	method: SessionMethod,
	returnTo: string,
	leadAuthorEmail: string | undefined,
	{ device = null, keep = false }: SignInChoices = {}
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
	const hasWorkspace = match.outcome === 'signed-in';
	// A passkey already proved two things, the device and the person, so it
	// counts as the second step as well (NIST SP 800-63B-4, section 2.2).
	const passkey = method === 'passkey';
	const waits = account.hasTwoStep && !passkey;
	const { token, expiresAt } = await startSession(database, account.identifier, method, {
		device,
		secondStep: passkey ? 'done' : waits ? 'waiting' : 'none',
		lasting: keep && !hasWorkspace
	});
	setSessionCookie(cookies, token, expiresAt);
	// The workspace is closed to them, so it sends them to their profile; any
	// other page they came from, such as a nation's page they wanted to
	// follow, takes them back there.
	const toWorkspace = returnTo === '/workspace' || returnTo.startsWith('/workspace/') || returnTo.startsWith('/workspace?');
	const destination = hasWorkspace || !toWorkspace ? returnTo : '/profile';
	if (waits) return { outcome: 'signed-in', destination: secondStepPage(destination) };
	markSignedIn(cookies);
	return { outcome: 'signed-in', destination };
}
