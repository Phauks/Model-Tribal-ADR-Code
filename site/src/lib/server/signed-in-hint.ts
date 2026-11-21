import type { Cookies } from '@sveltejs/kit';
import { signedInHintCookie, signedInHintLifetimeSeconds } from '#lib/signed-in-hint.ts';

/** Sets the masthead's hint after a sign-in (see src/lib/signed-in-hint.ts). */
export function markSignedIn(cookies: Cookies): void {
	cookies.set(signedInHintCookie, '1', {
		path: '/',
		// Read by the masthead's script, so not HTTP-only; it carries nothing private.
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
