import type { Cookies } from '@sveltejs/kit';
import {
	signedInHintCookie,
	signedInHintLifetimeSeconds,
	signedInHintValue
} from '#lib/signed-in-hint.ts';

/**
 * Sets the masthead's and sidebar's hint (see src/lib/signed-in-hint.ts):
 * after a sign-in, and on each workspace or profile page, with the names of
 * the workspace pages the person's role opens.
 */
export function markSignedIn(cookies: Cookies, workspacePageNames: readonly string[] = []): void {
	cookies.set(signedInHintCookie, signedInHintValue(workspacePageNames), {
		path: '/',
		// Read by the masthead's and sidebar's scripts, so not HTTP-only; it carries nothing private.
		httpOnly: false,
		sameSite: 'lax',
		maxAge: signedInHintLifetimeSeconds
	});
}

/** Clears the masthead's hint after a sign-out or once the session has ended. */
export function clearSignedIn(cookies: Cookies): void {
	if (cookies.get(signedInHintCookie) !== undefined) {
		cookies.delete(signedInHintCookie, { path: '/' });
	}
}
