/**
 * What to call a law, treaty, case or order in a list or a heading, and its
 * page on this site: a court case at /cases/<key>, a law, treaty or order at
 * /laws/<key> (law-pages.ts).
 */
import { lawNames } from '../law-names.ts';
import { sources, type SourceRecord } from './content.ts';

/** The record kinds that get a page at /laws/<key>: federal laws, treaties and orders, federal agencies' own documents (opinions, enforcement actions, bulletins), and state statute sections (Trevor, Nov. 26, 2026). */
const lawKinds = new Set(['federal-statute', 'federal-regulation', 'federal-register-notice', 'federal-agency-document', 'executive-order', 'state-statute']);

export function isLawRecord(record: SourceRecord): boolean {
	const type = (record.citation as { type?: string }).type;
	return lawKinds.has(record.kind) || (record.kind === 'intergovernmental-agreement' && type === 'treaty');
}

function isCaseRecord(record: SourceRecord): boolean {
	return (record.citation as { type?: string }).type === 'legal_case' && Boolean(record.citation.title);
}

export function recordPageLink(key: string | undefined): string | undefined {
	const record = key ? sources().get(key) : undefined;
	if (!record) return undefined;
	if (isCaseRecord(record)) return `/cases/${key}`;
	if (isLawRecord(record)) return `/laws/${key}`;
	return undefined;
}

function yearOf(record: SourceRecord): number | undefined {
	return record.citation.issued?.['date-parts']?.[0]?.[0];
}

/**
 * A short name: the name the law is known by (src/lib/law-names.ts), else
 * the record's short title where it has one ("Curtis Act"), a
 * treaty's title without its date and citation, with the year ("Treaty with
 * the Cherokee (1835)"), a case's name, else the record's title.
 */
export function recordName(key: string): { name: string; italic?: boolean; kind?: string; what: string } {
	const record = sources().get(key);
	if (!record) return { name: key, what: 'Record' };
	const citation = record.citation as SourceRecord['citation'] & { 'title-short'?: string; type?: string };
	if (isCaseRecord(record)) return { name: citation.title ?? key, italic: true, kind: record.kind, what: 'Court case' };
	if (citation.type === 'treaty') {
		const year = yearOf(record);
		const title = citation['title-short'] ?? (citation.title ?? key).replace(/,\s+[A-Z][a-z]{2,4}\.? \d{1,2}, \d{4}.*$/, '');
		return { name: year && !title.includes(String(year)) ? `${title} (${year})` : title, kind: record.kind, what: 'Treaty' };
	}
	// A state statute section is named by its citation ("Okla. Stat. tit. 10, § 40"), which a year after it would misread as the code's edition.
	const year = record.kind === 'state-statute' ? undefined : yearOf(record);
	const short = lawNames[key] ?? citation['title-short'];
	return { name: short ? (year && !short.includes(String(year)) ? `${short} (${year})` : short) : (citation.title ?? key), kind: record.kind, what: 'Law' };
}
