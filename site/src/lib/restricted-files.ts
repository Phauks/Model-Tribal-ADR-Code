/**
 * The files made when the site is built, as a reader may have them once
 * nations' choices about their own laws and court opinions are applied
 * (src/lib/nation-restrictions.ts, decision record 0056). The build cannot
 * know the choices, which live in the database, so the Worker reads each
 * file as built and passes it through these filters when it is asked for
 * (src/routes/restricted). The rules are the design's (design notes,
 * "Where a restriction reaches"):
 *
 * - Hide: the item is left out, and is not counted.
 * - Cite only: the item stays, by its name and citation, linked to where
 *   the original is kept rather than to this site's copy, and without the
 *   words drawn from its text (an opinion's "Mentions").
 *
 * Everything here is pure, so the tests can run it on the files as built.
 */
import { csvDocument, parseCsv } from './csv.ts';
import { copyItemId, type RestrictableItem, type RestrictionLevel } from './nation-restrictions.ts';
import type { SearchRecordsFile } from './search-records.ts';
import type { CopyDetails } from './public-copies.ts';
import { kindLabels, type OpinionYear, type TimelineEntry, type TimelineRow } from './timeline.ts';

/** What every nation restricts (src/lib/server/site-restrictions.ts). Never sent to a reader. */
export interface SiteRestrictions {
	/** Changes whenever any nation saves a choice; part of each filtered file's ETag. */
	stamp: string;
	/** The level of each item some nation restricts, the strictest winning. Items shown in full are left out. */
	levels: Map<string, 'cite' | 'hide'>;
	/** What the restricting nations' lists say of each of their items. */
	items: Map<string, RestrictableItem>;
	/** "<nation>#<document>" for each document of a nation whose every version is hidden. */
	hiddenDocuments: Set<string>;
}

type Shown = RestrictionLevel;

/** The level of an item. */
export function levelOf(restrictions: SiteRestrictions, id: string): Shown {
	return restrictions.levels.get(id) ?? 'show';
}

