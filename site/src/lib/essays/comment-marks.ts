/**
 * Highlights in the editor on the words each open comment is about
 * (comments.ts). The highlights are decorations, never part of the text.
 * They follow the text as it is edited, and the editor finds the words
 * again (comment-anchors.ts) a moment after each change.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

export interface CommentMark {
	thread: string;
	from: number;
	to: number;
}

interface CommentMarksState {
	set: DecorationSet;
	current: string | null;
}

export const commentMarksKey = new PluginKey<CommentMarksState>('comment-marks');

function decorations(doc: Parameters<typeof DecorationSet.create>[0], marks: CommentMark[], current: string | null): DecorationSet {
	const size = doc.content.size;
	return DecorationSet.create(
		doc,
		marks
			.filter((mark) => mark.from < mark.to && mark.to <= size)
			.map((mark) =>
				Decoration.inline(
					mark.from,
					mark.to,
					{ class: mark.thread === current ? 'comment-mark is-current' : 'comment-mark', 'data-thread': mark.thread },
					{ thread: mark.thread }
				)
			)
	);
}

export function commentMarks(): Plugin<CommentMarksState> {
	return new Plugin<CommentMarksState>({
		key: commentMarksKey,
		state: {
			init: () => ({ set: DecorationSet.empty, current: null }),
			apply(transaction, value) {
				const replaced = transaction.getMeta(commentMarksKey) as { marks: CommentMark[]; current: string | null } | undefined;
				if (replaced) return { set: decorations(transaction.doc, replaced.marks, replaced.current), current: replaced.current };
				return { set: value.set.map(transaction.mapping, transaction.doc), current: value.current };
			}
		},
		props: {
			decorations: (state) => commentMarksKey.getState(state)?.set
		}
	});
}

/** Replaces the highlights. */
export function showCommentMarks(view: EditorView, marks: CommentMark[], current: string | null): void {
	view.dispatch(view.state.tr.setMeta(commentMarksKey, { marks, current }).setMeta('addToHistory', false));
}

/** The thread whose highlight holds a document position, if any. */
export function commentAt(view: EditorView, position: number): string | null {
	const found = commentMarksKey.getState(view.state)?.set.find(position, position);
	return (found?.[0]?.spec as { thread?: string } | undefined)?.thread ?? null;
}
