/**
 * MOCKUP (thread "Give every case its own page", Nov. 24, 2026): one page
 * for each court case, at /cases/<key>, built from the case's source record
 * and its box in an essay. Not for merging as it stands.
 */
import { error } from '@sveltejs/kit';
import { essayBoxFacts, essaysInGit } from 'virtual:essay-library';
import { renderEssay } from '../essays/render.ts';
import { splitFrontMatter, topicsIn } from '../essays/syntax.ts';
import { essayLibrary } from './essay-pages.ts';
import { essayPath, partOf, titleOf } from './essays.ts';
import { nationNamesAndKinds, publicCopyFor, sources } from './content.ts';
import { courtPath } from './supreme-courts.ts';
import { formatCaptureDate } from './markdown.ts';
import { displayName } from '../nation-labels.ts';
import { officialReportLinks, type ReadingLink } from '../reading-links.ts';
import { copyPagePath, copyPath, mediaLabel } from '../public-copies.ts';
import { fileName, verifyLink } from '../checksums.ts';
import type { SourceEntry } from './source-uses.ts';

export interface CaseMention {
	title: string;
	link: string;
	where: string;
}

export interface CasePage {
	key: string;
	name: string;
	citation: string;
	caption?: string;
	facts: [string, string][];
	topics: string[];
	bodyHtml: string;
	quoteCount: number;
	treatmentCount: number;
	nations: { id: string; name: string; role: string; namedAs?: string }[];
	nationNote?: string;
	savedCopy?: { page: string; what: string; verify: string };
	readingGroups: { label: string; links: ReadingLink[] }[];
	readingCount: number;
	essays: CaseMention[];
	nationPages: { name: string; link: string }[];
	court?: { name: string; link: string };
	sources: SourceEntry[];
}

const roles: Record<string, string> = { party: 'Party', government: 'Party through its officials or agency', subject: 'Not a party' };

function caseBox(text: string, key: string): { inner: string; at: number } | undefined {
	const match = new RegExp(`^:{4,}[ \\t]*case[ \\t]+${key}[ \\t]*\\n([\\s\\S]*?)^:{4,}[ \\t]*$`, 'm').exec(text);
	return match ? { inner: match[1], at: match.index } : undefined;
}

