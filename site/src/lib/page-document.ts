/**
 * The page being read as a document, for the Download menu's "This page" as Markdown, Word or
 * OpenDocument (site/DESIGN.md, section 6, "Download"). Trevor asked for Markdown on Nov. 23, 2026,
 * then for Word and OpenDocument, and for the formats to share one way of reading the page. The
 * page is read once into the blocks below, and each format writes the same blocks
 * (src/lib/page-markdown.ts, src/lib/office-documents.ts), so the three files always hold the same
 * text.
 *
 * It reads the page as shown, so it works the same on pages built ahead and pages the Worker
 * renders, and keeps what the PDF keeps: the page's own text, tables, citation markers and Sources
 * list, without menus, buttons, controls or text meant only for screen readers.
 *
 * Uses only the nodes it is given, so a test can pass any DOM.
 */

/** A piece of running text with one look. */
export interface Run {
	text: string;
	bold?: boolean;
	italic?: boolean;
	code?: boolean;
	/** A whole address, made from the page's link. */
	link?: string;
	/** A line break before nothing else; text is empty. */
	lineBreak?: boolean;
}

export type Block =
	| { type: 'heading'; level: number; runs: Run[] }
	| { type: 'paragraph'; runs: Run[]; label?: boolean }
	| { type: 'list'; ordered: boolean; items: ListItem[] }
	| { type: 'table'; rows: Run[][][]; caption?: Run[] }
	| { type: 'quote'; blocks: Block[] }
	| { type: 'code'; text: string }
	| { type: 'rule' };

export interface ListItem {
	/** The number an ordered item shows, such as a source's own number. */
	number?: number;
	blocks: Block[];
}

export interface PageDocument {
	title: string;
	/** The page's address. */
	address: string;
	siteName: string;
	contentVersion?: string;
	/** When the file is made. */
	made: Date;
	blocks: Block[];
}

export type PageDocumentDetails = Omit<PageDocument, 'blocks'>;

/** Elements left out: controls, pictures drawn for the screen, and text meant only for screen readers. */
const skippedSelector = [
	'script',
	'style',
	'template',
	'noscript',
	'button',
	'input',
	'select',
	'textarea',
	'form',
	'dialog',
	'svg',
	'canvas',
	'iframe',
	'video',
	'audio',
	'nav',
	'[hidden]',
	'[aria-hidden="true"]',
	'.no-print',
	'.visually-hidden',
	'.needs-scripts',
	// A source's own number and its links back to where it is cited; the list numbers it instead.
	'.source-backlinks'
].join(',');

const blockNames = new Set([
	'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
	'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY',
	'TABLE', 'UL'
]);

type Look = Omit<Run, 'text' | 'lineBreak'>;

function isElement(node: Node): node is Element {
	return node.nodeType === 1;
}

function hasBlock(element: Element): boolean {
	for (const child of Array.from(element.children)) {
		if (blockNames.has(child.nodeName) || hasBlock(child)) return true;
	}
	return false;
}

function wholeLink(href: string, base: string): string | undefined {
	if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return undefined;
	try {
		return new URL(href, base).href;
	} catch {
		return undefined;
	}
}

function sameLook(a: Run, b: Run): boolean {
	return !a.lineBreak && !b.lineBreak && !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.code === !!b.code && a.link === b.link;
}

/**
 * Collapses spaces, joins runs that look the same, and trims the ends, as a browser shows the
 * text.
 */
