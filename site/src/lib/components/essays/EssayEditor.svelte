<script lang="ts">
	// The essay editor (docs/editing.md). A rich-text view built on
	// ProseMirror, limited to what the website, the print book and the ebook
	// can all show (src/lib/essays/document.ts), with a Markdown view for
	// anything easier to type as text. Saving sends the whole file; the
	// server keeps it as a new version and never overwrites an earlier one.
	// On an essay page (EssayArticle.svelte) it saves by itself: a few
	// seconds after typing stops, at least every half minute while typing
	// goes on, and when the tab is hidden or the editor closes. Those
	// versions carry the note "Auto-saved"; "Name this version" gives the
	// newest one a note of its own.
	import 'prosemirror-view/style/prosemirror.css';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { baseKeymap, lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
	import { history, redo, undo } from 'prosemirror-history';
	import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
	import { keymap } from 'prosemirror-keymap';
	import type { MarkType, Node as EditorNode, NodeType } from 'prosemirror-model';
	import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
	import { EditorState, Plugin, TextSelection, type Command, type Transaction } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import SourceList from '#lib/components/SourceList.svelte';
	import { essaySchema as schema, parseEssay, writeEssay } from '#lib/essays/document.ts';
	import { boxParts, casePartOrder, joinFrontMatter, lawPartOrder, splitFrontMatter, type BoxPart } from '#lib/essays/syntax.ts';
	import type { RenderedEssay } from '#lib/essays/render.ts';

	let {
		identifier,
		text,
		version,
		canEdit,
		autoSave = false,
		onsaved
	}: {
		identifier: string;
		text: string;
		version: number;
		canEdit: boolean;
		/** Save by itself as the person types (on an essay page). */
		autoSave?: boolean;
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
	}>({
		marks: new Set(),
		block: 'paragraph',
		inside: new Set(),
		box: null,
		boxSource: null,
		boxParts: new Set(),
		analysisTitle: null
	});
	/** The parts the box around the cursor can take and does not have yet. */
	const missingParts = $derived(
		active.box ? (active.box === 'law_block' ? lawPartOrder : casePartOrder).filter((kind) => !active.boxParts.has(kind)) : []
	);

	/* Dialogs --------------------------------------------------------------- */

	type Picker = 'citation' | 'case' | 'law' | 'term' | 'link' | 'analysis-title';
	let picker = $state<Picker | null>(null);
	let pickerDialog: HTMLDialogElement | undefined = $state();
	let query = $state('');
	let locator = $state('');
	let chosenKey = $state('');
	let linkAddress = $state('');
	let shownText = $state('');
	let editingCitationAt = $state<number | null>(null);
	let library = $state<{ sources: [string, string][]; terms: [string, string][] } | null>(null);
	let libraryProblem = $state('');

	async function loadLibrary(): Promise<void> {
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
		if (!view || !canEdit) return;
		command(view.state, view.dispatch, view);
		view.focus();
	}

	function markActive(state: EditorState, type: MarkType): boolean {
		const { from, to, empty } = state.selection;
		if (empty) return Boolean(type.isInSet(state.storedMarks ?? state.selection.$from.marks()));
		return state.doc.rangeHasMark(from, to, type);
	}

	/** Inserts a block, or wraps the selected blocks in it when text is selected. */
	function insertBlock(type: NodeType, attrs: Record<string, unknown> = {}, content?: () => EditorNode): Command {
		return (state, dispatch) => {
			if (!state.selection.empty && wrapIn(type, attrs)(state)) return wrapIn(type, attrs)(state, dispatch);
			const node = content ? content() : type.create(attrs, schema.node('paragraph'));
			if (!dispatch) return true;
			const from = state.selection.from;
			const transaction = state.tr.replaceSelectionWith(node);
			// Put the cursor in the new box's first paragraph, selecting any
			// placeholder words so typing replaces them.
			let inserted = -1;
			transaction.doc.nodesBetween(Math.max(0, from - 2), transaction.doc.content.size, (child, position) => {
				if (inserted >= 0) return false;
				if (child.type === type && position >= from - 2) inserted = position;
				return inserted < 0;
			});
			if (inserted >= 0) {
				const inside = TextSelection.findFrom(transaction.doc.resolve(inserted + 1), 1, true);
				if (inside) {
					const end = inside.$from.end();
					transaction.setSelection(TextSelection.create(transaction.doc, inside.from, end));
				}
			}
			dispatch(transaction.scrollIntoView());
			return true;
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

	function partsOf(node: EditorNode | undefined): Set<string> {
		const kinds = new Set<string>();
		node?.forEach((child) => {
			if (child.type.name === 'case_part') kinds.add(child.attrs.kind);
		});
		return kinds;
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
			analysisTitle: enclosing(state, 'analysis_block')?.node.attrs.title ?? null
		};
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
					if (!editorView.state.doc.eq(previous.doc)) markChanged();
					describe(editorView.state);
				}
			})
		});
		return EditorState.create({
			doc: parseEssay(body),
			plugins: [
				rules,
				keymap({
					'Mod-z': undo,
					'Shift-Mod-z': redo,
					'Mod-y': redo,
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
					}
				}),
				keymap(baseKeymap),
				history(),
				tracker
			]
		});
	}

	function mountEditor(body: string): void {
		view?.destroy();
		if (!host) return;
		view = new EditorView(host, {
			state: createState(body),
			editable: () => canEdit,
			attributes: { class: 'essay-editor-text essay-text', 'aria-label': 'Essay text', role: 'textbox', 'aria-multiline': 'true' },
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
		if (!autoSave || !canEdit || conflict || closed) return;
		firstUnsavedEdit ??= Date.now();
		clearTimeout(autoSaveTimer);
		const untilLongest = firstUnsavedEdit + autoSaveLongestMilliseconds - Date.now();
		autoSaveTimer = setTimeout(() => void autoSaveNow(), Math.max(0, Math.min(autoSaveIdleMilliseconds, untilLongest)));
	}

	async function autoSaveNow(): Promise<void> {
		clearTimeout(autoSaveTimer);
		if (!autoSave || !canEdit || conflict || !(dirty || frontMatter !== savedFrontMatter)) return;
		if (saving) {
			scheduleAutoSave();
			return;
		}
		await save(false, true);
	}

	function saveWhenHidden(): void {
		if (document.visibilityState === 'hidden') void autoSaveNow();
	}

	async function save(saveOver = false, automatic = false): Promise<void> {
		if (!canEdit || saving) return;
		saving = true;
		status = automatic ? 'Saving by itself…' : 'Saving…';
		const file = currentFile();
		const editsSent = edits;
		const response = await fetch(`/workspace/essays/${identifier}/save`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			keepalive: automatic,
			body: JSON.stringify({
				text: file,
				basedOn: saveOver && conflict ? conflict.latest : basedOn,
				note: automatic ? 'Auto-saved' : note
			})
		}).catch(() => null);
		saving = false;
		if (!response) {
			status = 'Not saved: the site could not be reached. Your text is still here; try again.';
			if (automatic) scheduleAutoSave();
			return;
		}
		const answer = await response.json().catch(() => ({}));
		if (response.status === 409) {
			conflict = { latest: answer.latest, latestText: answer.latestText, mine: file };
			status = '';
			return;
		}
		if (!response.ok) {
			status = `Not saved: ${answer.message ?? response.statusText}`;
			return;
		}
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

	function warnBeforeLeaving(event: BeforeUnloadEvent): void {
		if (dirty || frontMatter !== savedFrontMatter) event.preventDefault();
	}

	onMount(() => {
		mountEditor(initial.body);
		dirty = false;
	});

	onDestroy(() => {
		// Closing the editor on an essay page saves what is not saved yet.
		if (autoSave) void autoSaveNow();
		closed = true;
		clearTimeout(autoSaveTimer);
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
			<button type="button" class="tool" aria-pressed={mode === 'markdown'} onclick={() => switchMode('markdown')}>Markdown</button>
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
			<div role="group" aria-label="References">
				<button type="button" class="tool" onclick={() => openPicker('citation')}>Cite a source</button>
				<button type="button" class="tool" onclick={() => openPicker('term')}>Glossary term</button>
			</div>
			<div role="group" aria-label="History">
				<button type="button" class="tool" onclick={() => run(undo)}>Undo</button>
				<button type="button" class="tool" onclick={() => run(redo)}>Redo</button>
			</div>
		{/if}
	</div>

	{#if active.boxSource && mode === 'rich'}
		<p class="small muted context">In a {active.box === 'law_block' ? 'law' : 'case'}: <code>{active.boxSource}</code>. Its heading on the page is this source’s full citation.</p>
	{/if}

	<div class="editor-area" hidden={mode !== 'rich'} bind:this={host}></div>

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
				<div class="essay-text">{@html preview.html}</div>
				<SourceList sources={preview.sources} />
			</article>
		{/if}
	{/if}

	<details class="details">
		<summary>Details (front matter)</summary>
		<p class="small">The title, part and status, in YAML. The title shown on the page comes from here.</p>
		<label class="visually-hidden" for="front-matter">Front matter</label>
		<textarea id="front-matter" class="front-matter" bind:value={frontMatter} readonly={!canEdit} rows="6" oninput={markChanged}></textarea>
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
			<span class="small" role="status" aria-live="polite">{status || (dirty ? 'Unsaved changes' : `Version ${basedOn}`)}</span>
		</div>
	{:else}
		<p class="small muted">You can read this essay. Ask the lead author for contribute access to edit it.</p>
	{/if}
</div>

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
	.essay-editor {
		display: grid;
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
		white-space: nowrap;
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
</style>
