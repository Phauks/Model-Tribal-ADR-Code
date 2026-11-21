import { confirmedCredits, listProfiles } from '#lib/server/contributor-profiles.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'read-contributors');
	const { database } = storage(event);
	const [profiles, credits] = await Promise.all([listProfiles(database), confirmedCredits(database)]);
	return { profiles, credits };
};
