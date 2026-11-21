import { redirect } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { signInClient, signInSettings } from '#lib/server/sign-in.ts';
import { clearSignedIn } from '#lib/server/signed-in-hint.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Ends the session here and at Auth0, then returns to the home page. */
export const POST: RequestHandler = async ({ url, cookies }) => {
	clearSignedIn(cookies);
	const configured = signInSettings(workerEnvironment());
	if ('missing' in configured) redirect(303, '/');
	const client = signInClient(configured.settings, url.origin);
	const signOutAddress = await client.logout({ returnTo: new URL('/', url.origin).href }, { cookies });
	redirect(303, signOutAddress.href);
};
