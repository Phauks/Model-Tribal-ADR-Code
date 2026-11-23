import { fail, redirect } from '@sveltejs/kit';
import { acceptInvitation, invitationFor } from '#lib/server/sponsors.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// An invitation to manage a sponsorship (docs/sponsorship.md). The person
// signs in, or makes an account, and then accepts. Opening the link does
// nothing by itself, so a link preview in an email cannot use it up.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requireAccount(event);
	const found = await invitationFor(storage(event).database, event.params.token);
	return { sponsor: found ? found.sponsor.name : null };
};

export const actions: Actions = {
	default: async (event) => {
		const account = requireAccount(event);
		const sponsor = await acceptInvitation(storage(event).database, event.params.token, account);
		if (!sponsor)
			return fail(400, {
				problem: 'This invitation has been used, withdrawn or has expired. Ask for a new one.'
			});
		redirect(303, `/account/sponsorship?sponsor=${encodeURIComponent(sponsor.identifier)}`);
	}
};
