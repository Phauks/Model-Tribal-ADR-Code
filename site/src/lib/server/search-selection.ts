/**
 * What the search page's download needs to know of each result, worked out while the site is built
 * (src/lib/search-selection.ts). Two parts:
 *
 * - /search/files.json, public: the file each result can be downloaded as, by the result's link,
 *   so the page can tag results ".pdf 489 KB", total a selection and filter to results with a copy.
 *   Nations' choices about their own laws and court opinions are applied when it is served
 *   (src/lib/restricted-files.ts, filterSearchFiles).
 * - Private records the Worker reads when it puts a .zip together (src/lib/built-files.ts,
 *   searchSelectionFiles): each result's copy, its source record's citation, and its nation. The
 *   Worker takes a copy only from here, never from what the reader sends.
 */
import type { CitationItem } from '../citation-formats.ts';
import { displayName } from '../nation-labels.ts';
import { copyPath, isSavedWebPage, type PublicCopy } from '../public-copies.ts';
import { listedFile, type SearchFiles } from '../search-selection.ts';
import { collections } from './collections.ts';
import { documentHistories, nations, publicCopyWithDigest, sources, type SourceRecord } from './content.ts';
import { savedCopyFor } from './markdown.ts';
import { itemLink } from './search-index.ts';

/** One result as the Worker reads it when the result is in a download. */
export interface SelectionRecord {
	/** The copy's key in the bucket, for a result this site holds a copy of. */
	copy?: string;
	/** The source record the result is, for its citation (src/lib/server/essay-citations.ts). */
	source?: string;
	/** The source record's citation, for the RIS and BibTeX lists. */
	item?: CitationItem;
	/** The nation it belongs to, by name, for folders by nation. */
	nation?: string;
	year?: number;
	/** Where it was published, for the list of the selection. */
	original?: string;
}

/** The copy a result opens at, when a result gathers several: its record's own, else the one document among them. */
function chosenCopy(record: SourceRecord | undefined, copies: PublicCopy[]): PublicCopy | undefined {
	const own = savedCopyFor(record);
	if (own) return own;
	if (copies.length === 1) return copies[0];
	const documents = copies.filter((copy) => !isSavedWebPage(copy));
	return documents.length === 1 ? documents[0] : undefined;
}

function itemOf(record: SourceRecord): CitationItem {
	return { ...(record.citation as Omit<CitationItem, 'id'>), id: record.key };
}

let built: { files: SearchFiles; records: Record<string, SelectionRecord> } | undefined;

/** Every result's file and record, by the result's link, worked out once. */
export function searchSelection(): { files: SearchFiles; records: Record<string, SelectionRecord> } {
	if (built) return built;
	const files: SearchFiles = {};
	const records: Record<string, SelectionRecord> = {};
	const names = new Map(nations().map((record) => [record.id, displayName(record.names.official)]));
	const nationName = (ids: readonly string[] | undefined) => (ids ?? []).map((id) => names.get(id)).find(Boolean);
	const add = (link: string | undefined, record: SelectionRecord, copy: PublicCopy | undefined) => {
		if (!link || records[link] || (!record.copy && !record.source)) return;
		records[link] = record;
		if (copy) files[link] = listedFile(link, [copy.bytes, copyPath(copy)]);
	};

	for (const collection of collections) {
		const group = collection.search.group;
		// A nation gathers many copies, and stories and glossary terms are pages of the site's own.
		if (group === 'nation' || group === 'story' || group === 'term') continue;
		for (const item of collection.items()) {
			const source = item.key ? sources().get(item.key) : undefined;
			const copy = chosenCopy(source, item.copies ?? []);
			const record: SelectionRecord = {
				...(copy ? { copy: copy.key } : {}),
				...(source ? { source: source.key, item: itemOf(source) } : {}),
				...(group === 'document' ? { nation: nationName(source?.tribes) ?? nationName(copy?.nations) } : {}),
				...(item.year ? { year: item.year } : {}),
				...((source?.original_link ?? copy?.links[0]) ? { original: source?.original_link ?? copy?.links[0] } : {})
			};
			if (record.nation === undefined) delete record.nation;
			// The link search lists it by: nations' laws by their own link (src/lib/server/search-records.ts), everything else as the index does.
			add(group === 'document' ? item.href : itemLink(item), record, copy);
		}
	}

	// Nations' documents with a history of their versions open at the history on the nation's page; the file is the latest version's.
	for (const history of documentHistories()) {
		const versions = [...history.versions].reverse();
		const version = versions.find((each) => publicCopyWithDigest(each.capture?.sha256));
		const copy = publicCopyWithDigest(version?.capture?.sha256);
		const source = version?.source ? sources().get(version.source) : undefined;
		for (const nation of history.nations ?? []) {
			if (!names.has(nation)) continue;
			add(
				`/nations/${nation}#document-${history.id}`,
				{
					...(copy ? { copy: copy.key, original: copy.links[0] } : {}),
					...(source ? { source: source.key, item: itemOf(source) } : {}),
					nation: names.get(nation)
				},
				copy
			);
		}
	}
	for (const record of Object.values(records)) if (!record.original) delete record.original;
	built = { files, records };
	return built;
}
