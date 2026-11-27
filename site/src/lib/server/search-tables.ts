/**
 * The site search on the server, for a reader whose device does not have the
 * search files yet (Trevor, Nov. 26, 2026: search from the server until the
 * file arrives, then on the device, which is faster and works offline). The
 * masthead's search panel asks /search/query while it downloads
 * /search/index.json and /search/records.json, then searches its own copy.
 *
 * The tables (migrations/20261127T0105_add_site_search_tables.sql) hold the
 * same two files as a reader of the site gets them, filtered by what nations
 * chose to hide (src/lib/restricted-files.ts), with every name already folded
 * by the same code the device uses (src/lib/site-search.ts, prepare). The
 * query scores names in SQL by the device's rules (nameScore and
 * searchEntries there; documentMatches in src/lib/search-records.ts), so the
 * server and the device give the same answer. tests/search-tables.test.ts
 * checks that they do.
 *
 * The tables record the build's index file and the restrictions they were
 * filled from. When either has changed, the server answers nothing (the
 * panel then waits for the files, as it always did) and fills the tables
 * again after answering, so a hidden copy is never found here once a nation
 * has hidden it.
 *
 * A fill is written in several batches, each a few megabytes, because one
 * batch with the whole index (21 MB of rows for 40,406 entries on Nov. 27,
 * 2026) failed in D1 every time, while the 30,812 entries before it fitted.
 * The tables answer nothing while a fill is under way: its first batch clears
 * the key with the old rows, and only its last batch sets the key again.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import { documentResult, panelResult, resultGroups, type PanelAnswer, type PanelResult, type ResultGroup } from '../search-everything.ts';
import type { SearchRecords } from '../search-records.ts';
import { prepare, wordsOf, type SearchEntry, type SearchKind } from '../site-search.ts';
import { restrictionStamp, restrictionStampSql, type RestrictionStampRow } from './restriction-stamp.ts';
import { foldForSearch } from '../tables/table-definition.ts';

/** Kinds of name, in the order the device tries them, and what each takes off the score. */
const titleRank = 0;
const otherNameRank = 1;
const setRank = 2;

/** Words searched for at most; more are left out of the query, so it stays a reasonable size. */
const mostWords = 12;

/** Characters of rows (as JSON) written by one statement and by one batch, well under what D1 takes in one request. */
const statementBytes = 256_000;
const batchBytes = 2_000_000;

/** How long a fill may take before another request may start one again. */
const fillTimeout = 120_000;

/** What the tables were filled from: the built index file and the restrictions in force. */
export function searchTablesKey(indexVersion: string, restrictionStamp: string | undefined): string {
	return `${indexVersion}|${restrictionStamp ?? 'none'}`;
}

async function stateOf(database: D1Database, name: string): Promise<string | undefined> {
	const row = await database.prepare('SELECT value FROM site_search_state WHERE name = ?').bind(name).first<{ value: string }>();
	return row?.value;
}

/** Whether the tables hold what this key names. */
export async function searchTablesReady(database: D1Database, key: string): Promise<boolean> {
	return (await stateOf(database, 'key')) === key;
}

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The columns of each table, in the order its rows list them. */
const tableColumns = {
	site_search_entries: ['position', 'kind', 'result', 'everything'],
	site_search_names: ['position', 'rank', 'ordinal', 'shown', 'folded', 'words'],
	site_search_documents: ['position', 'result', 'words']
} as const;

type Table = keyof typeof tableColumns;
type Row = (string | number | null)[];

/** This fill still holds the tables: no later fill has taken them over. */
const stillFilling = "(SELECT value FROM site_search_state WHERE name = 'filling') = ?";

/** A statement writing these rows, only while the fill named by `token` still holds the tables. */
function insertRows(database: D1Database, table: Table, rows: string, token: string): D1PreparedStatement {
	const columns = tableColumns[table];
	const values = columns.map((_, index) => `json_extract(value, '$[${index}]')`).join(', ');
	return database.prepare(`INSERT INTO ${table} (${columns.join(', ')}) SELECT ${values} FROM json_each(?1) WHERE ${stillFilling.replace('?', '?2')}`).bind(rows, token);
}

