import { permissionsOf } from '#lib/permissions.ts';
import { requireAccount } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// The Account pages (site/DESIGN.md, section 6, "Settings and Account"):
// private, answered by the Worker for the signed-in person.
export const prerender = false;

export const load: LayoutServerLoad = (event) => {
	const account = requireAccount(event);
	return {
		email: account.email,
		hasWorkspaceAccess: Boolean(event.locals.person),
		// For the sidebar's Workspace section, as on the workspace's own pages.
		permissions: event.locals.person ? [...permissionsOf(event.locals.person.role)] : undefined
	};
};
