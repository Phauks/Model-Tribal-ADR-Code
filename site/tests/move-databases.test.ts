import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { copySiteDatabase } from '../wayback/move-databases.ts';
import { emptyTestDatabase, testDatabase } from './database.ts';

async function objects(database: D1Database, type: string): Promise<string[]> {
	return (await database.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').bind(type).all<{ name: string }>()).results.map((row) => row.name);
}

async function seed(database: D1Database): Promise<void> {
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
		.run();
	await database
		.prepare(`INSERT INTO mail_inboxes (identifier, local_part, name, kind, catch_all, created_at, updated_at) VALUES ('requests', 'requests', 'Requests', 'shared', 0, '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z')`)
		.run();
	await database.prepare(`INSERT INTO mail_inbox_members VALUES ('requests', 'lead', '2026-11-20T00:00:00Z')`).run();
	await database
		.prepare(`INSERT INTO mail_search (subject, sender, body, message_identifier, thread_identifier) VALUES ('Hello', 'a@example.org', 'A first message', 'm1', 't1')`)
		.run();
}

describe('copying the site database', () => {
	it('copies the schema, every row in foreign-key order, and the indexes and triggers', async () => {
		const from = testDatabase();
		await seed(from);
		const to = emptyTestDatabase();
		const summary = await copySiteDatabase(from, to, 'full');

		for (const type of ['table', 'index', 'trigger', 'view']) expect(await objects(to, type)).toEqual(await objects(from, type));
		for (const table of summary.tables) expect(table.target, table.table).toBe(table.source);
		expect(summary.tables.find((table) => table.table === 'mail_tags')?.written).toBe(4);
		const found = await to.prepare(`SELECT message_identifier FROM mail_search WHERE mail_search MATCH 'first'`).all<{ message_identifier: string }>();
		expect(found.results).toEqual([{ message_identifier: 'm1' }]);
	});

	it('then copies only the rows written to the old database since', async () => {
		const from = testDatabase();
		await seed(from);
		const to = emptyTestDatabase();
		await copySiteDatabase(from, to, 'full');
		await from.prepare(`INSERT INTO mail_tags (identifier, name, color, created_at) VALUES ('tag-new', 'New', 'green', '2026-11-26T00:00:00Z')`).run();
		await from
			.prepare(`INSERT INTO mail_search (subject, sender, body, message_identifier, thread_identifier) VALUES ('Later', 'b@example.org', 'A second message', 'm2', 't2')`)
			.run();

		const missing = await copySiteDatabase(from, to, 'missing');
		expect(missing.created).toEqual([]);
		const written = Object.fromEntries(missing.tables.filter((table) => table.written > 0).map((table) => [table.table, table.written]));
		expect(written).toEqual({ mail_tags: 1, mail_search: 1 });
		for (const table of missing.tables) expect(table.target, table.table).toBe(table.source);

		const again = await copySiteDatabase(from, to, 'missing');
		expect(again.tables.every((table) => table.written === 0)).toBe(true);
	});
});
