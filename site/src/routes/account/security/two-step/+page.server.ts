import { fail } from '@sveltejs/kit';
import { needsTwoStep } from '#lib/permissions.ts';
import { passwordKeyOf, signedInRecently } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { scanCode } from '#lib/server/scan-code.ts';
import { safeReturnPath } from '#lib/server/sign-in.ts';
import {
	authenticatorLink,
	finishAuthenticatorSetUp,
	groupedSecret,
	newAuthenticatorSecretFor,
	replaceBackupCodes,
	startAuthenticatorSetUp,
	turnOffTwoStep,
	twoStepState
} from '#lib/server/two-step.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/**
 * Two-step sign-in on Sign-in and security: setting up an authenticator app,
 * new backup codes, and turning it off (src/lib/server/two-step.ts). Each
 * change needs a sign-in from the last 10 minutes, so someone who finds a
 * browser left signed in cannot add their own app or take the owner's away.
 */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	const few = event.url.searchParams.get('few');
	return {
		state: await twoStepState(database, account.subject),
		required: isRequired(event),
		recent: signedInRecently(event.locals.session),
		returnTo: safeReturnPath(event.url.searchParams.get('returnTo')),
		askedBecauseRequired: event.url.searchParams.has('required'),
		fewBackupCodesLeft: few !== null && /^\d+$/.test(few) ? Number(few) : null
	};
};

/** Whether the person's role needs two-step sign-in (src/lib/permissions.ts, rolesNeedingTwoStep). */
function isRequired(event: RequestEvent | Parameters<PageServerLoad>[0]): boolean {
	return event.locals.twoStepNeeded || Boolean(event.locals.person && needsTwoStep(event.locals.person.role));
}

const signInAgain = 'For your safety, sign in again before changing two-step sign-in. It has been more than 10 minutes.';

function key(): Promise<string | undefined> {
	return passwordKeyOf(workerEnvironment());
}

async function setUpScreen(email: string, secret: string) {
	const link = authenticatorLink(secret, email);
	return { setUp: { secret: groupedSecret(secret), link, scanCode: scanCode(link) } };
}

export const actions: Actions = {
	/** Starts setting up an app: shows a QR code and the key. */
	start: async (event) => {
		const account = requireAccount(event);
		if (!signedInRecently(event.locals.session)) return fail(403, { problem: signInAgain, stale: true });
		const secret = await startAuthenticatorSetUp(storage(event).database, account.subject, await key());
		return setUpScreen(account.email, secret);
	},

	/** Checks the first code from the app and finishes setting it up. */
	confirm: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		if (!signedInRecently(event.locals.session)) return fail(403, { problem: signInAgain, stale: true });
		const typed = String((await event.request.formData()).get('code') ?? '').trim();
		const secret = await newAuthenticatorSecretFor(database, account.subject, await key());
		if (!secret) return fail(400, { problem: 'Setting up has not started, or has already finished. Start again.' });
		const again = async (problem: string) => fail(400, { problem, field: 'code' as const, ...(await setUpScreen(account.email, secret)) });
		if (!/^\d{6}$/.test(typed.replace(/\s+/g, ''))) return again('Enter the six-digit code your app shows.');
		const result = await finishAuthenticatorSetUp(database, account.subject, typed, await key(), event.locals.session?.tokenHash);
		if (result.outcome !== 'done') {
			return again('That code is not right. Check that the time on your phone is set automatically, then type the code it shows now.');
		}
		return { backupCodes: result.backupCodes, justTurnedOn: true };
	},

	/** New backup codes in place of the old ones. */
	codes: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		if (!signedInRecently(event.locals.session)) return fail(403, { problem: signInAgain, stale: true });
		if (!(await twoStepState(database, account.subject)).on) return fail(400, { problem: 'Set up an authenticator app first.' });
		return { backupCodes: await replaceBackupCodes(database, account.subject), justTurnedOn: false };
	},

	/** Turns two-step sign-in off, unless the person's role needs it. */
	off: async (event) => {
		const account = requireAccount(event);
		if (isRequired(event)) {
			return fail(403, { problem: 'Your role needs two-step sign-in, so it cannot be turned off. You can replace your app instead.' });
		}
		if (!signedInRecently(event.locals.session)) return fail(403, { problem: signInAgain, stale: true });
		await turnOffTwoStep(storage(event).database, account.subject);
		return { done: 'Two-step sign-in is off. You sign in with your password or a code from your email only.' };
	}
};
