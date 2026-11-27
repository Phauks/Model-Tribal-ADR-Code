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
import Token from 'markdown-it/lib/token.mjs';
import type { LineChange } from './merge.ts';
import { markAnchor, marksHtml, type CitationMark } from '../citation-marks.ts';
import type { SourceEntry } from '../server/source-uses.ts';
import { chartFromRows, figureKindLabels, figureRemovalLink, figureSource, readFigureInfo, type FigureKind } from './figures.ts';
import { scaleTop } from '../bar-chart.ts';
import { imageViewerAttributeText } from '../image-viewer.ts';
import { youtubeEmbedAddress, youtubePosterAddress } from '../video-links.ts';
import { attributionSource } from '../quote-context.ts';
import { firstPage, opinionAt, quoteOpinionLabel, type OpinionEntry } from '../case-opinions.ts';
import { readingLinksAfter } from '../reading-links.ts';
import { boxParts, essayBlocks, essayMarkdown, frontMatterField, isAttribution, missingEllipses, needlessEndEllipsis, splitFrontMatter, topicsIn, type CitationReference } from './syntax.ts';
import { escapeHtml } from '../escape-html.ts';
import { fillBoxes, laterCaseKinds, type BoxKind } from './record-boxes.ts';

export interface EssayLibrary {
	/** The full citation of a source, as HTML in the project's Indigo Book style. */
	citation(key: string): string | undefined;
	/** A glossary entry's term, if the entry is published. */
	term(id: string): string | undefined;
	/**
	 * The lines under a case or law box's heading, as [label, HTML] pairs:
	 * when a case was decided, the nations it concerns, the Supreme Court's
	 * vote and opinions (src/lib/server/case-facts.ts).
	 */
	facts?(box: 'case' | 'law', key: string): [string, string][];
	/**
	 * The address of the page that holds a case or law box ("case-<key>"),
	 * for links to a box on another page, such as those in the index of
	 * cases by topic.
	 */
	boxPage?(anchor: string): string | undefined;
	/**
	 * Every court case the project has a record of, as source key to case
	 * name, so a case named in italics in the text links to it.
	 */
	caseNames?(): Record<string, string>;
	/** Where a case's name links: the case's own page (/cases/<key>). */
	caseLink?(key: string): string | undefined;
	/** A court case's opinions and the report page each starts on, so a quotation can say which opinion it comes from (case-opinions.ts). */
	opinions?(key: string): OpinionEntry[] | undefined;
	/**
	 * The parts of a case or law box as its source's record keeps them, in
	 * the essay syntax, to fill a box the essay leaves empty (record-boxes.ts).
	 */
	box?(kind: BoxKind, key: string): string | undefined;
	/** The reading its record keeps for a box the essay leaves empty, as an Analysis block to follow the box (record-boxes.ts). */
	boxReading?(kind: BoxKind, key: string): string | undefined;
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
	warnings: string[];
	slugs: Set<string>;
}

const label = (text: string) => `<p class="essay-block-label">${text}</p>\n`;

/**
 * Marks the attribution of each quotation (isAttribution in syntax.ts): in a
 * quote block, its last paragraph; after a ">" quotation, the paragraph that
 * follows it.
 */
function markAttributions(tokens: Token[], library: EssayLibrary): void {
	const attributionAt = (index: number) =>
		tokens[index]?.type === 'paragraph_open' && isAttribution(tokens[index + 1]?.content ?? '');
	// An attribution that cites one source names it, so the page can offer the
	// quotation in its paragraph (src/lib/essays/quote-context-view.ts).
	const mark = (open: Token, content: string) => {
		open.attrJoin('class', 'essay-attribution');
		const cited = attributionSource(content);
		if (!cited) return;
		open.attrSet('data-quote-source', cited.source);
		if (cited.pinpoint) open.attrSet('data-quote-pinpoint', cited.pinpoint);
		// Which opinion a quotation from a court case comes from (Trevor, Nov. 24, 2026), before its citation marker.
		const opinion = opinionAt(library.opinions?.(cited.source), firstPage(cited.pinpoint));
		const inline = tokens[tokens.indexOf(open) + 1];
		if (opinion && inline?.children) {
			const label = new Token('html_inline', '', 0);
			label.content = `<span class="essay-quote-opinion">${escapeHtml(quoteOpinionLabel(opinion))}</span>`;
			inline.children.unshift(label);
		}
	};
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.type === 'blockquote_close' && attributionAt(index + 1)) {
			mark(tokens[index + 1], tokens[index + 2]?.content ?? '');
		}
		if (token.type === 'container_quote_close') {
			// The paragraph that ends just before the closing fence.
			if (tokens[index - 1]?.type !== 'paragraph_close') continue;
			let open = index - 1;
			while (open > 0 && !(tokens[open].type === 'paragraph_open' && tokens[open].level === token.level + 1)) open -= 1;
			if (open > 0 && attributionAt(open)) mark(tokens[open], tokens[open + 1]?.content ?? '');
		}
	}
}

