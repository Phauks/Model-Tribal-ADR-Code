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

/** Entries written per statement, so each stays well under D1's limits on a statement's size. */
const entriesPerStatement = 1000;

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

function chunks<Item>(items: Item[], size: number): Item[][] {
	const parts: Item[][] = [];
	for (let start = 0; start < items.length; start += size) parts.push(items.slice(start, start + size));
	return parts;
}

/**
 * Fills the tables from the files as readers get them, unless another fill
 * started less than two minutes ago. Nothing is written when the files are
 * the same as last time; only the key changes. The rows are replaced in one
 * batch, which D1 runs as one transaction, so a query never sees half of them.
 */
export async function fillSearchTables(database: D1Database, key: string, entries: SearchEntry[], records: SearchRecords, now = Date.now()): Promise<'filled' | 'unchanged' | 'busy'> {
	const started = Number((await stateOf(database, 'filling')) ?? 0);
	if (started && now - started < fillTimeout) return 'busy';
	await database.prepare("INSERT INTO site_search_state (name, value) VALUES ('filling', ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").bind(String(now)).run();
	try {
		// The device lists a nation only when its record is in the records file (matchEverything).
		const nationLinks = new Set(records.nations.map((row) => row.link));
		const listed = entries.filter((entry) => entry.kind !== 'nation' || nationLinks.has(entry.link));
		const content = await sha256(JSON.stringify([listed, records.documents]));
		const statements: D1PreparedStatement[] = [];
		const setState = (name: string, value: string) =>
			database.prepare('INSERT INTO site_search_state (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value').bind(name, value);
		if ((await stateOf(database, 'content')) !== content) {
			statements.push(database.prepare('DELETE FROM site_search_names'), database.prepare('DELETE FROM site_search_entries'), database.prepare('DELETE FROM site_search_documents'));
			const entryRows: [number, SearchKind, string, string][] = [];
			const nameRows: [number, number, number, string | null, string, string][] = [];
			listed.forEach((entry, position) => {
				const item = prepare(entry);
				entryRows.push([position, entry.kind, JSON.stringify(panelResult({ ...entry, score: 0 })), item.everything]);
				let ordinal = 0;
				const words = (name: { words: string[] }) => ` ${name.words.join(' ')} `;
				nameRows.push([position, titleRank, ordinal++, null, item.title.folded, words(item.title)]);
				for (const name of item.also) nameRows.push([position, otherNameRank, ordinal++, name.name, name.folded, words(name)]);
				for (const group of item.groups) for (const name of group.names) nameRows.push([position, setRank, ordinal++, group.shown, name.folded, words(name)]);
			});
			for (const part of chunks(entryRows, entriesPerStatement)) {
				statements.push(
					database
						.prepare(
							`INSERT INTO site_search_entries (position, kind, result, everything)
							 SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]') FROM json_each(?)`
						)
						.bind(JSON.stringify(part))
				);
			}
			for (const part of chunks(nameRows, entriesPerStatement)) {
				statements.push(
					database
						.prepare(
							`INSERT INTO site_search_names (position, rank, ordinal, shown, folded, words)
							 SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]') FROM json_each(?)`
						)
						.bind(JSON.stringify(part))
				);
			}
			const documentRows = records.documents.map((row, position) => [
				position,
				JSON.stringify(documentResult(row)),
				foldForSearch(`${row.title} ${row.kindLabel} ${row.year ?? ''} ${row.nationName}`)
			]);
			for (const part of chunks(documentRows, entriesPerStatement)) {
				statements.push(
					database
						.prepare(
							`INSERT INTO site_search_documents (position, result, words)
							 SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]') FROM json_each(?)`
						)
						.bind(JSON.stringify(part))
				);
			}
			statements.push(setState('content', content));
		}
		statements.push(setState('key', key), database.prepare("DELETE FROM site_search_state WHERE name = 'filling'"));
		await database.batch(statements);
		return statements.length > 2 ? 'filled' : 'unchanged';
	} catch (problem) {
		await database.prepare("DELETE FROM site_search_state WHERE name = 'filling'").run();
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
