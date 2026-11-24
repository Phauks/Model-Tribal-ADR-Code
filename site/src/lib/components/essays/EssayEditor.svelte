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
	import { history, redo, undo, undoDepth } from 'prosemirror-history';
	import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
	import { keymap } from 'prosemirror-keymap';
	import type { MarkType, Node as EditorNode, NodeType } from 'prosemirror-model';
	import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
	import { EditorState, NodeSelection, Plugin, PluginKey, TextSelection, type Command, type Transaction } from 'prosemirror-state';
	import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
	import {
		initProseMirrorDoc,
		redoCommand,
		absolutePositionToRelativePosition,
		relativePositionToAbsolutePosition,
		undoCommand,
		yCursorPlugin,
		ySyncPlugin,
		ySyncPluginKey,
		yUndoPlugin,
		yUndoPluginKey
	} from 'y-prosemirror';
	import * as Y from 'yjs';
	import { personColor, personTone, type PersonTone } from '#lib/essays/person-look.ts';
	import { draftMarks, draftMarksKey, draftMarksPlugin } from '#lib/essays/draft-marks.ts';
	import { editorOutline, outlineAnchors } from '#lib/essays/editor-outline.ts';
	import type { OutlineItem } from '#lib/site-sections.ts';
	import { caseHeadings } from '#lib/essays/case-headings.ts';
	import { agoText, nextSteps, type UndoStep } from '#lib/essays/undo-steps.ts';
	import { components as componentList } from '#lib/essays/components.ts';
	import { counts as countWords, textBlocks } from '#lib/essays/checks.ts';
	import { joinEssayRoom, type EssayRoom, type LiveStatus } from '#lib/essays/live.ts';
	import SourceList from '#lib/components/SourceList.svelte';
	import { essaySchema as schema, parseEssay, writeEssay } from '#lib/essays/document.ts';
	import { boxParts, casePartOrder, citationReferences, joinFrontMatter, lawPartOrder, splitFrontMatter, type BoxPart } from '#lib/essays/syntax.ts';
	import type { RenderedEssay } from '#lib/essays/render.ts';
	import { componentFrames } from '#lib/essays/components.ts';
	import { checkMarks, issueAt } from '#lib/essays/check-marks.ts';
	import EssayChecks from '#lib/components/essays/EssayChecks.svelte';
	import EssayGoTo from '#lib/components/essays/EssayGoTo.svelte';
	import EssayFigureDialog from '#lib/components/essays/EssayFigureDialog.svelte';
	import EssayCreditsPopover from '#lib/components/essays/EssayCreditsPopover.svelte';
	import EssayComments from '#lib/components/essays/EssayComments.svelte';
	import PersonAvatar from '#lib/components/essays/PersonAvatar.svelte';
	import EssayShareDialog from '#lib/components/essays/EssayShareDialog.svelte';
	import type { Snippet } from 'svelte';
	import { offerPageTools } from '#lib/page-editing.svelte.ts';
	import Bold from '@lucide/svelte/icons/bold';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import CloudCheck from '@lucide/svelte/icons/cloud-check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import CloudUpload from '@lucide/svelte/icons/cloud-upload';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Italic from '@lucide/svelte/icons/italic';
	import Link from '@lucide/svelte/icons/link';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus';
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Plus from '@lucide/svelte/icons/plus';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Share2 from '@lucide/svelte/icons/share-2';
	import SpellCheck from '@lucide/svelte/icons/spell-check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Undo from '@lucide/svelte/icons/undo';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import CiteIcon from '@lucide/svelte/icons/quote';
	import Underline from '@lucide/svelte/icons/underline';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { inReviewText, isOpen, openRequestsOn, waitsOn, type ReviewRequest } from '#lib/essays/review-requests.ts';
	import { commentAt, commentMarks, showCommentMarks, type CommentMark } from '#lib/essays/comment-marks.ts';
	import { findQuote, quoteAt, type TextQuote } from '#lib/essays/comment-anchors.ts';
	import type { CommentAsk, CommentDraft, EssayComment } from '#lib/essays/comments.ts';
	import { creditLines, setCreditLines } from '#lib/essays/credit-lines.ts';
	import type { EssayCredits } from '#lib/essays/credits.ts';
	import { essaySections } from '#lib/essays/sections.ts';
	import EssaySources from '#lib/components/essays/EssaySources.svelte';
	import EssaySourceLinks from '#lib/components/essays/EssaySourceLinks.svelte';
	import { citationWithoutAddress, type SourceDocuments } from '#lib/essays/source-documents.ts';
	import { figurePartOrder, figureParts, figurePartsFor, type FigureKind, type FigurePart, type NewFigure } from '#lib/essays/figures.ts';
	import { figurePlayers, watchFigureFiles } from '#lib/essays/figure-players.ts';
	import { essayChartFrom } from '#lib/table-builder.ts';
	import { addAfterCurrent, addSection, moveCurrent } from '#lib/essays/placement.ts';
	import { dropLocalDraft, isSaveAnswer, keepaliveLimit, keepLocalDraft, localDraft, type LocalDraft } from '#lib/essays/local-draft.ts';

	let {
		identifier,
		text,
		version,
		canEdit,
		autoSave = false,
		live = false,
		startAt = null,
		startThread = null,
		publishedText = null,
		publishedVersion = null,
		yourName = null,
		toolsInMasthead = false,
		titleExtras,
		addChart = null,
		onsaved,
		onoutline,
		onchartadded
	}: {
		identifier: string;
		text: string;
		version: number;
		canEdit: boolean;
		/** Save by itself as the person types (on an essay page). */
		autoSave?: boolean;
		/** Join the essay's live editing room when it can be reached. */
		live?: boolean;
		/** A section's heading id to open the editor at, such as one asked to be reviewed. */
		startAt?: string | null;
		/** A comment thread to open the editor at, from the Comments for you page. */
		startThread?: string | null;
		/**
		 * Show the bar in the masthead's second row instead of above the text,
		 * so the page starts where it does for readers (on an essay page;
		 * src/lib/page-editing.svelte.ts).
		 */
		toolsInMasthead?: boolean;
		/** The published body, to mark what the draft changed ("With drafts", essay-editor-mockups/4 and v2-1). */
		publishedText?: string | null;
		publishedVersion?: number | null;
		/** The person's own name, shown to others in the live room. */
		yourName?: string | null;
		/** Shown under the essay's title in the text, such as where the draft stands. */
		titleExtras?: Snippet<[TitleExtras]>;
		/** Called with the version number after each save. */
		onsaved?: (version: number) => void;
		/** Called with the essay's outline as the draft stands, for the sidebar (editor-outline.ts). */
		onoutline?: (items: OutlineItem[]) => void;
		/** A Build a table address whose chart to add at the end of the essay once the editor is ready (?add-chart=). */
		addChart?: string | null;
		/** Called once the asked-for chart is added, or could not be. */
		onchartadded?: () => void;
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
		/** Whether words are selected, which a comment needs. */
		hasSelection: boolean;
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
		citationKeys: [],
		hasSelection: false
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

	/* Credits under each heading (credits.ts) ------------------------------ */

	let creditsPopover: ReturnType<typeof EssayCreditsPopover> | undefined = $state();
	let credits = $state<EssayCredits | null>(null);
	let creditsTimer: ReturnType<typeof setTimeout> | undefined;

	/** The credits for the newest saved version, and the credits added by hand. */
	async function loadCredits(): Promise<void> {
		const response = await fetch(`/workspace/essays/${identifier}/credits`).catch(() => null);
		if (!response?.ok) return;
		creditsChanged((await response.json()) as EssayCredits);
	}

	function creditsChanged(updated: EssayCredits): void {
		credits = updated;
		if (view) setCreditLines(view, { credits: updated });
	}

	// A new saved version can change who wrote what.
	$effect(() => {
		if (!credits || basedOn === credits.version) return;
		clearTimeout(creditsTimer);
		creditsTimer = setTimeout(() => void loadCredits(), 1500);
	});

	/* Sharing and review requests (review-requests.ts) ---------------------- */

	let shareDialog: ReturnType<typeof EssayShareDialog> | undefined = $state();
	let reviewRequests = $state<ReviewRequest[]>([]);
	let reviewingPerson = $state<string | null>(null);
	let reviewProblem = $state('');
	const wholeDraftReviews = $derived(openRequestsOn(reviewRequests, null));

	async function loadReviewRequests(): Promise<void> {
		const response = await fetch(`/workspace/essays/${identifier}/sharing`).catch(() => null);
		if (!response?.ok) return;
		const body = (await response.json()) as { requests: ReviewRequest[]; you: string };
		reviewingPerson = body.you;
		reviewRequestsChanged(body.requests);
	}

	function reviewRequestsChanged(updated: ReviewRequest[]): void {
		reviewRequests = updated;
		if (view) setCreditLines(view, { requests: updated, you: reviewingPerson });
		refreshDraftMarksSoon();
	}

	async function finishReview(request: string): Promise<void> {
		reviewProblem = '';
		const response = await fetch(`/workspace/essays/${identifier}/sharing?request=${encodeURIComponent(request)}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ done: true })
		}).catch(() => null);
		const body = (await response?.json().catch(() => null)) as { requests?: ReviewRequest[]; message?: string } | null;
		if (!response?.ok || !body?.requests) {
			reviewProblem = body?.message || 'That did not go through. Try again.';
			return;
		}
		reviewRequestsChanged(body.requests);
	}

	function openShare(): void {
		if (!view) return;
		const doc = view.state.doc;
		const sections = essaySections(doc);
		const block = view.state.selection.$from.index(0);
		const here = sections.filter((candidate) => candidate.index <= block).at(-1);
		void shareDialog?.show({ sections: sections.map(({ slug, title, level }) => ({ slug, title, level })), version: basedOn, section: here?.slug });
	}

	/** Puts the cursor at a section's heading and scrolls it into view. */
	function goToSection(slug: string): void {
		if (!view) return;
		const doc = view.state.doc;
		const found = essaySections(doc).find((candidate) => candidate.slug === slug);
		if (!found) return;
		let start = 0;
		doc.forEach((_node, offset, index) => {
			if (index === found.index) start = offset;
		});
		view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, start + 1)).scrollIntoView());
		(view.domAtPos(start + 1).node as HTMLElement | null)?.parentElement?.scrollIntoView({ block: 'center' });
	}

	/* With drafts, the title's extras and the undo history ------------------- */

	/** What the page shows under the title: how many sections are in review, and the essay's size. */
	interface TitleExtras {
		inReview: number;
		components: number;
		words: number;
		/** The numbered lines, in commenting. */
		lines: number;
	}

	const publishedDoc = untrack(() => (publishedText !== null && publishedVersion !== null ? parseEssay(publishedText) : null));
	let draftTimer: ReturnType<typeof setTimeout> | undefined;

	function refreshDraftMarksSoon(): void {
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			if (!closed && view) view.dispatch(view.state.tr.setMeta(draftMarksKey, true).setMeta('addToHistory', false));
			refreshOutline();
		}, 500);
	}

	/** Gives the sidebar the essay's outline as the draft stands (editor-outline.ts). */
	function refreshOutline(): void {
		if (closed || !view || !onoutline) return;
		const doc = view.state.doc;
		onoutline(
			editorOutline(doc, {
				marks: publishedDoc ? draftMarks(doc, publishedDoc) : new Map(),
				inReview: reviewedSections(),
				citations: citationsByKey
			})
		);
	}

	/** The element under the title that holds `titleExtras`; the editor shows it after the title heading. */
	let extrasHost: HTMLDivElement | undefined = $state();
	const titleExtrasKey = new PluginKey('title-extras');

	function titleExtrasPlugin(): Plugin {
		return new Plugin({
			key: titleExtrasKey,
			props: {
				decorations: (state) => {
					if (!extrasHost) return null;
					const first = state.doc.firstChild;
					const at = first?.type.name === 'heading' && Number(first.attrs.level) === 1 ? first.nodeSize : 0;
					const host = extrasHost;
					return DecorationSet.create(state.doc, [Decoration.widget(at, () => host, { key: 'title-extras', side: -1, ignoreSelection: true, stopEvent: () => true })]);
				}
			}
		});
	}

	/** Goes up by one each time the editor is made, so what is worked out from its text is worked out again. */
	let mounts = $state(0);
	const titleNumbers = $derived.by(() => {
		void revision;
		void mounts;
		const doc = view?.state.doc;
		if (!doc) return { components: 0, words: 0, lines: 0 };
		return { components: componentList(doc).length, words: countWords(textBlocks(doc)).words, lines: gutterLines.length };
	});
	/** The heading ids of the sections someone was asked to review and has not finished. */
	function reviewedSections(): Set<string> {
		return new Set(reviewRequests.filter((request) => isOpen(request) && request.sectionSlug).map((request) => request.sectionSlug as string));
	}
	const sectionsInReview = $derived(reviewedSections().size);

	/** This person's own steps in this session, newest first (essay-editor-mockups/v2-2). */
	let steps = $state<UndoStep[]>([]);
	let stepsMenu: HTMLDetailsElement | undefined = $state();
	let clock = $state(Date.now());

	function undoDepthOf(state: EditorState): number {
		const shared = yUndoPluginKey.getState(state) as { undoManager?: { undoStack: unknown[] } } | undefined;
		return shared?.undoManager ? shared.undoManager.undoStack.length : undoDepth(state);
	}

	/** Undoes back to a step, so the text is as it was before that step. */
	function undoTo(step: UndoStep): void {
		if (stepsMenu) stepsMenu.open = false;
		if (!view) return;
		for (let times = undoDepthOf(view.state) - (step.depth - 1); times > 0; times -= 1) {
			if (!(inRoom ? undoCommand : undo)(view.state, view.dispatch)) break;
		}
		view.focus();
	}

	/* Comments (comments.ts; EssayComments.svelte) -------------------------- */

	let comments = $state<EssayComment[]>([]);
	let commentsLoaded = false;
	let commentingPerson = $state<string | null>(null);
	let mayResolveAny = $state(false);
	let pendingComment = $state<CommentDraft | null>(null);
	let currentThread = $state<string | null>(null);
	let threadPositions = $state<Map<string, number | null>>(new Map());
	/** How far down the text each thread's words are, for its card in the margin. */
	let threadTops = $state<Map<string, number>>(new Map());
	/** The line each thread's words start on, in commenting. */
	let threadLines = $state<Map<string, number>>(new Map());
	let commentTimer: ReturnType<typeof setTimeout> | undefined;
	let commentPoll: ReturnType<typeof setInterval> | undefined;
	let commentProblem = $state('');
	/** The text and the comments beside it. */
	let textAndMargin: HTMLDivElement | undefined = $state();
	let marginWidth = $state(0);
	/** The cards sit beside their words when there is room for both. */
	const aligned = $derived(marginWidth >= 760);
	/** Where the menu for the selected words sits, in commenting. */
	let selectionMenu = $state<{ top: number; left: number } | null>(null);

	async function loadComments(): Promise<void> {
		const response = await fetch(`/workspace/essays/${identifier}/comments`).catch(() => null);
		if (!response?.ok) return;
		const body = (await response.json()) as { comments: EssayComment[]; you: string; mayResolveAny: boolean };
		commentingPerson = body.you;
		mayResolveAny = body.mayResolveAny;
		commentsChanged(body.comments);
	}

	function commentsChanged(updated: EssayComment[]): void {
		comments = updated;
		commentsLoaded = true;
		placeComments();
	}

	/** How far down the text a position is, in pixels. */
	function topOf(position: number): number {
		if (!view || !textAndMargin) return 0;
		try {
			return view.coordsAtPos(position).top - textAndMargin.getBoundingClientRect().top;
		} catch {
			return 0;
		}
	}

	/* Line numbers in commenting (essay-editor-mockups/4-commenting) ---------- */

	/** One line of text as it wraps on the screen, how far down the text it is, and its number. */
	interface GutterLine {
		top: number;
		height: number;
		number: number;
	}

	/** DRAFT or NEW beside the first line of a changed or new component. */
	interface GutterLabel {
		top: number;
		height: number;
		text: 'Draft' | 'New';
	}

	let gutterLines = $state<GutterLine[]>([]);
	let gutterLabels = $state<GutterLabel[]>([]);

	/** The lines a component's text takes on the screen, top to bottom; labels and other words that are not the text are left out. */
	function screenLines(block: HTMLElement): { top: number; bottom: number }[] {
		const rects: DOMRect[] = [];
		const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
		const range = document.createRange();
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!node.textContent?.trim()) continue;
			const apart = node.parentElement?.closest('[contenteditable="false"]');
			if (apart && block.contains(apart)) continue;
			range.selectNodeContents(node);
			for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) rects.push(rect);
		}
		rects.sort((first, second) => first.top - second.top);
		const rows: { top: number; bottom: number }[] = [];
		for (const rect of rects) {
			const row = rows.at(-1);
			const middle = (rect.top + rect.bottom) / 2;
			if (row && middle >= row.top && middle <= row.bottom) row.bottom = Math.max(row.bottom, rect.bottom);
			else rows.push({ top: rect.top, bottom: rect.bottom });
		}
		return rows;
	}

	/** Numbers each line of the text as it wraps, below the title, as on the commenting mockup. */
	function measureLines(): void {
		if (canEdit || !view || !textAndMargin || mode !== 'rich') {
			gutterLines = [];
			gutterLabels = [];
			return;
		}
		const base = textAndMargin.getBoundingClientRect().top;
		const lines: GutterLine[] = [];
		const labels: GutterLabel[] = [];
		for (const block of Array.from(view.dom.children) as HTMLElement[]) {
			if (block.classList.contains('essay-title') || block.classList.contains('ProseMirror-widget')) continue;
			const rows = screenLines(block);
			const mark = block.classList.contains('draft-new') ? 'New' : block.classList.contains('draft-changed') ? 'Draft' : null;
			if (mark) {
				const first = rows[0] ?? { top: block.getBoundingClientRect().top, bottom: block.getBoundingClientRect().top + 24 };
				labels.push({ top: (mark === 'New' ? block.getBoundingClientRect().top : first.top) - base, height: first.bottom - first.top, text: mark });
			}
			for (const row of rows) lines.push({ top: row.top - base, height: row.bottom - row.top, number: lines.length + 1 });
		}
		gutterLines = lines;
		gutterLabels = labels;
	}

	/** The number of the line a position in the text is on. */
	function lineAt(position: number): number | null {
		if (gutterLines.length === 0) return null;
		const top = topOf(position);
		let found: GutterLine | null = null;
		for (const line of gutterLines) if (line.top <= top + 2) found = line;
		return found?.number ?? null;
	}

	/** Finds each thread's words in the text as it stands, highlights the open ones, and lines their cards up with them. */
	function placeComments(): void {
		if (!view) return;
		const doc = view.state.doc;
		const positions = new Map<string, number | null>();
		const tops = new Map<string, number>();
		const lines = new Map<string, number>();
		const marks: CommentMark[] = [];
		measureLines();
		if (commentsLoaded) {
			for (const comment of comments) {
				if (comment.threadIdentifier !== null || !comment.quote) continue;
				const found = findQuote(doc, { quote: comment.quote, prefix: comment.quotePrefix ?? '', suffix: comment.quoteSuffix ?? '' });
				positions.set(comment.identifier, found?.from ?? null);
				if (found && !comment.resolvedAt) {
					marks.push({ thread: comment.identifier, ...found });
					tops.set(comment.identifier, topOf(found.from));
					const line = lineAt(found.from);
					if (line !== null) lines.set(comment.identifier, line);
				}
			}
		}
		if (pendingComment) {
			const found = findQuote(doc, pendingComment.quote);
			if (found) {
				marks.push({ thread: 'new', ...found });
				tops.set('new', topOf(found.from));
				const line = lineAt(found.from);
				if (line !== null) lines.set('new', line);
			}
		}
		threadPositions = positions;
		threadTops = tops;
		threadLines = lines;
		placePeople();
		showCommentMarks(view, marks, pendingComment ? 'new' : currentThread);
	}

	function placeCommentsSoon(): void {
		clearTimeout(commentTimer);
		commentTimer = setTimeout(placeComments, 400);
	}

	/** Starts a comment on the selected words: a plain one, or Suggest with the words to rewrite. */
	function startComment(kind: 'comment' | 'suggest' = 'comment'): boolean {
		if (!view || view.state.selection.empty) return false;
		const quote = quoteAt(view.state.doc, view.state.selection.from, view.state.selection.to);
		if (!quote) return false;
		pendingComment = kind === 'suggest' ? { quote, asks: ['rewrite'], body: quote.quote, suggest: true } : { quote, asks: [], body: '' };
		currentThread = null;
		collapseSelection();
		if (!commentsLoaded) void loadComments();
		placeComments();
		return true;
	}

	/** A one-click ask on the selected words, such as "Show your sources", sent at once. */
	async function quickAsk(ask: CommentAsk): Promise<void> {
		if (!view || view.state.selection.empty) return;
		const quote = quoteAt(view.state.doc, view.state.selection.from, view.state.selection.to);
		if (!quote) return;
		collapseSelection();
		commentProblem = '';
		const response = await fetch(`/workspace/essays/${identifier}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ body: '', asks: [ask], quote, version })
		}).catch(() => null);
		const answer = (await response?.json().catch(() => null)) as { comments?: EssayComment[]; message?: string } | null;
		if (!response?.ok || !answer?.comments) {
			commentProblem = answer?.message || 'That did not go through. Try again.';
			return;
		}
		const before = new Set(comments.map((comment) => comment.identifier));
		const added = answer.comments.find((comment) => !before.has(comment.identifier) && comment.threadIdentifier === null);
		if (added) currentThread = added.identifier;
		commentsChanged(answer.comments);
	}

	/** Ends the selection once its words have a comment, so the highlight shows them instead. */
	function collapseSelection(): void {
		selectionMenu = null;
		if (!view || view.state.selection.empty) return;
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.selection.to)).setMeta('addToHistory', false));
		window.getSelection()?.removeAllRanges();
	}

	/** Puts the menu for the selected words above them, in commenting only. */
	function placeSelectionMenu(editorView: EditorView): void {
		const selection = editorView.state.selection;
		// Selected words in commenting, and in editing too (Trevor, Nov. 24, 2026: comment on what is highlighted).
		if (selection.empty || !(selection instanceof TextSelection) || pendingComment || !textAndMargin || mode !== 'rich') {
			selectionMenu = null;
			return;
		}
		try {
			const box = textAndMargin.getBoundingClientRect();
			const start = editorView.coordsAtPos(selection.from);
			const end = editorView.coordsAtPos(selection.to);
			const area = host?.getBoundingClientRect();
			const middle = start.top === end.top ? (start.left + end.left) / 2 : ((area?.left ?? box.left) + (area?.right ?? box.right)) / 2;
			selectionMenu = { top: start.top - box.top, left: middle - box.left };
		} catch {
			selectionMenu = null;
		}
	}

	/** Goes to a thread's words in the editor. */
	function goToThread(thread: string): void {
		currentThread = thread;
		placeComments();
		if (!view) return;
		const comment = comments.find((candidate) => candidate.identifier === thread);
		if (!comment?.quote) return;
		const found = findQuote(view.state.doc, { quote: comment.quote, prefix: comment.quotePrefix ?? '', suffix: comment.quoteSuffix ?? '' });
		if (!found) return;
		// The highlight shows the words; the cursor goes to them without selecting, so no menu opens.
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, found.from)).setMeta('addToHistory', false));
		(view.domAtPos(found.from).node as Element | null)?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	// The comment being written, or the one chosen, moves the highlight.
	$effect(() => {
		void pendingComment;
		void currentThread;
		untrack(() => placeComments());
	});

	// Others' new comments arrive within a minute.
	$effect(() => {
		clearInterval(commentPoll);
		if (mode === 'rich') commentPoll = setInterval(() => void loadComments(), 60_000);
		return () => clearInterval(commentPoll);
	});

	// The cards follow the text when the window or a picture changes its height.
	$effect(() => {
		if (!textAndMargin) return;
		const observer = new ResizeObserver(() => {
			marginWidth = textAndMargin?.clientWidth ?? 0;
			placeCommentsSoon();
		});
		observer.observe(textAndMargin);
		if (host) observer.observe(host);
		return () => observer.disconnect();
	});

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
	/** Each source's citation as plain text, by key, for the headings of case and law boxes (case-headings.ts). */
	let citationsByKey: Map<string, string> | null = null;

	// Once the sources are in, the case and law boxes show their citations.
	$effect(() => {
		const loaded = library;
		if (!loaded) return;
		untrack(() => {
			citationsByKey = new Map(loaded.sources);
			view?.dispatch(view.state.tr.setMeta('addToHistory', false));
			refreshOutline();
		});
	});

	/** Puts the cursor in a case or law box and opens the picker to change its source. */
	function changeBoxSource(position: number, kind: 'case' | 'law'): void {
		if (!view) return;
		view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position + 2))));
		openPicker(kind);
	}

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
		else if (chosen === 'passage') run(addAfterCurrent(schema.node('blockquote', null, schema.node('paragraph'))));
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

	/**
	 * Adds a chart from Build a table at the end of the essay (Trevor, Nov.
	 * 24, 2026: making our own charts should be "the same flow"): its title as
	 * the caption, its numbers as of today as the table, and a source line
	 * that links back to the builder (src/lib/table-builder.ts, essayChartFrom).
	 */
	async function placeChart(link: string): Promise<void> {
		const chart = await essayChartFrom(link);
		// Let the live room's text settle into the editor first.
		await new Promise((resolve) => setTimeout(resolve, 300));
		if (closed || !view) return;
		if (!chart) {
			figureFileNotice = 'That chart could not be read from Build a table. Add it with Add, then Chart.';
			onchartadded?.();
			return;
		}
		const node = schema.node('figure_block', { kind: 'chart', address: '' }, [
			...blocksOf(chart.caption),
			schema.node('table', null, [
				tableRow([chart.labelHeader, chart.valueHeader], true),
				...chart.rows.map(([label, value]) => tableRow([label, value.toLocaleString('en-US')]))
			]),
			newFigurePart('credit', chart.credit)
		]);
		const at = view.state.doc.content.size;
		const transaction = view.state.tr.insert(at, node);
		transaction.setSelection(TextSelection.near(transaction.doc.resolve(at + 1)));
		view.dispatch(transaction.scrollIntoView());
		(view.nodeDOM(at) as HTMLElement | null)?.scrollIntoView?.({ block: 'start' });
		onchartadded?.();
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
			citationKeys: citationAt(state),
			hasSelection: !state.selection.empty
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
						placeCommentsSoon();
						refreshDraftMarksSoon();
					}
					describe(editorView.state);
					placeSelectionMenu(editorView);
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
					'Mod-Alt-m': () => startComment(),
					'Mod-g': () => {
						showGoTo = true;
						return true;
					}
				}),
				keymap(baseKeymap),
				...(shared && room
					? [ySyncPlugin(room.fragment, { mapping: shared.mapping }), yCursorPlugin(room.awareness, { cursorBuilder: presenceCursor, selectionBuilder: presenceSelection }), yUndoPlugin()]
					: [history()]),
				checkMarks(),
				commentMarks(),
				// In commenting, the words chosen stay marked while their menu is open, even when the browser drops its own selection.
				new Plugin({
					props: {
						decorations: (state) =>
							canEdit || state.selection.empty || pendingComment
								? null
								: DecorationSet.create(state.doc, [Decoration.inline(state.selection.from, state.selection.to, { class: 'selected-words' })])
					}
				}),
				componentFrames(),
				draftMarksPlugin(() => ({ doc: publishedDoc, version: publishedVersion, inReview: reviewedSections() })),
				titleExtrasPlugin(),
				creditLines({ openCredits: (section, button) => creditsPopover?.show(section, button), finishReview: (request) => void finishReview(request) }),
				caseHeadings({ citations: () => citationsByKey, change: canEdit ? changeBoxSource : undefined }),
				outlineAnchors(),
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
				const thread = commentAt(editorView, position);
				if (thread && thread !== 'new') currentThread = thread;
				return false;
			},
			handleDoubleClickOn: (_view, _position, node, nodePosition) =>
				node.type.name === 'citation' ? editCitation(nodePosition, node) : false,
			dispatchTransaction(transaction: Transaction) {
				// The live room can still send a change a moment after the editor closed.
				if (!view || closed) return;
				const before = undoDepthOf(view.state);
				view.updateState(view.state.apply(transaction));
				const after = undoDepthOf(view.state);
				if (transaction.docChanged || after !== before) steps = nextSteps(steps, transaction, before, after);
			}
		});
		describe(view.state);
		setCreditLines(view, { credits, requests: reviewRequests, you: reviewingPerson });
		placeComments();
		mounts += 1;
		refreshOutline();
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
	/** Who else is in the live room, and where their cursor is in the text. */
	interface Present {
		client: number;
		name: string;
		tone: PersonTone;
		head: unknown;
	}

	let people = $state<Present[]>([]);
	/** Each other person's place beside the text, how far down it is (essay-editor-mockups/4: who else is here, and where). */
	let presenceTops = $state<{ client: number; name: string; tone: PersonTone; top: number }[]>([]);
	let joining = $state(false);
	let joinTimer: ReturnType<typeof setTimeout> | undefined;
	/** How long to wait for the room before opening the editor on its own. */
	const joinWaitMilliseconds = 6_000;

	/** Each person's color comes from their name, the same on their avatar, cursor and place in the text (person-look.ts). */
	function presenceCursor(user: { name?: string; tone?: string }): HTMLElement {
		const name = user.name ?? 'Someone';
		const color = personColor(name);
		const cursor = document.createElement('span');
		cursor.className = 'ProseMirror-yjs-cursor';
		cursor.style.borderColor = color;
		const label = document.createElement('div');
		label.style.backgroundColor = color;
		label.textContent = name;
		cursor.append(document.createTextNode('\u2060'), label, document.createTextNode('\u2060'));
		return cursor;
	}

	function presenceSelection(user: { name?: string }): { class: string; style: string } {
		return { class: 'ProseMirror-yjs-selection', style: `background-color: color-mix(in srgb, ${personColor(user.name ?? 'Someone')} 25%, transparent)` };
	}

	/** Where a person's cursor is in the text now, or null. */
	function positionOf(head: unknown): number | null {
		if (!view || !head) return null;
		const synced = ySyncPluginKey.getState(view.state) as { doc: Y.Doc; type: Y.XmlFragment; binding?: { mapping: Map<unknown, unknown> } } | undefined;
		if (!synced?.binding) return null;
		try {
			const position = relativePositionToAbsolutePosition(synced.doc, synced.type, Y.createRelativePositionFromJSON(head), synced.binding.mapping as never);
			return position === null ? null : Math.min(position, view.state.doc.content.size);
		} catch {
			return null;
		}
	}

	/** Where this person is reading, for the others in the room: the top of the text in view (a commenter has no cursor). */
	function shareReadingPlace(): void {
		if (!view || !room || !inRoom) return;
		const synced = ySyncPluginKey.getState(view.state) as { type: Y.XmlFragment; binding?: { mapping: Map<unknown, unknown> } } | undefined;
		if (!synced?.binding) return;
		const box = view.dom.getBoundingClientRect();
		const found = view.posAtCoords({ left: box.left + 8, top: Math.min(Math.max(box.top + 8, 140), box.bottom - 8) });
		if (!found) return;
		const reading = absolutePositionToRelativePosition(found.pos, synced.type, synced.binding.mapping as never);
		room.awareness.setLocalStateField('reading', reading);
	}

	let readingTimer: ReturnType<typeof setTimeout> | undefined;

	function shareReadingPlaceSoon(): void {
		clearTimeout(readingTimer);
		readingTimer = setTimeout(() => !closed && shareReadingPlace(), 400);
	}

	function placePeople(): void {
		presenceTops = people.flatMap((person) => {
			const at = positionOf(person.head);
			return at === null ? [] : [{ client: person.client, name: person.name, tone: person.tone, top: topOf(at) }];
		});
	}

	/** Scrolls to where someone is in the text. */
	function goToPerson(person: Present): void {
		const at = positionOf(person.head);
		if (!view || at === null) return;
		try {
			(view.domAtPos(at).node as HTMLElement).parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		} catch {
			// The place is gone; nothing to scroll to.
		}
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
			user: { name: yourName || 'Someone', tone: personTone(yourName || 'Someone') }
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
				.map(([client, state]) => {
					const name = (state.user as { name?: string } | undefined)?.name || 'Someone';
					const head = (state.cursor as { head?: unknown } | undefined)?.head ?? state.reading ?? null;
					return { client, name, tone: personTone(name), head };
				});
			placePeople();
		};
		joined.awareness.on('change', showPeople);
		showPeople();
		shareReadingPlaceSoon();
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
		void loadCredits();
		const chosenThread = untrack(() => startThread);
		void loadComments().then(() => {
			if (chosenThread) goToThread(chosenThread);
		});
		void loadReviewRequests();
		const chosenSection = untrack(() => startAt);
		if (chosenSection) setTimeout(() => goToSection(chosenSection), 300);
		const ready = untrack(() => live) ? joinRoom() : Promise.resolve();
		const askedChart = untrack(() => addChart);
		if (askedChart && untrack(() => canEdit)) void ready.then(() => placeChart(askedChart));
		const kept = canEdit ? localDraft(identifier) : null;
		if (kept && kept.text === untrack(() => text)) dropLocalDraft(identifier);
		else if (kept) recovered = kept;
		try {
			if (canEdit && localStorage.getItem(checksKey) === 'on') toggleChecks();
			else void loadLibrary();
		} catch {
			// As above.
		}
	});

	onDestroy(() => {
		closed = true;
		clearTimeout(autoSaveTimer);
		clearTimeout(joinTimer);
		clearTimeout(creditsTimer);
		clearTimeout(commentTimer);
		clearTimeout(draftTimer);
		clearTimeout(readingTimer);
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
		{ name: 'paragraph', label: 'Text', command: () => setBlockType(schema.nodes.paragraph) },
		{ name: 'h2', label: 'Section heading', command: () => setBlockType(schema.nodes.heading, { level: 2 }) },
		{ name: 'h3', label: 'Subsection heading', command: () => setBlockType(schema.nodes.heading, { level: 3 }) },
		{ name: 'h4', label: 'Minor heading', command: () => setBlockType(schema.nodes.heading, { level: 4 }) }
	];

	/* The bar (as in the approved mockups) ----------------------------------- */

	let moreMenu: HTMLDetailsElement | undefined = $state();

	// On an essay page the bar is the masthead's second row while the editor is open (SiteHeader.svelte).
	$effect(() => {
		if (toolsInMasthead) return offerPageTools(toolbar);
	});
	/** Whether the "Name this version" box is open. */
	let naming = $state(false);
	/** The margin shows in commenting, and while editing when there is an open comment or the checks are open. */
	const showMargin = $derived(
		mode === 'rich' && (!canEdit || showChecks || pendingComment !== null || comments.some((comment) => comment.threadIdentifier === null && !comment.resolvedAt))
	);
	let checksFound = $state(0);
	const statusText = $derived(
		status || (liveStatus && inRoomShown ? liveText(liveStatus) : joining ? 'Joining the live room…' : dirty ? 'Unsaved changes' : `Saved as version ${basedOn}`)
	);
	/** The word beside the saved mark; the whole status is its tooltip. */
	const shortStatus = $derived(
		liveStatus?.state === 'offline' ? 'Offline' : saving ? 'Saving…' : joining ? 'Joining…' : dirty || (liveStatus?.state === 'live' && liveStatus.unsaved) ? 'Not saved yet' : 'Saved'
	);

	function closeMenuThen(action: () => unknown): void {
		if (moreMenu) moreMenu.open = false;
		void action();
	}

	/**
	 * Links in the text, the preview and the side panels (sources, opinions,
	 * citations) open in a new tab, so the draft stays open (Trevor, Nov. 23,
	 * 2026). The bar's own links, such as History, open in place.
	 */
	function openReferencesApart(event: MouseEvent): void {
		if (event.defaultPrevented || event.button !== 0) return;
		const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
		if (!link || link.closest('.editor-bar') || link.target === '_blank') return;
		// While editing, a click in the text places the cursor; it never follows a link.
		if (canEdit && link.closest('.ProseMirror')) return;
		const href = link.getAttribute('href') ?? '';
		if (href.startsWith('#') || href.startsWith('javascript:')) return;
		event.preventDefault();
		window.open(link.href, '_blank', 'noopener');
	}
</script>

<svelte:window onbeforeunload={warnBeforeLeaving} onscroll={shareReadingPlaceSoon} />
<svelte:document onvisibilitychange={saveWhenHidden} />

{#snippet toolbar()}
	<!--
		One slim bar, as in the approved mockups (essay-editor-mockups/3 and v2-1):
		icons with tooltips, then the saved mark, who else is here and Share.
		On an essay page it is the masthead's second row, and the mode, draft
		changes, History and Publish are in the masthead's first row
		(design/header-page-controls, option A). Tools the mockups leave out
		sit under More; tools for the box the cursor is in show in a second row
		only then.
	-->
	<div class="editor-bar" class:in-masthead={toolsInMasthead} role="toolbar" aria-label="Editing">
		{#if canEdit && mode === 'rich'}
			<div class="bar-group" role="group" aria-label="Undo">
				<button type="button" class="tool icon-tool" title="Undo (Ctrl+Z)" aria-label="Undo" onclick={() => run(inRoom ? undoCommand : undo)}><Undo2 size={18} aria-hidden="true" /></button>
				<button type="button" class="tool icon-tool" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onclick={() => run(inRoom ? redoCommand : redo)}><Redo2 size={18} aria-hidden="true" /></button>
				<!-- Your steps in this session, to undo back to any of them (essay-editor-mockups/v2-2). -->
				<details class="bar-menu steps-menu" bind:this={stepsMenu} ontoggle={() => (clock = Date.now())}>
					<summary class="tool icon-tool narrow" title="Your steps in this session" aria-label="Your steps in this session"><ChevronDown size={16} aria-hidden="true" /></summary>
					<div class="menu steps" role="group" aria-label="Your steps in this session">
						<p class="menu-title">Your steps in this session</p>
						{#if steps.length === 0}<p class="small muted">Nothing yet.</p>{/if}
						{#each steps as step, index (step.depth)}
							<button type="button" class:latest={index === 0} onclick={() => undoTo(step)}>
								<Undo size={16} aria-hidden="true" />
								<span class="step-label">{step.label}</span>
								<span class="small muted">{agoText(step.at, clock)}</span>
							</button>
						{/each}
						<p class="small muted menu-note">Click a step to undo back to it.{inRoomShown ? ' Other people’s edits are not undone.' : ''}</p>
					</div>
				</details>
			</div>
			<div class="bar-group" role="group" aria-label="Text">
				<label class="visually-hidden" for="block-style">Block style</label>
				<select
					id="block-style"
					class="tool-select"
					value={blocks.some((block) => block.name === active.block) ? active.block : 'paragraph'}
					onchange={(event) => {
						const chosen = blocks.find((block) => block.name === event.currentTarget.value);
						if (chosen) run(chosen.command());
					}}
				>
					{#each blocks as block (block.name)}<option value={block.name}>{block.label}</option>{/each}
				</select>
				{#each marks.filter((mark) => mark.name !== 'code') as mark (mark.name)}
					<button type="button" class="tool icon-tool" aria-pressed={active.marks.has(mark.name)} title="{mark.label} ({mark.keys})" aria-label={mark.label} onclick={() => run(toggleMark(schema.marks[mark.name]))}>
						{#if mark.name === 'strong'}<Bold size={18} aria-hidden="true" />{:else if mark.name === 'em'}<Italic size={18} aria-hidden="true" />{:else}<Underline size={18} aria-hidden="true" />{/if}
					</button>
				{/each}
				<button type="button" class="tool icon-tool" title="Bulleted list" aria-label="Bulleted list" onclick={() => run(wrapInList(schema.nodes.bullet_list))}><List size={18} aria-hidden="true" /></button>
				<button type="button" class="tool icon-tool" title="Numbered list" aria-label="Numbered list" onclick={() => run(wrapInList(schema.nodes.ordered_list))}><ListOrdered size={18} aria-hidden="true" /></button>
				<button type="button" class="tool icon-tool" aria-pressed={active.marks.has('link')} title="Link" aria-label="Link" onclick={() => openPicker('link')}><Link size={18} aria-hidden="true" /></button>
			</div>
			<div class="bar-group" role="group" aria-label="References">
				<button type="button" class="tool" title="Cite a source" onclick={() => openPicker('citation')}><CiteIcon size={18} aria-hidden="true" /> Cite</button>
				<button type="button" class="tool icon-tool" title="Glossary term" aria-label="Glossary term" onclick={() => openPicker('term')}><BookOpen size={18} aria-hidden="true" /></button>
				<span class="select-with-icon">
					<SquarePlus size={18} aria-hidden="true" />
					<label class="visually-hidden" for="add-block">Add</label>
					<select
						id="add-block"
						class="tool-select"
						value=""
						title="Adds the block where it belongs: a section after the section you are in, anything else after the paragraph you are in"
						onchange={(event) => {
							const chosen = event.currentTarget.value;
							event.currentTarget.value = '';
							addChosen(chosen);
						}}
					>
						<option value="" disabled>Add</option>
						<option value="section">Section</option>
						<option value="subsection">Subsection</option>
						<option value="paragraph">Text</option>
						<option value="case">Case</option>
						<option value="law">Law</option>
						<option value="quote">Quotation box</option>
						<option value="passage">Quoted passage</option>
						<option value="analysis">Analysis</option>
						<option value="figure">Picture, video or recording</option>
						<option value="chart">Chart</option>
					</select>
				</span>
			</div>
		{/if}
		{#if canEdit && mode === 'rich'}
			<div class="bar-group" role="group" aria-label="Review">
				<button type="button" class="tool" aria-pressed={showChecks} title="Spelling, grammar, definitions, quotations and citations" onclick={toggleChecks}><SpellCheck size={18} aria-hidden="true" /> Checks{#if checksFound}<span class="count">{checksFound}</span>{/if}</button>
			</div>
		{/if}
		{#if !canEdit && mode === 'rich'}
			<!-- Commenting, as in essay-editor-mockups/4-commenting: the mode, this line, and on the right Saved, who is here and History. -->
			<p class="bar-hint small muted">Select words to comment or suggest wording. The text stays as the authors wrote it.</p>
		{/if}
		{#if canEdit || mode !== 'rich'}
		<details class="bar-menu" bind:this={moreMenu}>
			<summary class="tool icon-tool" title="More" aria-label="More"><Ellipsis size={18} aria-hidden="true" /></summary>
			<div class="menu" role="group" aria-label="More">
				<p class="menu-label small muted">View</p>
				<button type="button" aria-pressed={mode === 'rich'} onclick={() => closeMenuThen(() => switchMode('rich'))}>Text</button>
				<button type="button" aria-pressed={mode === 'markdown'} disabled={inRoomShown} title={inRoomShown ? 'The Markdown view is off while editing live, so everyone keeps one shared text.' : undefined} onclick={() => closeMenuThen(() => switchMode('markdown'))}>Markdown</button>
				<button type="button" aria-pressed={mode === 'preview'} onclick={() => closeMenuThen(() => switchMode('preview'))}>Preview as readers see it</button>
				{#if canEdit && mode === 'rich'}
					<p class="menu-label small muted">Comment</p>
					<button type="button" disabled={!active.hasSelection} onclick={() => closeMenuThen(() => startComment())}>Comment on the selected words <kbd>Ctrl+Alt+M</kbd></button>
				{/if}
				{#if mode === 'rich'}
					<p class="menu-label small muted">Find</p>
					<button type="button" aria-pressed={showGoTo} onclick={() => closeMenuThen(() => (showGoTo = !showGoTo))}>Go to… <kbd>Ctrl+G</kbd></button>
					<button type="button" aria-pressed={showSources} onclick={() => closeMenuThen(() => { showSources = !showSources; if (showSources) void loadLibrary(); })}>Sources this essay cites</button>
				{/if}
				{#if canEdit && mode === 'rich'}
					<p class="menu-label small muted">Arrange</p>
					<button type="button" onclick={() => closeMenuThen(() => run(moveCurrent('up')))}>Move up <kbd>Alt+Shift+↑</kbd></button>
					<button type="button" onclick={() => closeMenuThen(() => run(moveCurrent('down')))}>Move down <kbd>Alt+Shift+↓</kbd></button>
					<button type="button" onclick={() => closeMenuThen(() => run(lift))}>Take out of its box or list</button>
					<button type="button" aria-pressed={active.marks.has('code')} onclick={() => closeMenuThen(() => run(toggleMark(schema.marks.code)))}>Code <kbd>Ctrl+`</kbd></button>
				{/if}
				{#if canEdit && autoSave}
					<p class="menu-label small muted">Versions</p>
					<button type="button" onclick={() => closeMenuThen(() => (naming = true))}>Name this version…</button>
				{/if}
			</div>
		</details>
		{/if}
		<div class="bar-end">
			{#if canEdit || inRoomShown}
				<span class="saved-mark small" class:is-saved={!(liveStatus?.state === 'offline' || saving || dirty || joining)} role="status" aria-live="polite" title={statusText}>
					{#if liveStatus?.state === 'offline'}<CloudOff size={18} aria-hidden="true" />
					{:else if saving || dirty || joining}<CloudUpload size={18} aria-hidden="true" />
					{:else}<CloudCheck size={18} aria-hidden="true" />{/if}
					<!-- Editing shows only the cloud (essay-editor-mockups/v2-1); commenting says "Saved" beside it (4). -->
					<span class:visually-hidden={canEdit}>{shortStatus}</span>
				</span>
			{/if}
			{#if people.length}
				<span class="people" role="group" aria-label="Here now">
					{#each people.slice(0, 4) as person (person.client)}
						<button type="button" class="person" title="{person.name}: go to where they are" aria-label="Go to where {person.name} is" onclick={() => goToPerson(person)}><PersonAvatar name={person.name} /></button>
					{/each}
					{#if people.length > 4}<span class="small muted" title={people.slice(4).map((person) => person.name).join(', ')}>+{people.length - 4}</span>{/if}
				</span>
			{/if}
			{#if mode === 'rich' && canEdit}
				<button type="button" class="tool icon-tool" title="Share and ask for review" aria-label="Share" onclick={openShare}><Share2 size={18} aria-hidden="true" /></button>
			{/if}
		</div>
	</div>
	{#if canEdit && mode === 'rich' && (active.box || missingParts.length || active.inside.has('analysis_block') || active.inside.has('table') || missingFigureParts.length)}
		<div class="context-bar small" class:in-masthead={toolsInMasthead} role="group" aria-label="This box">
			{#if active.box}<button type="button" class="tool" onclick={() => openPicker(active.box === 'case_block' ? 'case' : 'law')}>Change {active.box === 'law_block' ? 'law' : 'case'}</button>{/if}
			{#each missingParts as kind (kind)}<button type="button" class="tool" onclick={() => run(addBoxPart(kind))}>Add {boxParts[kind]}</button>{/each}
			{#if active.inside.has('analysis_block')}<button type="button" class="tool" onclick={() => openPicker('analysis-title')}>Analysis title</button>{/if}
			{#if active.inside.has('table')}
				<button type="button" class="tool" onclick={() => run(addTableRow)}>Add row</button>
				<button type="button" class="tool" onclick={() => run(removeTableRow)}>Remove row</button>
			{/if}
			{#each missingFigureParts as kind (kind)}<button type="button" class="tool" onclick={() => run(addFigurePart(kind))}>Add {figureParts[kind]}</button>{/each}
		</div>
	{/if}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="essay-editor" class:is-commenting={!canEdit} onclickcapture={openReferencesApart}>
	{#if !toolsInMasthead}{@render toolbar()}{/if}
	<!-- Shown under the title in the text (titleExtrasPlugin); kept here until the editor moves it there. -->
	<div class="title-extras" bind:this={extrasHost}>
		{#if titleExtras}{@render titleExtras({ inReview: sectionsInReview, ...titleNumbers })}{/if}
	</div>
	{#if naming}
		<form class="name-version" onsubmit={(event) => { event.preventDefault(); void save().then(() => (naming = false)); }}>
			<label for="save-note">Name this version</label>
			<input id="save-note" type="text" bind:value={note} placeholder="Sent to advisors" maxlength="500" />
			<button type="submit" class="button" disabled={saving || !note.trim()}>Name it</button>
			<button type="button" class="button button-quiet" onclick={() => (naming = false)}>Cancel</button>
		</form>
	{/if}

	{#if showGoTo && mode === 'rich'}
		<EssayGoTo view={() => view} onclose={() => (showGoTo = false)} />
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
	{#each wholeDraftReviews as request (request.identifier)}
		<div class="notice in-review" role="note">
			<p>
				<strong>The whole draft is in review</strong>{inReviewText(request).replace(/^In review/, '')}{request.message ? `: “${request.message}”` : '.'}
				{#if waitsOn(request, reviewingPerson)}<button type="button" class="button button-quiet" onclick={() => finishReview(request.identifier)}>Done reviewing</button>{/if}
			</p>
		</div>
	{/each}
	{#if reviewProblem}<p class="field-error" role="alert">{reviewProblem}</p>{/if}
	{#if figureFileNotice && mode === 'rich'}
		<div class="notice" role="note"><p>{figureFileNotice}</p></div>
	{/if}
	{#if commentProblem}<p class="field-error" role="alert">{commentProblem}</p>{/if}
	<!-- The text, and the comments in the margin beside it (essay-editor-mockups/4-commenting). -->
	<div class="text-and-margin" class:with-margin={showMargin} class:aligned bind:this={textAndMargin} hidden={mode !== 'rich'}>
		<div
			class="editor-area"
			bind:this={host}
			use:watchFigureFiles={(_media, problem) =>
				(figureFileNotice =
					problem === 'checking'
						? 'A picture, video or recording here is still being checked for viruses. It shows once the check passes, usually within a few minutes.'
						: 'A picture, video or recording here could not be loaded.')}
		></div>
		{#if presenceTops.length > 0}
			<!-- Where each other person in the live room is, beside the text. -->
			<div class="presence-lane" aria-hidden="true">
				{#each presenceTops as person (person.client)}
					<span class="presence-mark" style:top="{person.top}px" title={person.name}><PersonAvatar name={person.name} size="small" /></span>
				{/each}
			</div>
		{/if}
		{#if gutterLines.length > 0}
			<!-- The line numbers, and DRAFT or NEW beside a changed or new component (essay-editor-mockups/4-commenting). -->
			<div class="line-gutter" aria-hidden="true">
				{#each gutterLabels as label (label.top)}
					<span class="gutter-label" style:top="{label.top}px" style:height="{label.height}px">{label.text}</span>
				{/each}
				{#each gutterLines as line (line.number)}
					<span class="line-number" style:top="{line.top}px" style:height="{line.height}px">{line.number}</span>
				{/each}
			</div>
		{/if}
		{#if canEdit && mode === 'rich'}
			<!-- Checked as the person types (essay-editor-mockups/v2-1); the list opens in the margin from Checks (v2-3). -->
			<div class="checks-margin" hidden={!showChecks}>
				<EssayChecks view={() => view} {revision} {identifier} file={currentFile} {library} {canEdit} bind:selected={chosenIssue} bind:found={checksFound} open={showChecks} onclose={toggleChecks} />
			</div>
		{/if}
		{#if showMargin && !showChecks}
			<EssayComments
				essay={identifier}
				{version}
				{comments}
				you={commentingPerson}
				{mayResolveAny}
				positions={threadPositions}
				tops={threadTops}
				lines={threadLines}
				{aligned}
				bind:pending={pendingComment}
				bind:current={currentThread}
				onchange={commentsChanged}
				ongo={goToThread}
			/>
		{/if}
		{#if selectionMenu}
			<!-- The menu for the selected words; pressing it keeps the selection. -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="selection-menu" role="group" aria-label="The selected words" style:top="{selectionMenu.top}px" style:left="{selectionMenu.left}px" onmousedown={(event) => event.preventDefault()}>
				<button type="button" onclick={() => startComment()}><MessageSquarePlus size={18} aria-hidden="true" /> Comment</button>
				{#if !canEdit}
					<button type="button" onclick={() => startComment('suggest')}><PenLine size={18} aria-hidden="true" /> Suggest</button>
					<button type="button" title="Ask the authors to show their sources" onclick={() => quickAsk('sources')}><LibraryBig size={18} aria-hidden="true" /> Sources?</button>
					<button type="button" title="Ask the authors to expand on this" onclick={() => quickAsk('expand')}><Plus size={18} aria-hidden="true" /> Expand</button>
				{/if}
			</div>
		{/if}
	</div>

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

	{#if canEdit && !autoSave}
		<div class="save-bar">
			<label for="save-note">Note for this version (optional)</label>
			<input id="save-note" type="text" bind:value={note} placeholder="Sent to advisors" maxlength="500" />
			<button type="button" class="button" onclick={() => save()} disabled={saving}>Save version</button>
			<span class="small" role="status" aria-live="polite">{status || (liveStatus && inRoomShown ? liveText(liveStatus) : joining ? 'Joining the live room…' : dirty ? 'Unsaved changes' : `Version ${basedOn}`)}</span>
		</div>
	{/if}
</div>

<EssayFigureDialog bind:this={figureDialog} essay={identifier} onadd={addFigure} />
<EssayShareDialog bind:this={shareDialog} essay={identifier} onchange={reviewRequestsChanged} />
<EssayCreditsPopover bind:this={creditsPopover} essay={identifier} {credits} requests={reviewRequests} onchange={creditsChanged} />

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

	/* One slim bar (essay-editor-mockups/3 and v2-1). */
	/*
	 * Buttons in the bar are 2 rem (32 px), as drawn in the approved mockups
	 * (essay-editor-mockups/3 and v2-1), so the bar fits on one row; that is
	 * above the 24 px minimum of WCAG 2.2, success criterion 2.5.8.
	 */
	.essay-editor {
		--bar-target: 2rem;
	}

	.editor-bar {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: var(--space-1) 0;
		background: var(--color-paper);
		border-bottom: 1px solid var(--color-line);
	}

	/*
	 * In the masthead's second row (design/header-page-controls, option A):
	 * the band's colors, and no bar of its own on the page.
	 */
	.editor-bar.in-masthead {
		position: static;
		padding: 2px 0 var(--space-1);
		background: none;
		border-bottom: 0;
		color: var(--color-band-text);
	}

	.in-masthead .bar-group {
		border-right-color: color-mix(in srgb, var(--color-band-text) 30%, transparent);
	}

	.in-masthead .tool,
	.in-masthead .bar-hint,
	.in-masthead .saved-mark,
	.in-masthead .saved-mark.is-saved :global(svg),
	.in-masthead .select-with-icon :global(svg) {
		color: var(--color-band-text);
	}

	.in-masthead .tool:hover:not(:disabled) {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.in-masthead .tool[aria-pressed='true'] {
		background: color-mix(in srgb, currentColor 14%, transparent);
		border-color: transparent;
		box-shadow: inset 0 -3px 0 var(--color-band-text);
	}

	.in-masthead .tool-select,
	.in-masthead #add-block {
		border-color: color-mix(in srgb, var(--color-band-text) 50%, transparent);
		background-color: transparent;
		color: var(--color-band-text);
	}

	.in-masthead .tool-select option {
		background: var(--color-paper);
		color: var(--color-ink);
	}

	/* The menus open over the page in the page's own colors. */
	.in-masthead .menu {
		color: var(--color-ink);
	}

	.context-bar.in-masthead {
		border-bottom: 0;
		border-top: 1px dashed color-mix(in srgb, var(--color-band-text) 35%, transparent);
	}

	.context-bar.in-masthead .tool {
		border-color: color-mix(in srgb, var(--color-band-text) 50%, transparent);
	}

	.bar-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding-right: 2px;
		border-right: 1px solid var(--color-line);
	}

	.bar-hint {
		margin: 0;
	}

	.bar-end {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--bar-target);
		padding: var(--space-1) 0.3rem;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.tool:hover:not(:disabled) {
		background: var(--color-surface);
	}

	.tool:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.icon-tool {
		justify-content: center;
		min-width: calc(var(--bar-target) - 4px);
		padding: var(--space-1) 2px;
	}

	.tool-select {
		width: auto;
		min-width: 0;
		field-sizing: content;
		max-width: 10rem;
		min-height: var(--bar-target);
		padding-top: var(--space-1);
		padding-bottom: var(--space-1);
		font-size: var(--font-size-small);
	}

	.select-with-icon {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.select-with-icon :global(svg) {
		position: absolute;
		left: var(--space-2);
		pointer-events: none;
	}

	.select-with-icon select {
		padding-left: calc(var(--space-2) + 1.4rem);
	}

	.bar-menu {
		position: relative;
	}

	.bar-menu summary {
		list-style: none;
	}

	.bar-menu summary::-webkit-details-marker {
		display: none;
	}

	.menu {
		position: absolute;
		z-index: 4;
		top: 100%;
		left: 0;
		display: grid;
		min-width: 15rem;
		padding: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		box-shadow: 0 4px 16px color-mix(in srgb, var(--color-ink) 18%, transparent);
	}

	.menu-label {
		margin: var(--space-1) 0 0;
		padding: 0 var(--space-2);
	}

	.menu button {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.menu button:hover:not(:disabled),
	.menu button[aria-pressed='true'] {
		background: var(--color-surface);
	}

	.menu button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.menu kbd {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.saved-mark {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-ink-muted);
	}

	/* Saved: the green cloud of essay-editor-mockups/v2-1. */
	.saved-mark.is-saved :global(svg) {
		color: var(--color-status-published-rule);
	}

	/* Add reads as a plain tool, as on the mockup, until it is used. */
	#add-block:not(:hover, :focus-visible) {
		border-color: transparent;
		background-color: transparent;
	}

	.people {
		display: inline-flex;
	}

	.person {
		display: inline-flex;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}

	.person + .person {
		margin-left: -0.45rem;
	}

	.presence-lane {
		position: absolute;
		inset: 0 auto 0 calc(-1 * var(--presence-lane, 1.9rem));
		width: var(--presence-lane, 1.9rem);
		pointer-events: none;
	}

	.presence-mark {
		position: absolute;
		left: 0;
		transition: top var(--motion-duration-short) var(--motion-easing-standard);
	}

	.context-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) 0;
		border-bottom: 1px dashed var(--color-line);
	}

	.context-bar .tool {
		border-color: var(--color-line);
	}

	.name-version {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) 0;
	}

	.name-version input {
		flex: 1 1 14rem;
	}

	.tool[aria-pressed='true'] {
		background: var(--color-surface);
		border-color: var(--color-link);
		box-shadow: inset 0 -3px 0 var(--color-link);
	}

	.editor-area {
		max-width: var(--layout-measure);
		min-width: 0;
	}

	/* The text with the comments in the margin (essay-editor-mockups/4-commenting). */
	.text-and-margin {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}

	.text-and-margin[hidden] {
		display: none;
	}

	.text-and-margin.with-margin.aligned {
		grid-template-columns: minmax(0, var(--layout-measure)) minmax(15rem, 22rem);
		align-items: start;
	}

	/* On a narrow window the comments come first, so a new one is in view. */
	.text-and-margin.with-margin:not(.aligned) > :global(.comments),
	.text-and-margin.with-margin:not(.aligned) > .checks-margin {
		order: -1;
	}

	.checks-margin {
		align-self: stretch;
		min-width: 0;
	}

	/* The essay's title sits plain, with where the draft stands under it (essay-editor-mockups/v2-1). */
	.editor-area :global(.ProseMirror > .essay-component.essay-title),
	.editor-area :global(.ProseMirror > .essay-component.essay-title.is-current) {
		margin-top: 0;
		outline: 0;
	}

	.title-extras {
		margin: var(--space-2) 0 0;
		font-style: normal;
		text-indent: 0;
		user-select: none;
	}

	.title-extras :global(.pills) {
		margin-bottom: 0;
	}

	/* "With drafts": an amber bar beside each changed component, dotted for a new one (draft-marks.ts), and a purple one beside a section in review, as on essay-editor-mockups/4 and v2-1. */
	.editor-area :global(.ProseMirror > .draft-changed),
	.editor-area :global(.ProseMirror > .draft-new),
	.editor-area :global(.ProseMirror > .section-in-review) {
		position: relative;
	}

	.editor-area :global(.ProseMirror > .draft-changed::after),
	.editor-area :global(.ProseMirror > .draft-new::after),
	.editor-area :global(.ProseMirror > .section-in-review::after) {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--draft-bar-at, calc(-1 * var(--space-3) - 2px));
		width: 4px;
		border-radius: 2px;
		background: var(--color-status-draft-rule);
		pointer-events: none;
	}

	.editor-area :global(.ProseMirror > .draft-new::after) {
		background: repeating-linear-gradient(to bottom, var(--color-status-draft-rule) 0 5px, transparent 5px 10px);
	}

	.editor-area :global(.ProseMirror > .section-in-review::after) {
		background: var(--color-status-review-rule);
	}

	/* The headings and boxes the sidebar links to (editor-outline.ts) land below the masthead and its tools. */
	.editor-area :global(.ProseMirror > [id]) {
		scroll-margin-top: calc(var(--masthead-stuck, calc(var(--space-6) * 3)) + var(--space-4));
	}

	/* The citation heading a case or law box (case-headings.ts), selectable and copyable, as in essay-editor-mockups/v2-1. */
	.editor-area :global(.editor-case-citation) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		user-select: text;
		cursor: text;
		text-indent: 0;
	}

	.editor-area :global(.editor-case-words) {
		margin-right: var(--space-1);
	}

	.editor-area :global(.editor-case-button) {
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
		user-select: none;
	}

	.editor-area :global(.editor-case-button:hover) {
		background: var(--color-surface);
		color: var(--color-ink);
	}

	/* Commenting numbers the lines in a gutter left of the text (essay-editor-mockups/4-commenting). */
	.is-commenting {
		--line-gutter: 6rem;
		--draft-bar-at: -1.4rem;
	}

	.is-commenting .presence-lane {
		left: 0;
	}

	.is-commenting .editor-area {
		max-width: calc(var(--layout-measure) + var(--line-gutter));
		padding-left: var(--line-gutter);
	}

	.is-commenting .text-and-margin.with-margin.aligned {
		grid-template-columns: minmax(0, calc(var(--layout-measure) + var(--line-gutter))) minmax(15rem, 22rem);
	}

	.line-gutter {
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--line-gutter);
		pointer-events: none;
		user-select: none;
	}

	.line-number,
	.gutter-label {
		position: absolute;
		display: flex;
		align-items: center;
		line-height: 1;
	}

	.line-number {
		right: 2.4rem;
		color: var(--color-ink-muted);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	.gutter-label {
		left: 0;
		min-height: 1.5rem;
		color: var(--color-status-draft);
		font-size: 0.65rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.count {
		min-width: 1.4em;
		margin-left: 2px;
		padding: 0 0.35em;
		border-radius: 999px;
		background: var(--color-placeholder-background);
		color: var(--color-ink);
		font-size: 0.8em;
		font-weight: var(--font-weight-semibold);
		text-align: center;
	}

	.narrow {
		min-width: 1.25rem;
		padding: 0;
	}

	.steps {
		width: min(24rem, 90vw);
	}

	.steps .menu-title {
		margin: 0 0 var(--space-1);
		font-weight: var(--font-weight-semibold);
	}

	.menu.steps button {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2);
		text-align: left;
	}

	.menu.steps button.latest {
		background: var(--color-notice-background);
	}

	.steps .menu-note {
		margin: var(--space-1) 0 0;
		padding-top: var(--space-1);
		border-top: 1px solid var(--color-line);
	}

	.selection-menu {
		position: absolute;
		z-index: 4;
		display: flex;
		transform: translate(-50%, calc(-100% - var(--space-2)));
		padding: var(--space-1);
		border-radius: var(--radius-control);
		background: var(--color-ink);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--color-ink) 25%, transparent);
		white-space: nowrap;
	}

	.selection-menu button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-paper);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.selection-menu button:hover {
		background: color-mix(in srgb, var(--color-paper) 15%, transparent);
	}

	/* Commenting shows the text as readers see it, without the component frames. */
	.is-commenting .editor-area :global(.ProseMirror > .essay-component),
	.is-commenting .editor-area :global(.ProseMirror > .essay-component.is-current) {
		margin-top: var(--space-3);
		outline: 0;
	}

	.is-commenting .editor-area :global(.ProseMirror > .essay-component[data-component]::before) {
		content: none;
	}

	/* Credits belong to editing (attest-proposal-mockup); commenting shows only what is in review (essay-editor-mockups/4). */
	.is-commenting .editor-area :global(.essay-credits) {
		display: none;
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

	/* The text sits on the page as readers see it, with no box around it (essay-editor-mockups/4 and v2-1). */
	.editor-area :global(.ProseMirror) {
		min-height: 60vh;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-panel);
		outline: none;
	}

	/* The component the cursor is in is outlined instead (components.ts), as on essay-editor-mockups/v2-1. */
	.editor-area :global(.ProseMirror:focus-visible) {
		outline: none;
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

	/* Every block is a component with a frame and a label (components.ts), so no text sits loose on the page. */
	.editor-area :global(.ProseMirror > .essay-component) {
		position: relative;
		margin-top: calc(2 * var(--space-2) + 1.25rem);
		outline: 1px dashed var(--color-line);
		outline-offset: var(--space-2);
		border-radius: var(--radius-control);
	}

	.editor-area :global(.ProseMirror > .essay-component-boxed) {
		border-radius: var(--radius-panel);
	}

	.editor-area :global(.ProseMirror > .essay-component.is-current) {
		outline: 2px solid var(--color-link);
	}

	.editor-area :global(.ProseMirror > .essay-component[data-component]::before) {
		content: attr(data-component);
		position: absolute;
		top: calc(-1 * var(--space-2) - 0.75em);
		left: var(--space-2);
		padding: 0 var(--space-1);
		background: var(--color-paper);
		font-size: 0.75rem;
		font-style: normal;
		font-weight: var(--font-weight-semibold);
		line-height: 1.5;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-indent: 0;
		color: var(--color-ink-muted);
		pointer-events: none;
		user-select: none;
	}

	.editor-area :global(.ProseMirror > .essay-component.is-current::before) {
		color: var(--color-link);
	}

	/* Open requests to review a section, above its credits (credit-lines.ts), in the lavender of essay-editor-mockups/4 and v2-1. */
	.editor-area :global(.essay-in-review) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-status-review-border);
		border-radius: var(--radius-panel);
		background: var(--color-status-review-background);
		color: var(--color-status-review);
		font-size: var(--font-size-small);
		font-style: normal;
		text-indent: 0;
	}

	.editor-area :global(.essay-in-review > span:first-of-type) {
		flex: 1 1 12rem;
	}

	.editor-area :global(.essay-in-review strong) {
		margin-right: var(--space-1);
	}

	.editor-area :global(.essay-review-people) {
		display: inline-flex;
		gap: var(--space-1);
	}

	.editor-area :global(.essay-review-avatar) {
		display: inline-grid;
		place-items: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		color: var(--color-paper);
		font-size: 0.6rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.02em;
	}

	.in-review {
		border: 1px solid var(--color-status-review-border);
		background: var(--color-status-review-background);
		color: var(--color-status-review);
	}

	/* Who is credited for each section, under its heading (credit-lines.ts), as in the approved credits mockup. */
	.editor-area :global(.essay-credits) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-3) 0 0;
		font-size: var(--font-size-small);
		font-style: normal;
		text-indent: 0;
		color: var(--color-ink-muted);
	}

	.editor-area :global(.essay-credit) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.editor-area :global(.essay-credit strong) {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.editor-area :global(.essay-credits-button) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 0;
		padding: 0.15rem var(--space-2);
		border-width: 1px;
		border-color: var(--color-line);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}

	/* Words someone commented on (comment-marks.ts). */
	.editor-area :global(.selected-words) {
		background: var(--color-comment-highlight);
	}

	.editor-area :global(.comment-mark) {
		background: var(--color-comment-highlight);
		border-bottom: 2px solid var(--color-comment-rule);
		cursor: pointer;
	}

	.editor-area :global(.comment-mark.is-current) {
		box-shadow: 0 0 0 2px var(--color-comment-highlight);
		border-bottom-width: 3px;
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
		width: min(var(--layout-panel), 100% - 2 * var(--space-4));
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
