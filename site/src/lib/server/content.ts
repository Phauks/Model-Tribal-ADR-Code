/**
 * Reads the plain-text records in the repository (decision record 0004) when
 * the site is built. Every page is prerendered, so this code runs only at
 * build time, in Node, never in the deployed Worker. vite.config.ts also
 * imports it, to list the content co-authors review, so it must not use
 * Vite-only imports such as "?raw" (versions.ts has those).
 *
 * Paths are relative to the repository root, one folder above site/, which is
 * where npm runs during development and in Cloudflare Workers Builds (root
 * directory: site).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { StoryRecord } from '../story-visibility.ts';
import { imageMayBeShown, type OfficialImageRecord, type ServableImage } from '../official-images.ts';
import { parseCsv } from '../csv.ts';
import { copiesByLink, linkForMatching, servedMediaTypes, type PublicCopy } from '../public-copies.ts';

export const repositoryRoot = path.resolve(process.cwd(), '..');

function readText(relativePath: string): string {
	return readFileSync(path.join(repositoryRoot, relativePath), 'utf8').normalize('NFC');
}

function readYaml<Record>(relativePath: string): Record {
	return parse(readText(relativePath)) as Record;
}

/** Every .yaml file under a folder, including first-letter subfolders, sorted by path. */
function yamlFilesUnder(relativeFolder: string): string[] {
	const absoluteFolder = path.join(repositoryRoot, relativeFolder);
	if (!existsSync(absoluteFolder)) return [];
	const found: string[] = [];
	for (const name of readdirSync(absoluteFolder).sort()) {
		const relativePath = path.posix.join(relativeFolder, name);
		if (statSync(path.join(repositoryRoot, relativePath)).isDirectory()) {
			found.push(...yamlFilesUnder(relativePath));
		} else if (name.endsWith('.yaml')) {
			found.push(relativePath);
		}
	}
	return found;
}

/* Changelogs -------------------------------------------------------------- */

export function readChangelog(track: 'content' | 'site' | 'pdf'): string {
	return readText(`${track}/CHANGELOG.md`);
}

/* Sources ----------------------------------------------------------------- */

export interface CitationName {
	literal?: string;
	family?: string;
	given?: string;
}

export interface SourceRecord {
	key: string;
	kind: string;
	citation: {
		title?: string;
		author?: CitationName[];
		'container-title'?: string;
		issued?: { 'date-parts'?: number[][] };
		URL?: string;
	};
	original_link?: string;
	archives?: { link?: string; url?: string; captured?: string }[];
}

let sourceCache: Map<string, SourceRecord> | undefined;

export function sources(): Map<string, SourceRecord> {
	if (!sourceCache) {
		sourceCache = new Map();
		for (const file of yamlFilesUnder('content/sources')) {
			const record = readYaml<SourceRecord>(file);
			sourceCache.set(record.key, record);
		}
	}
	return sourceCache;
}

/* Glossary ---------------------------------------------------------------- */

export interface GlossaryRecord {
	id: string;
	term: string;
	kind: 'term' | 'acronym' | 'legal-term' | 'phrase';
	expansion?: string;
	usage: 'preferred' | 'acceptable' | 'context-only' | 'avoid';
	definition: string;
	usage_note?: string;
	aliases?: string[];
	use_instead?: string[];
	see_also?: string[];
	sources?: string[];
	basis?: 'source' | 'project-analysis' | 'source-and-project-analysis';
	status?: 'draft' | 'adopted' | 'retired';
	redirect_to?: string;
}

let glossaryCache: GlossaryRecord[] | undefined;

export function glossary(): GlossaryRecord[] {
	if (!glossaryCache) {
		glossaryCache = yamlFilesUnder('content/glossary')
			.map((file) => readYaml<GlossaryRecord>(file))
			.sort((first, second) =>
				first.term.localeCompare(second.term, 'en', { sensitivity: 'base' })
			);
	}
	return glossaryCache;
}

/* Native nations ---------------------------------------------------------- */

/** A cited fact: every fact in a nation record names its source (common.schema.json). */
export interface CitedFact {
	source?: string;
	confidence?: string;
	as_of?: string | number;
	locator?: string;
	note?: string;
	[field: string]: unknown;
}

