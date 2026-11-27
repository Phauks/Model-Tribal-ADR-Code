/**
 * Recent changes and page histories: the database side (site/
 * COLLABORATION.md, "Recent changes"; migrations/0017_page_changes.sql;
 * shared rules in src/lib/page-history.ts).
 *
 * Where changes come from. Essays are published from the workspace, and
 * every publication is a change, read straight from essay_publications. The
 * other pages are built with the site: each build lists them with a
 * fingerprint (vite.config.ts, "page-history"), and `recordBuildChanges`
 * compares that list with the last build's and records a row in
 * page_changes for each page that is new, changed or gone. It runs once per
 * copy of the Worker when someone opens Recent changes, and every hour from
 * the scheduled run.
 *
 * Nation pages and stories keep no earlier wording: their rows name only the
 * parts of the page that changed. For the other pages each version's text is
 * kept in the private bucket under page-versions/, so any two can be
 * compared. A change the lead author hid (hidden_changes), or an essay
 * publication held back, keeps its row, with what is hidden taken out before
 * anything reaches a page.
 */
import type { D1Database, D1PreparedStatement, R2Bucket, R2Conditional } from '@cloudflare/workers-types/index.ts';
import { compareTexts, type BlockChange } from '#lib/essays/compare.ts';
import {
	changeIdentifier,
	hideReasons,
	isHideReason,
	parseChangeIdentifier,
	nationTeamName,
	nationTeamsKey,
	siteReleaseName,
	wordingIsShown,
	type ChangeFilters,
	type ChangeKind,
	type ChangeView,
	type HideReason,
	type HistoryBuild,
	type HistoryCommit,
	type HistoryPage,
	type PageKind
} from '#lib/page-history.ts';
import { activityStatement } from './activity-log.ts';
import { inGroupsOf } from '#lib/server/database-groups.ts';

