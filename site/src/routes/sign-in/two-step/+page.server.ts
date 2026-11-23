import { fail, redirect } from '@sveltejs/kit';
import { endSession, sessionCookie, usablePasswordKey } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { clearSessionCookie, safeReturnPath } from '#lib/server/sign-in.ts';
import { markSignedIn } from '#lib/server/signed-in-hint.ts';
import { trySecondStep } from '#lib/server/two-step.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

/**
 * The second step of sign-in, "Confirm it is you": a code from the
 * authenticator app, or a backup code (src/lib/server/two-step.ts). Only a
 * session that has passed the first step and waits for this one may use it.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnPath(url.searchParams.get('returnTo'));
	if (!locals.waitingSession) redirect(303, locals.account ? returnTo : `/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
	return { returnTo, email: locals.waitingSession.account.email };
};

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
}

export const actions: Actions = {
	confirm: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const returnTo = safeReturnPath(text(form, 'returnTo'));
		const session = locals.waitingSession;
		if (!session) redirect(303, `/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
		const environment = workerEnvironment();
		const again = (problem: string, status = 400) => fail(status, { problem, field: 'code' as const });
		if (!environment.database) return again('Sign-in is not available right now.', 503);
		const typed = text(form, 'code').trim();
		if (typed === '') return again('Enter the six-digit code from your authenticator app, or a backup code.');
		const limit = await environment.signInLimit?.limit({ key: `two-step:${session.account.identifier}` });
		if (limit && !limit.success) return again('Too many tries in a minute. Wait a minute and try again.', 429);

		const result = await trySecondStep(
			environment.database,
			session.account.identifier,
			session.tokenHash,
			typed,
			usablePasswordKey(environment.PASSWORD_KEY)
		);
		if (result.outcome === 'too-many') {
			clearSessionCookie(cookies);
			return fail(429, { problem: 'Too many wrong codes, so this sign-in has ended. Sign in again to try once more.', ended: true });
		}
		if (result.outcome === 'unavailable') {
			return again('Two-step sign-in is not set up for this account any more. Sign in again.');
		}
		if (result.outcome === 'wrong') {
			return again('That code is not right. Use the code your app shows now, or one of your backup codes.');
		}
		markSignedIn(cookies);
		if (result.usedBackupCode && result.backupCodesLeft <= 3) {
			redirect(303, `/account/security/two-step?few=${result.backupCodesLeft}&returnTo=${encodeURIComponent(returnTo)}`);
		}
		redirect(303, returnTo);
	},

	/** Gives up on this sign-in. */
	cancel: async ({ cookies }) => {
		const { database } = workerEnvironment();
		if (database) await endSession(database, cookies.get(sessionCookie));
		clearSessionCookie(cookies);
		redirect(303, '/sign-in');
	}
};
