import { error, json } from '@sveltejs/kit';
import { deviceLabel } from '#lib/device-label.ts';
import { accountByIdentifier } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { checkPasskey, optionsToSignIn } from '#lib/server/passkeys.ts';
import { startChallenge, takeChallenge } from '#lib/server/sign-in-challenges.ts';
import { finishSignIn, safeReturnPath } from '#lib/server/sign-in.ts';
import { refusalCookie, refusalReasons } from '../refused/reasons.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const notRight = 'That passkey did not work here. Try again, or sign in another way.';

/**
 * "Sign in with a passkey" (src/lib/server/passkeys.ts). The page sends
 * { step: "options" } to get a challenge for the browser, then
 * { step: "check", response, returnTo, keep } with what the passkey signed.
 * The answer to a check is { location } to go to, or { problem }.
 */
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const environment = workerEnvironment();
	if (!environment.database) error(503, 'Sign-in is not available right now.');
	const database = environment.database;
	const network = request.headers.get('cf-connecting-ip') ?? 'unknown';
	const limit = await (environment.signInNetworkLimit?.limit({ key: `passkey:${network}` }) ?? { success: true });
	if (!limit.success) return json({ problem: 'Too many tries in a minute. Wait a minute and try again.' }, { status: 429 });

	let body: { step?: unknown; response?: unknown; returnTo?: unknown; keep?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'The request could not be read.');
	}

	if (body.step === 'options') {
		const options = await optionsToSignIn(url);
		await startChallenge(database, cookies, 'passkey-sign-in', { challenge: options.challenge });
		return json(options, { headers: { 'cache-control': 'no-store' } });
	}

	if (body.step !== 'check' || typeof body.response !== 'object' || body.response === null) error(400, 'The request could not be read.');
	const challenge = await takeChallenge<{ challenge: string }>(database, cookies, 'passkey-sign-in');
	if (!challenge) return json({ problem: 'That took too long. Please try again.' }, { status: 400 });
	const checked = await checkPasskey(database, url, challenge.details.challenge, body.response as never);
	const account = checked.outcome === 'accepted' ? await accountByIdentifier(database, checked.accountIdentifier) : undefined;
	if (!account) return json({ problem: notRight }, { status: 400 });

	const finished = await finishSignIn(
		database,
		cookies,
		account,
		'passkey',
		safeReturnPath(typeof body.returnTo === 'string' ? body.returnTo : null),
		environment.LEAD_AUTHOR_EMAIL,
		{ device: deviceLabel(request.headers.get('user-agent')), keep: body.keep === true }
	);
	if (finished.outcome === 'refused') {
		cookies.set(refusalCookie, finished.reason, { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
		return json({ location: '/sign-in/refused', problem: refusalReasons[finished.reason] });
	}
	return json({ location: finished.destination });
};
