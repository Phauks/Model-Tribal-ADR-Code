import { error, json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import { checkMissedRebuild } from '#lib/server/site-text.ts';
import { builtPublication } from '#lib/server/site-text-catalog.ts';
import type { RequestHandler } from './$types';

// The hourly check that published site text reached the pages
// (docs/site-text.md, "Rebuilding"). The Worker's scheduled handler
// (tools/add-scheduled-run.mjs) passes the run here with a token only that
// copy of the Worker holds; every other request is refused as if the
// address did not exist.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const { database, SITE_REBUILD_HOOK_URL } = workerEnvironment();
	if (!database) error(503, 'The database is not connected.');
	return json(await checkMissedRebuild(database, SITE_REBUILD_HOOK_URL, builtPublication), { headers: { 'cache-control': 'no-store' } });
};
