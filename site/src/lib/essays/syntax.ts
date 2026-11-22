/**
 * The Markdown reader for essays, shared by the website's essay pages (in the
 * Worker), the editor (in the browser) and the tests. It reads the same
 * syntax as the print build's reader (pdf/pipeline/markdown.mjs), markdown-it
 * with the project's own additions:
 *
 *   [@key] and [@key, at 561; @other]   a citation of a source record
 *   [[id]] and [[id|shown text]]        a link to a glossary entry
 *   ++text++                            underline (docs/editing.md)
 *
 * and the essay blocks agreed with the Foundations chapters (Trevor, Nov. 22,
 * 2026: cases, quotations and the project's own analysis each get a box):
 *
 *   :::: case <source key>       a court case, headed by its full citation
 *   ::: quotes  ... :::          the court's words, inside a case
 *   ::: treatment ... :::        how later courts treated it, inside a case
 *   ::::
 *   ::: quote ... :::            a quotation; a last paragraph that starts
 *                                with "— " is its attribution
 *   ::: analysis [title] ... ::: analysis, set apart from what sources say
 *
 * A block that holds another block opens with more colons than the block
 * inside it, because markdown-it-container closes a block at the first bare
 * fence at least as long as its opening.
 */
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import ins from 'markdown-it-ins';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';

export const keyPattern = '[a-z0-9]+(?:-[a-z0-9]+)*';
const citationPattern = new RegExp(
	`^\\[(@${keyPattern}(?:,[^;\\]]*)?(?:;\\s*@${keyPattern}(?:,[^;\\]]*)?)*)\\]`
);
const citationPartPattern = new RegExp(`^@(${keyPattern})(?:,\\s*(.*))?$`);
const termLinkPattern = new RegExp(`^\\[\\[(${keyPattern})(?:\\|([^\\]]+))?\\]\\]`);

/** One source in a citation: its key and, if given, the place in it ("at 561"). */
export interface CitationReference {
	key: string;
	locator?: string;
}

/** The sources a citation's text names, such as "@a, at 5; @b". */
export function citationReferences(inside: string): CitationReference[] {
	return inside.split(/;\s*/).map((part) => {
		const [, key, locator] = citationPartPattern.exec(part.trim()) ?? [];
		return locator?.trim() ? { key, locator: locator.trim() } : { key };
	});
}

function citationRule(state: StateInline, silent: boolean): boolean {
	if (!state.src.startsWith('[@', state.pos)) return false;
	const match = citationPattern.exec(state.src.slice(state.pos));
	if (!match) return false;
	if (!silent) {
		const token = state.push('citation', '', 0);
		token.meta = { text: match[1], references: citationReferences(match[1]) };
	}
	state.pos += match[0].length;
	return true;
}

function termLinkRule(state: StateInline, silent: boolean): boolean {
	if (!state.src.startsWith('[[', state.pos)) return false;
	const match = termLinkPattern.exec(state.src.slice(state.pos));
	if (!match) return false;
	if (!silent) {
		const token = state.push('term_link', '', 0);
		token.meta = { id: match[1], text: match[2] ?? null };
	}
	state.pos += match[0].length;
	return true;
}

/** The kinds of essay block, and the words after the colons that open each. */
export const essayBlocks = {
	case: new RegExp(`^case\\s+(${keyPattern})$`),
	quotes: /^quotes$/,
	treatment: /^treatment$/,
	quote: /^quote$/,
	analysis: /^analysis(?:\s+(.+))?$/
} as const;
export type EssayBlock = keyof typeof essayBlocks;

/**
 * A reader for essays. `forEditing` keeps straight quotes as typed, so the
 * editor never changes the source's quotation marks; the pages turn them
 * curly when they render, as the print build does. The "replacements" rule
 * stays off in both: it turns the subsection label "(c)" into "©" (decision
 * record 0005).
 */
export function essayMarkdown({ forEditing = false }: { forEditing?: boolean } = {}): MarkdownIt {
	const markdown = new MarkdownIt({ html: false, typographer: !forEditing, linkify: false }).use(ins);
	for (const [name, pattern] of Object.entries(essayBlocks)) {
		markdown.use(container, name, { validate: (info: string) => pattern.test(info.trim()) });
	}
	markdown.disable('replacements');
	markdown.inline.ruler.before('link', 'term_link', termLinkRule);
	markdown.inline.ruler.before('link', 'citation', citationRule);
	return markdown;
}

/** An essay file split into its front matter (YAML between "---" lines) and its body. */
export function splitFrontMatter(text: string): { frontMatter: string; body: string } {
	const match = /^---\n([\s\S]*?)\n---\n+/.exec(text);
	return match ? { frontMatter: match[1], body: text.slice(match[0].length) } : { frontMatter: '', body: text };
}

/** Front matter and body joined back into one file. */
export function joinFrontMatter(frontMatter: string, body: string): string {
	const cleanBody = body.replace(/^\n+/, '').replace(/\s*$/, '\n');
	return frontMatter.trim() ? `---\n${frontMatter.trim()}\n---\n\n${cleanBody}` : cleanBody;
}

/** A field in the front matter, read without a YAML library: titles and parts are one line each. */
export function frontMatterField(frontMatter: string, name: string): string | undefined {
	const match = new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(frontMatter);
	if (!match) return undefined;
	const value = match[1].trim();
	if (/^".*"$/.test(value)) {
		try {
			return JSON.parse(value) as string;
		} catch {
			return value.slice(1, -1);
		}
	}
	return value.replace(/^'(.*)'$/, '$1').replaceAll("''", "'");
}

/** Every source key and glossary id an essay uses, to check that each exists before it is saved or published. */
export function referencesIn(body: string): { sourceKeys: Set<string>; termIds: Set<string> } {
	const sourceKeys = new Set<string>();
	const termIds = new Set<string>();
	const walk = (tokens: ReturnType<MarkdownIt['parse']>) => {
		for (const token of tokens) {
			if (token.type === 'citation') {
				for (const reference of token.meta.references as CitationReference[]) sourceKeys.add(reference.key);
			} else if (token.type === 'term_link') {
				termIds.add(token.meta.id as string);
			} else if (token.type === 'container_case_open') {
				const key = essayBlocks.case.exec(token.info.trim())?.[1];
				if (key) sourceKeys.add(key);
			}
			if (token.children) walk(token.children);
		}
	};
	walk(essayMarkdown({ forEditing: true }).parse(body, {}));
	return { sourceKeys, termIds };
}
