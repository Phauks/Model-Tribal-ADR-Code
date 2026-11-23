/**
 * Storage for the changes a nation's team makes to its own page (decision
 * record 0041, "Stage 2"; migration 0016). Every publish adds a version, and
 * the page shows, for each kind of change, the newest published version
 * whose time to go live has come. Earlier versions stay for restoring and
 * for the project's review; nation pages never get a public history.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import {
	describeChange,
	emptyContent,
	liveAt,
	pageLogTarget,
	pictureKey,
	readContent,
	type ChangeContents,
	type ChangeKind,
	type NationPicture
} from '../nation-page-changes.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';
import type { UploadedFile } from './request-form.ts';

export interface ChangeRow<K extends ChangeKind = ChangeKind> {
	identifier: string;
	nationIdentifier: string;
	kind: K;
	content: ChangeContents[K];
	credit: string;
	status: 'draft' | 'published' | 'discarded';
	writtenBy: string;
	writtenByName: string | null;
	writtenAt: string;
	publishedBy: string | null;
	publishedByName: string | null;
	publishedAt: string | null;
	liveAt: string | null;
	approvedBy: string | null;
	approvedByName: string | null;
	approvedAt: string | null;
	restoredFrom: string | null;
	discardedAt: string | null;
}

type StoredChange = Omit<ChangeRow, 'content'> & { content: string };

const changeColumns = `nation_page_changes.identifier, nation_page_changes.nation_identifier AS nationIdentifier,
	nation_page_changes.kind, nation_page_changes.content, nation_page_changes.credit, nation_page_changes.status,
	nation_page_changes.written_by AS writtenBy, writer.display_name AS writtenByName,
	nation_page_changes.written_at AS writtenAt, nation_page_changes.published_by AS publishedBy,
	publisher.display_name AS publishedByName, nation_page_changes.published_at AS publishedAt,
	nation_page_changes.live_at AS liveAt, nation_page_changes.approved_by AS approvedBy,
	approver.display_name AS approvedByName, nation_page_changes.approved_at AS approvedAt,
	nation_page_changes.restored_from AS restoredFrom, nation_page_changes.discarded_at AS discardedAt`;

const changeTables = `nation_page_changes
	LEFT JOIN people AS writer ON writer.identifier = nation_page_changes.written_by
	LEFT JOIN people AS publisher ON publisher.identifier = nation_page_changes.published_by
	LEFT JOIN people AS approver ON approver.identifier = nation_page_changes.approved_by`;

function fromStored(row: StoredChange): ChangeRow {
	let raw: unknown = {};
	try {
		raw = JSON.parse(row.content);
	} catch {
		raw = emptyContent(row.kind);
	}
	return { ...row, content: readContent(row.kind, raw).content };
}

/** What the page shows now: for each kind, the newest published version that is live. */
export type LiveChanges = { [K in ChangeKind]?: ChangeRow<K> };

export async function liveChanges(database: D1Database, nationIdentifier: string, time = now()): Promise<LiveChanges> {
	const result = await database
		.prepare(
			`SELECT * FROM (
				SELECT ${changeColumns},
				       ROW_NUMBER() OVER (PARTITION BY nation_page_changes.kind
				                          ORDER BY nation_page_changes.live_at DESC, nation_page_changes.published_at DESC, nation_page_changes.rowid DESC) AS position
				FROM ${changeTables}
				WHERE nation_page_changes.nation_identifier = ? AND nation_page_changes.status = 'published'
				  AND nation_page_changes.live_at <= ?
			) WHERE position = 1`
		)
		.bind(nationIdentifier, time)
		.all<StoredChange & { position: number }>();
	const live: LiveChanges = {};
	for (const row of result.results) {
		const { position: _position, ...stored } = row;
		(live as Record<ChangeKind, ChangeRow>)[row.kind] = fromStored(stored);
	}
	return live;
}

