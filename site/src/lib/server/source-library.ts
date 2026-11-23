/**
 * The source library in the workspace (decision record 0051): the text of
 * every document in the private bucket, page by page, searchable by the
 * project's writers. It lives in its own D1 database, model-tribal-adr-code-
 * library (binding sourceLibrary), loaded from the library that
 * scripts/library/build_library.py builds. Each build writes the changes since
 * the last one as SQL files in the bucket under _library/d1/, and the hourly
 * run below applies them in order, so the website's copy follows the library
 * without anyone loading it by hand.
 *
 * The library holds text from private copies (journal articles, Westlaw
 * prints, copies taken from the National Indian Law Library), so only the
 * writing team may search it (the search-source-library permission), and an
 * original is downloaded only through the document it belongs to.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { matchEnd, matchStart } from '../source-library-text.ts';

/** How many documents a search lists, and passages shown for each. */
export const resultsPerPage = 20;
export const passagesPerDocument = 3;
/** How many passages a document's reading page shows at once. */
export const passagesPerScreen = 30;

export interface LibraryFilters {
	query: string;
	nation?: string;
	topic?: string;
	format?: string;
	/** Only documents the website serves at /copies/. */
	served?: boolean;
	/** 0 for the first page of results. */
	page?: number;
}

export interface LibraryPassage {
	passageId: number;
	page: number | null;
	label: string | null;
	part: number;
	excerpt: string;
}

export interface LibraryDocumentSummary {
	documentId: number;
	key: string;
	title: string;
	citation: string | null;
	court: string | null;
	decided: string | null;
	topic: string;
	nations: string[];
	records: string[];
	served: boolean;
	textStatus: string;
	pageCount: number | null;
}

export interface LibraryResult extends LibraryDocumentSummary {
	passages: LibraryPassage[];
}

export interface LibraryDocument extends LibraryDocumentSummary {
	otherKeys: string[];
	format: string | null;
	mediaType: string | null;
	link: string | null;
	captured: string | null;
	obtained: string | null;
	rights: string | null;
	characters: number | null;
	ocrPages: number;
	emptyPages: number;
	passageCount: number;
}

export interface LibraryPage {
	passageId: number;
	sequence: number;
	page: number | null;
	label: string | null;
	part: number;
	method: string | null;
	text: string;
}

export interface LibraryStatus {
	/** The build the website's copy holds, or null before the first load. */
	build: string | null;
	/** The newest build in the bucket, when known. */
	newest: string | null;
	documents: number;
	applying: string | null;
}

/**
 * A search box's words as an FTS5 query. Text that uses the query language
 * ("phrases", OR, NOT, NEAR(), prefix*) is passed on; anything else becomes
 * quoted words, all required, so punctuation such as "25 U.S.C. § 1302"
 * cannot break the query.
 */
