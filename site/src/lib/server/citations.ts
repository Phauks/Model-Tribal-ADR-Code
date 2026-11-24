/**
 * Formats source records as full citations in the project's citation style,
 * the Indigo Book rules carried by pdf/styles/project-law-review.csl
 * (docs/citation-style.md). The print build uses the same style file and the
 * same processor, citeproc-js (pdf/pipeline/citations.mjs), so a source reads
 * the same on the website and in the book.
 *
 * Only vite.config.ts imports this module, while the site is built: the
 * finished citations reach the pages as the small module
 * "virtual:source-citations", so citeproc-js never ships in the Worker.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import CSL from 'citeproc';
import { escapeHtml } from '../escape-html.ts';
import { savedCopyLink } from './markdown.ts';
import { readingLinksHtml } from '../reading-links.ts';
import { repositoryRoot, type SourceRecord } from './content.ts';
import { caseItem } from './case-citations.ts';

const styleFolder = path.join(repositoryRoot, 'pdf', 'styles');

/**
 * A code section is recorded as its number, "5130", or numbers, "471, 473";
 * the style prints it as given, so the "§" or "§§" is added here (Indigo Book
 * R16.1). The same rule as normalizeSection in pdf/pipeline/citations.mjs.
 */
export function sectionWithSymbol(section: string): string {
	const [, symbol = '', numbers = ''] = /^(§§?)?\s*(.*)$/s.exec(section.trim()) ?? [];
	const several = symbol === '§§' || /,|–|—|&|\band\b/.test(numbers);
	if (!several) return `§ ${numbers}`;
	return `§§ ${symbol === '§§' ? numbers.replace(/(\w)-(\w)/g, '$1–$2') : numbers}`;
}

/** Turns the plain web addresses citeproc-js prints into links. */
function linkAddresses(html: string): string {
	return html.replace(/https?:\/\/[^\s<"]+/g, (address) => {
		const trailing = /[.,;)]+$/.exec(address)?.[0] ?? '';
		const bare = trailing ? address.slice(0, -trailing.length) : address;
		const target = bare.replaceAll('&#38;', '&');
		if (!URL.canParse(target)) return address;
		return `<a href="${escapeHtml(target)}">${bare}</a>${trailing}`;
	});
}

/** Uses a class for small capitals instead of the inline style citeproc-js writes. */
function smallCapitalsAsClass(html: string): string {
	return html.replaceAll(
		'<span style="font-variant:small-caps;">',
		'<span class="small-capitals">'
	);
}

/**
 * The full citation of each source, as HTML, keyed by the source's key. Each
 * source is cited on its own, as the first citation in a note, which is the
 * form the Indigo Book gives a source the first time a work cites it.
 */
export function fullCitations(records: SourceRecord[]): Record<string, string> {
	const style = readFileSync(path.join(styleFolder, 'project-law-review.csl'), 'utf8');
	const locale = readFileSync(path.join(styleFolder, 'locales-en-US.xml'), 'utf8');
	const items = new Map(
		records.map((record) => {
			const citation = caseItem(record.citation as Record<string, unknown>);
			const section = citation.section;
			return [
				record.key,
				{
					...citation,
					id: record.key,
					...(typeof section === 'string' ? { section: sectionWithSymbol(section) } : {})
				}
			];
		})
	);

	const citations: Record<string, string> = {};
	for (const record of records) {
		const engine = new CSL.Engine(
			{
				retrieveLocale: () => locale,
				retrieveItem: (id: string) => items.get(id)
			},
			style,
			'en-US'
		);
		engine.setOutputFormat('html');
		const [status, updates] = engine.processCitationCluster(
			{ citationItems: [{ id: record.key }], properties: { noteIndex: 1 } },
			[],
			[]
		);
		const text = updates[0]?.[1];
		if (status.citation_errors?.length || !text || /CSL STYLE ERROR/.test(text)) {
			throw new Error(`Source ${record.key} has no printed citation: ${JSON.stringify(status)}`);
		}
		let html = linkAddresses(smallCapitalsAsClass(text));
		const link = record.original_link ?? record.citation.URL;
		if (!html.includes('<a ') && link && URL.canParse(link)) {
			// Statutes print without an address in the Indigo Book; the website still links the text.
			const address = new URL(link);
			html = `${html} <a href="${escapeHtml(address.href)}">${escapeHtml(address.hostname)}</a>`;
		}
		citations[record.key] = html + readingLinksHtml(record.reading_links, savedCopyLink(record));
	}
	return citations;
}
