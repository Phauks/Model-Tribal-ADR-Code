/**
 * Storage for what nations choose the site shows of their own laws and
 * court opinions (src/lib/nation-restrictions.ts; migration
 * 20261124T0905_add_nation_restrictions.sql). The newest saved setting for a
 * nation is the one in force. It takes effect at once, and the project
 * reads each save afterwards in "Nations' changes".
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { pageLogTarget } from '../nation-page-changes.ts';
import {
	describeRestrictionChanges,
	itemLevel,
	noPageRestrictions,
	type CopyRestriction,
	noRestrictions,
	pageRestrictions,
	readSettings,
	restrictsAnything,
	type PageRestrictions,
	type RestrictableItem,
	type RestrictableList,
	type RestrictionChange,
	type RestrictionKind,
	type RestrictionLevel,
	type RestrictionSettings
} from '../nation-restrictions.ts';
import type { SiteRestrictions } from '../restricted-files.ts';
import { activityStatement } from './activity-log.ts';
import { newIdentifier, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';

export interface RestrictionSave {
	identifier: string;
	nationIdentifier: string;
	settings: RestrictionSettings;
	changes: RestrictionChange[];
	note: string | null;
	madeBy: string;
	madeByName: string | null;
	madeAt: string;
	readByName: string | null;
	readAt: string | null;
	readNote: string | null;
	question: string | null;
	askedByName: string | null;
	askedAt: string | null;
	answer: string | null;
	answeredByName: string | null;
	answeredAt: string | null;
}

interface StoredSave extends Omit<RestrictionSave, 'settings' | 'changes'> {
	settings: string;
	changes: string;
}

const columns = `nation_restriction_changes.identifier, nation_restriction_changes.nation_identifier AS nationIdentifier,
	nation_restriction_changes.settings, nation_restriction_changes.changes, nation_restriction_changes.note,
	nation_restriction_changes.made_by AS madeBy, maker.display_name AS madeByName, nation_restriction_changes.made_at AS madeAt,
	reader.display_name AS readByName, nation_restriction_changes.read_at AS readAt, nation_restriction_changes.read_note AS readNote,
	nation_restriction_changes.question, asker.display_name AS askedByName, nation_restriction_changes.asked_at AS askedAt,
	nation_restriction_changes.answer, answerer.display_name AS answeredByName, nation_restriction_changes.answered_at AS answeredAt`;

const tables = `nation_restriction_changes
	LEFT JOIN people AS maker ON maker.identifier = nation_restriction_changes.made_by
	LEFT JOIN people AS reader ON reader.identifier = nation_restriction_changes.read_by
	LEFT JOIN people AS asker ON asker.identifier = nation_restriction_changes.asked_by
	LEFT JOIN people AS answerer ON answerer.identifier = nation_restriction_changes.answered_by`;

function parse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function fromStored(row: StoredSave): RestrictionSave {
	const changes = parse(row.changes);
	return { ...row, settings: readSettings(parse(row.settings)), changes: Array.isArray(changes) ? (changes as RestrictionChange[]) : [] };
}

/** What a nation has chosen now; a nation that never chose shows everything. */
export async function currentSettings(database: D1Database, nationIdentifier: string): Promise<RestrictionSettings> {
	const row = await database
		.prepare(
			`SELECT settings FROM nation_restriction_changes WHERE nation_identifier = ?
			 ORDER BY made_at DESC, rowid DESC LIMIT 1`
		)
		.bind(nationIdentifier)
		.first<{ settings: string }>();
	return row ? readSettings(parse(row.settings)) : noRestrictions;
}

/** The settings of several nations at once, for a copy that belongs to more than one. */
export async function settingsOf(database: D1Database, nationIdentifiers: readonly string[]): Promise<Map<string, RestrictionSettings>> {
	const settings = new Map<string, RestrictionSettings>();
	if (nationIdentifiers.length === 0) return settings;
	const result = await database
		.prepare(
			`SELECT nation_identifier AS nationIdentifier, settings FROM (
				SELECT nation_identifier, settings,
				       ROW_NUMBER() OVER (PARTITION BY nation_identifier ORDER BY made_at DESC, rowid DESC) AS position
				FROM nation_restriction_changes WHERE nation_identifier IN (SELECT value FROM json_each(?))
			) WHERE position = 1`
		)
		.bind(JSON.stringify(nationIdentifiers))
		.all<{ nationIdentifier: string; settings: string }>();
	for (const row of result.results) settings.set(row.nationIdentifier, readSettings(parse(row.settings)));
	return settings;
}

/** A nation's saves, newest first, for its team's page. */
export async function savesOf(database: D1Database, nationIdentifier: string, limit = 20): Promise<RestrictionSave[]> {
	const result = await database
		.prepare(`SELECT ${columns} FROM ${tables} WHERE nation_restriction_changes.nation_identifier = ? ORDER BY made_at DESC, nation_restriction_changes.rowid DESC LIMIT ?`)
		.bind(nationIdentifier, limit)
		.all<StoredSave>();
	return result.results.map(fromStored);
}

