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
	/** The nations the copy belongs to, each linked to its page in the list. */
	nations: { id: string; name: string }[];
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

/**
 * The volumes of the Interior Board of Indian Appeals' reports each of its
 * lists holds, five to a list; the last has no end. Twenty volumes to a list
 * made pages of 1,000 to 1,700 decisions and 3 to 5 MB, which the
 * accessibility check could not finish in 90 seconds on a CI runner
 * (Nov. 27, 2026); five make at most about 500.
 */
const boardVolumesPerList = 5;
const boardVolumesListed = 70;
const boardVolumeRanges: [number, number | undefined][] = [
	...Array.from({ length: boardVolumesListed / boardVolumesPerList }, (_, index): [number, number] => [index * boardVolumesPerList + 1, (index + 1) * boardVolumesPerList]),
	[boardVolumesListed + 1, undefined]
];

function boardSlug(first: number, last: number | undefined): string {
	return `interior-board-of-indian-appeals-volumes-${first}-${last ?? 'on'}`;
}

/** The list a Board decision is in, by the volume in its file name, such as "39ibia253.pdf" (volume 39). */
function boardGroup(copy: PublicCopy): string {
	const volume = Number(/^(\d+)ibia/i.exec(copy.key.split('/').at(-1) ?? '')?.[1] ?? Number.NaN);
	const range = boardVolumeRanges.find(([first, last]) => volume >= first && (last === undefined || volume <= last)) ?? boardVolumeRanges.at(-1)!;
	return boardSlug(...range);
}

/** The lists that are not one nation's, in page order: federal documents, then state material. */
const fixedGroups: Record<string, string> = {
	'supreme-court': 'Supreme Court opinions',
	statutes: 'Federal statutes and Public Laws',
	'federal-register': 'Federal Register documents',
	// The Interior Board of Indian Appeals' decisions, lists of their own so the federal list stays a size a page can show,
	// split by the volume of Interior Decisions (IBIA) they are reported in: all 4,657 on one page made a 15 MB page (Nov. 27, 2026).
	...Object.fromEntries(
		boardVolumeRanges.map(([first, last]) => [boardSlug(first, last), last === undefined ? `Interior Board of Indian Appeals decisions, volume ${first} and later` : `Interior Board of Indian Appeals decisions, volumes ${first} to ${last}`])
	),
	// Lower federal courts' opinions from the Caselaw Access Project (decision record 0060).
	'federal-court-opinions': 'Lower federal court opinions',
	'gaming-commission': 'National Indian Gaming Commission documents',
	acknowledgment: 'Federal acknowledgment documents',
	'solicitor-opinions': 'Solicitor’s opinions',
	'other-federal': 'Other federal documents',
	// Published state and territorial court opinions (decision record 0060).
	'state-court-opinions': 'State court opinions',
	// Oklahoma's register of state-tribal compacts and agreements (decision record 0060).
	'oklahoma-state-tribal-agreements': 'Oklahoma state-tribal agreements'
};

function nationNames(): Map<string, string> {
	return new Map(nations().map((record) => [record.id, displayName(record.names.official)]));
}

/** The nations a copy belongs to, with their names; nations with no record are left out. */
function nationsOf(copy: PublicCopy, names: Map<string, string>): { id: string; name: string }[] {
	const ids = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
	return ids.flatMap((id) => {
		const name = names.get(id);
		return name ? [{ id, name }] : [];
	});
}

/** The nations a copy belongs to, by name. */
function namesOf(copy: PublicCopy, names: Map<string, string>): string[] {
	return nationsOf(copy, names).map((nation) => nation.name);
}

/** Topics whose copies belong to a nation's set for saving and downloading, not the United States set. */
const nationTopics = new Set(['constitutions', 'tribal-law', 'caselaw-access-project']);

/** Tribal court opinions (decision record 0047) are listed one nation at a time. */
const opinionPrefix = 'opinions-';

function groupOf(copy: PublicCopy, names: Map<string, string>): string {
	if (copy.topic === 'caselaw-access-project') return `${opinionPrefix}${copy.nations[0] ?? 'other'}`;
	if (copy.topic === 'ibia-decisions') return boardGroup(copy);
	// The Supreme Court's opinions as text, split by opinion, beside the scans of the United States Reports (scripts/caselaw/case_opinion_texts.py).
	if (copy.topic === 'supreme-court-opinions') return 'supreme-court';
	if (copy.topic === 'federal-court-opinions') return 'federal-court-opinions';
	if (copy.topic === 'state-court-opinions') return 'state-court-opinions';
	if (copy.topic === 'oklahoma-secretary-of-state') return 'oklahoma-state-tribal-agreements';
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
	// The tier 2 collections each have a list of their own; together they were too long for one page.
	if (copy.topic === 'federal-register') return 'federal-register';
	if (copy.topic === 'nigc') return 'gaming-commission';
	if (copy.topic === 'acknowledgment') return 'acknowledgment';
	if (copy.topic === 'solicitor-opinions') return 'solicitor-opinions';
	return 'other-federal';
}

function groupTitle(slug: string, names = nationNames()): string {
	if (fixedGroups[slug]) return fixedGroups[slug];
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
		nations: nationsOf(copy, names),
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
		fixedGroups[slug] ? Object.keys(fixedGroups).indexOf(slug) : slug.startsWith(opinionPrefix) ? Object.keys(fixedGroups).indexOf('gaming-commission') : slug === 'other-nations' ? 1000 : 10 + slug.charCodeAt(0);
	return [...counts]
		.map(([slug, count]) => ({ slug, title: groupTitle(slug, names), count }))
		.sort((first, second) => order(first.slug) - order(second.slug) || first.title.localeCompare(second.title));
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
