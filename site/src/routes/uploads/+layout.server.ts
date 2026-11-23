import { permissionsOf } from '#lib/permissions.ts';
import { requireAccount } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// Private pages, answered by the Worker for the signed-in person (docs/uploads.md).
export const prerender = false;

export const load: LayoutServerLoad = async (event) => {
	const account = requireAccount(event);
	return {
		email: account.email,
		// For the sidebar's Workspace section, as on the workspace's own pages.
		permissions: event.locals.person ? [...permissionsOf(event.locals.person.role)] : undefined
	};
};
