/**
 * A case's or law's citation line and a case's court, from its source record
 * alone, for pages that list cases without building their pages
 * (case-pages.ts, courts.ts).
 */
import type { SourceRecord } from './content.ts';

export function citationLine(record: SourceRecord): string {
	const { volume, page, number, authority } = record.citation;
	const reporter = [volume, record.citation['container-title'], page].filter(Boolean).join(' ');
	const year = record.citation.issued?.['date-parts']?.[0]?.[0];
	if (reporter && volume && page) return `${reporter}${year ? ` (${year})` : ''}`;
	return [number, [authority, year].filter(Boolean).join(', ')].filter(Boolean).join(' ').trim() || (year ? String(year) : '');
}

/** The court a case record names: the citation's authority, else its author. */
export function caseCourtName(record: SourceRecord): string | undefined {
	const named = record.citation.authority ?? record.citation.author?.find((author) => author.literal)?.literal;
	return typeof named === 'string' && named.trim() ? named.trim() : undefined;
}
