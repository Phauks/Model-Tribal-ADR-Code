import { error, json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { scheduledRun } from '#lib/server/following-run.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import type { RequestHandler } from './$types';

// The hourly run (wrangler.jsonc, "triggers"). Cloudflare calls the Worker's
// scheduled handler, which tools/add-scheduled-run.mjs adds after the build;
// it passes the run to this address inside the Worker, with a token that
// exists only in that copy of the Worker's memory. Requests from outside
// cannot carry the token and are refused.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const result = await scheduledRun(workerEnvironment());
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
