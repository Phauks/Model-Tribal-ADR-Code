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
import type { ReadingLinks } from '../reading-links.ts';
import type { StoryRecord } from '../story-visibility.ts';
import { imageMayBeShown, type OfficialImageRecord, type ServableImage } from '../official-images.ts';
import { parseCsv } from '../csv.ts';
import type { SearchSummary } from '../search-status.ts';
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

/* Front matter ------------------------------------------------------------ */

/** A front matter page in content/front-matter/, such as the acknowledgments, which the book prints too. */
export interface FrontMatterPage {
	id: string;
	title: string;
	sources: string[];
	body: string;
}

export function readFrontMatterPage(id: string): FrontMatterPage {
	const text = readText(`content/front-matter/${id}.md`);
	const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
	if (!match) throw new Error(`content/front-matter/${id}.md has no front matter`);
	const data = parse(match[1]) as { title?: string; sources?: string[] };
	return { id, title: data.title ?? id, sources: data.sources ?? [], body: text.slice(match[0].length) };
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
		/** A case's court, and where it is reported. */
		authority?: string;
		volume?: string;
		page?: string;
		number?: string;
		issued?: { 'date-parts'?: number[][] };
		URL?: string;
	};
	original_link?: string;
	/** The nations a source is about, by profile id. */
	tribes?: string[];
	archives?: { link?: string; url?: string; captured?: string }[];
	/** Other places to read a case or law (src/lib/reading-links.ts). */
	reading_links?: ReadingLinks;
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
	part_of_speech?: 'noun' | 'adjective' | 'verb' | 'adverb';
	usage: 'preferred' | 'acceptable' | 'context-only' | 'avoid';
	definition: string;
	other_senses?: { label?: string; definition: string }[];
	/** The id of the model code provision that enacts a definition of the term, such as 01-102. */
	code_definition?: string;
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
	census_areas?: (CitedFact & {
		geographic_identifier: string;
		name: string;
		area_type?: string;
		vintage?: string;
	})[];
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
	indian_health_service?: (CitedFact & { area: string; service_unit?: string; operator?: string })[];
	government_structure?: (CitedFact & { kind: string; detail?: string })[];
	/** How the government is set up, one plain fact per item (decision record 0042). */
	governance?: (CitedFact & { aspect: string; value: string; quote?: string })[];
	governing_documents?: (CitedFact & { kind: string; title?: string; link?: string; year?: string | number })[];
	justice_institutions?: (CitedFact & {
		kind: string;
		name: string;
		link?: string;
		/** Where the court's appeals go: another court in this record, with its own citation. */
		appeals_to?: CitedFact & { court: string };
	})[];
	dispute_resolution_law?: string[];
	jurisdiction?: (CitedFact & { topic: string; value?: string; detail?: string })[];
	jurisdiction_agreements?: (CitedFact & {
		kind: string;
		other_party: string;
		agreement?: string;
		state?: string;
		date?: string;
		status?: string;
		detail?: string;
	})[];
	/** What a person needs to use the nation's courts: admission, rules, fees, forms, defenders and legal aid. */
	court_practice?: (CitedFact & { kind: string; title: string; court?: string; link?: string; detail?: string })[];
	/** The state trial court for each county the nation's Census area lies in. */
	nearby_state_courts?: (CitedFact & { state: string; county: string; court: string; link?: string })[];
	treaties?: (CitedFact & {
		title: string;
		signed: string;
		statutes_at_large?: string;
		kappler?: { volume?: number; page?: number; link?: string };
		signatory?: string;
	})[];
	land_establishment?: (CitedFact & {
		land_area: string;
		method: string;
		instrument?: string;
		date?: string;
		detail?: string;
	})[];
	memberships?: (CitedFact & { organization: string })[];
	dispute_resolution?: {
		forums?: (CitedFact & { kind: string; name?: string; link?: string })[];
		provisions?: (CitedFact & { kind: string; title?: string })[];
	};
	gaming?: {
		compacts?: (CitedFact & { state: string; status: string })[];
		ordinances?: CitedFact[];
		operates_gaming?: CitedFact & { value: boolean };
		indian_lands_opinions?: (CitedFact & { parcel: string; legal_theory?: string; accepted?: boolean; date: string; link?: string })[];
		enforcement_actions?: (CitedFact & { kinds: string[]; tracking_number: string; date: string; link?: string })[];
	};
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
	/** The project's copy of this version's text, found by its SHA-256 in the capture index. */
	capture?: { path?: string; sha256?: string };
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

let searchLogCache: Map<string, SearchSummary> | undefined;

/**
 * The nation's search log for a topic, such as "courts", summed up for its
 * page (research/search-logs/, decision record 0025), or undefined when no
 * one has logged a search for it.
 */
