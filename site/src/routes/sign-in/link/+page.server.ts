import { deviceLabel } from '#lib/device-label.ts';
import { fail, redirect } from '@sveltejs/kit';
import { adoptWaitingPassword, linkStillWorks, useLink, verifiedAccount } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { finishSignIn, safeReturnPath } from '#lib/server/sign-in.ts';
import { refusalCookie } from '../refused/reasons.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

/**
 * A sign-in link from an email or from the lead author. Opening the link
 * only shows a button; pressing it signs in. Mail systems that open every
 * link to check it for viruses would otherwise use the link up before the
 * person could.
 */
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const { database } = workerEnvironment();
	return {
		token,
		returnTo: safeReturnPath(url.searchParams.get('returnTo')),
		works: database ? await linkStillWorks(database, token) : false
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		const returnTo = safeReturnPath(String(form.get('returnTo') ?? ''));
		const environment = workerEnvironment();
		if (!environment.database) return fail(503, { problem: 'Sign-in is not available right now.' });
		const result = await useLink(environment.database, token);
		if (result.outcome !== 'accepted') {
			cookies.set(refusalCookie, 'expired', { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
			redirect(303, '/sign-in/refused');
		}
		const account = await verifiedAccount(environment.database, result.email);
		// A link from a Create an account email gives the account the password chosen there.
		if (result.newPassword) await adoptWaitingPassword(environment.database, account.identifier, result.newPassword);
		const finished = await finishSignIn(environment.database, cookies, account, 'link', returnTo, environment.LEAD_AUTHOR_EMAIL, {
			device: deviceLabel(request.headers.get('user-agent'))
		});
		if (finished.outcome === 'refused') {
			cookies.set(refusalCookie, finished.reason, { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
			redirect(303, '/sign-in/refused');
		}
		// Someone signing in with a link the lead author made is offered a
		// password, so they need not ask for a link again. Someone who already
		// has one may have forgotten it (that is often why the lead author
		// made the link), and can choose a new one without the old one
		// (src/lib/server/accounts.ts, provedRecently).
		if (result.origin === 'email' || finished.destination.startsWith('/sign-in/two-step')) redirect(303, finished.destination);
		redirect(303, '/profile/password?welcome=1');
	}
};
