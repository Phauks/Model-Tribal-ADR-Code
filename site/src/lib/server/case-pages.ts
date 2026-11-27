/**
 * A page for each court case the project has a record of, at /cases/<key>
 * (Trevor, Nov. 24, 2026: a page for each case "instead of what we do now as
 * forcing the link inside the book"). Built with the site from the case's
 * source record, which also keeps the case's box (`case_box`,
 * record-boxes.ts):
 *
 * - the name, the citation and, beside them, the box's facts (dates, the
 *   Court linked to its page, the vote and the bench, case-facts.ts);
 * - the box's Background, Question, Holding, Quotes and Treatment, each
 *   quotation naming the opinion it comes from (case-opinions.ts);
 * - the opinions, each writer linked to the Justice's page and each opinion
 *   to its first page in the saved copy of the official report;
 * - the caption and the nations the case names, each linked to its page;
 * - where to read it, the same list a citation's book icon opens
 *   (reading-links.ts), shown open;
 * - the essays, nation pages and Court page on this site that cite it.
 *
 * A case with no box shows only what its record holds; a section with
 * nothing in it is left out.
 */
import { error } from '@sveltejs/kit';
import { essaysInGit } from 'virtual:essay-library';
import { renderEssay } from '../essays/render.ts';
import { markRecordText } from '../record-text.ts';
import { splitFrontMatter } from '../essays/syntax.ts';
import { boxPartMarkdown, laterCasesMarkdown, type RecordBox } from '../essays/record-boxes.ts';
import { essayLibrary, withRecordBoxes } from './essay-pages.ts';
import { essayPath, partOf, titleOf } from './essays.ts';
import { nationNamesAndKinds, publicCopyFor, sources, type SourceRecord } from './content.ts';
import { courtPath } from './supreme-courts.ts';
import { decidedDay, justiceLinkFor } from './supreme-court-people.ts';
import { savedCopyFor, savedCopyLink } from './markdown.ts';
import { publicCopyByKey, recordDocument, whereToRead } from './record-document.ts';
import { documentFile, type DocumentFile } from '../document-text.ts';
import { displayName } from '../nation-labels.ts';
import { officialReportLinks, readingLinksHtml } from '../reading-links.ts';
import { copyPagePath } from '../public-copies.ts';
import { opinionTitle, surname, type OpinionEntry } from '../case-opinions.ts';
import { opinionTextsOf } from './case-opinion-texts.ts';
import type { SourceEntry } from './source-uses.ts';
import { peopleInCase } from './biographies.ts';
import { accountsOf, type AccountEntry } from './impact-accounts.ts';
import { courtName, courtPagePath, isSupremeCourt } from '../court-pages.ts';
import type { Stub } from '../stubs.ts';
import type { CitedRecord } from '../citation-styles.ts';
import { caseCourtName, citationLine } from './record-citations.ts';

export { caseCourtName, citationLine };

export interface CaseMention {
	title: string;
	link: string;
	/** The heading of the section the case sits in. */
	where: string;
}

export interface CaseOpinion {
	/** "Opinion of the Court", "Concurring opinion". */
	title: string;
	/** The writer's surname. */
	justice: string;
	/** The writer's page (src/routes/supreme-court/justices), for a Supreme Court case. */
	justiceLink?: string;
	/** The report page where it starts. */
	page?: number;
	/** That page in the saved copy of the official report. */
	link?: string;
	note?: string;
	/** The page where it ends, when the site has its text (case-opinion-texts.ts). */
	lastPage?: number;
	/** Its length in words, when the site has its text. */
	words?: number;
	/** Its place among the opinions in the copy that holds its text, from 0; set only when the site has its text. */
	position?: number;
}

export interface CaseNation {
	id: string;
	name: string;
	role: string;
	namedAs?: string;
	note?: string;
}

