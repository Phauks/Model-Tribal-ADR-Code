import { error, json } from '@sveltejs/kit';
import { checkSealsAndRecord, sealNewEntries } from '#lib/server/activity-seals.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import type { RequestHandler } from './$types';

// The hourly check of the activity log's whole seal chain (site/COLLABORATION.md, "Activity log"). Pages that show the seals check only the entries after the checkpoint this run records, so a change to an older entry is found here and then shown on those pages. The Worker's scheduled handler (tools/add-scheduled-run.mjs) passes the run here with a token only that copy of the Worker holds; every other request is refused as if the address did not exist.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const { database } = workerEnvironment();
	if (!database) error(503, 'The database is not connected.');
	await sealNewEntries(database);
	return json(await checkSealsAndRecord(database), { headers: { 'cache-control': 'no-store' } });
};