export function tidyRuns(runs: Run[]): Run[] {
	const out: Run[] = [];
	for (const run of runs) {
		const text = run.lineBreak ? '' : run.code ? run.text : run.text.replace(/\s+/g, ' ');
		if (!run.lineBreak && text === '') continue;
		const previous = out.at(-1);
		const next: Run = { ...run, text };
		// A space after a space or a line break is not shown.
		if (!next.lineBreak && (!previous || previous.lineBreak || previous.text.endsWith(' '))) next.text = next.text.replace(/^ /, '');
		if (!next.lineBreak && next.text === '') continue;
		if (previous && sameLook(previous, next)) previous.text += next.text;
		else out.push(next);
	}
	while (out.length > 0 && (out[0].lineBreak || out[0].text.trim() === '')) out.shift();
	while (out.length > 0 && (out.at(-1)!.lineBreak || out.at(-1)!.text.trim() === '')) out.pop();
	if (out.length > 0) {
		out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, '') };
		const last = out.length - 1;
		out[last] = { ...out[last], text: out[last].text.replace(/\s+$/, '') };
	}
	// A space just before a line break is not shown either.
	return out.map((run, index) => (out[index + 1]?.lineBreak ? { ...run, text: run.text.replace(/ $/, '') } : run));
}

export function runsText(runs: Run[]): string {
	return runs.map((run) => (run.lineBreak ? '\n' : run.text)).join('');
}

class Reader {
	constructor(private readonly base: string) {}

	runs(node: Node, look: Look = {}): Run[] {
		if (node.nodeType === 3) return [{ ...look, text: node.textContent ?? '' }];
		if (!isElement(node) || node.matches(skippedSelector)) return [];
		const inner = (next: Look = look) => Array.from(node.childNodes).flatMap((child) => this.runs(child, next));
		switch (node.nodeName) {
			case 'BR':
				return [{ text: '', lineBreak: true }];
			case 'STRONG':
			case 'B':
				return inner({ ...look, bold: true });
			case 'EM':
			case 'I':
			case 'CITE':
				return inner({ ...look, italic: true });
			case 'CODE':
			case 'KBD':
			case 'SAMP':
				return [{ ...look, code: true, text: (node.textContent ?? '').replace(/\s+/g, ' ') }];
			case 'SUP':
				// A citation marker reads "[3]", which the Sources list at the end explains.
				if (node.classList.contains('citation')) {
					return [{ ...look, link: undefined, text: Array.from(node.querySelectorAll('a'), (marker) => `[${marker.textContent?.trim()}]`).join('') }];
				}
				return inner();
			case 'IMG': {
				const alt = node.getAttribute('alt') ?? '';
				return alt ? [{ ...look, text: alt }] : [];
			}
			case 'A': {
				const link = wholeLink(node.getAttribute('href') ?? '', this.base);
				// Link text stays on one line, or the link would break in Markdown.
				return inner(link ? { ...look, link } : look).map((run) => (run.lineBreak && link ? { ...look, link, text: ', ' } : run));
			}
			default:
				return inner();
		}
	}

	private line(node: Element): Run[] {
		return tidyRuns(Array.from(node.childNodes).flatMap((child) => this.runs(child)));
	}

	blocks(node: Node): Block[] {
		if (node.nodeType === 3) {
			const runs = tidyRuns(this.runs(node));
			return runs.length > 0 ? [{ type: 'paragraph', runs }] : [];
		}
		if (!isElement(node) || node.matches(skippedSelector)) return [];
		const name = node.nodeName;
		const heading = /^H([1-6])$/.exec(name);
		if (heading) {
			const runs = this.line(node).map((run) => ({ ...run, bold: undefined }));
			return runs.length > 0 ? [{ type: 'heading', level: Number(heading[1]), runs }] : [];
		}
		switch (name) {
			case 'P':
			case 'FIGCAPTION':
			case 'ADDRESS':
			case 'DT':
			case 'SUMMARY': {
				// A folded section's summary often holds its heading.
				if (hasBlock(node)) return this.children(node);
				let runs = this.line(node);
				if (name === 'SUMMARY' && runs.length > 0) {
					const last = runs.length - 1;
					runs = [...runs.slice(0, last), { ...runs[last], text: runs[last].text.replace(/\s*·$/, '') }];
				}
				if (runs.length === 0) return [];
				const label = name === 'DT' || name === 'SUMMARY';
				return [{ type: 'paragraph', runs: label ? runs.map((run) => ({ ...run, bold: true })) : runs, ...(label ? { label: true } : {}) }];
			}
			case 'HR':
				return [{ type: 'rule' }];
			case 'PRE':
				return [{ type: 'code', text: (node.textContent ?? '').replace(/\n$/, '') }];
			case 'BLOCKQUOTE': {
				const blocks = this.children(node);
				return blocks.length > 0 ? [{ type: 'quote', blocks }] : [];
			}
			case 'UL':
			case 'OL':
				return this.list(node);
			case 'TABLE':
				return this.table(node);
			default:
				if (!blockNames.has(name) && !hasBlock(node)) {
					const runs = this.line(node);
					return runs.length > 0 ? [{ type: 'paragraph', runs }] : [];
				}
				return this.children(node);
		}
	}

