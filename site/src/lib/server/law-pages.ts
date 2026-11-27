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
 *   treaty, the people with a biography who signed it;
 * - for a chapter of Title 25 of the Code or a part of 25 C.F.R., its
 *   sections, and for an Act, the Title 25 sections it enacted
 *   (title-25-sections.ts).
 *
 * A section with nothing in it is left out.
 */
import { error } from '@sveltejs/kit';
import { copyPath } from '../public-copies.ts';
import { readingLinksHtml } from '../reading-links.ts';
import { signersOfTreaty } from './biographies.ts';
import { boxSections, citationLine, type BoxSection, essaysCiting, type CaseMention } from './case-pages.ts';
import { nations, sources, type SourceRecord } from './content.ts';
import { displayName, stateName } from '../nation-labels.ts';
import { escapeHtml } from '../escape-html.ts';
import type { FactGroup } from './justice-pages.ts';
import { accountsOf, type AccountEntry } from './impact-accounts.ts';
import { isoOf, nationsCiting, orderNumber, orderPresident, type LawNation } from './law-facts.ts';
import { isLawRecord, recordName } from './law-records.ts';
import { boundsOfCessions, cessionsOfTreaty, treatyMapData } from './land-cessions.ts';
import { savedCopyFor, savedCopyLink } from './markdown.ts';
import { presidentByKey } from './supreme-court-people.ts';
import { partialDate } from './stories.ts';
import type { SourceEntry } from './source-uses.ts';
import type { Stub } from '../stubs.ts';
import { sectionsEnactedBy, sectionsOf, type SectionList } from './title-25-sections.ts';
import { chapterNavigation, sectionPage, sectionPageOfRecord, type ChapterNavigation, type SectionPage } from './code-outline.ts';

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
	/** A Title 25 chapter's or part's sections. */
	sections?: SectionList;
	/** The Title 25 sections the Act enacted. */
	enacted: { label: string; heading: string; link: string; inForce: boolean }[];
	sources: SourceEntry[];
	/** The land a treaty ceded, from Royce's schedule (1899), for the small map under At a glance (historic maps mockup 7). */
	landCeded?: { royce: string[]; bounds: [number, number, number, number]; map: ReturnType<typeof treatyMapData> };
	/** Set when the law has no box and no accounts of its impact: a stub (src/lib/stubs.ts). */
	stub?: Stub;
	/** A chapter of Title 25 of the Code: its contents, the chapters before and after, and the side column's outline (code-outline.ts). */
	chapter?: Omit<ChapterNavigation, 'family' | 'trail'>;
	/** The side column's outline, for a chapter of Title 25. */
	family?: ChapterNavigation['family'];
	/** The pages above this one, where the law sits in an outline. */
	trail?: ChapterNavigation['trail'];
}

/** A record of a single Title 25 section: its page is the section's own (code-outline.ts). */
export interface LawMoved {
	movedTo: string;
}

/** A section of Title 25 on its own page, with what the site's older record of that section holds: its box, accounts and where the site cites it. */
export interface SectionPageData extends SectionPage {
	kept: Pick<LawPage, 'key' | 'name' | 'boxSections' | 'accounts' | 'essays' | 'nations' | 'sources'>[];
}

export function sectionPageData(slug: string): SectionPageData {
	const page = sectionPage(slug);
	return {
		...page,
		kept: page.records.map((key) => {
			const law = lawContent(key);
			return { key, name: law.name, boxSections: law.boxSections, accounts: law.accounts, essays: law.essays, nations: law.nations, sources: law.sources };
		})
	};
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
	'federal-agency-document': 'Federal agency document',
	'executive-order': 'Executive order',
	'intergovernmental-agreement': 'Treaty',
	'state-statute': 'State statute'
};

const dateLabels: Record<string, string> = {
	'federal-statute': 'Enacted',
	'federal-regulation': 'Edition',
	'federal-register-notice': 'Published',
	'federal-agency-document': 'Issued',
	'executive-order': 'Signed',
	'intergovernmental-agreement': 'Signed',
	'state-statute': 'Enacted'
};