/** Published changes still waiting to go live, soonest first. */
export async function waitingChanges(database: D1Database, nationIdentifier: string, time = now()): Promise<ChangeRow[]> {
	const result = await database
		.prepare(
			`SELECT ${changeColumns} FROM ${changeTables}
			 WHERE nation_page_changes.nation_identifier = ? AND nation_page_changes.status = 'published'
			   AND nation_page_changes.live_at > ?
			 ORDER BY nation_page_changes.live_at`
		)
		.bind(nationIdentifier, time)
		.all<StoredChange>();
	return result.results.map(fromStored);
}

/** Drafts not yet published or thrown away, newest first. */
export async function draftsOf(database: D1Database, nationIdentifier: string): Promise<ChangeRow[]> {
	const result = await database
		.prepare(
			`SELECT ${changeColumns} FROM ${changeTables}
			 WHERE nation_page_changes.nation_identifier = ? AND nation_page_changes.status = 'draft'
			 ORDER BY nation_page_changes.written_at DESC, nation_page_changes.rowid DESC`
		)
		.bind(nationIdentifier)
		.all<StoredChange>();
	return result.results.map(fromStored);
}

/** Every published or thrown-away version, newest first: the private history the team and the project see. */
export async function historyOf(database: D1Database, nationIdentifier: string): Promise<ChangeRow[]> {
	const result = await database
		.prepare(
			`SELECT ${changeColumns} FROM ${changeTables}
			 WHERE nation_page_changes.nation_identifier = ? AND nation_page_changes.status != 'draft'
			 ORDER BY COALESCE(nation_page_changes.published_at, nation_page_changes.discarded_at, nation_page_changes.written_at) DESC,
			          nation_page_changes.rowid DESC`
		)
		.bind(nationIdentifier)
		.all<StoredChange>();
	return result.results.map(fromStored);
}

export async function changeByIdentifier(database: D1Database, identifier: string): Promise<ChangeRow | undefined> {
	const row = await database
		.prepare(`SELECT ${changeColumns} FROM ${changeTables} WHERE nation_page_changes.identifier = ?`)
		.bind(identifier)
		.first<StoredChange>();
	return row ? fromStored(row) : undefined;
}

export interface NewChange<K extends ChangeKind = ChangeKind> {
	nationIdentifier: string;
	kind: K;
	content: ChangeContents[K];
	credit: string;
	restoredFrom?: string | null;
}

function logChange(database: D1Database, person: SignedInPerson, change: NewChange, action: string, note?: string) {
	return eventStatement(database, {
		personIdentifier: person.identifier,
		action: `${action}: ${describeChange(change.kind, change.content)}`,
		targetKind: 'document',
		targetIdentifier: pageLogTarget(change.nationIdentifier),
		note: note ?? null
	});
}

/** Saves a draft. The writer's earlier draft of the same kind is replaced, so each person keeps one draft per part. */
export async function saveDraft(database: D1Database, change: NewChange, person: SignedInPerson, time = now()): Promise<string> {
	const identifier = newIdentifier();
	await database.batch([
		database
			.prepare(
				`UPDATE nation_page_changes SET status = 'discarded', discarded_by = ?, discarded_at = ?
				 WHERE nation_identifier = ? AND kind = ? AND written_by = ? AND status = 'draft'`
			)
			.bind(person.identifier, time, change.nationIdentifier, change.kind, person.identifier),
		database
			.prepare(
				`INSERT INTO nation_page_changes (identifier, nation_identifier, kind, content, credit, status, written_by, written_at)
				 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
			)
			.bind(identifier, change.nationIdentifier, change.kind, JSON.stringify(change.content), change.credit, person.identifier, time),
		logChange(database, person, change, 'Draft saved')
	]);
	return identifier;
}

/** Publishes a change. Contacts wait three days; everything else is live at once. */
export async function publishChange(
	database: D1Database,
	change: NewChange,
	person: SignedInPerson,
	time = new Date()
): Promise<{ identifier: string; liveAt: string }> {
	const identifier = newIdentifier();
	const publishedAt = time.toISOString();
	const goesLive = liveAt(change.kind, time);
	await database.batch([
		database
			.prepare(
				`INSERT INTO nation_page_changes (identifier, nation_identifier, kind, content, credit, status, written_by, written_at,
				   published_by, published_at, live_at, restored_from)
				 VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				change.nationIdentifier,
				change.kind,
				JSON.stringify(change.content),
				change.credit,
				person.identifier,
				publishedAt,
				person.identifier,
				publishedAt,
				goesLive,
				change.restoredFrom ?? null
			),
		logChange(
			database,
			person,
			change,
			change.restoredFrom ? 'Earlier version restored' : 'Published',
			goesLive > publishedAt ? `Goes live ${goesLive.slice(0, 10)} unless another editor approves it sooner` : undefined
		)
	]);
	return { identifier, liveAt: goesLive };
}

