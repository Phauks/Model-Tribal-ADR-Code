import { fail } from '@sveltejs/kit';
import { checkPassword, removePassword, setPassword } from '#lib/server/accounts.ts';
import { passwordProblem } from '#lib/server/sign-in-secrets.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAccount(event);
	return {
		hasPassword: event.locals.session?.account.hasPassword ?? false,
		welcome: event.url.searchParams.has('welcome')
	};
};

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
}

export const actions: Actions = {
	/**
	 * Chooses or changes the password. Changing it needs the current one, so
	 * someone who finds a browser left signed in cannot lock the owner out.
	 * Every other browser signed in to the account is signed out.
	 */
	set: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const current = text(form, 'current');
		const password = text(form, 'password');
		const repeated = text(form, 'repeated');
		const session = event.locals.session;
		if (session?.account.hasPassword && !(await checkPassword(database, account.email, current))) {
			return fail(400, { problem: 'Your current password is not right.', hasPassword: true });
		}
		const problem = passwordProblem(password, account.email);
		if (problem) return fail(400, { problem });
		if (password !== repeated) return fail(400, { problem: 'The two new passwords are not the same.' });
		await setPassword(database, account.subject, password, session?.tokenHash);
		return {
			done: 'Your password is saved. Any other browser signed in to your account has been signed out.',
			hasPassword: true
		};
	},

	/** Removes the password; signing in with a code by email keeps working. */
	remove: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		if (!(await checkPassword(database, account.email, text(form, 'current')))) {
			return fail(400, { problem: 'Your current password is not right.' });
		}
		await removePassword(database, account.subject, event.locals.session?.tokenHash);
		return {
			done: 'Your password is removed. Sign in with a code sent to your email address from now on.',
			hasPassword: false
		};
	}
};