/**
 * The paragraph inside a case box's Topics part ("Gaming; Sovereign
 * immunity") is shown as a list of tags, which the index of cases by topic
 * is built from (case-topics.ts).
 */
function markTopics(tokens: Token[]): void {
	let inTopics = false;
	for (const token of tokens) {
		if (token.type === 'container_topics_open') inTopics = true;
		else if (token.type === 'container_topics_close') inTopics = false;
		else if (inTopics && token.type === 'paragraph_open') token.type = 'topics_open';
		else if (inTopics && token.type === 'paragraph_close') token.type = 'topics_close';
		else if (inTopics && token.type === 'inline') {
			token.meta = { topics: topicsIn(token.content) };
			token.type = 'topics_list';
			token.children = [];
		}
	}
}

/** A case name as it is compared: plain apostrophes, one space, no case or final period. */
function caseNameForm(name: string): string {
	return name.normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().replace(/\.$/, '').toLowerCase();
}

/** Party names too common to stand for one case. */
const sharedParties = new Set(['united states', 'state', 'the state', 'people', 'commonwealth']);

const caseNameLists = new WeakMap<EssayLibrary, Map<string, string>>();

/**
 * Case names to source keys: each case's full name ("Worcester v.
 * Georgia"), and the name of a party that only one case has, as an essay
 * shortens it after the first mention ("Worcester", "Crow Dog").
 */
function caseNameList(library: EssayLibrary): Map<string, string> {
	const cached = caseNameLists.get(library);
	if (cached) return cached;
	const names = new Map<string, string | null>();
	const add = (name: string, key: string) => {
		const form = caseNameForm(name);
		if (!form || sharedParties.has(form)) return;
		names.set(form, names.has(form) && names.get(form) !== key ? null : key);
	};
	const cases = Object.entries(library.caseNames?.() ?? {});
	for (const [key, title] of cases) add(title, key);
	const parties = new Map<string, string | null>();
	for (const [key, title] of cases) {
		const prefixed = /^(?:ex parte|in re)\s+(.+)$/i.exec(title)?.[1];
		for (const party of prefixed ? [prefixed] : title.split(/\s+v\.\s+/)) {
			const form = caseNameForm(party);
			parties.set(form, parties.has(form) && parties.get(form) !== key ? null : key);
		}
	}
	for (const [form, key] of parties) if (key && !names.has(form)) add(form, key);
	const list = new Map([...names].filter((entry): entry is [string, string] => entry[1] !== null));
	caseNameLists.set(library, list);
	return list;
}

/** The case a name stands for: its full name or a party's, or the start of one case's full name ("California v. Cabazon Band"). */
function caseNamed(names: Map<string, string>, form: string): string | undefined {
	const named = names.get(form);
	if (named || !form.includes(' v. ')) return named;
	const keys = new Set([...names].filter(([name]) => name.startsWith(`${form} `) || name.startsWith(`${form},`)).map(([, key]) => key));
	return keys.size === 1 ? [...keys][0] : undefined;
}

/**
 * Links a court case named in italics in the essay's own text to the case's
 * box, or, when no essay has a box for it, to the opinion (Trevor, Nov. 23,
 * 2026: link case names, with a preview on hover, LinkPreviews.svelte). Only
 * the first mention in each section links, so a paragraph is not a row of
 * links; a heading, a link already there and a case's own box are left as
 * they are.
 */
