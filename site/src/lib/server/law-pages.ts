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
import { copyPath } from '../public-copies.ts';
import { readingLinksHtml } from '../reading-links.ts';
import { signersOfTreaty } from './biographies.ts';
import { boxSections, citationLine, type BoxSection, essaysCiting, type CaseMention } from './case-pages.ts';
import { sources, type SourceRecord } from './content.ts';
import type { FactGroup } from './justice-pages.ts';
import { accountsOf, type AccountEntry } from './impact-accounts.ts';
import { isoOf, nationsCiting, orderNumber, orderPresident, type LawNation } from './law-facts.ts';
import { isLawRecord, recordName } from './law-records.ts';
import { savedCopyFor, savedCopyLink } from './markdown.ts';
import { presidentByKey } from './supreme-court-people.ts';
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
	/** The nations whose pages cite the law, with what each page says it did there, such as the land it set aside. */
	nations: LawNation[];
	/** The law's text as this site keeps it, shown in a frame on the page. */
	text?: LawText;
	/** The people with a biography on this site who signed the treaty. */
	signers: { name: string; link: string; detail?: string }[];
	sources: SourceEntry[];
	/** Set when the law has no box and no accounts of its impact: a stub (src/lib/stubs.ts). */
	stub?: Stub;
}


export interface LawText {
	/** The file itself, for the frame; "Where to read it" links the copy's own page. */
	file: string;
	isPdf: boolean;
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
	// The citation ends at the end of its sentence, not at an abbreviation inside it ("Exec. Order", "Pub. L.", "tit. II", "Charles J. Kappler").
	const written = /(?:Indigo Book citation|Citations):\s*(.+?)(?:(?<!\b(?:Exec|Pub|Fed|Cong|Sess|Doc|Rep|Proc|Res|Sec|No|Jr|tits?|div|Con|Stat|Reg|Rec|Ord|Admin|Dept|Comm|[A-Z]))\.\s+[A-Z]|\.?$)/.exec(notes)?.[1];
	if (written) return written.trim();
	const { volume, page } = record.citation;
	const year = record.citation.issued?.['date-parts']?.[0]?.[0];
	if (volume && page) return `${volume} ${record.citation['container-title'] === 'United States Statutes at Large' ? 'Stat.' : (record.citation['container-title'] ?? '')} ${page}${year ? ` (${year})` : ''}`.replace(/\s+/g, ' ');
	return citationLine(record);
}


/** The most nations At a glance names one by one. */
const glanceNations = 8;

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
	const order = record.kind === 'executive-order';
	const number = order ? orderNumber(record) : undefined;
	const president = order ? orderPresident(record) : undefined;
	const presidentPage = president && presidentByKey(president.key) ? `/supreme-court/presidents/${president.key}` : undefined;
	const nationsCited = nationsCiting(key);
	const glance: FactGroup[] = [
		{ field: 'kind', label: 'Kind', items: [{ text: kindLabels[record.kind] ?? record.kind }] },
		{ field: 'number', label: 'Number', items: number ? [{ text: number }] : [] },
		{ field: 'date', label: dateLabels[record.kind] ?? 'Date', items: date ? [{ text: date }] : [] },
		{ field: 'president', label: 'President', items: president ? [{ text: president.name, link: presidentPage }] : [] },
		{ field: 'citation', label: 'Citation', items: citation ? [{ text: citation }] : [] },
		{
			field: 'nations',
			label: nationsCited.length === 1 ? 'Nation' : 'Nations',
			// A list such as the Federal Register's list of recognized nations is cited by hundreds: At a glance counts them.
			items:
				nationsCited.length > glanceNations
					? [{ text: `${nationsCited.length.toLocaleString('en-US')} nations`, link: '#on-this-site' }]
					: nationsCited.map((nation) => ({ text: nation.name, link: `/nations/${nation.id}` }))
		}
	].filter((group) => group.items.length > 0);
	const saved = savedCopyLink(record);
	const copy = savedCopyFor(record);
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
		nations: nationsCited,
		text: copy ? { file: copyPath(copy), isPdf: copy.mediaType === 'application/pdf' } : undefined,
		signers: named.what === 'Treaty' ? signersOfTreaty(key) : [],
		sources: box.sources,
		stub: box.sections.length === 0 && accounts.length === 0 ? { kind: 'law', record: `laws/${key}` } : undefined
	};
}