/** How a state statute section bears on Native nations (schemas/source.schema.json, state_law.relevance). */
const relevanceLabels: Record<string, string> = { core: 'Core', incidental: 'Incidental' };

/** Every federal law, treaty and order with a record, the laws that get a page. */
export function lawKeys(): string[] {
	return [...sources().values()].filter(isLawRecord).map((record) => record.key);
}

/** The citation the record's notes give ("Indigo Book citation: …" or "Citations: …"), else one built from its parts. */
function lawCitation(record: SourceRecord): string {
	if (record.state_law?.citation) return record.state_law.citation;
	const notes = (record as SourceRecord & { notes?: string }).notes ?? '';
	// The citation ends at the end of its sentence, not at an abbreviation inside it ("Exec. Order", "Pub. L.", "tit. II", "Charles J. Kappler").
	const written = /(?:Indigo Book citation|Citations):\s*(.+?)(?:(?<!\b(?:Exec|Pub|Fed|Cong|Sess|Doc|Rep|Proc|Res|Sec|No|Jr|tits?|div|Con|Stat|Reg|Rec|Ord|Admin|Dept|Comm|[A-Z]))\.\s+[A-Z]|\.?$)/.exec(notes)?.[1];
	if (written) return written.trim();
	const { volume, page } = record.citation;
	const year = record.citation.issued?.['date-parts']?.[0]?.[0];
	if (volume && page) return `${volume} ${record.citation['container-title'] === 'United States Statutes at Large' ? 'Stat.' : (record.citation['container-title'] ?? '')} ${page}${year ? ` (${year})` : ''}`.replace(/\s+/g, ' ');
	return citationLine(record);
}


/** The nations a record names in its tribes field, by name, in the order given. */
function namedNations(ids: string[]): { id: string; name: string }[] {
	if (ids.length === 0) return [];
	const byId = new Map(nations().map((nation) => [nation.id, nation]));
	return ids.slice(0, glanceNations).flatMap((id) => {
		const nation = byId.get(id);
		return nation ? [{ id, name: displayName(nation.names.official) }] : [];
	});
}

/** The states a state statute's record names in its jurisdictions, by name. */
function stateNamesOf(record: SourceRecord): string[] {
	const jurisdictions = (record as SourceRecord & { jurisdictions?: { level?: string; state?: string }[] }).jurisdictions ?? [];
	return [...new Set(jurisdictions.filter((entry) => entry.level === 'state' && entry.state).map((entry) => stateName(entry.state!)))];
}

/** The most nations At a glance names one by one. */
const glanceNations = 8;

export function lawPage(key: string): LawPage | LawMoved {
	const movedTo = sectionPageOfRecord(key);
	return movedTo ? { movedTo } : lawContent(key);
}

