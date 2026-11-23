import { fail } from '@sveltejs/kit';
import { endOtherSession, endOtherSessions, signedInDevices } from '#lib/server/account-pages.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * Sign-in and security: the password, and where the person is signed in.
 * Two-step sign-in and backup codes go here when they are built (the plan
 * in the "Revise the sign-in screen and password rules" thread).
 */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	return {
		now: new Date().toISOString(),
		hasPassword: event.locals.session?.account.hasPassword ?? false,
		devices: await signedInDevices(database, account.subject, event.locals.session?.tokenHash)
	};
};

export const actions: Actions = {
	/** Signs out one other device. */
	signOut: async (event) => {
		const account = requireAccount(event);
		const current = event.locals.session?.tokenHash;
		if (!current) return fail(400, { problem: 'Your session has ended. Sign in again.' });
		const handle = String((await event.request.formData()).get('device') ?? '');
		const ended = await endOtherSession(storage(event).database, account.subject, handle, current);
		if (!ended) return fail(400, { problem: 'That device is already signed out.' });
		return { done: 'That device is signed out.' };
	},

	/** Signs out every device but this one. */
	signOutOthers: async (event) => {
		const account = requireAccount(event);
		const current = event.locals.session?.tokenHash;
		if (!current) return fail(400, { problem: 'Your session has ended. Sign in again.' });
		await endOtherSessions(storage(event).database, account.subject, current);
		return { done: 'Every other device is signed out.' };
	}
};
