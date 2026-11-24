/**
 * The editor's checks that need no server (Trevor, 2026-11-22): the essay's
 * text block by block with each character's place in the document, the
 * definitions check (a word or phrase that has a glossary entry but is not
 * linked to it, and a phrase used so often it may need one), and the places
 * "Go to" can reach by component, word or character. Spelling and grammar
 * come from Harper (src/lib/essays/harper.ts) on the same text.
 *
 * Pure functions over a ProseMirror document, so they run in tests too.
 */
import type { Node as EditorNode } from 'prosemirror-model';
import { figureKindLabels, type FigureKind } from './figures.ts';

/** One text block (a paragraph, heading, list item's paragraph, cell, ...) as words, and where each character sits in the document. */
export interface TextBlock {
	text: string;
	/** Document position of the block's first character. */
	from: number;
	/** The document position of each character of `text`, and one more for its end. */
	positions: number[];
	/** The block's node type, such as "paragraph" or "heading". */
	type: string;
}

/** The document position of a place in a block's text. */
export function at(block: TextBlock, index: number): number {
	return block.positions[Math.max(0, Math.min(index, block.positions.length - 1))];
}

/**
 * The text of every text block, as a reader sees it: a glossary link by its
 * shown words, a line break as a space, and a citation left out (with the
 * space before it, so "case [@key]." reads "case."). Each character keeps its
 * document position, so what a check finds maps back to the text.
 */
export function textBlocks(doc: EditorNode): TextBlock[] {
	const blocks: TextBlock[] = [];
	doc.descendants((node, position) => {
		if (!node.isTextblock) return true;
		let text = '';
		const positions: number[] = [];
		node.forEach((child, offset) => {
			const start = position + 1 + offset;
			if (child.isText) {
				const childText = child.text ?? '';
				for (let index = 0; index < childText.length; index += 1) positions.push(start + index);
				text += childText;
			} else if (child.type.name === 'term_link') {
				const shown = String(child.attrs.text ?? child.attrs.id ?? '');
				for (let index = 0; index < shown.length; index += 1) positions.push(start);
				text += shown;
			} else if (child.type.name === 'citation') {
				if (text.endsWith(' ')) {
					text = text.slice(0, -1);
					positions.pop();
				}
			} else {
				positions.push(start);
				text += ' ';
			}
		});
		positions.push(position + node.nodeSize - 1);
		blocks.push({ text, from: position + 1, positions, type: node.type.name });
		return false;
	});
	return blocks;
}

export type CheckKind = 'spelling' | 'grammar' | 'definition' | 'repeated';

