/**
 * The whole activity log with its seals, as JSON Lines (one entry per line),
 * for the lead author to keep a copy outside Cloudflare. A later check can
 * compare that copy with the database (src/lib/server/activity-seals.ts).
 */
import { sealNewEntries } from '#lib/server/activity-seals.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	await sealNewEntries(database);
	const rows = await database
		.prepare(
			`SELECT events.sequence, events.identifier, events.person_identifier AS personIdentifier,
			        events.action, events.target_kind AS targetKind, events.target_identifier AS targetIdentifier,
			        events.note, events.created_at AS createdAt, event_seals.hash AS seal
			 FROM events LEFT JOIN event_seals ON event_seals.sequence = events.sequence
			 ORDER BY events.sequence`
		)
		.all();
	const body = rows.results.map((row) => JSON.stringify(row)).join('\n') + '\n';
	const day = new Date().toISOString().slice(0, 10);
	return new Response(body, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'content-disposition': `attachment; filename="activity-log-${day}.jsonl"`,
			'cache-control': 'no-store'
		}
	});
};
