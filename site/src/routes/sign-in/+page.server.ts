import { deviceLabel } from '#lib/device-label.ts';
import { fail, redirect } from '@sveltejs/kit';
import {
	cleanEmail,
	codeLifetimeMinutes,
	issueCode,
	looksLikeEmail,
	tryPassword,
	usablePasswordKey,
	useCode,
	verifiedAccount
} from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { emailDelivery } from '#lib/server/sign-in-email.ts';
import { finishSignIn, safeReturnPath } from '#lib/server/sign-in.ts';
import { refusalCookie } from './refused/reasons.ts';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ url, locals }) => {
	const environment = workerEnvironment();
	const returnTo = safeReturnPath(url.searchParams.get('returnTo'));
	return {
		returnTo,
		// Whether this copy of the site can send codes (src/lib/server/sign-in-email.ts).
		codesAvailable: emailDelivery(environment, url).kind !== 'none',
		signedInAs: locals.account?.email ?? null,
		databaseReady: Boolean(environment.database)
	};
};

/**
 * Each address may try five times a minute for each step, and each network
 * address thirty times (wrangler.jsonc, signInLimit and signInNetworkLimit),
 * so codes and passwords cannot be guessed by trying many quickly. Wrong
 * codes are also counted per code (src/lib/server/accounts.ts,
 * maximumWrongAttempts).
 */
async function withinLimit(request: Request, email: string, step: string): Promise<boolean> {
	const { signInLimit, signInNetworkLimit } = workerEnvironment();
	const network = request.headers.get('cf-connecting-ip') ?? 'unknown';
	const [byAddress, byNetwork] = await Promise.all([
		signInLimit?.limit({ key: `${step}:${email.toLocaleLowerCase('en-US')}` }) ?? { success: true },
		signInNetworkLimit?.limit({ key: `${step}:${network}` }) ?? { success: true }
	]);
	return byAddress.success && byNetwork.success;
}

const tooMany = 'Too many tries in a minute. Wait a minute and try again.';

function formText(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
}

