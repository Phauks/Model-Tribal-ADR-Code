/**
 * Cloudflare Turnstile, the "are you a person?" check on the forms anyone can
 * send: sign in, Create an account, Forgot your password, the request form
 * and Report a problem (decision record 0062). The page shows Cloudflare's
 * widget, which usually decides on its own and stays out of sight; the
 * widget's answer (a single-use token) comes with the form, and this module
 * asks Cloudflare whether it is good before the form's own work runs.
 *
 * The check is on only when both halves are set: the public site key
 * (TURNSTILE_SITE_KEY in wrangler.jsonc) and the secret key
 * (TURNSTILE_SECRET_KEY, a Worker secret set in the Cloudflare dashboard).
 * Without them the forms work as before. Once on, it fails closed: a missing
 * token, a refused token, or no answer from Cloudflare all refuse the form.
 */

/** The names each form gives its widget, which Cloudflare sends back so a token from one form cannot be used on another. */
export const turnstileActions = {
	signIn: 'sign_in',
	createAccount: 'create_account',
	forgotPassword: 'forgot_password',
	request: 'request'
} as const;

export type TurnstileAction = (typeof turnstileActions)[keyof typeof turnstileActions];

/** The form field Cloudflare's widget fills in. */
export const turnstileField = 'cf-turnstile-response';

const siteverify = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileSettings {
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
	/** The site's own host names, comma-separated, such as "triballawproject.org". Never localhost on the live site. */
	TURNSTILE_HOSTNAMES?: string;
}

/** The site key for pages to show the widget with, or nothing while the check is off. */
export function turnstileSiteKey(settings: TurnstileSettings): string | undefined {
	const siteKey = settings.TURNSTILE_SITE_KEY?.trim();
	const secret = settings.TURNSTILE_SECRET_KEY?.trim();
	return siteKey && secret ? siteKey : undefined;
}

function expectedHostnames(settings: TurnstileSettings): Set<string> {
	return new Set(
		(settings.TURNSTILE_HOSTNAMES ?? '')
			.split(',')
			.map((hostname) => hostname.trim().toLowerCase())
			.filter(Boolean)
	);
}

export type TurnstileResult = { outcome: 'passed' | 'off' } | { outcome: 'refused'; reason: string };

/** What a person is told when the check refuses a form. */
export const turnstileProblem =
	'We could not confirm that a person sent this form. Wait for the check above the button to finish, or tick it, and send the form again.';

/**
 * Checks the widget's token that came with a form, which must come from one
 * of the expected forms (one server action can serve several forms, such as
 * Email me a code on the sign-in form and on Forgot your password). The token works once, so
 * the page must get a fresh one (the widget resets itself) before the form
 * is sent again.
 */
export async function checkTurnstile(
	settings: TurnstileSettings,
	form: FormData,
	expected: TurnstileAction | readonly TurnstileAction[],
	remoteAddress: string | null,
	send: typeof fetch = fetch
): Promise<TurnstileResult> {
	if (!turnstileSiteKey(settings)) return { outcome: 'off' };
	const hostnames = expectedHostnames(settings);
	if (hostnames.size === 0) return { outcome: 'refused', reason: 'TURNSTILE_HOSTNAMES is empty' };
	const token = form.get(turnstileField);
	if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
		return { outcome: 'refused', reason: 'no token' };
	}
	const body = new URLSearchParams({ secret: settings.TURNSTILE_SECRET_KEY!.trim(), response: token });
	if (remoteAddress) body.set('remoteip', remoteAddress);
	let result: { success?: boolean; action?: string; hostname?: string; 'error-codes'?: string[] };
	try {
		const response = await send(siteverify, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
			signal: AbortSignal.timeout(10_000)
		});
		if (!response.ok) throw new Error(`siteverify answered ${response.status}`);
		result = await response.json();
	} catch (problem) {
		console.error('Turnstile could not be checked', problem);
		return { outcome: 'refused', reason: 'no answer from Cloudflare' };
	}
	if (result.success !== true) return { outcome: 'refused', reason: (result['error-codes'] ?? []).join(' ') || 'not a success' };
	const actions: readonly string[] = typeof expected === 'string' ? [expected] : expected;
	if (!result.action || !actions.includes(result.action)) return { outcome: 'refused', reason: `action ${result.action ?? 'missing'}` };
	if (!result.hostname || !hostnames.has(result.hostname.toLowerCase())) {
		return { outcome: 'refused', reason: `host name ${result.hostname ?? 'missing'}` };
	}
	return { outcome: 'passed' };
}