function now(): string {
	return new Date().toISOString();
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** The file in the bucket holding one version of a page's text. */
export function versionKey(page: Pick<HistoryPage, 'address' | 'fingerprint'>): string {
	return `page-versions${page.address}/${page.fingerprint}.txt`;
}

// ---------------------------------------------------------------------------
// Recording the changes a new build brings

interface StateRow {
	address: string;
	kind: string;
	fingerprint: string;
	bytes: number | null;
	text_key: string | null;
	part_hashes: string | null;
}

interface CheckRow {
	built_at: string;
	build_hash: string;
	fingerprint_version: number;
}

export interface RecordedChange {
	address: string;
	kind: PageKind;
	title: string | null;
	change: Extract<ChangeKind, 'new' | 'edit' | 'removed'>;
	summary: string | null;
	bulk: 0 | 1;
	bytes_before: number | null;
	bytes_after: number | null;
	text_before: string | null;
	text_after: string | null;
	parts: string | null;
	made_at: string;
}

export interface RecordResult {
	compared: boolean;
	recorded: number;
}

/** The parts whose hashes differ between two versions of a page, in the order of the newer one. */
export function changedParts(before: Record<string, string> | undefined, after: Record<string, string> | undefined): string[] {
	const old = before ?? {};
	const current = after ?? {};
	const names = [...Object.keys(current), ...Object.keys(old).filter((name) => !(name in current))];
	return names.filter((name) => old[name] !== current[name]);
}

/** The merged changes a page picked up since the last build, newest first. */
function newCommits(build: HistoryBuild, page: Pick<HistoryPage, 'commits'>, since: string): HistoryCommit[] {
	return page.commits.map((place) => build.commits[place]).filter((commit) => commit && commit.merged > since);
}

/** A summary from merged changes' titles: the newest three, and how many more. */
export function summaryOf(commits: HistoryCommit[]): string | null {
	const titles = [...new Set(commits.map((commit) => commit.title))];
	if (titles.length === 0) return null;
	const shown = titles.slice(0, 3).join('; ');
	return titles.length > 3 ? `${shown}; and ${titles.length - 3} more` : shown;
}

/**
 * Works out the changes between the last build's pages and this build's,
 * without touching the database. Exported for the tests.
 */
export function changesBetween(
	stored: StateRow[],
	build: HistoryBuild,
	lastBuiltAt: string
): RecordedChange[] {
	const before = new Map(stored.map((row) => [row.address, row]));
	const current = new Set(build.pages.map((page) => page.address));
	const changes: RecordedChange[] = [];
	for (const page of build.pages) {
		const old = before.get(page.address);
		if (old?.fingerprint === page.fingerprint) continue;
		const commits = newCommits(build, page, lastBuiltAt);
		const wording = wordingIsShown(page.kind);
		const parts = wording
			? null
			: JSON.stringify(old ? changedParts(old.part_hashes ? JSON.parse(old.part_hashes) : undefined, page.parts) : []);
		changes.push({
			address: page.address,
			kind: page.kind,
			title: wording ? page.title : null,
			change: old ? 'edit' : 'new',
			summary: summaryOf(commits),
			bulk: commits.some((commit) => commit.bulk) ? 1 : 0,
			bytes_before: wording ? (old?.bytes ?? null) : null,
			bytes_after: wording ? (page.bytes ?? null) : null,
			text_before: wording ? (old?.text_key ?? null) : null,
			text_after: wording ? versionKey(page) : null,
			parts,
			made_at: commits[0]?.merged ?? build.builtAt
		});
	}
	for (const old of stored) {
		if (current.has(old.address)) continue;
		const wording = wordingIsShown(old.kind);
		changes.push({
			address: old.address,
			kind: old.kind as PageKind,
			title: null,
			change: 'removed',
			summary: null,
			bulk: 0,
			bytes_before: wording ? old.bytes : null,
			bytes_after: wording ? 0 : null,
			text_before: wording ? old.text_key : null,
			text_after: null,
			parts: wording ? null : '[]',
			made_at: build.builtAt
		});
	}
	return changes;
}

/**
 * Compares this build's pages with the last build's and records each change.
 * The first comparison, or one after the fingerprints were worked out
 * differently, only records the pages: nothing is listed as changed.
 */
export async function recordBuildChanges(
	database: D1Database,
	bucket: R2Bucket | undefined,
	build: HistoryBuild,
	at = now()
): Promise<RecordResult> {
	const last = await database
		.prepare('SELECT built_at, build_hash, fingerprint_version FROM page_history_checks WHERE name = ?')
		.bind('site')
		.first<CheckRow>();
	// An older build still answering during a deploy never undoes a newer one.
	if (last && (last.built_at >= build.builtAt || last.build_hash === build.buildHash)) return { compared: false, recorded: 0 };

	const { results: stored } = await database
		.prepare('SELECT address, kind, fingerprint, bytes, text_key, part_hashes FROM page_states')
		.all<StateRow>();
	const seeding = !last || last.fingerprint_version !== build.fingerprintVersion;
	const before = new Map(stored.map((row) => [row.address, row.fingerprint]));
	const written = build.pages.filter((page) => before.get(page.address) !== page.fingerprint);
	const changes = seeding ? [] : changesBetween(stored, build, last.built_at);
	const removed = stored.filter((row) => !build.pages.some((page) => page.address === row.address)).map((row) => row.address);

	// Each version's text goes to the bucket before anything names it. A file
	// that already exists holds the same text, so it is left as it is.
	if (bucket) {
		for (const page of written) {
			if (page.text === undefined) continue;
			await bucket.put(versionKey(page), page.text, {
				onlyIf: new Headers({ 'If-None-Match': '*' }) as unknown as R2Conditional,
				httpMetadata: { contentType: 'text/plain; charset=utf-8' },
				customMetadata: { page: page.address }
			});
		}
	}

	const token = randomToken();
	// Only the run that claimed this build writes: the claim's token is parameter number `slot`.
	const claimed = (slot: number) => `EXISTS (SELECT 1 FROM page_history_checks WHERE name = 'site' AND run_token = ?${slot})`;
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`INSERT INTO page_history_checks (name, built_at, build_hash, fingerprint_version, run_token, checked_at)
				 VALUES ('site', ?1, ?2, ?3, ?4, ?5)
				 ON CONFLICT (name) DO UPDATE SET
					built_at = excluded.built_at, build_hash = excluded.build_hash,
					fingerprint_version = excluded.fingerprint_version, run_token = excluded.run_token,
					checked_at = excluded.checked_at
				 WHERE page_history_checks.built_at < excluded.built_at AND page_history_checks.build_hash <> excluded.build_hash`
			)
			.bind(build.builtAt, build.buildHash, build.fingerprintVersion, token, at)
	];
	// Each JSON list bound to a statement stays well under D1's size limits.
	for (const group of inGroupsOf(changes, 200)) {
		statements.push(
			database
				.prepare(
					`INSERT INTO page_changes
						(address, kind, title, change, summary, bulk, bytes_before, bytes_after, text_before, text_after, parts, made_at, recorded_at)
					 SELECT j.value ->> '$.address', j.value ->> '$.kind', j.value ->> '$.title', j.value ->> '$.change',
						j.value ->> '$.summary', j.value ->> '$.bulk', j.value ->> '$.bytes_before', j.value ->> '$.bytes_after',
						j.value ->> '$.text_before', j.value ->> '$.text_after', j.value ->> '$.parts', j.value ->> '$.made_at', ?1
					 FROM json_each(?2) AS j
					 WHERE ${claimed(3)}
					 ORDER BY j.key`
				)
				.bind(at, JSON.stringify(changes.length > 0 ? group : []), token)
		);
	}
	for (const group of inGroupsOf(written, 200)) {
		const rows = group.map((page) => ({
			address: page.address,
			kind: page.kind,
			fingerprint: page.fingerprint,
			bytes: page.bytes ?? null,
			text_key: page.text === undefined ? null : versionKey(page),
			part_hashes: page.parts ? JSON.stringify(page.parts) : null
		}));
		statements.push(
			database
				.prepare(
					`INSERT INTO page_states (address, kind, fingerprint, bytes, text_key, part_hashes, seen_at)
					 SELECT j.value ->> '$.address', j.value ->> '$.kind', j.value ->> '$.fingerprint', j.value ->> '$.bytes',
						j.value ->> '$.text_key', j.value ->> '$.part_hashes', ?1
					 FROM json_each(?2) AS j
					 WHERE ${claimed(3)}
					 ON CONFLICT (address) DO UPDATE SET
						kind = excluded.kind, fingerprint = excluded.fingerprint, bytes = excluded.bytes,
						text_key = excluded.text_key, part_hashes = excluded.part_hashes, seen_at = excluded.seen_at`
				)
				.bind(at, JSON.stringify(rows), token)
		);
	}
	if (removed.length > 0) {
		statements.push(
			database
				.prepare(`DELETE FROM page_states WHERE address IN (SELECT value FROM json_each(?1)) AND ${claimed(2)}`)
				.bind(JSON.stringify(removed), token)
		);
	}
	await database.batch(statements);
	const won = await database
		.prepare(`SELECT 1 AS yes FROM page_history_checks WHERE name = 'site' AND run_token = ?`)
		.bind(token)
		.first<{ yes: number }>();
	return won ? { compared: true, recorded: changes.length } : { compared: false, recorded: 0 };
}

