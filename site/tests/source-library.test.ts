import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { describe, expect, it } from 'vitest';
import {
	applyLibraryChanges,
	findLibraryDocuments,
	libraryDocument,
	libraryPages,
	libraryStatus,
	pagePlace,
	plainQuery,
	searchLibrary
} from '#lib/server/source-library.ts';
import { documentHeading, excerptPieces, matchEnd, matchStart, placeLabel } from '#lib/source-library-text.ts';

// The fixtures are change files written by scripts/library/build_library.py
// for a two-document library (a saved peacemaking code page and an article),
// then for a second build in which the code page gained a section.
const fixtures = path.resolve(import.meta.dirname, 'fixtures/source-library');
const firstBuild = readFileSync(path.join(fixtures, 'first-build.sql'), 'utf8');
const secondBuild = readFileSync(path.join(fixtures, 'second-build.sql'), 'utf8');
const firstBuildName = '2026-11-23T05:16:43+00:00';
const secondBuildName = '2026-11-23T05:16:51+00:00';

type Value = string | number | null;

/** D1 in tests: Node's SQLite with prepare, bind, first, all, run, batch and exec. */
function libraryDatabase(): D1Database {
	const database = new DatabaseSync(':memory:');
	type Statement = { sql: string; values: Value[] };
	const statement = (sql: string, values: Value[] = []) => ({
		sql,
		values,
		bind: (...more: Value[]) => statement(sql, more),
		first: async () => database.prepare(sql).get(...values) ?? null,
		all: async () => ({ results: database.prepare(sql).all(...values) }),
		run: async () => ({ meta: { changes: Number(database.prepare(sql).run(...values).changes) } })
	});
	return {
		prepare: (sql: string) => statement(sql),
		// Like D1, a batch is one transaction: all of it or none of it.
		batch: async (statements: Statement[]) => {
			database.exec('BEGIN');
			try {
				const results = statements.map(({ sql, values }) => ({
					meta: { changes: Number(database.prepare(sql).run(...values).changes) }
				}));
				database.exec('COMMIT');
				return results;
			} catch (problem) {
				database.exec('ROLLBACK');
				throw problem;
			}
		},
		exec: async (sql: string) => {
			database.exec(sql);
			return { count: 0, duration: 0 };
		}
	} as unknown as D1Database;
}

/** A bucket holding the change files a build left, as R2 would. */
function changesBucket(objects: Record<string, string>): R2Bucket {
	return {
		get: async (key: string) =>
			key in objects
				? { text: async () => objects[key], json: async () => JSON.parse(objects[key]) as unknown }
				: null
	} as unknown as R2Bucket;
}

const chain = (links: { from: string; to: string; parts: string[] }[], build: string) =>
	JSON.stringify({ build, chain: links });

async function loadedLibrary(): Promise<D1Database> {
	const database = libraryDatabase();
	await database.exec(firstBuild);
	return database;
}

