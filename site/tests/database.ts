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

/** An empty stand-in, with no migrations applied. */
export function emptyTestDatabase(): D1Database {
	const database = new DatabaseSync(':memory:');
	database.exec('PRAGMA foreign_keys = ON');
	return shimFor(database);
}

export function testDatabase(): D1Database {
	const database = new DatabaseSync(':memory:');
	database.exec('PRAGMA foreign_keys = ON');
	const folder = path.resolve(import.meta.dirname, '../migrations');
	// Sorting the names as text gives Wrangler's order for both numbered and timestamped names (migrations/README.md, "Order").
	for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
		// D1 runs each migration as one transaction.
		database.exec('BEGIN');
		database.exec(readFileSync(path.join(folder, file), 'utf8'));
		database.exec('COMMIT');
	}
	return shimFor(database);
}

function shimFor(database: DatabaseSync): D1Database {
	const shim = {
		prepare: (sql: string) => new Statement(database, sql),
		batch: async (statements: Statement[]) => {
			database.exec('BEGIN');
			try {
				const results = [];
				// Like D1, a batch returns each statement's rows as well as its changes.
				for (const statement of statements) {
					const prepared = database.prepare(statement.sql);
					if (prepared.columns().length > 0) results.push({ results: prepared.all(...statement.values), meta: { changes: 0 } });
					else results.push({ results: [], meta: { changes: Number(prepared.run(...statement.values).changes) } });
				}
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
