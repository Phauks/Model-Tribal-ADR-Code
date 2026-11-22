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
import { escapeHtml, savedCopyLink } from './markdown.ts';
import { glossary, repositoryRoot, sources, type SourceRecord } from './content.ts';
import { sectionWithSymbol } from './citations.ts';

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
 * The full citation of every source record, in the same form as
 * fullCitations() in citations.ts: each as the first citation of its source.
 * One citation processor serves them all, which takes seconds instead of the
 * half a minute that a processor per source takes for five thousand records.
 */
export function everyFullCitation(records: SourceRecord[] = [...sources().values()]): Record<string, string> {
	const styleFolder = path.join(repositoryRoot, 'pdf', 'styles');
	const style = readFileSync(path.join(styleFolder, 'project-law-review.csl'), 'utf8');
	const locale = readFileSync(path.join(styleFolder, 'locales-en-US.xml'), 'utf8');
	const items = new Map(
		records.map((record) => {
			const citation = record.citation as Record<string, unknown>;
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
	const citations: Record<string, string> = {};
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
		let html = linkAddresses(
			text.replaceAll('<span style="font-variant:small-caps;">', '<span class="small-capitals">')
		);
		const link = record.original_link ?? record.citation.URL;
		if (!html.includes('<a ') && link && URL.canParse(link)) {
			const address = new URL(link);
			html = `${html} <a href="${escapeHtml(address.href)}">${escapeHtml(address.hostname)}</a>`;
		}
		citations[record.key] = html + savedCopyLink(record);
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

/** The essays in content/essays/ as git holds them, by file name without ".md". */
export function essaysInGit(): Record<string, string> {
	const folder = path.join(repositoryRoot, 'content', 'essays');
	if (!existsSync(folder)) return {};
	return Object.fromEntries(
		readdirSync(folder)
			.filter((name) => name.endsWith('.md') && name !== 'README.md')
			.sort()
			.map((name) => [name.replace(/\.md$/, ''), readFileSync(path.join(folder, name), 'utf8').normalize('NFC')])
	);
}
