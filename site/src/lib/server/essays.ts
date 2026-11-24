/**
 * Essays in the private bucket (docs/editing.md, decision record 0021). Every
 * save writes a new file, essays/<id>/versions/<number>-<hash>.md, that is
 * never replaced: the write is refused if the name is taken
 * (If-None-Match: *), and a bucket lock on essays/ stops deletion. D1 lists
 * the versions, who saved each and which is published.
 *
 * A save names the version the writer started from. If someone else saved
 * in the meantime, the save is refused as a conflict, so nobody's work is
 * silently overwritten; the editor then shows both texts.
 */
import type { D1Database, R2Bucket, R2Conditional } from '@cloudflare/workers-types/index.ts';
import { eventStatement } from './events.ts';
import { now } from './identifiers.ts';
import { frontMatterField, splitFrontMatter } from '../essays/syntax.ts';

export const essayParts = ['foundations', 'essays', 'back-matter', 'about'] as const;
export type EssayPart = (typeof essayParts)[number];

/**
 * The pages about the site that are edited like the essays, such as the
 * About page, by id, with the address each has always had. Each needs its
 * own route, so new ones are added here and in src/routes, never started in
 * the workspace (Trevor, Nov. 23, 2026: "Continue with page editing").
 */
export const aboutPageAddresses: Record<string, string> = {
	about: '/about',
	sponsor: '/sponsor',
	'using-ai': '/using-ai'
};

/** The parts a new essay can be started in from the workspace. */
export const startableEssayParts: readonly EssayPart[] = essayParts.filter((part) => part !== 'about');

/** The largest essay file accepted, well above the longest essay (about 250 KB). */
export const largestEssayBytes = 2_000_000;

export interface EssayRow {
	identifier: string;
	part: EssayPart;
	created_at: string;
}

export interface VersionRow {
	essay_identifier: string;
	number: number;
	object_key: string;
	sha256: string;
	bytes: number;
	title: string;
	note: string | null;
	based_on: number | null;
	origin: 'editor' | 'git' | 'restore';
	person_identifier: string | null;
	person_name?: string | null;
	created_at: string;
}

export interface PublicationRow {
	essay_identifier: string;
	number: number;
	version_number: number;
	listed: number;
	person_identifier: string | null;
	person_name?: string | null;
	published_at: string;
	title?: string;
	object_key?: string;
	sha256?: string;
	bytes?: number;
}

export interface EssaySummary extends EssayRow {
	title: string;
	latestVersion: number | null;
	latestSavedAt: string | null;
	published: { number: number; versionNumber: number; publishedAt: string; title: string } | null;
}

/**
 * An essay's part, from its id ("i-…" is Part I, the Foundations) or its
 * front matter. Back matter, such as the index of cases by topic, says
 * "part: back-matter", and a page about the site "part: about".
 */
export function partOf(identifier: string, frontMatter = ''): EssayPart {
	const part = frontMatterField(frontMatter, 'part');
	if (part === 'back-matter') return 'back-matter';
	if (part === 'about') return 'about';
	if (part === 'i' || identifier.startsWith('i-')) return 'foundations';
	return 'essays';
}

/** The address of an essay's page: Part I chapters sit under Foundations, without the "i-". */
export function essayPath(identifier: string, part: EssayPart): string {
	if (part === 'foundations') return `/foundations/${identifier.replace(/^i-/, '')}`;
	if (part === 'about') return aboutPageAddresses[identifier] ?? `/${identifier}`;
	return part === 'back-matter' ? `/back-matter/${identifier}` : `/essays/${identifier}`;
}

/**
 * The page each case or law box sits on ("case-<key>" to its essay's
 * address), so that a link such as "#case-<key>" on another page, for
 * example in the index of cases by topic, can point to the box.
 */
