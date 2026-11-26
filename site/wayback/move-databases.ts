// TEMPORARY, for the move to the tribal-law-project databases (docs/cloudflare-names.md).
// Cloudflare cannot rename a D1 database, and the connector this project's
// sessions use cannot copy one, so this Worker does it on Cloudflare's side
// while it has bindings to the old and new databases. Remove this file and the
// bindings once the switch has landed.
//
// - The source library: each minute it loads the new library database from the
//   change files in the bucket, exactly as the site's hourly run does
//   (src/lib/server/source-library.ts), so the new copy is current before the
//   site switches to it.
// - The site's database: copied when a request object appears in the bucket
//   (_migration/site-database/request.json, {"mode": "full" | "missing"}). It
//   copies the schema, then every row in foreign-key order, then indexes and
//   triggers (all of them guard updates and deletes, so none fires on the
//   copy). "missing" copies only rows the new database lacks, for writes made
//   to the old database while the site was switching. The result goes to
//   _migration/site-database/result-<time>.json.

import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { applyLibraryChanges } from '../src/lib/server/source-library.ts';

export interface MoveEnv {
	sourceDocuments: R2Bucket;
	oldSiteDatabase?: D1Database;
	newSiteDatabase?: D1Database;
	newSourceLibrary?: D1Database;
}

interface SchemaRow {
	type: string;
	name: string;
	tbl_name: string;
	sql: string | null;
}

type Mode = 'full' | 'missing';

export interface TableCopy {
	table: string;
	source: number;
	written: number;
	target: number;
}

export interface CopySummary {
	mode: Mode;
	created: string[];
	tables: TableCopy[];
}

const prefix = '_migration/site-database/';
const shadowSuffixes = ['_data', '_idx', '_content', '_docsize', '_config'];
const rowsPerRead = 200;
const statementsPerBatch = 100;

