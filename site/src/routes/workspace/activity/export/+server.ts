/**
 * The whole activity log with its seals, as JSON Lines (one entry per line),
 * for the lead author to keep a copy outside Cloudflare. A later check can
 * compare that copy with the database (src/lib/server/activity-seals.ts).
 * It is sent while it is read, a page of entries at a time (src/lib/server/events.ts).
 */
import { sealNewEntries } from '#lib/server/activity-seals.ts';
import { activityLogLines } from '#lib/server/events.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	await sealNewEntries(database);
	const day = new Date().toISOString().slice(0, 10);
	return new Response(activityLogLines(database), {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'content-disposition': `attachment; filename="activity-log-${day}.jsonl"`,
			'cache-control': 'no-store'
		}
	});
};
