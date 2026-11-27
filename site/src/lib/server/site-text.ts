/**
 * Editing the site's own wording from the website (docs/site-text.md,
 * decision record 0054): saving versions of a piece of text, publishing the
 * drafts, undoing a publication, and asking Cloudflare to rebuild the site
 * so the published words are built into its pages.
 *
 * A piece of text is named by the build (src/lib/site-text-markers.ts).
 * Versions and publications are never changed or deleted (migration
 * 20261124T0119_add_site_text.sql). A version with no words means "the
 * built-in words".
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { tidyRecordWords } from '#lib/record-text.ts';
import type { SiteTextEntry } from '#lib/site-text-markers.ts';
import { activityStatement } from './activity-log.ts';
import { now } from './identifiers.ts';

/** The longest a piece of site text may be. */
export const longestWords = 2000;

export class SiteTextProblem extends Error {
	constructor(
		message: string,
		readonly status = 400
	) {
		super(message);
	}
}

export interface SiteTextVersion {
	identifier: number;
	key: string;
	/** Null for the built-in words. */
	words: string | null;
	builtInWords: string;
	sourceFile: string;
	page: string | null;
	personIdentifier: string;
	personName: string | null;
	createdAt: string;
}

export interface PieceState {
	key: string;
	/** The published words, or null when the built-in words show. */
	published: string | null;
	publishedVersion: number | null;
	publication: number | null;
	/** The newest version, when it differs from what is published. */
	draft: SiteTextVersion | null;
}

const versionColumns = `v.identifier, v.text_key AS key, v.words, v.built_in_words AS builtInWords, v.source_file AS sourceFile,
	v.page, v.person_identifier AS personIdentifier, people.display_name AS personName, v.created_at AS createdAt`;

/** Words as saved: white space tidied; the built-in words, or nothing, mean "no edit". */
export function cleanWords(words: string | null, builtIn: string): string | null {
	if (words === null) return null;
	const tidy = words.replace(/\s+/g, ' ').trim();
	if (!tidy || tidy === builtIn) return null;
	if (tidy.length > longestWords) throw new SiteTextProblem(`Keep it under ${longestWords} characters.`);
	return tidy;
}

/** A part of a case's or law's box as saved: like cleanWords, but its paragraphs kept (src/lib/record-text.ts). */
export function cleanRecordWords(words: string | null, builtIn: string): string | null {
	if (words === null) return null;
	const tidy = tidyRecordWords(words);
	if (!tidy || tidy === tidyRecordWords(builtIn)) return null;
	if (tidy.length > longestWords) throw new SiteTextProblem(`Keep it under ${longestWords} characters.`);
	return tidy;
}

/** The newest publication's number, or 0. */
export async function latestPublication(database: D1Database): Promise<number> {
	const row = await database.prepare('SELECT MAX(number) AS number FROM site_text_publications').first<{ number: number | null }>();
	return row?.number ?? 0;
}

/** What each piece of text published last says, by name, with the version and publication. */
async function publishedRows(
	database: D1Database
): Promise<{ key: string; words: string | null; version: number; publication: number; newestEverPublished: number }[]> {
	const result = await database
		.prepare(
			`SELECT p.text_key AS key, v.words, p.version, p.publication, newest.version AS newestEverPublished
			 FROM site_text_published p
			 JOIN (SELECT text_key, MAX(publication) AS publication, MAX(version) AS version FROM site_text_published GROUP BY text_key) newest
			   ON newest.text_key = p.text_key AND newest.publication = p.publication
			 JOIN site_text_versions v ON v.identifier = p.version`
		)
		.all<{ key: string; words: string | null; version: number; publication: number; newestEverPublished: number }>();
	return result.results;
}

