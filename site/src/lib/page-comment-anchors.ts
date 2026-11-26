/**
 * Finding the words a comment on a page is about (src/lib/components/PageComments.svelte),
 * in the page's own text rather than an editor's document. The page's text
 * is every text node under the page's main element, in order, apart from
 * the comment cards themselves; a comment keeps the words with a little of
 * the text on each side, and is found again by the same rule essays use
 * (src/lib/essays/comment-anchors.ts, bestMatch), so it follows the page as
 * the page changes.
 */
import { bestMatch, quoteIn, type TextQuote } from './essays/comment-anchors.ts';

export interface PageText {
	text: string;
	/** Each text node with the offset in `text` where it starts. */
	nodes: { node: Text; start: number }[];
}

/** The page's text under `root`, leaving out what `skip` matches (such as the comment cards) and scripts and styles. */
export function pageText(root: Element, skip: string): PageText {
	const nodes: PageText['nodes'] = [];
	let text = '';
	const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => (node.parentElement?.closest(`${skip}, script, style, template`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
	});
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const data = (node as Text).data;
		if (!data) continue;
		nodes.push({ node: node as Text, start: text.length });
		text += data;
	}
	return { text, nodes };
}

/** The offsets in the page's text that a selected range covers, or null when it covers none of it. */
export function rangeOffsets(page: PageText, range: Range): { start: number; end: number } | null {
	let start = -1;
	let end = -1;
	for (const { node, start: at } of page.nodes) {
		if (!range.intersectsNode(node)) continue;
		const from = node === range.startContainer ? range.startOffset : 0;
		const to = node === range.endContainer ? range.endOffset : node.data.length;
		if (to <= from) continue;
		if (start === -1) start = at + from;
		end = at + to;
	}
	return start === -1 ? null : { start, end };
}

/** The words a range covers, with the text around them, for a new comment. */
export function quoteOfRange(page: PageText, range: Range): TextQuote | null {
	const offsets = rangeOffsets(page, range);
	return offsets ? quoteIn(page.text, offsets.start, offsets.end) : null;
}

/** A range over the page's text between two offsets. */
export function rangeAt(page: PageText, start: number, end: number): Range | null {
	const first = page.nodes.findLast((each) => each.start <= start);
	const last = page.nodes.findLast((each) => each.start < end);
	if (!first || !last) return null;
	const range = first.node.ownerDocument.createRange();
	range.setStart(first.node, Math.min(start - first.start, first.node.data.length));
	range.setEnd(last.node, Math.min(end - last.start, last.node.data.length));
	return range;
}

/** Where a comment's words are on the page now, as offsets and a range, or null when they are no longer there. */
export function findOnPage(page: PageText, selector: TextQuote): { start: number; range: Range } | null {
	const start = bestMatch(page.text, selector);
	if (start === -1) return null;
	const range = rangeAt(page, start, start + selector.quote.length);
	return range ? { start, range } : null;
}
