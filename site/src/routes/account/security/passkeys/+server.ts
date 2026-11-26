import { error, json } from '@sveltejs/kit';
import { deviceLabel } from '#lib/device-label.ts';
import { signedInRecently } from '#lib/server/accounts.ts';
import { addPasskey, optionsToAdd } from '#lib/server/passkeys.ts';
import { startChallenge, takeChallenge } from '#lib/server/sign-in-challenges.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * "Add a passkey" on Sign-in and security (src/lib/server/passkeys.ts). The
 * page sends { step: "options" } for what the browser needs to make one,
 * then { step: "add", response } with what it made. Like turning on two-step
 * sign-in, this needs a sign-in from the last 10 minutes, so someone who
 * finds a browser left signed in cannot add their own passkey.
 */
export const POST: RequestHandler = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	if (!signedInRecently(event.locals.session)) {
		return json(
			{ problem: 'For your safety, sign in again before adding a passkey. It has been more than 10 minutes.', stale: true },
			{ status: 403 }
		);
	}
	let body: { step?: unknown; response?: unknown };
	try {
		body = await event.request.json();
	} catch {
		error(400, 'The request could not be read.');
	}

	if (body.step === 'options') {
		const options = await optionsToAdd(database, event.url, { identifier: account.subject, email: account.email });
		await startChallenge(database, event.cookies, 'passkey-add', { challenge: options.challenge }, account.subject);
		return json(options, { headers: { 'cache-control': 'no-store' } });
	}

	if (body.step !== 'add' || typeof body.response !== 'object' || body.response === null) error(400, 'The request could not be read.');
	const challenge = await takeChallenge<{ challenge: string }>(database, event.cookies, 'passkey-add');
	if (!challenge || challenge.accountIdentifier !== account.subject) {
		return json({ problem: 'That took too long. Please try again.' }, { status: 400 });
	}
	const added = await addPasskey(
		database,
		event.url,
		account.subject,
		challenge.details.challenge,
		body.response as never,
		deviceLabel(event.request.headers.get('user-agent'))
	);
	if (added.outcome === 'refused') return json({ problem: added.problem }, { status: 400 });
	return json({ added: added.name });
};
