import { fail } from '@sveltejs/kit';
import { publicNationContacts } from 'virtual:public-contacts';
import { today } from '#lib/address-book.ts';
import { differences } from '#lib/address-book-sync.ts';
import { bookOfficeMethods, bringInPageContacts } from '#lib/server/address-book.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-address-book');
	const { database } = storage(event);
	return { differences: differences(publicNationContacts, await bookOfficeMethods(database)) };
};

export const actions: Actions = {
	bringIn: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const { database } = storage(event);
		try {
			const added = await bringInPageContacts(database, publicNationContacts, person.identifier, today());
			return { done: `${added} office ${added === 1 ? 'email or phone was' : 'emails and phones were'} brought in.` };
		} catch (problem) {
			return fail(500, { problem: problem instanceof Error ? problem.message : String(problem) });
		}
	}
};