// ---------------------------------------------------------------------------
// Reading changes

/**
 * Every change as one list: the rows above and the essays' publications. An
 * essay's address is worked out as essayPath() in src/lib/server/essays.ts
 * does; tests/page-history.test.ts checks they agree.
 */
const everyChange = `
	WITH changes AS (
		SELECT 'page-' || pc.identifier AS id, pc.address, pc.kind, pc.title, pc.change, pc.summary, pc.bulk,
			pc.bytes_before, pc.bytes_after, pc.text_before, pc.text_after, pc.parts,
			NULL AS person_identifier, pc.made_at, 1 AS listed, pc.identifier AS sort_key, NULL AS who_name
		FROM page_changes pc
		UNION ALL
		-- What nations' teams published on their own pages, once live and unless the project undid it.
		-- Like every nation page change, it names the part of the page, never the words.
		SELECT 'nation-' || npc.identifier, '/nations/' || npc.nation_identifier, 'nation', NULL, 'edit',
			NULL, 0, NULL, NULL, NULL, NULL,
			json_array(CASE npc.kind
				WHEN 'about' THEN 'About'
				WHEN 'courts' THEN 'Courts'
				WHEN 'statements' THEN 'Statements beside government records'
				WHEN 'contacts' THEN 'Contacts'
				WHEN 'pictures' THEN 'Pictures'
				ELSE 'Hidden parts of the page'
			END),
			NULL, npc.live_at, 1, npc.rowid, npc.credit
		FROM nation_page_changes npc
		WHERE npc.status = 'published' AND npc.live_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		UNION ALL
		SELECT 'essay-' || p.essay_identifier || '-' || p.number,
			CASE e.part
				WHEN 'foundations' THEN '/foundations/' || CASE WHEN p.essay_identifier GLOB 'i-*' THEN substr(p.essay_identifier, 3) ELSE p.essay_identifier END
				WHEN 'back-matter' THEN '/back-matter/' || p.essay_identifier
				WHEN 'news' THEN '/news/' || p.essay_identifier
				WHEN 'about' THEN CASE p.essay_identifier WHEN 'about' THEN '/about' WHEN 'sponsor' THEN '/sponsor' ELSE '/' || p.essay_identifier END
				ELSE '/essays/' || p.essay_identifier
			END,
			e.part, v.title,
			CASE WHEN prior.version_number IS NULL THEN 'new' WHEN v.origin = 'restore' THEN 'restored' ELSE 'published' END,
			v.note, 0, prior_version.bytes, v.bytes, prior_version.object_key, v.object_key, NULL,
			p.person_identifier, p.published_at, p.listed, p.number, NULL
		FROM essay_publications p
		JOIN essays e ON e.identifier = p.essay_identifier
		JOIN essay_versions v ON v.essay_identifier = p.essay_identifier AND v.number = p.version_number
		LEFT JOIN essay_publications prior ON prior.essay_identifier = p.essay_identifier AND prior.number = (
			SELECT MAX(q.number) FROM essay_publications q
			WHERE q.essay_identifier = p.essay_identifier AND q.number < p.number AND q.listed = 1
		)
		LEFT JOIN essay_versions prior_version
			ON prior_version.essay_identifier = prior.essay_identifier AND prior_version.number = prior.version_number
	)
	SELECT c.*, h.hide_text, h.hide_summary, h.hide_person, h.reason AS hide_reason, people.display_name AS person_name
	FROM changes c
	LEFT JOIN hidden_changes h ON h.change = c.id
	LEFT JOIN people ON people.identifier = c.person_identifier`;

