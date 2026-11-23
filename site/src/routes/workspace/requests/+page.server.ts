import { isTeamReportKind, teamReportState } from '#lib/nation-team-reports.ts';
import { deadlinesOf } from '#lib/requests.ts';
import { teamAnswersFor } from '#lib/server/nation-team-reports.ts';
import { claimedNations } from '#lib/server/nation-teams.ts';
import { deleteExpiredPersonalDetails, listRequests } from '#lib/server/request-store.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'read-requests');
	const { database } = storage(event);
	const requested = event.url.searchParams.get('show');
	const show = requested === 'resolved' || requested === 'all' ? requested : 'open';
	const cleared = await deleteExpiredPersonalDetails(database);
	const listed = await listRequests(database, show);
	// Reports about a claimed nation's page also go to that nation's team (Trevor, Nov. 23, 2026).
	const claimed = await claimedNations(database);
	const answers = await teamAnswersFor(
		database,
		listed.map((request) => request.identifier)
	);
	const requests = listed.map((request) => ({
		...request,
		deadlines: deadlinesOf(request),
		team:
			request.nationIdentifier && isTeamReportKind(request.kind) && (claimed.has(request.nationIdentifier) || answers.has(request.identifier))
				? teamReportState(answers.get(request.identifier), request.receivedAt)
				: ''
	}));
	return { show, requests, cleared };
};
