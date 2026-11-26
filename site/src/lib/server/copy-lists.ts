/**
 * Splits the copies this site serves (src/lib/public-copies.ts) into short
 * lists, so no page has to hold thousands of rows: federal statutes, Federal
 * Register documents, other federal documents, tribal court opinions by
 * nation, and nations' documents by the first letter of the nation's name.
 */
import { displayName } from '../nation-labels.ts';
import {
	copyDetailsShard,
	copyPagePath,
	copyPath,
	fileSize,
	mediaLabel,
	removalRequestPath,
	type CopyDetails,
	type PublicCopy
} from '../public-copies.ts';
import type { DocumentFile, DocumentSetList, DocumentSetSummary } from '../offline-documents.ts';
import { formatCaptureDate } from './markdown.ts';
import { nations, publicCopies, sources, type SourceRecord } from './content.ts';
import { citationTexts } from './essay-library.ts';
import { tribalCourtOpinions } from './tribal-court-opinions.ts';

export interface CopyGroup {
	/** The list's address below /copies/list/. */
	slug: string;
	title: string;
	count: number;
}

export interface CopyRow {
	key: string;
	title: string;
	kind: string;
	nations: string[];
	/** The file itself, for downloading and checking. */
	path: string;
	/** The copy's page on this site, for reading. */
	page: string;
	original: string;
	captured: string;
	capturedText: string;
	size: string;
	bytes: number;
	sha256: string;
	removal: string;
}

const federalGroups: Record<string, string> = {
	'supreme-court': 'Supreme Court opinions',
	statutes: 'Federal statutes and Public Laws',
	'federal-register': 'Federal Register documents',
	'other-federal': 'Other federal documents'
};

/**
 * Published court opinions (decision record 0060), listed in parts of at most pageSize rows, in
 * the order of their keys (source, reporter, volume): one page of thousands of rows is too big for
 * a Worker asset and for the accessibility check, which gives up on a page after 90 seconds.
 */
const pagedTopics: Record<string, string> = {
	'federal-court-opinions': 'Federal court opinions',
	'state-court-opinions': 'State court opinions'
};
const pageSize = 2500;
let pageCache: Map<string, { slug: string; part: number; parts: number }> | undefined;

function pages(): Map<string, { slug: string; part: number; parts: number }> {
	if (pageCache) return pageCache;
	pageCache = new Map();
	for (const topic of Object.keys(pagedTopics)) {
		const keys = publicCopies()
			.filter((copy) => copy.topic === topic)
			.map((copy) => copy.key)
			.sort();
		const parts = Math.max(1, Math.ceil(keys.length / pageSize));
		keys.forEach((key, index) => {
			const part = Math.floor(index / pageSize) + 1;
			pageCache?.set(key, { slug: `${topic}-${part}`, part, parts });
		});
	}
	return pageCache;
}

function pagedTitle(slug: string): string | undefined {
	const match = /^(.*)-(\d+)$/.exec(slug);
	if (!match || !pagedTopics[match[1]]) return undefined;
	const parts = [...pages().values()].find((page) => page.slug === slug)?.parts ?? 1;
	return parts > 1 ? `${pagedTopics[match[1]]}, part ${match[2]} of ${parts}` : pagedTopics[match[1]];
}

function nationNames(): Map<string, string> {
	return new Map(nations().map((record) => [record.id, displayName(record.names.official)]));
}

/** The nations a copy belongs to, by name. */
function namesOf(copy: PublicCopy, names: Map<string, string>): string[] {
	const ids = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
	return ids.flatMap((id) => {
		const name = names.get(id);
		return name ? [name] : [];
	});
}

/** Topics whose copies belong to a nation's set for saving and downloading, not the United States set. */
const nationTopics = new Set(['constitutions', 'tribal-law', 'caselaw-access-project']);

/** Tribal court opinions (decision record 0047) are listed one nation at a time. */
const opinionPrefix = 'opinions-';