/** Every table's rows, as JSON arrays of about `statementBytes` each. */
function* rowParts(listed: SearchEntry[], records: SearchRecords): Generator<{ table: Table; rows: string; count: number }> {
	let table: Table = 'site_search_entries';
	let part: string[] = [];
	let bytes = 0;
	const flush = () => {
		const done = { table, rows: `[${part.join(',')}]`, count: part.length };
		part = [];
		bytes = 0;
		return done;
	};
	function* add(into: Table, row: Row) {
		if (part.length > 0 && (into !== table || bytes >= statementBytes)) yield flush();
		table = into;
		const text = JSON.stringify(row);
		part.push(text);
		bytes += text.length;
	}
	const names: Row[] = [];
	for (const [position, entry] of listed.entries()) {
		const item = prepare(entry);
		yield* add('site_search_entries', [position, entry.kind, JSON.stringify(panelResult({ ...entry, score: 0 })), item.everything]);
		let ordinal = 0;
		const words = (name: { words: string[] }) => ` ${name.words.join(' ')} `;
		names.push([position, titleRank, ordinal++, null, item.title.folded, words(item.title)]);
		for (const name of item.also) names.push([position, otherNameRank, ordinal++, name.name, name.folded, words(name)]);
		for (const group of item.groups) for (const name of group.names) names.push([position, setRank, ordinal++, group.shown, name.folded, words(name)]);
	}
	for (const row of names) yield* add('site_search_names', row);
	for (const [position, row] of records.documents.entries()) {
		yield* add('site_search_documents', [position, JSON.stringify(documentResult(row)), foldForSearch(`${row.title} ${row.kindLabel} ${row.year ?? ''} ${row.nationName}`)]);
	}
	if (part.length > 0) yield flush();
}

/**
 * Fills the tables from the files as readers get them, unless another fill
 * started less than two minutes ago. Nothing is written when the files are
 * the same as last time; only the key changes. Otherwise the first batch
 * clears the key and the old rows, the rows follow in batches of about
 * `batchBytes`, and the last batch sets the key. Each write is made only
 * while this fill holds the tables, so a fill that a later one took over
 * writes nothing more and leaves the key alone ('busy').
 */
