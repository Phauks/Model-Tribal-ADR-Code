import { can } from '#lib/permissions.ts';
import {
	confirmedCredits,
	deleteExpiredDeclinedProfiles,
	listProfiles
} from '#lib/server/contributor-profiles.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-contributors');
	const { database } = storage(event);
	// Declined registrations are deleted after 12 months (docs/contributor-profiles.md, "Keeping and deleting").
	await deleteExpiredDeclinedProfiles(database);
	const [profiles, credits] = await Promise.all([listProfiles(database), confirmedCredits(database)]);
	return { profiles, credits, canExport: can(person, 'manage-contributors') };
};
