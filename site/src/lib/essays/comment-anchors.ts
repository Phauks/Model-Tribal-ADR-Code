/**
 * Finding the words a comment is about as the text changes (comments.ts).
 * A comment keeps the words selected and a little of the text on each side,
 * the W3C Web Annotation "text quote" selector. To find them again, the
 * editor looks for every place the words appear and takes the one whose
 * surrounding text matches best. When the words themselves were changed,
 * the comment is shown apart from the text, with the words it was about.
 */
import type { Node as EditorNode } from 'prosemirror-model';

/** How much text on each side of the words a comment keeps. */
export const contextLength = 32;

export interface TextQuote {
	quote: string;
	prefix: string;
	suffix: string;
}

/** The document's text, with each character's position, blocks apart by a line break. */
interface FlatText {
	text: string;
	/** positions[i] is the document position of text[i]; a line break gets the position after its block. */
	positions: number[];
}

function flatten(doc: EditorNode): FlatText {
	let text = '';
	const positions: number[] = [];
	let lastBlockEnd = -1;
	doc.descendants((node, position) => {
		if (node.isTextblock) {
			if (text.length > 0) {
				text += '\n';
				positions.push(lastBlockEnd);
			}
			lastBlockEnd = position + node.nodeSize - 1;
			return true;
		}
		if (node.isText && node.text) {
			for (let offset = 0; offset < node.text.length; offset += 1) positions.push(position + offset);
			text += node.text;
		}
		return true;
	});
	return { text, positions };
}

/** The offset in the flat text of the first character at or after a document position. */
function offsetAt(flat: FlatText, position: number): number {
	let low = 0;
	let high = flat.positions.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (flat.positions[middle] < position) low = middle + 1;
		else high = middle;
	}
	return low;
}

/** The words between two positions, with the text around them, for a new comment. */
export function quoteAt(doc: EditorNode, from: number, to: number): TextQuote | null {
	const flat = flatten(doc);
	const start = offsetAt(flat, from);
	const end = offsetAt(flat, to);
	const quote = flat.text.slice(start, end).trim();
	if (!quote) return null;
	const leading = flat.text.slice(start, end).length - flat.text.slice(start, end).trimStart().length;
	const quoteStart = start + leading;
	const quoteEnd = quoteStart + quote.length;
	return {
		quote,
		prefix: flat.text.slice(Math.max(0, quoteStart - contextLength), quoteStart),
		suffix: flat.text.slice(quoteEnd, quoteEnd + contextLength)
	};
}

/** How many characters two strings share, counting from their ends toward each other (prefix) or starts (suffix). */
function sharedEnd(first: string, second: string): number {
	let count = 0;
	while (count < first.length && count < second.length && first[first.length - 1 - count] === second[second.length - 1 - count]) count += 1;
	return count;
}

function sharedStart(first: string, second: string): number {
	let count = 0;
	while (count < first.length && count < second.length && first[count] === second[count]) count += 1;
	return count;
}

/** Where a comment's words are now, or null when they are no longer in the text. */
export function findQuote(doc: EditorNode, selector: TextQuote): { from: number; to: number } | null {
	if (!selector.quote) return null;
	const flat = flatten(doc);
	let best = -1;
	let bestScore = -1;
	for (let found = flat.text.indexOf(selector.quote); found !== -1; found = flat.text.indexOf(selector.quote, found + 1)) {
		const before = flat.text.slice(Math.max(0, found - contextLength), found);
		const after = flat.text.slice(found + selector.quote.length, found + selector.quote.length + contextLength);
		const score = sharedEnd(before, selector.prefix) + sharedStart(after, selector.suffix);
		if (score > bestScore) {
			best = found;
			bestScore = score;
		}
	}
	if (best === -1) return null;
	const last = best + selector.quote.length - 1;
	return { from: flat.positions[best], to: flat.positions[last] + 1 };
}