/** Saves the project has not read yet, oldest first. */
export async function unreadSaves(database: D1Database): Promise<RestrictionSave[]> {
	const result = await database
		.prepare(`SELECT ${columns} FROM ${tables} WHERE nation_restriction_changes.read_at IS NULL ORDER BY made_at, nation_restriction_changes.rowid`)
		.all<StoredSave>();
	return result.results.map(fromStored);
}

export async function saveByIdentifier(database: D1Database, identifier: string): Promise<RestrictionSave | undefined> {
	const row = await database.prepare(`SELECT ${columns} FROM ${tables} WHERE nation_restriction_changes.identifier = ?`).bind(identifier).first<StoredSave>();
	return row ? fromStored(row) : undefined;
}

function logStatement(database: D1Database, person: SignedInPerson, nationIdentifier: string, action: string, note: string | null) {
	return activityStatement(database, {
		personIdentifier: person.identifier,
		action,
		targetKind: 'document',
		targetIdentifier: pageLogTarget(nationIdentifier),
		note
	});
}

/** Saves a nation's new setting, in force at once. */
export async function saveSettings(
	database: D1Database,
	nationIdentifier: string,
	settings: RestrictionSettings,
	changes: RestrictionChange[],
	note: string | null,
	person: SignedInPerson,
	time = now()
): Promise<string> {
	const identifier = newIdentifier();
	await database.batch([
		database
			.prepare(
				`INSERT INTO nation_restriction_changes (identifier, nation_identifier, settings, changes, note, made_by, made_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(identifier, nationIdentifier, JSON.stringify(settings), JSON.stringify(changes), note, person.identifier, time),
		logStatement(database, person, nationIdentifier, `Laws and cases: ${describeRestrictionChanges(changes)}`, note)
	]);
	return identifier;
}

export async function markSaveRead(database: D1Database, save: RestrictionSave, person: SignedInPerson, note: string | null, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(`UPDATE nation_restriction_changes SET read_by = ?, read_at = ?, read_note = ? WHERE identifier = ? AND read_at IS NULL`)
			.bind(person.identifier, time, note, save.identifier),
		logStatement(database, person, save.nationIdentifier, `Read by the project: Laws and cases: ${describeRestrictionChanges(save.changes)}`, note)
	]);
}

export async function askTeam(database: D1Database, save: RestrictionSave, question: string, person: SignedInPerson, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(`UPDATE nation_restriction_changes SET question = ?, asked_by = ?, asked_at = ?, answer = NULL, answered_by = NULL, answered_at = NULL WHERE identifier = ?`)
			.bind(question, person.identifier, time, save.identifier),
		logStatement(database, person, save.nationIdentifier, 'The project asked the team about its laws and cases', question)
	]);
}

export async function answerProject(database: D1Database, save: RestrictionSave, answer: string, person: SignedInPerson, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(`UPDATE nation_restriction_changes SET answer = ?, answered_by = ?, answered_at = ? WHERE identifier = ? AND question IS NOT NULL`)
			.bind(answer, person.identifier, time, save.identifier),
		logStatement(database, person, save.nationIdentifier, 'The team answered the project about its laws and cases', answer)
	]);
}

/** A copy as the Worker's list has it (src/lib/server/copy-list.ts): its key and, for a nation's law or opinion, its kind and nations. */
type CopyFacts = { key: string; restrict?: CopyRestriction };

const levelOrder: RestrictionLevel[] = ['show', 'cite', 'hide'];

/** The stricter of two levels. */
export function stricter(first: RestrictionLevel, second: RestrictionLevel): RestrictionLevel {
	return levelOrder.indexOf(second) > levelOrder.indexOf(first) ? second : first;
}

/**
 * How the site may show each of several copies, given the nations each
 * belongs to: the strictest of their choices, so one nation's request is
 * never undone by another's. Copies every nation lets the site show are left
 * out of the map. One query, however many copies.
 */
export async function copyLevels(database: D1Database | undefined, copies: readonly CopyFacts[]): Promise<Map<string, RestrictionLevel>> {
	const levels = new Map<string, RestrictionLevel>();
	const restrictable = copies.filter((copy) => copy.restrict);
	if (!database || restrictable.length === 0) return levels;
	let settings: Map<string, RestrictionSettings>;
	try {
		settings = await settingsOf(database, [...new Set(restrictable.flatMap((copy) => copy.restrict?.nations ?? []))]);
	} catch (problem) {
		// Before the migration runs, or if the database is busy: show as before rather than fail the page.
		console.error('Nation restrictions could not be read', problem);
		return levels;
	}
	if (settings.size === 0) return levels;
	for (const copy of restrictable) {
		const { kind, nations } = copy.restrict as CopyRestriction;
		let level: RestrictionLevel = 'show';
		for (const nation of nations) {
			const chosen = settings.get(nation);
			if (chosen) level = stricter(level, itemLevel(chosen, { id: `copy:${copy.key}`, kind }));
		}
		if (level !== 'show') levels.set(copy.key, level);
	}
	return levels;
}

/** How the site may show one of its copies (copyLevels). */
export async function copyLevel(database: D1Database | undefined, copy: CopyFacts): Promise<RestrictionLevel> {
	return (await copyLevels(database, [copy])).get(copy.key) ?? 'show';
}

/**
 * What a nation's page follows (src/lib/nation-restrictions.ts, PageRestrictions):
 * the nation's own choices and, for a copy that belongs to other nations too,
 * theirs, the strictest winning. One query.
 */
export async function nationPageRestrictions(
	database: D1Database | undefined,
	nationIdentifier: string,
	loadList: () => Promise<RestrictableList>,
	loadCopies: () => Promise<ReadonlyMap<string, CopyFacts>>
): Promise<PageRestrictions> {
	if (!database) return noPageRestrictions;
	try {
		// Most of the time no nation restricts anything, and the list need not be read at all.
		if (!(await database.prepare('SELECT 1 AS found FROM nation_restriction_changes LIMIT 1').first())) return noPageRestrictions;
	} catch (problem) {
		console.error('Nation restrictions could not be read', problem);
		return noPageRestrictions;
	}
	const list = await loadList();
	if (list.items.length === 0) return noPageRestrictions;
	const copies = await loadCopies();
	const copyOf = (item: RestrictableItem) => (item.id.startsWith('copy:') ? copies.get(item.id.slice('copy:'.length)) : undefined);
	const others = list.items.flatMap((item) => copyOf(item)?.restrict?.nations ?? []);
	let settings: Map<string, RestrictionSettings>;
	try {
		settings = await settingsOf(database, [...new Set([nationIdentifier, ...others])]);
	} catch (problem) {
		console.error('Nation restrictions could not be read', problem);
		return noPageRestrictions;
	}
	if (settings.size === 0) return noPageRestrictions;
	const own = settings.get(nationIdentifier) ?? noRestrictions;
	const levelOf = (item: RestrictableItem): RestrictionLevel => {
		let level = itemLevel(own, item);
		const copy = copyOf(item);
		for (const nation of copy?.restrict?.nations ?? []) {
			const chosen = nation === nationIdentifier ? undefined : settings.get(nation);
			if (chosen) level = stricter(level, itemLevel(chosen, item));
		}
		return level;
	};
	return pageRestrictions(list.items, levelOf, own.kinds.opinions ?? 'show');
}

/**
 * Works out the level of every item any nation restricts, the strictest of
 * the nations it belongs to winning, from each nation's setting in force,
 * each restricting nation's list of items (built with the site) and the
 * copies of nations' laws and opinions the site serves (src/lib/server/copy-list.ts), for the files made at
 * build time (src/lib/server/site-restrictions.ts).
 */
export async function gatherRestrictions(
	settings: ReadonlyMap<string, RestrictionSettings>,
	listOf: (nation: string) => Promise<{ items: RestrictableItem[] }>,
	copies: readonly CopyFacts[],
	stamp: string
): Promise<SiteRestrictions | undefined> {
	const restricting = [...settings].filter(([, chosen]) => restrictsAnything(chosen));
	if (restricting.length === 0) return undefined;
	const levels = new Map<string, 'cite' | 'hide'>();
	const items = new Map<string, RestrictableItem>();
	const raise = (id: string, level: RestrictionLevel) => {
		if (level !== 'show') levels.set(id, stricter(levels.get(id) ?? 'show', level) as 'cite' | 'hide');
	};
	// Each document of each restricting nation, with its versions' items.
	const documents = new Map<string, string[]>();
	const lists = await Promise.all(restricting.map(async ([nation, chosen]) => ({ nation, chosen, list: await listOf(nation) })));
	for (const { nation, chosen, list } of lists) {
		for (const item of list.items) {
			if (!items.has(item.id)) items.set(item.id, item);
			raise(item.id, itemLevel(chosen, item));
			if (item.document) {
				const key = `${nation}#${item.document}`;
				documents.set(key, [...(documents.get(key) ?? []), item.id]);
			}
		}
	}
	// A copy that belongs to a restricting nation but is not on its list still follows its kind.
	for (const copy of copies) {
		if (!copy.restrict) continue;
		for (const nation of copy.restrict.nations) {
			const chosen = settings.get(nation);
			if (chosen) raise(`copy:${copy.key}`, itemLevel(chosen, { id: `copy:${copy.key}`, kind: copy.restrict.kind }));
		}
	}
	if (levels.size === 0) return undefined;
	const hiddenDocuments = new Set([...documents].filter(([, ids]) => ids.every((id) => levels.get(id) === 'hide')).map(([key]) => key));
	return { stamp, levels, items, hiddenDocuments };
}

/** A nation's restrictable items, built with the site (src/routes/nations/[id]/restrictable.json). */
export async function restrictableList(nationIdentifier: string, url: URL, fetcher: typeof fetch, assets?: { fetch: (input: string) => Promise<Response> }): Promise<RestrictableList> {
	const address = new URL(`/nations/${encodeURIComponent(nationIdentifier)}/restrictable.json`, url).toString();
	try {
		const response = assets ? await assets.fetch(address) : await fetcher(address);
		if (!response.ok) return { nation: nationIdentifier, items: [] };
		return (await response.json()) as RestrictableList;
	} catch {
		return { nation: nationIdentifier, items: [] };
	}
}
