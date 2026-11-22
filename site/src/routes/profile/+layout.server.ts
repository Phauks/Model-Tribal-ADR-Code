import { permissionsOf } from '#lib/permissions.ts';
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
		// For the sidebar's Workspace section, as on the workspace's own pages.
		permissions: event.locals.person ? [...permissionsOf(event.locals.person.role)] : undefined,
		profile: (await profileBySubject(database, account.subject)) ?? null
	};
};
