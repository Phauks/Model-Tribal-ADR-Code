/**
 * The page being read as a Markdown file, for the Download menu's "This page as Markdown"
 * (site/DESIGN.md, section 6, "Download"). Trevor asked for it on Nov. 23, 2026. It is made in the
 * browser from the page as shown, so it works the same on pages built ahead and pages the Worker
 * renders, and holds what the PDF holds: the page's own text, its tables, its citation markers and
 * its Sources list, without the menus, buttons and controls around them.
 *
 * Kept free of Svelte and the page's globals other than the nodes it is given, so a test can pass
 * any DOM.
 */

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

/** Stands for a line break until spaces are tidied, so the break's two trailing spaces survive. */
const lineBreak = '\u0000';

const blockNames = new Set([
	'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
	'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY',
	'TABLE', 'UL'
]);

export interface PageMarkdownOptions {
	title: string;
	/** The page's address, which also makes the page's links whole. */
	address: string;
	siteName: string;
	contentVersion?: string;
	/** When the file is made. */
	made: Date;
}

/** Escapes the characters Markdown would read as formatting inside running text. */
function escapeText(text: string): string {
	return text.replace(/([\\`*_[\]])/g, '\\$1');
}

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
	if (!href || href.startsWith('javascript:')) return undefined;
	try {
		return new URL(href, base).href;
	} catch {
		return undefined;
	}
}

class Writer {
	constructor(private readonly base: string) {}

	/** Running text: links, emphasis, code and line breaks, on one logical line. */
	inline(node: Node): string {
		if (node.nodeType === 3) return escapeText((node.textContent ?? '').replace(/\s+/g, ' '));
		if (!isElement(node) || node.matches(skippedSelector)) return '';
		const inner = () => Array.from(node.childNodes, (child) => this.inline(child)).join('');
		switch (node.nodeName) {
			case 'BR':
				return lineBreak;
			case 'STRONG':
			case 'B':
				return wrap(inner(), '**');
			case 'EM':
			case 'I':
			case 'CITE':
				return wrap(inner(), '*');
			case 'CODE':
			case 'KBD':
			case 'SAMP': {
				const text = (node.textContent ?? '').replace(/\s+/g, ' ');
				const fence = text.includes('`') ? '``' : '`';
				return text ? `${fence}${text}${fence}` : '';
			}
			case 'SUP':
				// A citation marker reads "[3]", which the Sources list at the end explains.
				if (node.classList.contains('citation')) {
					return Array.from(node.querySelectorAll('a'), (marker) => `\\[${marker.textContent?.trim()}\\]`).join('');
				}
				return `^${inner()}^`;
			case 'IMG': {
				const alt = node.getAttribute('alt') ?? '';
				const source = wholeLink(node.getAttribute('src') ?? '', this.base);
				return alt && source ? `![${escapeText(alt)}](${source})` : escapeText(alt);
			}
			case 'A': {
				// Link text stays on one line, or the link would break.
				const text = inner().replaceAll(lineBreak, ', ').trim();
				const href = node.getAttribute('href') ?? '';
				// A link within the page reads as its text; the Markdown has no such anchors.
				if (!text || href.startsWith('#')) return text;
				const link = wholeLink(href, this.base);
				return link ? `[${text}](${link.replaceAll(' ', '%20').replaceAll(')', '%29')})` : text;
			}
			default:
				return inner();
		}
	}

	/** Block content, as Markdown blocks separated by blank lines. */
	blocks(node: Node, depth = 0): string[] {
		if (node.nodeType === 3) {
			const text = tidy(this.inline(node));
			return text ? [text] : [];
		}
		if (!isElement(node) || node.matches(skippedSelector)) return [];
		const name = node.nodeName;
		const heading = /^H([1-6])$/.exec(name);
		if (heading) {
			const text = this.line(node);
			return text ? [`${'#'.repeat(Number(heading[1]))} ${text}`] : [];
		}
		switch (name) {
			case 'P':
			case 'FIGCAPTION':
			case 'ADDRESS':
			case 'DT': {
				if (hasBlock(node)) return this.children(node, depth);
				const text = this.line(node);
				return text ? [name === 'DT' ? `**${text}**` : text] : [];
			}
			case 'SUMMARY': {
				// A folded section's summary often holds its heading.
				if (hasBlock(node)) return this.children(node, depth);
				const text = this.line(node).replace(/\s*·$/, '');
				return text ? [`**${text}**`] : [];
			}
			case 'HR':
				return ['---'];
			case 'PRE':
				return [`\`\`\`\n${(node.textContent ?? '').replace(/\n$/, '')}\n\`\`\``];
			case 'BLOCKQUOTE':
				return [
					this.children(node, depth)
						.join('\n\n')
						.split('\n')
						.map((line) => (line ? `> ${line}` : '>'))
						.join('\n')
				];
			case 'UL':
			case 'OL':
				return this.list(node, depth);
			case 'TABLE':
				return this.table(node);
			case 'IMG':
			case 'A':
			case 'SPAN':
			case 'STRONG':
			case 'EM':
			case 'B':
			case 'I':
			case 'CODE':
			case 'SUP':
			case 'CITE': {
				const text = tidy(this.inline(node));
				return text ? [text] : [];
			}
			default:
				return this.children(node, depth);
		}
	}

	private line(node: Element): string {
		return tidy(Array.from(node.childNodes, (child) => this.inline(child)).join(''));
	}

	/** Children of a container: runs of inline nodes become one paragraph each. */
	private children(node: Element, depth: number): string[] {
		const out: string[] = [];
		let run = '';
		const flush = () => {
			const text = tidy(run);
			if (text) out.push(text);
			run = '';
		};
		for (const child of Array.from(node.childNodes)) {
			if (isElement(child) && (blockNames.has(child.nodeName) || hasBlock(child))) {
				flush();
				out.push(...this.blocks(child, depth));
			} else {
				run += this.inline(child);
			}
		}
		flush();
		return out;
	}

	private list(node: Element, depth: number): string[] {
		const ordered = node.nodeName === 'OL';
		let number = Number(node.getAttribute('start') ?? 1) || 1;
		const items: string[] = [];
		for (const item of Array.from(node.children)) {
			if (item.nodeName !== 'LI' || item.matches(skippedSelector)) continue;
			// A source keeps its number from the page, which runs on from one group of sources to the next.
			const own = /^source-(\d+)$/.exec(item.id)?.[1];
			const marker = ordered ? `${own ?? number}. ` : '- ';
			number += 1;
			const parts = this.children(item, depth + 1);
			if (parts.length === 0) continue;
			const indent = ' '.repeat(marker.length);
			// Parts of one item are separate paragraphs, or Markdown would run them into one.
			const body = parts
				.join('\n\n')
				.split('\n')
				.map((line, index) => (index === 0 ? `${marker}${line}` : line ? `${indent}${line}` : ''))
				.join('\n');
			items.push(body);
		}
		return items.length > 0 ? [items.join('\n')] : [];
	}

	private table(node: Element): string[] {
		const rows = Array.from(node.querySelectorAll('tr')).filter((row) => !row.closest(skippedSelector));
		if (rows.length === 0) return [];
		const cells = rows.map((row) =>
			Array.from(row.children)
				.filter((cell) => (cell.nodeName === 'TH' || cell.nodeName === 'TD') && !cell.matches(skippedSelector))
				.map((cell) => this.line(cell).replace(/\s*\n\s*/g, ' ').replaceAll('|', '\\|'))
		);
		const width = Math.max(...cells.map((row) => row.length));
		if (width === 0) return [];
		const pad = (row: string[]) => [...row, ...Array<string>(width - row.length).fill('')];
		const [head, ...body] = cells;
		const lines = [
			`| ${pad(head).join(' | ')} |`,
			`| ${Array<string>(width).fill('---').join(' | ')} |`,
			...body.map((row) => `| ${pad(row).join(' | ')} |`)
		];
		const caption = node.querySelector('caption');
		const captionText = caption && !caption.matches(skippedSelector) ? this.line(caption) : '';
		return captionText ? [lines.join('\n'), `*${captionText}*`] : [lines.join('\n')];
	}
}

