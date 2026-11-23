import { mailContext } from '#lib/server/mail/runtime.ts';
import { unsubscribeWithToken } from '#lib/server/mail/outreach.ts';
import type { Actions, PageServerLoad } from './$types';

// The unsubscribe link in outreach messages. Opening the link only shows a
// button, because mail scanners open links; pressing it, or a mail program's
// one-click request (RFC 8058, a POST that tools/add-mail-handlers.mjs passes
// on), puts the address on the do-not-email list.
export const prerender = false;

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ params }) => {
		const email = await unsubscribeWithToken(mailContext(), params.token, 'unsubscribe link');
		return { done: email !== null, email };
	}
};