export interface ChangeRow {
	id: string;
	address: string;
	kind: string;
	title: string | null;
	change: string;
	summary: string | null;
	bulk: number;
	bytes_before: number | null;
	bytes_after: number | null;
	text_before: string | null;
	text_after: string | null;
	parts: string | null;
	person_identifier: string | null;
	made_at: string;
	listed: number;
	sort_key: number;
	/** For a change a nation's team published: the name it gave on the page. */
	who_name: string | null;
	hide_text: number | null;
	hide_summary: number | null;
	hide_person: number | null;
	hide_reason: string | null;
	person_name: string | null;
}

/** Pages built with the site, by address: their kind and title now. */
export type PageDirectory = Map<string, { kind: PageKind; title: string }>;

export function directoryOf(build: HistoryBuild): PageDirectory {
	return new Map(build.pages.map((page) => [page.address, { kind: page.kind, title: page.title }]));
}

function textHiddenIn(row: ChangeRow): boolean {
	return Boolean(row.hide_text) || row.listed === 0;
}

/** A change as a reader may see it, with everything hidden taken out. */
export function changeView(row: ChangeRow, directory: PageDirectory): ChangeView {
	const kind = row.kind as PageKind;
	const textHidden = textHiddenIn(row);
	const summaryHidden = Boolean(row.hide_summary) || row.listed === 0;
	const whoHidden = Boolean(row.hide_person);
	const wording = wordingIsShown(kind);
	const hasSize = wording && !textHidden && (row.bytes_after !== null || row.bytes_before !== null);
	const live = directory.get(row.address);
	return {
		id: row.id,
		address: row.address,
		kind,
		// Nation pages and stories keep no title of their own: the live site's, or none once the page is gone.
		title: wording ? (row.title ?? live?.title ?? undefined) : live?.title,
		change: row.change as ChangeKind,
		summary: summaryHidden ? undefined : (row.summary ?? undefined),
		summaryHidden,
		who: whoHidden
			? undefined
			: row.id.startsWith('nation-')
				? (row.who_name ?? nationTeamName)
				: (row.person_name ?? (row.person_identifier ? 'A former contributor' : siteReleaseName)),
		whoHidden,
		whoKey: row.id.startsWith('nation-') ? nationTeamsKey : (row.person_identifier ?? 'site'),
		sizeChange: hasSize ? (row.bytes_after ?? 0) - (row.bytes_before ?? 0) : undefined,
		size: hasSize && row.change !== 'removed' ? (row.bytes_after ?? undefined) : undefined,
		parts: wording || textHidden || !row.parts ? undefined : (JSON.parse(row.parts) as string[]),
		comparable: wording && !textHidden && row.text_after !== null,
		textHidden,
		hiddenReason:
			row.listed === 0
				? 'Withdrawn from readers'
				: row.hide_reason
					? isHideReason(row.hide_reason)
						? hideReasons[row.hide_reason]
						: 'Hidden'
					: undefined,
		bulk: Boolean(row.bulk),
		madeAt: row.made_at
	};
}