export interface CheckIssue {
	/** Stable enough to keep a chosen issue across runs: kind, problem text and place. */
	id: string;
	kind: CheckKind;
	from: number;
	to: number;
	/** The words the issue is about. */
	problem: string;
	message: string;
	/** Replacement texts, for spelling and grammar. */
	suggestions: string[];
	/** For a definition issue: the glossary entry to link. */
	termIdentifier?: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for a glossary term in running text: whole words, any case, an optional plural "s". */
function termPattern(term: string): RegExp {
	const words = term
		.trim()
		.split(/\s+/)
		.map((word) => escapeRegExp(word));
	return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${words.join('\\s+')}(?:s|es)?(?![\\p{L}\\p{M}\\p{N}])`, 'iu');
}

/**
 * Glossary terms the essay uses in words but never links. One issue per
 * term, at its first use, since a term needs its link only once.
 */
export function definitionIssues(blocks: TextBlock[], terms: [string, string][], linked: Set<string>): CheckIssue[] {
	const issues: CheckIssue[] = [];
	for (const [id, term] of terms) {
		if (linked.has(id) || term.trim().length < 3) continue;
		const pattern = termPattern(term);
		for (const block of blocks) {
			if (block.type === 'heading') continue;
			const match = pattern.exec(block.text);
			if (!match) continue;
			issues.push({
				id: `definition:${id}`,
				kind: 'definition',
				from: at(block, match.index),
				to: at(block, match.index + match[0].length),
				problem: match[0],
				message: `“${term}” has a glossary entry. Link the first use so readers can open the definition.`,
				suggestions: [],
				termIdentifier: id
			});
			break;
		}
	}
	return issues.sort((first, second) => first.from - second.from);
}

/** Words that do not begin or end a term worth defining. */
const stopWords = new Set(
	(
		'a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its ' +
		'may might more most must no not of on or our over she should so such than that the their them then there these they ' +
		'this those to under up upon was we were what when where which while who whom why will with within without would you ' +
		'also any each other same some only both all one two three first second new own very just its after before between'
	).split(' ')
);

/**
 * Phrases of two to four words the essay uses at least `minimum` times that
 * have no glossary entry: candidates for a definition. Only the longest
 * phrase of a family is kept ("Indian Child Welfare Act", not also "Child
 * Welfare"), and phrases that begin or end with a small word are skipped.
 */
export function repeatedPhrases(blocks: TextBlock[], terms: [string, string][], minimum = 4, most = 15): CheckIssue[] {
	const defined = new Set(terms.map(([, term]) => term.toLowerCase()));
	const counts = new Map<string, { count: number; from: number; to: number; text: string }>();
	for (const block of blocks) {
		if (block.type === 'heading') continue;
		const words = [...block.text.matchAll(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu)];
		for (let start = 0; start < words.length; start += 1) {
			for (let length = 2; length <= 4 && start + length <= words.length; length += 1) {
				const span = words.slice(start, start + length);
				const first = span[0][0].toLowerCase();
				const last = span[length - 1][0].toLowerCase();
				if (stopWords.has(first) || stopWords.has(last)) continue;
				// Words must be next to each other: no sentence break or citation between them.
				const between = block.text.slice(span[0].index, span[length - 1].index! + span[length - 1][0].length);
				if (/[.;:!?()[\]"“”]/.test(between)) continue;
				const key = span.map((word) => word[0].toLowerCase()).join(' ');
				const found = counts.get(key);
				if (found) found.count += 1;
				else counts.set(key, { count: 1, from: at(block, span[0].index!), to: at(block, span[0].index! + between.length), text: between });
			}
		}
	}
	const frequent = [...counts.entries()].filter(([, value]) => value.count >= minimum);
	// Keep the longest: drop a phrase inside a longer one used as often, then
	// whatever is a glossary term or part of one.
	const kept = frequent.filter(
		([key, value]) =>
			!frequent.some(([other, otherValue]) => other !== key && other.includes(key) && otherValue.count >= value.count) &&
			![...defined].some((term) => term.includes(key))
	);
	return kept
		.sort((first, second) => second[1].count - first[1].count || first[1].from - second[1].from)
		.slice(0, most)
		.map(([key, value]) => ({
			id: `repeated:${key}`,
			kind: 'repeated' as const,
			from: value.from,
			to: value.to,
			problem: value.text,
			message: `Used ${value.count} times and not in the glossary. If it is a term of art, it may need a definition.`,
			suggestions: []
		}));
}

/* Go to ------------------------------------------------------------------- */

export interface Component {
	label: string;
	/** Position just inside the component, where the cursor goes. */
	position: number;
	depth: number;
}

const componentLabels: Record<string, string> = {
	case_block: 'Case',
	law_block: 'Law',
	quote_block: 'Quotation box',
	analysis_block: 'Analysis',
	blockquote: 'Quoted passage',
	table: 'Table',
	bullet_list: 'Bulleted list',
	ordered_list: 'Numbered list'
};

/** A block's words for a label: glossary links by their shown words, citations left out. */
function wordsOf(node: EditorNode): string {
	return node.textBetween(0, node.content.size, ' ', (leaf) => (leaf.type.name === 'term_link' ? String(leaf.attrs.text ?? leaf.attrs.id) : ''));
}

function preview(text: string, words = 8): string {
	const parts = text.trim().split(/\s+/);
	return parts.length > words ? `${parts.slice(0, words).join(' ')}…` : parts.join(' ');
}

/** The essay's components in order (its top-level blocks: headings, boxes, lists, tables and paragraphs), for "Go to". */
export function components(doc: EditorNode): Component[] {
	const found: Component[] = [];
	let paragraph = 0;
	doc.forEach((node, offset) => {
		const position = offset + 1;
		if (node.type.name === 'heading') {
			found.push({ label: wordsOf(node) || 'Heading', position, depth: Math.max(0, Number(node.attrs.level ?? 2) - 2) });
		} else if (node.type.name === 'paragraph') {
			paragraph += 1;
			found.push({ label: `Paragraph ${paragraph}: ${preview(wordsOf(node))}`, position, depth: 1 });
		} else if (node.type.name === 'figure_block') {
			// A figure by its kind and the start of its caption, its first paragraph.
			const label = figureKindLabels[node.attrs.kind as FigureKind] ?? 'Figure';
			const caption = node.firstChild?.type.name === 'paragraph' ? preview(wordsOf(node.firstChild), 6) : '';
			found.push({ label: caption ? `${label}: ${caption}` : label, position, depth: 1 });
		} else {
			const label = componentLabels[node.type.name] ?? 'Block';
			const detail = node.attrs.source || node.attrs.title || preview(wordsOf(node), 6);
			found.push({ label: detail ? `${label}: ${detail}` : label, position, depth: 1 });
		}
	});
	return found;
}

/** How many words and characters the essay has, counting its text blocks. */
export function counts(blocks: TextBlock[]): { words: number; characters: number } {
	let words = 0;
	let characters = 0;
	for (const block of blocks) {
		words += block.text.match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)?.length ?? 0;
		characters += block.text.length;
	}
	return { words, characters };
}

/** The document position of the start of word number `wanted` (from 1). */
export function wordPosition(blocks: TextBlock[], wanted: number): number | null {
	let seen = 0;
	for (const block of blocks) {
		for (const match of block.text.matchAll(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)) {
			seen += 1;
			if (seen === wanted) return at(block, match.index!);
		}
	}
	return null;
}

/** The document position of character number `wanted` (from 1). */
export function characterPosition(blocks: TextBlock[], wanted: number): number | null {
	let seen = 0;
	for (const block of blocks) {
		if (seen + block.text.length >= wanted) return at(block, Math.max(0, wanted - seen - 1));
		seen += block.text.length;
	}
	return null;
}
