/**
 * The opinions in a served opinion copy, each as HTML a case's page can show
 * (Trevor, Nov. 27, 2026: readers "should be able to directly read the
 * majority and minority opinions of cases on our website"; design B in
 * design/case-opinion-reader/ in the project files).
 *
 * The copies built from the Caselaw Access Project keep each opinion in an
 * <article class="opinion" data-type="…"> with its writer's line, the
 * report's page numbers ("*536") and footnotes
 * (scripts/caselaw/state_court_opinions.py, opinion_page;
 * scripts/caselaw/case_opinion_texts.py). The case's page shows that text
 * itself, not in a frame, so only a short list of elements and attributes is
 * let through: paragraphs, emphasis, block quotations, footnotes, the
 * citations' links and the pictures the reports hold as data. A page number
 * becomes a small marker, and every id and in-page link is given the
 * opinion's own prefix so two opinions' footnotes never share an address.
 *
 * Plain string work, so the Worker and the tests run it alike.
 */

/** Elements kept as they are, without attributes. */
const plainElements = new Set(['p', 'em', 'i', 'strong', 'b', 'sup', 'sub', 'br', 'blockquote', 'pre', 'small', 'u']);
/** Elements dropped with everything in them. */
const droppedWithContent = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'textarea', 'select', 'button', 'head', 'title']);

const opinionPattern = /<article class="opinion" data-type="([^"]*)">([\s\S]*?)<\/article>/g;

/** What /cases/<key>/opinions.json answers: each opinion's HTML, in the order of the case's Opinions list. */
export interface CaseOpinionTexts {
	opinions: OpinionText[];
}

export interface OpinionText {
	/** The Caselaw Access Project's type: "majority", "concurrence", "dissent" and so on. */
	type: string;
	html: string;
}

function attributesOf(text: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of text.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
		found.set(match[1].toLowerCase(), match[3] ?? match[4] ?? '');
	}
	return found;
}

function escapeAttribute(value: string): string {
	return value.replace(/&(?!(?:#\d+|#x[\da-f]+|[a-z]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** An address a reader may follow: on this site, or https and http elsewhere. */
function safeAddress(address: string): boolean {
	const value = address.trim();
	if (value.startsWith('/')) return !value.startsWith('//') && !value.startsWith('/\\');
	return /^https?:\/\//i.test(value);
}

function safeIdentifier(value: string): string {
	return value.replace(/[^\w-]/g, '');
}

/**
 * One opinion's HTML with only what the page may show. `prefix` is added to
 * every id and in-page link, such as "opinion-2-".
 */
export function cleanOpinionHtml(html: string, prefix: string): string {
	let output = '';
	let at = 0;
	const tags = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
	// Inside a page number's link, its own text ("*536") is left out: the marker shows the number.
	let skippingLink = 0;
	let droppedDepth = 0;
	let droppedName = '';
	const openLinks: boolean[] = [];
	for (const match of html.matchAll(tags)) {
		const between = html.slice(at, match.index);
		at = match.index + match[0].length;
		if (droppedDepth === 0 && skippingLink === 0) output += between.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		if (match[0].startsWith('<!--')) continue;
		const closing = match[1] === '/';
		const name = match[2].toLowerCase();
		const attributes = attributesOf(match[3]);
		if (droppedDepth > 0) {
			if (name === droppedName) droppedDepth += closing ? -1 : match[3].trim().endsWith('/') ? 0 : 1;
			continue;
		}
		if (droppedWithContent.has(name)) {
			if (!closing) {
				droppedDepth = 1;
				droppedName = name;
			}
			continue;
		}
		if (name === 'a') {
			if (closing) {
				if (skippingLink > 0) skippingLink--;
				else if (openLinks.pop()) output += '</a>';
				continue;
			}
			const className = attributes.get('class') ?? '';
			if (className.split(/\s+/).includes('page-label')) {
				const page = (attributes.get('data-label') ?? '').replace(/[^\w.-]/g, '');
				if (page) output += `<span class="page-mark" aria-label="page ${page}">${page}</span>`;
				skippingLink++;
				continue;
			}
			const href = attributes.get('href') ?? '';
			const kept: string[] = [];
			if (href.startsWith('#')) {
				kept.push(`href="#${prefix}${safeIdentifier(href.slice(1))}"`);
			} else if (href && safeAddress(href)) {
				kept.push(`href="${escapeAttribute(href)}"`);
				if (attributes.get('target') === '_blank') kept.push('target="_blank"', 'rel="noopener noreferrer"');
			}
			const id = attributes.get('id');
			if (id) kept.push(`id="${prefix}${safeIdentifier(id)}"`);
			const classes = className.split(/\s+/).filter((name) => name === 'external' || name === 'footnotemark');
			if (classes.length) kept.push(`class="${classes.join(' ')}"`);
			const title = attributes.get('title');
			if (title && kept.some((attribute) => attribute.startsWith('target'))) kept.push(`title="${escapeAttribute(title)}"`);
			output += `<a${kept.length ? ' ' + kept.join(' ') : ''}>`;
			openLinks.push(true);
			continue;
		}
		if (skippingLink > 0) continue;
		if (name === 'aside') {
			if (closing) {
				output += '</aside>';
				continue;
			}
			const id = attributes.get('id');
			output += `<aside class="footnote"${id ? ` id="${prefix}${safeIdentifier(id)}"` : ''}>`;
			continue;
		}
		if (name === 'img') {
			if (closing) continue;
			const source = attributes.get('src') ?? '';
			if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(source)) continue;
			const size = ['width', 'height']
				.map((dimension) => [dimension, attributes.get(dimension)] as const)
				.filter(([, value]) => value && /^\d{1,5}$/.test(value))
				.map(([dimension, value]) => ` ${dimension}="${value}"`)
				.join('');
			output += `<img src="${source.replace(/\s/g, '')}" alt=""${size}>`;
			continue;
		}
		if (name === 'p' && !closing) {
			const className = attributes.get('class') ?? '';
			output += className.split(/\s+/).includes('author') ? '<p class="opinion-author">' : '<p>';
			continue;
		}
		if (plainElements.has(name)) {
			output += closing ? `</${name}>` : name === 'br' ? '<br>' : `<${name}>`;
		}
		// Anything else (sections, headings, spans, divs) is left out, its text kept.
	}
	if (droppedDepth === 0 && skippingLink === 0) output += html.slice(at).replace(/</g, '&lt;').replace(/>/g, '&gt;');
	for (const open of openLinks) if (open) output += '</a>';
	return output.replace(/\n\s*\n+/g, '\n').trim();
}

/** The opinions in a served copy, in order, each cleaned for the case's page. */
export function opinionTexts(page: string): OpinionText[] {
	const main = page.includes('<main>') ? page.slice(page.indexOf('<main>'), page.lastIndexOf('</main>') + 7) : page;
	return [...main.matchAll(opinionPattern)].map((match, index) => ({
		type: match[1],
		html: joinWriterLine(cleanOpinionHtml(match[2], `opinion-${index + 1}-`))
	}));
}

/**
 * The writer's line and the words that finish its sentence, which the
 * reports print as two paragraphs ("Mr. Chief Justice Marshall" /
 * "delivered the opinion of the Court."), read as one line, as in the
 * approved design.
 */
function joinWriterLine(html: string): string {
	return html.replace(/<p class="opinion-author">([\s\S]*?)<\/p>\s*<p>(\s*[a-z][\s\S]*?)<\/p>/, (whole, writer: string, rest: string) =>
		/<p[\s>]/.test(rest) ? whole : `<p><span class="opinion-author">${writer.trim()}</span> ${rest.trim()}</p>`
	);
}