export function boxPages(texts: Record<string, string>): Record<string, string> {
	const pages: Record<string, string> = {};
	for (const [identifier, text] of Object.entries(texts)) {
		const path = essayPath(identifier, partOf(identifier, splitFrontMatter(text).frontMatter));
		for (const match of text.matchAll(/^:{4,}[ \t]*(case|law)[ \t]+([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/gm)) {
			pages[`${match[1]}-${match[2]}`] ??= path;
		}
	}
	return pages;
}

/** The essay a page address names, the reverse of essayPath. */
export function identifierFromPath(part: EssayPart, slug: string): string {
	return part === 'foundations' ? `i-${slug}` : slug;
}

export function isEssayIdentifier(identifier: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifier) && identifier.length <= 120;
}

/** An essay's title, from its front matter or else its first heading. */
export function titleOf(text: string): string {
	const { frontMatter, body } = splitFrontMatter(text);
	return (
		frontMatterField(frontMatter, 'title')?.trim() ||
		/^#\s+(.+)$/m.exec(body)?.[1]?.trim() ||
		'Untitled'
	);
}

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The essays with a version this person saved that is not published yet,
 * newest first, for "Your drafts" in the sidebar while editing
 * (src/lib/essays/editing-outline.svelte.ts).
 */
export async function draftsBy(database: D1Database, person: string): Promise<{ title: string; link: string }[]> {
	const { results } = await database
		.prepare(
			`SELECT e.identifier, e.part,
				(SELECT title FROM essay_versions WHERE essay_identifier = e.identifier ORDER BY number DESC LIMIT 1) AS title,
				(SELECT MAX(created_at) FROM essay_versions WHERE essay_identifier = e.identifier AND person_identifier = ?1) AS saved_at
			 FROM essays e
			 WHERE EXISTS (
				SELECT 1 FROM essay_versions v
				WHERE v.essay_identifier = e.identifier AND v.person_identifier = ?1
					AND v.number > COALESCE((SELECT MAX(version_number) FROM essay_publications p WHERE p.essay_identifier = e.identifier AND p.listed = 1), 0)
			 )
			 ORDER BY saved_at DESC`
		)
		.bind(person)
		.all<{ identifier: string; part: EssayPart; title: string | null }>();
	return results.map((row) => ({ title: row.title || row.identifier, link: essayPath(row.identifier, row.part) }));
}

export async function listEssays(database: D1Database): Promise<EssaySummary[]> {
	const { results } = await database
		.prepare(
			`SELECT e.identifier, e.part, e.created_at,
				v.number AS latest_version, v.title AS latest_title, v.created_at AS latest_saved_at,
				p.number AS publication_number, p.version_number AS published_version, p.published_at,
				pv.title AS published_title
			 FROM essays e
			 LEFT JOIN essay_versions v ON v.essay_identifier = e.identifier
				AND v.number = (SELECT MAX(number) FROM essay_versions WHERE essay_identifier = e.identifier)
			 LEFT JOIN essay_publications p ON p.essay_identifier = e.identifier
				AND p.number = (SELECT MAX(number) FROM essay_publications WHERE essay_identifier = e.identifier AND listed = 1)
			 LEFT JOIN essay_versions pv ON pv.essay_identifier = p.essay_identifier AND pv.number = p.version_number
			 ORDER BY e.part, e.identifier`
		)
		.all<{
			identifier: string;
			part: EssayPart;
			created_at: string;
			latest_version: number | null;
			latest_title: string | null;
			latest_saved_at: string | null;
			publication_number: number | null;
			published_version: number | null;
			published_at: string | null;
			published_title: string | null;
		}>();
	return results.map((row) => ({
		identifier: row.identifier,
		part: row.part,
		created_at: row.created_at,
		title: row.latest_title ?? row.identifier,
		latestVersion: row.latest_version,
		latestSavedAt: row.latest_saved_at,
		published:
			row.publication_number === null
				? null
				: {
						number: row.publication_number,
						versionNumber: row.published_version!,
						publishedAt: row.published_at!,
						title: row.published_title ?? row.identifier
					}
	}));
}

export async function essayRow(database: D1Database, identifier: string): Promise<EssayRow | null> {
	return database.prepare('SELECT identifier, part, created_at FROM essays WHERE identifier = ?').bind(identifier).first<EssayRow>();
}

export async function versions(database: D1Database, identifier: string): Promise<VersionRow[]> {
	const { results } = await database
		.prepare(
			`SELECT v.*, people.display_name AS person_name FROM essay_versions v
			 LEFT JOIN people ON people.identifier = v.person_identifier
			 WHERE v.essay_identifier = ? ORDER BY v.number DESC`
		)
		.bind(identifier)
		.all<VersionRow>();
	return results;
}

export async function version(database: D1Database, identifier: string, number: number): Promise<VersionRow | null> {
	return database
		.prepare(
			`SELECT v.*, people.display_name AS person_name FROM essay_versions v
			 LEFT JOIN people ON people.identifier = v.person_identifier
			 WHERE v.essay_identifier = ? AND v.number = ?`
		)
		.bind(identifier, number)
		.first<VersionRow>();
}

export async function latestVersion(database: D1Database, identifier: string): Promise<VersionRow | null> {
	return database
		.prepare('SELECT * FROM essay_versions WHERE essay_identifier = ? ORDER BY number DESC LIMIT 1')
		.bind(identifier)
		.first<VersionRow>();
}

/** Every publication of an essay, newest first; with `listedOnly`, only those readers may see. */
export async function publications(database: D1Database, identifier: string, listedOnly = true): Promise<PublicationRow[]> {
	const { results } = await database
		.prepare(
			`SELECT p.*, v.title, v.object_key, v.sha256, v.bytes, people.display_name AS person_name
			 FROM essay_publications p
			 JOIN essay_versions v ON v.essay_identifier = p.essay_identifier AND v.number = p.version_number
			 LEFT JOIN people ON people.identifier = p.person_identifier
			 WHERE p.essay_identifier = ? ${listedOnly ? 'AND p.listed = 1' : ''}
			 ORDER BY p.number DESC`
		)
		.bind(identifier)
		.all<PublicationRow>();
	return results;
}

/** Every listed publication of every essay, for the public list the git copy reads. */
export async function allListedPublications(database: D1Database): Promise<(PublicationRow & { part: EssayPart })[]> {
	const { results } = await database
		.prepare(
			`SELECT p.*, e.part, v.title, v.object_key, v.sha256, v.bytes
			 FROM essay_publications p
			 JOIN essays e ON e.identifier = p.essay_identifier
			 JOIN essay_versions v ON v.essay_identifier = p.essay_identifier AND v.number = p.version_number
			 WHERE p.listed = 1
			 ORDER BY p.essay_identifier, p.number`
		)
		.all<PublicationRow & { part: EssayPart }>();
	return results;
}

export async function readVersionText(bucket: R2Bucket, row: Pick<VersionRow, 'object_key'>): Promise<string> {
	const object = await bucket.get(row.object_key);
	if (!object) throw new Error(`The file ${row.object_key} is missing from the bucket.`);
	return (await object.text()).normalize('NFC');
}

export class SaveConflict extends Error {
	constructor(readonly latest: number) {
		super(`Someone saved version ${latest} after you started editing.`);
	}
}

export interface SaveInput {
	identifier: string;
	text: string;
	/** The version the writer started from; null for a new essay. */
	basedOn: number | null;
	/** Who saved it; null when the site saved text that came from git. */
	personIdentifier: string | null;
	note?: string | null;
	/** Save a new version even when the text is the same as the newest one's: naming it ("Name this version"). */
	evenIfUnchanged?: boolean;
	origin: VersionRow['origin'];
	/** For a new essay. */
	part?: EssayPart;
}

/**
 * Saves a new version. Refused with SaveConflict when the essay has a newer
 * version than `basedOn`. Returns the new version, or the latest one
 * unchanged when the text is the same as the latest version's.
 */
export async function saveVersion(
	database: D1Database,
	bucket: R2Bucket,
	input: SaveInput
): Promise<{ version: VersionRow; unchanged: boolean }> {
	if (!isEssayIdentifier(input.identifier)) throw new Error('An essay id is lower-case letters, numbers and hyphens.');
	const text = input.text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\s*$/, '\n');
	const bytes = new TextEncoder().encode(text).byteLength;
	if (bytes > largestEssayBytes) throw new Error('This essay is too long to save in one file.');

	const latest = await latestVersion(database, input.identifier);
	if ((latest?.number ?? null) !== input.basedOn) throw new SaveConflict(latest?.number ?? 0);

	const sha256 = await sha256Hex(text);
	if (latest && latest.sha256 === sha256 && !input.evenIfUnchanged) return { version: latest, unchanged: true };

	const number = (latest?.number ?? 0) + 1;
	const objectKey = `essays/${input.identifier}/versions/${number}-${sha256.slice(0, 12)}.md`;
	const title = titleOf(text);
	const createdAt = now();
	const stored = await bucket.put(objectKey, text, {
		// Workers accept HTTP condition headers here (Cloudflare, "Workers API reference", R2PutOptions).
		onlyIf: new Headers({ 'If-None-Match': '*' }) as unknown as R2Conditional,
		sha256,
		httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
		customMetadata: { essay: input.identifier, version: String(number), savedBy: input.personIdentifier ?? 'git' }
	});
	// null: a file with this name exists already, which can only be the same
	// text saved by a request that failed before it was recorded.
	if (!stored && !(await bucket.head(objectKey))) throw new Error('The bucket did not store the file.');

	const statements = [];
	if (!latest && !(await essayRow(database, input.identifier))) {
		statements.push(
			database
				.prepare('INSERT INTO essays (identifier, part, created_at, created_by) VALUES (?, ?, ?, ?)')
				.bind(input.identifier, input.part ?? partOf(input.identifier, splitFrontMatter(text).frontMatter), createdAt, input.personIdentifier)
		);
	}
	statements.push(
		database
			.prepare(
				`INSERT INTO essay_versions (essay_identifier, number, object_key, sha256, bytes, title, note, based_on, origin, person_identifier, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(input.identifier, number, objectKey, sha256, bytes, title, input.note ?? null, input.basedOn, input.origin, input.personIdentifier, createdAt),
		eventStatement(database, {
			personIdentifier: input.personIdentifier,
			action:
				input.origin === 'git'
					? `Brought in the git text as version ${number}`
					: input.origin === 'restore'
						? `Restored an earlier text as version ${number}`
						: `Saved version ${number}`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.identifier}`,
			note: input.note ?? null
		})
	);
	try {
		await database.batch(statements);
	} catch (problem) {
		// Two saves of the same version at once: the database keeps one.
		if (/UNIQUE|PRIMARY KEY|constraint/i.test(String(problem))) {
			throw new SaveConflict((await latestVersion(database, input.identifier))?.number ?? number);
		}
		throw problem;
	}
	return {
		version: {
			essay_identifier: input.identifier,
			number,
			object_key: objectKey,
			sha256,
			bytes,
			title,
			note: input.note ?? null,
			based_on: input.basedOn,
			origin: input.origin,
			person_identifier: input.personIdentifier,
			created_at: createdAt
		},
		unchanged: false
	};
}

