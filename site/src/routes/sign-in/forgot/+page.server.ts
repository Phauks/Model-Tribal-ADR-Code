import { workerEnvironment } from '#lib/server/environment.ts';
import { emailDelivery } from '#lib/server/sign-in-email.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * "Forgot your password?" A code or link sign-in from the last few minutes is
 * enough to choose a new password without the old one
 * (src/lib/server/accounts.ts, provedRecently), so a forgotten password is
 * replaced by signing in with a code and going straight to the password page.
 */
export const load: PageServerLoad = async ({ url }) => {
	return { codesAvailable: emailDelivery(workerEnvironment(), url).kind !== 'none' };
};
