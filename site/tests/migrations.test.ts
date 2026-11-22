import { readFileSync } from 'node:fs';
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
