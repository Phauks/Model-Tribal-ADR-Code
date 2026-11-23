import { requireAccount } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Send files has no limits on how many files a batch or a day holds
// (decision record 0038, "Limits"); it only needs someone signed in.
export const load: PageServerLoad = async (event) => {
	requireAccount(event);
	return {};
};
