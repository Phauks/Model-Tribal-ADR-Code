import { fail } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { turnOffEmailByToken } from '#lib/server/following.ts';
import type { Actions, PageServerLoad } from './$types';

// "Stop these emails", the link at the end of every summary email. It works
// without signing in, and only turns the emails off; it shows nothing about
// the account. Opening the link changes nothing: the reader presses a button,
// so a mail program that opens links to check them cannot turn emails off.
export const load: PageServerLoad = ({ url }) => ({ token: url.searchParams.get('token') ?? '' });

export const actions: Actions = {
	default: async ({ request }) => {
		const { database } = workerEnvironment();
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		if (!database || !(await turnOffEmailByToken(database, token))) {
			return fail(400, { problem: 'This link does not work. Sign in and choose "No email" on the Following page instead.' });
		}
		return { done: true };
	}
};