export interface NationRecord {
	id: string;
	entity_type: string;
	names: {
		official: string;
		official_source?: string;
		self_designation?: (CitedFact & { name: string; language_tag?: string })[];
		former?: (CitedFact & { name: string })[];
		pronunciation?: (CitedFact & {
			name: string;
			language_tag?: string;
			respelling?: string;
			phonetic_transcription?: string;
			recording?: string;
		})[];
	};
	recognition?: (CitedFact & { type: string; legal_basis?: string })[];
	states?: (CitedFact & { state: string; presence?: string })[];
	contacts?: (CitedFact & {
		kind: string;
		value: string;
		label?: string;
		link_status?: 'live' | 'lapsed';
		link_checked?: string;
	})[];
	official_images?: (CitedFact & OfficialImageRecord)[];
	languages?: (CitedFact & { name?: string })[];
	federal_administration?: CitedFact & {
		bureau_of_indian_affairs_region?: string;
		bureau_of_indian_affairs_agency?: string;
	};
	governing_documents?: (CitedFact & { kind: string; title?: string; link?: string })[];
	justice_institutions?: (CitedFact & { kind: string; name: string; link?: string })[];
	dispute_resolution_law?: string[];
	dispute_resolution?: { forums?: (CitedFact & { kind: string; name?: string; link?: string })[] };
	review: { status: string; last_verified?: string; note?: string };
	sensitivity?: { restricted?: boolean; tribal_review_required?: boolean };
	/** Set by this loader, not stored in the record. */
	example?: boolean;
}

/* Document histories ------------------------------------------------------ */

/** One version of a document (schemas/document-history.schema.json). */
export interface DocumentVersion extends CitedFact {
	id: string;
	label?: string;
	event: string;
	status: string;
	/** Left out for a text that gives no date. */
	dates?: Partial<
		Record<
			'signed' | 'adopted' | 'submitted' | 'approved' | 'published' | 'effective' | 'listed' | 'ended',
			string
		>
	>;
	approval?: { authority: string; action: string; source?: string; locator?: string };
	amends?: string[];
	supersedes?: string[];
	clauses?: { topic: string; locator?: string; summary: string }[];
	changes?: {
		topic: string;
		compared_with: string;
		change: string;
		summary?: string;
		locator_before?: string;
		locator_after?: string;
	}[];
}

/** A document over time and every version of it (decision record 0018). */
export interface DocumentHistoryRecord {
	id: string;
	kind: string;
	title: string;
	nations?: string[];
	states?: string[];
	summary?: string;
	versions: DocumentVersion[];
	sensitivity?: { restricted?: boolean; tribal_review_required?: boolean };
}

let documentCache: DocumentHistoryRecord[] | undefined;

/**
 * Every document history in content/documents/ that may be published. A
 * restricted history, or one held for the nation's approval, is left out, as
 * nation records are.
 */
export function documentHistories(): DocumentHistoryRecord[] {
	if (!documentCache) {
		documentCache = yamlFilesUnder('content/documents')
			.map((file) => readYaml<DocumentHistoryRecord>(file))
			.filter(
				(record) => !record.sensitivity?.restricted && !record.sensitivity?.tribal_review_required
			)
			.sort((first, second) => first.title.localeCompare(second.title, 'en', { sensitivity: 'base' }));
	}
	return documentCache;
}

/**
 * Whether a record may appear on the website. A restricted record is never
 * published (data-model.md, sensitivity flags). A record that needs the
 * nation's approval stays off the site until the nation approves it.
 */
function isPublishable(record: NationRecord): boolean {
	if (record.sensitivity?.restricted) return false;
	if (record.sensitivity?.tribal_review_required) {
		return record.review?.status === 'approved-by-nation';
	}
	return true;
}

let nationCache: NationRecord[] | undefined;

/**
 * Every publishable record in content/tribes/. Until real records are merged,
 * the site shows the fictitious example from schemas/examples/ instead, marked
 * as an example, so the page template can be reviewed.
 */
export function nations(): NationRecord[] {
	if (!nationCache) {
		const records = yamlFilesUnder('content/tribes').map((file) => readYaml<NationRecord>(file));
		if (records.length > 0) {
			nationCache = records.filter(isPublishable);
		} else {
			const example = readYaml<NationRecord>('schemas/examples/tribe.example.yaml');
			nationCache = [{ ...example, example: true }];
		}
		nationCache.sort((first, second) =>
			first.names.official.localeCompare(second.names.official, 'en', { sensitivity: 'base' })
		);
	}
	return nationCache;
}

/**
 * Every nation record that is not restricted, including records held back
 * until the nation approves them, because those are the ones a nation
 * reviewer must see in the co-author workspace. Used by vite.config.ts.
 */
export function nationsForReview(): { id: string; name: string; published: boolean; file: string }[] {
	return yamlFilesUnder('content/tribes')
		.map((file) => ({ file, record: readYaml<NationRecord>(file) }))
		.filter(({ record }) => !record.sensitivity?.restricted)
		.map(({ file, record }) => ({
			id: record.id,
			name: record.names.official,
			published: isPublishable(record),
			file
		}))
		.sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }));
}

/** Glossary records with the file each comes from. Used by vite.config.ts. */
export function glossaryForReview(): { id: string; term: string; file: string }[] {
	return yamlFilesUnder('content/glossary').map((file) => {
		const record = readYaml<GlossaryRecord>(file);
		return { id: record.id, term: record.term, file };
	});
}

