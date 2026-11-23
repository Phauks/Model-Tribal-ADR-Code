import { allowanceFor } from '#lib/server/uploads.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	const allowance = await allowanceFor(database, account.subject, event.locals.person);
	return {
		filesPerDay: Number.isFinite(allowance.filesPerDay) ? allowance.filesPerDay : null
	};
};
