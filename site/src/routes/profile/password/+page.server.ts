import { fail } from '@sveltejs/kit';
import { provedRecently, removePassword, setPassword, tryPassword, usablePasswordKey } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { newPasswordProblem } from '#lib/server/password-checks.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAccount(event);
	const hasPassword = event.locals.session?.account.hasPassword ?? false;
	return {
		hasPassword,
		// Right after a code or link sign-in the old password is not asked
		// for, so a forgotten password can be replaced.
		needsCurrent: hasPassword && !provedRecently(event.locals.session),
		welcome: event.url.searchParams.has('welcome')
	};
};

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
}

type Field = 'current' | 'password' | 'remove-current';

/**
 * Checks the current password when one is needed. It counts toward the same
 * limit on wrong passwords as the sign-in page, so someone who finds a
 * browser left signed in cannot guess it here either.
 */
async function currentPasswordProblem(event: RequestEvent, typed: string): Promise<string | undefined> {
	const session = event.locals.session;
	if (!session?.account.hasPassword || provedRecently(session)) return undefined;
	if (typed === '') return 'Enter your current password.';
	const result = await tryPassword(
		storage(event).database,
		session.account.email,
		typed,
		usablePasswordKey(workerEnvironment().PASSWORD_KEY)
	);
	if (result.outcome === 'accepted') return undefined;
	if (result.outcome === 'wrong') return 'Your current password is not right.';
	return 'There were too many wrong passwords, so password checks are paused for your address. Sign out, sign in with a code or a link, and choose a new password then.';
}

export const actions: Actions = {
	/**
	 * Chooses or changes the password. Changing it needs the current one, so
	 * someone who finds a browser left signed in cannot lock the owner out,
	 * except within a few minutes of signing in with a code or a link, which
	 * already proves who the person is. Every other browser signed in to the
	 * account is signed out.
	 */
	set: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const again = (problem: string, field: Field) =>
			fail(400, { problem, field, needsCurrent: field === 'current' ? true : undefined });
		const current = await currentPasswordProblem(event, text(form, 'current'));
		if (current) return again(current, 'current');
		const password = text(form, 'password');
		const problem = await newPasswordProblem(password, account.email);
		if (problem) return again(problem, 'password');
		await setPassword(
			database,
			account.subject,
			password,
			event.locals.session?.tokenHash,
			usablePasswordKey(workerEnvironment().PASSWORD_KEY)
		);
		return {
			done: 'Your password is saved. Any other browser signed in to your account has been signed out.',
			hasPassword: true,
			needsCurrent: false
		};
	},

	/** Removes the password; signing in with a code by email keeps working. */
	remove: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const current = await currentPasswordProblem(event, text(form, 'current'));
		if (current) return fail(400, { problem: current, field: 'remove-current' as Field });
		await removePassword(database, account.subject, event.locals.session?.tokenHash);
		return {
			done: 'Your password is removed. Sign in with a code sent to your email address, or a link from the lead author, from now on.',
			hasPassword: false,
			needsCurrent: false
		};
	}
};
