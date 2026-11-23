/**
 * Every block of an essay is a component in the editor, so no text sits
 * loose on the page (Trevor, Nov. 22, 2026: "I don't think we should have
 * any "unboxed text". If the text is just raw, we can put it in a raw text
 * box?"). Each top-level block gets a light frame and a label: Text,
 * Section heading, List, Table and the rest. The boxes that already carry a
 * label of their own (a case, law, quotation, analysis or figure) get the
 * frame only. The block the cursor is in is outlined, and its label carries
 * its number among the components of its kind, such as "Text · 13", so a
 * writer or reviewer can name it.
 *
 * The frames are decorations: they change nothing in the essay's text, and
 * readers never see them.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as EditorNode } from 'prosemirror-model';
import { topIndex } from './placement.ts';
import { figureKindLabels, type FigureKind } from './figures.ts';

/** Boxes whose own label already names them (document.ts). */
const labeledBoxes = new Set(['case_block', 'law_block', 'quote_block', 'analysis_block', 'figure_block']);

/** What a top-level block is called in the editor. */
export function componentLabel(node: EditorNode): string {
	switch (node.type.name) {
		case 'paragraph':
			return 'Text';
		case 'heading': {
			const level = Number(node.attrs.level ?? 2);
			return level === 2 ? 'Section heading' : level === 3 ? 'Subsection heading' : 'Heading';
		}
		case 'bullet_list':
			return 'List';
		case 'ordered_list':
			return 'Numbered list';
		case 'table':
			return 'Table';
		case 'blockquote':
			return 'Quote';
		case 'code_block':
			return 'Code';
		case 'case_block':
			return 'Case';
		case 'law_block':
			return 'Law';
		case 'quote_block':
			return 'Quotation';
		case 'analysis_block':
			return 'Analysis';
		case 'figure_block':
			return figureKindLabels[node.attrs.kind as FigureKind] ?? 'Figure';
		default:
			return 'Block';
	}
}

/** One top-level block as a component: its label, its number among those with that label, and where it is. */
export interface Component {
	label: string;
	number: number;
	from: number;
	to: number;
	/** True when the block shows its own label inside (a case, law, quotation, analysis or figure box). */
	labeledInside: boolean;
}

/** The components of an essay, in order. */
export function components(doc: EditorNode): Component[] {
	const counts = new Map<string, number>();
	const found: Component[] = [];
	doc.forEach((node, offset) => {
		const label = componentLabel(node);
		const number = (counts.get(label) ?? 0) + 1;
		counts.set(label, number);
		found.push({ label, number, from: offset, to: offset + node.nodeSize, labeledInside: labeledBoxes.has(node.type.name) });
	});
	return found;
}

function componentDecorations(state: EditorState): DecorationSet {
	const { doc } = state;
	if (doc.childCount === 0) return DecorationSet.empty;
	const current = topIndex(doc, state.selection.from);
	const decorations = components(doc).map((component, index) => {
		const isCurrent = index === current;
		const classes = ['essay-component'];
		if (component.labeledInside) classes.push('essay-component-boxed');
		if (isCurrent) classes.push('is-current');
		const attributes: Record<string, string> = { class: classes.join(' ') };
		if (!component.labeledInside || isCurrent) {
			attributes['data-component'] = isCurrent ? `${component.label} · ${component.number}` : component.label;
		}
		return Decoration.node(component.from, component.to, attributes);
	});
	return DecorationSet.create(doc, decorations);
}

export const componentFramesKey = new PluginKey('component-frames');

/** Frames and labels each block of the essay in the editor. */
export function componentFrames(): Plugin {
	return new Plugin({
		key: componentFramesKey,
		props: { decorations: componentDecorations }
	});
}