/** Publishes a saved version: it becomes the essay's page. */
export async function publishVersion(
	database: D1Database,
	identifier: string,
	versionNumber: number,
	personIdentifier: string
): Promise<number> {
	const saved = await version(database, identifier, versionNumber);
	if (!saved) throw new Error(`Version ${versionNumber} does not exist.`);
	const last = await database
		.prepare('SELECT MAX(number) AS number FROM essay_publications WHERE essay_identifier = ?')
		.bind(identifier)
		.first<{ number: number | null }>();
	const number = (last?.number ?? 0) + 1;
	await database.batch([
		database
			.prepare(
				`INSERT INTO essay_publications (essay_identifier, number, version_number, listed, person_identifier, published_at)
				 VALUES (?, ?, ?, 1, ?, ?)`
			)
			.bind(identifier, number, versionNumber, personIdentifier, now()),
		eventStatement(database, {
			personIdentifier,
			action: `Published version ${versionNumber} as publication ${number}`,
			targetKind: 'document',
			targetIdentifier: `essay:${identifier}`
		})
	]);
	return number;
}

/** Holds a publication back from readers, or lists it again. */
export async function setPublicationListed(
	database: D1Database,
	identifier: string,
	number: number,
	listed: boolean,
	personIdentifier: string,
	reason: string | null
): Promise<void> {
	await database.batch([
		database
			.prepare('UPDATE essay_publications SET listed = ? WHERE essay_identifier = ? AND number = ?')
			.bind(listed ? 1 : 0, identifier, number),
		eventStatement(database, {
			personIdentifier,
			action: listed ? `Listed publication ${number} again` : `Held back publication ${number}`,
			targetKind: 'document',
			targetIdentifier: `essay:${identifier}`,
			note: reason
		})
	]);
}

/** The newest publication readers may see, with its text. */
export async function currentPublication(
	database: D1Database,
	bucket: R2Bucket,
	identifier: string,
	number?: number
): Promise<{ publication: PublicationRow; text: string } | null> {
	const rows = await publications(database, identifier, true);
	const publication = number === undefined ? rows[0] : rows.find((row) => row.number === number);
	if (!publication?.object_key) return null;
	return { publication, text: await readVersionText(bucket, { object_key: publication.object_key }) };
}
