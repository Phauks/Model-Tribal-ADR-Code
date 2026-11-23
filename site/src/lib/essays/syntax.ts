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
 * 2026: cases, laws, quotations and the project's own analysis each get a
 * box):
 *
 *   :::: case <source key>       a court case, headed by its full citation
 *   ::: background ... :::       the law and events behind it
 *   ::: question ... :::         the question the court decided
 *   ::: holding ... :::          what the court held
 *   ::: quotes  ... :::          the court's words
 *   ::: treatment ... :::        how later courts treated it
 *   ::::
 *   :::: law <source key>        an act, statute, regulation or tribal law
 *   ::: summary ... :::          what it does
 *   ::: quotes ... :::           its text
 *   ::: treatment ... :::        amendments, court readings, repeal
 *   ::::
 *   ::: quote ... :::            a quotation; a last paragraph that is only
 *                                a citation, perhaps with a parenthetical
 *                                such as "(Gorsuch, J., dissenting)", is its
 *                                attribution
 *   ::: analysis [title] ... ::: analysis, set apart from what sources say
 *   :::: figure <kind> <address> a picture, video or sound recording
 *                                (figures.ts): kind is picture, video or
 *                                sound; the address is /files/<reference>/
 *                                <name>, or a YouTube link for a video
 *   :::: figure chart            a bar chart drawn from the table inside it
 *   caption paragraphs           what the figure shows
 *   ::: description ... :::      what a picture or video shows, read aloud
 *                                in its place
 *   ::: credit ... :::           who made it
 *   ::: transcript ... :::       what is said in a video or recording
 *   ::::
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
	law: new RegExp(`^law\\s+(${keyPattern})$`),
	background: /^background$/,
	question: /^question$/,
	holding: /^holding$/,
	summary: /^summary$/,
	quotes: /^quotes$/,
	treatment: /^treatment$/,
	topics: /^topics$/,
	quote: /^quote$/,
	analysis: /^analysis(?:\s+(.+))?$/,
	figure: /^figure\s+(?:(picture|video|sound)\s+(\S+)|(chart))$/,
	description: /^description$/,
	credit: /^credit$/,
	transcript: /^transcript$/
} as const;
export type EssayBlock = keyof typeof essayBlocks;

/**
 * The parts of a case or law box, in the order they come, with the label
 * each shows. A case uses background, question, holding, quotes, treatment
 * and topics; a law uses summary, quotes and treatment.
 */
export const boxParts = {
	background: 'Background',
	question: 'Question',
	holding: 'Holding',
	summary: 'What it does',
	quotes: 'Quotes',
	treatment: 'Treatment',
	topics: 'Topics'
} as const;
export type BoxPart = keyof typeof boxParts;
export const casePartOrder: BoxPart[] = ['background', 'question', 'holding', 'quotes', 'treatment', 'topics'];
export const lawPartOrder: BoxPart[] = ['summary', 'quotes', 'treatment'];

/**
 * The topics a case box's Topics part names, separated by semicolons:
 * "Gaming; Sovereign immunity". The index of cases by topic is built from
 * them (case-topics.ts).
 */
export function topicsIn(text: string): string[] {
	return [...new Set(text.split(';').map((topic) => topic.replace(/\s+/g, ' ').trim().replace(/\.$/, '')).filter(Boolean))];
}

/**
 * Whether a paragraph is the attribution of a quotation: only a citation,
 * perhaps followed by an Indigo Book parenthetical for a separate opinion,
 * such as "[@key, p. 17] (Gorsuch, J., dissenting)" (docs/style-guide.md,
 * section 5.1). The older form, "— " before the citation, is still read.
 */
export function isAttribution(paragraph: string): boolean {
	const text = paragraph.trim();
	return /^(—|--)\s/.test(text) || /^\[@[^\]]+\](\s*\([^()]*\))?\.?$/.test(text);
}

/**
 * Whether a quotation leaves out words without saying so, by the rule the
 * print build applies to the Foundations chapters: a quotation that starts
 * with a lowercase letter (or a bracketed lowercase change such as "[w]e")
 * needs a leading "... ", and one that does not end in ".", "?" or "!"
 * (perhaps followed by a closing quotation mark or bracket) needs a trailing
 * " ...". Citations after the quoted words are ignored.
 */
export function missingEllipses(quotation: string): { start: boolean; end: boolean } {
	const text = quotation
		.replace(/\s*\[@[^\]]*\]\s*$/g, '')
		.replace(/^[\s"“‘']+/, '')
		.trim();
	if (!text) return { start: false, end: false };
	const startsCut = /^(\.\.\.|…)/.test(text);
	const start = !startsCut && /^(\[[a-z]|[a-z])/.test(text);
	const end = !/(\.\.\.|…)$/.test(text) && !/[.?!][\]"”’')]*$/.test(text);
	return { start, end };
}

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
			} else if (token.type === 'container_case_open' || token.type === 'container_law_open') {
				const key = (essayBlocks.case.exec(token.info.trim()) ?? essayBlocks.law.exec(token.info.trim()))?.[1];
				if (key) sourceKeys.add(key);
			}
			if (token.children) walk(token.children);
		}
	};
	walk(essayMarkdown({ forEditing: true }).parse(body, {}));
	return { sourceKeys, termIds };
}