export function searchSummary(topic: string, nationId: string): SearchSummary | undefined {
	if (!searchLogCache) {
		searchLogCache = new Map();
		for (const file of yamlFilesUnder('research/search-logs')) {
			const log = readYaml<{
				profile: string;
				topic: string;
				status: SearchSummary['status'];
				last_searched?: string;
				searches?: { address?: string; place_kind?: string }[];
			}>(file);
			const id = path.posix.basename(log.profile, '.yaml');
			const searches = log.searches ?? [];
			const kindCounts = new Map<string, number>();
			for (const search of searches) {
				if (search.place_kind) kindCounts.set(search.place_kind, (kindCounts.get(search.place_kind) ?? 0) + 1);
			}
			searchLogCache.set(`${log.topic}/${id}`, {
				status: log.status,
				lastSearched: log.last_searched,
				places: new Set(searches.map((search, index) => search.address ?? `search ${index}`)).size,
				placeKinds: [...kindCounts].sort((first, second) => second[1] - first[1]).map(([kind]) => kind)
			});
		}
	}
	return searchLogCache.get(`${topic}/${nationId}`);
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

/**
 * The name and kind of every nation record that is not restricted, for the
 * lines under a case or law box that name the nations or peoples a source
 * concerns (src/lib/server/case-facts.ts), as the print build reads them.
 */
export function nationNamesAndKinds(): Map<string, { name: string; entityType: string }> {
	const found = new Map<string, { name: string; entityType: string }>();
	for (const file of yamlFilesUnder('content/tribes')) {
		const record = readYaml<NationRecord>(file);
		if (record.sensitivity?.restricted) continue;
		found.set(record.id, { name: record.names.official, entityType: record.entity_type });
	}
	return found;
}

/** Every name of every listed nation: official, self-designations and former names. */
export function nationNameVariants(): string[] {
	const names: string[] = [];
	for (const file of yamlFilesUnder('content/tribes')) {
		const record = readYaml<NationRecord>(file);
		if (record.sensitivity?.restricted) continue;
		names.push(record.names.official, ...(record.names.self_designation ?? []).map((entry) => entry.name), ...(record.names.former ?? []).map((entry) => entry.name));
	}
	return names;
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

let indexedCopyCache: PublicCopy[] | undefined;
let publicCopyCache: PublicCopy[] | undefined;

let publishedNations: Set<string> | undefined;
let withheldDigests: Set<string> | undefined;

/**
 * Whether a copy belongs to material the site does not publish: a nation whose
 * record is restricted or still waits for the nation's approval, or a document
 * history marked restricted or held for review. A nation's constitution is
 * filed under constitutions/<nation id>/, so the key names its nation too.
 */
function isWithheld(copy: PublicCopy): boolean {
	const named = [...copy.nations];
	if (copy.topic === 'constitutions') named.push(copy.key.split('/')[1] ?? '');
	if (named.length === 0) return false;
	publishedNations ??= new Set(nations().map((record) => record.id));
	const published = publishedNations;
	if (named.some((id) => id && !published.has(id))) return true;
	withheldDigests ??= new Set(
		yamlFilesUnder('content/documents')
			.map((file) => readYaml<DocumentHistoryRecord>(file))
			.filter((record) => record.sensitivity?.restricted || record.sensitivity?.tribal_review_required)
			.flatMap((record) => record.versions.map((version) => version.capture?.sha256?.toLowerCase() ?? ''))
			.filter(Boolean)
	);
	return withheldDigests.has(copy.sha256);
}

/**
 * Rows of the capture index whose redistribution column says "yes", that are
 * PDFs or saved web pages and originals rather than text extracts, before
 * withheld material is taken out. Empty when the index is missing.
 */
function indexedCopies(): PublicCopy[] {
	if (!indexedCopyCache) {
		const indexPath = 'research/capture-index.csv';
		const rows = existsSync(path.join(repositoryRoot, indexPath)) ? parseCsv(readText(indexPath)) : [];
		indexedCopyCache = rows
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
				topic: row.topic || row.key.split('/')[0],
				nations: row.nations.split(';').filter(Boolean),
				rights: row.rights
			}))
			.filter((copy) => copy.links.length > 0)
			.sort((first, second) => first.title.localeCompare(second.title));
	}
	return indexedCopyCache;
}

/**
 * The files in the bucket the website may serve itself (src/lib/public-copies.ts):
 * the indexed copies, without those of material the site does not publish.
 */
export function publicCopies(): PublicCopy[] {
	publicCopyCache ??= indexedCopies().filter((copy) => !isWithheld(copy));
	return publicCopyCache;
}

let publicCopyLinks: Map<string, PublicCopy> | undefined;

let publicCopyHashes: Map<string, PublicCopy> | undefined;

/** The copy the website serves of the file with this SHA-256, if it keeps one. */
export function publicCopyWithDigest(sha256: string | undefined): PublicCopy | undefined {
	if (!sha256) return undefined;
	publicCopyHashes ??= new Map(indexedCopies().map((copy) => [copy.sha256, copy]));
	const copy = publicCopyHashes.get(sha256.toLowerCase());
	return copy && !isWithheld(copy) ? copy : undefined;
}

/** The copy the website serves of the document at this address, if it keeps one. */
export function publicCopyFor(link: string | undefined): PublicCopy | undefined {
	if (!link) return undefined;
	const matching = linkForMatching(link);
	if (!matching) return undefined;
	// Matched before withheld copies are taken out, so a page that cites no
	// copy never has to read every nation record to find that out.
	publicCopyLinks ??= copiesByLink(indexedCopies());
	const copy = publicCopyLinks.get(matching);
	return copy && !isWithheld(copy) ? copy : undefined;
}
