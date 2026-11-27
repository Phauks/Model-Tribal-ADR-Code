/**
 * The reading version of a copy this site keeps: the words of a saved text or
 * web page as page text in the site's own type, for the document text card
 * (src/lib/components/DocumentText.svelte; Trevor chose design B on Nov. 27,
 * 2026, design/document-text/ in the project files).
 *
 * The served file itself never changes, since its SHA-256 must match the
 * publisher's. This module reads it and writes a cleaned copy of its words:
 *
 * - A transcribed text (.txt), such as an executive order's, becomes
 *   paragraphs. Its own line breaks are kept, so a reader can read the lines
 *   as printed or let them flow. A form feed starts a new page. A short line
 *   after a long paragraph that reads as a name ("Edw. P. Smith,
 *   Commissioner") is a signature. The heading the project's own script
 *   wrote at the top (title, date, where the text comes from) becomes the
 *   card's note instead of part of the text.
 * - A saved web page keeps its headings, paragraphs, lists, tables, block
 *   quotations, emphasis and small caps. The site's menus around the text
 *   (navigation, headers, footers, "Home" and "Next" links) are dropped, as
 *   are scripts, styles, forms and anything that could load or run. Links to
 *   other sites stay, opening in a new tab.
 * - A court opinion built from the Caselaw Access Project keeps its writer's
 *   line, footnotes and the citations' links. Its page numbers ("*132")
 *   become a "Page 132" rule with an anchor, #page-132, splitting a paragraph
 *   where the printed page turned.
 *
 * Plain string work with no browser or Node globals, so the Worker, the
 * reader's browser (reading a copy saved offline) and the tests run it alike.
 */

export interface ReadingText {
	/** The text as safe HTML for the card. */
	html: string;
	/** Where the text comes from, in one sentence, such as "Text as transcribed by …". */
	note?: string;
	/** The printed pages the text marks, in order, such as ["131", "132"]. */
	pages: string[];
	/** Whether the text keeps the printed line breaks, so "As printed" and "Flowing" read differently. */
	printedLines: boolean;
	/** About how many words the text has. */
	words: number;
}

const namedEntities: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	sect: '§',
	para: '¶',
	mdash: '—',
	ndash: '–',
	hellip: '…',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	copy: '©',
	reg: '®',
	deg: '°',
	frac12: '½',
	frac14: '¼',
	frac34: '¾',
	middot: '·',
	shy: '­'
};

/** Text with its character references written out, such as "&sect; 5" as "§ 5". */
export function decodeEntities(text: string): string {
	return text.replace(/&(#\d{1,7}|#x[\da-f]{1,6}|[a-z][a-z\d]{1,9});/gi, (whole, name: string) => {
		if (name[0] === '#') {
			const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
			return code > 0 && code < 0x110000 && !(code >= 0xd800 && code < 0xe000) ? String.fromCodePoint(code) : whole;
		}
		return namedEntities[name.toLowerCase()] ?? whole;
	});
}

/** Text safe to put in HTML. */
export function escapeText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, '&quot;');
}

/** Text found between tags, made safe: its references read and written again, so nothing in it is markup. */
function safeText(text: string): string {
	return escapeText(decodeEntities(text));
}

function wordCount(html: string): number {
	const text = decodeEntities(html.replace(/<[^>]*>/g, ' '));
	return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;
}

function pageRule(label: string): string {
	return `<div class="page-rule" id="page-${label}" data-page="${label}"><a href="#page-${label}">Page ${label}</a></div>`;
}

/** A page number as an anchor's name allows: "132", "A-4". */
function pageLabel(value: string): string {
	return value.replace(/^\*+/, '').replace(/[^\w.-]/g, '');
}

// ---------------------------------------------------------------------------
// Transcribed text

