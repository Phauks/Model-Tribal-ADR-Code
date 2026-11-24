import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { sealNewEntries } from '#lib/server/activity-seals.ts';
import { activityLogLines, eventStatement, refusedAction } from '#lib/server/events.ts';
import { testDatabase } from './database.ts';

let database: D1Database;

beforeEach(() => {
	database = testDatabase();
});

/** The export as it was built before it was streamed: one string of every entry. */
async function exportAsOneString(): Promise<string> {
	const rows = await database
		.prepare(
			`SELECT events.sequence, events.identifier, events.person_identifier AS personIdentifier,
			        events.action, events.target_kind AS targetKind, events.target_identifier AS targetIdentifier,
			        events.note, events.created_at AS createdAt, event_seals.hash AS seal
			 FROM events LEFT JOIN event_seals ON event_seals.sequence = events.sequence
			 ORDER BY events.sequence`
		)
		.all();
	return rows.results.map((row) => JSON.stringify(row)).join('\n') + '\n';
}

async function bytesOf(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function addEntries(count: number): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await eventStatement(database, {
			personIdentifier: null,
			action: index % 3 === 0 ? refusedAction : `Entry “${index}”`,
			targetKind: 'request',
			targetIdentifier: `request-${index}`,
			note: index % 2 === 0 ? `A note with a line break\nand “quotes”` : null
		}).run();
	}
}

describe('the activity log export', () => {
	it('sends the same bytes as one string did, across several pages', async () => {
		await addEntries(12);
		await sealNewEntries(database, 7);
		const expected = new TextEncoder().encode(await exportAsOneString());
		expect(await bytesOf(activityLogLines(database, 5))).toEqual(expected);
		expect(await bytesOf(activityLogLines(database))).toEqual(expected);
	});

	it('sends a single empty line for an empty log, as before', async () => {
		expect(new TextDecoder().decode(await bytesOf(activityLogLines(database)))).toBe('\n');
		expect(await exportAsOneString()).toBe('\n');
	});

	it('looks up entries by action with an index', async () => {
		const plan = await database
			.prepare('EXPLAIN QUERY PLAN SELECT COUNT(*) AS count FROM events WHERE action = ? AND created_at >= ?')
			.bind(refusedAction, '2026-01-01')
			.all<{ detail: string }>();
		expect(plan.results.map((row) => row.detail).join(' ')).toContain('events_by_action');
	});
});
