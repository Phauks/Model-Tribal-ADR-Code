/**
 * A page for each court case the project has a record of, at /cases/<key>
 * (Trevor, Nov. 24, 2026: a page for each case "instead of what we do now as
 * forcing the link inside the book"). Built with the site from the case's
 * source record and its box in an essay:
 *
 * - the name, the citation and, beside them, the box's facts (dates, the
 *   Court linked to its page, the vote and the bench, case-facts.ts);
 * - the box's Background, Question, Holding, Quotes and Treatment, each
 *   quotation naming the opinion it comes from (case-opinions.ts);
 * - the opinions, each linked to its first page in the saved copy of the
 *   official report;
 * - the caption and the nations the case names, each linked to its page;
 * - where to read it, the same list a citation's book icon opens
 *   (reading-links.ts), shown open;
 * - the essays, nation pages and Court page on this site that cite it.
 *
 * A case with no box shows only what its record holds; a section with
 * nothing in it is left out.
 */
import { peopleInCase } from './biographies.ts';
import { error } from '@sveltejs/kit';
import { essayBoxFacts, essaysInGit } from 'virtual:essay-library';
import { renderEssay } from '../essays/render.ts';
import { splitFrontMatter, topicsIn } from '../essays/syntax.ts';
import { essayLibrary } from './essay-pages.ts';
import { essayPath, partOf, titleOf } from './essays.ts';
import { nationNamesAndKinds, publicCopyFor, sources, type SourceRecord } from './content.ts';
import { courtPath } from './supreme-courts.ts';
import { savedCopyLink } from './markdown.ts';
import { displayName } from '../nation-labels.ts';
import { officialReportLinks, readingLinksHtml } from '../reading-links.ts';
import { copyPagePath } from '../public-copies.ts';
import { opinionTitle, surname, type OpinionEntry } from '../case-opinions.ts';
import type { SourceEntry } from './source-uses.ts';

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
	sources: SourceEntry[];
}

interface CaseRecordParts {
	caption?: { printed: string };
	opinions?: { list: OpinionEntry[] };
	nations_in_case?: { named: { nation: string; named_as: string; role: string; note?: string }[] };
	supreme_court?: { court: string; justices?: { name: string; opinion?: string }[] };
}

const roles: Record<string, string> = { party: 'Party', government: 'Party through its officials or agency', subject: 'Not a party' };

const boxParts: [kind: string, heading: string][] = [
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

function caseBox(text: string, key: string): { inner: string; at: number } | undefined {
	const match = new RegExp(`^:{4,}[ \\t]*case[ \\t]+${key}[ \\t]*\\n([\\s\\S]*?)^:{4,}[ \\t]*$`, 'm').exec(text);
	return match ? { inner: match[1], at: match.index } : undefined;
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
function boxSections(key: string, title: string): { html: string; topics: string[]; sources: SourceEntry[] } {
	let inner = Object.values(essaysInGit).map((text) => caseBox(text, key)).find(Boolean)?.inner ?? '';
	let topics: string[] = [];
	const topicPart = /^:::[ \t]*topics[ \t]*\n([\s\S]*?)^:::[ \t]*$/m.exec(inner);
	if (topicPart) {
		topics = topicsIn(topicPart[1]);
		inner = inner.replace(topicPart[0], '');
	}
	let markdown = '';
	const counts: Record<string, number> = {};
	for (const [kind, heading] of boxParts) {
		const part = new RegExp(`^:::[ \\t]*${kind}[ \\t]*\\n([\\s\\S]*?)^:::[ \\t]*$`, 'm').exec(inner);
		if (!part) continue;
		if (kind === 'quotes') counts.quotes = (part[1].match(/^>/gm) ?? []).length;
		if (kind === 'treatment') counts.treatment = part[1].split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
		markdown += `## ${heading}\n\n${part[0]}\n\n`;
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
function caseOpinions(record: SourceRecord & CaseRecordParts): CaseOpinion[] {
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
				page: opinion.page,
				link: copy && Number.isInteger(first) && opinion.page >= first ? `${copyPagePath(copy)}#page=${opinion.page - first + 1}` : undefined,
				note: opinion.note
			}));
	}
	return (record.supreme_court?.justices ?? [])
		.filter((justice) => justice.opinion)
		.map((justice) => ({ title: opinionTitle(justice.opinion!), justice: surname(justice.name) }));
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

function essaysCiting(key: string, title: string): CaseMention[] {
	const found: CaseMention[] = [];
	const mention = new RegExp(`\\[@${escapeRegExp(key)}[\\],]|\\*${escapeRegExp(title)}\\*`);
	for (const [identifier, text] of Object.entries(essaysInGit)) {
		const path = essayPath(identifier, partOf(identifier, splitFrontMatter(text).frontMatter));
		const box = caseBox(text, key);
		if (box) {
			found.push({ title: titleOf(text), link: `${path}#case-${key}`, where: headingBefore(text, box.at) });
			continue;
		}
		const at = text.search(mention);
		if (at >= 0) found.push({ title: titleOf(text), link: path, where: headingBefore(text, at) });
	}
	return found.sort((one, other) => one.title.localeCompare(other.title));
}

function citationLine(record: SourceRecord): string {
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
	const box = boxSections(key, name);
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
		sources: box.sources
	};
}