/** The published words to build with: what /site-text/published.json serves. */
export async function publishedSiteText(database: D1Database): Promise<{ publication: number; texts: Record<string, string> }> {
	const [publication, rows] = await Promise.all([latestPublication(database), publishedRows(database)]);
	const texts: Record<string, string> = {};
	for (const row of rows) if (row.words !== null) texts[row.key] = row.words;
	return { publication, texts };
}

async function newestVersions(database: D1Database): Promise<SiteTextVersion[]> {
	const result = await database
		.prepare(
			`SELECT ${versionColumns}
			 FROM site_text_versions v
			 JOIN (SELECT text_key, MAX(identifier) AS identifier FROM site_text_versions GROUP BY text_key) newest
			   ON newest.identifier = v.identifier
			 LEFT JOIN people ON people.identifier = v.person_identifier`
		)
		.all<SiteTextVersion>();
	return result.results;
}

/**
 * Every piece of text that has been edited: what is published, and the
 * draft if its newest version says something else.
 */
export async function pieceStates(database: D1Database): Promise<Map<string, PieceState>> {
	const [published, newest] = await Promise.all([publishedRows(database), newestVersions(database)]);
	const states = new Map<string, PieceState>();
	// A version newer than any version ever published for its piece is a
	// draft; one a publication was undone past is not.
	const newestEverPublished = new Map<string, number>();
	for (const row of published) {
		states.set(row.key, { key: row.key, published: row.words, publishedVersion: row.version, publication: row.publication, draft: null });
		newestEverPublished.set(row.key, row.newestEverPublished);
	}
	for (const version of newest) {
		const state = states.get(version.key) ?? { key: version.key, published: null, publishedVersion: null, publication: null, draft: null };
		if (version.identifier > (newestEverPublished.get(version.key) ?? 0) && version.words !== state.published) state.draft = version;
		states.set(version.key, state);
	}
	return states;
}

/** The drafts waiting to be published, newest first. */
export async function drafts(database: D1Database): Promise<PieceState[]> {
	return [...(await pieceStates(database)).values()]
		.filter((state) => state.draft)
		.sort((first, second) => (second.draft?.identifier ?? 0) - (first.draft?.identifier ?? 0));
}

/** How many drafts wait to be published, counting only text still on the site. */
export function waitingCount(states: ReadonlyMap<string, PieceState>, catalog: ReadonlyMap<string, SiteTextEntry>): number {
	return [...states.values()].filter((state) => state.draft && catalog.has(state.key)).length;
}

export interface GoneEdit {
	key: string;
	/** The page the edit was made on, if any. */
	page: string | null;
	sourceFile: string;
	/** The edit: the draft's words, or else the published words. */
	words: string;
	/** What the code said when the edit was made. */
	builtInWords: string;
}

/**
 * Edits to text the code no longer has, because a later code change
 * reworded it and so renamed it (docs/site-text.md). An edit someone let
 * go (a newest version with no words) is left out.
 */
export async function goneEdits(
	database: D1Database,
	states: ReadonlyMap<string, PieceState>,
	catalog: ReadonlyMap<string, SiteTextEntry>
): Promise<GoneEdit[]> {
	const gone = [...states.values()].filter(
		(state) => !catalog.has(state.key) && (state.draft ? state.draft.words !== null : state.published !== null)
	);
	if (gone.length === 0) return [];
	const result = await database
		.prepare(
			`SELECT v.text_key AS key, v.built_in_words AS builtInWords, v.source_file AS sourceFile,
			        (SELECT page FROM site_text_versions withPage WHERE withPage.text_key = v.text_key AND withPage.page IS NOT NULL
			         ORDER BY withPage.identifier DESC LIMIT 1) AS page
			 FROM site_text_versions v
			 JOIN (SELECT text_key, MAX(identifier) AS identifier FROM site_text_versions GROUP BY text_key) newest ON newest.identifier = v.identifier
			 WHERE v.text_key IN (SELECT value FROM json_each(?))`
		)
		.bind(JSON.stringify(gone.map((state) => state.key)))
		.all<{ key: string; builtInWords: string; sourceFile: string; page: string | null }>();
	const details = new Map(result.results.map((row) => [row.key, row]));
	return gone.map((state) => {
		const row = details.get(state.key);
		return {
			key: state.key,
			page: row?.page ?? null,
			sourceFile: row?.sourceFile ?? '',
			words: state.draft?.words ?? state.published ?? '',
			builtInWords: row?.builtInWords ?? ''
		};
	});
}

