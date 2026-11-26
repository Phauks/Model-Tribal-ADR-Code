/**
 * A page for each federal law, treaty and executive order the project has a
 * record of, at /laws/<key>, on the site's one item layout (InfoPage; Trevor
 * asked on Nov. 24, 2026 for a place on each law for the accounts of its
 * impact). Built with the site from the law's source record:
 *
 * - its name, its citation and, At a glance, its kind, date and citation;
 * - its box's Summary, Quotes and Treatment (`law_box`, record-boxes.ts);
 * - the accounts of its impact (impact-accounts.ts), shown only when an
 *   account names the law;
 * - where to read it, the essays on this site that cite it and, for a
 *   treaty, the people with a biography who signed it.
 *
 * A section with nothing in it is left out.
 */
import { error } from '@sveltejs/kit';
import { readingLinksHtml } from '../reading-links.ts';
import { signersOfTreaty } from './biographies.ts';
import { boxSections, citationLine, type BoxSection, essaysCiting, type CaseMention } from './case-pages.ts';
import { sources, type SourceRecord } from './content.ts';
import type { FactGroup } from './justice-pages.ts';
import { accountsOf, type AccountEntry } from './impact-accounts.ts';
import { isLawRecord, recordName } from './law-records.ts';
import { savedCopyLink } from './markdown.ts';
import { partialDate } from './stories.ts';
import type { SourceEntry } from './source-uses.ts';
import type { Stub } from '../stubs.ts';

export interface LawPage {
	key: string;
	name: string;
	/** The law's citation, as the Indigo Book writes it. */
	citation: string;
	/** The law's full title, when its name is a short one. */
	fullTitle?: string;
	glance: FactGroup[];
	/** The box's parts, each a folding section. */
	boxSections: BoxSection[];
	topics: string[];
	accounts: AccountEntry[];
	readingHtml: string;
	readingCount: number;
	essays: CaseMention[];
	/** The people with a biography on this site who signed the treaty. */
	signers: { name: string; link: string; detail?: string }[];
	sources: SourceEntry[];
	/** Set when the law has no box and no accounts of its impact: a stub (src/lib/stubs.ts). */
	stub?: Stub;
}

const kindLabels: Record<string, string> = {
	'federal-statute': 'Federal statute',
	'federal-regulation': 'Federal regulation',
	'federal-register-notice': 'Federal Register notice',
	'executive-order': 'Executive order',
	'intergovernmental-agreement': 'Treaty'
};

const dateLabels: Record<string, string> = {
	'federal-statute': 'Enacted',
	'federal-regulation': 'Edition',
	'federal-register-notice': 'Published',
	'executive-order': 'Signed',
	'intergovernmental-agreement': 'Signed'
};

/** Every federal law, treaty and order with a record, the laws that get a page. */
export function lawKeys(): string[] {
	return [...sources().values()].filter(isLawRecord).map((record) => record.key);
}

/** The citation the record's notes give ("Indigo Book citation: …" or "Citations: …"), else one built from its parts. */
function lawCitation(record: SourceRecord): string {
	const notes = (record as SourceRecord & { notes?: string }).notes ?? '';
	const written = /(?:Indigo Book citation|Citations):\s*(.+?)(?:\.\s+[A-Z]|\.?$)/.exec(notes)?.[1];
	if (written) return written.trim();
	const { volume, page } = record.citation;
	const year = record.citation.issued?.['date-parts']?.[0]?.[0];
	if (volume && page) return `${volume} ${record.citation['container-title'] === 'United States Statutes at Large' ? 'Stat.' : (record.citation['container-title'] ?? '')} ${page}${year ? ` (${year})` : ''}`.replace(/\s+/g, ' ');
	return citationLine(record);
}

function isoOf(parts: number[] | undefined): string | undefined {
	if (!parts?.length) return undefined;
	return parts.map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0'))).join('-');
}

export function lawPage(key: string): LawPage {
	const record = sources().get(key);
	if (!record || !isLawRecord(record)) error(404, 'No law has this address.');
	const named = recordName(key);
	const citation = lawCitation(record);
	const box = boxSections(key, named.name, record.law_box, [
		['summary', 'Summary'],
		['quotes', 'Quotes'],
		['treatment', 'Treatment']
	]);
	const date = partialDate(isoOf(record.citation.issued?.['date-parts']?.[0]));
	const glance: FactGroup[] = [
		{ field: 'kind', label: 'Kind', items: [{ text: kindLabels[record.kind] ?? record.kind }] },
		{ field: 'date', label: dateLabels[record.kind] ?? 'Date', items: date ? [{ text: date }] : [] },
		{ field: 'citation', label: 'Citation', items: citation ? [{ text: citation }] : [] }
	].filter((group) => group.items.length > 0);
	const saved = savedCopyLink(record);
	const title = record.citation.title;
	const accounts = accountsOf({ record: key });
	return {
		key,
		name: named.what === 'Treaty' ? named.name : named.name.replace(/ \(\d{4}\)$/, ''),
		citation,
		fullTitle: !title || named.name.startsWith(title) || citation.includes(title) ? undefined : title,
		glance,
		boxSections: box.sections,
		topics: box.topics,
		accounts,
		readingHtml: readingLinksHtml(record.reading_links, saved).replace(/<button[\s\S]*?<\/button>/, ''),
		readingCount: (record.reading_links?.links.length ?? 0) + (saved ? 1 : 0),
		essays: essaysCiting(key, named.name),
		signers: named.what === 'Treaty' ? signersOfTreaty(key) : [],
		sources: box.sources,
		stub: box.sections.length === 0 && accounts.length === 0 ? { kind: 'law', record: `laws/${key}` } : undefined
	};
}
