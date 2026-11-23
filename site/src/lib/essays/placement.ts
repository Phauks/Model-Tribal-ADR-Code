/**
 * Where new and moved blocks go in the essay editor, so a writer never has to
 * place a block by hand (Trevor, Nov. 22, 2026: "consider that we don't want
 * to force them to manually place things and move them around if we can make
 * it easier").
 *
 * - A new section (a level 2 heading) goes after the section the cursor is
 *   in, with its own first paragraph; a new subsection (level 3) goes after
 *   the subsection the cursor is in, or after the section's opening text
 *   when the cursor is there.
 * - A new box, figure or paragraph goes after the block the cursor is in,
 *   never inside a paragraph, a list or another box; an empty paragraph the
 *   cursor is in is replaced.
 * - Move up and Move down swap the block the cursor is in with the one
 *   before or after it. On a heading they move the whole section or
 *   subsection, past the neighbouring one of the same level.
 *
 * Pure ProseMirror commands, so the tests run them without a browser.
 */
import type { Node as EditorNode, Schema } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState } from 'prosemirror-state';

/** The index of the top-level block that holds a position. */
export function topIndex(doc: EditorNode, position: number): number {
	const resolved = doc.resolve(Math.min(position, doc.content.size));
	if (resolved.depth > 0) return resolved.index(0);
	return Math.min(resolved.index(0), Math.max(0, doc.childCount - 1));
}

/** The document position where top-level block `index` starts (or the end, for index = childCount). */
export function startOf(doc: EditorNode, index: number): number {
	let position = 0;
	for (let child = 0; child < index && child < doc.childCount; child += 1) position += doc.child(child).nodeSize;
	return position;
}

function headingLevel(node: EditorNode): number | null {
	return node.type.name === 'heading' ? Number(node.attrs.level ?? 2) : null;
}

/**
 * The index just past the unit of `level` that holds block `index`: the
 * first later heading of that level or higher (a smaller number), or the end.
 */
export function unitEnd(doc: EditorNode, index: number, level: number): number {
	for (let next = index + 1; next < doc.childCount; next += 1) {
		const found = headingLevel(doc.child(next));
		if (found !== null && found <= level) return next;
	}
	return doc.childCount;
}

/** The blocks a heading heads: itself and everything up to the next heading of its level or higher. */
function unitAt(doc: EditorNode, index: number): { from: number; to: number } {
	const level = headingLevel(doc.child(index));
	return level === null ? { from: index, to: index + 1 } : { from: index, to: unitEnd(doc, index, level) };
}

/** The unit of the same kind just before block `index`: the previous block, or the previous section of the same level. */
function unitBefore(doc: EditorNode, index: number): { from: number; to: number } | null {
	if (index === 0) return null;
	const level = headingLevel(doc.child(index));
	if (level === null) return { from: index - 1, to: index };
	for (let previous = index - 1; previous >= 0; previous -= 1) {
		const found = headingLevel(doc.child(previous));
		if (found !== null && found < level) return null;
		if (found === level) return { from: previous, to: index };
	}
	return null;
}

/** Adds a section (level 2) or subsection (level 3) after the one the cursor is in, and selects its placeholder title. */
export function addSection(schema: Schema, level: 2 | 3, title = level === 2 ? 'New section' : 'New subsection'): Command {
	return (state, dispatch) => {
		const index = topIndex(state.doc, state.selection.from);
		const at = startOf(state.doc, unitEnd(state.doc, index, level));
		if (dispatch) {
			const heading = schema.node('heading', { level }, schema.text(title));
			const transaction = state.tr.insert(at, [heading, schema.node('paragraph')]);
			transaction.setSelection(TextSelection.create(transaction.doc, at + 1, at + 1 + title.length));
			dispatch(transaction.scrollIntoView());
		}
		return true;
	};
}

/**
 * Adds a block after the top-level block the cursor is in, or in place of
 * the empty paragraph the cursor is in. With `selectFirst`, the first words
 * inside the new block are selected so typing replaces them; otherwise the
 * cursor goes to their start.
 */
export function addAfterCurrent(node: EditorNode, selectFirst = true): Command {
	return (state: EditorState, dispatch) => {
		const index = topIndex(state.doc, state.selection.from);
		const current = state.doc.childCount > 0 ? state.doc.child(index) : null;
		const start = startOf(state.doc, index);
		const replacing = current?.type.name === 'paragraph' && current.content.size === 0;
		const at = replacing ? start : start + (current?.nodeSize ?? 0);
		if (dispatch) {
			const transaction = replacing ? state.tr.replaceWith(start, start + current!.nodeSize, node) : state.tr.insert(at, node);
			const inside = TextSelection.findFrom(transaction.doc.resolve(at + 1), 1, true);
			if (inside) {
				transaction.setSelection(selectFirst ? TextSelection.create(transaction.doc, inside.from, inside.$from.end()) : inside);
			}
			dispatch(transaction.scrollIntoView());
		}
		return true;
	};
}

/** Moves the block (or, on a heading, the section) the cursor is in up or down past its neighbour. */
export function moveCurrent(direction: 'up' | 'down'): Command {
	return (state, dispatch) => {
		const { doc, selection } = state;
		if (doc.childCount < 2) return false;
		const index = topIndex(doc, selection.from);
		const unit = unitAt(doc, index);
		const other = direction === 'up' ? unitBefore(doc, unit.from) : unit.to < doc.childCount ? unitAt(doc, unit.to) : null;
		if (!other) return false;
		// A section moves only past a section of the same level, never out of the section that holds it.
		const level = headingLevel(doc.child(unit.from));
		if (direction === 'down' && level !== null && headingLevel(doc.child(other.from)) !== level) return false;
		if (!dispatch) return true;
		const [first, second] = direction === 'up' ? [other, unit] : [unit, other];
		const from = startOf(doc, first.from);
		const middle = startOf(doc, second.from);
		const to = startOf(doc, second.to);
		const firstSlice = doc.slice(from, middle);
		const secondSlice = doc.slice(middle, to);
		const offset = selection.from - startOf(doc, unit.from);
		const transaction = state.tr.replaceWith(from, to, secondSlice.content.append(firstSlice.content));
		const unitStart = direction === 'up' ? from : from + secondSlice.size;
		transaction.setSelection(TextSelection.near(transaction.doc.resolve(Math.min(unitStart + offset, transaction.doc.content.size))));
		dispatch(transaction.scrollIntoView());
		return true;
	};
}
