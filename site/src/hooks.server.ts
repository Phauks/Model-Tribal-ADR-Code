/**
 * Runs for every page the Worker renders on request: the co-author
 * workspace, sign-in and the request form. Prerendered pages are served as
 * files and never reach this code.
 */
import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { workerEnvironment } from '#lib/server/environment.ts';
import { activePersonBySubject } from '#lib/server/people.ts';
import { signInClient, signInSettings } from '#lib/server/sign-in.ts';

/** Pages that show private information and must never be cached or framed. */
const privatePrefixes = ['/workspace', '/sign-in', '/sign-out', '/requests'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.person = undefined;
	const path = event.url.pathname;

	// While the site is built, links to the workspace are followed but there is
	// no Worker and nobody is signed in.
	if (!building && (path === '/workspace' || path.startsWith('/workspace/'))) {
		const environment = workerEnvironment();
		const configured = signInSettings(environment);
		if ('settings' in configured && environment.database) {
			const client = signInClient(configured.settings, event.url.origin);
			const user = await client.getUser({ cookies: event.cookies }).catch(() => undefined);
			if (user?.sub) {
				event.locals.person = await activePersonBySubject(environment.database, user.sub);
			}
		}
	}

	const response = await resolve(event);

	if (privatePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
		response.headers.set('cache-control', 'no-store');
		response.headers.set('x-frame-options', 'DENY');
		response.headers.set('referrer-policy', 'same-origin');
		response.headers.set('x-content-type-options', 'nosniff');
	}
	return response;
};
