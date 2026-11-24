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
import { essayBoxFacts, essaysInGit } from 'virtual:essay-library';
import { renderEssay } from '../essays/render.ts';
import { splitFrontMatter } from '../essays/syntax.ts';
import { boxPartMarkdown, type RecordBox } from '../essays/record-boxes.ts';
import { essayLibrary, withRecordBoxes } from './essay-pages.ts';
import { essayPath, partOf, titleOf } from './essays.ts';
import { nationNamesAndKinds, publicCopyFor, sources, type SourceRecord } from './content.ts';
import { courtPath } from './supreme-courts.ts';
import { decidedDay, justiceLinkFor } from './supreme-court-people.ts';
import { savedCopyLink } from './markdown.ts';
import { displayName } from '../nation-labels.ts';
import { officialReportLinks, readingLinksHtml } from '../reading-links.ts';
import { copyPagePath } from '../public-copies.ts';
import { opinionTitle, surname, type OpinionEntry } from '../case-opinions.ts';
import type { SourceEntry } from './source-uses.ts';
import { peopleInCase } from './biographies.ts';
import { accountsOf, type AccountEntry } from './impact-accounts.ts';

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
	caption?: string;
	facts: [string, string][];
	topics: string[];
	bodyHtml: string;
	opinions: CaseOpinion[];
	nations: CaseNation[];
	/** Native people in the case who have a page (content/biographies/). */
	people: { name: string; link: string; role: string }[];
	/** A note every nation shares, shown once under the list instead of on each line. */
	nationNote?: string;
	/** The same lines as the list behind a citation's book icon (reading-links.ts), shown open. */
	readingHtml: string;
	readingCount: number;
	essays: CaseMention[];
	nationPages: { name: string; link: string }[];
	court?: { name: string; link: string };
	/** Accounts of the case's impact on the people who lived under it (impact-accounts.ts). */
	accounts: AccountEntry[];
	sources: SourceEntry[];
	/** Set for a record a script wrote whose sources do not yet all agree (review.status "unverified", schemas/source.schema.json). */
	unverified?: boolean;
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

/**
 * The box's parts as the page's sections, each under its own heading, with
 * the number of quotations and Treatment paragraphs in a badge.
 */
export function boxSections(key: string, title: string, box: RecordBox | undefined, parts: BoxPartHeading[] = boxParts): { html: string; topics: string[]; sources: SourceEntry[] } {
	const topics = box?.topics ?? [];
	let markdown = '';
	const counts: Record<string, number> = {};
	for (const [part, heading] of parts) {
		const written = box ? boxPartMarkdown(key, box, part) : '';
		if (!written) continue;
		if (part === 'quotes') counts.quotes = box!.quotes!.length;
		if (part === 'treatment') counts.treatment = box!.treatment!.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
		markdown += `## ${heading}\n\n${written}\n\n`;
	}
	if (!markdown) return { html: '', topics, sources: [] };
	const rendered = renderEssay(`# ${title}\n\n${markdown}`, essayLibrary);
	const badge = (count: number) => ` <span class="count-badge"><span class="visually-hidden">, </span>${count}</span>`;
	let html = rendered.html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\n?/, '');
	for (const [kind, count] of Object.entries(counts)) html = html.replace(new RegExp(`(<h2 id="${kind}">[^<]+)(</h2>)`), `$1${badge(count)}$2`);
	return { html, topics, sources: rendered.sources };
}

/**
 * The opinions, from the record's opinions block, each linked to its first
 * page in the saved scan of the official report, which starts at the case's
 * first page. Without that block, the writers the bench names, unlinked.
 */
export function caseOpinions(record: SourceRecord & CaseRecordParts): CaseOpinion[] {
	// The Justices' pages, as the bench in At a glance links them (case-facts.ts).
	const decided = decidedDay(record.citation.issued);
	const writerLink = (name: string) => (record.supreme_court ? justiceLinkFor(name, decided, record.key) : undefined);
	const list = record.opinions?.list;
	if (list?.length) {
		const scan = officialReportLinks(record.reading_links).find((link) => /tile\.loc\.gov\/.+\/usrep\d+\.pdf$/.test(link));
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
	return (record.supreme_court?.justices ?? [])
		.filter((justice) => justice.opinion)
		.map((justice) => ({ title: opinionTitle(justice.opinion!), justice: surname(justice.name), justiceLink: writerLink(justice.name) }));
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

export function citationLine(record: SourceRecord): string {
	const { volume, page, number, authority } = record.citation;
	const reporter = [volume, record.citation['container-title'], page].filter(Boolean).join(' ');
	const year = record.citation.issued?.['date-parts']?.[0]?.[0];
	if (reporter && volume && page) return `${reporter}${year ? ` (${year})` : ''}`;
	return [number, [authority, year].filter(Boolean).join(', ')].filter(Boolean).join(' ').trim() || (year ? String(year) : '');
}

export function casePage(key: string): CasePage {
	const record = sources().get(key) as (SourceRecord & CaseRecordParts) | undefined;
	if (!record || (record.citation as { type?: string }).type !== 'legal_case' || !record.citation.title) error(404, 'No case has this address.');
	const name = record.citation.title;
	const box = boxSections(key, name, record.case_box);
	const { nations, shared } = caseNations(record);
	const saved = savedCopyLink(record);
	const bench = record.supreme_court;
	const courtLink = bench ? courtPath(bench.court) : undefined;
	return {
		key,
		name,
		citation: citationLine(record),
		caption: record.caption?.printed,
		// The nations have their own section, with how the case names each.
		facts: (essayBoxFacts.cases[key] ?? []).filter(([label]) => !/^(Nations?|Peoples?|Nations and peoples)$/.test(label)),
		topics: box.topics,
		bodyHtml: box.html,
		opinions: caseOpinions(record),
		nations,
		people: peopleInCase(key),
		nationNote: shared,
		// The list a citation's book icon opens, shown open here, without the icon.
		readingHtml: readingLinksHtml(record.reading_links, saved).replace(/<button[\s\S]*?<\/button>/, ''),
		readingCount: (record.reading_links?.links.length ?? 0) + (saved ? 1 : 0),
		essays: essaysCiting(key, name),
		nationPages: nations.filter((nation) => nationNamesAndKinds().has(nation.id)).map((nation) => ({ name: nation.name, link: `/nations/${nation.id}` })),
		court: bench && courtLink ? { name: bench.court, link: courtLink } : undefined,
		accounts: accountsOf({ record: key }),
		sources: box.sources,
		unverified: record.review?.status === 'unverified' || undefined
	};
}