/** The item a link on this site points at, when it is a copy this site keeps: "/copies/view/a/b.pdf" or "/copies/a/b.pdf". */
export function copyIdOfLink(link: string | undefined | null): string | undefined {
	if (!link || !link.startsWith('/copies/') || link.startsWith('/copies/list') || link.startsWith('/copies/details') || link.startsWith('/copies/offline')) return undefined;
	try {
		return copyItemId(link.split(/[?#]/)[0]);
	} catch {
		return undefined;
	}
}

/** The level of whatever a link points at. */
export function linkLevel(restrictions: SiteRestrictions, link: string | undefined | null): Shown {
	const id = copyIdOfLink(link);
	return id ? levelOf(restrictions, id) : 'show';
}

/** Where the original of a cited item is kept, in place of this site's copy. */
export function originalOf(restrictions: SiteRestrictions, link: string | undefined | null): string {
	const id = copyIdOfLink(link);
	return (id && restrictions.items.get(id)?.original) || '';
}

// ----- Indexes, made once for each state of the restrictions -----

const indexes = new WeakMap<SiteRestrictions, Index>();

interface Index {
	/** Hidden or cited opinions by "<name>|<citation>". */
	opinions: Map<string, string>;
	/** Versions of documents, by "#<document>|<date>", for rows that link to the document rather than a copy. */
	versions: Map<string, string>;
	/** How many hidden opinions each nation has in each year: "<year>|<nation>". */
	hiddenOpinionYears: Map<string, number>;
}

function indexOf(restrictions: SiteRestrictions): Index {
	let index = indexes.get(restrictions);
	if (index) return index;
	index = { opinions: new Map(), versions: new Map(), hiddenOpinionYears: new Map() };
	for (const [id] of restrictions.levels) {
		const item = restrictions.items.get(id);
		if (!item) continue;
		if (item.kind === 'opinions') {
			if (item.cite) index.opinions.set(`${item.title}|${item.cite}`, id);
			if (levelOf(restrictions, id) === 'hide' && item.year) {
				for (const nation of item.nations ?? []) {
					const key = `${item.year}|${nation}`;
					index.hiddenOpinionYears.set(key, (index.hiddenOpinionYears.get(key) ?? 0) + 1);
				}
			}
		}
		if (item.document && item.date) index.versions.set(`#${item.document}|${item.date}`, id);
	}
	indexes.set(restrictions, index);
	return index;
}

/** A version of a document that a timeline row or entry names by its document's anchor and its date. */
function versionLevel(restrictions: SiteRestrictions, link: string, date: string): { level: Shown; id?: string } {
	const anchor = /#document-(.+)$/.exec(link);
	if (!anchor) return { level: 'show' };
	const id = indexOf(restrictions).versions.get(`#${anchor[1]}|${date}`);
	return id ? { level: levelOf(restrictions, id), id } : { level: 'show' };
}

/** How many published opinions a year had, as the timelines say it. */
export function opinionCountTitle(count: number): string {
	return `${count} published ${count === 1 ? 'opinion' : 'opinions'}`;
}

/** The hidden opinions of a nation in a year, which counts leave out. */
export function hiddenOpinions(restrictions: SiteRestrictions, year: string | number, nation: string): number {
	return indexOf(restrictions).hiddenOpinionYears.get(`${year}|${nation}`) ?? 0;
}

// ----- Search -----

/** The advanced search's records (/search/records.json): a document whose every version is hidden is not listed. Rows name documents, never their text. */
export function filterSearchRecords(file: SearchRecordsFile, restrictions: SiteRestrictions): SearchRecordsFile {
	return {
		...file,
		documents: file.documents.filter(
			(row) => !(row.anchor.startsWith('document-') && restrictions.hiddenDocuments.has(`${row.nation}#${row.anchor.slice('document-'.length)}`))
		)
	};
}

// ----- Copies -----

const copiesCsvOptions = { quoteCarriageReturns: false, lineEnding: '\n' } as const;

/**
 * The list of every copy (/copies/list.csv, also in data.zip): a hidden
 * copy's row is left out, and a cited one keeps its title and where it was
 * published, without this site's copy, its size or its SHA-256.
 */
export function filterCopiesCsv(text: string, restrictions: SiteRestrictions): string {
	const header = text.slice(0, text.indexOf('\n')).split(',');
	const rows = parseCsv(text);
	const kept: string[][] = [];
	for (const row of rows) {
		const level = linkLevel(restrictions, row.copy);
		if (level === 'hide') continue;
		const values = level === 'cite' ? { ...row, copy: '', bytes: '', sha256: '' } : row;
		kept.push(header.map((name) => values[name] ?? ''));
	}
	return csvDocument([header, ...kept], copiesCsvOptions);
}

/** One file of copies' details (/copies/details/<shard>.json): a hidden copy is left out. */
export function filterCopyDetails(details: Record<string, CopyDetails>, restrictions: SiteRestrictions): Record<string, CopyDetails> {
	return Object.fromEntries(Object.entries(details).filter(([key]) => levelOf(restrictions, `copy:${key}`) !== 'hide'));
}

/** A row of a copies list page (src/lib/server/copy-lists.ts, CopyRow). */
interface CopyRowLike {
	key: string;
	path: string;
	page: string;
	original: string;
	size: string;
	bytes: number;
	sha256: string;
}

/** The rows of a copies list page: hidden copies left out, cited ones linked to their originals. */
export function filterCopyRows<Row extends CopyRowLike>(rows: Row[], restrictions: SiteRestrictions): Row[] {
	return rows.flatMap((row) => {
		const level = levelOf(restrictions, `copy:${row.key}`);
		if (level === 'hide') return [];
		if (level === 'cite') return [{ ...row, path: '', page: row.original, size: '', bytes: 0, sha256: '' }];
		return [row];
	});
}

/**
 * A nation's set of copies for reading offline and its downloads
 * (/copies/offline/nations/<id>.json): neither a hidden nor a cited copy is
 * in it, since a cited item has no copy on this site.
 */
export function filterOfflineList<List extends { files: unknown[][] }>(list: List, restrictions: SiteRestrictions): List {
	return { ...list, files: list.files.filter((file) => linkLevel(restrictions, String(file[0])) === 'show') };
}

// ----- Timelines -----

const documentKind = kindLabels.document;
const opinionKind = kindLabels.opinion;

/**
 * A timeline as rows (/nations/<id>/timeline.json, /nations/timeline/entries.json
 * and their CSV files): hidden laws left out, cited ones linked to their
 * originals, and each year's count of opinions without the hidden ones. A
 * nation's own file has no nation on its rows of opinions, so its id is given.
 */
export function filterTimelineRows(rows: TimelineRow[], restrictions: SiteRestrictions, nation?: string): TimelineRow[] {
	return rows.flatMap((row) => {
		if (row.kind === opinionKind) {
			const owner = nation ?? /\/nations\/([^/]+)\/opinions$/.exec(row.link)?.[1];
			const hidden = owner ? hiddenOpinions(restrictions, row.date.slice(0, 4), owner) : 0;
			if (hidden === 0) return [row];
			const count = Number(/^(\d+)/.exec(row.title)?.[1] ?? 0) - hidden;
			return count > 0 ? [{ ...row, title: opinionCountTitle(count) }] : [];
		}
		if (row.kind !== documentKind) return [row];
		const path = row.link.replace(/^https?:\/\/[^/]+/, '');
		let level = linkLevel(restrictions, path);
		if (level === 'show') level = versionLevel(restrictions, path, row.date).level;
		if (level === 'hide') return [];
		if (level === 'cite' && copyIdOfLink(path)) return [{ ...row, link: originalOf(restrictions, path) }];
		return [row];
	});
}

/** A timeline's entries as a page holds them (TimelineEntry): the same rules. */
export function filterTimelineEntries<Entry extends Pick<TimelineEntry, 'kind' | 'date' | 'link'>>(entries: Entry[], restrictions: SiteRestrictions): Entry[] {
	return entries.flatMap((entry) => {
		if (entry.kind !== 'document') return [entry];
		const link = entry.link ?? '';
		let level = linkLevel(restrictions, link);
		if (level === 'show') level = versionLevel(restrictions, link, entry.date).level;
		if (level === 'hide') return [];
		if (level === 'cite' && copyIdOfLink(link)) return [{ ...entry, link: originalOf(restrictions, link) }];
		return [entry];
	});
}

/** Each year's count of opinions, without the hidden ones. A nation's own timeline counts only its opinions and names no nation. */
export function filterOpinionYears<Year extends Pick<OpinionYear, 'year' | 'count' | 'nation'>>(years: Year[], restrictions: SiteRestrictions, nation?: string): Year[] {
	return years.flatMap((year) => {
		const owner = year.nation ?? nation;
		const hidden = owner ? hiddenOpinions(restrictions, year.year, owner) : 0;
		if (hidden === 0) return [year];
		const count = year.count - hidden;
		return count > 0 ? [{ ...year, count }] : [];
	});
}

// ----- Find the law and the table builder -----

/** A nation's file for Find the law (/nations/law/<id>.json): items linked to a hidden copy are left out, and cited ones link to the original. */
export function filterLawItems<Item extends { link?: string }>(items: Item[], restrictions: SiteRestrictions): Item[] {
	return items.flatMap((item) => {
		const level = linkLevel(restrictions, item.link);
		if (level === 'hide') return [];
		if (level === 'cite') return [{ ...item, link: originalOf(restrictions, item.link) || undefined }];
		return [item];
	});
}

/** A data set of the table builder (/nations/data/build/<name>.json): rows and their links side by side. */
export interface BuilderFile {
	identifier: string;
	columns: { key: string }[];
	rows: unknown[][];
	links?: (string | null)[];
}

/**
 * A data set for the table builder: a row whose record is hidden is left
 * out; a cited one links to its original, and an opinion loses its words.
 * Opinions are found by their name and citation, which every row gives.
 */
export function filterBuilderFile<File extends BuilderFile>(file: File, restrictions: SiteRestrictions): File {
	const keys = file.columns.map((column) => column.key);
	const nameColumn = keys.indexOf('name');
	const citationColumn = keys.indexOf('citation');
	const topicsColumn = keys.indexOf('topics');
	const opinions = file.identifier === 'opinions' ? indexOf(restrictions).opinions : undefined;
	const rows: unknown[][] = [];
	const links: (string | null)[] = [];
	file.rows.forEach((row, position) => {
		const link = file.links?.[position] ?? null;
		let level = linkLevel(restrictions, link);
		if (level === 'show' && opinions) {
			const id = opinions.get(`${row[nameColumn]}|${row[citationColumn]}`);
			if (id) level = levelOf(restrictions, id);
		}
		if (level === 'hide') return;
		if (level === 'cite') {
			const cited = [...row];
			if (opinions && topicsColumn >= 0) cited[topicsColumn] = null;
			rows.push(cited);
			links.push(originalOf(restrictions, link) || null);
			return;
		}
		rows.push(row);
		links.push(link);
	});
	return { ...file, rows, ...(file.links ? { links } : {}) };
}

// ----- Opinions on pages -----

/** An opinion as pages list it (src/lib/server/tribal-court-opinions.ts). */
interface OpinionLike {
	key: string;
	topics: string[];
}

/** Opinions on a page: hidden ones left out; cited ones keep their name and citation but lose the words drawn from their text. */
export function filterOpinions<Opinion extends OpinionLike>(opinions: Opinion[], restrictions: SiteRestrictions): Opinion[] {
	return opinions.flatMap((opinion) => {
		const level = levelOf(restrictions, `copy:${opinion.key}`);
		if (level === 'hide') return [];
		if (level === 'cite') return [{ ...opinion, topics: [] }];
		return [opinion];
	});
}

/** A row of a table on a page (src/lib/tables/table-definition.ts) keyed by its copy, such as a chart bar's opinions. */
interface TableRowLike {
	key: string;
	cells: Record<string, { text: string; href?: string; values?: string[]; sortValue?: unknown }>;
}

/** Table rows keyed by a copy's key: hidden ones left out; cited ones linked to the original, without the words from their text. */
export function filterCopyTableRows<Row extends TableRowLike>(rows: Row[], restrictions: SiteRestrictions): Row[] {
	return rows.flatMap((row) => {
		const level = levelOf(restrictions, `copy:${row.key}`);
		if (level === 'hide') return [];
		if (level === 'show') return [row];
		const original = restrictions.items.get(`copy:${row.key}`)?.original ?? '';
		const cells = Object.fromEntries(
			Object.entries(row.cells).map(([name, cell]) => {
				if (name === 'topics') return [name, { text: '', values: [] }];
				if (cell.href && copyIdOfLink(cell.href)) return [name, { ...cell, href: original || undefined }];
				return [name, cell];
			})
		);
		return [{ ...row, cells }];
	});
}
