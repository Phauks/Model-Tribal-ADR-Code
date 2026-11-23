import { fail } from '@sveltejs/kit';
import { isEmailChoice } from '#lib/following.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { updateEmailDelivery } from '#lib/server/following-email.ts';
import { setEmailChoice, settingsFor } from '#lib/server/following.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * Email and notifications: what the project sends the person and how often.
 * The choice for followed pages moved here from the Following page, which
 * now links to it (site/DESIGN.md, section 6, "Settings and Account").
 */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const settings = await settingsFor(storage(event).database, account.subject);
	return {
		email: account.email,
		emailChoice: settings.email,
		emailReady: updateEmailDelivery(workerEnvironment()).kind === 'email'
	};
};

export const actions: Actions = {
	default: async (event) => {
		const account = requireAccount(event);
		const choice = (await event.request.formData()).get('email');
		if (!isEmailChoice(choice)) return fail(400, { problem: 'Choose how often to get an email.' });
		await setEmailChoice(storage(event).database, account.subject, choice);
		return { done: 'Email setting saved.' };
	}
};
