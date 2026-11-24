import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { toggleMark } from 'prosemirror-commands';
import { history, undoDepth } from 'prosemirror-history';
import { essaySchema as schema, parseEssay } from '../src/lib/essays/document.ts';
import { agoText, describeChange, nextSteps, type UndoStep } from '../src/lib/essays/undo-steps.ts';

describe('the undo history beside Redo', () => {
	const start = () => EditorState.create({ doc: parseEssay('# Title\n\nFirst words here.\n\nSecond words here.\n'), plugins: [history()] });

	it('names each step from the change it made', () => {
		let state = start();
		const typed = state.tr.insertText('New ', 9 + 1);
		expect(describeChange(typed)).toBe('Typed in Text 1');
		state = state.apply(typed);
		const bold = state.tr.setSelection(TextSelection.create(state.doc, 10, 13));
		state = state.apply(bold);
		let made: ReturnType<EditorState['tr']['addMark']> | null = null;
		toggleMark(schema.marks.strong)(state, (transaction) => (made = transaction));
		expect(describeChange(made!)).toBe('Made words bold in Text 1');
		const deleted = state.tr.delete(state.doc.content.size - 6, state.doc.content.size - 2);
		expect(describeChange(deleted)).toBe('Deleted words in Text 2');
	});

	it('adds a step when the history grows, renews it when the change joins it, and drops undone steps', () => {
		let state = start();
		let steps: UndoStep[] = [];
		const apply = (transaction: ReturnType<EditorState['tr']['insertText']>, now: number) => {
			const before = undoDepth(state);
			state = state.apply(transaction);
			steps = nextSteps(steps, transaction, before, undoDepth(state), now);
		};
		apply(state.tr.insertText('A', 10).setTime(1000), 1000);
		apply(state.tr.insertText('B', 11).setTime(1100), 1100);
		expect(steps).toEqual([{ label: 'Typed in Text 1', at: 1100, depth: 1 }]);
		apply(state.tr.insertText('C', 11).setTime(5000), 5000);
		expect(steps.map((step) => step.depth)).toEqual([2, 1]);
		expect(nextSteps(steps, state.tr, 2, 1)).toEqual([steps[1]]);
	});

	it('says how long ago', () => {
		expect(agoText(0, 30_000)).toBe('now');
		expect(agoText(0, 120_000)).toBe('2 min');
		expect(agoText(0, 2 * 3_600_000)).toBe('2 hr');
	});
});
