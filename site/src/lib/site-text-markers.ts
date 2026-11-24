/**
 * Finds the fixed text in a Svelte page or component, names each piece, and
 * marks where it shows, so the site's own wording can be edited from the
 * website (docs/site-text.md). The build runs this on every component in
 * src/ before Svelte compiles it (vite.config.ts, siteText).
 *
 * - A piece of fixed text between tags becomes
 *   `<site-text data-text="name">words</site-text>`. The global style sheet
 *   gives site-text `display: contents`, so the page looks the same.
 * - Where an element cannot hold another (title, option, textarea), the
 *   element itself gets `data-text="name"`.
 * - A fixed aria-label, title, placeholder or alt gets
 *   `data-text-attributes="aria-label:name"` on its element.
 * - When the words have a published edit, the edit replaces them, so the
 *   built page carries it. The words in the code stay the built-in default.
 *
 * Text inside program code (a `{...}` expression) is not seen here; a later
 * stage wraps it by hand (docs/site-text.md, "Stages").
 */
import MagicString from 'magic-string';
import { parse } from 'svelte/compiler';

/** One piece of fixed text, for the catalog the workspace lists. */
export interface SiteTextEntry {
	key: string;
	/** The file, relative to site/, such as src/routes/sponsor/+page.svelte. */
	file: string;
	/** 1-based line in the file. */
	line: number;
	/** The built-in words, with runs of white space made single spaces. */
	words: string;
	/** For a label in an attribute: its name, such as aria-label. */
	attribute?: string;
}

export const editableAttributes = ['aria-label', 'title', 'placeholder', 'alt'] as const;

/** Elements whose text is never marked: code, and what is not shown as text. */
/** Files left as they are: the editor's own box, so its buttons are not marked as text to edit. */
export const unmarkedFiles = new Set(['src/lib/components/SiteTextEditor.svelte']);

const skippedElements = new Set(['script', 'style', 'pre', 'code', 'kbd', 'samp', 'noscript', 'template', 'textarea']);
/** Elements that cannot hold another element; they carry the name themselves. */
const textOnlyElements = new Set(['title', 'option']);

const letter = /\p{L}/u;

/** Runs of white space as single spaces, trimmed. */
export function normalizeWords(words: string): string {
	return words.replace(/\s+/g, ' ').trim();
}

/**
 * A short, stable name made from the file, the kind of text and the words
 * (cyrb53, a small 53-bit string hash, written in base 36). The same words
 * in the same file and place keep the same name from build to build.
 */
export function siteTextKey(file: string, words: string, attribute = '', occurrence = 1): string {
	const input = `${file}\n${attribute}\n${words}\n${occurrence}`;
	let first = 0xdeadbeef;
	let second = 0x41c6ce57;
	for (let index = 0; index < input.length; index++) {
		const code = input.charCodeAt(index);
		first = Math.imul(first ^ code, 2654435761);
		second = Math.imul(second ^ code, 1597334677);
	}
	first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
	second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
	const value = 4294967296 * (2097151 & second) + (first >>> 0);
	return value.toString(36).padStart(11, '0').slice(-10);
}

