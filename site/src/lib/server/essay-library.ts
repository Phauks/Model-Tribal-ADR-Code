/**
 * What the Worker needs to render essays from the private bucket, gathered
 * when the site is built (vite.config.ts, "virtual:essay-library"): the full
 * citation of every source record, the published glossary terms, and the
 * essays in content/essays/ as git holds them, which the workspace can bring
 * into the bucket as a new version (docs/editing.md).
 *
 * Runs only at build time, in Node.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import CSL from 'citeproc';
import { escapeHtml } from '../escape-html.ts';
import { savedCopyLink } from './markdown.ts';
import { readingLinksHtml } from '../reading-links.ts';
import type { OpinionEntry } from '../case-opinions.ts';
import type { RecordBox } from '../essays/record-boxes.ts';
import { glossary, nationNameVariants, nationNamesAndKinds, repositoryRoot, sources, type SourceRecord } from './content.ts';
import { sectionWithSymbol } from './citations.ts';
import { caseItem } from './case-citations.ts';
import { caseFacts, lawFacts, type CaseRecord, type FactLine } from './case-facts.ts';

/** Turns the plain web addresses citeproc-js prints into links (as citations.ts does). */
function linkAddresses(html: string): string {
	return html.replace(/https?:\/\/[^\s<"]+/g, (address) => {
		const trailing = /[.,;)]+$/.exec(address)?.[0] ?? '';
		const bare = trailing ? address.slice(0, -trailing.length) : address;
		const target = bare.replaceAll('&#38;', '&');
		if (!URL.canParse(target)) return address;
		return `<a href="${escapeHtml(target)}">${bare}</a>${trailing}`;
	});
}

/**
 * The citation of each source record as citeproc-js prints it in the project's
 * Indigo Book style, the first time a work cites it, as HTML: the citation
 * alone, without the links to the source and to where to read it that
 * everyFullCitation() adds. One citation processor serves them all, which
 * takes seconds instead of the half a minute that a processor per source
 * takes for five thousand records. A record the style cannot cite is left out.
 */
export function citationTexts(records: SourceRecord[] = [...sources().values()]): Map<string, string> {
	const styleFolder = path.join(repositoryRoot, 'pdf', 'styles');
	const style = readFileSync(path.join(styleFolder, 'project-law-review.csl'), 'utf8');
	const locale = readFileSync(path.join(styleFolder, 'locales-en-US.xml'), 'utf8');
	const items = new Map(
		records.map((record) => {
			const citation = caseItem(record.citation as Record<string, unknown>);
			const section = citation.section;
			return [
				record.key,
				{ ...citation, id: record.key, ...(typeof section === 'string' ? { section: sectionWithSymbol(section) } : {}) }
			];
		})
	);
	const engine = new CSL.Engine(
		{ retrieveLocale: () => locale, retrieveItem: (id: string) => items.get(id) },
		style,
		'en-US'
	);
	engine.setOutputFormat('html');
	const texts = new Map<string, string>();
	for (const record of records) {
		let text: string | undefined;
		try {
			const [, updates] = engine.processCitationCluster(
				{ citationItems: [{ id: record.key }], properties: { noteIndex: 1 } },
				[],
				[]
			);
			text = updates[0]?.[1];
		} catch {
			text = undefined;
		}
		if (!text || /CSL STYLE ERROR/.test(text)) continue;
		texts.set(record.key, text.replaceAll('<span style="font-variant:small-caps;">', '<span class="small-capitals">'));
	}
	return texts;
}

/**
 * The full citation of every source record, in the same form as
 * fullCitations() in citations.ts: each as the first citation of its source,
 * with a link to the source and the list of where to read it.
 */
export function everyFullCitation(records: SourceRecord[] = [...sources().values()]): Record<string, string> {
	const texts = citationTexts(records);
	const citations: Record<string, string> = {};
	for (const record of records) {
		const text = texts.get(record.key);
		if (!text) continue;
		let html = linkAddresses(text);
		const link = record.original_link ?? record.citation.URL;
		if (!html.includes('<a ') && link && URL.canParse(link)) {
			const address = new URL(link);
			html = `${html} <a href="${escapeHtml(address.href)}">${escapeHtml(address.hostname)}</a>`;
		}
		citations[record.key] = html + readingLinksHtml(record.reading_links, savedCopyLink(record));
	}
	return citations;
}

/**
 * Glossary terms by id, for every entry that has a page: retired entries
 * and redirects are left out, as on the glossary pages
 * (glossary-entries.ts, publishedGlossary).
 */
export function glossaryTerms(): Record<string, string> {
	return Object.fromEntries(
		glossary()
			.filter((entry) => entry.status !== 'retired' && !entry.redirect_to)
			.map((entry) => [entry.id, entry.term])
	);
}