function groupOf(copy: PublicCopy, names: Map<string, string>): string {
	if (copy.topic === 'caselaw-access-project') return `${opinionPrefix}${copy.nations[0] ?? 'other'}`;
	if (pagedTopics[copy.topic]) return pages().get(copy.key)?.slug ?? `${copy.topic}-1`;
	if (copy.topic === 'constitutions' || copy.topic === 'tribal-law') {
		const [first] = namesOf(copy, names);
		const letter = first?.normalize('NFD').charAt(0).toLowerCase() ?? '';
		return /^[a-z]$/.test(letter) ? letter : 'other-nations';
	}
	const file = copy.key.split('/').at(-1) ?? '';
	if (copy.topic === 'govinfo' && /^(STATUTE|PLAW)-/.test(file)) return 'statutes';
	// The Library of Congress keeps both the Statutes at Large and the United States Reports.
	if (copy.topic === 'tile.loc.gov') return copy.key.includes('/usrep/') ? 'supreme-court' : 'statutes';
	if (copy.topic === 'govinfo' && /^FR-/.test(copy.key.split('/')[1] ?? '')) return 'federal-register';
	return 'other-federal';
}

function groupTitle(slug: string, names = nationNames()): string {
	if (federalGroups[slug]) return federalGroups[slug];
	const paged = pagedTitle(slug);
	if (paged) return paged;
	if (slug.startsWith(opinionPrefix)) {
		const name = names.get(slug.slice(opinionPrefix.length));
		return name ? `Tribal court opinions: ${name}` : 'Tribal court opinions';
	}
	if (slug === 'other-nations') return 'Nations’ documents, other names';
	return `Nations’ documents: ${slug.toUpperCase()}`;
}

function row(copy: PublicCopy, names: Map<string, string>): CopyRow {
	return {
		key: copy.key,
		title: copy.title,
		kind: mediaLabel(copy.mediaType),
		nations: namesOf(copy, names),
		path: copyPath(copy),
		page: copyPagePath(copy),
		original: copy.links.at(-1) ?? copy.links[0] ?? '',
		captured: copy.captured,
		capturedText: copy.captured ? formatCaptureDate(copy.captured) : '',
		size: fileSize(copy.bytes),
		bytes: copy.bytes,
		sha256: copy.sha256,
		removal: removalRequestPath(copy)
	};
}

/** Every list, federal ones first, then nations by letter. */
export function copyGroups(): CopyGroup[] {
	const names = nationNames();
	const counts = new Map<string, number>();
	for (const copy of publicCopies()) {
		const slug = groupOf(copy, names);
		counts.set(slug, (counts.get(slug) ?? 0) + 1);
	}
	const order = (slug: string) =>
		federalGroups[slug]
			? Object.keys(federalGroups).indexOf(slug)
			: pagedTitle(slug)
				? Object.keys(federalGroups).length + (slug.startsWith('federal-') ? 0 : 0.5)
				: slug.startsWith(opinionPrefix)
					? 5
					: slug === 'other-nations'
						? 1000
						: 10 + slug.charCodeAt(0);
	return [...counts]
		.map(([slug, count]) => ({ slug, title: groupTitle(slug, names), count }))
		.sort((first, second) => order(first.slug) - order(second.slug) || first.title.localeCompare(second.title, undefined, { numeric: true }));
}

/** The rows of one list. */
export function copyRows(slug: string): CopyRow[] {
	const names = nationNames();
	return publicCopies()
		.filter((copy) => groupOf(copy, names) === slug)
		.map((copy) => row(copy, names));
}

/** Every copy, for the downloadable list. */
export function allCopyRows(): CopyRow[] {
	const names = nationNames();
	return publicCopies().map((copy) => row(copy, names));
}

export { groupTitle };

let detailCache: Map<string, Record<string, CopyDetails>> | undefined;

/**
 * Each copy's details for its page (src/routes/copies/view/[...key]), split
 * into small files by the first two characters of the copy's SHA-256
 * (copyDetailsShard), keyed by the copy's key.
 */