function linkCaseNames(tokens: Token[], library: EssayLibrary, boxesHere: Set<string>): void {
	const names = caseNameList(library);
	if (names.size === 0) return;
	// Every case has its own page (Trevor, Nov. 24, 2026), which caseLink gives; a box is the fallback.
	const targetOf = (key: string): string | undefined =>
		library.caseLink?.(key) ?? (boxesHere.has(key) || library.boxPage?.(`case-${key}`) ? `#case-${key}` : undefined);
	let linked = new Set<string>();
	let inHeading = false;
	let ownBox: string | undefined;
	// A list of later cases (laterCasesMarkdown) links each case only where its
	// citation matched one: a name alone can match another case of the same name.
	let laterCaseKind = false;
	let inLaterCases = false;
	for (const token of tokens) {
		if (token.type === 'inline' && token.level > 0) {
			const kind = /^\*\*(.+)\*\* \(\d+\)$/.exec(token.content)?.[1];
			laterCaseKind = Boolean(kind && laterCaseKinds.includes(kind));
		} else if (token.type === 'bullet_list_open') inLaterCases = laterCaseKind;
		else if (token.type === 'bullet_list_close') inLaterCases = laterCaseKind = false;
		if (inLaterCases) continue;
		if (token.type === 'heading_open') {
			inHeading = true;
			linked = new Set();
		} else if (token.type === 'heading_close') inHeading = false;
		else if (token.type === 'container_case_open' || token.type === 'container_law_open') {
			ownBox = essayBlocks[token.type === 'container_case_open' ? 'case' : 'law'].exec(token.info.trim())?.[1];
			linked = new Set();
		} else if (token.type === 'container_case_close' || token.type === 'container_law_close') {
			ownBox = undefined;
			linked = new Set();
		}
		if (token.type !== 'inline' || inHeading || !token.children) continue;
		const children: Token[] = [];
		let linkDepth = 0;
		for (let index = 0; index < token.children.length; index += 1) {
			const child = token.children[index];
			if (child.type === 'link_open') linkDepth += 1;
			if (child.type === 'link_close') linkDepth -= 1;
			const text = token.children[index + 1];
			const close = token.children[index + 2];
			const key =
				child.type === 'em_open' && linkDepth === 0 && text?.type === 'text' && close?.type === 'em_close'
					? caseNamed(names, caseNameForm(text.content))
					: undefined;
			const target = key && key !== ownBox && !linked.has(key) ? targetOf(key) : undefined;
			if (!key || !target) {
				children.push(child);
				continue;
			}
			linked.add(key);
			const open = new Token('link_open', 'a', 1);
			open.attrs = [['href', target], ['class', 'case-link'], ['data-case', key]];
			// The opinion itself opens in a new tab, so the essay stays open; a box or a case's page is part of the site.
			const newTab = !target.startsWith('#') && !target.startsWith('/cases/');
			if (newTab) open.attrs.push(['target', '_blank'], ['rel', 'noopener']);
			const hint = new Token('html_inline', '', 0);
			hint.content = newTab ? '<span class="visually-hidden"> (opens in a new tab)</span>' : '';
			children.push(open, child, text, close, hint, new Token('link_close', 'a', -1));
			index += 2;
		}
		token.children = children;
	}
}

/** A block token's matching close: the next token of the closing type at the same level. */
function closingIndex(tokens: Token[], open: number, type: string): number {
	for (let index = open + 1; index < tokens.length; index += 1) {
		if (tokens[index].type === type && tokens[index].level === tokens[open].level) return index;
	}
	return tokens.length - 1;
}

function htmlToken(content: string): Token {
	const token = new Token('html_block', '', 0);
	token.content = content;
	return token;
}