/** Collapses spaces and turns the line-break stand-ins into Markdown line breaks. */
function tidy(text: string): string {
	return text
		.replace(/[ \t]+/g, ' ')
		.replace(/ ?\u0000 ?/g, lineBreak)
		.trim()
		.replace(/^\u0000+|\u0000+$/g, '')
		.replaceAll(lineBreak, '  \n');
}

function wrap(text: string, mark: string): string {
	const trimmed = text.trim();
	if (!trimmed) return text;
	const before = text.startsWith(' ') ? ' ' : '';
	const after = text.endsWith(' ') ? ' ' : '';
	return `${before}${mark}${trimmed}${mark}${after}`;
}

function quoteYaml(text: string): string {
	return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/** The page's content as Markdown, with a short header saying where it came from. */
export function pageMarkdown(root: Element, options: PageMarkdownOptions): string {
	const made = options.made.toISOString().slice(0, 10);
	const header = [
		'---',
		`title: ${quoteYaml(options.title)}`,
		`source: ${options.address}`,
		`site: ${quoteYaml(options.siteName)}`,
		...(options.contentVersion ? [`content_version: ${options.contentVersion}`] : []),
		`saved: ${made}`,
		'---'
	].join('\n');
	const body = new Writer(options.address).blocks(root).join('\n\n');
	return `${header}\n\n${body.replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** A file name for the page, from its address: "/nations/navajo-nation" -> "navajo-nation.md". */
export function markdownFileName(path: string): string {
	const last = path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1);
	const name = (last ? decodeURIComponent(last) : 'home').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');
	return `${name || 'page'}.md`;
}