export function plainQuery(text: string): string {
	const words = text.normalize('NFC').match(/[\p{L}\p{N}§.'’-]+/gu) ?? [];
	return words
		.map((word) => word.replace(/^[.'’-]+|[.'’-]+$/g, ''))
		.filter((word) => word.length > 0)
		.map((word) => `"${word.replaceAll('"', '""')}"`)
		.join(' ');
}

function splitList(value: string | null): string[] {
	return (value ?? '').split(';').filter((item) => item !== '');
}

interface DocumentRow {
	document_id: number;
	key: string;
	title: string | null;
	citation: string | null;
	court: string | null;
	decided: string | null;
	topic: string;
	nations: string | null;
	records: string | null;
	served: number;
	text_status: string;
	page_count: number | null;
}

function summary(row: DocumentRow): LibraryDocumentSummary {
	return {
		documentId: row.document_id,
		key: row.key,
		title: row.title ?? row.key,
		citation: row.citation,
		court: row.court,
		decided: row.decided,
		topic: row.topic,
		nations: splitList(row.nations),
		records: splitList(row.records),
		served: row.served === 1,
		textStatus: row.text_status,
		pageCount: row.page_count
	};
}

function filterClauses(filters: LibraryFilters): { sql: string; values: (string | number)[] } {
	const clauses: string[] = [];
	const values: (string | number)[] = [];
	if (filters.nation) {
		clauses.push('d.document_id IN (SELECT document_id FROM document_nations WHERE nation = ?)');
		values.push(filters.nation);
	}
	if (filters.topic) {
		clauses.push('d.topic = ?');
		values.push(filters.topic);
	}
	if (filters.format) {
		clauses.push('d.format = ?');
		values.push(filters.format);
	}
	if (filters.served) clauses.push('d.served = 1');
	return { sql: clauses.map((clause) => ` AND ${clause}`).join(''), values };
}

/**
 * Passages matching the search, best first, a few per document, one page of
 * documents at a time. Returns the documents and whether there may be more.
 */
export async function searchLibrary(
	database: D1Database,
	filters: LibraryFilters
): Promise<{ results: LibraryResult[]; more: boolean; readAs: string | null }> {
	const page = Math.max(0, filters.page ?? 0);
	const { sql: where, values } = filterClauses(filters);
	const statement = (query: string) =>
		database
			.prepare(
				`WITH hits AS (
				   SELECT p.passage_id, p.document_id, p.page, p.label, p.part,
				          snippet(pages_search, 0, '${matchStart}', '${matchEnd}', ' … ', 40) AS excerpt,
				          bm25(pages_search) AS score
				   FROM pages_search JOIN pages p ON p.passage_id = pages_search.rowid
				   JOIN documents d ON d.document_id = p.document_id
				   WHERE pages_search MATCH ?${where}
				   ORDER BY score LIMIT 2000
				 ), ranked AS (
				   SELECT hits.*, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY score) AS place,
				          MIN(score) OVER (PARTITION BY document_id) AS best
				   FROM hits
				 ), chosen AS (
				   SELECT document_id, best FROM ranked WHERE place = 1 ORDER BY best, document_id LIMIT ? OFFSET ?
				 )
				 SELECT ranked.passage_id, ranked.page, ranked.label, ranked.part, ranked.excerpt, chosen.best,
				        d.document_id, d.key, d.title, d.citation, d.court, d.decided, d.topic, d.nations, d.records,
				        d.served, d.text_status, d.page_count
				 FROM chosen JOIN ranked ON ranked.document_id = chosen.document_id AND ranked.place <= ?
				 JOIN documents d ON d.document_id = chosen.document_id
				 ORDER BY chosen.best, d.document_id, ranked.place`
			)
			.bind(query, ...values, resultsPerPage + 1, page * resultsPerPage, passagesPerDocument);

	type Row = DocumentRow & { passage_id: number; page: number | null; label: string | null; part: number; excerpt: string };
	let readAs: string | null = null;
	let rows: Row[];
	try {
		rows = (await statement(filters.query).all<Row>()).results;
	} catch {
		// Not valid in the query language: search the words themselves.
		readAs = plainQuery(filters.query);
		if (readAs === '') return { results: [], more: false, readAs };
		rows = (await statement(readAs).all<Row>()).results;
	}

	const byDocument = new Map<number, LibraryResult>();
	for (const row of rows) {
		let result = byDocument.get(row.document_id);
		if (!result) {
			result = { ...summary(row), passages: [] };
			byDocument.set(row.document_id, result);
		}
		result.passages.push({
			passageId: row.passage_id,
			page: row.page,
			label: row.label,
			part: row.part,
			excerpt: row.excerpt.replace(/\s+/g, ' ').trim()
		});
	}
	const results = [...byDocument.values()];
	return { results: results.slice(0, resultsPerPage), more: results.length > resultsPerPage, readAs };
}

/** Documents whose title, citation, nations or key match, for "find a document". */
export async function findLibraryDocuments(database: D1Database, query: string, limit = 20): Promise<LibraryDocumentSummary[]> {
	const statement = (text: string) =>
		database
			.prepare(
				`SELECT d.* FROM documents_search JOIN documents d ON d.document_id = documents_search.rowid
				 WHERE documents_search MATCH ? ORDER BY bm25(documents_search) LIMIT ?`
			)
			.bind(text, limit);
	try {
		return (await statement(query).all<DocumentRow>()).results.map(summary);
	} catch {
		const plain = plainQuery(query);
		return plain === '' ? [] : (await statement(plain).all<DocumentRow>()).results.map(summary);
	}
}

export async function libraryDocument(database: D1Database, documentId: number): Promise<LibraryDocument | null> {
	const row = await database
		.prepare(
			`SELECT d.*, (SELECT COUNT(*) FROM pages WHERE document_id = d.document_id) AS passage_count
			 FROM documents d WHERE d.document_id = ?`
		)
		.bind(documentId)
		.first<
			DocumentRow & {
				other_keys: string | null;
				format: string | null;
				media_type: string | null;
				link: string | null;
				captured: string | null;
				obtained: string | null;
				rights: string | null;
				characters: number | null;
				ocr_pages: number;
				empty_pages: number;
				passage_count: number;
			}
		>();
	if (!row) return null;
	let otherKeys: string[] = [];
	try {
		otherKeys = row.other_keys ? (JSON.parse(row.other_keys) as string[]) : [];
	} catch {
		otherKeys = [];
	}
	return {
		...summary(row),
		otherKeys,
		format: row.format,
		mediaType: row.media_type,
		link: row.link,
		captured: row.captured,
		obtained: row.obtained,
		rights: row.rights,
		characters: row.characters,
		ocrPages: row.ocr_pages,
		emptyPages: row.empty_pages,
		passageCount: row.passage_count
	};
}

/** A run of a document's passages, from the given place in the document (1 is the first). */
export async function libraryPages(
	database: D1Database,
	documentId: number,
	from: number,
	count = passagesPerScreen
): Promise<LibraryPage[]> {
	const rows = await database
		.prepare(
			`SELECT passage_id, sequence, page, label, part, method, text FROM pages
			 WHERE document_id = ? AND sequence >= ? ORDER BY sequence LIMIT ?`
		)
		.bind(documentId, Math.max(1, from), count)
		.all<{ passage_id: number; sequence: number; page: number | null; label: string | null; part: number; method: string | null; text: string }>();
	return rows.results.map((row) => ({
		passageId: row.passage_id,
		sequence: row.sequence,
		page: row.page,
		label: row.label,
		part: row.part,
		method: row.method,
		text: row.text
	}));
}

/** Where a passage sits in its document, to open the reading page there. */
export async function passagePlace(database: D1Database, passageId: number): Promise<{ documentId: number; sequence: number } | null> {
	const row = await database
		.prepare('SELECT document_id, sequence FROM pages WHERE passage_id = ?')
		.bind(passageId)
		.first<{ document_id: number; sequence: number }>();
	return row ? { documentId: row.document_id, sequence: row.sequence } : null;
}

/** The first passage on a PDF page or a printed or star page. */
export async function pagePlace(
	database: D1Database,
	documentId: number,
	page: { number?: number; label?: string }
): Promise<number | null> {
	const row =
		page.number !== undefined
			? await database
					.prepare('SELECT MIN(sequence) AS sequence FROM pages WHERE document_id = ? AND page = ?')
					.bind(documentId, page.number)
					.first<{ sequence: number | null }>()
			: await database
					.prepare('SELECT MIN(sequence) AS sequence FROM pages WHERE document_id = ? AND label = ?')
					.bind(documentId, page.label ?? '')
					.first<{ sequence: number | null }>();
	return row?.sequence ?? null;
}

/** The topics (bucket folders) with their document counts, for the filter. */
export async function libraryTopics(database: D1Database): Promise<{ topic: string; documents: number }[]> {
	const rows = await database
		.prepare('SELECT topic, COUNT(*) AS documents FROM documents GROUP BY topic ORDER BY documents DESC, topic')
		.all<{ topic: string; documents: number }>();
	return rows.results;
}

async function metaValue(database: D1Database, name: string): Promise<string | null> {
	try {
		const row = await database.prepare('SELECT value FROM meta WHERE name = ?').bind(name).first<{ value: string }>();
		return row?.value ?? null;
	} catch {
		return null; // before the first load there is no meta table
	}
}

export async function libraryStatus(database: D1Database): Promise<LibraryStatus> {
	const build = await metaValue(database, 'build');
	let documents = 0;
	if (build) {
		const row = await database.prepare('SELECT COUNT(*) AS documents FROM documents').first<{ documents: number }>();
		documents = row?.documents ?? 0;
	}
	return { build, newest: await metaValue(database, 'newest_build'), documents, applying: await metaValue(database, 'applying') };
}

// ------------------------------------------------------------- keeping up to date

const changesPrefix = '_library/d1/';

interface ChangeSet {
	from: string;
	to: string;
	parts: string[];
}

interface LatestChanges {
	build: string;
	chain: ChangeSet[];
	load_whole?: boolean;
}

export interface LibraryRunSummary {
	build: string | null;
	newest: string | null;
	partsApplied: number;
	note: string;
}

/**
 * The hourly run: apply the next change files from the bucket, in order,
 * until the copy is current or the time is used up. Progress is kept in the
 * meta table (applying = "<build>:<parts done>"), so a run that stops part way
 * picks up where it left off. Each part removes a document before adding it,
 * so a part applied twice leaves the same result.
 */
export async function applyLibraryChanges(
	database: D1Database,
	bucket: R2Bucket,
	budgetMilliseconds = 20_000
): Promise<LibraryRunSummary> {
	const started = Date.now();
	const latestObject = await bucket.get(`${changesPrefix}latest.json`);
	if (!latestObject) return { build: null, newest: null, partsApplied: 0, note: 'No library has been published.' };
	const latest = (await latestObject.json()) as LatestChanges;
	let build = await metaValue(database, 'build');
	let partsApplied = 0;
	if (build) await database.prepare("INSERT OR REPLACE INTO meta VALUES ('newest_build', ?)").bind(latest.build).run();

	while (build !== latest.build) {
		// The newest link from where the copy stands: after a reload from empty
		// there can be more than one link from an empty database.
		const next = latest.chain.findLast((link) => link.from === (build ?? ''));
		if (!next) {
			return {
				build,
				newest: latest.build,
				partsApplied,
				note: build
					? `No change files lead on from build ${build}: empty the library database and run build_library.py publish --d1-whole (scripts/README.md, "Source library").`
					: 'The library has not been loaded yet: run build_library.py publish --d1-whole (scripts/README.md, "Source library").'
			};
		}
		const applying = await metaValue(database, 'applying');
		let done = applying?.startsWith(`${next.to}:`) ? Number(applying.slice(next.to.length + 1)) || 0 : 0;
		for (; done < next.parts.length; done += 1) {
			if (Date.now() - started > budgetMilliseconds) {
				return { build, newest: latest.build, partsApplied, note: `Stopped for time at part ${done} of ${next.parts.length}.` };
			}
			const part = await bucket.get(next.parts[done]);
			if (!part) throw new Error(`The library change file ${next.parts[done]} is missing.`);
			await database.exec(await part.text());
			partsApplied += 1;
			await database.prepare("INSERT OR REPLACE INTO meta VALUES ('applying', ?)").bind(`${next.to}:${done + 1}`).run();
		}
		await database.prepare("DELETE FROM meta WHERE name = 'applying'").run();
		build = await metaValue(database, 'build');
		if (build !== next.to) throw new Error(`The change files for ${next.to} did not finish with that build.`);
		await database.prepare("INSERT OR REPLACE INTO meta VALUES ('newest_build', ?)").bind(latest.build).run();
	}
	return { build, newest: latest.build, partsApplied, note: partsApplied === 0 ? 'Up to date.' : 'Applied.' };
}