function lawContent(key: string): LawPage {
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
	// An agency's document or notice no nation page cites yet still names its nations in the record (tribes).
	const nationsNamed = nationsCited.length > 0 ? nationsCited : namedNations(record.tribes ?? []);
	const ceded = cessionsOfTreaty(key);
	const cededBounds = boundsOfCessions(ceded);
	const glance: FactGroup[] = [
		// An agency's document says which kind it is, such as "Indian lands opinion" (scripts/law/nigc_documents.py).
		{ field: 'kind', label: 'Kind', items: [{ text: (record.citation as { genre?: string }).genre ?? kindLabels[record.kind] ?? record.kind }] },
		{ field: 'state', label: 'State', items: record.kind === 'state-statute' ? stateNamesOf(record).map((text) => ({ text })) : [] },
		{ field: 'indian-law', label: 'Indian law', items: record.state_law ? [{ text: relevanceLabels[record.state_law.relevance] ?? record.state_law.relevance }] : [] },
		{ field: 'act', label: 'Act', items: record.state_law?.act ? [{ text: record.state_law.act }] : [] },
		{ field: 'agency', label: 'Agency', items: record.kind === 'federal-agency-document' ? (record.citation.author ?? []).flatMap((author) => (author.literal ? [{ text: author.literal }] : [])) : [] },
		{ field: 'number', label: 'Number', items: number ? [{ text: number }] : [] },
		// A chapter of the Code is dated by the edition it was read from, not enacted on one day.
		{ field: 'date', label: /^usc-\d+-chapter-/.test(key) ? 'Edition' : (dateLabels[record.kind] ?? 'Date'), items: date ? [{ text: date }] : [] },
		{ field: 'president', label: 'President', items: president ? [{ text: president.name, link: presidentPage }] : [] },
		{ field: 'citation', label: 'Citation', items: citation ? [{ text: citation }] : [] },
		// Each cession opens on the Map page at its year; Royce's map sheets open in the image viewer.
		{
			field: 'land-ceded',
			label: 'Land ceded',
			items: ceded.map((cession) => ({
				text: `Royce cession ${cession.royce}`,
				link: `/nations/map?cession=${cession.royce}`,
				detailParts:
					cession.sheets.length === 0
						? undefined
						: [
								{ text: `On Royce’s ${cession.sheets.length === 1 ? 'map' : 'maps'} ` },
								...cession.sheets.flatMap((sheet, index) => [
									...(index === 0 ? [] : [{ text: index === cession.sheets.length - 1 ? ' and ' : ', ' }]),
									{ text: sheet.name, link: sheet.image, viewer: `Royce’s map: ${sheet.name}`, original: sheet.link }
								])
							]
			}))
		},
		{
			field: 'nations',
			label: nationsNamed.length === 1 ? 'Nation' : 'Nations',
			// A list such as the Federal Register's list of recognized nations is cited by hundreds: At a glance counts them.
			items:
				nationsCited.length > glanceNations
					? [{ text: `${nationsCited.length.toLocaleString('en-US')} nations`, link: '#on-this-site' }]
					: nationsNamed.map((nation) => ({ text: nation.name, link: `/nations/${nation.id}` }))
		}
	]
		// A chapter of the Code needs no "Kind": its outline says what it is.
		.filter((group) => group.items.length > 0 && !(group.field === 'kind' && /^usc-25-chapter-/.test(key)));
	// A state statute is linked, not served (decision record 0060): with no saved copy, its official text is the first place to read it.
	const official = record.kind === 'state-statute' && record.original_link ? `<a href="${escapeHtml(record.original_link)}">${escapeHtml(record.citation.author?.[0]?.literal ?? 'Official text')}</a>` : '';
	const saved = savedCopyLink(record) || official;
	const copy = savedCopyFor(record);
	const title = record.citation.title;
	const accounts = accountsOf({ record: key });
	const navigation = chapterNavigation(key);
	// A chapter of the Code lists its contents under its subchapters instead (code-outline.ts).
	const sections = navigation ? undefined : sectionsOf(key);
	return {
		key,
		// A chapter of the Code is named with its number, as the Code heads it: "Chapter 46. Indian Self-Determination and Education Assistance".
		name: navigation ? `${navigation.family.title}` : named.what === 'Treaty' ? named.name : named.name.replace(/ \(\d{4}\)$/, ''),
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
		sections,
		enacted: record.kind === 'federal-statute' ? sectionsEnactedBy(key) : [],
		landCeded: cededBounds ? { royce: ceded.map((cession) => cession.royce), bounds: cededBounds, map: treatyMapData() } : undefined,
		sources: box.sources,
		stub: box.sections.length === 0 && accounts.length === 0 && !sections && !navigation ? { kind: 'law', record: `laws/${key}` } : undefined,
		...(navigation ? { chapter: { contents: navigation.contents, previous: navigation.previous, next: navigation.next, inForce: navigation.inForce, notInForce: navigation.notInForce }, family: navigation.family, trail: navigation.trail } : {})
	};
}
