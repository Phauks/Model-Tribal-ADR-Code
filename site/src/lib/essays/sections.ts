/**
 * The sections (level 2 headings) and subsections (level 3) of an essay in
 * the editor, with the ids the essay page gives their headings: for the
 * outline, review requests and credits. Used by the editor and the server
 * alike.
 */
import type { Node as EditorNode } from 'prosemirror-model';
import { headingSlug } from './render.ts';
import { unitEnd } from './placement.ts';

/** One section or subsection of an essay in the editor. */
export interface EssaySection {
	/** The heading's id on the essay page (render.ts, headingSlug). */
	slug: string;
	title: string;
	level: 2 | 3;
	/** The heading's index among the document's top-level blocks. */
	index: number;
	/** The index just past the section, subsections included. */
	end: number;
}

/**
 * The sections (level 2 headings) and subsections (level 3) of an essay,
 * with the ids the essay page gives their headings. Every heading takes an
 * id in order, as on the page, where "sources-heading" is already taken.
 */
export function essaySections(doc: EditorNode): EssaySection[] {
	const used = new Set(['sources-heading']);
	const found: EssaySection[] = [];
	doc.forEach((node, _offset, index) => {
		if (node.type.name !== 'heading') return;
		const slug = headingSlug(node.textContent, used);
		const level = Number(node.attrs.level ?? 2);
		if (level !== 2 && level !== 3) return;
		found.push({ slug, title: node.textContent.trim(), level, index, end: unitEnd(doc, index, level) });
	});
	return found;
}
