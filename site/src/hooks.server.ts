/**
 * Runs for every page the Worker renders on request: the co-author
 * workspace, contributor profiles, sign-in and the request form.
 * Prerendered pages are served as files and never reach this code.
 */
import { building, dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { sealNewEntries } from '#lib/server/activity-seals.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { eventStatement, refusedAction } from '#lib/server/events.ts';
import { sessionAccount, sessionCookie } from '#lib/server/accounts.ts';
import { activePersonBySubject } from '#lib/server/people.ts';
import { changesSomething, isCrossSite, isGuardedPath } from '#lib/server/request-guard.ts';
import { clearSessionCookie } from '#lib/server/sign-in.ts';
import { clearSignedIn, markSignedIn } from '#lib/server/signed-in-hint.ts';
import { permissionsOf } from '#lib/permissions.ts';
import { workspacePagesFor } from '#lib/workspace-menu.ts';

/** Pages that show private information and must never be cached or framed. */
const privatePrefixes = ['/workspace', '/profile', '/sign-in', '/sign-out', '/requests', '/uploads'];

/** Pages that need to know who is signed in. */
const signedInPrefixes = ['/workspace', '/profile', '/sign-in', '/uploads', '/files'];

/**
 * Pieces of files people send (src/lib/server/uploads.ts). A large file is
 * hundreds of pieces, so they have their own limit (uploadLimit, on starting
 * each file) instead of the limit on workspace changes.
 */
const piecePrefix = '/uploads/pieces/';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.person = undefined;
	event.locals.account = undefined;
	event.locals.refused = undefined;
	event.locals.session = undefined;
	const path = event.url.pathname;
	const changing = changesSomething(event.request.method);

	// A change sent from another site's page is refused before anything else
	// runs (src/lib/server/request-guard.ts). SvelteKit skips its own check
	// in development, so this does too.
	if (!building && !dev && changing && isGuardedPath(path) && isCrossSite(event.request, event.url.origin)) {
		return new Response('Changes can only be made from this site’s own pages.', {
			status: 403,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
		});
	}

	// While the site is built, links to the workspace are followed but there is
	// no Worker and nobody is signed in.
	if (!building && signedInPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
		const environment = workerEnvironment();
		if (environment.database) {
			const session = await sessionAccount(environment.database, event.cookies.get(sessionCookie)).catch(
				(problem) => {
					console.error('Could not read the session', problem);
					return undefined;
				}
			);
			if (session) {
				event.locals.session = session;
				event.locals.account = { subject: session.account.identifier, email: session.account.email, name: null };
				event.locals.person = await activePersonBySubject(environment.database, session.account.identifier);
			} else {
				clearSessionCookie(event.cookies);
			}
		}
		// Keep the masthead's profile button and the sidebar's workspace pages in step with the session.
		if (event.locals.person) {
			const pages = workspacePagesFor(permissionsOf(event.locals.person.role));
			markSignedIn(event.cookies, pages.map((item) => item.name));
		} else if (event.locals.account) markSignedIn(event.cookies);
		else clearSignedIn(event.cookies);

		// Each person may make a limited number of changes a minute, so a
		// stolen session or a runaway script cannot rewrite much before
		// someone notices (wrangler.jsonc, workspaceChangeLimit).
		if (changing && event.locals.person && environment.workspaceChangeLimit && !path.startsWith(piecePrefix)) {
			const { success } = await environment.workspaceChangeLimit.limit({
				key: event.locals.person.identifier
			});
			if (!success) {
				return new Response('Too many changes in a minute. Wait a minute and try again.', {
					status: 429,
					headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '60', 'cache-control': 'no-store' }
				});
			}
		}
	}

	const response = await resolve(event);

	if (!building && event.locals.person && path.startsWith('/workspace')) {
		await recordAndSeal(event.locals.person.identifier, event.locals.refused, changing, event.request.method, path);
	}

	if (privatePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
		response.headers.set('cache-control', 'no-store');
		response.headers.set('x-frame-options', 'DENY');
		response.headers.set('referrer-policy', 'same-origin');
		response.headers.set('x-content-type-options', 'nosniff');
	}
	return response;
};

/**
 * After a workspace request: records a refused attempt in the activity log,
 * and seals any new entries (src/lib/server/activity-seals.ts). A failure
 * here is logged but never changes the response the person sees.
 */
async function recordAndSeal(
	personIdentifier: string,
	refused: string | undefined,
	changing: boolean,
	method: string,
	path: string
): Promise<void> {
	const { database, workspaceChangeLimit: limiter } = workerEnvironment();
	if (!database || (!refused && !changing)) return;
	try {
		// A refused page view is recorded too, as long as the person is within
		// their limit, so probing for pages shows up without flooding the log.
		const withinLimit =
			changing ||
			!refused ||
			!limiter ||
			(await limiter.limit({ key: personIdentifier })).success;
		if (refused && withinLimit) {
			await eventStatement(database, {
				personIdentifier,
				action: refusedAction,
				targetKind: 'person',
				targetIdentifier: personIdentifier,
				note: `${method} ${path}: ${refused}`.slice(0, 500)
			}).run();
		}
		await sealNewEntries(database);
	} catch (problem) {
		console.error('Could not record or seal the activity log', problem);
	}
}