function detailShards(): Map<string, Record<string, CopyDetails>> {
	if (detailCache) return detailCache;
	const names = nationNames();
	const opinions = new Map(tribalCourtOpinions().map((opinion) => [opinion.key, opinion]));
	const records = sources();
	const cited = new Map(publicCopies().map((copy) => [copy.key, copy.records.map((key) => records.get(key)).find((record) => record?.citation?.title)]));
	const texts = citationTexts([...new Set([...cited.values()].filter((record): record is SourceRecord => record !== undefined))]);
	const shards = new Map<string, Record<string, CopyDetails>>();
	for (const copy of publicCopies()) {
		const ids = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
		const slug = groupOf(copy, names);
		const opinion = opinions.get(copy.key);
		const details: CopyDetails = {
			title: copy.title,
			kind: mediaLabel(copy.mediaType),
			captured: copy.captured,
			nations: ids.flatMap((id) => {
				const name = names.get(id);
				return name ? [{ id, name }] : [];
			}),
			list: { slug, title: groupTitle(slug, names) },
			...(opinion
				? {
						opinion: {
							name: opinion.name,
							citation: opinion.citation,
							court: opinion.court,
							decided: opinion.decided,
							docket: opinion.docket,
							...(copy.namesReplaced ? { namesReplaced: true } : {})
						}
					}
				: citationOf(cited.get(copy.key), texts, copy.title))
		};
		const shard = copyDetailsShard(copy);
		const entries = shards.get(shard) ?? {};
		entries[copy.key] = details;
		shards.set(shard, entries);
	}
	detailCache = shards;
	return shards;
}

/**
 * How the project cites the source a copy belongs to (Indigo Book), for the line under the copy's
 * title: the name is left out when it is the title, so Fletcher v. Peck reads "10 U.S. 87 (1810)."
 * A web address in the citation stays as text, since the page links the original already.
 */
function citationOf(record: SourceRecord | undefined, texts: Map<string, string>, title: string): Partial<CopyDetails> {
	const text = record ? texts.get(record.key) : undefined;
	if (!record || !text) return {};
	const name = record.citation.title ?? '';
	const isCase = (record.citation as { type?: string }).type === 'legal_case';
	let citation = text;
	for (const start of [`<i>${name}</i>, `, `${name}, `]) {
		if (name && name === title && citation.startsWith(start)) citation = citation.slice(start.length);
	}
	// Every case record with a name has a page (src/lib/server/case-pages.ts, caseKeys).
	return { citation, isCase, ...(isCase ? { casePage: `/cases/${record.key}` } : {}) };
}

/** The names of the detail files, such as "0f". */
export function copyDetailShardNames(): string[] {
	return [...detailShards().keys()].sort();
}

/** One detail file's contents, or undefined when no copy's SHA-256 starts that way. */
export function copyDetails(shard: string): Record<string, CopyDetails> | undefined {
	return detailShards().get(shard);
}

/**
 * The copies a reader can save for offline reading, by set (src/lib/offline-documents.ts): the
 * United States documents as one set, and each nation's constitutions and laws as its own. A
 * document that belongs to several nations is in each of their sets.
 */
let offlineSetCache: { federal: DocumentSetList; nations: Map<string, DocumentSetList> } | undefined;

export function offlineSets(): { federal: DocumentSetList; nations: Map<string, DocumentSetList> } {
	offlineSetCache ??= buildOfflineSets();
	return offlineSetCache;
}

function buildOfflineSets(): { federal: DocumentSetList; nations: Map<string, DocumentSetList> } {
	const names = nationNames();
	const federal: DocumentFile[] = [];
	const byNation = new Map<string, DocumentFile[]>();
	for (const copy of publicCopies()) {
		const file: DocumentFile = [
			copyPath(copy),
			copy.bytes,
			copy.sha256,
			copy.title,
			copy.links.at(-1) ?? copy.links[0] ?? ''
		];
		// A nation's set holds its constitutions, its laws and its courts' opinions (decision record
		// 0047); everything else the site holds is a United States document.
		if (!nationTopics.has(copy.topic)) {
			federal.push(file);
			continue;
		}
		const ids = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
		for (const id of ids) {
			if (!id || !names.has(id)) continue;
			byNation.set(id, [...(byNation.get(id) ?? []), file]);
		}
	}
	const nationLists = new Map(
		[...byNation].sort(([first], [second]) => first.localeCompare(second)).map(([id, files]) => [id, { title: names.get(id) ?? id, files }])
	);
	return { federal: { title: 'United States laws and government documents', files: federal }, nations: nationLists };
}

/** The short list of every set, for the Data section in Settings. */
export function offlineSetSummary(): DocumentSetSummary {
	const { federal, nations: nationLists } = offlineSets();
	const sum = (files: DocumentFile[]) => files.reduce((total, [, bytes]) => total + bytes, 0);
	return {
		federal: { title: federal.title, count: federal.files.length, bytes: sum(federal.files) },
		nations: Object.fromEntries(
			[...nationLists].map(([id, list]) => [id, { title: list.title, count: list.files.length, bytes: sum(list.files) }])
		)
	};
}
