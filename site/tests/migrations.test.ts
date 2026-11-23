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

describe('migration 0018', () => {
	it('adds comments from the nation, which go with their upload', () => {
		const database = new DatabaseSync(':memory:');
		database.exec('PRAGMA foreign_keys = ON');
		const files = readdirSync(folder).filter((name) => name.endsWith('.sql') && name < '0019').sort();
		for (const file of files) {
			database.exec('BEGIN');
			database.exec(migration(file));
			database.exec('COMMIT');
		}
		database.exec(`
			INSERT INTO people (identifier, email, display_name, role, nation_identifier, status, added_at) VALUES ('nr', 'nr@example.org', 'Reviewer', 'nation-reviewer', 'hopi-tribe', 'active', '2026-11-20T00:00:00Z');
			INSERT INTO uploads (identifier, reference, group_identifier, way_in, kind, source, status, file_name, received_at)
				VALUES ('u1', 'U-20261123-ABCDEF', 'g1', 'send-files', 'picture', 'file', 'in-review', 'a.png', '2026-11-23T00:00:00Z');
			INSERT INTO upload_nation_comments VALUES ('c1', 'u1', 'hopi-tribe', 'nr', 'The nation agrees', '2026-11-23T03:00:00Z');
		`);
		expect(() => database.exec(`INSERT INTO upload_nation_comments VALUES ('c2', 'u1', 'hopi-tribe', 'nobody', 'x', '2026-11-23T04:00:00Z')`)).toThrow(/FOREIGN KEY/);
		database.exec(`DELETE FROM uploads WHERE identifier = 'u1'`);
		expect(database.prepare('SELECT COUNT(*) AS count FROM upload_nation_comments').get()).toEqual({ count: 0 });
	});
});

describe('migration order', () => {
	// Wrangler 4.166 (compareMigrationPaths): by the number before the first underscore, then by name.
	const wranglerOrder = (a: string, b: string) => {
		const number = (name: string) => parseInt(name.split('_')[0], 10);
		if (number(a) !== number(b)) return number(a) - number(b);
		return a < b ? -1 : a > b ? 1 : 0;
	};

	it('is the same whether names are sorted as text, as the tests do, or the way Wrangler sorts them', () => {
		const names = readdirSync(folder).filter((name) => name.endsWith('.sql'));
		const examples = ['20261123T0435_add_b.sql', '20261124T0001_add_c.sql', '20261123T2359_add_d.sql', '20270101T0000_add_e.sql'];
		for (const list of [names, [...names, ...examples]]) {
			expect([...list].sort()).toEqual([...list].sort(wranglerOrder));
		}
	});
});
