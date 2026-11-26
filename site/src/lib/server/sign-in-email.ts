/**
 * Sending sign-in codes by email, through Cloudflare Email Service
 * (Cloudflare, "Email Sending Workers API",
 * developers.cloudflare.com/email-service/api/send-emails/workers-api/).
 *
 * The `signInEmail` binding is in wrangler.jsonc. The sending address is the
 * SIGN_IN_EMAIL_FROM variable, which must be on a domain onboarded in Email
 * Service in the same Cloudflare account (site/COLLABORATION.md, "Setting up
 * sign-in"). Until it is set, the site cannot send codes, but passwords and
 * sign-in links made by the lead author still work.
 *
 * On a copy of the site running on this computer (localhost), nothing is
 * sent: the code is shown on the page instead, so sign-in can be tried
 * without a mail server.
 */

export interface SignInEmailBinding {
	send(message: {
		to: string;
		from: string | { email: string; name?: string };
		subject: string;
		text: string;
	}): Promise<{ messageId: string }>;
}

export type EmailDelivery =
	| { kind: 'email'; send: (to: string, code: string, link: string, purpose?: CodePurpose) => Promise<void> }
	| { kind: 'on-screen' }
	| { kind: 'none' };

/** Whether this request reached a copy of the site running on this computer. */
export function isLocalCopy(url: URL): boolean {
	return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
}

/** Why the code was sent: to sign in, or to confirm the address for Create an account. */
export type CodePurpose = 'sign-in' | 'new-account';

/** The text of a sign-in email, or of the email that confirms a new account's address. */
export function signInMessage(code: string, link: string, purpose: CodePurpose = 'sign-in'): { subject: string; text: string } {
	if (purpose === 'new-account') {
		return {
			subject: `Confirm your email address for the Tribal Law Project: ${code}`,
			text: [
				`Your code is ${code}. Type it where you are creating your account.`,
				'',
				'Or open this link in the browser where you are creating it:',
				link,
				'',
				'The code and the link work once and stop working after 15 minutes. Your account is made when you use one.',
				'',
				'If you did not ask to create an account, you can ignore this email. Nothing is made without the code.'
			].join('\n')
		};
	}
	return {
		subject: `Your sign-in code for the Tribal Law Project: ${code}`,
		text: [
			`Your sign-in code is ${code}.`,
			'',
			'Or open this link in the browser where you are signing in:',
			link,
			'',
			'The code and the link work once and stop working after 15 minutes.',
			'',
			'If you did not ask to sign in, you can ignore this email. Nobody can sign in without the code.'
		].join('\n')
	};
}

/** How sign-in codes reach people on this copy of the site. */
export function emailDelivery(environment: WorkerEnvironment, url: URL): EmailDelivery {
	if (isLocalCopy(url)) return { kind: 'on-screen' };
	const from = environment.SIGN_IN_EMAIL_FROM?.trim();
	const binding = environment.signInEmail;
	if (!from || !binding) return { kind: 'none' };
	return {
		kind: 'email',
		send: async (to, code, link, purpose = 'sign-in') => {
			const { subject, text } = signInMessage(code, link, purpose);
			await binding.send({ to, from: { email: from, name: 'Tribal Law Project' }, subject, text });
		}
	};
}
