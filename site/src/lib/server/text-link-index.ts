/**
 * The pages on this site that a citation inside a document's text can link
 * to (src/lib/text-links.ts), by the key the linker finds it by:
 *
 * - "case:309 us 506": a court case's page, by each reporter citation its
 *   record gives (case-previews.ts);
 * - "pl:100-89" and "stat:101:666": a statute's page, by its Public Law
 *   number and its Statutes at Large page;
 * - "eo:8473": an executive order's page, by its number;
 * - "usc:25:5321": a Title 25 section's own page, and
 *   "cfr:25:83.1" and "cfr:25:83" a 25 C.F.R. section's or part's.
 *
 * Built with the site and written as private static files spread by key
 * (src/lib/built-files.ts, textLinkFiles), so the Worker reads only the few
 * files a text's citations fall in (text-link-pages.ts). Runs in the build,
 * from vite.config.ts.
 */
import { casePreviewList } from './case-previews.ts';
import { sources, type SourceRecord } from './content.ts';
import { isLawRecord } from './law-records.ts';
import { orderNumber } from './law-facts.ts';
import { titleTwentyFiveSectionLink } from './code-outline.ts';
import { allSections } from './title-25-sections.ts';
import { citationsInText } from '../text-links.ts';

/** A law record's page wins over another's for the same key when it is the Act itself rather than a part of it. */
function better(key: string, held: string | undefined): boolean {
	if (!held) return true;
	return key.startsWith('public-law-') && !held.startsWith('public-law-');
}

/** Every key a citation can link by, with the page it links to. */
export function textLinkIndex(records: Iterable<SourceRecord> = sources().values()): Record<string, string> {
	const index: Record<string, string> = {};
	const lawOf: Record<string, string> = {};
	for (const [citation, id] of Object.entries(casePreviewList().citations)) index[`case:${citation}`] = `/cases/${id}`;
	for (const record of records) {
		if (!isLawRecord(record)) continue;
		const citation = record.citation as SourceRecord['citation'] & { number?: string; volume?: string; page?: string };
		const keys: string[] = [];
		// Its Public Law number and Statutes at Large page: from the record's fields, else from its title ("…, Pub. L. No. 100-89, 101 Stat. 666 (1987)").
		const written = citationsInText(`${citation.number ?? ''} ${citation.title ?? ''}`);
		const law = written.find((found) => found.key.startsWith('pl:'))?.key ?? (/^public-law-(\d+)-(\d+)$/.exec(record.key) ? `pl:${record.key.split('-')[2]}-${record.key.split('-')[3]}` : undefined);
		if (law) keys.push(law);
		if (record.kind === 'federal-statute') {
			if (citation.volume && /^\d+$/.test(citation.volume) && citation.page && /^\d+/.test(citation.page)) keys.push(`stat:${Number(citation.volume)}:${Number(citation.page.replace(/\D.*$/, ''))}`);
			else {
				const page = written.find((found) => found.key.startsWith('stat:'))?.key;
				if (page) keys.push(page);
			}
		}
		if (record.kind === 'executive-order') {
			const number = orderNumber(record);
			if (number && /^\d+$/.test(number)) keys.push(`eo:${Number(number)}`);
		}
		for (const key of keys) if (better(record.key, lawOf[key])) lawOf[key] = record.key;
	}
	for (const [key, record] of Object.entries(lawOf)) index[key] = `/laws/${record}`;
	for (const row of allSections('code')) {
		const number = /§ (\S+?)\.(?:\s|$)/.exec(row.title)?.[1];
		// The section's own page where it has one (code-outline.ts), else its place on its chapter's page.
		if (number) index[`usc:25:${number}`] = titleTwentyFiveSectionLink(number) ?? row.href;
	}
	for (const row of allSections('regulations')) {
		const number = /§ (\S+?)\.(?:\s|$)/.exec(row.title)?.[1];
		if (!number || !row.href.startsWith('/')) continue;
		index[`cfr:25:${number}`] = row.href;
		const part = number.split('.')[0];
		index[`cfr:25:${part}`] ??= row.href.replace(/#.*$/, '');
	}
	return index;
}