/**
 * Lets go of an edit to text the code no longer has: a new version with no
 * words, so the edit leaves the list. Nothing on the site changes, since no
 * page shows that text any more.
 */
export async function letGo(database: D1Database, key: string, personIdentifier: string, catalog: ReadonlyMap<string, SiteTextEntry>): Promise<void> {
	if (catalog.has(key)) throw new SiteTextProblem('This text is still on the site. Edit it there instead.', 409);
	const edit = (await goneEdits(database, await pieceStates(database), catalog)).find((each) => each.key === key);
	if (!edit) throw new SiteTextProblem('There is no such edit to let go.', 404);
	await database.batch([
		database
			.prepare(
				`INSERT INTO site_text_versions (text_key, words, built_in_words, source_file, page, person_identifier, created_at)
				 VALUES (?, NULL, ?, ?, NULL, ?, ?)`
			)
			.bind(key, edit.builtInWords, edit.sourceFile, personIdentifier, now()),
		activityStatement(database, {
			personIdentifier,
			action: 'Let go of an edit to site text no longer on the site',
			targetKind: 'document',
			targetIdentifier: `site-text:${key}`,
			note: edit.words
		})
	]);
}

export interface SaveInput {
	entry: SiteTextEntry;
	/** Null puts the built-in words back. */
	words: string | null;
	page: string | null;
	personIdentifier: string;
}

