<script lang="ts">
	// The essay editor (docs/editing.md). A rich-text view built on
	// ProseMirror, limited to what the website, the print book and the ebook
	// can all show (src/lib/essays/document.ts), with a Markdown view for
	// anything easier to type as text. Saving sends the whole file; the
	// server keeps it as a new version and never overwrites an earlier one.
	// On an essay page (EssayArticle.svelte) it saves by itself: a few
	// seconds after typing stops, at least every half minute while typing
	// goes on, and when the tab is hidden or the editor closes. Those
	// versions carry the note "Auto-saved"; "Name this version" saves the
	// text as it stands as a version with a note of its own.
	//
	// With `live`, the editor first joins the essay's live editing room
	// (src/lib/essays/live.ts): everyone in the room edits one shared text,
	// sees each other's cursors, and the room saves versions itself, so the
	// editor stops saving by itself. If the room cannot be reached in a few
	// seconds, the editor opens as before and saves by itself.
	import 'prosemirror-view/style/prosemirror.css';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { baseKeymap, lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
	import { history, redo, undo } from 'prosemirror-history';
	import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
	import { keymap } from 'prosemirror-keymap';
	import type { MarkType, Node as EditorNode, NodeType } from 'prosemirror-model';
	import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
	import { EditorState, NodeSelection, Plugin, TextSelection, type Command, type Transaction } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import { initProseMirrorDoc, redoCommand, undoCommand, yCursorPlugin, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';
	import { joinEssayRoom, type EssayRoom, type LiveStatus } from '#lib/essays/live.ts';
	import SourceList from '#lib/components/SourceList.svelte';
	import { essaySchema as schema, parseEssay, writeEssay } from '#lib/essays/document.ts';
	import { boxParts, casePartOrder, citationReferences, joinFrontMatter, lawPartOrder, splitFrontMatter, type BoxPart } from '#lib/essays/syntax.ts';
	import type { RenderedEssay } from '#lib/essays/render.ts';
	import { checkMarks, issueAt } from '#lib/essays/check-marks.ts';
	import EssayChecks from '#lib/components/essays/EssayChecks.svelte';
	import EssayGoTo from '#lib/components/essays/EssayGoTo.svelte';
	import EssayFigureDialog from '#lib/components/essays/EssayFigureDialog.svelte';
	import EssaySources from '#lib/components/essays/EssaySources.svelte';
	import EssaySourceLinks from '#lib/components/essays/EssaySourceLinks.svelte';
	import { citationWithoutAddress, type SourceDocuments } from '#lib/essays/source-documents.ts';
	import { figurePartOrder, figureParts, figurePartsFor, type FigureKind, type FigurePart, type NewFigure } from '#lib/essays/figures.ts';
	import { figurePlayers, watchFigureFiles } from '#lib/essays/figure-players.ts';
	import { addAfterCurrent, addSection, moveCurrent } from '#lib/essays/placement.ts';
	import { dropLocalDraft, isSaveAnswer, keepaliveLimit, keepLocalDraft, localDraft, type LocalDraft } from '#lib/essays/local-draft.ts';

	let {
		identifier,
		text,
		version,
		canEdit,
		autoSave = false,
		live = false,
		onsaved
	}: {
		identifier: string;
		text: string;
		version: number;
		canEdit: boolean;
		/** Save by itself as the person types (on an essay page). */
		autoSave?: boolean;
		/** Join the essay's live editing room when it can be reached. */
		live?: boolean;
		/** Called with the version number after each save. */
		onsaved?: (version: number) => void;
	} = $props();

	// The file as last saved, split so the editor shows only the body. The
	// page remounts the editor for another essay, so the first values are
	// all it needs.
	const initial = splitFrontMatter(untrack(() => text));
	let frontMatter = $state(initial.frontMatter);
	let savedBody = initial.body;
	let savedFrontMatter = initial.frontMatter;
	let basedOn = $state(untrack(() => version));

	let mode = $state<'rich' | 'markdown' | 'preview'>('rich');
	let markdown = $state('');
	let dirty = $state(false);
	let note = $state('');
	let status = $state('');
	let saving = $state(false);
	let conflict = $state<{ latest: number; latestText: string; mine: string } | null>(null);
	let preview = $state<RenderedEssay | null>(null);
	/** Text this browser kept because the site never confirmed saving it (local-draft.ts). */
	let recovered = $state<LocalDraft | null>(null);

	let host: HTMLDivElement | undefined = $state();
	let view: EditorView | undefined;
	type Box = 'case_block' | 'law_block';
	let active = $state<{
		marks: Set<string>;
		block: string;
		inside: Set<string>;
		box: Box | null;
		boxSource: string | null;
		boxParts: Set<string>;
		analysisTitle: string | null;
		figureParts: Set<string>;
		figureKind: FigureKind | null;
		citationKeys: string[];
	}>({
		marks: new Set(),
		block: 'paragraph',
		inside: new Set(),
		box: null,
		boxSource: null,
		boxParts: new Set(),
		analysisTitle: null,
		figureParts: new Set(),
		figureKind: null,
		citationKeys: []
	});
	/** The parts the box around the cursor can take and does not have yet. */
	const missingParts = $derived(
		active.box ? (active.box === 'law_block' ? lawPartOrder : casePartOrder).filter((kind) => !active.boxParts.has(kind)) : []
	);

	/** The parts the figure around the cursor does not have yet. */
	const missingFigureParts = $derived(
		active.figureKind ? figurePartsFor[active.figureKind].filter((kind) => !active.figureParts.has(kind)) : []
	);

	/* Dialogs --------------------------------------------------------------- */

	let figureDialog: ReturnType<typeof EssayFigureDialog> | undefined = $state();
	/**
	 * Set when a figure's file in the editor did not load. The editor's own
	 * text is not changed for it: ProseMirror would redraw the figure.
	 */
	let figureFileNotice = $state('');

	type Picker = 'citation' | 'case' | 'law' | 'term' | 'link' | 'analysis-title';
	let picker = $state<Picker | null>(null);
	let pickerDialog: HTMLDialogElement | undefined = $state();
	let query = $state('');
	let locator = $state('');
	let chosenKey = $state('');
	let linkAddress = $state('');
	let shownText = $state('');
	let editingCitationAt = $state<number | null>(null);
	let library = $state<{
		sources: [string, string][];
		terms: [string, string][];
		words?: string[];
	} | null>(null);
	/** Links to the documents of sources looked up so far, by key. */
	let documents = $state<Record<string, SourceDocuments>>({});
	const asked = new Set<string>();

	/** Fetches document links for the keys not looked up yet. */
	async function loadDocuments(keys: string[]): Promise<void> {
		const wanted = keys.filter((key) => !asked.has(key));
		if (wanted.length === 0) return;
		for (const key of wanted) asked.add(key);
		try {
			const response = await fetch(`/workspace/essays/source-documents.json?keys=${wanted.join(',')}`);
			if (response.ok) documents = { ...documents, ...(await response.json()) };
		} catch {
			for (const key of wanted) asked.delete(key);
		}
	}
	const sourceLabels = $derived(new Map((library?.sources ?? []).map(([key, label]) => [key, citationWithoutAddress(label)])));
	let showSources = $state(false);

	/* Checks and Go to ------------------------------------------------------- */

	const checksKey = 'editor-checks';
	/** Goes up by one each time the text changes, so the checks run again. */
	let revision = $state(0);
	let showChecks = $state(false);
	let showGoTo = $state(false);
	let chosenIssue = $state<string | null>(null);

	function toggleChecks(): void {
		showChecks = !showChecks;
		if (showChecks) void loadLibrary();
		try {
			localStorage.setItem(checksKey, showChecks ? 'on' : 'off');
		} catch {
			// Storage can be blocked; the choice is then not remembered.
		}
	}
	let libraryProblem = $state('');

	let libraryLoading: Promise<void> | null = null;

	/** Loads the list of sources once, however often it is asked for. */
	function loadLibrary(): Promise<void> {
		libraryLoading ??= fetchLibrary();
		return libraryLoading;
	}

	async function fetchLibrary(): Promise<void> {
		if (library) return;
		try {
			const response = await fetch('/workspace/essays/sources.json');
			if (!response.ok) throw new Error(String(response.status));
			library = await response.json();
		} catch {
			libraryProblem = 'The list of sources could not be loaded. Type the key instead.';
		}
	}

	const matches = $derived.by(() => {
		if (!library) return [] as [string, string][];
		const list = picker === 'term' ? library.terms : library.sources;
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return list.slice(0, 30);
		return list
			.filter(([key, label]) => {
				const haystack = `${key} ${label}`.toLowerCase();
				return words.every((word) => haystack.includes(word));
			})
			.slice(0, 50);
	});

	function openPicker(kind: Picker): void {
		picker = kind;
		query = '';
		locator = '';
		chosenKey = '';
		shownText = '';
		linkAddress = '';
		if (kind === 'citation' || kind === 'case' || kind === 'law' || kind === 'term') void loadLibrary();
		if (kind === 'link' && view) {
			const { from, to } = view.state.selection;
			let existing = '';
			view.state.doc.nodesBetween(from, to, (node) => {
				const mark = schema.marks.link.isInSet(node.marks);
				if (mark) existing = mark.attrs.href;
			});
			linkAddress = existing;
		}
		if (kind === 'analysis-title') shownText = active.analysisTitle ?? '';
		if ((kind === 'case' && active.box === 'case_block') || (kind === 'law' && active.box === 'law_block')) chosenKey = active.boxSource ?? '';
		tick().then(() => pickerDialog?.showModal());
	}

	function closePicker(): void {
		pickerDialog?.close();
		picker = null;
		editingCitationAt = null;
		view?.focus();
	}

	/* Commands -------------------------------------------------------------- */

	function run(command: Command): void {
		if (!view || !editable()) return;
		command(view.state, view.dispatch, view);
		view.focus();
	}

	function markActive(state: EditorState, type: MarkType): boolean {
		const { from, to, empty } = state.selection;
		if (empty) return Boolean(type.isInSet(state.storedMarks ?? state.selection.$from.marks()));
		return state.doc.rangeHasMark(from, to, type);
	}

	/** Inserts a block, or wraps the selected blocks in it when text is selected. */
	/**
	 * Inserts a box after the block the cursor is in (placement.ts), or wraps
	 * the selected blocks in it when text is selected.
	 */
	function insertBlock(type: NodeType, attrs: Record<string, unknown> = {}, content?: () => EditorNode): Command {
		return (state, dispatch) => {
			if (!state.selection.empty && wrapIn(type, attrs)(state)) return wrapIn(type, attrs)(state, dispatch);
			const node = content ? content() : type.create(attrs, schema.node('paragraph'));
			return addAfterCurrent(node)(state, dispatch);
		};
	}

	function newPart(kind: BoxPart, text?: string): EditorNode {
		const paragraph = schema.node('paragraph', null, text ? schema.text(text) : undefined);
		return schema.node('case_part', { kind }, [kind === 'quotes' ? schema.node('blockquote', null, paragraph) : paragraph]);
	}

	function newCase(source: string): EditorNode {
		return schema.node('case_block', { source }, [
			newPart('question', 'The question the court decided.'),
			newPart('holding'),
			newPart('quotes'),
			newPart('treatment')
		]);
	}

	function newLaw(source: string): EditorNode {
		return schema.node('law_block', { source }, [newPart('summary', 'What the law does.'), newPart('quotes'), newPart('treatment')]);
	}

	/** The nearest enclosing node of a type, and its position. */
	function enclosing(state: EditorState, name: string): { node: EditorNode; position: number } | null {
		const start = state.selection.$from;
		for (let depth = start.depth; depth > 0; depth -= 1) {
			const node = start.node(depth);
			if (node.type.name === name) return { node, position: start.before(depth) };
		}
		return null;
	}

	/** Adds a part to the case or law box around the cursor, in its place in the order of parts. */
	function addBoxPart(kind: BoxPart): Command {
		return (state, dispatch) => {
			const found = enclosing(state, 'case_block') ?? enclosing(state, 'law_block');
			if (!found) return false;
			const order = found.node.type.name === 'law_block' ? lawPartOrder : casePartOrder;
			let at = found.position + found.node.nodeSize - 1;
			let offset = found.position + 1;
			for (let index = 0; index < found.node.childCount; index += 1) {
				const child = found.node.child(index);
				if (child.type.name === 'case_part' && order.indexOf(child.attrs.kind) > order.indexOf(kind)) {
					at = offset;
					break;
				}
				offset += child.nodeSize;
			}
			if (dispatch) dispatch(state.tr.insert(at, newPart(kind)).scrollIntoView());
			return true;
		};
	}

	/** Blocks from a few lines of Markdown typed in the figure dialog, so *italics* and citations work there too. */
	function blocksOf(text: string): EditorNode[] {
		const blocks: EditorNode[] = [];
		parseEssay(text).forEach((node) => blocks.push(node));
		return blocks;
	}

	function newFigurePart(kind: FigurePart, text?: string): EditorNode {
		return schema.node('figure_part', { kind }, text ? blocksOf(text) : [schema.node('paragraph')]);
	}

	/**
	 * Adds a figure after the block the cursor is in, at the top level of the
	 * essay, so a figure never lands inside a paragraph, a list or a box.
	 */
	function addFigure(figure: NewFigure): void {
		const parts = [
			...blocksOf(figure.caption),
			...(figure.description ? [newFigurePart('description', figure.description)] : []),
			...(figure.credit ? [newFigurePart('credit', figure.credit)] : []),
			...(figure.transcript ? [newFigurePart('transcript', figure.transcript)] : [])
		];
		const node = schema.node('figure_block', { kind: figure.kind, address: figure.address }, parts.length ? parts : [schema.node('paragraph')]);
		run(addAfterCurrent(node, false));
	}

	/** Runs a choice from the Add menu. */
	function addChosen(chosen: string): void {
		if (chosen === 'section') run(addSection(schema, 2));
		else if (chosen === 'subsection') run(addSection(schema, 3));
		else if (chosen === 'paragraph') run(addAfterCurrent(schema.node('paragraph'), false));
		else if (chosen === 'case' || chosen === 'law') openPicker(chosen);
		else if (chosen === 'quote') run(addAfterCurrent(schema.node('quote_block', null, schema.node('paragraph'))));
		else if (chosen === 'analysis') run(addAfterCurrent(schema.node('analysis_block', null, schema.node('paragraph'))));
		else if (chosen === 'figure') void figureDialog?.show();
		else if (chosen === 'chart') run(addAfterCurrent(newChart()));
	}

	function tableRow(cells: string[], header = false): EditorNode {
		const type = schema.nodes[header ? 'table_header' : 'table_cell'];
		return schema.node(
			'table_row',
			null,
			cells.map((text, index) => type.create({ align: index === 1 ? 'right' : null }, text ? schema.text(text) : undefined))
		);
	}

	/** A chart to fill in: its caption, a table of names and numbers, and a source line. */
	function newChart(): EditorNode {
		return schema.node('figure_block', { kind: 'chart', address: '' }, [
			schema.node('paragraph', null, schema.text('What the chart shows.')),
			schema.node('table', null, [tableRow(['Name', 'Number'], true), tableRow(['First', '1']), tableRow(['Second', '2'])]),
			newFigurePart('credit', 'Source: ')
		]);
	}

	/** Adds an empty row under the row the cursor is in. */
	const addTableRow: Command = (state, dispatch) => {
		const found = enclosing(state, 'table_row');
		if (!found) return false;
		if (dispatch) {
			const cells: EditorNode[] = [];
			found.node.forEach((cell) => cells.push(schema.nodes.table_cell.create({ align: cell.attrs.align })));
			const at = found.position + found.node.nodeSize;
			const transaction = state.tr.insert(at, schema.node('table_row', null, cells));
			transaction.setSelection(TextSelection.near(transaction.doc.resolve(at + 2)));
			dispatch(transaction.scrollIntoView());
		}
		return true;
	};

	/** Removes the row the cursor is in, keeping the header row and at least one other. */
	const removeTableRow: Command = (state, dispatch) => {
		const row = enclosing(state, 'table_row');
		const table = enclosing(state, 'table');
		if (!row || !table || table.node.childCount <= 2 || table.node.firstChild === row.node) return false;
		if (dispatch) dispatch(state.tr.delete(row.position, row.position + row.node.nodeSize).scrollIntoView());
		return true;
	};

	/** Adds a part to the figure around the cursor, in its place in the order of parts. */
	function addFigurePart(kind: FigurePart): Command {
		return (state, dispatch) => {
			const found = enclosing(state, 'figure_block');
			if (!found) return false;
			let at = found.position + found.node.nodeSize - 1;
			let offset = found.position + 1;
			for (let index = 0; index < found.node.childCount; index += 1) {
				const child = found.node.child(index);
				if (child.type.name === 'figure_part' && figurePartOrder.indexOf(child.attrs.kind) > figurePartOrder.indexOf(kind)) {
					at = offset;
					break;
				}
				offset += child.nodeSize;
			}
			if (dispatch) {
				const transaction = state.tr.insert(at, newFigurePart(kind));
				transaction.setSelection(TextSelection.near(transaction.doc.resolve(at + 2)));
				dispatch(transaction.scrollIntoView());
			}
			return true;
		};
	}

	function setAttributes(name: string, attrs: Record<string, unknown>): Command {
		return (state, dispatch) => {
			const found = enclosing(state, name);
			if (!found) return false;
			if (dispatch) dispatch(state.tr.setNodeMarkup(found.position, null, { ...found.node.attrs, ...attrs }));
			return true;
		};
	}

	function insertInline(node: EditorNode): Command {
		return (state, dispatch) => {
			if (dispatch) dispatch(state.tr.replaceSelectionWith(node, false).scrollIntoView());
			return true;
		};
	}

	function choose(): void {
		if (!view) return;
		if (picker === 'citation') {
			const key = chosenKey.trim();
			if (!key) return;
			const citation = `@${key.replace(/^@/, '')}${locator.trim() ? `, ${locator.trim()}` : ''}`;
			if (editingCitationAt !== null) {
				const position = editingCitationAt;
				run((state, dispatch) => {
					if (dispatch) dispatch(state.tr.setNodeMarkup(position, null, { text: citation }));
					return true;
				});
			} else {
				run(insertInline(schema.node('citation', { text: citation })));
			}
		} else if (picker === 'case' || picker === 'law') {
			const key = chosenKey.trim().replace(/^@/, '');
			if (!key) return;
			const box: Box = picker === 'law' ? 'law_block' : 'case_block';
			run(
				active.box === box
					? setAttributes(box, { source: key })
					: insertBlock(schema.nodes[box], { source: key }, () => (box === 'law_block' ? newLaw(key) : newCase(key)))
			);
		} else if (picker === 'term') {
			const id = chosenKey.trim();
			if (!id) return;
			run(insertInline(schema.node('term_link', { id, text: shownText.trim() || null })));
		} else if (picker === 'link') {
			const href = linkAddress.trim();
			run((state, dispatch) => {
				const { from, to } = state.selection;
				let transaction = state.tr.removeMark(from, to, schema.marks.link);
				if (href) transaction = transaction.addMark(from, to, schema.marks.link.create({ href }));
				if (dispatch) dispatch(transaction);
				return true;
			});
		} else if (picker === 'analysis-title') {
			run(setAttributes('analysis_block', { title: shownText.trim() }));
		}
		closePicker();
	}

	function editCitation(position: number, node: EditorNode): boolean {
		if (!canEdit) return false;
		const [first] = String(node.attrs.text).split(';');
		const match = /^@([a-z0-9-]+)(?:,\s*(.*))?$/.exec(first.trim());
		openPicker('citation');
		editingCitationAt = position;
		chosenKey = match?.[1] ?? '';
		locator = match?.[2] ?? '';
		if (String(node.attrs.text).includes(';')) {
			// A citation of several sources is easier to change as text.
			closePicker();
			switchMode('markdown');
		}
		return true;
	}

	/* The editor -------------------------------------------------------------- */

	function partsOf(node: EditorNode | undefined, part = 'case_part'): Set<string> {
		const kinds = new Set<string>();
		node?.forEach((child) => {
			if (child.type.name === part) kinds.add(child.attrs.kind);
		});
		return kinds;
	}

	/** The sources named by the citation the cursor is on or next to. */
	function citationAt(state: EditorState): string[] {
		const { selection } = state;
		const node =
			selection instanceof NodeSelection
				? selection.node
				: [selection.$from.nodeAfter, selection.$from.nodeBefore].find((candidate) => candidate?.type.name === 'citation');
		return node?.type.name === 'citation' ? citationReferences(String(node.attrs.text)).map((reference) => reference.key) : [];
	}

	function describe(state: EditorState): void {
		const marks = new Set<string>();
		for (const name of ['em', 'strong', 'underline', 'code', 'link']) {
			if (markActive(state, schema.marks[name])) marks.add(name);
		}
		const start = state.selection.$from;
		const parent = start.parent;
		const block = parent.type.name === 'heading' ? `h${parent.attrs.level}` : parent.type.name;
		const inside = new Set<string>();
		for (let depth = start.depth; depth > 0; depth -= 1) inside.add(start.node(depth).type.name);
		const boxFound = enclosing(state, 'case_block') ?? enclosing(state, 'law_block');
		active = {
			marks,
			block,
			inside,
			box: boxFound ? (boxFound.node.type.name as Box) : null,
			boxSource: boxFound?.node.attrs.source ?? null,
			boxParts: partsOf(boxFound?.node),
			analysisTitle: enclosing(state, 'analysis_block')?.node.attrs.title ?? null,
			figureParts: partsOf(enclosing(state, 'figure_block')?.node, 'figure_part'),
			figureKind: (enclosing(state, 'figure_block')?.node.attrs.kind as FigureKind | undefined) ?? null,
			citationKeys: citationAt(state)
		};
		if (active.citationKeys.length > 0 || active.boxSource) {
			void loadLibrary();
			void loadDocuments(active.boxSource ? [...active.citationKeys, active.boxSource] : active.citationKeys);
		}
	}

	function createState(body: string): EditorState {
		const rules = inputRules({
			rules: [
				textblockTypeInputRule(/^(#{2,4})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
				wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
				wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
				wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) }))
			]
		});
		const tracker = new Plugin({
			view: () => ({
				update: (editorView, previous) => {
					if (!editorView.state.doc.eq(previous.doc)) {
						markChanged();
						revision += 1;
					}
					describe(editorView.state);
				}
			})
		});
		// In the live room the text comes from the room, and undo takes back only this person's changes.
		const shared = inRoom && room ? initProseMirrorDoc(room.fragment, schema) : null;
		const undoKey = shared ? undoCommand : undo;
		const redoKey = shared ? redoCommand : redo;
		return EditorState.create({
			doc: shared ? shared.doc : parseEssay(body),
			plugins: [
				rules,
				keymap({
					'Mod-z': undoKey,
					'Alt-Shift-ArrowUp': moveCurrent('up'),
					'Alt-Shift-ArrowDown': moveCurrent('down'),
					'Shift-Mod-z': redoKey,
					'Mod-y': redoKey,
					'Mod-b': toggleMark(schema.marks.strong),
					'Mod-i': toggleMark(schema.marks.em),
					'Mod-u': toggleMark(schema.marks.underline),
					'Mod-`': toggleMark(schema.marks.code),
					'Shift-Enter': (state, dispatch) => {
						if (dispatch) dispatch(state.tr.replaceSelectionWith(schema.node('hard_break')).scrollIntoView());
						return true;
					},
					Enter: splitListItem(schema.nodes.list_item),
					'Mod-[': liftListItem(schema.nodes.list_item),
					'Mod-]': sinkListItem(schema.nodes.list_item),
					'Mod-s': () => {
						void save();
						return true;
					},
					'Mod-g': () => {
						showGoTo = true;
						return true;
					}
				}),
				keymap(baseKeymap),
				...(shared && room
					? [ySyncPlugin(room.fragment, { mapping: shared.mapping }), yCursorPlugin(room.awareness), yUndoPlugin()]
					: [history()]),
				checkMarks(),
				tracker
			]
		});
	}

	function mountEditor(body: string): void {
		view?.destroy();
		if (!host) return;
		view = new EditorView(host, {
			state: createState(body),
			editable,
			attributes: { class: 'essay-editor-text essay-text', 'aria-label': 'Essay text', role: 'textbox', 'aria-multiline': 'true' },
			handleClick: (editorView, position) => {
				const issue = issueAt(editorView, position);
				if (issue) chosenIssue = issue;
				return false;
			},
			handleDoubleClickOn: (_view, _position, node, nodePosition) =>
				node.type.name === 'citation' ? editCitation(nodePosition, node) : false,
			dispatchTransaction(transaction: Transaction) {
				if (!view) return;
				view.updateState(view.state.apply(transaction));
			}
		});
		describe(view.state);
	}

	/** The body as Markdown, written so untouched paragraphs keep their exact text. */
	function currentBody(): string {
		if (mode === 'markdown') return markdown;
		return view ? writeEssay(view.state.doc, savedBody) : savedBody;
	}

	function currentFile(): string {
		return joinFrontMatter(frontMatter, currentBody());
	}

	async function switchMode(next: 'rich' | 'markdown' | 'preview'): Promise<void> {
		if (next === mode) return;
		const body = currentBody();
		if (mode === 'markdown' && next !== 'markdown') {
			// Reading the Markdown back in: the rich view starts from it.
			const wasDirty = dirty;
			mountEditor(body);
			dirty = wasDirty || body !== savedBody;
		}
		if (next === 'markdown') markdown = body;
		if (next === 'preview') {
			preview = null;
			status = 'Preparing the preview…';
			const response = await fetch(`/workspace/essays/${identifier}/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: joinFrontMatter(frontMatter, body) })
			});
			status = response.ok ? '' : 'The preview could not be made.';
			if (response.ok) preview = await response.json();
		}
		mode = next;
	}

	/* The live editing room ------------------------------------------------- */

	let room: EssayRoom | null = null;
	/** Whether the editor shows the room's shared text (non-reactive: read while building plugins). */
	let inRoom = false;
	/** The same, for the page to show. */
	let inRoomShown = $state(false);
	let liveStatus = $state<LiveStatus | null>(null);
	let liveProblem = $state('');
	let people = $state<string[]>([]);
	let joining = $state(false);
	let joinTimer: ReturnType<typeof setTimeout> | undefined;
	/** How long to wait for the room before opening the editor on its own. */
	const joinWaitMilliseconds = 6_000;
	/** Cursor colors come from the design tokens, read from the page so each theme gets its own. */
	const cursorTokens = ['--color-action', '--color-link', '--color-danger', '--color-focus'];

	function cursorColor(): string {
		const token = cursorTokens[Math.floor(Math.random() * cursorTokens.length)];
		return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'currentColor';
	}

	function editable(): boolean {
		if (!canEdit || joining) return false;
		if (!inRoom) return true;
		return liveStatus?.state === 'live' ? liveStatus.canEdit : liveStatus?.state === 'offline';
	}

	async function joinRoom(): Promise<void> {
		joining = true;
		view?.setProps({});
		const joined = joinEssayRoom(identifier, {
			basedOn,
			user: { name: 'Someone', color: cursorColor() }
		});
		room = joined;
		joined.subscribe((next) => {
			liveStatus = next;
			if (next.state === 'refused' && inRoom) {
				// Cut off for good: keep what this tab has, and stop typing into a room that will not take it.
				keepLocalDraft(identifier, currentFile(), basedOn);
				liveProblem = `${next.reason} Your text is kept in this browser.`;
			}
			view?.setProps({});
		});
		const waited = await Promise.race([
			joined.whenSynced.then(() => 'synced' as const, () => 'refused' as const),
			new Promise<'late'>((resolve) => {
				joinTimer = setTimeout(() => resolve('late'), joinWaitMilliseconds);
			})
		]);
		clearTimeout(joinTimer);
		if (closed || room !== joined) return;
		if (waited !== 'synced') {
			// Open the editor on its own, saving by itself as before.
			const reason = joined.status.state === 'refused' ? joined.status.reason : 'The live room did not answer.';
			joined.destroy();
			room = null;
			liveStatus = null;
			liveProblem = `${reason} Editing on your own; your changes save by themselves.`;
			joining = false;
			view?.setProps({});
			return;
		}
		inRoom = true;
		inRoomShown = true;
		joining = false;
		status = '';
		liveProblem = '';
		frontMatter = joined.frontMatter.toString();
		savedFrontMatter = frontMatter;
		joined.frontMatter.observe(() => {
			frontMatter = joined.frontMatter.toString();
		});
		const showPeople = () => {
			people = [...joined.awareness.getStates().entries()]
				.filter(([client]) => client !== joined.document.clientID)
				.map(([, state]) => (state.user as { name?: string } | undefined)?.name ?? 'Someone');
		};
		joined.awareness.on('change', showPeople);
		showPeople();
		joined.onSaved(({ version }) => {
			basedOn = version;
			dirty = false;
			onsaved?.(version);
		});
		if (joined.status.state === 'live') basedOn = joined.status.version;
		mountEditor('');
		dirty = false;
	}

	/** The front matter box writes into the room's shared copy. */
	function frontMatterEdited(): void {
		if (inRoom && room) {
			const shared = room.frontMatter;
			if (shared.toString() !== frontMatter) {
				room.document.transact(() => {
					shared.delete(0, shared.length);
					shared.insert(0, frontMatter);
				});
			}
			return;
		}
		markChanged();
	}

	function liveText(state: LiveStatus): string {
		if (state.state === 'connecting') return 'Joining the live room…';
		if (state.state === 'offline') return 'Offline. Your changes stay here and go to the room when the connection is back.';
		if (state.state === 'refused') return state.reason;
		if (!state.canEdit) return `Live, reading only. Version ${state.version}.`;
		// The room reports unsaved changes only on joining and saving, so changes seen since count too.
		return state.unsaved || dirty ? 'Live. The room saves a version a minute after typing stops.' : `Live. Saved as version ${state.version}.`;
	}

	/* Saving by itself ------------------------------------------------------ */

	const autoSaveIdleMilliseconds = 4_000;
	const autoSaveLongestMilliseconds = 30_000;
	/** Counts changes, so a save that finishes while typing goes on leaves the newer text marked unsaved. */
	let edits = 0;
	let firstUnsavedEdit: number | null = null;
	let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

	function markChanged(): void {
		dirty = true;
		edits += 1;
		scheduleAutoSave();
	}

	let closed = false;

	function scheduleAutoSave(): void {
		// In the live room, the room saves versions.
		if (!autoSave || !canEdit || conflict || closed || inRoom) return;
		firstUnsavedEdit ??= Date.now();
		clearTimeout(autoSaveTimer);
		const untilLongest = firstUnsavedEdit + autoSaveLongestMilliseconds - Date.now();
		autoSaveTimer = setTimeout(() => void autoSaveNow(), Math.max(0, Math.min(autoSaveIdleMilliseconds, untilLongest)));
	}

	/** After a save that failed, try again in half a minute rather than straight away. */
	function retryAutoSave(): void {
		if (!autoSave || closed) return;
		clearTimeout(autoSaveTimer);
		autoSaveTimer = setTimeout(() => void autoSaveNow(), autoSaveLongestMilliseconds);
	}

	function unsaved(): boolean {
		return dirty || frontMatter !== savedFrontMatter;
	}

	async function autoSaveNow(): Promise<void> {
		clearTimeout(autoSaveTimer);
		if (!autoSave || !canEdit || conflict || inRoom || !unsaved()) return;
		if (saving) {
			scheduleAutoSave();
			return;
		}
		await save(false, true);
	}

	/** The tab is being hidden, maybe closed: keep the text here and send it while the page may still go away. */
	function saveWhenHidden(): void {
		if (document.visibilityState !== 'hidden') return;
		// Cut off from the room, changes wait in this tab; keep a copy in case it closes.
		if (inRoom) {
			if (liveStatus?.state !== 'live' && unsaved()) keepLocalDraft(identifier, currentFile(), basedOn);
			return;
		}
		if (!autoSave || !canEdit || conflict || !unsaved()) return;
		const file = currentFile();
		keepLocalDraft(identifier, file, basedOn);
		void (inFlight ?? Promise.resolve()).then(() => save(false, true, { file, last: true }));
	}

	/** The save on its way, so a last save waits for it rather than being skipped. */
	let inFlight: Promise<void> | null = null;

	async function save(saveOver = false, automatic = false, { file = currentFile(), last = false } = {}): Promise<void> {
		if (!canEdit || saving) return;
		saving = true;
		const done = new Promise<void>((resolve) => {
			finishSave = resolve;
		});
		inFlight = done;
		try {
			await sendSave(saveOver, automatic, file, last);
		} finally {
			saving = false;
			inFlight = null;
			finishSave();
		}
	}

	let finishSave: () => void = () => {};

	async function sendSave(saveOver: boolean, automatic: boolean, file: string, last: boolean): Promise<void> {
		status = automatic ? 'Saving by itself…' : 'Saving…';
		const editsSent = edits;
		// Until the site has the text, this browser keeps a copy (local-draft.ts).
		keepLocalDraft(identifier, file, basedOn);
		const body = JSON.stringify({
			text: file,
			basedOn: saveOver && conflict ? conflict.latest : basedOn,
			note: automatic ? 'Auto-saved' : note,
			// On an essay page the button names the text as it stands, saved or not.
			name: autoSave && !automatic
		});
		const response = await fetch(`/workspace/essays/${identifier}/save`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			// Keepalive lets a save finish after the tab closes, but browsers refuse it over 64 KiB.
			keepalive: last && body.length < keepaliveLimit,
			body
		}).catch(() => null);
		if (!response) {
			status = 'Not saved: the site could not be reached. Your text is kept in this browser; it will try again.';
			if (automatic) retryAutoSave();
			return;
		}
		if (!isSaveAnswer(response)) {
			status = 'Not saved: the site did not answer as expected. Your text is kept in this browser; it will try again.';
			if (automatic) retryAutoSave();
			return;
		}
		const answer = await response.json().catch(() => ({}));
		if (response.status === 401) {
			status = `Not saved: ${answer.message ?? 'you are signed out.'} Your text is kept in this browser.`;
			if (automatic) retryAutoSave();
			return;
		}
		if (response.status === 409) {
			conflict = { latest: answer.latest, latestText: answer.latestText, mine: file };
			status = '';
			return;
		}
		if (!response.ok || typeof answer.number !== 'number') {
			status = `Not saved: ${answer.message ?? response.statusText}. Your text is kept in this browser.`;
			return;
		}
		dropLocalDraft(identifier, file);
		const split = splitFrontMatter(file);
		savedBody = split.body;
		savedFrontMatter = split.frontMatter;
		basedOn = answer.number;
		conflict = null;
		dirty = edits !== editsSent;
		firstUnsavedEdit = null;
		if (dirty) scheduleAutoSave();
		if (!automatic && note) {
			status = `Named version ${answer.number} “${note}”.`;
			note = '';
		} else {
			status = answer.unchanged ? `Nothing changed since version ${answer.number}.` : `Saved as version ${answer.number}.`;
		}
		onsaved?.(answer.number);
	}

	function loadTheirs(): void {
		if (!conflict) return;
		const split = splitFrontMatter(conflict.latestText);
		frontMatter = split.frontMatter;
		savedFrontMatter = split.frontMatter;
		savedBody = split.body;
		basedOn = conflict.latest;
		markdown = split.body;
		if (mode !== 'markdown') mountEditor(split.body);
		dirty = false;
		status = `Showing version ${conflict.latest}. Your text is still in the box below until you leave the page.`;
	}

	function bringBack(): void {
		if (!recovered) return;
		const split = splitFrontMatter(recovered.text);
		if (inRoom && view) {
			// In the room, the kept text replaces the shared text, as one change others see.
			const kept = parseEssay(split.body);
			view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, kept.content));
			frontMatter = split.frontMatter;
			frontMatterEdited();
			recovered = null;
			dropLocalDraft(identifier);
			status = 'Brought back the text kept in this browser.';
			return;
		}
		frontMatter = split.frontMatter;
		// The version it started from, so a newer save by someone else still shows as a conflict.
		basedOn = recovered.basedOn;
		if (mode === 'markdown') markdown = split.body;
		else mountEditor(split.body);
		recovered = null;
		markChanged();
		status = 'Brought back the text kept in this browser.';
	}

	function discardRecovered(): void {
		dropLocalDraft(identifier);
		recovered = null;
	}

	function warnBeforeLeaving(event: BeforeUnloadEvent): void {
		// Connected to the room, the room already has every change.
		if (inRoom && liveStatus?.state === 'live') return;
		if (dirty || frontMatter !== savedFrontMatter) event.preventDefault();
	}

	onMount(() => {
		mountEditor(initial.body);
		dirty = false;
		if (untrack(() => live)) void joinRoom();
		const kept = canEdit ? localDraft(identifier) : null;
		if (kept && kept.text === untrack(() => text)) dropLocalDraft(identifier);
		else if (kept) recovered = kept;
		try {
			if (canEdit && localStorage.getItem(checksKey) === 'on') toggleChecks();
		} catch {
			// As above.
		}
	});

	onDestroy(() => {
		closed = true;
		clearTimeout(autoSaveTimer);
		clearTimeout(joinTimer);
		if (room) {
			// The room saves 5 seconds after the last person leaves; only text it never received needs a copy.
			if (inRoom && liveStatus?.state !== 'live' && unsaved()) keepLocalDraft(identifier, currentFile(), basedOn);
			room.destroy();
			room = null;
		}
		// Closing the editor on an essay page saves what is not saved yet, after any save on its way.
		if (autoSave && canEdit && !conflict && unsaved()) {
			const file = currentFile();
			keepLocalDraft(identifier, file, basedOn);
			void (inFlight ?? Promise.resolve()).then(() => save(false, true, { file, last: true }));
		}
		view?.destroy();
	});

	const marks: { name: 'strong' | 'em' | 'underline' | 'code'; label: string; keys: string }[] = [
		{ name: 'strong', label: 'Bold', keys: 'Ctrl+B' },
		{ name: 'em', label: 'Italic', keys: 'Ctrl+I' },
		{ name: 'underline', label: 'Underline', keys: 'Ctrl+U' },
		{ name: 'code', label: 'Code', keys: 'Ctrl+`' }
	];
	const blocks: { name: string; label: string; command: () => Command }[] = [
		{ name: 'paragraph', label: 'Paragraph', command: () => setBlockType(schema.nodes.paragraph) },
		{ name: 'h2', label: 'Heading', command: () => setBlockType(schema.nodes.heading, { level: 2 }) },
		{ name: 'h3', label: 'Subheading', command: () => setBlockType(schema.nodes.heading, { level: 3 }) },
		{ name: 'h4', label: 'Minor heading', command: () => setBlockType(schema.nodes.heading, { level: 4 }) }
	];
</script>

<svelte:window onbeforeunload={warnBeforeLeaving} />
<svelte:document onvisibilitychange={saveWhenHidden} />

<div class="essay-editor">
	<div class="editor-bar" role="toolbar" aria-label="Editing">
		<div class="tabs" role="group" aria-label="View">
			<button type="button" class="tool" aria-pressed={mode === 'rich'} onclick={() => switchMode('rich')}>Text</button>
			<button
				type="button"
				class="tool"
				aria-pressed={mode === 'markdown'}
				disabled={inRoomShown}
				title={inRoomShown ? 'The Markdown view is off while editing live, so everyone keeps one shared text.' : undefined}
				onclick={() => switchMode('markdown')}>Markdown</button
			>
			<button type="button" class="tool" aria-pressed={mode === 'preview'} onclick={() => switchMode('preview')}>Preview</button>
		</div>
		{#if canEdit && mode === 'rich'}
			<div role="group" aria-label="Paragraph style">
				<label class="visually-hidden" for="block-style">Paragraph style</label>
				<select
					id="block-style"
					value={blocks.some((block) => block.name === active.block) ? active.block : 'paragraph'}
					onchange={(event) => {
						const chosen = blocks.find((block) => block.name === event.currentTarget.value);
						if (chosen) run(chosen.command());
					}}
				>
					{#each blocks as block (block.name)}<option value={block.name}>{block.label}</option>{/each}
				</select>
			</div>
			<div role="group" aria-label="Add">
				<label class="visually-hidden" for="add-block">Add</label>
				<select
					id="add-block"
					value=""
					title="Adds the block where it belongs: a section after the section you are in, anything else after the paragraph you are in"
					onchange={(event) => {
						const chosen = event.currentTarget.value;
						event.currentTarget.value = '';
						addChosen(chosen);
					}}
				>
					<option value="" disabled>Add…</option>
					<option value="section">Section</option>
					<option value="subsection">Subsection</option>
					<option value="paragraph">Paragraph</option>
					<option value="case">Case</option>
					<option value="law">Law</option>
					<option value="quote">Quotation box</option>
					<option value="analysis">Analysis</option>
					<option value="figure">Picture, video or recording</option>
					<option value="chart">Chart</option>
				</select>
			</div>
			<div role="group" aria-label="Move">
				<button type="button" class="tool" title="Move this paragraph, box or section up (Alt+Shift+Up)" onclick={() => run(moveCurrent('up'))}>Move up</button>
				<button type="button" class="tool" title="Move this paragraph, box or section down (Alt+Shift+Down)" onclick={() => run(moveCurrent('down'))}>Move down</button>
			</div>
			<div role="group" aria-label="Text style">
				{#each marks as mark (mark.name)}
					<button type="button" class="tool tool-{mark.name}" aria-pressed={active.marks.has(mark.name)} title="{mark.label} ({mark.keys})" onclick={() => run(toggleMark(schema.marks[mark.name]))}>{mark.label}</button>
				{/each}
				<button type="button" class="tool" aria-pressed={active.marks.has('link')} onclick={() => openPicker('link')}>Link</button>
			</div>
			<div role="group" aria-label="Lists">
				<button type="button" class="tool" onclick={() => run(wrapInList(schema.nodes.bullet_list))}>Bulleted list</button>
				<button type="button" class="tool" onclick={() => run(wrapInList(schema.nodes.ordered_list))}>Numbered list</button>
			</div>
			<div role="group" aria-label="Boxes">
				<button type="button" class="tool" onclick={() => openPicker('case')}>{active.box === 'case_block' ? 'Change case' : 'Case'}</button>
				<button type="button" class="tool" onclick={() => openPicker('law')}>{active.box === 'law_block' ? 'Change law' : 'Law'}</button>
				{#each missingParts as kind (kind)}
					<button type="button" class="tool" onclick={() => run(addBoxPart(kind))}>Add {boxParts[kind]}</button>
				{/each}
				<button type="button" class="tool" onclick={() => run(insertBlock(schema.nodes.quote_block))}>Quotation box</button>
				<button type="button" class="tool" onclick={() => run(wrapIn(schema.nodes.blockquote))}>Quoted passage</button>
				{#if active.inside.has('analysis_block')}
					<button type="button" class="tool" onclick={() => openPicker('analysis-title')}>Analysis title</button>
				{:else}
					<button type="button" class="tool" onclick={() => run(insertBlock(schema.nodes.analysis_block))}>Analysis</button>
				{/if}
				<button type="button" class="tool" onclick={() => run(lift)} title="Take the paragraph out of its box or list">Out of box</button>
			</div>
			<div role="group" aria-label="Figures">
				{#if active.inside.has('table')}
					<button type="button" class="tool" onclick={() => run(addTableRow)}>Add row</button>
					<button type="button" class="tool" onclick={() => run(removeTableRow)}>Remove row</button>
				{/if}
				{#each missingFigureParts as kind (kind)}
					<button type="button" class="tool" onclick={() => run(addFigurePart(kind))}>Add {figureParts[kind]}</button>
				{/each}
			</div>
			<div role="group" aria-label="References">
				<button type="button" class="tool" onclick={() => openPicker('citation')}>Cite a source</button>
				<button type="button" class="tool" onclick={() => openPicker('term')}>Glossary term</button>
			</div>
			<div role="group" aria-label="History">
				<button type="button" class="tool" onclick={() => run(inRoom ? undoCommand : undo)}>Undo</button>
				<button type="button" class="tool" onclick={() => run(inRoom ? redoCommand : redo)}>Redo</button>
			</div>
		{/if}
		{#if mode === 'rich'}
			<div role="group" aria-label="Checks and Go to">
				{#if canEdit}
					<button type="button" class="tool" aria-pressed={showChecks} onclick={toggleChecks}>Checks</button>
				{/if}
				<button type="button" class="tool" aria-pressed={showGoTo} title="Ctrl+G" onclick={() => (showGoTo = !showGoTo)}>Go to</button>
				<button
					type="button"
					class="tool"
					aria-pressed={showSources}
					title="The sources this essay cites, with links to their documents"
					onclick={() => {
						showSources = !showSources;
						if (showSources) void loadLibrary();
					}}>Sources</button
				>
			</div>
		{/if}
	</div>

	{#if showGoTo && mode === 'rich'}
		<EssayGoTo view={() => view} onclose={() => (showGoTo = false)} />
	{/if}
	{#if showChecks && mode === 'rich'}
		<EssayChecks view={() => view} {revision} {identifier} file={currentFile} {library} {canEdit} bind:selected={chosenIssue} />
	{/if}

	{#if showSources && mode === 'rich'}
		<EssaySources view={() => view} {revision} {library} {documents} {loadDocuments} />
	{/if}

	{#if active.citationKeys.length > 0 && mode === 'rich'}
		{#each active.citationKeys as key (key)}
			<p class="small context">
				<span class="muted">Cites {sourceLabels.get(key) ?? key}.</span>
				{#if asked.has(key)}<EssaySourceLinks documents={documents[key]} loading={!(key in documents)} />{/if}
			</p>
		{/each}
	{:else if active.boxSource && mode === 'rich'}
		<p class="small context">
			<span class="muted">In a {active.box === 'law_block' ? 'law' : 'case'}: <code>{active.boxSource}</code>. Its heading on the page is this source’s full citation.</span>
			{#if asked.has(active.boxSource)}<EssaySourceLinks documents={documents[active.boxSource]} loading={!(active.boxSource in documents)} />{/if}
		</p>
	{/if}

	{#if inRoomShown}
		<p class="small live-row" aria-live="polite">
			<span class="live-dot" class:offline={liveStatus?.state !== 'live'} aria-hidden="true"></span>
			{#if people.length === 0}Editing live. No one else is here.{:else}Editing live with {people.join(', ')}.{/if}
		</p>
	{/if}
	{#if liveProblem}
		<div class="notice" role="note"><p>{liveProblem}</p></div>
	{/if}
	{#if recovered}
		<div class="notice" role="note">
			<p>
				This browser kept text from {new Date(recovered.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} that the site never confirmed saving.
				<button type="button" class="button" onclick={bringBack}>Bring it back</button>
				<button type="button" class="button button-quiet" onclick={discardRecovered}>Discard it</button>
			</p>
		</div>
	{/if}
	{#if figureFileNotice && mode === 'rich'}
		<div class="notice" role="note"><p>{figureFileNotice}</p></div>
	{/if}
	<div
		class="editor-area"
		hidden={mode !== 'rich'}
		bind:this={host}
		use:watchFigureFiles={(_media, problem) =>
			(figureFileNotice =
				problem === 'checking'
					? 'A picture, video or recording here is still being checked for viruses. It shows once the check passes, usually within a few minutes.'
					: 'A picture, video or recording here could not be loaded.')}
	></div>

	{#if mode === 'markdown'}
		<label class="visually-hidden" for="markdown-text">Essay text as Markdown</label>
		<textarea
			id="markdown-text"
			class="markdown-text"
			bind:value={markdown}
			readonly={!canEdit}
			oninput={markChanged}
			spellcheck="true"
		></textarea>
	{:else if mode === 'preview'}
		{#if preview}
			{#if preview.problems.length > 0}
				<div class="notice notice-problem" role="alert">
					<p><strong>Publishing will be refused until these are fixed:</strong></p>
					<ul>{#each preview.problems as problem (problem)}<li>{problem}</li>{/each}</ul>
				</div>
			{/if}
			{#if preview.warnings?.length}
				<div class="notice" role="note">
					<p><strong>Check before publishing:</strong></p>
					<ul>{#each preview.warnings as warning, index (index)}<li>{warning}</li>{/each}</ul>
				</div>
			{/if}
			<article class="reading essay">
				<h1>{preview.title}</h1>
				<div class="essay-text" use:figurePlayers>{@html preview.html}</div>
				<SourceList sources={preview.sources} />
			</article>
		{/if}
	{/if}

	<details class="details">
		<summary>Details (front matter)</summary>
		<p class="small">The title, part and status, in YAML. The title shown on the page comes from here.</p>
		<label class="visually-hidden" for="front-matter">Front matter</label>
		<textarea id="front-matter" class="front-matter" bind:value={frontMatter} readonly={!editable()} rows="6" oninput={frontMatterEdited}></textarea>
	</details>

	{#if conflict}
		<div class="notice notice-problem" role="alert">
			<p>
				<strong>Version {conflict.latest} was saved by someone else after you started.</strong>
				Nothing was lost: their version is kept, and your text has not been saved yet.
			</p>
			<p class="row">
				<a class="button button-quiet" href="/workspace/essays/{identifier}/versions/{conflict.latest}" target="_blank" rel="noopener">Read version {conflict.latest}</a>
				<button type="button" class="button" onclick={() => save(true)}>Save mine as the next version anyway</button>
				<button type="button" class="button button-quiet" onclick={loadTheirs}>Switch to version {conflict.latest}</button>
			</p>
			<details>
				<summary>Your text</summary>
				<textarea class="markdown-text" readonly value={conflict.mine}></textarea>
			</details>
		</div>
	{/if}

	{#if canEdit}
		<div class="save-bar">
			{#if autoSave}
				<label for="save-note">Name this version</label>
				<input id="save-note" type="text" bind:value={note} placeholder="Sent to advisors" maxlength="500" />
				<button type="button" class="button button-quiet" onclick={() => save()} disabled={saving || !note.trim()}>Name it</button>
			{:else}
				<label for="save-note">Note for this version (optional)</label>
				<input id="save-note" type="text" bind:value={note} placeholder="Sent to advisors" maxlength="500" />
				<button type="button" class="button" onclick={() => save()} disabled={saving}>Save version</button>
			{/if}
			<span class="small" role="status" aria-live="polite">{status || (liveStatus && inRoomShown ? liveText(liveStatus) : joining ? 'Joining the live room…' : dirty ? 'Unsaved changes' : `Version ${basedOn}`)}</span>
		</div>
	{:else}
		<p class="small muted">You can read this essay. Ask the lead author for contribute access to edit it.</p>
	{/if}
</div>

<EssayFigureDialog bind:this={figureDialog} essay={identifier} onadd={addFigure} />

<dialog bind:this={pickerDialog} class="picker" onclose={() => (picker = null)} aria-labelledby="picker-heading">
	{#if picker}
		<form
			method="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				choose();
			}}
		>
			<h2 id="picker-heading">
				{#if picker === 'citation'}Cite a source{:else if picker === 'case'}Case box: choose the case{:else if picker === 'law'}Law box: choose the act or law{:else if picker === 'term'}Link a glossary term{:else if picker === 'link'}Link{:else}Analysis title{/if}
			</h2>
			{#if picker === 'citation' || picker === 'case' || picker === 'law' || picker === 'term'}
				<div class="field">
					<label for="picker-search">Search</label>
					<input id="picker-search" type="search" bind:value={query} autocomplete="off" placeholder={picker === 'term' ? 'peacemaking' : picker === 'law' ? 'indian civil rights act' : 'worcester georgia'} />
				</div>
				{#if libraryProblem}<p class="field-error">{libraryProblem}</p>{/if}
				<ul class="matches" aria-label="Matches">
					{#each matches as [key, label] (key)}
						<li>
							<button type="button" class="match" aria-pressed={chosenKey === key} onclick={() => (chosenKey = key)}>
								<code>{key}</code> <span class="small">{label}</span>
							</button>
						</li>
					{/each}
				</ul>
				<div class="field">
					<label for="picker-key">{picker === 'term' ? 'Glossary id' : 'Source key'}</label>
					<input id="picker-key" type="text" bind:value={chosenKey} required pattern="@?[a-z0-9]+(-[a-z0-9]+)*" />
				</div>
				{#if picker === 'citation'}
					<div class="field">
						<label for="picker-locator">Where in the source (optional)</label>
						<input id="picker-locator" type="text" bind:value={locator} placeholder="at 561" />
					</div>
				{/if}
				{#if picker === 'term'}
					<div class="field">
						<label for="picker-shown">Words shown (optional)</label>
						<input id="picker-shown" type="text" bind:value={shownText} />
					</div>
				{/if}
			{:else if picker === 'link'}
				<div class="field">
					<label for="picker-address">Web address (leave empty to remove the link)</label>
					<input id="picker-address" type="url" bind:value={linkAddress} placeholder="https://" />
				</div>
			{:else}
				<div class="field">
					<label for="picker-title">Title (optional)</label>
					<input id="picker-title" type="text" bind:value={shownText} />
				</div>
			{/if}
			<p class="row">
				<button class="button" type="submit">{picker === 'link' || picker === 'analysis-title' || editingCitationAt !== null ? 'Apply' : 'Insert'}</button>
				<button class="button button-quiet" type="button" onclick={closePicker}>Cancel</button>
			</p>
		</form>
	{/if}
</dialog>

<style>
	/* One column no wider than the page, so a wide table or a long web address
	   in the essay cannot push the page sideways. */
	.essay-editor {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}

	.editor-bar {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-2) 0;
		background: var(--color-paper);
		border-bottom: 1px solid var(--color-line);
	}

	.editor-bar > div {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.tool {
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-control-border, var(--color-line));
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.tool[aria-pressed='true'] {
		background: var(--color-surface);
		border-color: var(--color-link);
		box-shadow: inset 0 -3px 0 var(--color-link);
	}

	.tool-strong {
		font-weight: var(--font-weight-semibold);
	}

	.tool-em {
		font-style: italic;
	}

	.tool-underline {
		text-decoration: underline;
	}

	.editor-area {
		max-width: var(--layout-measure);
		min-width: 0;
	}

	/* A wide table scrolls in its own box, as it does on the published page. */
	.editor-area :global(.ProseMirror table) {
		display: block;
		overflow-x: auto;
	}

	/* What the checks found (EssayChecks.svelte): wavy for spelling and grammar, dotted for definitions. */
	.editor-area :global(.check-mark) {
		text-decoration-line: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.editor-area :global(.check-spelling) {
		text-decoration-style: wavy;
		text-decoration-color: var(--color-danger);
	}

	.editor-area :global(.check-grammar) {
		text-decoration-style: wavy;
		text-decoration-color: var(--color-link);
	}

	.editor-area :global(.check-definition),
	.editor-area :global(.check-repeated) {
		text-decoration-style: dotted;
		text-decoration-color: var(--color-action);
	}

	.editor-area :global(.ProseMirror) {
		min-height: 60vh;
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		outline: none;
	}

	.editor-area :global(.ProseMirror:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		background: transparent;
		color: inherit;
		box-shadow: none;
	}

	.editor-area :global(.essay-citation-chip),
	.editor-area :global(.essay-term-chip) {
		font-size: var(--font-size-small);
		border-radius: var(--radius-control);
		padding: 0 var(--space-1);
		background: var(--color-surface);
		/* A citation to several sources is long: it wraps, keeping its fill on
		   each line, rather than run off the page. */
		overflow-wrap: anywhere;
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}

	.editor-area :global(.essay-citation-chip) {
		color: var(--color-link);
		cursor: pointer;
	}

	.editor-area :global(.essay-term-chip) {
		text-decoration: underline dotted;
	}

	.editor-area :global(.ProseMirror-selectednode) {
		outline: 2px solid var(--color-link);
	}

	.markdown-text {
		width: 100%;
		min-height: 60vh;
		font-family: var(--font-family-monospace, ui-monospace, monospace);
		font-size: var(--font-size-small);
		line-height: 1.5;
	}

	.front-matter {
		width: 100%;
		max-width: var(--layout-measure);
		font-family: var(--font-family-monospace, ui-monospace, monospace);
	}

	.save-bar {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3) 0;
		background: var(--color-paper);
		border-top: 1px solid var(--color-line);
	}

	.save-bar input {
		flex: 1 1 14rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.picker {
		width: min(40rem, 100% - 2 * var(--space-4));
		max-height: 85vh;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.matches {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-3);
		max-height: 40vh;
		overflow-y: auto;
		border: 1px solid var(--color-line);
	}

	.match {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--space-2);
		border: 0;
		border-bottom: 1px solid var(--color-line);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.match[aria-pressed='true'] {
		background: var(--color-surface);
		box-shadow: inset 4px 0 0 var(--color-link);
	}

	.context {
		margin: 0;
	}

	.live-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
	}

	.live-dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--color-action);
	}

	.live-dot.offline {
		background: var(--color-ink-muted);
	}

	/* Other people's cursors and selections in the live room (y-prosemirror). */
	:global(.ProseMirror-yjs-cursor) {
		position: relative;
		margin-left: -1px;
		margin-right: -1px;
		border-left: 2px solid;
		word-break: normal;
		pointer-events: none;
	}

	:global(.ProseMirror-yjs-cursor > div) {
		position: absolute;
		top: -1.15em;
		left: -2px;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;
		color: var(--color-action-text);
		padding: 0 0.3em;
		border-radius: 0.25em 0.25em 0.25em 0;
		user-select: none;
	}
</style>
