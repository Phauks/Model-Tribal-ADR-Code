/**
 * The editor's document model and its Markdown bridge (docs/editing.md). The
 * schema allows only what the website, the print book and the ebook can all
 * show, so nothing typed or pasted into the editor can break a build.
 *
 * parseEssay() reads Markdown into an editor document; writeEssay() writes a
 * document back. writeEssay() copies every top-level block the writer did not
 * change exactly as it was, so a save changes only the paragraphs that were
 * edited and the version history shows real changes only.
 *
 * Works in the browser, in the Worker and in Node (for tests).
 */
import { Fragment, Schema, type DOMOutputSpec, type Node as EditorNode } from 'prosemirror-model';
import { MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer, type MarkdownSerializerState } from 'prosemirror-markdown';
import type Token from 'markdown-it/lib/token.mjs';
import { boxParts, essayBlocks, essayMarkdown, type BoxPart } from './syntax.ts';
import { figureInfo, figureKindLabels, figureParts, figureSource, readFigureInfo, type FigureKind, type FigurePart } from './figures.ts';
import { youtubePosterAddress } from '../video-links.ts';

/**
 * What the editor shows of a figure's file: the picture, a player, or a
 * YouTube still frame. It is not part of the text, so it cannot be typed in.
 */
function figurePreview(kind: FigureKind, address: string): DOMOutputSpec {
	if (kind === 'chart') {
		return ['p', { class: 'essay-figure-note' }, 'A bar chart: in the table below, the first column names each bar and the second gives its number.'];
	}
	const source = figureSource(kind, address);
	if (!source) return ['p', { class: 'essay-figure-missing' }, 'The site cannot show a file from this address.'];
	if (source.kind === 'youtube') return ['img', { src: youtubePosterAddress(source.identifier), alt: '', loading: 'lazy' }];
	if (kind === 'picture') return ['img', { src: source.address, alt: '', loading: 'lazy' }];
	return [kind === 'video' ? 'video' : 'audio', { src: source.address, controls: '', preload: 'metadata' }];
}

