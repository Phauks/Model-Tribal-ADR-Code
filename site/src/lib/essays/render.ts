/**
 * Renders an essay's Markdown as the website shows it: citations become
 * Wikipedia-style numbered markers with one Sources list at the end
 * (src/lib/citation-marks.ts, the same HTML the rest of the site writes, so
 * the citation popups work here too), glossary links become links to the
 * glossary, and the essay blocks become boxes: a case or a law with its full
 * citation and its labeled parts, a quotation with its attribution, and
 * analysis set apart from what the sources say (src/lib/essays/syntax.ts).
 *
 * Runs in the Worker, which renders essay pages from the private bucket, so
 * it reads nothing from disk: the citations and glossary terms come in as
 * `library`, bundled when the site is built (vite.config.ts,
 * "virtual:essay-library").
 */
import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { markAnchor, marksHtml, type CitationMark } from '../citation-marks.ts';
import type { SourceEntry } from '../server/source-uses.ts';
import { boxParts, essayBlocks, essayMarkdown, frontMatterField, isAttribution, missingEllipses, splitFrontMatter, type CitationReference } from './syntax.ts';

export interface EssayLibrary {
	/** The full citation of a source, as HTML in the project's Indigo Book style. */
	citation(key: string): string | undefined;
	/** A glossary entry's term, if the entry is published. */
	term(id: string): string | undefined;
}

/** One heading in the essay, for the page's outline. */
export interface EssayHeading {
	label: string;
	link: string;
	children?: EssayHeading[];
}

export interface RenderedEssay {
	title: string;
	html: string;
	headings: EssayHeading[];
	sources: SourceEntry[];
	/** Citations and glossary links that point to nothing, which publishing refuses. */
	problems: string[];
	/** Things a writer should check, such as a quotation that may leave out words without an ellipsis. Publishing still goes ahead. */
	warnings: string[];
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** A heading's id: its words in lower case, joined by hyphens, made unique on the page. */
export function headingSlug(text: string, used: Set<string>): string {
	const base =
		text
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80) || 'section';
	let slug = base;
	for (let count = 2; used.has(slug); count += 1) slug = `${base}-${count}`;
	used.add(slug);
	return slug;
}

/** The sources an essay cites, numbered in the order it first cites them. */
class EssaySources {
	readonly #entries = new Map<string, SourceEntry>();
	readonly problems: string[] = [];

	constructor(private readonly library: EssayLibrary) {}

	cite(reference: CitationReference): CitationMark {
		let entry = this.#entries.get(reference.key);
		if (!entry) {
			const citation = this.library.citation(reference.key);
			if (!citation) this.problems.push(`No source record has the key "${reference.key}".`);
			entry = {
				number: this.#entries.size + 1,
				key: reference.key,
				html: citation ?? escapeHtml(reference.key),
				backlinks: [],
				groups: []
			};
			this.#entries.set(reference.key, entry);
		}
		const mark: CitationMark = {
			number: entry.number,
			anchor: markAnchor(entry.number, entry.backlinks.length + 1),
			where: reference.locator
		};
		entry.backlinks.push(mark.anchor);
		return mark;
	}

	get list(): SourceEntry[] {
		return [...this.#entries.values()];
	}
}

interface RenderState {
	sources: EssaySources;
	library: EssayLibrary;
	problems: string[];
	slugs: Set<string>;
}

const label = (text: string) => `<p class="essay-block-label">${text}</p>\n`;

/**
 * Marks the attribution of each quotation (isAttribution in syntax.ts): in a
 * quote block, its last paragraph; after a ">" quotation, the paragraph that
 * follows it.
 */
function markAttributions(tokens: Token[]): void {
	const attributionAt = (index: number) =>
		tokens[index]?.type === 'paragraph_open' && isAttribution(tokens[index + 1]?.content ?? '');
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.type === 'blockquote_close' && attributionAt(index + 1)) {
			tokens[index + 1].attrJoin('class', 'essay-attribution');
		}
		if (token.type === 'container_quote_close') {
			// The paragraph that ends just before the closing fence.
			if (tokens[index - 1]?.type !== 'paragraph_close') continue;
			let open = index - 1;
			while (open > 0 && !(tokens[open].type === 'paragraph_open' && tokens[open].level === token.level + 1)) open -= 1;
			if (open > 0 && attributionAt(open)) tokens[open].attrJoin('class', 'essay-attribution');
		}
	}
}

