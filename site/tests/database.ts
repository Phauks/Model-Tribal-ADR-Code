/**
 * A stand-in for Cloudflare D1 in tests, backed by Node's built-in SQLite,
 * with the real migrations applied. It implements only the parts of the D1
 * interface the site uses: prepare, bind, first, all, run and batch.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types/index.ts';

type Value = string | number | null;

class Statement {
	constructor(
		private readonly database: DatabaseSync,
		readonly sql: string,
		readonly values: Value[] = []
	) {}

	bind(...values: Value[]): Statement {
		return new Statement(this.database, this.sql, values);
	}

	async first<Row>(): Promise<Row | null> {
		return (this.database.prepare(this.sql).get(...this.values) as Row | undefined) ?? null;
	}

	async all<Row>(): Promise<{ results: Row[] }> {
		return { results: this.database.prepare(this.sql).all(...this.values) as Row[] };
	}

	async run(): Promise<{ meta: { changes: number } }> {
		const result = this.database.prepare(this.sql).run(...this.values);
		return { meta: { changes: Number(result.changes) } };
	}
}

export function testDatabase(): D1Database {
	const database = new DatabaseSync(':memory:');
	database.exec('PRAGMA foreign_keys = ON');
	const folder = path.resolve(import.meta.dirname, '../migrations');
	for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
		// D1 runs each migration as one transaction.
		database.exec('BEGIN');
		database.exec(readFileSync(path.join(folder, file), 'utf8'));
		database.exec('COMMIT');
	}
	const shim = {
		prepare: (sql: string) => new Statement(database, sql),
		batch: async (statements: Statement[]) => {
			database.exec('BEGIN');
			try {
				const results = [];
				for (const statement of statements) results.push(await statement.run());
				database.exec('COMMIT');
				return results;
			} catch (problem) {
				database.exec('ROLLBACK');
				throw problem;
			}
		}
	};
	return shim as unknown as D1Database;
}