export interface CasePage {
	key: string;
	name: string;
	citation: string;
	/** The parts of the record's citation the Cite panel rearranges for MLA (src/lib/citation-styles.ts). */
	reference: CitedRecord['reference'];
	caption?: string;
	facts: [string, string][];
	topics: string[];
	/** The box's parts, each a folding section. */
	boxSections: BoxSection[];
	opinions: CaseOpinion[];
	/** The served copy the opinions' text is read from when a reader opens the page (/cases/<key>/opinions.json), when the site has it. */
	opinionCopy?: string;
	nations: CaseNation[];
	/** Native people in the case who have a page (content/biographies/). */
	people: { name: string; link: string; role: string }[];
	/** A note every nation shares, shown once under the list instead of on each line. */
	nationNote?: string;
	/** The same lines as the list behind a citation's book icon (reading-links.ts), shown open. */
	readingHtml: string;
	readingCount: number;
	/** The decision's text as this site keeps it, in the Text card (DocumentText.svelte), when the record has a stored copy of its own (an agency decision's PDF). */
	text?: DocumentFile;
	/**
	 * The copy that holds the opinions' text, for the card around them. A case
	 * with one opinion and no stored copy of its own shows that copy as its
	 * Text, as the approved design does (design/document-text/, B2); a case
	 * with several keeps a fold for each opinion inside the card (CaseOpinions.svelte).
	 */
	opinionFile?: DocumentFile;
	/** Whether the opinion copy is shown as the case's Text rather than as its Opinions. */
	opinionAsText?: boolean;
	/** The page the case starts on in its reporter, for a passage's pinpoint citation. */
	firstPage?: string;
	essays: CaseMention[];
	nationPages: { name: string; link: string }[];
	court?: { name: string; link: string };
	/** Accounts of the case's impact on the people who lived under it (impact-accounts.ts). */
	accounts: AccountEntry[];
	sources: SourceEntry[];
	/** Set for a record a script wrote whose sources do not yet all agree (review.status "unverified", schemas/source.schema.json). */
	unverified?: boolean;
	/** The court that decided a case other than the Supreme Court's, with its page (src/lib/server/courts.ts). */
	decidedBy?: { name: string; link: string };
	/** Set when the case has no box and no accounts of its impact: a stub (src/lib/stubs.ts). */
	stub?: Stub;
}

interface CaseRecordParts {
	caption?: { printed: string };
	opinions?: { list: OpinionEntry[] };
	nations_in_case?: { named: { nation: string; named_as: string; role: string; note?: string }[] };
	supreme_court?: { court: string; justices?: { name: string; opinion?: string }[] };
	review?: { status: string };
}

const roles: Record<string, string> = { party: 'Party', government: 'Party through its officials or agency', subject: 'Not a party' };

type BoxPartHeading = [part: 'background' | 'question' | 'holding' | 'summary' | 'quotes' | 'treatment', heading: string];

const boxParts: BoxPartHeading[] = [
	['background', 'Background'],
	['question', 'Question'],
	['holding', 'Holding'],
	['quotes', 'Quotes'],
	['treatment', 'Treatment']
];

/** Every court case with a name, the cases that get a page. */
export function caseKeys(): string[] {
	return [...sources().values()].filter((record) => (record.citation as { type?: string }).type === 'legal_case' && record.citation.title).map((record) => record.key);
}

function caseBox(text: string, key: string): { inner: string; at: number; kind: string } | undefined {
	const match = new RegExp(`^:{4,}[ \\t]*(case|law)[ \\t]+${key}[ \\t]*\\n([\\s\\S]*?)^:{4,}[ \\t]*$`, 'm').exec(text);
	return match ? { inner: match[2], at: match.index, kind: match[1] } : undefined;
}