describe('searching the source library', () => {
	it('finds passages by stemmed words and proximity, with the matched words marked', async () => {
		const database = await loadedLibrary();
		const { results, more, readAs, total } = await searchLibrary(database, { query: 'peacemaker NEAR(elders, 20)' });
		expect(readAs).toBeNull();
		expect(more).toBe(false);
		expect(results).toHaveLength(1);
		expect(total).toEqual({ passages: results[0].passages.length, documents: 1, more: false });
		expect(results[0].title).toBe('Sample Peacemaking Code');
		expect(results[0].topic).toBe('peacemaking');
		const excerpt = results[0].passages[0].excerpt;
		expect(excerpt).toContain(`${matchStart}peacemaker${matchEnd}`);
		expect(excerptPieces(excerpt).filter((piece) => piece.matched).map((piece) => piece.text)).toContain('elders');
	});

	it('reads punctuated text as plain words instead of failing', async () => {
		const database = await loadedLibrary();
		const { results, readAs } = await searchLibrary(database, { query: '25 U.S.C. 2710' });
		expect(readAs).toBe('"25" "U.S.C" "2710"');
		expect(results.map((result) => result.title)).toEqual(['sample-article.txt']);
		expect(results[0].passages[0].page).toBe(2);
	});

	it('filters by kind of source', async () => {
		const database = await loadedLibrary();
		const none = await searchLibrary(database, { query: 'arbitration', topic: 'peacemaking' });
		expect(none.results).toEqual([]);
		expect(none.total).toEqual({ passages: 0, documents: 0, more: false });
		expect((await searchLibrary(database, { query: 'arbitration', topic: 'articles' })).results).toHaveLength(1);
	});

	it('finds documents by title', async () => {
		const database = await loadedLibrary();
		expect((await findLibraryDocuments(database, 'peacemaking code')).map((document) => document.key)).toEqual([
			'peacemaking/sample-code.html'
		]);
	});

	it('reads a document page by page', async () => {
		const database = await loadedLibrary();
		const article = (await findLibraryDocuments(database, 'article'))[0];
		const document = await libraryDocument(database, article.documentId);
		expect(document?.passageCount).toBe(2);
		expect(document?.pageCount).toBe(2);
		const sequence = await pagePlace(database, article.documentId, { number: 2 });
		const pages = await libraryPages(database, article.documentId, sequence ?? 1);
		expect(pages[0].text).toContain('waiver of sovereign immunity');
		expect(placeLabel(pages[0])).toBe('PDF page 2');
	});

	it('turns a free-text box into quoted words', () => {
		expect(plainQuery('Navajo “peacemaking” § 409.')).toBe('"Navajo" "peacemaking" "§" "409"');
		expect(plainQuery('   ')).toBe('');
	});

	it('writes places and headings the way a writer cites them', () => {
		expect(placeLabel({ page: null, label: '442', part: 1 })).toBe('star page *442');
		expect(placeLabel({ page: 12, label: '45', part: 2 })).toBe('PDF page 12, printed page 45, part 2');
		expect(
			documentHeading({ title: 'Beardsley v. Blackman', citation: '1 Am. Tribal Law 438', court: 'Navajo Nation Supreme Court', decided: '1997-03-01' })
		).toBe('Beardsley v. Blackman, 1 Am. Tribal Law 438 (Navajo Nation Supreme Court 1997)');
	});
});

describe('keeping the website’s copy up to date', () => {
	it('says the library needs loading whole before its first load', async () => {
		const database = libraryDatabase();
		const bucket = changesBucket({ '_library/d1/latest.json': JSON.stringify({ build: firstBuildName, chain: [], load_whole: true }) });
		const summary = await applyLibraryChanges(database, bucket);
		expect(summary.build).toBeNull();
		expect(summary.note).toMatch(/publish --d1-whole/);
		expect((await libraryStatus(database)).build).toBeNull();
	});

	it('applies the next build’s change files and replaces the changed document', async () => {
		const database = await loadedLibrary();
		const bucket = changesBucket({
			'_library/d1/latest.json': chain([{ from: firstBuildName, to: secondBuildName, parts: ['_library/d1/changes/b/part-00001.sql'] }], secondBuildName),
			'_library/d1/changes/b/part-00001.sql': secondBuild
		});
		const summary = await applyLibraryChanges(database, bucket);
		expect(summary).toMatchObject({ build: secondBuildName, newest: secondBuildName, partsApplied: 1 });
		const { results } = await searchLibrary(database, { query: '"talking circles"' });
		expect(results).toHaveLength(1);
		// The old version's passages are gone from the index as well as the table.
		const before = await searchLibrary(database, { query: 'binding' });
		expect(before.results).toHaveLength(1);
		expect((await libraryStatus(database)).documents).toBe(2);
		expect(await applyLibraryChanges(database, bucket)).toMatchObject({ partsApplied: 0, note: 'Up to date.' });
	});

	it('gives the same result when a part is applied twice', async () => {
		const database = await loadedLibrary();
		await database.exec(secondBuild);
		await database.exec(secondBuild);
		expect((await searchLibrary(database, { query: 'binding' })).results[0].passages).toHaveLength(1);
		expect((await libraryStatus(database)).documents).toBe(2);
	});

	it('stops when no change files lead on from the build it holds', async () => {
		const database = await loadedLibrary();
		const bucket = changesBucket({ '_library/d1/latest.json': chain([], '2026-12-01T00:00:00+00:00') });
		const summary = await applyLibraryChanges(database, bucket);
		expect(summary.build).toBe(firstBuildName);
		expect(summary.note).toMatch(/No change files lead on/);
	});
});