export async function fillSearchTables(database: D1Database, key: string, entries: SearchEntry[], records: SearchRecords, now = Date.now()): Promise<'filled' | 'unchanged' | 'busy'> {
	const started = Number((await stateOf(database, 'filling')) ?? 0);
	if (started && now - started < fillTimeout) return 'busy';
	const token = String(now);
	const setState = (name: string, value: string) =>
		database
			.prepare(`INSERT INTO site_search_state (name, value) SELECT ?1, ?2 WHERE ${stillFilling.replace('?', '?3')} ON CONFLICT (name) DO UPDATE SET value = excluded.value`)
			.bind(name, value, token);
	const finish = () => database.prepare(`DELETE FROM site_search_state WHERE name = 'filling' AND value = ?`).bind(token);
	await database.prepare("INSERT INTO site_search_state (name, value) VALUES ('filling', ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").bind(token).run();
	let step = 'comparing the files with the last fill';
	try {
		// The device lists a nation only when its record is in the records file (matchEverything).
		const nationLinks = new Set(records.nations.map((row) => row.link));
		const listed = entries.filter((entry) => entry.kind !== 'nation' || nationLinks.has(entry.link));
		const content = await sha256(JSON.stringify([listed, records.documents]));
		if ((await stateOf(database, 'content')) === content) {
			step = 'setting the key';
			const [keySet] = await database.batch([setState('key', key), finish()]);
			return keySet.meta.changes > 0 ? 'unchanged' : 'busy';
		}
		step = 'clearing the old rows';
		const [held] = await database.batch([
			database.prepare(`SELECT 1 AS held WHERE ${stillFilling}`).bind(token),
			database.prepare(`DELETE FROM site_search_state WHERE name IN ('key', 'content') AND ${stillFilling}`).bind(token),
			...Object.keys(tableColumns).map((table) => database.prepare(`DELETE FROM ${table} WHERE ${stillFilling}`).bind(token))
		]);
		if (held.results.length === 0) return 'busy';
		let batch: { statement: D1PreparedStatement; count: number }[] = [];
		let bytes = 0;
		let batches = 0;
		const send = async () => {
			batches += 1;
			step = `writing batch ${batches} of rows`;
			const results = await database.batch(batch.map((item) => item.statement));
			const written = results.every((result, index) => result.meta.changes === batch[index].count);
			batch = [];
			bytes = 0;
			return written;
		};
		for (const part of rowParts(listed, records)) {
			batch.push({ statement: insertRows(database, part.table, part.rows, token), count: part.count });
			bytes += part.rows.length;
			if (bytes >= batchBytes && !(await send())) return 'busy';
		}
		if (batch.length > 0 && !(await send())) return 'busy';
		step = 'setting the key';
		const [contentSet] = await database.batch([setState('content', content), setState('key', key), finish()]);
		return contentSet.meta.changes > 0 ? 'filled' : 'busy';
	} catch (problem) {
		// The message, written out: an error passed to console.error reaches Workers Logs as its stack alone.
		const message = problem instanceof Error ? `${problem.message}${problem.cause instanceof Error ? ` (${problem.cause.message})` : ''}` : String(problem);
		console.error(`Filling the site search tables failed while ${step}: ${message}`);
		await finish().run();
		throw problem;
	}
}

/** "Every word is in this text", for SQL, with the words as parameters ?1 to ?n. */
function containsAll(column: string, count: number): string {
	return Array.from({ length: count }, (_, index) => `instr(${column}, ?${index + 1}) > 0`).join(' AND ');
}

/** "Some word of the name starts with each word", for SQL; `words` holds the name's words between spaces. */
function wordStarts(count: number): string {
	return Array.from({ length: count }, (_, index) => `instr(words, ' ' || ?${index + 1}) > 0`).join(' AND ');
}

/**
 * The panel's answer for the words typed, from the tables: each group's first
 * `perGroup` matches and how many it has, as the device would give them. A
 * name's score follows nameScore; the title counts when it matches, then the
 * best other name, then the best set's name, then the detail line, and ties
 * keep the index's order, as searchEntries does.
 */
export async function querySearchTables(database: D1Database, query: string, perGroup: number): Promise<PanelAnswer> {
	const search = searchStatements(database, query, perGroup);
	return search.read(search.statements.length > 0 ? await database.batch<SearchRow>(search.statements) : []);
}

type SearchRow = { kind?: SearchKind; result: string; rank?: number; shown?: string | null; total: number };