/**
 * The essays in content/essays/, the back matter pages in
 * content/back-matter/ (such as the index of cases by topic) and the pages
 * about the site in content/about/ (such as the About page), as git holds
 * them, by file name without ".md".
 */
export function essaysInGit(): Record<string, string> {
	const files: [string, string][] = [];
	for (const folderName of ['essays', 'back-matter', 'about']) {
		const folder = path.join(repositoryRoot, 'content', folderName);
		if (!existsSync(folder)) continue;
		for (const name of readdirSync(folder).filter((name) => name.endsWith('.md') && name !== 'README.md')) {
			files.push([name.replace(/\.md$/, ''), readFileSync(path.join(folder, name), 'utf8').normalize('NFC')]);
		}
	}
	return Object.fromEntries(files.sort(([first], [second]) => first.localeCompare(second)));
}

/**
 * Each court case's name and decision date, by source key, for the index
 * of cases by topic (src/lib/essays/case-topics.ts).
 */
export function caseNames(records: SourceRecord[] = [...sources().values()]): Record<string, { title: string; date: number[] }> {
	const names: Record<string, { title: string; date: number[] }> = {};
	for (const record of records) {
		const citation = record.citation as { type?: string; title?: string; issued?: { 'date-parts'?: number[][] } };
		if (citation.type !== 'legal_case' || !citation.title) continue;
		names[record.key] = { title: citation.title, date: citation.issued?.['date-parts']?.[0] ?? [] };
	}
	return names;
}

/**
 * Words the spelling check should know although a general dictionary does
 * not (src/lib/essays/checks.ts): every word with a capital letter or a
 * letter outside A to Z in the names of nations, glossary terms and court
 * cases, such as "Mashantucket" or "Diné".
 */
export function spellingWords(records: SourceRecord[] = [...sources().values()]): string[] {
	const names = [...nationNameVariants(), ...Object.values(glossaryTerms()), ...Object.values(caseNames(records)).map((name) => name.title)];
	const words = new Set<string>();
	for (const name of names) {
		for (const word of name.normalize('NFC').split(/[^\p{L}\p{M}'’]+/u)) {
			const trimmed = word.replace(/^['’]+|['’]+$/g, '').replace(/['’]s$/, '');
			if (trimmed.length > 1 && /[\p{Lu}]|[^\p{ASCII}]/u.test(trimmed)) words.add(trimmed);
		}
	}
	return [...words].sort((first, second) => first.localeCompare(second, 'en-US'));
}

/** Source types a law box can name: statutes, codes, regulations, treaties and bills. */
const lawTypes = new Set(['legislation', 'treaty', 'bill', 'regulation']);

/**
 * The lines under each case or law box's heading (case-facts.ts), for every
 * source record that has any: cases by key, and laws by key.
 */
export function everyBoxFact(records: SourceRecord[] = [...sources().values()]): {
	cases: Record<string, FactLine[]>;
	laws: Record<string, FactLine[]>;
} {
	const nations = nationNamesAndKinds();
	const cases: Record<string, FactLine[]> = {};
	const laws: Record<string, FactLine[]> = {};
	for (const record of records) {
		const type = (record.citation as { type?: string }).type ?? '';
		if (type === 'legal_case') {
			const facts = caseFacts(record as CaseRecord, nations);
			if (facts.length) cases[record.key] = facts;
		} else if (lawTypes.has(type)) {
			const facts = lawFacts(record as CaseRecord, nations);
			if (facts.length) laws[record.key] = facts;
		}
	}
	return { cases, laws };
}

/**
 * Each court case's opinions and the report page each starts on, by source
 * key, for the label a quotation from the case gets (case-opinions.ts).
 */
export function everyOpinionList(records: SourceRecord[] = [...sources().values()]): Record<string, OpinionEntry[]> {
	const lists: Record<string, OpinionEntry[]> = {};
	for (const record of records) {
		const list = (record as { opinions?: { list: OpinionEntry[] } }).opinions?.list;
		if (list?.length) lists[record.key] = list;
	}
	return lists;
}

/**
 * The parts of each case and law box its source's record keeps (`case_box`,
 * `law_box`), by key, which fill the boxes an essay leaves empty
 * (src/lib/essays/record-boxes.ts).
 */
export function everyRecordBox(records: SourceRecord[] = [...sources().values()]): { cases: Record<string, RecordBox>; laws: Record<string, RecordBox> } {
	const cases: Record<string, RecordBox> = {};
	const laws: Record<string, RecordBox> = {};
	for (const record of records) {
		if (record.case_box) cases[record.key] = record.case_box;
		if (record.law_box) laws[record.key] = record.law_box;
	}
	return { cases, laws };
}
