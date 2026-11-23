import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const folder = path.resolve(import.meta.dirname, '../migrations');
const migration = (name: string) => readFileSync(path.join(folder, name), 'utf8');

describe('migration 0002 on a database that already has data', () => {
	it('keeps people, reviews and the log, numbers the log in order, and checks foreign keys', () => {
		const database = new DatabaseSync(':memory:');
		database.exec('PRAGMA foreign_keys = ON');
		database.exec(migration('0001_sign_in_and_collaboration.sql'));
		database.exec(`
			INSERT INTO people VALUES ('lead', 's1', 'lead@example.org', 'Lead', 'lead-author', NULL, 'active', NULL, '2026-11-20T00:00:00Z', NULL);
			INSERT INTO people VALUES ('co', NULL, 'co@example.org', 'Co', 'co-author', NULL, 'invited', 'lead', '2026-11-20T01:00:00Z', NULL);
			INSERT INTO reviews VALUES ('r1', 'nation', 'n1', '0.0.1', 'co', 'co-author', 'comment', 'Note', '2026-11-20T02:00:00Z');
			INSERT INTO events VALUES ('e1', 'lead', 'Signed in', 'person', 'lead', NULL, '2026-11-20T00:00:00Z');
			INSERT INTO events VALUES ('e2', 'lead', 'Invited as co-author', 'person', 'co', NULL, '2026-11-20T01:00:00Z');
			INSERT INTO events VALUES ('e3', NULL, 'Request received', 'request', 'q1', NULL, '2026-11-20T03:00:00Z');
		`);
		// D1 runs a migration as one transaction, with foreign keys enforced.
		database.exec('BEGIN');
		database.exec(migration('0002_permission_tiers.sql'));
		database.exec('COMMIT');

		expect(database.prepare('SELECT COUNT(*) AS count FROM people').get()).toEqual({ count: 2 });
		expect(database.prepare('SELECT person_identifier FROM reviews').get()).toEqual({ person_identifier: 'co' });
		expect(database.prepare('SELECT sequence, identifier FROM events ORDER BY sequence').all().map((row) => ({ ...row }))).toEqual([
			{ sequence: 1, identifier: 'e1' },
			{ sequence: 2, identifier: 'e2' },
			{ sequence: 3, identifier: 'e3' }
		]);
		expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
		// The new role is allowed.
		database.exec(`INSERT INTO people VALUES ('w', NULL, 'w@example.org', 'W', 'contributor', NULL, 'invited', 'lead', '2026-11-21T00:00:00Z', NULL)`);
		// Foreign keys still point at the rebuilt people table.
		expect(() =>
			database.exec(`INSERT INTO reviews VALUES ('r2', 'essay', 'x', '0.0.1', 'nobody', 'co-author', 'comment', NULL, '2026-11-21T00:00:00Z')`)
		).toThrow(/FOREIGN KEY/);
	});
});

describe('migration 0010 on a database that already has data', () => {
	it('keeps every log entry, its number and its seal, and allows entries about uploads', async () => {
		const { sealOf, chainStart } = await import('../src/lib/server/activity-seals.ts');
		const database = new DatabaseSync(':memory:');
		database.exec('PRAGMA foreign_keys = ON');
		const files = readdirSync(folder).filter((name) => name.endsWith('.sql') && name < '0010').sort();
		for (const file of files) {
			database.exec('BEGIN');
			database.exec(migration(file));
			database.exec('COMMIT');
		}
		database.exec(`
			INSERT INTO people VALUES ('lead', 's1', 'lead@example.org', 'Lead', 'lead-author', NULL, 'active', NULL, '2026-11-20T00:00:00Z', NULL);
			INSERT INTO events (identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
				VALUES ('e1', 'lead', 'Signed in', 'person', 'lead', NULL, '2026-11-20T00:00:00Z');
			INSERT INTO events (identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
				VALUES ('e2', NULL, 'Request received', 'request', 'q1', 'Note', '2026-11-20T03:00:00Z');
		`);
		const before = database.prepare('SELECT * FROM events ORDER BY sequence').all().map((row) => ({ ...row }));
		let previous = chainStart;
		for (const row of before) {
			const seal = await sealOf(previous, {
				sequence: Number(row.sequence),
				identifier: String(row.identifier),
				personIdentifier: (row.person_identifier as string | null) ?? null,
				action: String(row.action),
				targetKind: String(row.target_kind),
				targetIdentifier: String(row.target_identifier),
				note: (row.note as string | null) ?? null,
				createdAt: String(row.created_at)
			});
			database.prepare('INSERT INTO event_seals VALUES (?, ?, ?)').run(Number(row.sequence), seal, '2026-11-20T04:00:00Z');
			previous = seal;
		}

		database.exec('BEGIN');
		database.exec(migration('0010_uploads.sql'));
		database.exec('COMMIT');

		expect(database.prepare('SELECT * FROM events ORDER BY sequence').all().map((row) => ({ ...row }))).toEqual(before);
		expect(database.prepare('SELECT COUNT(*) AS count FROM event_seals').get()).toEqual({ count: 2 });
		expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
		// Entries about uploads are allowed; new entries keep counting on.
		database.exec(`INSERT INTO events (identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
			VALUES ('e3', NULL, 'Upload received', 'upload', 'u1', NULL, '2026-11-23T00:00:00Z')`);
		expect(database.prepare(`SELECT sequence FROM events WHERE identifier = 'e3'`).get()).toEqual({ sequence: 3 });
		// The log still cannot be changed or deleted from.
		expect(() => database.exec(`UPDATE events SET action = 'x' WHERE identifier = 'e1'`)).toThrow(/cannot be changed/);
		expect(() => database.exec(`DELETE FROM events WHERE identifier = 'e1'`)).toThrow(/cannot be deleted/);
	});
});
