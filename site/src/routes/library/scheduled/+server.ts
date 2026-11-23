import { error, json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import { applyLibraryChanges } from '#lib/server/source-library.ts';
import type { RequestHandler } from './$types';

// The hourly source library run (wrangler.jsonc, "triggers": minute 29). The
// Worker's scheduled handler (tools/add-scheduled-run.mjs) passes the run here
// with a token only that copy of the Worker holds; every other request is
// refused as if the address did not exist. It applies the change files the
// last library build left in the bucket (src/lib/server/source-library.ts).
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const { sourceLibrary, sourceDocuments } = workerEnvironment();
	if (!sourceLibrary || !sourceDocuments) error(503, 'The source library is not connected.');
	// Up to eight minutes a run: a scheduled run may last fifteen, and the
	// first load of the whole library takes a few runs.
	const summary = await applyLibraryChanges(sourceLibrary, sourceDocuments, 8 * 60 * 1000);
	return json(summary, { headers: { 'cache-control': 'no-store' } });
};
