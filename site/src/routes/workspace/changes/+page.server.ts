import { hiddenChanges } from '#lib/server/page-history.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Every change in Recent changes with a part hidden (site/COLLABORATION.md,
// "Recent changes"). The lead author only.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'hide-changes');
	const { database } = storage(event);
	return { hidden: await hiddenChanges(database) };
};
