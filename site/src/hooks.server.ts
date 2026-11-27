/**
 * Runs for every page the Worker renders on request: the co-author
 * workspace, contributor profiles, sign-in and the request form.
 * Prerendered pages are served as files and never reach this code.
 */
import { building, dev } from '$app/env';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { sealNewEntries } from '#lib/server/activity-seals.ts';
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import { activityStatement, refusedAction } from '#lib/server/activity-log.ts';
import { endSession, pastWorkspaceLimits, sessionAccount, sessionCookie } from '#lib/server/accounts.ts';
import { activePersonBySubject } from '#lib/server/people.ts';
import { isLiveEditingRequest, openLiveEditing } from '#lib/server/live-editing.ts';
import { restrictedPageAnswer, restrictedPagePrefix } from '#lib/server/restricted-pages.ts';
import { changesSomething, isCrossSite, isGuardedPath } from '#lib/server/request-guard.ts';
import { framePolicy, publicSecurityHeaders } from '#lib/server/security-headers.ts';
import { report } from '#lib/server/report.ts';
import { reportHere } from '#lib/server/report-here.ts';
import { clearSessionCookie } from '#lib/server/sign-in.ts';
import { clearSignedIn, markSignedIn } from '#lib/server/signed-in-hint.ts';
import { needsTwoStep, permissionsOf } from '#lib/permissions.ts';
import { workspacePagesFor } from '#lib/workspace-menu.ts';
import { isUnder, privatePrefixes, signedInPrefixes } from '#lib/private-pages.ts';

/**
 * Files people send (src/lib/server/uploads.ts): starting a file at
 * /uploads/pieces, then its pieces and its finish under /uploads/pieces/. A
 * batch can be hundreds of files and a large file hundreds of pieces, so they
 * have their own limit (uploadLimit, on starting each file) instead of the
 * limit on workspace changes.
 */
const startPath = '/uploads/pieces';
const piecePrefix = '/uploads/pieces/';
/**
 * Where the inbox saves a person's draft a moment after they stop typing
 * (src/routes/workspace/inbox/Composer.svelte). A draft is the writer's own
 * and changes nothing anyone else sees, so saving it does not count against
 * the limit on workspace changes.
 */
const draftSavePath = '/workspace/inbox/drafts/save';

export const handle: Handle = async ({ event, resolve }) => {
	// A prerendered page the Worker sent here because a nation restricts
	// something it may show (src/lib/server/restricted-pages.ts): the page as
	// built, or it goes on under its own address to be drawn again.
	if (event.url.pathname.startsWith(`${restrictedPagePrefix}/`)) {
		const answer = await restrictedPageAnswer(event);
		if (answer) return answer;
	}
	event.locals.person = undefined;
	event.locals.account = undefined;
	event.locals.refused = undefined;
	event.locals.session = undefined;
	event.locals.waitingSession = undefined;
	event.locals.twoStepNeeded = false;
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
	if (!building && isUnder(path, signedInPrefixes)) {
		const environment = workerEnvironment();
		if (environment.database) {
			const session = await sessionAccount(environment.database, event.cookies.get(sessionCookie)).catch(
				(problem) => {
					reportHere(problem, { code: 'sign-in.session-read', place: 'hooks.handle', path, method: event.request.method });
					return undefined;
				}
			);
			if (session?.secondStep === 'waiting') {
				// Half signed in: only the second-step page may use it.
				event.locals.waitingSession = session;
			} else if (session) {
				const person = await activePersonBySubject(environment.database, session.account.identifier);
				if (person && session.lasting && pastWorkspaceLimits(session)) {
					// A "Keep me signed in" session from before the person was given
					// workspace access ends at the workspace's limits.
					await endSession(environment.database, event.cookies.get(sessionCookie));
					clearSessionCookie(event.cookies);
				} else {
					event.locals.session = session;
					event.locals.account = { subject: session.account.identifier, email: session.account.email, name: null };
					if (person && needsTwoStep(person.role) && session.secondStep !== 'done') {
						// The role needs two-step sign-in and it is not set up yet:
						// signed in, but without workspace access until it is.
						event.locals.twoStepNeeded = true;
					} else {
						event.locals.person = person;
					}
				}
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
		if (changing && event.locals.person && environment.workspaceChangeLimit && path !== startPath && !path.startsWith(piecePrefix) && path !== draftSavePath) {
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

	// A live editing connection goes to the essay's room before SvelteKit
	// routes it: its answer is a WebSocket, which takes no added headers
	// (src/lib/server/live-editing.ts).
	if (!building && isLiveEditingRequest(event.request, event.url)) return openLiveEditing(event);

	const response = await resolve(event);

	// Recording a refusal and sealing the log are at least three database
	// calls; they run after the answer has gone, so nobody waits for them.
	// recordAndSeal catches its own problems. Pages that show the log seal
	// anything still unsealed before they read it (administration.ts).
	if (!building && event.locals.person && path.startsWith('/workspace')) {
		afterResponse(recordAndSeal(event.locals.person.identifier, event.locals.refused, changing, event.request.method, path));
	}

	return withSecurityHeaders(response, path);
};

/**
 * Every error thrown while answering that SvelteKit did not expect: a bug,
 * or a service that failed. It is reported once (src/lib/server/report.ts)
 * and the reader's error page shows its reference, so a report from the
 * reader and the log line can be matched (site/ERRORS.md). Errors the site
 * raised itself with error(), such as a page that is not there, are answers
 * rather than problems, and are not reported.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	const context = { code: 'page.unexpected', place: event.route.id ?? event.url.pathname, path: event.url.pathname, method: event.request.method, status: 500 };
	// While the site is built there is no Worker, so a page that fails to prerender is only logged.
	const { reference } = building ? report(error, context) : reportHere(error, context);
	return { reference };
};

/**
 * Adds the security headers every answer carries (src/lib/server/security-headers.ts).
 * Private pages are never cached or framed, and send no address to other sites.
 */
function withSecurityHeaders(given: Response, path: string): Response {
	// A WebSocket answer carries no page and takes no added headers.
	if (given.status === 101) return given;
	let response = given;
	try {
		response.headers.set('x-content-type-options', 'nosniff');
	} catch {
		// expected: a response passed on as it came, such as one fetched from elsewhere, has headers that cannot change; a copy's can.
		response = new Response(given.body, given);
	}
	for (const [name, value] of Object.entries(publicSecurityHeaders)) {
		// SvelteKit's own policy, which limits scripts, stays; this one is added beside it.
		if (name === 'content-security-policy') continue;
		response.headers.set(name, value);
	}
	let frameAncestors = "'self'";
	if (isUnder(path, privatePrefixes)) {
		response.headers.set('cache-control', 'no-store');
		// A message's HTML is shown in a sandboxed frame on the conversation page (src/routes/workspace/inbox/messages).
		const framedHere = /^\/workspace\/inbox\/messages\/[^/]+\/html$/.test(path);
		frameAncestors = framedHere ? "'self'" : "'none'";
		response.headers.set('x-frame-options', framedHere ? 'SAMEORIGIN' : 'DENY');
		response.headers.set('referrer-policy', 'same-origin');
	}
	response.headers.append('content-security-policy', framePolicy(frameAncestors));
	return response;
}

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
			await activityStatement(database, {
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
