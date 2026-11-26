import { error, redirect } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { isProvider, providerOrigins, startOutsideSignIn } from '#lib/server/outside-sign-in.ts';
import { safeReturnPath } from '#lib/server/sign-in.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * "Continue with Google" and "Continue with Microsoft": sends the browser to
 * the provider (src/lib/server/outside-sign-in.ts). Answers 404 while the
 * provider is not switched on.
 */
export const GET: RequestHandler = async ({ params, url, cookies }) => {
	const environment = workerEnvironment();
	if (!isProvider(params.provider) || !environment.database) error(404, 'Not found');
	const address = await startOutsideSignIn(environment.database, cookies, url, environment, params.provider, {
		returnTo: safeReturnPath(url.searchParams.get('returnTo')),
		keep: url.searchParams.get('keep') === 'yes'
	});
	if (!address) error(404, 'Not found');
	redirect(303, address, { external: providerOrigins });
};