/** Saves a new version of one piece of text, as a draft. */
export async function saveVersion(database: D1Database, input: SaveInput): Promise<SiteTextVersion> {
	const words = input.entry.record ? cleanRecordWords(input.words, input.entry.words) : cleanWords(input.words, input.entry.words);
	const createdAt = now();
	const page = input.page && input.page.startsWith('/') ? input.page.slice(0, 500) : null;
	await database.batch([
		database
			.prepare(
				`INSERT INTO site_text_versions (text_key, words, built_in_words, source_file, page, person_identifier, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(input.entry.key, words, input.entry.words, input.entry.file, page, input.personIdentifier, createdAt),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: words === null ? 'Put back the built-in site text' : 'Saved a draft of site text',
			targetKind: 'document',
			targetIdentifier: `site-text:${input.entry.key}`,
			note: words
		})
	]);
	const saved = await database
		.prepare(
			`SELECT ${versionColumns} FROM site_text_versions v LEFT JOIN people ON people.identifier = v.person_identifier
			 WHERE v.text_key = ? ORDER BY v.identifier DESC LIMIT 1`
		)
		.bind(input.entry.key)
		.first<SiteTextVersion>();
	if (!saved) throw new Error('The saved version could not be read back.');
	return saved;
}

/**
 * Publishes drafts: all of them, or only the named ones. Returns the new
 * publication's number, or null when there was nothing to publish.
 */
export async function publish(database: D1Database, personIdentifier: string, keys?: readonly string[]): Promise<number | null> {
	const waiting = (await drafts(database)).filter((state) => !keys || keys.includes(state.key));
	if (waiting.length === 0) return null;
	const publishedAt = now();
	await database.batch([
		database.prepare('INSERT INTO site_text_publications (person_identifier, published_at) VALUES (?, ?)').bind(personIdentifier, publishedAt),
		...waiting.map((state) =>
			database
				.prepare(
					`INSERT INTO site_text_published (publication, text_key, version)
					 VALUES ((SELECT MAX(number) FROM site_text_publications), ?, ?)`
				)
				.bind(state.key, state.draft?.identifier ?? 0)
		),
		activityStatement(database, {
			personIdentifier,
			action: `Published ${waiting.length === 1 ? 'a change' : `${waiting.length} changes`} to the site text`,
			targetKind: 'document',
			targetIdentifier: 'site-text',
			note: waiting.map((state) => state.key).join(' ')
		})
	]);
	return latestPublication(database);
}

/**
 * Undoes the newest publication by publishing again what each of its pieces
 * said before. A piece that had never been published goes back to its
 * built-in words, through a new version that says so.
 */
export async function undoLatestPublication(
	database: D1Database,
	personIdentifier: string,
	catalog: ReadonlyMap<string, SiteTextEntry>
): Promise<number | null> {
	const latest = await latestPublication(database);
	if (latest === 0) return null;
	const pieces = await database
		.prepare(
			`SELECT p.text_key AS key, v.built_in_words AS builtInWords, v.source_file AS sourceFile,
			        (SELECT earlier.version FROM site_text_published earlier
			         WHERE earlier.text_key = p.text_key AND earlier.publication < p.publication
			         ORDER BY earlier.publication DESC LIMIT 1) AS earlierVersion
			 FROM site_text_published p JOIN site_text_versions v ON v.identifier = p.version
			 WHERE p.publication = ?`
		)
		.bind(latest)
		.all<{ key: string; builtInWords: string; sourceFile: string; earlierVersion: number | null }>();
	const time = now();
	const statements = [
		database
			.prepare('INSERT INTO site_text_publications (person_identifier, undoes, published_at) VALUES (?, ?, ?)')
			.bind(personIdentifier, latest, time)
	];
	for (const piece of pieces.results) {
		if (piece.earlierVersion !== null) {
			statements.push(
				database
					.prepare(`INSERT INTO site_text_published (publication, text_key, version) VALUES ((SELECT MAX(number) FROM site_text_publications), ?, ?)`)
					.bind(piece.key, piece.earlierVersion)
			);
			continue;
		}
		const entry = catalog.get(piece.key);
		statements.push(
			database
				.prepare(
					`INSERT INTO site_text_versions (text_key, words, built_in_words, source_file, page, person_identifier, created_at)
					 VALUES (?, NULL, ?, ?, NULL, ?, ?)`
				)
				.bind(piece.key, entry?.words ?? piece.builtInWords, entry?.file ?? piece.sourceFile, personIdentifier, time),
			database
				.prepare(
					`INSERT INTO site_text_published (publication, text_key, version)
					 VALUES ((SELECT MAX(number) FROM site_text_publications), ?, (SELECT MAX(identifier) FROM site_text_versions WHERE text_key = ?))`
				)
				.bind(piece.key, piece.key)
		);
	}
	statements.push(
		activityStatement(database, {
			personIdentifier,
			action: `Undid publication ${latest} of the site text`,
			targetKind: 'document',
			targetIdentifier: 'site-text',
			note: null
		})
	);
	await database.batch(statements);
	return latestPublication(database);
}

/** Every version of one piece of text, newest first, with the publications that put each live. */
export async function history(database: D1Database, key: string): Promise<(SiteTextVersion & { publications: number[] })[]> {
	const [versions, published] = await Promise.all([
		database
			.prepare(
				`SELECT ${versionColumns} FROM site_text_versions v LEFT JOIN people ON people.identifier = v.person_identifier
				 WHERE v.text_key = ? ORDER BY v.identifier DESC`
			)
			.bind(key)
			.all<SiteTextVersion>(),
		database
			.prepare('SELECT version, publication FROM site_text_published WHERE text_key = ? ORDER BY publication')
			.bind(key)
			.all<{ version: number; publication: number }>()
	]);
	return versions.results.map((version) => ({
		...version,
		publications: published.results.filter((row) => row.version === version.identifier).map((row) => row.publication)
	}));
}

export interface PublicationRow {
	number: number;
	personName: string | null;
	undoes: number | null;
	publishedAt: string;
	changes: number;
}

/** The newest publications first. */
export async function publications(database: D1Database, limit = 50): Promise<PublicationRow[]> {
	const result = await database
		.prepare(
			`SELECT publication.number, people.display_name AS personName, publication.undoes, publication.published_at AS publishedAt,
			        (SELECT COUNT(*) FROM site_text_published WHERE site_text_published.publication = publication.number) AS changes
			 FROM site_text_publications publication
			 LEFT JOIN people ON people.identifier = publication.person_identifier
			 ORDER BY publication.number DESC LIMIT ?`
		)
		.bind(limit)
		.all<PublicationRow>();
	return result.results;
}

// ---------------------------------------------------------------------------
// Rebuilding the site with the published words
// ---------------------------------------------------------------------------

export type RebuildReason = 'published' | 'missed';

/**
 * Asks Cloudflare to rebuild and deploy the site through its deploy hook
 * (the secret SITE_REBUILD_HOOK_URL), and records the answer. Without the
 * hook, the words go live with the next deploy.
 */
export async function requestRebuild(
	database: D1Database,
	hook: string | undefined,
	publication: number,
	reason: RebuildReason,
	fetcher: typeof fetch = fetch
): Promise<string> {
	let outcome: string;
	if (!hook) {
		outcome = 'no deploy hook';
	} else {
		try {
			const response = await fetcher(hook, { method: 'POST' });
			outcome = response.ok ? 'asked' : `refused (${response.status})`;
		} catch (problem) {
			outcome = `failed (${String(problem).slice(0, 200)})`;
		}
	}
	await database
		.prepare('INSERT INTO site_text_rebuilds (publication, reason, outcome, requested_at) VALUES (?, ?, ?, ?)')
		.bind(publication, reason, outcome, now())
		.run();
	return outcome;
}

/** How long to wait for a build to finish before asking again. */
const rebuildPatience = 30 * 60 * 1000;
/** How many times to ask again for one publication before leaving it to a person. */
const missedAsksLimit = 3;

/**
 * The hourly check: if this build carries an older publication than the
 * newest, and no rebuild was asked for in the last half hour, ask again, up
 * to three times for one publication.
 */
export async function checkMissedRebuild(
	database: D1Database,
	hook: string | undefined,
	builtPublication: number,
	time: Date = new Date(),
	fetcher: typeof fetch = fetch
): Promise<{ latest: number; built: number; outcome: string }> {
	const latest = await latestPublication(database);
	if (latest <= builtPublication) return { latest, built: builtPublication, outcome: 'up to date' };
	const asks = await database
		.prepare(`SELECT reason, requested_at AS requestedAt FROM site_text_rebuilds WHERE publication >= ? ORDER BY identifier DESC`)
		.bind(latest)
		.all<{ reason: RebuildReason; requestedAt: string }>();
	const newest = asks.results[0];
	if (newest && time.getTime() - Date.parse(newest.requestedAt) < rebuildPatience) {
		return { latest, built: builtPublication, outcome: 'waiting for the build' };
	}
	if (asks.results.filter((ask) => ask.reason === 'missed').length >= missedAsksLimit) {
		return { latest, built: builtPublication, outcome: 'gave up; check the Workers Builds log' };
	}
	return { latest, built: builtPublication, outcome: await requestRebuild(database, hook, latest, 'missed', fetcher) };
}

/** The newest rebuild asked for, for the workspace page. */
export async function latestRebuild(database: D1Database): Promise<{ publication: number; outcome: string; requestedAt: string } | null> {
	return database
		.prepare('SELECT publication, outcome, requested_at AS requestedAt FROM site_text_rebuilds ORDER BY identifier DESC LIMIT 1')
		.first<{ publication: number; outcome: string; requestedAt: string }>();
}
