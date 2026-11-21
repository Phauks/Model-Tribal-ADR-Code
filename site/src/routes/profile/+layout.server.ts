import { profileBySubject } from '#lib/server/contributor-profiles.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// Private pages, answered by the Worker for the signed-in person.
export const prerender = false;

export const load: LayoutServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	return {
		email: account.email,
		hasWorkspaceAccess: Boolean(event.locals.person),
		profile: (await profileBySubject(database, account.subject)) ?? null
	};
};
