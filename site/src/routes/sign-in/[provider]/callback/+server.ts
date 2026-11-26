import { error, redirect } from '@sveltejs/kit';
import { deviceLabel } from '#lib/device-label.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { accountForIdentity, connect, finishOutsideSignIn, isProvider } from '#lib/server/outside-sign-in.ts';
import { finishSignIn } from '#lib/server/sign-in.ts';
import { refusalCookie, type RefusalReason } from '../../refused/reasons.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Where Google or Microsoft sends the browser back
 * (src/lib/server/outside-sign-in.ts). The answer counts only with the
 * challenge this browser started, which works once. Then either the person
 * is signed in, or, when they started from Sign-in and security, the account
 * is connected to the one they are signed in to.
 */
export const GET: RequestHandler = async ({ params, url, cookies, request, locals }) => {
	const environment = workerEnvironment();
	if (!isProvider(params.provider) || !environment.database) error(404, 'Not found');
	const database = environment.database;

	const refuse = (reason: RefusalReason): never => {
		cookies.set(refusalCookie, reason, { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
		redirect(303, '/sign-in/refused');
	};

	const finished = await finishOutsideSignIn(database, cookies, url, environment, params.provider);
	if (finished.outcome === 'refused') {
		if (finished.reason === 'cancelled') redirect(303, '/sign-in');
		return refuse(finished.reason === 'expired' ? 'outside-expired' : 'outside-failed');
	}

	if (finished.connectTo) {
		// Connecting from Sign-in and security: only to the account still signed in here.
		if (locals.session?.account.identifier !== finished.connectTo) return refuse('outside-expired');
		const connected = await connect(database, finished.connectTo, finished.identity);
		redirect(303, `/account/security?${connected ? 'connected' : 'taken'}=${params.provider}`);
	}

	const match = await accountForIdentity(database, finished.identity);
	if (match.outcome === 'refused') return refuse(match.reason);
	const signedIn = await finishSignIn(database, cookies, match.account, params.provider, finished.returnTo, environment.LEAD_AUTHOR_EMAIL, {
		device: deviceLabel(request.headers.get('user-agent')),
		keep: finished.keep
	});
	if (signedIn.outcome === 'refused') return refuse(signedIn.reason);
	redirect(303, signedIn.destination);
};
