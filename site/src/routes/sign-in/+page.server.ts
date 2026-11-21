import { error, redirect } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { safeReturnPath, signInClient, signInSettings } from '#lib/server/sign-in.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Sends the person to Auth0, or explains that sign-in is not set up yet. */
export const load: PageServerLoad = async ({ url, cookies }) => {
	const configured = signInSettings(workerEnvironment());
	if ('missing' in configured) return { missing: configured.missing };
	const client = signInClient(configured.settings, url.origin);
	let authorizationAddress: URL;
	try {
		authorizationAddress = await client.startInteractiveLogin(
			{ appState: { returnTo: safeReturnPath(url.searchParams.get('returnTo')) } },
			{ cookies }
		);
	} catch (problem) {
		console.error('Sign-in could not start', problem);
		error(502, 'Sign-in is not available right now. Please try again in a few minutes.');
	}
	redirect(303, authorizationAddress.href);
};
