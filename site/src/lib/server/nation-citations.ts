/**
 * The sources one nation's page cites, as citation data, for the files its Download menu offers
 * (src/lib/page-downloads.ts): CSL JSON, RIS and BibTeX. Each entry is the citation data from the
 * source's record in content/sources, with the record's key as its id. A withdrawn page shows only
 * its name and status, so it lists no sources.
 */
import type { CitationItem } from '../citation-formats.ts';
import { nations, sources } from './content.ts';
import { sourceKeys } from './source-keys.ts';

/** The nation's sources, or undefined when no published record has that identifier. */
export function nationCitationItems(id: string): CitationItem[] | undefined {
	const record = nations().find((candidate) => candidate.id === id);
	if (!record) return undefined;
	if (record.review?.status === 'withdrawn-at-request') return [];
	const records = sources();
	return [...sourceKeys(record)].sort().flatMap((key) => {
		const source = records.get(key);
		return source ? [{ ...(source.citation as Omit<CitationItem, 'id'>), id: key }] : [];
	});
}