export const essaySchema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		paragraph: {
			content: 'inline*',
			group: 'block',
			parseDOM: [{ tag: 'p' }],
			toDOM: () => ['p', 0]
		},
		heading: {
			attrs: { level: { default: 2 } },
			content: 'inline*',
			group: 'block',
			defining: true,
			parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
			toDOM: (node) => [`h${node.attrs.level}`, 0]
		},
		blockquote: {
			content: 'block+',
			group: 'block',
			defining: true,
			parseDOM: [{ tag: 'blockquote' }],
			toDOM: () => ['blockquote', 0]
		},
		horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
		code_block: {
			content: 'text*',
			marks: '',
			group: 'block',
			code: true,
			defining: true,
			attrs: { params: { default: '' } },
			parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
			toDOM: () => ['pre', ['code', 0]]
		},
		bullet_list: {
			content: 'list_item+',
			group: 'block',
			attrs: { tight: { default: false } },
			parseDOM: [{ tag: 'ul' }],
			toDOM: () => ['ul', 0]
		},
		ordered_list: {
			content: 'list_item+',
			group: 'block',
			attrs: { order: { default: 1 }, tight: { default: false } },
			parseDOM: [{ tag: 'ol', getAttrs: (dom) => ({ order: Number((dom as HTMLElement).getAttribute('start') ?? 1) }) }],
			toDOM: (node) => ['ol', node.attrs.order === 1 ? {} : { start: node.attrs.order }, 0]
		},
		list_item: { content: 'block+', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
		table: {
			content: 'table_row+',
			group: 'block',
			isolating: true,
			parseDOM: [{ tag: 'table' }],
			toDOM: () => ['table', ['tbody', 0]]
		},
		table_row: { content: '(table_cell | table_header)+', parseDOM: [{ tag: 'tr' }], toDOM: () => ['tr', 0] },
		table_header: {
			content: 'inline*',
			attrs: { align: { default: null } },
			isolating: true,
			parseDOM: [{ tag: 'th' }],
			toDOM: () => ['th', 0]
		},
		table_cell: {
			content: 'inline*',
			attrs: { align: { default: null } },
			isolating: true,
			parseDOM: [{ tag: 'td' }],
			toDOM: () => ['td', 0]
		},
		// A court case. Its heading is the full citation of the source record
		// named by `source`. Its parts are kept on that record (record-boxes.ts),
		// so the box is usually empty and the editor shows it read-only
		// (record-box-view.ts); a box written out in full, as older essays
		// have them, holds its Background, Question, Holding, Quotes and
		// Treatment parts.
		case_block: {
			content: '(block | case_part)*',
			group: 'block',
			defining: true,
			isolating: true,
			attrs: { source: { default: '' } },
			toDOM: (node) => [
				'section',
				{ class: 'essay-case', 'data-source': node.attrs.source },
				['div', { class: 'essay-block-label', contenteditable: 'false' }, 'Case'],
				['div', 0]
			]
		},
		// An act, statute, regulation or tribal law, headed by the full
		// citation of its source record. Like a case, its What it does, Quotes
		// and Treatment parts are kept on the record, or, in an older essay,
		// written out inside.
		law_block: {
			content: '(block | case_part)*',
			group: 'block',
			defining: true,
			isolating: true,
			attrs: { source: { default: '' } },
			toDOM: (node) => [
				'section',
				{ class: 'essay-case essay-law', 'data-source': node.attrs.source },
				['div', { class: 'essay-block-label', contenteditable: 'false' }, 'Law'],
				['div', 0]
			]
		},
		// A labeled part of a case or law box (boxParts in syntax.ts).
		case_part: {
			content: 'block+',
			defining: true,
			attrs: { kind: { default: 'quotes' } },
			toDOM: (node) => [
				'div',
				{ class: `essay-case-part essay-case-${node.attrs.kind}` },
				['div', { class: 'essay-block-label', contenteditable: 'false' }, boxParts[node.attrs.kind as BoxPart] ?? 'Quotes'],
				['div', 0]
			]
		},
		quote_block: {
			content: 'block+',
			group: 'block',
			defining: true,
			toDOM: () => [
				'figure',
				{ class: 'essay-quote' },
				['div', { class: 'essay-block-label', contenteditable: 'false' }, 'Quotation'],
				['div', 0]
			]
		},
		analysis_block: {
			content: 'block+',
			group: 'block',
			defining: true,
			attrs: { title: { default: '' } },
			toDOM: (node) => [
				'aside',
				{ class: 'essay-analysis' },
				['div', { class: 'essay-block-label', contenteditable: 'false' }, node.attrs.title ? `Analysis: ${node.attrs.title}` : 'Analysis'],
				['div', 0]
			]
		},
		// A picture, video or sound recording (figures.ts). Its paragraphs are
		// the caption; its parts hold the description, credit and transcript.
		figure_block: {
			content: '(block | figure_part)+',
			group: 'block',
			defining: true,
			isolating: true,
			attrs: { kind: { default: 'picture' }, address: { default: '' } },
			toDOM: (node) => [
				'figure',
				{ class: `essay-figure essay-figure-${node.attrs.kind}`, 'data-address': node.attrs.address },
				[
					'div',
					{ class: 'essay-block-label', contenteditable: 'false' },
					figureKindLabels[node.attrs.kind as FigureKind] ?? 'Figure'
				],
				['div', { class: 'essay-figure-preview', contenteditable: 'false' }, figurePreview(node.attrs.kind, node.attrs.address)],
				['div', 0]
			]
		},
		// A labeled part of a figure (figureParts in figures.ts).
		figure_part: {
			content: 'block+',
			defining: true,
			attrs: { kind: { default: 'credit' } },
			toDOM: (node) => [
				'div',
				{ class: `essay-figure-part essay-figure-part-${node.attrs.kind}` },
				['div', { class: 'essay-block-label', contenteditable: 'false' }, figureParts[node.attrs.kind as FigurePart] ?? 'Credit'],
				['div', 0]
			]
		},
		text: { group: 'inline' },
		hard_break: {
			inline: true,
			group: 'inline',
			selectable: false,
			parseDOM: [{ tag: 'br' }],
			toDOM: () => ['br']
		},
		// A citation keeps the text between its brackets, such as
		// "@worcester-v-georgia, at 561; @other".
		citation: {
			inline: true,
			group: 'inline',
			atom: true,
			attrs: { text: { default: '' } },
			toDOM: (node) => ['span', { class: 'essay-citation-chip', 'data-citation': node.attrs.text }, `[${node.attrs.text}]`]
		},
		term_link: {
			inline: true,
			group: 'inline',
			atom: true,
			attrs: { id: { default: '' }, text: { default: null } },
			toDOM: (node) => [
				'span',
				{ class: 'essay-term-chip', 'data-term': node.attrs.id, title: `Glossary: ${node.attrs.id}` },
				node.attrs.text ?? node.attrs.id
			]
		}
	},
	marks: {
		em: { parseDOM: [{ tag: 'i' }, { tag: 'em' }], toDOM: () => ['em', 0] },
		strong: { parseDOM: [{ tag: 'b' }, { tag: 'strong' }], toDOM: () => ['strong', 0] },
		underline: { parseDOM: [{ tag: 'u' }, { tag: 'ins' }], toDOM: () => ['u', 0] },
		code: { parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
		link: {
			attrs: { href: {}, title: { default: null } },
			inclusive: false,
			parseDOM: [
				{
					tag: 'a[href]',
					getAttrs: (dom) => ({
						href: (dom as HTMLElement).getAttribute('href'),
						title: (dom as HTMLElement).getAttribute('title')
					})
				}
			],
			toDOM: (mark) => ['a', { href: mark.attrs.href, title: mark.attrs.title, rel: 'noopener' }, 0]
		}
	}
});

