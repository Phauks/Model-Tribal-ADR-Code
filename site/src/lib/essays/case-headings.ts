/**
 * The heading of each case and law box in the editor: the full citation of
 * the source record the box names, as readers see it on the essay page
 * (render.ts) and as in essay-editor-mockups/v2-1, instead of the record's
 * key. A case's name is in italics. The heading can be selected and copied,
 * has a Copy button, and while editing a Change button that opens the
 * source picker. The headings are decorations, never part of the text; the
 * box keeps only the key, so every essay that names the same case shares
 * one record (content/sources).
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface CaseHeadingActions {
	/** The citations by source key, as plain text, once loaded. */
	citations: () => Map<string, string> | null;
	/** Opens the picker to change the source of the box at this position; absent while only commenting. */
	change?: (position: number, kind: 'case' | 'law') => void;
}

export const caseHeadingsKey = new PluginKey('case-headings');

/** The citation alone, without the "Read it at …" links and the bare web address that follow it in the library's plain text. */
export function citationOnly(text: string): string {
	return text
		.split(/\s(?:Read it at|With a subscription:|Background, not legal authority:)/)[0]
		.replace(/\s+(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\.?$/i, '')
		.trim();
}

/** A case's name, in italics, and the rest of its citation: "Worcester v. Georgia" and ", 31 U.S. (6 Pet.) 515 (1832)." */
export function splitCaseName(citation: string): [string, string] {
	const at = citation.search(/,\s+(?:\d|No\.|_)/);
	return at > 0 ? [citation.slice(0, at), citation.slice(at)] : [citation, ''];
}

const svgNamespace = 'http://www.w3.org/2000/svg';

function icon(paths: string[]): SVGSVGElement {
	const svg = document.createElementNS(svgNamespace, 'svg');
	for (const [name, value] of Object.entries({ width: '15', height: '15', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
	for (const d of paths) {
		const path = document.createElementNS(svgNamespace, 'path');
		path.setAttribute('d', d);
		svg.append(path);
	}
	return svg;
}

/* Lucide's copy and replace icons. */
const copyIcon = () => icon(['M8 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2']);
const changeIcon = () => icon(['M14 4a2 2 0 0 1 2-2', 'M16 10a2 2 0 0 1-2-2', 'M20 2a2 2 0 0 1 2 2', 'M22 8a2 2 0 0 1-2 2', 'm3 7 3 3 3-3', 'M6 10V5a3 3 0 0 1 3-3h1', 'M2 16a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z']);

function heading(kind: 'case' | 'law', key: string, citation: string | undefined, position: number, actions: CaseHeadingActions): HTMLElement {
	const line = document.createElement('p');
	line.className = 'essay-case-citation editor-case-citation';
	line.contentEditable = 'false';
	const words = document.createElement('span');
	words.className = 'editor-case-words';
	if (!citation) {
		words.textContent = key ? `${key} (not found in the library)` : `No ${kind} chosen yet`;
	} else if (kind === 'case') {
		const [name, rest] = splitCaseName(citation);
		const em = document.createElement('em');
		em.textContent = name;
		words.append(em, rest);
	} else {
		words.textContent = citation;
	}
	line.append(words);
	if (citation) {
		const copy = document.createElement('button');
		copy.type = 'button';
		copy.className = 'editor-case-button';
		copy.title = 'Copy the citation';
		copy.setAttribute('aria-label', 'Copy the citation');
		copy.append(copyIcon());
		copy.addEventListener('click', () => void navigator.clipboard?.writeText(citation));
		line.append(copy);
	}
	if (actions.change) {
		const change = actions.change;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'editor-case-button';
		button.title = kind === 'case' ? 'Change the case' : 'Change the law';
		button.setAttribute('aria-label', button.title);
		button.append(changeIcon());
		button.addEventListener('click', () => change(position, kind));
		line.append(button);
	}
	return line;
}

export function caseHeadings(actions: CaseHeadingActions): Plugin {
	return new Plugin({
		key: caseHeadingsKey,
		props: {
			decorations: (state) => {
				const citations = actions.citations();
				const decorations: Decoration[] = [];
				state.doc.descendants((node, position) => {
					if (node.type.name !== 'case_block' && node.type.name !== 'law_block') return true;
					const kind = node.type.name === 'case_block' ? 'case' : 'law';
					const key = String(node.attrs.source ?? '');
					const found = citations?.get(key);
					const citation = found ? citationOnly(found) : undefined;
					decorations.push(
						Decoration.widget(position + 1, () => heading(kind, key, citation, position, actions), {
							side: -1,
							key: `${kind}:${key}:${citation ? 'found' : citations ? 'missing' : 'loading'}:${actions.change ? 'edit' : 'read'}`,
							ignoreSelection: true,
							stopEvent: () => true
						})
					);
					return false;
				});
				return DecorationSet.create(state.doc, decorations);
			}
		}
	});
}