export const actions: Actions = {
	/** Sends a code and a link to the address. */
	send: async ({ request, url }) => {
		const form = await request.formData();
		const email = cleanEmail(formText(form, 'email'));
		const returnTo = safeReturnPath(formText(form, 'returnTo'));
		if (!looksLikeEmail(email)) {
			return fail(400, {
				step: 'email' as const,
				email, returnTo,
				field: 'email' as const,
				problem: 'Enter your email address, for example name@example.com.'
			});
		}
		const environment = workerEnvironment();
		const delivery = emailDelivery(environment, url);
		if (delivery.kind === 'none' || !environment.database) {
			return fail(503, {
				step: 'email' as const,
				email, returnTo,
				problem: 'This site cannot send sign-in codes yet. Sign in with your password, or ask the lead author for a sign-in link.'
			});
		}
		if (!(await withinLimit(request, email, 'send'))) return fail(429, { step: 'email' as const, email, returnTo, problem: tooMany });

		const issued = await issueCode(environment.database, email, 'email');
		const link = new URL('/sign-in/link', url.origin);
		link.searchParams.set('token', issued.linkToken);
		if (returnTo !== '/workspace') link.searchParams.set('returnTo', returnTo);

		if (delivery.kind === 'email') {
			try {
				await delivery.send(email, issued.code!, link.href);
			} catch (problem) {
				console.error('Could not send a sign-in email', problem);
				return fail(502, {
					step: 'email' as const,
					email, returnTo,
					problem: 'The email could not be sent just now. Please try again in a few minutes.'
				});
			}
		}
		return {
			step: 'code' as const,
			email, returnTo,
			keep: form.get('keep') === 'yes',
			minutes: codeLifetimeMinutes.email,
			// Only on a copy running on this computer, where no email is sent.
			shownCode: delivery.kind === 'on-screen' ? issued.code : undefined,
			shownLink: delivery.kind === 'on-screen' ? link.href : undefined
		};
	},

	/** Checks the code typed from the email. */
	code: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = cleanEmail(formText(form, 'email'));
		const code = formText(form, 'code').replace(/\s+/g, '');
		const returnTo = safeReturnPath(formText(form, 'returnTo'));
		const environment = workerEnvironment();
		const again = (problem: string, status = 400) =>
			fail(status, { step: 'code' as const, email, returnTo, keep: form.get('keep') === 'yes', minutes: codeLifetimeMinutes.email, problem, field: 'code' as const });
		if (!environment.database) return again('Sign-in is not available right now.', 503);
		if (!/^\d{6}$/.test(code)) return again('Enter the six-digit code from the email.');
		if (!(await withinLimit(request, email, 'code'))) return again(tooMany, 429);

		const result = await useCode(environment.database, email, code);
		if (result.outcome !== 'accepted') {
			const messages = {
				wrong: 'That code is not right. Check the newest email and try again.',
				'too-many': 'Too many wrong codes. Ask for a new code.',
				expired: 'That code has expired or was already used. Ask for a new code.'
			};
			return again(messages[result.outcome], result.outcome === 'too-many' ? 429 : 400);
		}

		const account = await verifiedAccount(environment.database, result.email);
		const finished = await finishSignIn(environment.database, cookies, account, 'code', returnTo, environment.LEAD_AUTHOR_EMAIL, {
			device: deviceLabel(request.headers.get('user-agent')),
			keep: form.get('keep') === 'yes'
		});
		if (finished.outcome === 'refused') {
			cookies.set(refusalCookie, finished.reason, { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
			redirect(303, '/sign-in/refused');
		}
		redirect(303, finished.destination);
	},

	/**
	 * Signs in with a password the person chose earlier. Wrong passwords are
	 * counted for the address: after 10 in a row password sign-in pauses, and
	 * after 100 it stays off until a new password is chosen
	 * (src/lib/server/accounts.ts, tryPassword).
	 */
	password: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = cleanEmail(formText(form, 'email'));
		const password = formText(form, 'password');
		const returnTo = safeReturnPath(formText(form, 'returnTo'));
		const environment = workerEnvironment();
		const again = (problem: string, field: 'email' | 'password' | undefined, status = 400) =>
			fail(status, { step: 'email' as const, email, returnTo, problem, field });
		if (!environment.database) return again('Sign-in is not available right now.', undefined, 503);
		if (!looksLikeEmail(email)) return again('Enter your email address, for example name@example.com.', 'email');
		if (password === '') return again('Enter your password.', 'password');
		if (!(await withinLimit(request, email, 'password'))) return again(tooMany, undefined, 429);

		const result = await tryPassword(environment.database, email, password, usablePasswordKey(environment.PASSWORD_KEY));
		if (result.outcome === 'paused' || result.outcome === 'off') {
			return fail(429, {
				step: 'email' as const,
				email, returnTo,
				paused: {
					off: result.outcome === 'off',
					minutes: result.outcome === 'paused' ? Math.max(1, Math.ceil((Date.parse(result.until) - Date.now()) / 60_000)) : 0,
					codesAvailable: emailDelivery(environment, url).kind !== 'none'
				}
			});
		}
		// The same answer whether or not the address has an account, so this
		// form cannot be used to find out who has signed up.
		if (result.outcome !== 'accepted') {
			return again('The email address or password is not right. Check both, or sign in with a code instead.', 'password');
		}
		const finished = await finishSignIn(environment.database, cookies, result.account, 'password', returnTo, environment.LEAD_AUTHOR_EMAIL, {
			device: deviceLabel(request.headers.get('user-agent')),
			keep: form.get('keep') === 'yes'
		});
		if (finished.outcome === 'refused') {
			cookies.set(refusalCookie, finished.reason, { path: '/sign-in', maxAge: 300, httpOnly: true, sameSite: 'lax' });
			redirect(303, '/sign-in/refused');
		}
		redirect(303, finished.destination);
	}
};
