import { json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { homeRow, type RowTile } from '#lib/server/sponsor-row.ts';
import { giftState, publicMode } from '#lib/server/sponsors.ts';
import type { RequestHandler } from './$types';

// The sponsors in the rolling row on the home page (docs/sponsorship.md, "The
// home page row"). The home page is built ahead of time, so it asks for them
// here once it opens. The edge keeps the answer for five minutes
// (tools/edge-cache-worker.js), which is how late a change can show.
export const prerender = false;

export const GET: RequestHandler = async () => {
	const environment = workerEnvironment();
	let sponsors: RowTile[] = [];
	if (environment.database) {
		sponsors = await homeRow(environment.database, publicMode(giftState(environment))).catch((problem) => {
			console.error('Could not read the home page row of sponsors', problem);
			return [];
		});
	}
	return json({ sponsors });
};
