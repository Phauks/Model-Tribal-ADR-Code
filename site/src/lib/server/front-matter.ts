/**
 * Front matter pages (content/front-matter/), such as the acknowledgments, as
 * the website shows them. The book prints the same files (pdf/pipeline).
 *
 * Citations follow the glossary pages: a numbered marker in the text, and the
 * citation in one Sources section at the end of the page, followed by the
 * sentence on the page that the source supports.
 */
import { sourceCitations } from 'virtual:source-citations';
import { readFrontMatterPage, sources } from './content.ts';
import type { CitationMark } from '../citation-marks.ts';
import { formatSource, plainText, renderMarkdown, type CitationCollector } from './markdown.ts';
import type { CitationMark } from '../citation-marks.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';

const citationPattern = /\[@[a-z0-9-]+[^\]]*\]/g;

function citationOf(key: string): string {
	return sourceCitations[key] ?? formatSource(sources().get(key), key);
}

/**
 * Each source cited, under the heading and sentence that cite it. The
 * sentences are found in the order renderMarkdown resolves citations: one
 * entry per key, in the order the keys appear in the text.
 */
function citedSentences(body: string): { section: string; text: string }[] {
	const uses: { section: string; text: string }[] = [];
	let section = '';
	for (const block of body.split(/\n{2,}/)) {
		const heading = /^#{2,6}\s+(.+)$/.exec(block.trim());
		if (heading) {
			section = heading[1].trim();
			continue;
		}
		let start = 0;
		for (const match of block.matchAll(citationPattern)) {
			// The sentence the marker closes: the last one before it.
			const sentence = plainText(block.slice(start, match.index)).split(/(?<=[.!?])\s+(?=[A-Z])/).pop() ?? '';
			const keys = match[0].match(/@[a-z0-9-]+/g) ?? [];
			for (const _key of keys) uses.push({ section, text: `“${sentence}”` });
			start = (match.index ?? 0) + match[0].length;
		}
	}
	return uses;
}

class FrontMatterCitations implements CitationCollector {
	readonly uses = new SourceUses(citationOf);
	readonly #queue: { section: string; text: string }[];

	constructor(body: string) {
		this.#queue = citedSentences(body);
	}

	cite(key: string, locator?: string): CitationMark {
		const use = this.#queue.shift() ?? { section: '', text: 'this page' };
		return this.uses.cite(key, { ...use, where: locator });
	}
}

/** A front matter page, rendered, with its Sources section. */
export function frontMatterView(id: string): { title: string; html: string; sources: SourceEntry[] } {
	const page = readFrontMatterPage(id);
	const citations = new FrontMatterCitations(page.body);
	const html = renderMarkdown(page.body, citations);
	return { title: page.title, html, sources: citations.uses.list };
}
