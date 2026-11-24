/**
 * The sidebar's outline of an essay while it is edited or commented on
 * (essay-editor-mockups/4 and v2-1): its sections and subsections from the
 * draft as it stands, with each case, law and analysis box listed under the
 * heading it follows, and a dot for what changed. Trevor asked on Nov. 24,
 * 2026 for "that special nav left sidebar that shows the sections and how
 * things are organized" while editing.
 *
 * The dots, as in the mockups: amber for a draft change, a hollow amber ring
 * for something new since the published version, and purple for a section
 * someone was asked to review. An entry's own change comes first; a heading
 * also shows amber when anything under it changed, so a shut section still
 * shows where the changes are.
 *
 * The entries link to ids the editor gives its headings and boxes
 * (`outlineAnchors`): a heading's id is the one the essay page gives it
 * (render.ts, headingSlug), and a box's is `box-` and its place in the essay.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as EditorNode } from 'prosemirror-model';
import type { OutlineItem, OutlineMark } from '#lib/site-sections.ts';
import { essaySections } from './attestations.ts';
import { citationOnly, splitCaseName } from './case-headings.ts';
import type { DraftMark } from './draft-marks.ts';
import { lawNames } from '#lib/law-names.ts';

export interface EditorOutlineInput {
	/** Which top-level components changed or are new, by position (draft-marks.ts). */
	marks: Map<number, DraftMark>;
	/** The heading ids of the sections in review. */
	inReview: Set<string>;
	/** Each source's citation as plain text, by key, once the library has loaded. */
	citations: Map<string, string> | null;
}

const boxKinds: Record<string, 'case' | 'law' | 'analysis'> = { case_block: 'case', law_block: 'law', analysis_block: 'analysis' };

/** A box's id in the editor: its place among the essay's top-level components. */
export function boxAnchor(index: number): string {
	return `box-${index}`;
}

/** A name with the year its citation ends with. */
function withYear(name: string, citation: string): string {
	const year = citationOnly(citation).match(/\((?:[^()]*\s)?(\d{4})\)\.?\s*$/)?.[1];
	return year && !name.includes(year) ? `${name} (${year})` : name;
}

/** The short name of a case or law for the outline: "Worcester v. Georgia (1832)", "General Allotment Act (1887)". */
export function shortCitation(citation: string): string {
	const whole = citationOnly(citation);
	const [name] = splitCaseName(whole);
	return withYear(name.split(/,\s+(?:ch\.|Pub\.|§)/)[0].trim(), whole);
}

function boxLabel(node: EditorNode, kind: 'case' | 'law' | 'analysis', citations: Map<string, string> | null): string {
	if (kind === 'analysis') return node.attrs.title ? `Analysis: ${node.attrs.title}` : 'Analysis';
	const key = String(node.attrs.source ?? '');
	const citation = citations?.get(key);
	// A law goes by the name it is known by, such as "General Allotment Act (1887)", when the site knows it.
	const known = lawNames[key];
	if (known && citation) return withYear(known, citation);
	if (citation) return shortCitation(citation);
	if (key) return key;
	return kind === 'case' ? 'Case not chosen yet' : 'Law not chosen yet';
}

/** The outline: the essay's sections, opening into subsections and boxes. */
export function editorOutline(doc: EditorNode, input: EditorOutlineInput): OutlineItem[] {
	const sections = essaySections(doc);
	const sectionAt = new Map(sections.map((section) => [section.index, section]));
	const starts: number[] = [];
	doc.forEach((_node, position) => starts.push(position));
	const markAt = (index: number): DraftMark | undefined => input.marks.get(starts[index]);
	const reviewed = (index: number): boolean =>
		sections.some((section) => input.inReview.has(section.slug) && index >= section.index && index < section.end);
	const own = (index: number): OutlineMark | undefined => markAt(index) ?? (reviewed(index) ? 'review' : undefined);

	const top: OutlineItem[] = [];
	let section: OutlineItem | null = null;
	let subsection: OutlineItem | null = null;
	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);
		const heading = sectionAt.get(index);
		if (heading) {
			const item: OutlineItem = { label: heading.title || 'Untitled section', link: `#${heading.slug}`, mark: own(index) };
			if (heading.level === 2 || !section) {
				top.push(item);
				section = item;
				subsection = heading.level === 3 ? item : null;
			} else {
				(section.children ??= []).push(item);
				subsection = item;
			}
			continue;
		}
		const kind = boxKinds[node.type.name];
		const holder = subsection ?? section;
		if (kind) {
			const item: OutlineItem = { label: boxLabel(node, kind, input.citations), link: `#${boxAnchor(index)}`, kind, mark: own(index) };
			if (holder) (holder.children ??= []).push(item);
			else top.push(item);
		} else if (markAt(index) && holder && !holder.mark) {
			// A changed paragraph has no entry of its own; its heading shows it.
			holder.mark = 'changed';
		}
	}
	// A heading shows amber when anything under it changed and it has no mark of its own.
	const lift = (item: OutlineItem): boolean => {
		const inside = (item.children ?? []).map(lift).some(Boolean);
		if (inside && !item.mark) item.mark = 'changed';
		return inside || item.mark === 'changed' || item.mark === 'new';
	};
	top.forEach(lift);
	return top;
}

export const outlineAnchorsKey = new PluginKey('outline-anchors');

/** Gives the editor's headings the ids the essay page gives them, and each box an id, for the sidebar's links. */
export function outlineAnchors(): Plugin {
	return new Plugin({
		key: outlineAnchorsKey,
		props: {
			decorations: (state) => {
				const decorations: Decoration[] = [];
				const sections = new Map(essaySections(state.doc).map((section) => [section.index, section.slug]));
				state.doc.forEach((node, position, index) => {
					const id = sections.get(index) ?? (boxKinds[node.type.name] ? boxAnchor(index) : undefined);
					if (id) decorations.push(Decoration.node(position, position + node.nodeSize, { id }));
				});
				return DecorationSet.create(state.doc, decorations);
			}
		}
	});
}