/**
 * Essays in content/essays, with the title from each file's front matter.
 * The identifier is the file name without ".md". Used by vite.config.ts, so
 * the lead author can grant access to one essay at a time.
 */
export function essaysForReview(): { id: string; title: string; file: string }[] {
	const folder = 'content/essays';
	if (!existsSync(path.join(repositoryRoot, folder))) return [];
	return readdirSync(path.join(repositoryRoot, folder))
		.filter((name) => name.endsWith('.md') && name !== 'README.md')
		.sort()
		.map((name) => {
			const file = path.posix.join(folder, name);
			const frontMatter = /^---\n([\s\S]*?)\n---/.exec(readText(file))?.[1];
			const title = frontMatter ? (parse(frontMatter) as { title?: string }).title : undefined;
			const id = name.replace(/\.md$/, '');
			return { id, title: title?.trim() || id, file };
		});
}

/**
 * The official images the Worker may serve: those of published records whose
 * reuse status allows showing them and that have a private copy. Bundled into
 * the Worker by vite.config.ts, because the Worker cannot read content/.
 */
export function servableImages(): ServableImage[] {
	return nations().flatMap((record) =>
		(record.official_images ?? [])
			.filter((image) => image.private_copy && imageMayBeShown(image))
			.slice(0, 1)
			.map((image) => ({
				nation: record.id,
				key: image.private_copy as string,
				link: image.image_link,
				mediaType: image.media_type ?? 'application/octet-stream',
				sha256: image.sha256
			}))
	);
}

/* Methods ----------------------------------------------------------------- */

export interface MethodRecord {
	id: string;
	name: string;
}

let methodCache: Map<string, MethodRecord> | undefined;

/** Dispute resolution method records in content/methods/, by id. */
export function methods(): Map<string, MethodRecord> {
	if (!methodCache) {
		methodCache = new Map(
			yamlFilesUnder('content/methods').map((file) => {
				const record = readYaml<MethodRecord>(file);
				return [record.id, record];
			})
		);
	}
	return methodCache;
}

/* Stories ----------------------------------------------------------------- */

let storyCache: StoryRecord[] | undefined;

/** Every story record in content/stories/ (schemas/story.schema.json), unfiltered. What the site shows is decided in src/lib/story-visibility.ts. */
export function storyRecords(): StoryRecord[] {
	if (!storyCache) {
		storyCache = yamlFilesUnder('content/stories').map((file) => readYaml<StoryRecord>(file));
	}
	return storyCache;
}

export type { StoryRecord } from '../story-visibility.ts';

/* Copies of public documents --------------------------------------------- */

/**
 * Topics whose files are never shared, whatever a record says: printouts from
 * Westlaw and copies of journal articles (decision record 0027).
 */
const neverServedTopics = new Set(['westlaw', 'articles']);

let publicCopyCache: PublicCopy[] | undefined;

/**
 * The files in the bucket the website may serve itself: rows of the capture
 * index whose redistribution column says "yes", that are PDF files and that
 * are originals rather than text extracts (src/lib/public-copies.ts). Empty
 * when the index is missing.
 */
export function publicCopies(): PublicCopy[] {
	if (!publicCopyCache) {
		const indexPath = 'research/capture-index.csv';
		const rows = existsSync(path.join(repositoryRoot, indexPath)) ? parseCsv(readText(indexPath)) : [];
		publicCopyCache = rows
			.filter(
				(row) =>
					row.redistribution === 'yes' &&
					!neverServedTopics.has(row.key.split('/')[0]) &&
					!neverServedTopics.has(row.topic) &&
					!row.derived_from &&
					servedMediaTypes.has(row.media_type) &&
					/^[0-9a-f]{64}$/.test(row.sha256) &&
					/^[a-z0-9][a-z0-9._/-]*$/i.test(row.key) &&
					!row.key.split('/').includes('..')
			)
			.map((row) => ({
				key: row.key,
				mediaType: row.media_type,
				sha256: row.sha256,
				bytes: Number(row.bytes),
				links: row.link.split(/\s+/).filter((link) => linkForMatching(link)),
				captured: row.captured.slice(0, 10),
				title: row.title || row.key,
				rights: row.rights
			}))
			.filter((copy) => copy.links.length > 0)
			.sort((first, second) => first.title.localeCompare(second.title));
	}
	return publicCopyCache;
}

let publicCopyLinks: Map<string, PublicCopy> | undefined;

/** The copy the website serves of the document at this address, if it keeps one. */
export function publicCopyFor(link: string | undefined): PublicCopy | undefined {
	if (!link) return undefined;
	const matching = linkForMatching(link);
	if (!matching) return undefined;
	publicCopyLinks ??= copiesByLink(publicCopies());
	return publicCopyLinks.get(matching);
}