/** A line that names who signed: initials or a title after a comma, all words capitalized ("U. S. Grant", "C. Delano, Secretary"). */
const signatureLine = /^(?:[A-Z][\w'’.-]*\.?\s+){0,5}[A-Z][\w'’.-]*\.?(?:,\s+[A-Z][\w'’. -]*)?$/;

function looksLikeSignature(line: string, before: string | undefined): boolean {
	if (!before || before.replace(/\s+/g, ' ').length < 80 || line.length > 60) return false;
	if (!signatureLine.test(line)) return false;
	// A person's name, not a heading of capitalized words: an initial, or a title after a comma.
	return /\b[A-Z]\.(?:\s|$)/.test(line) || /^[^,]+,\s+\S/.test(line);
}

/** The note the project's scripts write at the top of a transcribed text, such as "Text as transcribed by …". */
const notePattern = /^(?:Text as transcribed by|Text from|Transcribed by|Transcription by)\b/;

/**
 * A transcribed text as paragraphs. Lines in a paragraph keep their breaks as
 * <br class="printed">, which the card hides when the reader picks
 * "Flowing"; a word broken over a line ("Depart-" / "ment") joins up there.
 */
/** A text that refers to a drawing the copy does not have: "the above diagram", "the accompanying map". */
const figureReference = /\b(?:the|said)\s+(?:above|annexed|accompanying|attached|enclosed|following|foregoing)\s+(diagram|map|plat|plan|sketch|drawing|figure|tracing)\b/i;

/**
 * Where a transcribed text refers to a drawing it does not hold: a note in
 * its place, with a link to offer a copy. `suggest` is the request form's
 * address for the copy.
 */
function figureNotice(phrase: string, what: string, suggest: string | undefined): string {
	const name = what.toLowerCase();
	const title = `${name[0].toUpperCase()}${name.slice(1)} not printed here`;
	const offer = suggest ? ` <a href="${escapeAttribute(suggest)}">Suggest a copy of the ${escapeText(name)}</a>` : '';
	return `<div class="figure-missing" role="note"><p><strong>${escapeText(title)}</strong> The text refers to “${escapeText(phrase)},” which this copy does not include.${offer}</p></div>`;
}

export function readingFromPlainText(text: string, suggest?: string): ReadingText {
	let figureShown = false;
	const pages = text.replace(/\r\n?/g, '\n').split('\f');
	let note: string | undefined;
	let printedLines = false;
	const labels: string[] = [];
	const parts: string[] = [];
	pages.forEach((page, pageIndex) => {
		let paragraphs = page
			.split(/\n[ \t]*\n+/)
			.map((paragraph) => paragraph.replace(/^\n+|\s+$/g, ''))
			.filter((paragraph) => paragraph.trim().length > 0);
		if (pageIndex === 0 && !note) {
			// The heading the project's script wrote: the title and date, then where the text comes from.
			const noteAt = paragraphs.findIndex((paragraph) => notePattern.test(paragraph.trim()));
			if (noteAt >= 0 && noteAt <= 1) {
				note = paragraphs[noteAt].replace(/\s+/g, ' ').trim();
				paragraphs = paragraphs.slice(noteAt + 1);
			}
		}
		if (pageIndex > 0) {
			const label = String(pageIndex + 1);
			labels.push(label);
			parts.push(pageRule(label));
		}
		paragraphs.forEach((paragraph, index) => {
			const lines = paragraph.split('\n').map((line) => line.replace(/\s+$/, ''));
			const single = lines.length === 1 ? lines[0].trim() : undefined;
			if (single !== undefined && looksLikeSignature(single, paragraphs[index - 1])) {
				parts.push(`<p class="signature"><span class="signer">${escapeText(single)}</span></p>`);
				return;
			}
			if (lines.length > 1) printedLines = true;
			const figure = figureShown ? null : figureReference.exec(paragraph);
			let body = '';
			lines.forEach((line, lineIndex) => {
				const trimmed = lineIndex === 0 ? line.trim() : line.trim();
				if (lineIndex === 0) {
					body += escapeText(trimmed);
					return;
				}
				const previous = lines[lineIndex - 1].trim();
				// A word broken at the end of a printed line, its hyphen shown only as printed.
				if (/[a-z]-$/.test(previous) && /^[a-z]/.test(trimmed)) {
					body = body.replace(/-$/, '<span class="printed-hyphen">-</span>');
					body += `<br class="printed">${escapeText(trimmed)}`;
				} else {
					body += `<br class="printed"> ${escapeText(trimmed)}`;
				}
			});
			parts.push(`<p>${body}</p>`);
			// The note follows the paragraph that names the drawing.
			if (figure) {
				figureShown = true;
				parts.push(figureNotice(figure[0].replace(/\s+/g, ' '), figure[1], suggest));
			}
		});
	});
	const html = parts.join('\n');
	return { html, ...(note ? { note } : {}), pages: labels, printedLines, words: wordCount(html) };
}

// ---------------------------------------------------------------------------
// Saved web pages

/** Elements kept as they are, without attributes. */
const inlineElements = new Set(['em', 'i', 'strong', 'b', 'u', 'sup', 'sub', 'small', 's', 'cite', 'abbr', 'q', 'code', 'var', 'dfn', 'mark']);
/** Blocks kept, without attributes. */
const blockElements = new Set(['p', 'blockquote', 'pre', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'figure', 'figcaption']);
/** Blocks that are only a boundary: their words stay, the element goes. */
const boundaryElements = new Set(['div', 'section', 'article', 'main', 'body', 'html', 'center', 'address', 'hgroup', 'details', 'summary', 'fieldset', 'legend']);
/** Elements dropped with everything in them. */
const droppedElements = new Set([
	'script',
	'style',
	'iframe',
	'object',
	'embed',
	'template',
	'noscript',
	'svg',
	'math',
	'form',
	'textarea',
	'select',
	'button',
	'input',
	'head',
	'title',
	'nav',
	'header',
	'footer',
	'menu',
	'dialog',
	'canvas',
	'video',
	'audio',
	'map',
	'picture'
]);
/** Elements with no closing tag. */
const voidElements = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr', 'param']);
/** A block opening that ends an open paragraph, as browsers do with unclosed <p> in old pages. */
const endsParagraph = new Set([...blockElements, ...boundaryElements, 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'].filter((name) => !['td', 'th', 'li', 'dt', 'dd', 'tr', 'caption', 'figcaption', 'thead', 'tbody', 'tfoot'].includes(name)));
/** Elements that can be closed and opened again where a printed page turns. */
const splittable = new Set(['p', 'blockquote', 'em', 'i', 'strong', 'b', 'u', 'small', 'span', 'cite']);

/** Ids, classes and roles of a site's menus, banners and other parts around the text. */
const chromeName = /(?:^|[\s_-])(?:nav|navbar|navigation|menu|menubar|sidebar|breadcrumbs?|skip|masthead|banner|site-header|site-footer|footer|header|cookie|share|social|toolbar|pagination|pager|search)(?:$|[\s_-])/i;
/** A link that only moves around the other site: "Home", "Back", "Next page", "Table of Contents". */
const menuLinkText = /^\s*(?:(?:go\s+)?(?:back|home|next|previous|prev|top|up|index|menu|contents|table of contents|return)(?:\s+(?:to\s+)?(?:top|home|page|index|contents|the [\w ]+))?|[\w ]{0,20}\bhome(?: page)?)\s*[.:>»]*\s*$/i;

function attributesOf(text: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of text.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
		found.set(match[1].toLowerCase(), decodeEntities(match[3] ?? match[4] ?? match[5] ?? ''));
	}
	return found;
}

/** An address a reader may follow, resolved against the page's own address: on this site, or https and http elsewhere. */
function safeLink(href: string, base: string | undefined): { href: string; external: boolean } | undefined {
	const value = href.trim();
	if (!value || /^(?:javascript|data|vbscript|file|mailto|tel):/i.test(value)) return undefined;
	if (value.startsWith('/') && !value.startsWith('//') && !base) return { href: value, external: false };
	try {
		const address = new URL(value, base);
		if (address.protocol !== 'https:' && address.protocol !== 'http:') return undefined;
		return { href: address.href, external: true };
	} catch {
		return undefined;
	}
}

function identifier(value: string): string {
	return value.replace(/[^\w-]/g, '').slice(0, 80);
}

/** A language tag the page gives a passage, kept so a screen reader reads it in that language: ' lang="chr"'. */
function languageOf(attributes: Map<string, string>): string {
	const tag = attributes.get('lang') ?? attributes.get('xml:lang') ?? '';
	return /^[a-z]{2,3}(?:-[A-Za-z\d]{2,8})*$/.test(tag) ? ` lang="${tag}"` : '';
}

interface OpenElement {
	name: string;
	/** The tag that opens it again after a page turns. */
	tag: string;
	/** Written out: false for a boundary whose words stay without it, or a menu link that was dropped. */
	kept: boolean;
	/** The element written, when it differs from the one in the page, such as h3 for the page's h1. */
	written?: string;
}

export interface CleanOptions {
	/** The page's own address, to resolve its relative links; they open the other site in a new tab. */
	base?: string;
	/** Whether this is a Caselaw Access Project opinion page, with its page labels and footnotes. */
	caselaw?: boolean;
}

/**
 * A saved web page's words as safe HTML. Works on any HTML, however old: an
 * unclosed <p> ends at the next block, <font> and <center> give way to their
 * words, and the site's own menus are left out.
 */
export function cleanPageHtml(html: string, options: CleanOptions = {}): { html: string; pages: string[] } {
	const out: string[] = [];
	const stack: OpenElement[] = [];
	const pages: string[] = [];
	let at = 0;
	let dropped = 0;
	let droppedName = '';
	let skippingPageLabel = 0;
	/** Index in `out` where the open link started, to drop a menu link whose words turn out to be "Home". */
	const linkStarts: number[] = [];
	const tags = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

	const write = (text: string) => out.push(text);
	const closeTo = (index: number) => {
		while (stack.length > index) {
			const element = stack.pop() as OpenElement;
			if (element.kept) write(`</${element.written ?? element.name}>`);
			if (element.name === 'a') linkStarts.pop();
		}
	};
	const openIndex = (name: string) => {
		for (let index = stack.length - 1; index >= 0; index--) if (stack[index].name === name) return index;
		return -1;
	};
	const closeParagraph = () => {
		const index = openIndex('p');
		if (index >= 0 && !stack.slice(index + 1).some((element) => ['table', 'ul', 'ol', 'blockquote', 'dl'].includes(element.name))) closeTo(index);
	};
	const open = (name: string, tag: string, kept = true, written?: string) => {
		stack.push({ name, tag, kept, ...(written ? { written } : {}) });
		if (kept) write(tag);
	};

	for (const match of html.matchAll(tags)) {
		const between = html.slice(at, match.index);
		at = match.index + match[0].length;
		if (dropped === 0 && skippingPageLabel === 0 && between) write(safeText(between));
		if (match[2] === undefined) continue;
		const closing = match[1] === '/';
		const name = match[2].toLowerCase();
		const rawAttributes = match[3] ?? '';
		const selfClosing = /\/\s*$/.test(rawAttributes) || voidElements.has(name);
		if (dropped > 0) {
			if (name === droppedName && !selfClosing) dropped += closing ? -1 : 1;
			continue;
		}
		const attributes = closing ? new Map<string, string>() : attributesOf(rawAttributes);
		const className = attributes.get('class') ?? '';
		const classes = className.split(/\s+/).filter(Boolean);
		const named = `${attributes.get('id') ?? ''} ${className} ${attributes.get('role') ?? ''}`;

		// The copy's own banner on a Caselaw Access Project page is this site's, written when the copy was made; the card says it in its note.
		if (!closing && (droppedElements.has(name) || (name === 'aside' && !classes.includes('footnote')) || (!options.caselaw && name !== 'a' && name !== 'p' && chromeName.test(named) && !/\b(?:content|main|text|body)\b/i.test(named)))) {
			if (!selfClosing) {
				dropped = 1;
				droppedName = name;
			}
			continue;
		}
		if (droppedElements.has(name)) continue;

		if (name === 'a') {
			if (closing) {
				if (skippingPageLabel > 0) {
					skippingPageLabel--;
					continue;
				}
				const index = openIndex('a');
				if (index < 0) continue;
				const start = linkStarts.at(-1) ?? -1;
				const words = decodeEntities(out.slice(start + 1).join('').replace(/<[^>]*>/g, ''));
				const link = stack[index];
				if (link.kept && !options.caselaw && start >= 0 && menuLinkText.test(words) && /^<a [^>]*class="external"/.test(out[start])) {
					// A link that only moves around the other site: its words go with it.
					out.length = start;
					stack.splice(index, 1);
					linkStarts.pop();
					continue;
				}
				closeTo(index);
				continue;
			}
			if (options.caselaw && classes.includes('page-label')) {
				const label = pageLabel(attributes.get('data-label') ?? '');
				skippingPageLabel++;
				if (!label) continue;
				pages.push(label);
				// Where a printed page turns: the open paragraph closes, the rule follows, and it opens again.
				const reopen = stack.filter((element) => element.kept);
				if (reopen.every((element) => splittable.has(element.name))) {
					for (let index = stack.length - 1; index >= 0; index--) if (stack[index].kept) write(`</${stack[index].name}>`);
					write(pageRule(label));
					let first = true;
					for (const element of stack) {
						if (!element.kept) continue;
						write(first && element.name === 'p' ? element.tag.replace('<p', '<p data-continued') : element.tag);
						first = false;
					}
				} else {
					write(`<span class="page-mark" id="page-${label}">${label}</span>`);
				}
				continue;
			}
			const href = attributes.get('href') ?? '';
			const parts: string[] = [];
			if (href.startsWith('#')) {
				const target = identifier(href.slice(1));
				if (target) parts.push(`href="#text-${target}"`);
			} else if (href) {
				const link = safeLink(href, options.caselaw ? undefined : options.base);
				if (link) {
					parts.push(`href="${escapeAttribute(link.href)}"`);
					if (link.external || attributes.get('target') === '_blank') parts.push('class="external"', 'target="_blank"', 'rel="noopener noreferrer"');
				}
			}
			const id = attributes.get('id') ?? attributes.get('name');
			if (id) parts.unshift(`id="text-${identifier(id)}"`);
			if (classes.includes('footnotemark')) parts.push('data-footnote');
			// A link with nowhere to go keeps its words without one.
			if (!parts.some((part) => part.startsWith('href') || part.startsWith('id'))) {
				open('a', '', false);
				linkStarts.push(out.length - 1);
				continue;
			}
			linkStarts.push(out.length);
			open('a', `<a ${parts.join(' ')}>`);
			continue;
		}
		if (skippingPageLabel > 0) continue;

		if (name === 'br') {
			write('<br>');
			continue;
		}
		if (name === 'hr') {
			closeParagraph();
			write('<hr>');
			continue;
		}
		if (name === 'img') {
			const source = attributes.get('src') ?? '';
			// Only pictures the page carries in itself; nothing is loaded from elsewhere.
			if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(source)) {
				const alt = attributes.get('alt') ?? '';
				write(`<img src="${source.replace(/\s/g, '')}" alt="${escapeAttribute(alt)}">`);
			}
			continue;
		}
		if (/^h[1-6]$/.test(name)) {
			if (closing) {
				const index = openIndex(name);
				if (index >= 0) closeTo(index);
				continue;
			}
			closeParagraph();
			// The card's own heading is a level 2: the page's headings sit below it.
			const level = Math.min(6, Number(name[1]) + 2);
			const parties = options.caselaw && classes.includes('parties') ? ' class="case-head"' : '';
			open(name, `<h${level}${attributes.get('id') ? ` id="text-${identifier(attributes.get('id') ?? '')}"` : ''}${parties}>`, true, `h${level}`);
			continue;
		}
		if (name === 'aside') {
			// A footnote.
			if (closing) {
				const index = openIndex('aside');
				if (index >= 0) closeTo(index);
				continue;
			}
			closeParagraph();
			const id = attributes.get('id');
			open('aside', `<aside class="footnote"${id ? ` id="text-${identifier(id)}"` : ''}>`);
			continue;
		}
		if (name === 'span' || name === 'font') {
			if (closing) {
				const index = openIndex(name);
				if (index >= 0 && stack.slice(index + 1).every((element) => !blockElements.has(element.name))) closeTo(index);
				continue;
			}
			const smallCaps = classes.some((value) => /^(?:sc|smallcaps|small-caps)$/i.test(value)) || /small-caps/i.test(attributes.get('style') ?? '');
			const language = languageOf(attributes);
			open(name, smallCaps || language ? `<span${smallCaps ? ' class="small-caps"' : ''}${language}>` : '', smallCaps || Boolean(language), smallCaps || language ? 'span' : undefined);
			continue;
		}
		if (inlineElements.has(name)) {
			if (closing) {
				const index = openIndex(name);
				if (index >= 0 && stack.slice(index + 1).every((element) => !blockElements.has(element.name))) closeTo(index);
				continue;
			}
			open(name, `<${name}>`);
			continue;
		}
		if (blockElements.has(name) || boundaryElements.has(name)) {
			const kept = blockElements.has(name);
			if (closing) {
				const index = openIndex(name);
				if (index >= 0) closeTo(index);
				else if (name === 'center' || name === 'div') closeParagraph();
				continue;
			}
			if (endsParagraph.has(name)) closeParagraph();
			if (name === 'li') {
				const index = openIndex('li');
				if (index >= 0 && index > Math.max(openIndex('ul'), openIndex('ol'))) closeTo(index);
			}
			if (name === 'tr') {
				const index = openIndex('tr');
				if (index >= 0 && index > openIndex('table')) closeTo(index);
			}
			if (name === 'td' || name === 'th') {
				const index = Math.max(openIndex('td'), openIndex('th'));
				if (index >= 0 && index > openIndex('tr')) closeTo(index);
			}
			let tag = kept ? `<${name}>` : '';
			if (name === 'p') {
				const author = classes.includes('author');
				const centered = (attributes.get('align') ?? '').toLowerCase() === 'center' || stack.some((element) => element.name === 'center');
				const right = (attributes.get('align') ?? '').toLowerCase() === 'right';
				const id = attributes.get('id');
				// The reporter's own lines above an opinion: the date it was decided and the judges sitting.
				const head = options.caselaw && (classes.includes('decisiondate') || classes.includes('judges'));
				const kind = author ? 'opinion-author' : head ? 'case-head' : centered ? 'centered' : right ? 'right' : '';
				tag = `<p${kind ? ` class="${kind}"` : ''}${id && !options.caselaw ? ` id="text-${identifier(id)}"` : ''}${languageOf(attributes)}>`;
			}
			if ((name === 'td' || name === 'th') && /^\d{1,2}$/.test(attributes.get('colspan') ?? '')) tag = `<${name} colspan="${attributes.get('colspan')}">`;
			open(name, tag, kept);
			continue;
		}
		// Anything else is left out, its words kept.
	}
	if (dropped === 0 && skippingPageLabel === 0) write(safeText(html.slice(at)));
	closeTo(0);
	return { html: tidy(out.join('')), pages };
}

/** Empty paragraphs and runs of line breaks gone, and the spaces old pages used to indent. */
function tidy(html: string): string {
	let text = html
		.replace(/ /g, ' ')
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/\s*\n\s*/g, '\n');
	for (let pass = 0; pass < 3; pass++) {
		text = text
			.replace(/(?:<br>\s*){2,}/g, '<br>')
			.replace(/(<(?:p|li|td|th|dd|dt|blockquote|h[3-6]|figcaption|caption)\b[^>]*>)\s*(?:<br>\s*)+/g, '$1')
			.replace(/(?:\s*<br>)+\s*(<\/(?:p|li|td|th|dd|dt|blockquote|h[3-6]|figcaption|caption)>)/g, '$1')
			.replace(/<(p|blockquote|li|h[3-6]|em|i|strong|b|u|small|span|sup|sub)\b[^>]*>\s*<\/\1>/g, '')
			.replace(/<(ul|ol|dl|table|tbody|thead|tr)\b[^>]*>\s*<\/\1>/g, '');
	}
	return text.replace(/^\s*(?:<br>\s*)+/, '').trim();
}

/** The note in a Caselaw Access Project copy's banner: where its text comes from. */
function caselawNote(page: string): string | undefined {
	const header = /<header>([\s\S]*?)<\/header>/.exec(page)?.[1];
	const line = header ? [...header.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]).find((text) => /Caselaw Access Project/.test(text)) : undefined;
	if (!line) return undefined;
	const sentence = decodeEntities(line.replace(/<a\b[\s\S]*?<\/a>\.?/g, '').replace(/<[^>]*>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();
	// The header's own request link is the card's flag button, so a sentence that leads into a link goes.
	const kept = sentence.split(/(?<=[.:])\s+/).filter((part) => !/:$/.test(part)).join(' ');
	return kept.replace(/^The court['’]s opinions?, from/, 'Text from').replace(/, without the publisher['’]s headnotes and synopsis\./, ', with the publisher’s headnotes removed.');
}

/** The part of a saved page that holds its text: its <main> or <article>, else its <body>. */
function mainPart(page: string): string {
	for (const pattern of [/<main\b[^>]*>([\s\S]*)<\/main>/i, /<([a-z]+)\b[^>]*\brole\s*=\s*["']?main["']?[^>]*>([\s\S]*)<\/\1>/i]) {
		const found = pattern.exec(page);
		if (found) return found[found.length - 1];
	}
	const articles = [...page.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)];
	if (articles.length === 1 && articles[0][1].length > page.length / 4) return articles[0][1];
	const body = /<body\b[^>]*>([\s\S]*)(?:<\/body>|$)/i.exec(page);
	return body ? body[1] : page;
}

/** A saved web page's text for the card. `base` is the address it was published at. */
export function readingFromHtml(page: string, base?: string): ReadingText {
	const caselaw = /<article class="opinion"/.test(page);
	if (caselaw) {
		const main = page.includes('<main>') ? page.slice(page.indexOf('<main>') + 6, page.lastIndexOf('</main>')) : mainPart(page);
		const { html, pages } = cleanPageHtml(main, { caselaw: true });
		const found = caselawNote(page);
		// The page rules follow the printed report's own pages.
		const note = found && pages.length > 0 ? `${found} Pages as in the printed report.` : found;
		return { html, ...(note ? { note } : {}), pages, printedLines: false, words: wordCount(html) };
	}
	const { html, pages } = cleanPageHtml(mainPart(page), { base });
	return { html, pages, printedLines: false, words: wordCount(html) };
}

/** A copy's text for the card, by its media type: a transcribed text or a saved web page. `suggest` is where a reader offers a missing drawing. */
export function readingText(body: string, mediaType: string, base?: string, suggest?: string): ReadingText | undefined {
	if (mediaType === 'text/plain') return readingFromPlainText(body, suggest);
	if (mediaType === 'text/html') return readingFromHtml(body, base);
	return undefined;
}

// ---------------------------------------------------------------------------
// Downloads: the reading version as Markdown and as a web page

/** What the downloads say about the text above it. */
export interface ReadingDetails {
	title: string;
	/** The project's citation of the document, as plain text. */
	citation?: string;
	/** Where the original was published. */
	original?: string;
	/** The copy's address on this site. */
	copy: string;
	sha256: string;
	captured?: string;
	note?: string;
}

function inlineMarkdown(html: string, site: string): string {
	return decodeEntities(
		html
			.replace(/<br\b[^>]*>\s*/g, '  \n')
			.replace(/<span class="printed-hyphen">-<\/span>/g, '-')
			.replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, '**$2**')
			.replace(/<(em|i|cite)>([\s\S]*?)<\/\1>/g, '*$2*')
			.replace(/<sup>([\s\S]*?)<\/sup>/g, '^$1^')
			.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_whole, href: string, words: string) => {
				const target = decodeEntities(href);
				const absolute = target.startsWith('/') ? `${site}${target}` : target;
				return `[${words.replace(/<[^>]*>/g, '')}](${absolute})`;
			})
			.replace(/<[^>]*>/g, '')
	)
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.trim();
}

/**
 * The reading version as Markdown: headings, paragraphs, block quotations,
 * lists, page rules, footnotes and links kept, for reuse and comparison.
 */
export function readingMarkdown(reading: ReadingText, details: ReadingDetails, site = 'https://triballawproject.org'): string {
	const lines: string[] = [`# ${details.title}`, ''];
	if (details.citation) lines.push(details.citation, '');
	const about = [
		reading.note ?? details.note,
		details.original ? `Published at ${details.original}.` : '',
		`This reading version is from the copy at ${site}${details.copy}${details.captured ? `, made ${details.captured}` : ''} (SHA-256 ${details.sha256}).`
	].filter(Boolean);
	lines.push(...about.map((line) => `> ${line}`), '');
	const blocks = reading.html.split(/(?=<(?:p|h[3-6]|blockquote|ul|ol|div class="page-rule"|aside|table|hr|pre)\b)/);
	for (const block of blocks) {
		const trimmed = block.trim();
		if (!trimmed) continue;
		const heading = /^<h([3-6])[^>]*>([\s\S]*?)<\/h\1>/.exec(trimmed);
		const rule = /^<div class="page-rule"[^>]*data-page="([^"]+)"/.exec(trimmed);
		if (rule) lines.push(`---`, '', `*Page ${rule[1]}*`, '');
		else if (heading) lines.push(`${'#'.repeat(Number(heading[1]) - 1)} ${inlineMarkdown(heading[2], site)}`, '');
		else if (/^<blockquote/.test(trimmed)) lines.push(...inlineMarkdown(trimmed, site).split('\n').map((line) => `> ${line}`), '');
		else if (/^<(ul|ol)/.test(trimmed)) {
			const ordered = trimmed.startsWith('<ol');
			[...trimmed.matchAll(/<li>([\s\S]*?)(?=<li>|<\/[uo]l>|$)/g)].forEach((item, index) => lines.push(`${ordered ? `${index + 1}.` : '-'} ${inlineMarkdown(item[1], site)}`));
			lines.push('');
		} else if (/^<aside/.test(trimmed)) lines.push(`<small>${inlineMarkdown(trimmed, site).replace(/\n/g, ' ')}</small>`, '');
		else if (/^<hr/.test(trimmed)) lines.push('---', '');
		else if (/^<p class="signature"/.test(trimmed)) lines.push(`<p align="right">${inlineMarkdown(trimmed, site)}</p>`, '');
		else {
			const text = inlineMarkdown(trimmed, site);
			if (text) lines.push(text, '');
		}
	}
	return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** The reading version as a web page of its own, which opens in any browser or in a word processor. */
