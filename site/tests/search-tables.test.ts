import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';

// Story credits format citations through a module the site build makes; the index doesn't need it.
vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));

import { answerWhenReady, fillSearchTables, querySearchTables, searchTablesKey, searchTablesReady } from '#lib/server/search-tables.ts';
import { searchIndex } from '#lib/server/search-index.ts';
import { searchRecords } from '#lib/server/search-records.ts';
import { expandRecords, type SearchRecords } from '#lib/search-records.ts';
import { matchEverything, panelAnswer } from '#lib/search-everything.ts';
import type { SearchEntry } from '#lib/site-search.ts';
import { testDatabase } from './database.ts';

const perGroup = 5;
let entries: SearchEntry[];
let records: SearchRecords;
let database: D1Database;

beforeAll(async () => {
	entries = searchIndex();
	records = expandRecords(searchRecords());
	database = testDatabase();
	expect(await fillSearchTables(database, searchTablesKey('build-1', undefined), entries, records)).toBe('filled');
}, 120_000);

describe('the search tables', () => {
	// Words that reach every rule: titles, other names, sets, detail lines, initialisms, accents, documents, and nothing.
	const queries = [
		'c',
		'ch',
		'cherokee',
		'cherokee nation v georgia',
		'navajo',
		'navajo nation constitution',
		'25 usc 1901',
		'25 U.S.C. § 1901',
		'icwa',
		'marshall trilogy',
		'landmark',
		'peacemaking',
		'PEÁCEMAKING',
		'ᏣᎳᎩ',
		'alaska village',
		'gaming compact',
		'oklahoma',
		'john marshall',
		'v.',
		'zzzz nothing'
	];

	it.each(queries)('answer “%s” as the device does', async (query) => {
		const device = panelAnswer(matchEverything(entries, records, query), perGroup);
		const server = await querySearchTables(database, query, perGroup);
		expect(JSON.parse(JSON.stringify(server))).toEqual(JSON.parse(JSON.stringify(device)));
	});

	it('know which build and restrictions they hold', async () => {
		expect(await searchTablesReady(database, searchTablesKey('build-1', undefined))).toBe(true);
		expect(await searchTablesReady(database, searchTablesKey('build-1', '3-2026-11-27'))).toBe(false);
		expect(await searchTablesReady(database, searchTablesKey('build-2', undefined))).toBe(false);
	});

	it('only change the key when the files are the same', async () => {
		expect(await fillSearchTables(database, searchTablesKey('build-2', undefined), entries, records)).toBe('unchanged');
		expect(await searchTablesReady(database, searchTablesKey('build-2', undefined))).toBe(true);
	});

	it('leave out what a refill leaves out, such as an entry a nation hid', async () => {
		const hidden = entries.find((entry) => entry.kind === 'case');
		if (!hidden) throw new Error('No case in the index');
		const fewer = entries.filter((entry) => entry !== hidden);
		expect(await fillSearchTables(database, searchTablesKey('build-2', '1-2026-11-27'), fewer, records)).toBe('filled');
		const server = await querySearchTables(database, hidden.title, 1000);
		expect(server.groups.flatMap((group) => group.results).some((result) => result.link === hidden.link)).toBe(false);
		expect(JSON.parse(JSON.stringify(server))).toEqual(JSON.parse(JSON.stringify(panelAnswer(matchEverything(fewer, records, hidden.title), 1000))));
	});

	it('do not start a second fill while one is running', async () => {
		await database.prepare("INSERT INTO site_search_state (name, value) VALUES ('filling', ?)").bind(String(Date.now())).run();
		expect(await fillSearchTables(database, searchTablesKey('build-3', undefined), entries, records)).toBe('busy');
		await database.prepare("DELETE FROM site_search_state WHERE name = 'filling'").run();
	});
	it('answer in one trip only while the key matches the build and the restrictions', async () => {
		const fresh = testDatabase();
		await fillSearchTables(fresh, searchTablesKey('build-9', undefined), entries, records);
		const ready = await answerWhenReady(fresh, 'build-9', 'navajo', perGroup);
		expect(ready.ready).toBe(true);
		if (ready.ready) expect(JSON.parse(JSON.stringify(ready.answer))).toEqual(JSON.parse(JSON.stringify(panelAnswer(matchEverything(entries, records, 'navajo'), perGroup))));
		expect(await answerWhenReady(fresh, 'build-10', 'navajo', perGroup)).toEqual({ ready: false, stamp: undefined });
		// A nation saves its restrictions: the tables no longer answer until they are filled for the new stamp.
		await fresh.prepare('PRAGMA foreign_keys = OFF').run();
		await fresh
			.prepare("INSERT INTO nation_restriction_changes (identifier, nation_identifier, settings, changes, made_by, made_at) VALUES ('change-1', 'navajo-nation', '{}', '[]', 'someone', '2026-11-27T03:40:00Z')")
			.run();
		expect(await answerWhenReady(fresh, 'build-9', 'navajo', perGroup)).toEqual({ ready: false, stamp: '1-2026-11-27T03:40:00Z' });
		expect(await answerWhenReady(fresh, 'build-9', '', perGroup)).toEqual({ ready: false, stamp: '1-2026-11-27T03:40:00Z' });
	});
});