function headingBefore(text: string, at: number): string | undefined {
	const headings = [...text.slice(0, at).matchAll(/^#{2,3}\s+(.+)$/gm)];
	return headings.at(-1)?.[1]?.trim();
}

export function casePage(key: string): CasePage {
	const record = sources().get(key);
	const citation = record?.citation as (NonNullable<typeof record>['citation'] & { type?: string }) | undefined;
	if (!record || !citation || citation.type !== 'legal_case' || !citation.title) error(404, 'No case has this address.');

	// The case's box: the first essay that has one.
	let inner = '';
	let topics: string[] = [];
	for (const text of Object.values(essaysInGit)) {
		const box = caseBox(text, key);
		if (!box) continue;
		inner = box.inner;
		break;
	}
	const topicPart = /^:::[ \t]*topics[ \t]*\n([\s\S]*?)^:::[ \t]*$/m.exec(inner);
	if (topicPart) {
		topics = topicsIn(topicPart[1]);
		inner = inner.replace(topicPart[0], '');
	}
	const parts: [string, string][] = [
		['background', 'Background'],
		['question', 'Question'],
		['holding', 'Holding'],
		['quotes', 'Quotes'],
		['treatment', 'Treatment']
	];
	let markdown = '';
	let quoteCount = 0;
	let treatmentCount = 0;
	for (const [kind, heading] of parts) {
		const part = new RegExp(`^:::[ \\t]*${kind}[ \\t]*\\n([\\s\\S]*?)^:::[ \\t]*$`, 'm').exec(inner);
		if (!part) continue;
		if (kind === 'quotes') quoteCount = (part[1].match(/^>/gm) ?? []).length;
		if (kind === 'treatment') treatmentCount = part[1].split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
		markdown += `## ${heading}\n\n${part[0]}\n\n`;
	}
	const rendered = renderEssay(`# ${citation.title}\n\n${markdown}`, essayLibrary);
	const badge = (count: number) => ` <span class="count-badge"><span class="visually-hidden">, </span>${count}</span>`;
	const bodyHtml = rendered.html
		.replace(/<h1[^>]*>[\s\S]*?<\/h1>\n?/, '')
		.replace(/(<h2 id="quotes">Quotes)(<\/h2>)/, `$1${badge(quoteCount)}$2`)
		.replace(/(<h2 id="treatment">Treatment)(<\/h2>)/, `$1${badge(treatmentCount)}$2`);

	// Nations named in the case.
	const nationNames = nationNamesAndKinds();
	const named = (record as { nations_in_case?: { named: { nation: string; named_as: string; role: string; note?: string }[] } }).nations_in_case?.named ?? [];
	const nations = (record.tribes ?? []).map((id) => {
		const entry = named.find((item) => item.nation === id);
		const name = nationNames.get(id) ? displayName(nationNames.get(id)!.name) : id;
		const namedAs = entry?.named_as.replace(/^the\s+/i, '');
		return { id, name, role: roles[entry?.role ?? 'subject'], namedAs: namedAs && namedAs !== name ? namedAs : undefined };
	});
	const notes = [...new Set(named.map((item) => item.note).filter(Boolean))];

	// Where to read it.
	const links = record.reading_links?.links ?? [];
	const copy = [...officialReportLinks(record.reading_links), record.original_link, citation.URL].map(publicCopyFor).find(Boolean);
	const savedCopy = copy
		? {
				page: copyPagePath(copy),
				what: [officialReportLinks(record.reading_links).some((link) => publicCopyFor(link) === copy) ? 'official report' : '', mediaLabel(copy.mediaType), copy.captured ? formatCaptureDate(copy.captured) : '']
					.filter(Boolean)
					.join(', '),
				verify: verifyLink(copy.sha256, fileName(copyPath(copy)))
			}
		: undefined;
	const readingGroups = [
		{ label: 'Free', links: links.filter((link) => link.access === 'official' || link.access === 'free') },
		{ label: 'Subscription', links: links.filter((link) => link.access === 'subscription') },
		{ label: 'Further reading', links: links.filter((link) => link.access === 'background') }
	].filter((group) => group.links.length > 0);

	// Where the site cites it.
	const essays: CaseMention[] = [];
	for (const [identifier, text] of Object.entries(essaysInGit)) {
		const { frontMatter } = splitFrontMatter(text);
		const path = essayPath(identifier, partOf(identifier, frontMatter));
		const box = caseBox(text, key);
		if (box) {
			essays.push({ title: titleOf(text), link: `${path}#case-${key}`, where: headingBefore(text, box.at) ?? '' });
			continue;
		}
		const at = text.search(new RegExp(`\\[@${key}[\\],]|\\*${citation.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*`));
		if (at >= 0) essays.push({ title: titleOf(text), link: path, where: headingBefore(text, at) ?? '' });
	}
	const bench = (record as { supreme_court?: { court: string } }).supreme_court;
	const courtLink = bench ? courtPath(bench.court) : undefined;

	const reporter = [citation.volume, citation['container-title'], citation.page].filter(Boolean).join(' ');
	const year = citation.issued?.['date-parts']?.[0]?.[0];
	const facts = (essayBoxFacts.cases[key] ?? []).filter(([label]) => !/^(Nations?|Peoples?|Nations and peoples)$/.test(label));
	return {
		key,
		name: citation.title,
		citation: [reporter, year ? `(${year})` : ''].filter(Boolean).join(' '),
		caption: (record as { caption?: { printed: string } }).caption?.printed,
		facts,
		topics,
		bodyHtml,
		quoteCount,
		treatmentCount,
		nations,
		nationNote: notes.length === 1 ? notes[0] : undefined,
		savedCopy,
		readingGroups,
		readingCount: links.length + (savedCopy ? 1 : 0),
		essays,
		nationPages: nations.map((nation) => ({ name: nation.name, link: `/nations/${nation.id}` })),
		court: bench && courtLink ? { name: bench.court, link: courtLink } : undefined,
		sources: rendered.sources
	};
}