export function readingHtmlDocument(reading: ReadingText, details: ReadingDetails, site = 'https://triballawproject.org'): string {
	const absolute = reading.html.replace(/href="\/(?!\/)/g, `href="${site}/`).replace(/ target="_blank" rel="noopener noreferrer"/g, '');
	const about = [
		reading.note ?? details.note,
		details.original ? `Published at <a href="${escapeAttribute(details.original)}">${escapeText(details.original)}</a>.` : '',
		`This reading version is from the copy at <a href="${site}${escapeAttribute(details.copy)}">${site}${escapeText(details.copy)}</a>${details.captured ? `, made ${escapeText(details.captured)}` : ''} (SHA-256 ${details.sha256}).`
	]
		.filter(Boolean)
		.map((line) => (line === reading.note || line === details.note ? escapeText(line as string) : line));
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(details.title)}</title>
<style>body{max-width:42rem;margin:2rem auto;padding:0 1rem;font:1.0625rem/1.6 Georgia,'Times New Roman',serif}header{font:0.9375rem/1.5 system-ui,sans-serif;border-bottom:1px solid currentColor;padding-bottom:1rem;margin-bottom:1.5rem}.page-rule{display:flex;align-items:center;gap:.75rem;margin:1.25rem 0;font:600 .75rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em}.page-rule::before,.page-rule::after{content:"";flex:1;border-top:1px dashed currentColor;opacity:.6}.signature{text-align:right}.centered{text-align:center}.right{text-align:right}aside.footnote{font-size:.875em}.small-caps{font-variant:small-caps}blockquote{margin-left:1.5rem}table{border-collapse:collapse}td,th{border:1px solid currentColor;padding:.25rem .5rem}</style>
</head>
<body>
<header>
<h1>${escapeText(details.title)}</h1>
${details.citation ? `<p>${escapeText(details.citation)}</p>\n` : ''}${about.map((line) => `<p>${line}</p>`).join('\n')}
</header>
<main>
${absolute}
</main>
</body>
</html>
`;
}