function headingBefore(text: string, at: number): string {
	return [...text.slice(0, at).matchAll(/^#{2,3}\s+(.+)$/gm)].at(-1)?.[1]?.trim() ?? '';
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One part of a record's box, as one of the page's folding sections (RecordBoxSections.svelte). */
export interface BoxSection {
	/** The heading's id, unique on the page. */
	id: string;
	heading: string;
	/** The number of quotations or Treatment paragraphs, shown in a badge. */
	count?: number;
	html: string;
}

/**
 * The box's parts as the page's sections, each under its own heading, with
 * the number of quotations and Treatment paragraphs in a badge. The parts
 * are rendered together, as one essay, so citations number across them, and
 * then cut apart at each part's heading.
 */
export function boxSections(key: string, title: string, box: RecordBox | undefined, parts: BoxPartHeading[] = boxParts): { sections: BoxSection[]; topics: string[]; sources: SourceEntry[] } {
	const topics = box?.topics ?? [];
	let markdown = '';
	const counts: Record<string, number> = {};
	// The later cases go under Treatment, after its words and outside them, so editing the words in place leaves the list alone.
	const laterCases = laterCasesMarkdown(box);
	for (const [part, heading] of parts) {
		const written = box ? boxPartMarkdown(key, box, part, { laterCases: false }) : '';
		if (!written && !(part === 'treatment' && laterCases)) continue;
		if (part === 'quotes') counts.quotes = box!.quotes!.length;
		if (part === 'treatment') counts.treatment = (box!.treatment ?? '').split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length + (box!.later_cases?.list.length ?? 0);
		markdown += `## ${heading}\n\n${written}\n\n`;
	}
	if (!markdown) return { sections: [], topics, sources: [] };
	const rendered = renderEssay(`# ${title}\n\n${markdown}`, essayLibrary);
	// Each prose part carries its name, so it can be edited in place (docs/site-text.md, "Record text").
	const html = markRecordText(rendered.html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\n?/, ''), key);
	const headings = [...html.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>\n?/g)];
	const laterHtml = laterCases ? `<div class="later-cases-block">\n${renderEssay(laterCases, essayLibrary).html}</div>` : '';
	const sections = headings.map((match, index) => {
		const part = html.slice(match.index + match[0].length, headings[index + 1]?.index ?? html.length).trim();
		return {
			id: match[1],
			heading: match[2].trim(),
			...(counts[match[1]] !== undefined ? { count: counts[match[1]] } : {}),
			html: match[1] === 'treatment' && laterHtml ? `${part}\n${laterHtml}` : part
		};
	});
	return { sections, topics, sources: rendered.sources };
}

/**
 * The opinions. Where the site serves their text (case-opinion-texts.ts),
 * one for each opinion in that copy, with its pages and length, the writer
 * named from the record's opinions block where one starts on the same page.
 * Otherwise from the record's opinions block, each linked to its first page
 * in the saved scan of the official report, which starts at the case's first
 * page. Without that block, the writers the bench names, unlinked.
 */
export function caseOpinions(record: SourceRecord & CaseRecordParts): CaseOpinion[] {
	// The Justices' pages, as the bench in At a glance links them (case-facts.ts).
	const decided = decidedDay(record.citation.issued);
	const writerLink = (name: string) => (record.supreme_court ? justiceLinkFor(name, decided, record.key) : undefined);
	const list = record.opinions?.list;
	const listed = list?.length ? recordOpinions(record, list, writerLink) : [];
	const texts = opinionTextsOf(record.key);
	if (texts.length) {
		// The opinions as the copy with their text has them; a writer the record names from the official report, with
		// the Justice's page and the page in the saved scan, wins over the writer's line in the copy.
		const unused = [...listed];
		return texts.map((text): CaseOpinion => {
			const at = unused.findIndex((opinion) => opinion.page !== undefined && opinion.page === text.firstPage);
			const named = at >= 0 ? unused.splice(at, 1)[0] : undefined;
			const perCuriam = text.kind === 'per curiam';
			return {
				...(named ?? { title: opinionTitle(text.kind), justice: perCuriam ? '' : text.author, justiceLink: perCuriam || !text.author ? undefined : writerLink(text.author), page: text.firstPage }),
				lastPage: text.lastPage,
				words: text.words,
				position: text.position
			};
		});
	}
	if (listed.length) return listed;
	return (record.supreme_court?.justices ?? [])
		.filter((justice) => justice.opinion)
		.map((justice) => ({ title: opinionTitle(justice.opinion!), justice: surname(justice.name), justiceLink: writerLink(justice.name) }));
}

/** The record's own list of opinions (its opinions block), each linked to its first page in the saved scan of the official report. */
function recordOpinions(record: SourceRecord & CaseRecordParts, list: OpinionEntry[], writerLink: (name: string) => string | undefined): CaseOpinion[] {
	const scan = officialReportLinks(record.reading_links).find((link) => /tile\.loc\.gov\/.+\/usrep\d+[a-z]?\.pdf$/.test(link));
	const copy = scan ? publicCopyFor(scan) : undefined;
	const first = Number(record.citation.page);
	return [...list]
		.sort((one, other) => one.page - other.page)
		.map((opinion) => ({
			title: opinionTitle(opinion.kind),
			justice: opinion.kind === 'per curiam' ? '' : surname(opinion.justice),
			justiceLink: opinion.kind === 'per curiam' ? undefined : writerLink(opinion.justice),
			page: opinion.page,
			link: copy && Number.isInteger(first) && opinion.page >= first ? `${copyPagePath(copy)}#page=${opinion.scan_page ?? opinion.page - first + 1}` : undefined,
			note: opinion.note
		}));
}

function caseNations(record: SourceRecord & CaseRecordParts): { nations: CaseNation[]; shared?: string } {
	const names = nationNamesAndKinds();
	const named = record.nations_in_case?.named ?? [];
	const nations = (record.tribes ?? []).map((id): CaseNation => {
		const entry = named.find((item) => item.nation === id);
		const known = names.get(id);
		const name = known ? displayName(known.name) : id;
		const namedAs = entry?.named_as.replace(/^the\s+/i, '');
		return {
			id,
			name,
			role: roles[entry?.role ?? 'subject'],
			namedAs: namedAs && namedAs.toLocaleLowerCase('en-US') !== name.replace(/^the\s+/i, '').toLocaleLowerCase('en-US') ? namedAs : undefined,
			note: entry?.note
		};
	});
	// A note every nation shares, such as why three nations descend from one, is said once.
	const notes = new Set(nations.map((nation) => nation.note));
	if (nations.length > 1 && notes.size === 1 && nations[0].note) {
		const shared = nations[0].note;
		return { nations: nations.map((nation) => ({ ...nation, note: undefined })), shared };
	}
	return { nations };
}

let essayTexts: { text: string; path: string }[] | undefined;

/**
 * Each essay as read, with each box it places filled from the record, so a
 * case cited inside another case's box counts. Worked out once per build,
 * since every case and law page asks.
 */
function essaysAsRead(): { text: string; path: string }[] {
	essayTexts ??= Object.entries(essaysInGit).map(([identifier, written]) => {
		const text = withRecordBoxes(written);
		return { text, path: essayPath(identifier, partOf(identifier, splitFrontMatter(text).frontMatter)) };
	});
	return essayTexts;
}

export function essaysCiting(key: string, title: string): CaseMention[] {
	const found: CaseMention[] = [];
	const mention = new RegExp(`\\[@${escapeRegExp(key)}[\\],]|\\*${escapeRegExp(title)}\\*`);
	for (const { text, path } of essaysAsRead()) {
		const box = caseBox(text, key);
		if (box) {
			found.push({ title: titleOf(text), link: `${path}#${box.kind}-${key}`, where: headingBefore(text, box.at) });
			continue;
		}
		const at = text.search(mention);
		if (at >= 0) found.push({ title: titleOf(text), link: path, where: headingBefore(text, at) });
	}
	return found.sort((one, other) => one.title.localeCompare(other.title));
}


/** The record's own stored copy (its `file` block), for the page's Text card; a copy of a whole reporter volume is left to Where to read it. */
function textOf(record: SourceRecord, name: string): CasePage['text'] {
	const stored = (record as SourceRecord & { file?: { checksum?: string } }).file?.checksum;
	const copy = stored ? savedCopyFor(record) : undefined;
	return copy && copy.sha256 === stored ? recordDocument(record, name, copy) : undefined;
}

/** The court, reporter, volume, first page and date of a case's citation, for the Cite panel. */
function citedParts(record: SourceRecord): CitedRecord['reference'] {
	const { volume, page, issued } = record.citation;
	return {
		authority: caseCourtName(record),
		'container-title': record.citation['container-title'],
		volume: volume === undefined ? undefined : String(volume),
		page: page === undefined ? undefined : String(page),
		issued: issued?.['date-parts'] ? { 'date-parts': issued['date-parts'] } : undefined
	};
}

export function casePage(key: string): CasePage {
	const record = sources().get(key) as (SourceRecord & CaseRecordParts) | undefined;
	if (!record || (record.citation as { type?: string }).type !== 'legal_case' || !record.citation.title) error(404, 'No case has this address.');
	const name = record.citation.title;
	const box = boxSections(key, name, record.case_box);
	const { nations, shared } = caseNations(record);
	const text = textOf(record, name);
	const opinionCopy = opinionTextsOf(key)[0]?.copy;
	const opinionPublic = publicCopyByKey(opinionCopy);
	const opinionFile = opinionPublic ? documentFile(opinionPublic, { title: name }) : undefined;
	const opinionList = caseOpinions(record);
	const opinionAsText = Boolean(opinionFile && !text && opinionList.filter((opinion) => opinion.position !== undefined).length === 1);
	// A saved copy no card shows, such as a whole volume of the reports, keeps its line under the publisher.
	const savedKey = savedCopyFor(record)?.key;
	const where = whereToRead(record, savedKey && savedKey !== text?.key && savedKey !== opinionCopy ? savedCopyLink(record) : '');
	const bench = record.supreme_court;
	const courtLink = bench ? courtPath(bench.court) : undefined;
	const decider = caseCourtName(record);
	const deciderLink = decider && !isSupremeCourt(decider) ? courtPagePath(decider) : undefined;
	const accounts = accountsOf({ record: key });
	return {
		key,
		name,
		citation: citationLine(record),
		reference: citedParts(record),
		caption: record.caption?.printed,
		// The nations have their own section, with how the case names each.
		facts: (essayLibrary.facts?.('case', key) ?? []).filter(([label]) => !/^(Nations?|Peoples?|Nations and peoples)$/.test(label)),
		topics: box.topics,
		boxSections: box.sections,
		opinions: opinionList,
		opinionCopy,
		...(opinionFile ? { opinionFile } : {}),
		...(opinionAsText ? { opinionAsText } : {}),
		...(record.citation.page ? { firstPage: String(record.citation.page).replace(/\D.*$/, '') } : {}),
		nations,
		people: peopleInCase(key),
		nationNote: shared,
		// The list a citation's book icon opens, shown open here, without the icon.
		readingHtml: readingLinksHtml(where.readingLinks, where.first).replace(/<button[\s\S]*?<\/button>/, ''),
		readingCount: where.count,
		text,
		essays: essaysCiting(key, name),
		nationPages: nations.filter((nation) => nationNamesAndKinds().has(nation.id)).map((nation) => ({ name: nation.name, link: `/nations/${nation.id}` })),
		court: bench && courtLink ? { name: bench.court, link: courtLink } : undefined,
		accounts,
		sources: box.sources,
		unverified: record.review?.status === 'unverified' || undefined,
		decidedBy: decider && deciderLink ? { name: courtName(decider), link: deciderLink } : undefined,
		stub: box.sections.length === 0 && accounts.length === 0 ? { kind: 'case', record: `cases/${key}` } : undefined
	};
}
