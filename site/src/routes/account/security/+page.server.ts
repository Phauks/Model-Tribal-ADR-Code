import { fail, redirect } from '@sveltejs/kit';
import { endOtherSession, endOtherSessions, signedInDevices } from '#lib/server/account-pages.ts';
import { needsTwoStep } from '#lib/permissions.ts';
import { signedInRecently } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	availableProviders,
	connectedSignIns,
	disconnect,
	isProvider,
	providerNames,
	providerOrigins,
	startOutsideSignIn
} from '#lib/server/outside-sign-in.ts';
import { passkeysOf, removePasskey } from '#lib/server/passkeys.ts';
import { twoStepState } from '#lib/server/two-step.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

const signInAgain = 'For your safety, sign in again before connecting an account. It has been more than 10 minutes.';

/**
 * Sign-in and security: the password, passkeys, Google and Microsoft
 * (src/lib/server/passkeys.ts, src/lib/server/outside-sign-in.ts), two-step
 * sign-in (./two-step/+page.server.ts), and where the person is signed in.
 */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	const connectedNow = event.url.searchParams.get('connected');
	const taken = event.url.searchParams.get('taken');
	return {
		now: new Date().toISOString(),
		passkeys: await passkeysOf(database, account.subject),
		providers: availableProviders(workerEnvironment()),
		connected: await connectedSignIns(database, account.subject),
		recent: signedInRecently(event.locals.session),
		// After coming back from Google or Microsoft.
		notice: connectedNow && isProvider(connectedNow)
			? { done: `${providerNames[connectedNow]} is connected. You can now sign in with it.` }
			: taken && isProvider(taken)
				? { problem: `That ${providerNames[taken]} account is already connected to a different account here.` }
				: undefined,
		hasPassword: event.locals.session?.account.hasPassword ?? false,
		twoStep: await twoStepState(database, account.subject),
		twoStepRequired: event.locals.twoStepNeeded || Boolean(event.locals.person && needsTwoStep(event.locals.person.role)),
		devices: await signedInDevices(database, account.subject, event.locals.session?.tokenHash)
	};
};

export const actions: Actions = {
	/** Removes one of the person's passkeys. */
	removePasskey: async (event) => {
		const account = requireAccount(event);
		const credential = String((await event.request.formData()).get('passkey') ?? '');
		const removed = await removePasskey(storage(event).database, account.subject, credential);
		if (!removed) return fail(400, { problem: 'That passkey was already removed.' });
		return { done: 'The passkey is removed. Also delete it from your password manager or device, since it no longer works here.' };
	},

	/** Connects Google or Microsoft: sends the browser there, and back to /sign-in/[provider]/callback. */
	connect: async (event) => {
		const account = requireAccount(event);
		const provider = String((await event.request.formData()).get('provider') ?? '');
		if (!isProvider(provider)) return fail(400, { problem: 'Choose Google or Microsoft.' });
		if (!signedInRecently(event.locals.session)) return fail(403, { problem: signInAgain, stale: true });
		const address = await startOutsideSignIn(storage(event).database, event.cookies, event.url, workerEnvironment(), provider, {
			returnTo: '/account/security',
			keep: false,
			connectTo: account.subject
		});
		if (!address) return fail(400, { problem: `Signing in with ${providerNames[provider]} is not switched on.` });
		redirect(303, address, { external: providerOrigins });
	},

	/** Disconnects Google or Microsoft. Signing in by email always still works. */
	disconnect: async (event) => {
		const account = requireAccount(event);
		const provider = String((await event.request.formData()).get('provider') ?? '');
		if (!isProvider(provider)) return fail(400, { problem: 'Choose Google or Microsoft.' });
		const removed = await disconnect(storage(event).database, account.subject, provider);
		if (!removed) return fail(400, { problem: `${providerNames[provider]} was not connected.` });
		return { done: `${providerNames[provider]} is disconnected.` };
	},

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