function quote(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

/** Tables and other objects to copy: not SQLite's or Cloudflare's own, and not the shadow tables FTS5 keeps for a virtual table. */
function copiedObjects(schema: SchemaRow[]): SchemaRow[] {
	const virtual = schema.filter((row) => row.type === 'table' && /^CREATE VIRTUAL TABLE/i.test(row.sql ?? '')).map((row) => row.name);
	const shadow = new Set(virtual.flatMap((name) => shadowSuffixes.map((suffix) => name + suffix)));
	return schema.filter((row) => row.sql && !/^sqlite_/i.test(row.name) && !/^_cf_/i.test(row.name) && !shadow.has(row.name));
}

// D1 allows 1,000 queries in one run of a Worker and counts a batch as one,
// so the copy reads and writes in batches.

type Row = Record<string, unknown>;

async function readEach(database: D1Database, sqls: string[]): Promise<Row[][]> {
	if (sqls.length === 0) return [];
	const results = await database.batch(sqls.map((sql) => database.prepare(sql)));
	return results.map((result) => (result.results ?? []) as Row[]);
}

async function counts(database: D1Database, tables: SchemaRow[]): Promise<number[]> {
	return (await readEach(database, tables.map((table) => `SELECT count(*) AS n FROM ${quote(table.name)}`))).map((rows) => Number(rows[0]?.n ?? 0));
}

function isVirtual(table: SchemaRow): boolean {
	return /^CREATE VIRTUAL TABLE/i.test(table.sql ?? '');
}

/** Parents before children, so every row's foreign keys already exist when it is written. */
async function foreignKeyOrder(database: D1Database, tables: SchemaRow[]): Promise<SchemaRow[]> {
	const names = new Set(tables.map((table) => table.name));
	const plain = tables.filter((table) => !isVirtual(table));
	const keys = await readEach(database, plain.map((table) => `PRAGMA foreign_key_list(${quote(table.name)})`));
	const parents = new Map<string, Set<string>>(tables.map((table) => [table.name, new Set<string>()]));
	plain.forEach((table, index) => {
		for (const key of keys[index]) if (key.table !== table.name && names.has(String(key.table))) parents.get(table.name)!.add(String(key.table));
	});
	const ordered: SchemaRow[] = [];
	const placed = new Set<string>();
	while (ordered.length < tables.length) {
		const ready = tables.filter((table) => !placed.has(table.name) && [...parents.get(table.name)!].every((parent) => placed.has(parent)));
		// A loop of foreign keys: place the rest as they are and let deferred checks sort it out.
		const next = ready.length ? ready : tables.filter((table) => !placed.has(table.name));
		for (const table of next) {
			ordered.push(table);
			placed.add(table.name);
		}
	}
	return ordered;
}

async function copyRows(from: D1Database, to: D1Database, table: SchemaRow, columns: string[], after: number): Promise<number> {
	if (columns.length === 0) return 0;
	if (columns.length > 99) throw new Error(`${table.name} has more columns than one statement can bind.`);
	const virtual = isVirtual(table);
	const list = columns.map(quote).join(', ');
	// A virtual table keeps its rowids, so "missing" can tell which rows it already has.
	const writtenColumns = virtual ? ['__copy_rowid', ...columns] : columns;
	const insert = `INSERT ${virtual ? '' : 'OR IGNORE '}INTO ${quote(table.name)} (${virtual ? 'rowid, ' : ''}${list}) VALUES (${writtenColumns.map(() => '?').join(', ')})`;
	let written = 0;
	for (;;) {
		const rows = (
			await from
				.prepare(`SELECT rowid AS "__copy_rowid", ${list} FROM ${quote(table.name)} WHERE rowid > ? ORDER BY rowid LIMIT ${rowsPerRead}`)
				.bind(after)
				.all<Row>()
		).results;
		for (let start = 0; start < rows.length; start += statementsPerBatch) {
			const statements = [to.prepare('PRAGMA defer_foreign_keys = true')];
			for (const row of rows.slice(start, start + statementsPerBatch)) {
				statements.push(to.prepare(insert).bind(...writtenColumns.map((column) => row[column] ?? null)));
			}
			const results = await to.batch(statements);
			written += results.slice(1).reduce((sum, result) => sum + (result.meta?.changes ?? 0), 0);
		}
		if (rows.length < rowsPerRead) return written;
		after = Number(rows[rows.length - 1].__copy_rowid);
	}
}

/** Copy the site's database from one D1 database to another (see the top of this file). */
export async function copySiteDatabase(from: D1Database, to: D1Database, mode: Mode): Promise<CopySummary> {
	const schema = copiedObjects((await from.prepare('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY rowid').all<SchemaRow>()).results);
	const existing = new Set((await to.prepare('SELECT name FROM sqlite_master').all<{ name: string }>()).results.map((row) => row.name));
	const created: string[] = [];
	const create = async (rows: SchemaRow[]) => {
		const missing = rows.filter((row) => !existing.has(row.name));
		if (missing.length === 0) return;
		await to.batch(missing.map((row) => to.prepare(row.sql!)));
		for (const row of missing) {
			existing.add(row.name);
			created.push(row.name);
		}
	};
	const tables = await foreignKeyOrder(from, schema.filter((row) => row.type === 'table'));
	await create(tables);
	const columns = (await readEach(from, tables.map((table) => `PRAGMA table_info(${quote(table.name)})`))).map((rows) => rows.map((row) => String(row.name)));
	const sourceCounts = await counts(from, tables);
	// FTS5 tables have no unique keys to ignore a repeat on, so for them "missing" means rows past the newest one already copied.
	const newest = await readEach(to, tables.map((table) => (isVirtual(table) && mode === 'missing' ? `SELECT max(rowid) AS m FROM ${quote(table.name)}` : 'SELECT NULL AS m')));
	const written: number[] = [];
	for (const [index, table] of tables.entries()) {
		written.push(sourceCounts[index] === 0 ? 0 : await copyRows(from, to, table, columns[index], Number(newest[index][0]?.m ?? Number.MIN_SAFE_INTEGER)));
	}
	const targetCounts = await counts(to, tables);
	// Indexes after the rows (faster), then views and triggers.
	for (const type of ['index', 'view', 'trigger']) await create(schema.filter((object) => object.type === type));
	return {
		mode,
		created,
		tables: tables.map((table, index) => ({ table: table.name, source: sourceCounts[index], written: written[index], target: targetCounts[index] }))
	};
}

async function copyOnRequest(env: MoveEnv): Promise<void> {
	if (!env.oldSiteDatabase || !env.newSiteDatabase) return;
	const request = await env.sourceDocuments.get(prefix + 'request.json');
	if (!request) return;
	const running = await env.sourceDocuments.head(prefix + 'running.json');
	if (running && Date.now() - running.uploaded.getTime() < 15 * 60 * 1000) return;
	const { mode } = (await request.json()) as { mode?: Mode };
	await env.sourceDocuments.put(prefix + 'running.json', JSON.stringify({ mode, started: new Date().toISOString() }));
	const started = new Date().toISOString();
	let result: object;
	try {
		const summary = await copySiteDatabase(env.oldSiteDatabase, env.newSiteDatabase, mode === 'missing' ? 'missing' : 'full');
		result = { started, finished: new Date().toISOString(), ...summary };
	} catch (problem) {
		result = { started, failed: new Date().toISOString(), problem: String(problem) };
	}
	await env.sourceDocuments.put(prefix + `result-${started.replaceAll(':', '')}.json`, JSON.stringify(result, null, 1), {
		httpMetadata: { contentType: 'application/json' }
	});
	await env.sourceDocuments.delete([prefix + 'request.json', prefix + 'running.json']);
}

/** The minute's work for the move; it never stops the Wayback saves. */
export async function moveDatabases(env: MoveEnv): Promise<void> {
	const work: Promise<unknown>[] = [copyOnRequest(env)];
	if (env.newSourceLibrary) work.push(applyLibraryChanges(env.newSourceLibrary, env.sourceDocuments, 40_000));
	for (const outcome of await Promise.allSettled(work)) {
		if (outcome.status === 'rejected') console.error('Database move:', outcome.reason);
	}
}
