import { deadlinesOf } from '#lib/requests.ts';
import { deleteExpiredPersonalDetails, listRequests } from '#lib/server/request-store.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'read-requests');
	const { database } = storage(event);
	const requested = event.url.searchParams.get('show');
	const show = requested === 'resolved' || requested === 'all' ? requested : 'open';
	const cleared = await deleteExpiredPersonalDetails(database);
	const requests = (await listRequests(database, show)).map((request) => ({
		...request,
		deadlines: deadlinesOf(request)
	}));
	return { show, requests, cleared };
};
