/**
 * A case or law box in the editor whose parts are kept on the source's
 * record (record-boxes.ts). The essay holds only the box's place, ":::: case
 * <key>" then "::::", so the editor has no text of the box's own to edit:
 * it shows the box read-only, exactly as the essay page shows it, from the
 * page's own rendering of the essay (the preview, render.ts), so the
 * citation, the facts, the parts and the citation numbers all match what
 * readers see. Changing the parts means changing the case's record, which
 * every essay, the case's page and the book share.
 *
 * A box written out in full, as essays had them before the parts moved to
 * the records, is still edited in place, as before.
 */
import { DOMSerializer, type Node as EditorNode } from 'prosemirror-model';
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view';

export type BoxKind = 'case' | 'law';

/** One box as the essay page shows it: its kind, its source key and the HTML inside its frame. */
export interface ShownBox {
	kind: BoxKind;
	key: string;
	html: string;
}

const boxTypes: Record<string, BoxKind> = { case_block: 'case', law_block: 'law' };

/** Whether a node is a case or law box that leaves its parts to the record: nothing written inside it. */
export function isRecordBox(node: EditorNode | null | undefined): boolean {
	return Boolean(node && node.type.name in boxTypes && node.childCount === 0);
}

/** A case or law box as render.ts writes it; its parts are blocks of their own, never sections, so the first close ends it. */
const boxSection = /<section class="essay-case( essay-law)?"[^>]*? data-source="([a-z0-9-]*)">\n?([\s\S]*?)<\/section>/g;

/**
 * The case and law boxes of an essay page's HTML (render.ts), in order: each
 * box's kind, its source key and what is inside its frame.
 */
export function shownBoxes(html: string): ShownBox[] {
	return [...html.matchAll(boxSection)].map((match) => ({ kind: match[1] ? 'law' : 'case', key: match[2], html: match[3] }));
}

/** Which of a key's boxes this is, counting from 0, when an essay places the same case twice. */
function occurrence(doc: EditorNode, position: number, node: EditorNode): number {
	let count = 0;
	doc.nodesBetween(0, position, (other, at) => {
		if (at < position && other.type === node.type && other.attrs.source === node.attrs.source) count += 1;
		return at < position;
	});
	return count;
}

/** Keeps the essay page's rendering of each box and the read-only boxes on screen that show it. */
export class RecordBoxes {
	private shown = new Map<string, string[]>();
	private views = new Set<RecordBoxView>();

	constructor(private readonly citation: (key: string) => string | undefined) {}

	/** Takes a new rendering of the essay's boxes and redraws every read-only box from it. */
	update(boxes: ShownBox[]): void {
		this.shown = new Map();
		for (const box of boxes) {
			const name = `${box.kind}:${box.key}`;
			this.shown.set(name, [...(this.shown.get(name) ?? []), box.html]);
		}
		for (const view of this.views) view.draw();
	}

	/** Redraws the boxes still waiting for the rendering, such as once the citations are in. */
	refresh(): void {
		for (const view of this.views) view.draw();
	}

	/** The HTML inside the frame of a key's nth box, once the essay has been rendered. */
	html(kind: BoxKind, key: string, index: number): string | undefined {
		return this.shown.get(`${kind}:${key}`)?.[index];
	}

	/** The box's citation as plain text, shown while the rendering is on its way. */
	citationOf(key: string): string | undefined {
		return this.citation(key);
	}

	add(view: RecordBoxView): void {
		this.views.add(view);
	}

	remove(view: RecordBoxView): void {
		this.views.delete(view);
	}

	/** The node views for case and law boxes. */
	nodeViews(): Record<string, NodeViewConstructor> {
		const make: NodeViewConstructor = (node, view, getPos) =>
			isRecordBox(node) ? new RecordBoxView(node, view, getPos, this) : writtenBox(node, view);
		return { case_block: make, law_block: make };
	}
}

/** A box written out in full: drawn from the schema as before, with its parts editable. */
function writtenBox(node: EditorNode, view: EditorView): NodeView {
	const { dom, contentDOM } = DOMSerializer.renderSpec(document, node.type.spec.toDOM!(node));
	return {
		dom,
		contentDOM,
		// Once its parts are all removed, or its source changes, it is drawn afresh.
		update: (next) => next.type === node.type && !isRecordBox(next) && next.attrs.source === node.attrs.source
	};
}

/** A read-only box drawn from the essay page's rendering. */
export class RecordBoxView implements NodeView {
	dom: HTMLElement;
	private drawn = '';

	constructor(
		private node: EditorNode,
		private readonly view: EditorView,
		private readonly getPos: () => number | undefined,
		private readonly boxes: RecordBoxes
	) {
		this.dom = document.createElement('section');
		// The frame's own classes; the editor adds its component frame to them (components.ts), so they are set only here.
		this.dom.className = this.kind === 'law' ? 'essay-case essay-law' : 'essay-case';
		this.dom.contentEditable = 'false';
		this.dom.dataset.recordBox = '';
		this.boxes.add(this);
		this.draw();
	}

	private get kind(): BoxKind {
		return boxTypes[this.node.type.name];
	}

	/** Shows the box as readers see it, or its label and citation until the rendering is in. */
	draw(): void {
		const kind = this.kind;
		const key = String(this.node.attrs.source ?? '');
		this.dom.dataset.source = key;
		const position = this.getPos();
		const html = position === undefined ? undefined : this.boxes.html(kind, key, occurrence(this.view.state.doc, position, this.node));
		const shown = html ?? waiting(kind, key, this.boxes.citationOf(key));
		if (shown === this.drawn) return;
		this.drawn = shown;
		this.dom.innerHTML = shown;
	}

	update(node: EditorNode): boolean {
		if (node.type !== this.node.type || !isRecordBox(node)) return false;
		this.node = node;
		this.draw();
		return true;
	}

	/** Links, the "Where to read it" button and the like work as on the page; the editor leaves them alone. */
	stopEvent(event: Event): boolean {
		return event.target instanceof Element && Boolean(event.target.closest('a, button, summary'));
	}

	ignoreMutation(): boolean {
		return true;
	}

	destroy(): void {
		this.boxes.remove(this);
	}
}

function escapeText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The box's label and citation, while the essay is being rendered. */
function waiting(kind: BoxKind, key: string, citation: string | undefined): string {
	const label = `<p class="essay-block-label">${kind === 'law' ? 'Law' : 'Case'}</p>`;
	return `${label}<p class="essay-case-citation">${escapeText(citation ?? key)}</p>`;
}