/** Words written into Svelte markup between tags: nothing in them may read as a tag, an expression or an entity. */
export function escapeMarkupText(words: string): string {
	return words.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

/** Words written into a quoted Svelte attribute. */
export function escapeAttributeText(words: string): string {
	return escapeMarkupText(words).replace(/"/g, '&quot;');
}

interface Context {
	/** Inside svg, code or another element whose text is left alone. */
	skipped: boolean;
}

// The Svelte syntax tree, only as far as this file reads it.
interface SyntaxNode {
	type: string;
	start: number;
	end: number;
	name?: string;
	data?: string;
	raw?: string;
	attributes?: SyntaxNode[];
	value?: true | SyntaxNode | SyntaxNode[];
	fragment?: { nodes: SyntaxNode[] };
	[key: string]: unknown;
}

const elementTypes = new Set(['RegularElement', 'TitleElement', 'SlotElement']);

/** A title or option: it cannot hold another element, so it carries the name itself. */
function holdsOnlyText(node: SyntaxNode): boolean {
	return elementTypes.has(node.type) && textOnlyElements.has((node.name ?? '').toLowerCase());
}

function childFragments(node: SyntaxNode): { nodes: SyntaxNode[] }[] {
	const fragments: { nodes: SyntaxNode[] }[] = [];
	for (const [name, value] of Object.entries(node)) {
		if (name === 'attributes' || name === 'metadata') continue;
		if (value && typeof value === 'object' && (value as { type?: string }).type === 'Fragment') {
			fragments.push(value as { nodes: SyntaxNode[] });
		}
	}
	return fragments;
}

function lineOf(source: string, position: number): number {
	let line = 1;
	for (let index = 0; index < position; index++) if (source.charCodeAt(index) === 10) line++;
	return line;
}

/**
 * Marks one component's fixed text. `published` maps a name to its published
 * words. Returns the changed source and every piece of text found, in order.
 */
export function markSiteText(
	source: string,
	file: string,
	published: ReadonlyMap<string, string> = new Map()
): { code: string; map?: ReturnType<MagicString['generateMap']>; entries: SiteTextEntry[] } {
	if (unmarkedFiles.has(file)) return { code: source, entries: [] };
	const root = parse(source, { modern: true }) as unknown as { fragment: { nodes: SyntaxNode[] } };
	const output = new MagicString(source);
	const entries: SiteTextEntry[] = [];
	const seen = new Map<string, number>();

	const name = (words: string, attribute = '') => {
		const counted = `${attribute}\n${words}`;
		const occurrence = (seen.get(counted) ?? 0) + 1;
		seen.set(counted, occurrence);
		return siteTextKey(file, words, attribute, occurrence);
	};

	const markAttributes = (element: SyntaxNode) => {
		const marks: string[] = [];
		for (const attribute of element.attributes ?? []) {
			if (attribute.type !== 'Attribute' || !attribute.name) continue;
			if (!(editableAttributes as readonly string[]).includes(attribute.name)) continue;
			const value = attribute.value;
			if (!Array.isArray(value) || value.length !== 1 || value[0].type !== 'Text') continue;
			const text = value[0];
			const words = normalizeWords(text.data ?? '');
			if (!letter.test(words)) continue;
			const key = name(words, attribute.name);
			entries.push({ key, file, line: lineOf(source, text.start), words, attribute: attribute.name });
			marks.push(`${attribute.name}:${key}`);
			const edit = published.get(key);
			if (edit !== undefined) {
				const quoted = source[text.start - 1] === '"' || source[text.start - 1] === "'";
				const escaped = escapeAttributeText(edit);
				if (quoted && source[text.start - 1] === '"') output.overwrite(text.start, text.end, escaped);
				else if (quoted) output.overwrite(text.start - 1, text.end + 1, `"${escaped}"`);
				else output.overwrite(text.start, text.end, `"${escaped}"`);
			}
		}
		if (marks.length > 0) {
			const after = element.start + 1 + (element.name ?? '').length;
			output.appendLeft(after, ` data-text-attributes="${marks.join(' ')}"`);
		}
	};

	const markText = (text: SyntaxNode, parent: SyntaxNode | undefined) => {
		const raw = source.slice(text.start, text.end);
		const words = normalizeWords(text.data ?? '');
		if (!letter.test(words)) return;
		const key = name(words);
		entries.push({ key, file, line: lineOf(source, text.start + (raw.length - raw.trimStart().length)), words });
		const leading = raw.length - raw.trimStart().length;
		const trailing = raw.length - raw.trimEnd().length;
		const innerStart = text.start + leading;
		const innerEnd = text.end - trailing;
		const edit = published.get(key);
		if (edit !== undefined) output.overwrite(innerStart, innerEnd, escapeMarkupText(edit));
		if (parent && holdsOnlyText(parent)) {
			// Svelte allows no attribute on a page's <title>: its words are
			// edited from the workspace list only.
			if (parent.type !== 'TitleElement') output.appendLeft(parent.start + 1 + (parent.name ?? '').length, ` data-text="${key}"`);
			return;
		}
		output.appendLeft(innerStart, `<site-text data-text="${key}">`);
		output.prependRight(innerEnd, '</site-text>');
	};

	const walk = (nodes: SyntaxNode[], parent: SyntaxNode | undefined, context: Context) => {
		for (const node of nodes) {
			if (node.type === 'Text') {
				if (context.skipped) continue;
				if (parent && holdsOnlyText(parent)) {
					// Only an element holding nothing but this text can carry its name.
					const others = (parent.fragment?.nodes ?? []).filter((other) => other !== node && !(other.type === 'Text' && !(other.data ?? '').trim()));
					if (others.length > 0) continue;
				}
				markText(node, parent);
				continue;
			}
			let inner = context;
			if (elementTypes.has(node.type)) {
				const tag = (node.name ?? '').toLowerCase();
				const outside = context.skipped || tag === 'svg';
				if (!outside && node.type === 'RegularElement') markAttributes(node);
				inner = { skipped: outside || skippedElements.has(tag) };
			}
			for (const fragment of childFragments(node)) walk(fragment.nodes, node, inner);
		}
	};

	walk(root.fragment.nodes, undefined, { skipped: false });
	if (entries.length === 0) return { code: source, entries };
	return { code: output.toString(), map: output.generateMap({ hires: true, source: file, includeContent: true }), entries };
}