/** Markdown text as plain words, for an attribute: emphasis marks, link targets and citations dropped. */
function plainText(inline: Token | undefined): string {
	const parts: string[] = [];
	for (const child of inline?.children ?? []) {
		if (child.type === 'text' || child.type === 'code_inline') parts.push(child.content);
		else if (child.type === 'softbreak' || child.type === 'hardbreak') parts.push(' ');
		else if (child.type === 'term_link') parts.push(String(child.meta.text ?? child.meta.id));
	}
	return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Arranges each figure for the page: its description moves onto the
 * picture or player (as alternative text and a label), its caption and
 * credit go into a <figcaption>, and its transcript follows the figure,
 * folded, since a <figcaption> must be the figure's first or last child.
 */
function arrangeFigures(tokens: Token[]): Token[] {
	const arranged: Token[] = [];
	let index = 0;
	while (index < tokens.length) {
		const open = tokens[index];
		if (open.type !== 'container_figure_open') {
			arranged.push(open);
			index += 1;
			continue;
		}
		const close = closingIndex(tokens, index, 'container_figure_close');
		const inside = tokens.slice(index + 1, close);
		const caption: Token[] = [];
		const transcript: Token[] = [];
		const descriptions: string[] = [];
		for (let at = 0; at < inside.length; at += 1) {
			const token = inside[at];
			const partType = /^container_(description|transcript)_open$/.exec(token.type)?.[1];
			if (partType && token.level === open.level + 1) {
				const end = closingIndex(inside, at, `container_${partType}_close`);
				const part = inside.slice(at, end + 1);
				if (partType === 'description') {
					descriptions.push(...part.filter((child) => child.type === 'inline').map(plainText));
				} else {
					transcript.push(...part);
				}
				at = end;
			} else {
				caption.push(token);
			}
		}
		open.meta = { description: descriptions.filter(Boolean).join(' ') };
		// A chart's table gives its bars, and stays under them as "Show as a table".
		if (figureInfo(open).kind === 'chart') {
			const start = caption.findIndex((token) => token.type === 'table_open' && token.level === open.level + 1);
			if (start >= 0) {
				const end = closingIndex(caption, start, 'table_close');
				const table = caption.splice(start, end - start + 1);
				open.meta.rows = tableRows(table);
				open.meta.table = [htmlToken('<details class="essay-chart-table">\n<summary>Show as a table</summary>\n'), ...table, htmlToken('</details>\n')];
			}
		}
		const removal = figureRemoval(open);
		if (caption.length > 0 || removal) {
			arranged.push(open, ...(open.meta.table ?? []), htmlToken('<figcaption>\n'), ...caption, htmlToken(`${removal}</figcaption>\n</figure>\n`));
		} else {
			arranged.push(open, ...(open.meta.table ?? []), htmlToken('</figure>\n'));
		}
		arranged.push(...transcript, tokens[close]);
		index = close + 1;
	}
	return arranged;
}

function figureInfo(token: Token): { kind: FigureKind; address: string } {
	return readFigureInfo(token.info);
}

/** A Markdown table's cells as plain text, row by row, the header row first. */
function tableRows(tokens: Token[]): string[][] {
	const rows: string[][] = [];
	for (const token of tokens) {
		if (token.type === 'tr_open') rows.push([]);
		else if (token.type === 'inline') rows.at(-1)?.push(plainText(token));
	}
	return rows;
}

/**
 * A chart's bars, drawn as the Data and charts page draws them
 * (BarChart.svelte): each bar is a list item holding its name and number,
 * which is what a screen reader reads; the drawn bar is decoration.
 */
function chartHtml(token: Token, state: RenderState): string {
	const chart = chartFromRows((token.meta?.rows as string[][] | undefined) ?? []);
	if ('problem' in chart) {
		state.problems.push(chart.problem);
		return '<p class="essay-figure-missing">This chart cannot be drawn until its table is fixed.</p>\n';
	}
	const scale = scaleTop(Math.max(0, ...chart.bars.map((bar) => bar.value)));
	const percent = (value: number) => `${Number(((value / scale.top) * 100).toFixed(3))}%`;
	const ticks = Array.from({ length: Math.round(scale.top / scale.step) + 1 }, (_, index) => index * scale.step);
	const bars = chart.bars
		.map(
			(bar) =>
				`<li><span class="essay-chart-label">${escapeHtml(bar.label)}</span>` +
				`<span class="essay-chart-track" aria-hidden="true"><span class="essay-chart-fill" style="width: ${percent(bar.value)}"></span></span>` +
				`<span class="essay-chart-value">${escapeHtml(bar.shown)}</span></li>`
		)
		.join('\n');
	const axis = ticks.map((tick) => `<span style="left: ${percent(tick)}">${tick.toLocaleString('en-US')}</span>`).join('');
	return (
		`<div class="essay-chart" style="--grid-step: ${percent(scale.step)}">\n` +
		`<ol class="essay-chart-bars" aria-label="${escapeHtml(`${chart.valueHeader} by ${chart.labelHeader.toLowerCase()}`)}">\n${bars}\n</ol>\n` +
		`<div class="essay-chart-axis" aria-hidden="true"><span></span><span class="essay-chart-ticks">${axis}</span><span></span></div>\n</div>\n`
	);
}

function figureRemoval(token: Token): string {
	const { kind, address } = figureInfo(token);
	const source = figureSource(kind, address);
	return source ? `<p class="essay-figure-removal"><a href="${escapeHtml(figureRemovalLink(source))}">Ask to have this ${kind === 'sound' ? 'recording' : kind} removed</a></p>\n` : '';
}

/**
 * The picture or player at the top of a figure. A YouTube video shows its
 * still frame and loads YouTube's player only when the reader presses play
 * (EssayArticle.svelte), so no YouTube page loads for people who only read;
 * without scripts the button is a link to the video on YouTube.
 */
function figureMedia(token: Token, state: RenderState): string {
	const { kind, address } = figureInfo(token);
	if (kind === 'chart') return chartHtml(token, state);
	const source = figureSource(kind, address);
	const description = String(token.meta?.description ?? '');
	if (!source) {
		state.problems.push(`A ${figureKindLabels[kind].toLowerCase()} has an address the site cannot show: "${address}". Send the file again from the editor${kind === 'video' ? ', or use a YouTube link' : ''}.`);
		return `<p class="essay-figure-missing">This ${figureKindLabels[kind].toLowerCase()} cannot be shown.</p>\n`;
	}
	if (!description && kind !== 'sound') {
		state.warnings.push(`A ${kind} has no description. Add one so people who cannot see it know what it shows.`);
	}
	const named = description ? ` aria-label="${escapeHtml(description)}"` : '';
	if (source.kind === 'youtube') {
		const title = description ? `Play the video: ${description}` : 'Play the video';
		return (
			`<a class="essay-figure-youtube" href="${escapeHtml(source.address)}" data-embed="${escapeHtml(youtubeEmbedAddress(source.identifier))}" data-title="${escapeHtml(description || 'Video')}">` +
			`<img src="${escapeHtml(youtubePosterAddress(source.identifier))}" alt="" loading="lazy" decoding="async" width="480" height="360">` +
			`<span class="essay-figure-play">${escapeHtml(title)}<span class="essay-figure-play-note">Plays from YouTube</span></span></a>\n`
		);
	}
	const file = escapeHtml(source.address);
	// A picture is a link to its file, which opens it larger in the image viewer (src/lib/image-viewer.ts).
	if (kind === 'picture') {
		return `<a href="${file}"${imageViewerAttributeText(description)}><img src="${file}" alt="${escapeHtml(description)}" loading="lazy" decoding="async"></a>\n`;
	}
	const fallback = `<a href="${file}">Download the ${kind === 'video' ? 'video' : 'recording'}</a>`;
	return kind === 'video'
		? `<video controls preload="metadata" src="${file}"${named}>${fallback}</video>\n`
		: `<audio controls preload="metadata" src="${file}"${named}>${fallback}</audio>\n`;
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

	// A link that leaves the site, such as a later case on case.law, opens in a
	// new tab and is marked with an arrow (the same as the opinion copies'
	// links, scripts/caselaw/copy_links.py).
	const defaultLinkOpen = rules.link_open ?? ((tokens, index, options, _environment, self) => self.renderToken(tokens, index, options));
	rules.link_open = (tokens, index, options, environment, self) => {
		const token = tokens[index];
		if (/^https?:\/\//.test(token.attrGet('href') ?? '') && !token.attrGet('class')) {
			token.attrSet('class', 'external');
			token.attrSet('target', '_blank');
			token.attrSet('rel', 'noopener');
			token.attrSet('title', /^https:\/\/case\.law\//.test(token.attrGet('href') ?? '') ? 'Opens on case.law' : 'Opens in a new tab');
		}
		return defaultLinkOpen(tokens, index, options, environment, self);
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
			let citation = state.library.citation(key) ?? escapeHtml(key);
			// The case's name at the head of its box opens the case's own page.
			const page = box === 'case' ? state.library.caseLink?.(key) : undefined;
			if (page?.startsWith('/cases/')) citation = citation.replace(/<(i|em)>([\s\S]*?)<\/\1>/, `<a class="case-page-link" href="${escapeHtml(page)}"><$1>$2</$1></a>`);
			const anchor = `${box}-${key}`;
			const id = state.slugs.has(anchor) ? '' : ` id="${escapeHtml(anchor)}"`;
			state.slugs.add(anchor);
			const classes = box === 'law' ? 'essay-case essay-law' : 'essay-case';
			const facts = state.library.facts?.(box, key) ?? [];
			const factList = facts.length
				? `<dl class="essay-case-facts">\n${facts.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${value}</dd></div>`).join('\n')}\n</dl>\n`
				: '';
			return `<section class="${classes}"${id} data-source="${escapeHtml(key)}">\n${label(box === 'law' ? 'Law' : 'Case')}<p class="essay-case-citation">${readingLinksAfter(citation, marksHtml([mark]))}</p>\n${factList}`;
		};
		rules[`container_${box}_close`] = () => '</section>\n';
	}
	for (const [kind, text] of Object.entries(boxParts)) {
		rules[`container_${kind}_open`] = () => `<div class="essay-case-part essay-case-${kind}">\n${label(text)}`;
		rules[`container_${kind}_close`] = () => '</div>\n';
	}
	rules.topics_open = () => '<ul class="essay-topics">';
	rules.topics_list = (tokens, index) =>
		(tokens[index].meta.topics as string[]).map((topic) => `<li>${escapeHtml(topic)}</li>`).join('');
	rules.topics_close = () => '</ul>\n';
	rules.container_quote_open = () => '<figure class="essay-quote">\n';
	rules.container_quote_close = () => '</figure>\n';
	rules.container_analysis_open = (tokens, index) => {
		const title = essayBlocks.analysis.exec(tokens[index].info.trim())?.[1]?.trim();
		// The title names what the box analyzes; a case name in it is written in *italics*.
		const shown = title ? escapeHtml(title.replaceAll("'", '’')).replace(/\*([^*]+)\*/g, '<em>$1</em>') : '';
		return `<aside class="essay-analysis">\n${label(shown ? `Analysis: ${shown}` : 'Analysis')}`;
	};
	rules.container_analysis_close = () => '</aside>\n';
	// A figure (arrangeFigures): the wrapper holds the <figure> and, after it, the transcript.
	rules.container_figure_open = (tokens, index) => {
		const { kind } = figureInfo(tokens[index]);
		return `<div class="essay-figure-block">\n<figure class="essay-figure essay-figure-${kind}">\n${figureMedia(tokens[index], state)}`;
	};
	rules.container_figure_close = () => '</div>\n';
	rules.container_credit_open = () => '<div class="essay-figure-credit">\n';
	rules.container_credit_close = () => '</div>\n';
	rules.container_transcript_open = () => '<details class="essay-figure-transcript">\n<summary>Transcript</summary>\n';
	rules.container_transcript_close = () => '</details>\n';
	// A description outside a figure has nothing to describe; it shows as plain text.
	rules.container_description_open = () => '<div>\n';
	rules.container_description_close = () => '</div>\n';
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
		if (needlessEndEllipsis(last)) warnings.push(`The quotation ending ${shown(last.slice(-50))} ends its sentence; drop the " ..." after the period.`);
		else if (missingEllipses(last).end) warnings.push(`The quotation ending ${shown(last.slice(-50))} stops mid-sentence; end it with " ...".`);
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

/**
 * Wraps each top-level block whose lines changed since the published version
 * in a mark the page styles as a draft change or a new block (shown only to
 * people with access, src/lib/server/essay-page-state.ts).
 */
function markChangedBlocks(tokens: Token[], lines: LineChange[]): Token[] {
	const marked: Token[] = [];
	let index = 0;
	while (index < tokens.length) {
		const token = tokens[index];
		let end = index;
		if (token.nesting === 1) {
			let depth = 0;
			for (end = index; end < tokens.length; end += 1) {
				depth += tokens[end].nesting;
				if (depth === 0) break;
			}
		}
		const block = tokens.slice(index, end + 1);
		const [from, to] = token.map ?? [0, 0];
		const kinds = lines.slice(from, to);
		const kind = kinds.includes('changed') ? 'changed' : kinds.includes('added') ? 'added' : null;
		if (kind && token.level === 0) {
			const open = new Token('html_block', '', 0);
			open.content = `<div class="essay-draft-mark essay-draft-${kind}" data-draft="${kind === 'added' ? 'New' : 'Draft'}">\n`;
			const close = new Token('html_block', '', 0);
			close.content = '</div>\n';
			marked.push(open, ...block, close);
		} else {
			marked.push(...block);
		}
		index = end + 1;
	}
	return marked;
}

/**
 * An essay file (front matter and Markdown) as HTML, with its outline and
 * Sources list. `lines`, one per line of the body after the front matter,
 * marks the blocks that changed (lineChanges in merge.ts).
 */
/**
 * Each kind of treatment in a list of later cases (laterCasesMarkdown,
 * record-boxes.ts), written "**Distinguished** (6)", shown with its count in
 * a badge, and the list under it marked.
 */
export function laterCaseLists(html: string): string {
	return html.replace(/<p><strong>([^<]+)<\/strong> \((\d+)\)<\/p>\n<ul>/g, (whole, kind: string, count: string) =>
		laterCaseKinds.includes(kind)
			? `<p class="later-cases-kind"><strong>${kind}</strong> <span class="count-badge"><span class="visually-hidden">,</span>${count}</span></p>\n<ul class="later-cases">`
			: whole
	);
}

export function renderEssay(text: string, library: EssayLibrary, { lines }: { lines?: LineChange[] } = {}): RenderedEssay {
	const { frontMatter, body: written } = splitFrontMatter(text.normalize('NFC'));
	// A case or law box the essay leaves empty is filled from its record; marks made against the essay's own lines follow.
	const { text: body, origin } = fillBoxes(
		written,
		(kind, key) => library.box?.(kind, key),
		(kind, key) => library.boxReading?.(kind, key)
	);
	if (lines) lines = origin.map((line) => lines![line]);
	const sources = new EssaySources(library);
	const state: RenderState = { sources, library, problems: [], warnings: [], slugs: new Set(['sources-heading']) };
	const markdown = configure(essayMarkdown(), state);
	const environment = {};
	let tokens = markdown.parse(body, environment);
	// The essay's own "# Title" is shown as the page's heading, not again in the text.
	let title = frontMatterField(frontMatter, 'title') ?? '';
	if (tokens[0]?.type === 'heading_open' && tokens[0].tag === 'h1') {
		title ||= tokens[1]?.content ?? '';
		tokens = tokens.slice(3);
	}
	markAttributions(tokens, library);
	markTopics(tokens);
	const boxesHere = new Set([...body.matchAll(/^:{4,}[ \t]*case[ \t]+([a-z0-9-]+)[ \t]*$/gm)].map((box) => box[1]));
	linkCaseNames(tokens, library, boxesHere);
	tokens = arrangeFigures(tokens);
	const shown = lines ? markChangedBlocks(tokens, lines) : tokens;
	// A link to a case or law box that is not on this page goes to the page that holds it.
	const html = laterCaseLists(markdown.renderer.render(shown, markdown.options, environment))
		.replace(/href="#((?:case|law)-[a-z0-9-]+)"/g, (link, anchor: string) => {
			if (state.slugs.has(anchor)) return link;
			const page = library.boxPage?.(anchor);
			return page ? `href="${escapeHtml(page)}#${anchor}"` : link;
		});
	return {
		title: title || 'Untitled',
		html,
		headings: headingsOf(tokens),
		sources: sources.list,
		problems: [...new Set([...state.problems, ...sources.problems])],
		warnings: [...quotationWarnings(tokens), ...state.warnings]
	};
}
