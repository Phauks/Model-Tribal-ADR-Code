/**
 * The overview of copies this site serves (src/lib/public-copies.ts): how many
 * there are of each kind, with a short list for each (src/lib/server/copy-lists.ts).
 */
import { copyGroups } from '#lib/server/copy-lists.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const groups = copyGroups();
	return { groups, total: groups.reduce((sum, group) => sum + group.count, 0) };
};
