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
import { imageMayBeShown, type OfficialImageRecord, type ServableImage } from '../official-images.ts';

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
	archives?: { link?: string; url?: string }[];
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