const reader = essayMarkdown({ forEditing: true });

function listIsTight(tokens: Token[], index: number): boolean {
	return tokens[index + 2]?.hidden === true;
}

function cellAlignment(token: Token): { align: string | null } {
	const style = token.attrGet('style') ?? '';
	return { align: /text-align:\s*(left|right|center)/.exec(style)?.[1] ?? null };
}

const parser = new MarkdownParser(essaySchema, reader, {
	paragraph: { block: 'paragraph' },
	heading: { block: 'heading', getAttrs: (token) => ({ level: Number(token.tag.slice(1)) }) },
	blockquote: { block: 'blockquote' },
	hr: { node: 'horizontal_rule' },
	code_block: { block: 'code_block', noCloseToken: true },
	fence: { block: 'code_block', getAttrs: (token) => ({ params: token.info || '' }), noCloseToken: true },
	bullet_list: { block: 'bullet_list', getAttrs: (_token, tokens, index) => ({ tight: listIsTight(tokens, index) }) },
	ordered_list: {
		block: 'ordered_list',
		getAttrs: (token, tokens, index) => ({
			order: Number(token.attrGet('start') ?? 1),
			tight: listIsTight(tokens, index)
		})
	},
	list_item: { block: 'list_item' },
	table: { block: 'table' },
	thead: { ignore: true },
	tbody: { ignore: true },
	tr: { block: 'table_row' },
	th: { block: 'table_header', getAttrs: cellAlignment },
	td: { block: 'table_cell', getAttrs: cellAlignment },
	container_case: {
		block: 'case_block',
		getAttrs: (token) => ({ source: essayBlocks.case.exec(token.info.trim())?.[1] ?? '' })
	},
	container_law: {
		block: 'law_block',
		getAttrs: (token) => ({ source: essayBlocks.law.exec(token.info.trim())?.[1] ?? '' })
	},
	...Object.fromEntries(
		Object.keys(boxParts).map((kind) => [`container_${kind}`, { block: 'case_part', getAttrs: () => ({ kind }) }])
	),
	container_quote: { block: 'quote_block' },
	container_analysis: {
		block: 'analysis_block',
		getAttrs: (token) => ({ title: essayBlocks.analysis.exec(token.info.trim())?.[1]?.trim() ?? '' })
	},
	container_figure: {
		block: 'figure_block',
		getAttrs: (token) => readFigureInfo(token.info)
	},
	...Object.fromEntries(
		Object.keys(figureParts).map((kind) => [`container_${kind}`, { block: 'figure_part', getAttrs: () => ({ kind }) }])
	),
	hardbreak: { node: 'hard_break' },
	em: { mark: 'em' },
	strong: { mark: 'strong' },
	ins: { mark: 'underline' },
	code_inline: { mark: 'code', noCloseToken: true },
	link: {
		mark: 'link',
		getAttrs: (token) => ({ href: token.attrGet('href'), title: token.attrGet('title') || null })
	},
	citation: { node: 'citation', noCloseToken: true, getAttrs: (token) => ({ text: token.meta.text }) },
	term_link: { node: 'term_link', noCloseToken: true, getAttrs: (token) => token.meta }
});

const containerNodes = new Set(['case_block', 'law_block', 'case_part', 'quote_block', 'analysis_block', 'figure_block', 'figure_part']);

/**
 * How many colons a block's fences need: three, plus one for each level of
 * blocks inside it, because markdown-it-container ends a block at the first
 * bare fence at least as long as the one that opened it.
 */
function fenceFor(node: EditorNode): string {
	let deepest = 0;
	const measure = (parent: EditorNode, depth: number) => {
		parent.forEach((child) => {
			const inner = containerNodes.has(child.type.name) ? depth + 1 : depth;
			deepest = Math.max(deepest, inner);
			measure(child, inner);
		});
	};
	measure(node, 0);
	// A case or law box always opens with four colons, even with nothing written inside it, because its parts, filled in from its record, are blocks of three (record-boxes.ts).
	const least = node.type.name === 'case_block' || node.type.name === 'law_block' ? 1 : 0;
	return ':'.repeat(3 + Math.max(deepest, least));
}