/** The statements that search the tables for the words typed, and how to read their rows as the panel's answer. */
function searchStatements(database: D1Database, query: string, perGroup: number): { statements: D1PreparedStatement[]; read: (results: { results: SearchRow[] }[]) => PanelAnswer } {
	const words = wordsOf(query).slice(0, mostWords);
	const documentWords = foldForSearch(query.trim()).split(/\s+/).filter(Boolean).slice(0, mostWords);
	if (words.length === 0) return { statements: [], read: () => ({ total: 0, groups: [] }) };
	const phrase = words.join(' ');
	const count = words.length;
	const phraseParameter = `?${count + 1}`;
	const limitParameter = `?${count + 2}`;
	const entriesSql = `
		WITH scored AS (
			SELECT position, rank, ordinal, shown,
			       CASE WHEN folded = ${phraseParameter} THEN 100
			            WHEN substr(folded, 1, length(${phraseParameter})) = ${phraseParameter} THEN 80
			            WHEN ${wordStarts(count)} THEN 60
			            ELSE 40 END - rank * 10 AS score
			FROM site_search_names WHERE ${containsAll('folded', count)}
		), best AS (
			SELECT position, rank, shown, score FROM (
				SELECT position, rank, shown, score, ROW_NUMBER() OVER (PARTITION BY position ORDER BY rank, score DESC, ordinal) AS pick FROM scored
			) WHERE pick = 1
		), results AS (
			SELECT entries.position, entries.kind, entries.result, best.rank, best.shown, best.score
			FROM best JOIN site_search_entries AS entries ON entries.position = best.position
			UNION ALL
			SELECT position, kind, result, 3, NULL, 10 FROM site_search_entries
			WHERE everything <> '' AND ${containsAll('everything', count)} AND position NOT IN (SELECT position FROM best)
		)
		SELECT kind, result, rank, shown, total FROM (
			SELECT kind, result, rank, shown, COUNT(*) OVER (PARTITION BY kind) AS total,
			       ROW_NUMBER() OVER (PARTITION BY kind ORDER BY score DESC, position) AS place
			FROM results
		) WHERE place <= ${limitParameter} ORDER BY kind, place`;
	const documentsSql = `
		SELECT result, total FROM (
			SELECT result, position, COUNT(*) OVER () AS total FROM site_search_documents WHERE ${containsAll('words', documentWords.length)}
		) ORDER BY position LIMIT ?${documentWords.length + 1}`;
	const statements = [
		database.prepare(entriesSql).bind(...words, phrase, perGroup),
		documentWords.length > 0 ? database.prepare(documentsSql).bind(...documentWords, perGroup) : database.prepare('SELECT 1 AS result, 0 AS total WHERE 0')
	];
	return { statements, read: ([entryRows, documentRows]) => panelAnswerFrom(entryRows.results, documentRows.results) };
}

function panelAnswerFrom(entryRows: SearchRow[], documentRows: SearchRow[]): PanelAnswer {
	const found = new Map<ResultGroup, { count: number; results: PanelResult[] }>();
	for (const row of entryRows) {
		const group = row.kind as ResultGroup;
		const result = JSON.parse(row.result) as PanelResult;
		if (row.rank === otherNameRank && row.shown) result.matchedName = row.shown;
		if (row.rank === setRank && row.shown) result.matchedGroup = row.shown;
		const list = found.get(group) ?? { count: row.total, results: [] };
		list.results.push(result);
		found.set(group, list);
	}
	if (documentRows.length > 0) {
		found.set('document', { count: documentRows[0].total, results: documentRows.map((row) => JSON.parse(row.result) as PanelResult) });
	}
	const groups = resultGroups.flatMap((group) => {
		const list = found.get(group);
		return list ? [{ group, ...list }] : [];
	});
	return { total: groups.reduce((total, group) => total + group.count, 0), groups };
}

/**
 * The panel's answer, if the tables hold this build's index and the
 * restrictions in force, in one trip to the database: the restrictions'
 * stamp, the tables' key and the search go in one batch, and the search's
 * rows are used only when the key matches. Otherwise the answer is the
 * restrictions' stamp, for filling the tables.
 */
export async function answerWhenReady(
	database: D1Database,
	indexVersion: string,
	query: string,
	perGroup: number
): Promise<{ ready: true; answer: PanelAnswer } | { ready: false; stamp: string | undefined }> {
	const search = searchStatements(database, query, perGroup);
	const [stampRows, keyRows, ...searchRows] = await database.batch<Record<string, unknown>>([
		database.prepare(restrictionStampSql),
		database.prepare("SELECT value FROM site_search_state WHERE name = 'key'"),
		...search.statements
	]);
	const stamp = restrictionStamp(stampRows.results[0] as unknown as RestrictionStampRow | undefined);
	const key = keyRows.results[0]?.value;
	if (key !== searchTablesKey(indexVersion, stamp)) return { ready: false, stamp };
	return { ready: true, answer: search.read(searchRows as unknown as { results: SearchRow[] }[]) };
}
