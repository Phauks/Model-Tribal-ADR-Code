/**
 * "With drafts" in the editor (essay-editor-mockups/4 and v2-1): a bar in the
 * margin beside each component that differs from the published text, solid
 * for a changed one and dashed for a new one, as on the reading page's draft
 * view (render.ts). A component in a section someone was asked to review
 * gets a bar too, in the review color, unless it is itself changed or new.
 * The marks are decorations, never part of the text.
 *
 * Each top-level component of the draft is compared with the published
 * ones: the same component is unchanged; one that shares most of its words
 * with a published component not yet matched is changed; any other is new.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as EditorNode } from 'prosemirror-model';
import { essaySections } from './attestations.ts';

export type DraftMark = 'changed' | 'new';

function wordsOf(node: EditorNode): string[] {
	return node.textContent.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** How alike two components' words are, from 0 to 1 (Dice's coefficient on their words). */
function likeness(first: string[], second: string[]): number {
	if (first.length === 0 && second.length === 0) return 1;
	const counts = new Map<string, number>();
	for (const word of first) counts.set(word, (counts.get(word) ?? 0) + 1);
	let shared = 0;
	for (const word of second) {
		const left = counts.get(word) ?? 0;
		if (left > 0) {
			shared += 1;
			counts.set(word, left - 1);
		}
	}
	return (2 * shared) / (first.length + second.length);
}

/** Which of the draft's top-level components changed or are new, by their position in the draft. */
export function draftMarks(draft: EditorNode, published: EditorNode): Map<number, DraftMark> {
	const before: { node: EditorNode; words: string[]; used: boolean }[] = [];
	published.forEach((node) => before.push({ node, words: wordsOf(node), used: false }));
	const marks = new Map<number, DraftMark>();
	const pending: { position: number; node: EditorNode }[] = [];
	// First every component that is exactly as published, so a changed one is not paired with it.
	draft.forEach((node, position) => {
		const same = before.find((candidate) => !candidate.used && candidate.node.eq(node));
		if (same) same.used = true;
		else pending.push({ position, node });
	});
	for (const { position, node } of pending) {
		const words = wordsOf(node);
		let best: (typeof before)[number] | null = null;
		let bestLikeness = 0;
		for (const candidate of before) {
			if (candidate.used || candidate.node.type !== node.type) continue;
			const alike = likeness(words, candidate.words);
			if (alike > bestLikeness) {
				best = candidate;
				bestLikeness = alike;
			}
		}
		if (best && bestLikeness >= 0.5) {
			best.used = true;
			marks.set(position, 'changed');
		} else marks.set(position, 'new');
	}
	return marks;
}

export const draftMarksKey = new PluginKey<DecorationSet>('draft-marks');

/** What the marks are worked out against: the published text, and the sections in review by their heading ids. */
export interface DraftMarksAgainst {
	doc: EditorNode | null;
	version: number | null;
	inReview: Set<string>;
}

function decorate(doc: EditorNode, against: DraftMarksAgainst): DecorationSet {
	const decorations: Decoration[] = [];
	const marks = against.doc ? draftMarks(doc, against.doc) : new Map<number, DraftMark>();
	for (const [position, mark] of marks) {
		const node = doc.nodeAt(position);
		if (!node) continue;
		decorations.push(
			Decoration.node(position, position + node.nodeSize, {
				class: mark === 'changed' ? 'draft-changed' : 'draft-new',
				title: mark === 'changed' ? `Changed since version ${against.version} was published` : `New since version ${against.version} was published`
			})
		);
	}
	if (against.inReview.size > 0) {
		const starts: number[] = [];
		doc.forEach((_node, position) => starts.push(position));
		for (const section of essaySections(doc)) {
			if (!against.inReview.has(section.slug)) continue;
			for (let index = section.index + 1; index < section.end && index < doc.childCount; index += 1) {
				const position = starts[index];
				if (marks.has(position)) continue;
				decorations.push(Decoration.node(position, position + doc.child(index).nodeSize, { class: 'section-in-review' }));
			}
		}
	}
	return DecorationSet.create(doc, decorations);
}

/**
 * The plugin. The marks are worked out again a moment after the text stops
 * changing (`refreshDraftMarks`); in between they follow the text.
 */
export function draftMarksPlugin(against: () => DraftMarksAgainst): Plugin<DecorationSet> {
	return new Plugin<DecorationSet>({
		key: draftMarksKey,
		state: {
			init: (_config, state) => decorate(state.doc, against()),
			apply(transaction, value) {
				if (transaction.getMeta(draftMarksKey)) return decorate(transaction.doc, against());
				return value.map(transaction.mapping, transaction.doc);
			}
		},
		props: {
			decorations: (state) => draftMarksKey.getState(state)
		}
	});
}