function writeContainer(state: MarkdownSerializerState, node: EditorNode, info: string): void {
	const fence = fenceFor(node);
	state.write(`${fence} ${info}`.trimEnd() + '\n');
	state.renderContent(node);
	state.write(fence);
	state.closeBlock(node);
}

function cellText(cell: EditorNode): string {
	const inner = serializer.serialize(essaySchema.node('doc', null, [essaySchema.node('paragraph', null, cell.content)]));
	return inner.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

const serializer = new MarkdownSerializer(
	{
		...defaultMarkdownSerializer.nodes,
		table(state, node) {
			const rows: string[][] = [];
			node.forEach((row) => {
				const cells: string[] = [];
				row.forEach((cell) => cells.push(cellText(cell)));
				rows.push(cells);
			});
			const rule: string[] = [];
			node.firstChild?.forEach((cell) => {
				const align = cell.attrs.align;
				rule.push(align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---');
			});
			const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
			state.write([line(rows[0]), line(rule), ...rows.slice(1).map(line)].join('\n'));
			state.closeBlock(node);
		},
		table_row() {},
		table_header() {},
		table_cell() {},
		case_block(state, node) {
			writeContainer(state, node, `case ${node.attrs.source}`);
		},
		law_block(state, node) {
			writeContainer(state, node, `law ${node.attrs.source}`);
		},
		case_part(state, node) {
			writeContainer(state, node, node.attrs.kind in boxParts ? node.attrs.kind : 'quotes');
		},
		quote_block(state, node) {
			writeContainer(state, node, 'quote');
		},
		analysis_block(state, node) {
			writeContainer(state, node, `analysis ${node.attrs.title ?? ''}`.trim());
		},
		figure_block(state, node) {
			writeContainer(state, node, figureInfo(node.attrs.kind, node.attrs.address));
		},
		figure_part(state, node) {
			writeContainer(state, node, node.attrs.kind in figureParts ? node.attrs.kind : 'credit');
		},
		citation(state, node) {
			state.write(`[${node.attrs.text}]`);
		},
		term_link(state, node) {
			state.write(`[[${node.attrs.id}${node.attrs.text ? `|${node.attrs.text}` : ''}]]`);
		}
	},
	{
		...defaultMarkdownSerializer.marks,
		underline: { open: '++', close: '++', mixable: true, expelEnclosingWhitespace: true }
	}
);

/** Reads an essay's body (without front matter) into an editor document. */
export function parseEssay(body: string): EditorNode {
	const document = parser.parse(body.normalize('NFC'));
	return document.childCount > 0 ? document : essaySchema.node('doc', null, [essaySchema.node('paragraph')]);
}

/** Writes a document as Markdown from scratch. */
export function serializeEssay(document: EditorNode): string {
	return serializer.serialize(document).replace(/\s*$/, '\n');
}

/**
 * The Markdown text of each top-level block of a body, in order, with the
 * blank lines after it, so that untouched blocks can be written back
 * exactly. Returns null when the blocks cannot be matched one to one.
 */
export function topLevelSlices(body: string): string[] | null {
	const lines = body.split('\n');
	const starts = reader
		.parse(body, {})
		.filter((token) => token.level === 0 && token.nesting >= 0 && token.map)
		.map((token) => token.map![0]);
	if (starts.length === 0) return [];
	return starts.map((start, index) => {
		const end = starts[index + 1] ?? lines.length;
		return lines.slice(index === 0 ? 0 : start, end).join('\n') + (index + 1 < starts.length ? '\n' : '');
	});
}

/**
 * Writes an edited document back to Markdown. Each top-level block that is
 * the same as a block of the original keeps the original's exact text;
 * changed and new blocks are written fresh.
 */
export function writeEssay(edited: EditorNode, originalBody: string): string {
	const original = parseEssay(originalBody);
	const slices = topLevelSlices(originalBody);
	if (!slices || slices.length !== original.childCount) return serializeEssay(edited);
	const unchanged = new Map<string, number[]>();
	original.forEach((node, _offset, index) => {
		const key = JSON.stringify(node.toJSON());
		const list = unchanged.get(key) ?? [];
		list.push(index);
		unchanged.set(key, list);
	});
	let written = '';
	let previous = -2;
	edited.forEach((node) => {
		const kept = unchanged.get(JSON.stringify(node.toJSON()))?.shift();
		// Blocks that followed each other in the original keep the exact
		// spacing between them; anywhere else, a blank line separates blocks.
		if (written !== '' && !(kept !== undefined && kept === previous + 1)) {
			written = written.replace(/\n*$/, '\n\n');
		}
		if (kept !== undefined) {
			written += slices[kept];
			previous = kept;
		} else {
			written += serializeEssay(essaySchema.node('doc', null, Fragment.from(node)));
			previous = -2;
		}
	});
	return written.replace(/\n*$/, '\n');
}
