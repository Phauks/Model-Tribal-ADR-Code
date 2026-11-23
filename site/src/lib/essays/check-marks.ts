/**
 * Underlines in the editor for what the checks found (EssayChecks.svelte):
 * spelling, grammar, a glossary term not linked, and a phrase that may need
 * a definition. The marks are decorations, not part of the text, and follow
 * the text as it is edited until the next check replaces them.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { CheckIssue } from './checks.ts';

export const checkMarksKey = new PluginKey<DecorationSet>('check-marks');

export function checkMarks(): Plugin<DecorationSet> {
	return new Plugin<DecorationSet>({
		key: checkMarksKey,
		state: {
			init: () => DecorationSet.empty,
			apply(transaction, marks) {
				const replaced = transaction.getMeta(checkMarksKey) as DecorationSet | undefined;
				return replaced ?? marks.map(transaction.mapping, transaction.doc);
			}
		},
		props: {
			decorations: (state) => checkMarksKey.getState(state)
		}
	});
}

/** Replaces the marks with those for `issues`, as of the document they were found in. */
export function showCheckMarks(view: EditorView, issues: CheckIssue[], foundIn: EditorState['doc']): void {
	const size = foundIn.content.size;
	const decorations = issues
		.filter((issue) => issue.from < issue.to && issue.to <= size)
		.map((issue) =>
			Decoration.inline(issue.from, issue.to, {
				class: `check-mark check-${issue.kind}`,
				'data-issue': issue.id,
				title: issue.message
			}, { issue: issue.id })
		);
	// The text changed while the checks ran: wait for the next run, which follows that change.
	if (view.state.doc !== foundIn) return;
	const set = DecorationSet.create(foundIn, decorations);
	view.dispatch(view.state.tr.setMeta(checkMarksKey, set).setMeta('addToHistory', false));
}

/** The issue whose mark holds a document position, if any. */
export function issueAt(view: EditorView, position: number): string | null {
	const set = checkMarksKey.getState(view.state);
	const found = set?.find(position, position);
	return (found?.[0]?.spec as { issue?: string } | undefined)?.issue ?? null;
}