interface Where {
	clauses: string[];
	values: unknown[];
}

/** What the filters need beyond the address: the pages whose titles match, and who is reading. */
interface WhereContext {
	/** For the "Page" filter: the built pages whose title has the words typed. */
	titleAddresses: string[] | undefined;
	/** The signed-in reader's account, for "Only pages I follow". */
	account: string | undefined;
}

/** Lower case without accents, so "hawaii" finds "Hawaiʻi". */
function foldTitle(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[\u0300-\u036f\u02bb\u02bc\u2018\u2019']/g, '')
		.toLowerCase();
}

/** The built pages whose title has every word typed in the "Page" filter. */
export function pagesTitled(directory: PageDirectory, typed: string): string[] {
	const words = foldTitle(typed).split(/\s+/).filter(Boolean);
	const found: string[] = [];
	for (const [address, page] of directory) {
		const title = foldTitle(page.title);
		if (words.every((word) => title.includes(word))) found.push(address);
	}
	return found;
}

function whereFor(filters: ChangeFilters, at: Date, context: WhereContext = { titleAddresses: undefined, account: undefined }): Where {
	const clauses: string[] = [];
	const values: unknown[] = [];
	const add = (clause: string, ...bound: unknown[]) => {
		clauses.push(clause);
		values.push(...bound);
	};
	if (filters.page) add('c.address = ?', filters.page);
	if (filters.title) {
		// A page no longer on the site is found by the title its changes kept.
		const pattern = `%${filters.title.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
		add(
			"(c.address IN (SELECT value FROM json_each(?)) OR c.title LIKE ? ESCAPE '\\')",
			JSON.stringify(context.titleAddresses ?? []),
			pattern
		);
	}
	if (filters.following) {
		if (context.account) add('c.address IN (SELECT address FROM follows WHERE account_identifier = ?)', context.account);
		else add('0');
	}
	if (filters.hidden) add('(h.change IS NOT NULL OR c.listed = 0)');
	if (filters.kinds.length > 0) add('c.kind IN (SELECT value FROM json_each(?))', JSON.stringify(filters.kinds));
	if (filters.who === 'site') add("c.person_identifier IS NULL AND c.id NOT LIKE 'nation-%'");
	else if (filters.who === nationTeamsKey) add("c.id LIKE 'nation-%' AND COALESCE(h.hide_person, 0) = 0");
	else if (filters.who) add('c.person_identifier = ? AND COALESCE(h.hide_person, 0) = 0', filters.who);
	if (filters.days > 0) add('c.made_at >= ?', new Date(at.getTime() - filters.days * 86_400_000).toISOString());
	if (filters.size > 0) {
		add(
			`ABS(COALESCE(c.bytes_after, 0) - COALESCE(c.bytes_before, 0)) >= ?
			 AND (c.bytes_after IS NOT NULL OR c.bytes_before IS NOT NULL)
			 AND COALESCE(h.hide_text, 0) = 0 AND c.listed = 1`,
			filters.size
		);
	}
	add('c.change IN (SELECT value FROM json_each(?))', JSON.stringify(filters.changes));
	return { clauses, values };
}

function whereText(where: Where, extra: string[] = []): string {
	const all = [...where.clauses, ...extra];
	return all.length > 0 ? ` WHERE ${all.join(' AND ')}` : '';
}

export interface ChangeList {
	changes: ChangeView[];
	/** How many changes the filters match, bulk updates included only when shown. */
	total: number;
	/** How many bulk updates the filters left out. */
	hiddenBulk: number;
	/** Whether there were more changes than the limit. */
	more: boolean;
	/** Everyone who made a change, for the "Who" filter. */
	people: { key: string; name: string }[];
}

export async function listChanges(
	database: D1Database,
	filters: ChangeFilters,
	directory: PageDirectory,
	at = new Date(),
	account?: string
): Promise<ChangeList> {
	const where = whereFor(filters, at, {
		titleAddresses: filters.title ? pagesTitled(directory, filters.title) : undefined,
		account
	});
	const bulkClause = filters.showBulk ? [] : ['c.bulk = 0'];
	const [listed, total, bulk, people, nationTeams] = await Promise.all([
		database
			.prepare(`${everyChange}${whereText(where, bulkClause)} ORDER BY c.made_at DESC, c.sort_key DESC LIMIT ?`)
			.bind(...where.values, filters.limit + 1)
			.all<ChangeRow>(),
		database
			.prepare(`SELECT COUNT(*) AS count FROM (${everyChange}${whereText(where, bulkClause)})`)
			.bind(...where.values)
			.first<{ count: number }>(),
		filters.showBulk
			? Promise.resolve(null)
			: database
					.prepare(`SELECT COUNT(*) AS count FROM (${everyChange}${whereText(where, ['c.bulk = 1'])})`)
					.bind(...where.values)
					.first<{ count: number }>(),
		database
			.prepare(
				`SELECT DISTINCT people.identifier AS key, people.display_name AS name
				 FROM essay_publications p
				 JOIN people ON people.identifier = p.person_identifier
				 LEFT JOIN hidden_changes h ON h.change = 'essay-' || p.essay_identifier || '-' || p.number
				 WHERE COALESCE(h.hide_person, 0) = 0
				 ORDER BY people.display_name`
			)
			.all<{ key: string; name: string }>(),
		database
			.prepare(`SELECT 1 AS yes FROM nation_page_changes WHERE status = 'published' LIMIT 1`)
			.first<{ yes: number }>()
	]);
	const rows = listed.results;
	return {
		changes: rows.slice(0, filters.limit).map((row) => changeView(row, directory)),
		total: total?.count ?? 0,
		hiddenBulk: bulk?.count ?? 0,
		more: rows.length > filters.limit,
		people: [
			{ key: 'site', name: siteReleaseName },
			// Listed only once a nation's team has published something.
			...(nationTeams ? [{ key: nationTeamsKey, name: 'Nations’ teams' }] : []),
			...people.results
		]
	};
}

/**
 * When the site last saw a page built with it change, or first recorded it:
 * for a page with no changes yet, when its history began. Undefined for a page
 * the history does not follow.
 */
export async function pageRecordedSince(database: D1Database, address: string): Promise<string | undefined> {
	const row = await database
		.prepare('SELECT seen_at FROM page_states WHERE address = ?')
		.bind(address)
		.first<{ seen_at: string }>();
	return row?.seen_at ?? undefined;
}

/** What a page's history badge shows: how many changes, the newest, and when recording began. */
export interface PageHistorySummary {
	count: number;
	/** The newest change, as readers may see it. */
	latest: ChangeView | undefined;
	/** For a page with no changes yet: when its history began. */
	recordedSince: string | undefined;
}

export async function pageHistorySummary(database: D1Database, address: string): Promise<PageHistorySummary> {
	const [counted, newest] = await Promise.all([
		database.prepare(`SELECT COUNT(*) AS count FROM (${everyChange} WHERE c.address = ?)`).bind(address).first<{ count: number }>(),
		database.prepare(`${everyChange} WHERE c.address = ? ORDER BY c.made_at DESC, c.sort_key DESC LIMIT 1`).bind(address).first<ChangeRow>()
	]);
	const count = counted?.count ?? 0;
	return {
		count,
		latest: newest ? changeView(newest, new Map()) : undefined,
		recordedSince: count === 0 ? await pageRecordedSince(database, address) : undefined
	};
}

/** Every change to one page, oldest first, as stored. */
async function pageRows(database: D1Database, address: string): Promise<ChangeRow[]> {
	const { results } = await database
		.prepare(`${everyChange} WHERE c.address = ? ORDER BY c.made_at, c.sort_key`)
		.bind(address)
		.all<ChangeRow>();
	return results;
}

async function changeRow(database: D1Database, id: string): Promise<ChangeRow | undefined> {
	const reference = parseChangeIdentifier(id);
	if (!reference) return undefined;
	const row = await database
		.prepare(`${everyChange} WHERE c.id = ?`)
		.bind(changeIdentifier(reference))
		.first<ChangeRow>();
	return row ?? undefined;
}

/** A row that holds a version of the page's text: an edit or new page, or an essay publication. */
function isVersion(row: ChangeRow): boolean {
	return row.text_after !== null;
}

async function readText(bucket: R2Bucket, key: string): Promise<string | undefined> {
	const object = await bucket.get(key);
	return object ? (await object.text()).normalize('NFC') : undefined;
}

export type Comparison =
	| { kind: 'compared'; blocks: BlockChange[]; beforeId: string | undefined }
	| { kind: 'first' }
	| { kind: 'parts' }
	| { kind: 'hidden' }
	| { kind: 'earlier-hidden' }
	| { kind: 'missing' };

export interface ChangeDetail {
	change: ChangeView;
	/** The change compared with: the version before it. */
	before: ChangeView | undefined;
	comparison: Comparison;
	older: string | undefined;
	newer: string | undefined;
}

/** One change and what it changed, compared with the version before it. */
export async function changeDetail(
	database: D1Database,
	bucket: R2Bucket,
	id: string,
	directory: PageDirectory
): Promise<ChangeDetail | undefined> {
	const row = await changeRow(database, id);
	if (!row) return undefined;
	const history = await pageRows(database, row.address);
	const index = history.findIndex((candidate) => candidate.id === row.id);
	const change = changeView(row, directory);
	const older = history[index - 1]?.id;
	const newer = history[index + 1]?.id;

	// The version before this change: the nearest earlier change that holds a
	// version. An essay compares with its last listed publication.
	let earlier: ChangeRow | undefined;
	for (let at = index - 1; at >= 0; at -= 1) {
		const candidate = history[at];
		if (row.id.startsWith('essay-') ? candidate.listed === 1 : isVersion(candidate) || candidate.change === 'removed') {
			earlier = candidate;
			break;
		}
	}
	const before = earlier ? changeView(earlier, directory) : undefined;

	let comparison: Comparison;
	if (!wordingIsShown(row.kind)) comparison = { kind: 'parts' };
	else if (textHiddenIn(row)) comparison = { kind: 'hidden' };
	else if (earlier && textHiddenIn(earlier) && row.text_before) comparison = { kind: 'earlier-hidden' };
	else if (!row.text_before && !row.text_after) comparison = { kind: 'missing' };
	else {
		const beforeText = row.text_before ? await readText(bucket, row.text_before) : '';
		const afterText = row.text_after ? await readText(bucket, row.text_after) : '';
		if (beforeText === undefined || afterText === undefined) comparison = { kind: 'missing' };
		else if (!row.text_before && row.change === 'new') comparison = { kind: 'compared', blocks: compareTexts('', afterText), beforeId: undefined };
		else comparison = { kind: 'compared', blocks: compareTexts(beforeText, afterText), beforeId: before?.id };
	}
	return { change, before, comparison, older, newer };
}

export interface VersionComparison {
	from: ChangeView;
	to: ChangeView;
	comparison: Comparison;
}

/** Two versions of one page, compared: the text after one change with the text after another. */
export async function compareVersions(
	database: D1Database,
	bucket: R2Bucket,
	fromIdentifier: string,
	toIdentifier: string,
	directory: PageDirectory
): Promise<VersionComparison | undefined> {
	const [first, second] = await Promise.all([changeRow(database, fromIdentifier), changeRow(database, toIdentifier)]);
	if (!first || !second || first.address !== second.address) return undefined;
	// The older version is compared with the newer, whichever way round they were chosen.
	const [fromRow, toRow] = first.made_at <= second.made_at ? [first, second] : [second, first];
	const from = changeView(fromRow, directory);
	const to = changeView(toRow, directory);
	let comparison: Comparison;
	if (!wordingIsShown(fromRow.kind)) comparison = { kind: 'parts' };
	else if (textHiddenIn(fromRow) || textHiddenIn(toRow)) comparison = { kind: 'hidden' };
	else if (!fromRow.text_after || !toRow.text_after) comparison = { kind: 'missing' };
	else {
		const [older, newer] = await Promise.all([readText(bucket, fromRow.text_after), readText(bucket, toRow.text_after)]);
		comparison =
			older === undefined || newer === undefined
				? { kind: 'missing' }
				: { kind: 'compared', blocks: compareTexts(older, newer), beforeId: from.id };
	}
	return { from, to, comparison };
}

/** The text of a page as one change left it, for reading an old version. */
export async function versionText(
	database: D1Database,
	bucket: R2Bucket,
	id: string,
	directory: PageDirectory
): Promise<{ change: ChangeView; text: string | undefined } | undefined> {
	const row = await changeRow(database, id);
	if (!row) return undefined;
	const change = changeView(row, directory);
	if (!change.comparable || !row.text_after) return { change, text: undefined };
	return { change, text: await readText(bucket, row.text_after) };
}

// ---------------------------------------------------------------------------
// Hiding parts of a change

export interface HideChoice {
	text: boolean;
	summary: boolean;
	person: boolean;
	reason: HideReason;
}

export interface HiddenChange {
	id: string;
	hideText: boolean;
	hideSummary: boolean;
	hidePerson: boolean;
	reason: string;
	hiddenBy: string | null;
	hiddenAt: string;
}

export async function hiddenChange(database: D1Database, id: string): Promise<HiddenChange | undefined> {
	const row = await database
		.prepare(
			`SELECT h.*, people.display_name AS hidden_by FROM hidden_changes h
			 LEFT JOIN people ON people.identifier = h.person_identifier WHERE h.change = ?`
		)
		.bind(id)
		.first<{ change: string; hide_text: number; hide_summary: number; hide_person: number; reason: string; hidden_by: string | null; hidden_at: string }>();
	return row
		? {
				id: row.change,
				hideText: Boolean(row.hide_text),
				hideSummary: Boolean(row.hide_summary),
				hidePerson: Boolean(row.hide_person),
				reason: row.reason,
				hiddenBy: row.hidden_by,
				hiddenAt: row.hidden_at
			}
		: undefined;
}

/** Every hidden change, newest first, for the workspace. */
export async function hiddenChanges(database: D1Database): Promise<HiddenChange[]> {
	const { results } = await database
		.prepare(
			`SELECT h.*, people.display_name AS hidden_by FROM hidden_changes h
			 LEFT JOIN people ON people.identifier = h.person_identifier ORDER BY h.hidden_at DESC`
		)
		.all<{ change: string; hide_text: number; hide_summary: number; hide_person: number; reason: string; hidden_by: string | null; hidden_at: string }>();
	return results.map((row) => ({
		id: row.change,
		hideText: Boolean(row.hide_text),
		hideSummary: Boolean(row.hide_summary),
		hidePerson: Boolean(row.hide_person),
		reason: row.reason,
		hiddenBy: row.hidden_by,
		hiddenAt: row.hidden_at
	}));
}

/** A change as the lead author sees it before hiding anything: nothing taken out, with what is hidden now. */
export async function changeForHiding(
	database: D1Database,
	id: string,
	directory: PageDirectory
): Promise<{ change: ChangeView; hidden: HiddenChange | undefined } | undefined> {
	const row = await changeRow(database, id);
	if (!row) return undefined;
	const open = { ...row, hide_text: 0, hide_summary: 0, hide_person: 0, hide_reason: null };
	return { change: changeView(open, directory), hidden: await hiddenChange(database, row.id) };
}

/** Hides parts of a change, or changes what is hidden, and records who did it in the activity log. */
export async function hideChange(
	database: D1Database,
	personIdentifier: string,
	id: string,
	choice: HideChoice,
	note: string | null
): Promise<boolean> {
	if (!(await changeRow(database, id))) return false;
	const at = now();
	const parts = [choice.text && 'text', choice.summary && 'summary', choice.person && 'name'].filter(Boolean).join(', ');
	await database.batch([
		database
			.prepare(
				`INSERT INTO hidden_changes (change, hide_text, hide_summary, hide_person, reason, person_identifier, hidden_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (change) DO UPDATE SET
					hide_text = excluded.hide_text, hide_summary = excluded.hide_summary, hide_person = excluded.hide_person,
					reason = excluded.reason, person_identifier = excluded.person_identifier, hidden_at = excluded.hidden_at`
			)
			.bind(id, Number(choice.text), Number(choice.summary), Number(choice.person), choice.reason, personIdentifier, at),
		activityStatement(database, {
			personIdentifier,
			action: 'hid-change',
			targetKind: 'document',
			targetIdentifier: id,
			note: [`Hid the ${parts} (${hideReasons[choice.reason]})`, note].filter(Boolean).join('. ').slice(0, 1000)
		})
	]);
	return true;
}

/** Shows a hidden change again, and records who did it in the activity log. */
export async function showChange(database: D1Database, personIdentifier: string, id: string, note: string | null): Promise<void> {
	await database.batch([
		database.prepare('DELETE FROM hidden_changes WHERE change = ?').bind(id),
		activityStatement(database, {
			personIdentifier,
			action: 'showed-change',
			targetKind: 'document',
			targetIdentifier: id,
			note: note?.slice(0, 1000) ?? null
		})
	]);
}

/** A request a hiding may answer, for the "Request it answers" list. */
export interface RequestToAnswer {
	reference: string;
	kind: string;
}

/** Open requests to correct, make private or delete something, newest first: what a hiding usually answers. */
export async function requestsToAnswer(database: D1Database): Promise<RequestToAnswer[]> {
	const rows = await database
		.prepare(
			`SELECT reference, kind FROM requests
			 WHERE status <> 'resolved' AND kind IN ('correct', 'restrict', 'remove')
			 ORDER BY received_at DESC LIMIT 50`
		)
		.all<RequestToAnswer>();
	return rows.results;
}
