import { redirect } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { matchSignIn } from '#lib/server/people.ts';
import { safeReturnPath, signInClient, signInSettings } from '#lib/server/sign-in.ts';
import { markSignedIn } from '#lib/server/signed-in-hint.ts';
import { refusalCookie, type RefusalReason } from '../refused/reasons.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Auth0 sends people here after they sign in. The sign-in is matched to a
 * person in the database; anyone who is not on the list is signed out of
 * Auth0 again and told why.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const environment = workerEnvironment();
	const configured = signInSettings(environment);
	if ('missing' in configured || !environment.database) redirect(303, '/sign-in');
	const client = signInClient(configured.settings, url.origin);

	const refuse = async (reason: RefusalReason, endAuth0Session: boolean): Promise<never> => {
		cookies.set(refusalCookie, reason, { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
		if (endAuth0Session) {
			const signOutAddress = await client.logout(
				{ returnTo: new URL('/sign-in/refused', url.origin).href },
				{ cookies }
			);
			redirect(303, signOutAddress.href);
		}
		redirect(303, '/sign-in/refused');
	};

	if (url.searchParams.has('error')) return refuse('cancelled', false);

	let returnTo = '/workspace';
	let claims;
	try {
		const result = await client.completeInteractiveLogin<{ returnTo?: string }>(url, { cookies });
		returnTo = safeReturnPath(result.appState?.returnTo);
		claims = result.user ?? (await client.getUser({ cookies }));
	} catch {
		// An expired or replayed sign-in link, or a sign-in started in another browser.
		return refuse('expired', false);
	}
	if (!claims?.sub) return refuse('expired', false);

	const match = await matchSignIn(
		environment.database,
		{
			subject: claims.sub,
			email: typeof claims.email === 'string' ? claims.email : undefined,
			emailVerified: claims.email_verified === true,
			name: typeof claims.name === 'string' ? claims.name : undefined
		},
		environment.LEAD_AUTHOR_EMAIL
	);
	if (match.outcome !== 'signed-in') return refuse(match.outcome, true);
	markSignedIn(cookies);
	redirect(303, returnTo);
};
