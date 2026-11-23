import { acknowledge } from '#lib/server/mail/outbound.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { readToken } from '#lib/server/mail/tokens.ts';
import type { Actions, PageServerLoad } from './$types';

// The visible "let us know you got this" link that an outreach batch can
// add instead of hidden open tracking (site/MAIL.md, "Read receipts").
// Opening the link only shows a button, because mail scanners open links.
export const prerender = false;

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ params }) => {
		const context = mailContext();
		const message = context.settings.signingKey ? await readToken(context.settings.signingKey, 'acknowledge', params.token) : null;
		return { done: message !== null && (await acknowledge(context, message)) };
	}
};
