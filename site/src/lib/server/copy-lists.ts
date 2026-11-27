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
import { readableFileNames } from '../readable-file-names.ts';
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

/**
 * The Indian Claims Commission's decisions, five of its 43 volumes to a list
 * (about 320 decisions each), by the volume in the file name, such as
 * "oksd_icc_d337_v12_p404.pdf" (volume 12): one list of all 2,779 would be
 * past what the accessibility check reads in 90 seconds.
 */
const claimsVolumesPerList = 5;
const claimsVolumeRanges: [number, number][] = Array.from({ length: Math.ceil(43 / claimsVolumesPerList) }, (_, index) => [index * claimsVolumesPerList + 1, Math.min(43, (index + 1) * claimsVolumesPerList)]);
const claimsSlug = ([first, last]: [number, number]) => `indian-claims-commission-volumes-${first}-${last}`;

function claimsGroup(copy: PublicCopy): string {
	const volume = Number(/_v(\d+)_p/i.exec(copy.key)?.[1] ?? Number.NaN);
	return claimsSlug(claimsVolumeRanges.find(([first, last]) => volume >= first && volume <= last) ?? claimsVolumeRanges.at(-1)!);
}

/**
 * The repatriation notices, by the year the Federal Register printed them (in
 * the GovInfo address, ".../FR-2024-05-19/..."), so no list holds much more
 * than 500: a few early years together, then a list a year, and two a year
 * from 2024, when the notices grew past 700 a year.
 */
const repatriationEarly: [number, number][] = [
	[1994, 2000],
	[2001, 2004],
	[2005, 2007]
];
const repatriationHalvesFrom = 2024;
/** The last year with lists of its own; later notices go in its last list until this moves on. (A Worker's clock reads 1970 when a module loads, so the year is not read from it.) */
const repatriationListedTo = 2030;
const repatriationLists: { slug: string; title: string }[] = [
	...repatriationEarly.map(([first, last]) => ({ slug: `repatriation-notices-${first}-${last}`, title: `Repatriation notices, ${first} to ${last}` })),
	...Array.from({ length: repatriationListedTo - 2007 }, (_, index) => 2008 + index).flatMap((year) =>
		year < repatriationHalvesFrom
			? [{ slug: `repatriation-notices-${year}`, title: `Repatriation notices, ${year}` }]
			: [
					{ slug: `repatriation-notices-${year}-january-to-june`, title: `Repatriation notices, January to June ${year}` },
					{ slug: `repatriation-notices-${year}-july-to-december`, title: `Repatriation notices, July to December ${year}` }
				]
	)
];

function repatriationGroup(copy: PublicCopy): string {
	const printed = copy.links.map((link) => /\/FR-(\d{4})-(\d{2})-/.exec(link)).find(Boolean);
	const year = Number(printed?.[1] ?? copy.captured.slice(0, 4));
	const early = repatriationEarly.find(([first, last]) => year >= first && year <= last);
	if (early || year < 2008) return `repatriation-notices-${(early ?? repatriationEarly[0]).join('-')}`;
	if (year < repatriationHalvesFrom) return `repatriation-notices-${year}`;
	const slug = `repatriation-notices-${year}-${Number(printed?.[2] ?? 1) <= 6 ? 'january-to-june' : 'july-to-december'}`;
	return repatriationLists.some((list) => list.slug === slug) ? slug : repatriationLists.at(-1)!.slug;
}

/**
 * Congress's documents, in lists by the year of the document (its source record's date), each a few hundred long:
 * hearings, committee reports from the Serial Set back to the 1820s and from GovInfo since 1995, and committee prints
 * (scripts/law/congressional_documents.py), then the Congressional Research Service's products (scripts/law/crs_reports.py).
 */
