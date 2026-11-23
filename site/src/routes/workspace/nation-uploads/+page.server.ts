import { nationSpokenFor, nationUploads } from '#lib/server/uploads.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'comment-on-nation-uploads');
	const { database } = storage(event);
	return {
		nation: await nationSpokenFor(database, person),
		uploads: await nationUploads(database, person)
	};
};