	/** Children of a container: each run of text and inline elements becomes one paragraph. */
	private children(node: Element): Block[] {
		const out: Block[] = [];
		let pending: Run[] = [];
		const flush = () => {
			const runs = tidyRuns(pending);
			if (runs.length > 0) out.push({ type: 'paragraph', runs });
			pending = [];
		};
		for (const child of Array.from(node.childNodes)) {
			if (isElement(child) && (blockNames.has(child.nodeName) || hasBlock(child))) {
				flush();
				out.push(...this.blocks(child));
			} else {
				pending.push(...this.runs(child));
			}
		}
		flush();
		return out;
	}

	private list(node: Element): Block[] {
		const ordered = node.nodeName === 'OL';
		let number = Number(node.getAttribute('start') ?? 1) || 1;
		const items: ListItem[] = [];
		for (const item of Array.from(node.children)) {
			if (item.nodeName !== 'LI' || item.matches(skippedSelector)) continue;
			// A source keeps its number from the page, which runs on from one group of sources to the next.
			const own = Number(/^source-(\d+)$/.exec(item.id)?.[1] ?? Number.NaN);
			const blocks = this.children(item);
			const shown = Number.isNaN(own) ? number : own;
			number += 1;
			if (blocks.length > 0) items.push(ordered ? { number: shown, blocks } : { blocks });
		}
		return items.length > 0 ? [{ type: 'list', ordered, items }] : [];
	}

	private table(node: Element): Block[] {
		const rows = Array.from(node.querySelectorAll('tr'))
			.filter((row) => !row.closest(skippedSelector) && row.closest('table') === node)
			.map((row) =>
				Array.from(row.children)
					.filter((cell) => (cell.nodeName === 'TH' || cell.nodeName === 'TD') && !cell.matches(skippedSelector))
					.map((cell) => this.line(cell).map((run) => (run.lineBreak ? { text: ' ' } : run)))
			)
			.filter((row) => row.length > 0);
		if (rows.length === 0) return [];
		const width = Math.max(...rows.map((row) => row.length));
		const padded = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => [] as Run[])]);
		const captionNode = node.querySelector('caption');
		const caption = captionNode && !captionNode.matches(skippedSelector) ? this.line(captionNode) : [];
		return [{ type: 'table', rows: padded, ...(caption.length > 0 ? { caption } : {}) }];
	}
}

/** Reads the page's content into blocks. */
export function readPage(root: Element, details: PageDocumentDetails): PageDocument {
	return { ...details, blocks: new Reader(details.address).blocks(root) };
}

/** A file name for the page, from its address: "/nations/navajo-nation", "md" -> "navajo-nation.md". */
export function pageFileName(path: string, extension: string): string {
	const last = path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1);
	let decoded = last ?? 'home';
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		// An address that does not decode keeps its own spelling.
	}
	const name = decoded.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');
	return `${name || 'page'}.${extension}`;
}

/** The lines under the title saying where the file came from. */
export function provenance(document: PageDocumentDetails): string[] {
	const made = document.made.toISOString().slice(0, 10);
	const version = document.contentVersion ? `, content version ${document.contentVersion}` : '';
	return [`From ${document.siteName}${version}: ${document.address}`, `Saved ${made}. The page may have changed since; the address above has the current version.`];
}