const congressLists: { slug: string; title: string; genres: string[]; from?: number; to?: number }[] = [
	{ slug: 'congressional-hearings-to-1994', title: 'Congressional hearings to 1994', genres: ['Hearing'], to: 1994 },
	{ slug: 'congressional-hearings-1995-2006', title: 'Congressional hearings, 1995 to 2006', genres: ['Hearing'], from: 1995, to: 2006 },
	{ slug: 'congressional-hearings-2007-on', title: 'Congressional hearings, 2007 and later', genres: ['Hearing'], from: 2007 },
	...(
		[
			[undefined, 1869],
			[1870, 1884],
			[1885, 1894],
			[1895, 1904],
			[1905, 1919],
			[1920, 1925],
			[1926, 1930],
			[1931, 1934],
			[1935, 1940],
			[1941, 1959],
			[1960, 1979],
			[1980, 1994],
			[1995, 2009],
			[2010, undefined]
		] as [number | undefined, number | undefined][]
	).map(([from, to]) => ({
		slug: from === undefined ? `committee-reports-to-${to}` : `committee-reports-${from}-${to ?? 'on'}`,
		title: from === undefined ? `Committee reports to ${to}` : to === undefined ? `Committee reports, ${from} and later` : `Committee reports, ${from} to ${to}`,
		genres: ['House report', 'Senate report'],
		from,
		to
	})),
	{ slug: 'committee-prints', title: 'Committee prints', genres: ['Committee print', 'House document', 'Senate document', 'Congressional document'] }
];

function congressGroup(copy: PublicCopy): string {
	const record = copy.records.map((key) => sources().get(key)).find((found) => found?.kind === 'congressional-document');
	const genre = (record?.citation as { genre?: string } | undefined)?.genre ?? '';
	const year = record?.citation.issued?.['date-parts']?.[0]?.[0] ?? 0;
	// Other files kept under congress/, such as a bill's text, stay in the other federal documents' list.
	if (!record) return 'other-federal';
	const list = congressLists.find((entry) => entry.genres.includes(genre) && (entry.from === undefined || year >= entry.from) && (entry.to === undefined || year <= entry.to));
	return list?.slug ?? 'committee-prints';
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
	// Lower federal courts' opinions from the Caselaw Access Project and CourtListener (decision record 0060).
	'federal-court-opinions': 'Lower federal court opinions',
	'gaming-commission': 'National Indian Gaming Commission documents',
	acknowledgment: 'Federal acknowledgment documents',
	...Object.fromEntries(congressLists.map((list) => [list.slug, list.title])),
	'congressional-research-service': 'Congressional Research Service reports',
	// The Serial Set's documents on Indian affairs, 1817 to 1899: in the other federal documents' list they made a 29 MiB page,
	// over Cloudflare's 25 MiB limit for one file (Nov. 27, 2026).
	'serial-set': 'Congressional Serial Set, 1817 to 1899',
	'solicitor-opinions': 'Solicitor’s opinions',
	// Films are large; a list of their own keeps them out of the documents' offline sets.
	'indian-affairs-films': 'Indian Affairs films',
	...Object.fromEntries(repatriationLists.map((list) => [list.slug, list.title])),
	...Object.fromEntries(claimsVolumeRanges.map((range) => [claimsSlug(range), `Indian Claims Commission decisions, volumes ${range[0]} to ${range[1]}`])),
	'other-federal': 'Other federal documents',
	// Published state and territorial court opinions (decision record 0060).
	'state-court-opinions': 'State court opinions',
	// Oklahoma's register of state-tribal compacts and agreements (decision record 0060).
	'oklahoma-state-tribal-agreements': 'Oklahoma state-tribal agreements'
};

/**
 * Court opinion lists longer than pageSize rows (decision record 0060), the Serial Set's 5,575 documents
 * (scripts/law/serial_set.py, in the order of their volumes' serial numbers) and the Federal Register's documents
 * are split into parts, in the
 * order of the copies' keys (source, reporter, volume): the first part keeps the list's address and
 * the others add "-2", "-3" and so on. One page of thousands of rows is too big for a Worker asset
 * and for the accessibility check, which gives up on a page after 90 seconds.
 */
const pagedGroups = new Set(['federal-court-opinions', 'state-court-opinions', 'serial-set', 'federal-register']);
const pageSize = 2500;
let pageCache: Map<string, { slug: string; parts: number }> | undefined;

/**
 * The paged list a copy belongs to, if any: its topic's, or the Federal Register's for the documents GovInfo keeps
 * under FR- packages, which share that list with the Federal Register's own (about 4,400 rows by Nov. 27, 2026, when
 * the one page took the accessibility check over its 90 seconds).
 */