/** Publishes someone's draft, which keeps its writer; the publisher is recorded beside them. */
export async function publishDraft(
	database: D1Database,
	draft: ChangeRow,
	person: SignedInPerson,
	time = new Date()
): Promise<{ liveAt: string }> {
	const publishedAt = time.toISOString();
	const goesLive = liveAt(draft.kind, time);
	await database.batch([
		database
			.prepare(
				`UPDATE nation_page_changes SET status = 'published', published_by = ?, published_at = ?, live_at = ?
				 WHERE identifier = ? AND status = 'draft'`
			)
			.bind(person.identifier, publishedAt, goesLive, draft.identifier),
		logChange(database, person, draft, `Draft by ${draft.writtenByName ?? 'a team member'} published`)
	]);
	return { liveAt: goesLive };
}

/** A second editor lets a waiting change go live now. */
export async function approveEarly(database: D1Database, change: ChangeRow, person: SignedInPerson, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE nation_page_changes SET live_at = ?, approved_by = ?, approved_at = ?
				 WHERE identifier = ? AND status = 'published' AND live_at > ?`
			)
			.bind(time, person.identifier, time, change.identifier, time),
		logChange(database, person, change, 'Approved early by a second editor')
	]);
}

/** Throws away a draft, or cancels a change that is still waiting to go live. */
export async function discardChange(database: D1Database, change: ChangeRow, person: SignedInPerson, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE nation_page_changes SET status = 'discarded', discarded_by = ?, discarded_at = ?
				 WHERE identifier = ? AND (status = 'draft' OR (status = 'published' AND live_at > ?))`
			)
			.bind(person.identifier, time, change.identifier, time),
		logChange(database, person, change, change.status === 'draft' ? 'Draft thrown away' : 'Waiting change cancelled')
	]);
}

/** Every picture a nation's changes have ever named, so the team can preview drafts and earlier versions. */
export async function picturesEverNamed(database: D1Database, nationIdentifier: string): Promise<NationPicture[]> {
	const result = await database
		.prepare(`SELECT content FROM nation_page_changes WHERE nation_identifier = ? AND kind = 'pictures'`)
		.bind(nationIdentifier)
		.all<{ content: string }>();
	const pictures = new Map<string, NationPicture>();
	for (const row of result.results) {
		let raw: unknown = {};
		try {
			raw = JSON.parse(row.content);
		} catch {
			continue;
		}
		for (const picture of readContent('pictures', raw).content.pictures) pictures.set(picture.identifier, picture);
	}
	return [...pictures.values()];
}

/**
 * Keeps an uploaded picture in the private bucket. Pictures are never
 * deleted there, so an earlier version can always be restored; only the
 * pictures in the live version are served to readers.
 */
export async function savePicture(bucket: R2Bucket, nationIdentifier: string, file: UploadedFile): Promise<string> {
	const identifier = newIdentifier();
	await bucket.put(pictureKey(nationIdentifier, identifier), file.bytes, {
		httpMetadata: { contentType: file.type },
		customMetadata: { fileName: file.name }
	});
	return identifier;
}
