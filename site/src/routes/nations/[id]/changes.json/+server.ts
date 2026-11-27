/**
 * What the nation's own published changes add to its page, as HTML for each
 * empty place on the page (src/lib/server/nation-page-overlay.ts). The
 * Worker reads this before sending a nation's page
 * (tools/add-nation-page-changes.mjs), and the page reads it after a move
 * within the site. It holds only what is already live on the page, whether
 * the nation has claimed the page, the page's history badge, and what the
 * nation chose the site shows of its laws and court opinions
 * (src/lib/nation-restrictions.ts).
 */
import { error, json } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { restrictableCopyMap } from '#lib/server/copy-list.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { liveChanges } from '#lib/server/nation-page-changes.ts';
import { pageOverlay } from '#lib/server/nation-page-overlay.ts';
import { nationPageRestrictions, restrictableList } from '#lib/server/nation-restrictions.ts';
import { claimOf } from '#lib/server/nation-teams.ts';
import { pageHistorySummary } from '#lib/server/page-history.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	if (!reviewSubjects.some((subject) => subject.kind === 'nation' && subject.identifier === params.id)) {
		error(404, 'No such nation.');
	}
	const environment = workerEnvironment();
	const database = environment.database;
	const overlay = database
		? pageOverlay(
				params.id,
				await liveChanges(database, params.id),
				await claimOf(database, params.id),
				await pageHistorySummary(database, `/nations/${params.id}`),
				await nationPageRestrictions(database, params.id, () => restrictableList(params.id, url, fetch, environment.ASSETS), restrictableCopyMap)
			)
		: undefined;
	return json(overlay ?? { stamp: null, slots: {} }, { headers: { 'Cache-Control': 'no-store' } });
};