function pagedGroupOf(copy: PublicCopy): string | undefined {
	if (pagedGroups.has(copy.topic)) return copy.topic;
	if (copy.topic === 'govinfo' && /^FR-/.test(copy.key.split('/')[1] ?? '')) return 'federal-register';
	return undefined;
}

/** The list each paged copy is in, by key. */
function pages(): Map<string, { slug: string; parts: number }> {
	if (pageCache) return pageCache;
	const cache = new Map<string, { slug: string; parts: number }>();
	for (const group of pagedGroups) {
		const keys = publicCopies()
			.filter((copy) => pagedGroupOf(copy) === group)
			.map((copy) => copy.key)
			.sort();
		const parts = Math.max(1, Math.ceil(keys.length / pageSize));
		keys.forEach((key, index) => {
			const part = Math.floor(index / pageSize) + 1;
			cache.set(key, { slug: part === 1 ? group : `${group}-${part}`, parts });
		});
	}
	pageCache = cache;
	return cache;
}

/** A paged list's base group and part, or undefined for any other list. */
function pageOf(slug: string): { group: string; part: number; parts: number } | undefined {
	const match = /^(.*?)(?:-(\d+))?$/.exec(slug);
	if (!match || !pagedGroups.has(match[1])) return undefined;
	const parts = [...pages().values()].find((page) => page.slug === slug)?.parts ?? 1;
	return { group: match[1], part: Number(match[2] ?? 1), parts };
}

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
	const paged = pagedGroupOf(copy);
	if (paged) return pages().get(copy.key)?.slug ?? paged;
	// The Supreme Court's opinions as text, split by opinion, beside the scans of the United States Reports (scripts/caselaw/case_opinion_texts.py).
	if (copy.topic === 'supreme-court-opinions') return 'supreme-court';
	if (copy.topic === 'indian-claims-commission') return claimsGroup(copy);
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
	// The tier 2 collections each have a list of their own; together they were too long for one page.
	if (copy.topic === 'nigc') return 'gaming-commission';
	if (copy.topic === 'acknowledgment') return 'acknowledgment';
	if (copy.topic === 'repatriation-notices') return repatriationGroup(copy);
	if (copy.topic === 'congress') return congressGroup(copy);
	if (copy.topic === 'crs') return 'congressional-research-service';
	if (copy.topic === 'solicitor-opinions') return 'solicitor-opinions';
	if (copy.topic === 'national-archives-films') return 'indian-affairs-films';
	return 'other-federal';
}

function groupTitle(slug: string, names = nationNames()): string {
	const paged = pageOf(slug);
	if (paged) return paged.parts > 1 ? `${fixedGroups[paged.group]}, part ${paged.part} of ${paged.parts}` : fixedGroups[paged.group];
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
		pageOf(slug)
			? Object.keys(fixedGroups).indexOf(pageOf(slug)?.group ?? '') + (pageOf(slug)?.part ?? 1) / 100
			: fixedGroups[slug]
				? Object.keys(fixedGroups).indexOf(slug)
				: slug.startsWith(opinionPrefix)
					? Object.keys(fixedGroups).indexOf('gaming-commission')
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

let fileNameCache: Map<string, string> | undefined;

/**
 * The name each copy is saved under, by key (src/lib/readable-file-names.ts): its title, and its
 * nation where the title does not name it, rather than the code many keys end in.
 */
export function copyFileNames(): Map<string, string> {
	if (fileNameCache) return fileNameCache;
	const names = nationNames();
	const opinions = new Map(tribalCourtOpinions().map((opinion) => [opinion.key, opinion]));
	fileNameCache = readableFileNames(
		publicCopies().map((copy) => ({
			key: copy.key,
			title: opinions.get(copy.key)?.name || copy.title,
			links: copy.links,
			nations: namesOf(copy, names)
		}))
	);
	return fileNameCache;
}

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
	const fileNames = copyFileNames();
	const federal: DocumentFile[] = [];
	const byNation = new Map<string, DocumentFile[]>();
	for (const copy of publicCopies()) {
		const file: DocumentFile = [
			copyPath(copy),
			copy.bytes,
			copy.sha256,
			copy.title,
			copy.links.at(-1) ?? copy.links[0] ?? '',
			fileNames.get(copy.key) ?? ''
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