function configure(markdown: MarkdownIt, state: RenderState): MarkdownIt {
	const rules = markdown.renderer.rules;

	rules.citation = (tokens, index) => {
		const references = tokens[index].meta.references as CitationReference[];
		return marksHtml(references.map((reference) => state.sources.cite(reference)));
	};

	rules.term_link = (tokens, index) => {
		const { id, text } = tokens[index].meta as { id: string; text: string | null };
		const term = state.library.term(id);
		if (!term) {
			state.problems.push(`No published glossary entry has the id "${id}".`);
			return escapeHtml(text ?? id);
		}
		return `<a class="term-link" href="/glossary/${escapeHtml(id)}">${escapeHtml(text ?? term)}</a>`;
	};

	const defaultHeadingOpen = rules.heading_open ?? ((tokens, index, options, _environment, self) => self.renderToken(tokens, index, options));
	rules.heading_open = (tokens, index, options, environment, self) => {
		const token = tokens[index];
		const text = tokens[index + 1]?.children?.filter((child) => child.type === 'text' || child.type === 'code_inline').map((child) => child.content).join('') ?? '';
		token.attrSet('id', headingSlug(text, state.slugs));
		return defaultHeadingOpen(tokens, index, options, environment, self);
	};

	rules.table_open = () => '<div class="table-scroll essay-table" tabindex="0"><table>\n';
	rules.table_close = () => '</table></div>\n';

	// A case or law box, headed by its source's full citation. Its anchor
	// ("#case-<key>", "#law-<key>") is what links from other pages, such as
	// cases by topic, point to.
	for (const box of ['case', 'law'] as const) {
		rules[`container_${box}_open`] = (tokens, index) => {
			const key = essayBlocks[box].exec(tokens[index].info.trim())?.[1] ?? '';
			const mark = state.sources.cite({ key });
			const citation = state.library.citation(key) ?? escapeHtml(key);
			const anchor = `${box}-${key}`;
			const id = state.slugs.has(anchor) ? '' : ` id="${escapeHtml(anchor)}"`;
			state.slugs.add(anchor);
			const classes = box === 'law' ? 'essay-case essay-law' : 'essay-case';
			return `<section class="${classes}"${id}>\n${label(box === 'law' ? 'Law' : 'Case')}<p class="essay-case-citation">${citation}${marksHtml([mark])}</p>\n`;
		};
		rules[`container_${box}_close`] = () => '</section>\n';
	}
	for (const [kind, text] of Object.entries(boxParts)) {
		rules[`container_${kind}_open`] = () => `<div class="essay-case-part essay-case-${kind}">\n${label(text)}`;
		rules[`container_${kind}_close`] = () => '</div>\n';
	}
	rules.container_quote_open = () => '<figure class="essay-quote">\n';
	rules.container_quote_close = () => '</figure>\n';
	rules.container_analysis_open = (tokens, index) => {
		const title = essayBlocks.analysis.exec(tokens[index].info.trim())?.[1]?.trim();
		return `<aside class="essay-analysis">\n${label(title ? `Analysis: ${escapeHtml(title)}` : 'Analysis')}`;
	};
	rules.container_analysis_close = () => '</aside>\n';
	return markdown;
}

/**
 * Quotations that may leave out words without saying so (missingEllipses in
 * syntax.ts): each ">" passage and each quotation box, without its
 * attribution.
 */
function quotationWarnings(tokens: Token[]): string[] {
	const warnings: string[] = [];
	const check = (paragraphs: string[]) => {
		if (paragraphs.length === 0) return;
		const first = paragraphs[0];
		const last = paragraphs.at(-1)!;
		const shown = (text: string) => `“${text.length > 50 ? `${text.slice(0, 50)}…` : text}”`;
		if (missingEllipses(first).start) warnings.push(`The quotation ${shown(first)} starts mid-sentence; begin it with "... ".`);
		if (missingEllipses(last).end) warnings.push(`The quotation ending ${shown(last.slice(-50))} stops mid-sentence; end it with " ...".`);
	};
	for (let index = 0; index < tokens.length; index += 1) {
		const opening = tokens[index].type;
		if (opening !== 'blockquote_open' && opening !== 'container_quote_open') continue;
		const closing = opening === 'blockquote_open' ? 'blockquote_close' : 'container_quote_close';
		const level = tokens[index].level;
		const paragraphs: string[] = [];
		let end = index + 1;
		for (; end < tokens.length && !(tokens[end].type === closing && tokens[end].level === level); end += 1) {
			const token = tokens[end];
			if (token.type === 'paragraph_open' && token.level === level + 1 && !token.attrGet('class')?.includes('essay-attribution')) {
				paragraphs.push(tokens[end + 1]?.content ?? '');
			}
		}
		check(paragraphs);
		index = end;
	}
	return warnings;
}

/** The essay's h2 and h3 headings as a two-level outline. */
function headingsOf(tokens: Token[]): EssayHeading[] {
	const outline: EssayHeading[] = [];
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.type !== 'heading_open' || token.level !== 0) continue;
		const depth = Number(token.tag.slice(1));
		if (depth < 2 || depth > 3) continue;
		const text = tokens[index + 1]?.children?.filter((child) => child.type === 'text' || child.type === 'code_inline').map((child) => child.content).join('') ?? '';
		const heading = { label: text, link: `#${token.attrGet('id')}` };
		if (depth === 2 || outline.length === 0) outline.push(heading);
		else (outline.at(-1)!.children ??= []).push(heading);
	}
	return outline;
}

/** An essay file (front matter and Markdown) as HTML, with its outline and Sources list. */
export function renderEssay(text: string, library: EssayLibrary): RenderedEssay {
	const { frontMatter, body } = splitFrontMatter(text.normalize('NFC'));
	const sources = new EssaySources(library);
	const state: RenderState = { sources, library, problems: [], slugs: new Set(['sources-heading']) };
	const markdown = configure(essayMarkdown(), state);
	const environment = {};
	let tokens = markdown.parse(body, environment);
	// The essay's own "# Title" is shown as the page's heading, not again in the text.
	let title = frontMatterField(frontMatter, 'title') ?? '';
	if (tokens[0]?.type === 'heading_open' && tokens[0].tag === 'h1') {
		title ||= tokens[1]?.content ?? '';
		tokens = tokens.slice(3);
	}
	markAttributions(tokens);
	const html = markdown.renderer.render(tokens, markdown.options, environment);
	return {
		title: title || 'Untitled',
		html,
		headings: headingsOf(tokens),
		sources: sources.list,
		problems: [...new Set([...state.problems, ...sources.problems])],
		warnings: quotationWarnings(tokens)
	};
}
