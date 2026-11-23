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
	import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
	import { initProseMirrorDoc, redoCommand, undoCommand, yCursorPlugin, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';
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
	import EssayAttestDialog from '#lib/components/essays/EssayAttestDialog.svelte';
	import EssayComments from '#lib/components/essays/EssayComments.svelte';
	import PersonAvatar from '#lib/components/essays/PersonAvatar.svelte';
	import EssayShareDialog from '#lib/components/essays/EssayShareDialog.svelte';
	import type { Snippet } from 'svelte';
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
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import CiteIcon from '@lucide/svelte/icons/quote';
	import Underline from '@lucide/svelte/icons/underline';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { inReviewText, openRequestsOn, waitsOn, type ReviewRequest } from '#lib/essays/review-requests.ts';
	import { commentAt, commentMarks, showCommentMarks, type CommentMark } from '#lib/essays/comment-marks.ts';
	import { findQuote, quoteAt, type TextQuote } from '#lib/essays/comment-anchors.ts';
	import type { CommentAsk, CommentDraft, EssayComment } from '#lib/essays/comments.ts';
	import { attestationLines, setAttestationLines } from '#lib/essays/attestation-lines.ts';
	import { essaySections, sectionText, sha256Hex, type Attestation } from '#lib/essays/attestations.ts';
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
		startAt = null,
		startThread = null,
		barStart,
		barEnd,
		belowBar,
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
		/** A section's heading id to open the editor at, such as one asked to be reviewed. */
		startAt?: string | null;
		/** A comment thread to open the editor at, from the Comments for you page. */
		startThread?: string | null;
		/** Shown at the start of the bar, such as the page's Reading, Commenting and Editing choice. */
		barStart?: Snippet;
		/** Shown at the end of the bar, such as History and Publish. */
		barEnd?: Snippet;
		/** Shown under the bar, such as where the draft stands. */
		belowBar?: Snippet;
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

	/* Attesting to sections (attestations.ts) ------------------------------ */

	let attestDialog: ReturnType<typeof EssayAttestDialog> | undefined = $state();
	let attestations = $state<Attestation[]>([]);
	let attestationsLoaded = $state(false);
	let attestingPerson = $state<string | null>(null);
	let attestingRole = $state('');
	let canWriteOrEdit = $state(false);
	let hashTimer: ReturnType<typeof setTimeout> | undefined;

	async function loadAttestations(): Promise<void> {
		const response = await fetch(`/workspace/essays/${identifier}/attestations`).catch(() => null);
		if (!response?.ok) return;
		const body = (await response.json()) as { attestations: Attestation[]; you: string; yourRole: string; canWriteOrEdit: boolean };
		attestingPerson = body.you;
		attestingRole = body.yourRole;
		canWriteOrEdit = body.canWriteOrEdit;
		attestationsChanged(body.attestations);
	}

	function attestationsChanged(updated: Attestation[]): void {
		attestations = updated;
		attestationsLoaded = true;
		if (view) setAttestationLines(view, { attestations: updated, loaded: true });
	}

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
		if (view) setAttestationLines(view, { requests: updated, you: reviewingPerson });
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

	/** Each section's SHA-256 as the text stands, so the lines can say when it changed since an attestation. */
	async function sectionHashes(): Promise<Record<string, string>> {
		if (!view) return {};
		const doc = view.state.doc;
		const hashes: Record<string, string> = {};
		for (const section of essaySections(doc)) hashes[section.slug] = await sha256Hex(sectionText(doc, section));
		return hashes;
	}

	function refreshHashesSoon(): void {
		clearTimeout(hashTimer);
		hashTimer = setTimeout(async () => {
			const doc = view?.state.doc;
			const hashes = await sectionHashes();
			if (view && view.state.doc === doc) setAttestationLines(view, { hashes });
		}, 600);
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

	/** Finds each thread's words in the text as it stands, highlights the open ones, and lines their cards up with them. */
	function placeComments(): void {
		if (!view) return;
		const doc = view.state.doc;
		const positions = new Map<string, number | null>();
		const tops = new Map<string, number>();
		const marks: CommentMark[] = [];
		if (commentsLoaded) {
			for (const comment of comments) {
				if (comment.threadIdentifier !== null || !comment.quote) continue;
				const found = findQuote(doc, { quote: comment.quote, prefix: comment.quotePrefix ?? '', suffix: comment.quoteSuffix ?? '' });
				positions.set(comment.identifier, found?.from ?? null);
				if (found && !comment.resolvedAt) {
					marks.push({ thread: comment.identifier, ...found });
					tops.set(comment.identifier, topOf(found.from));
				}
			}
		}
		if (pendingComment) {
			const found = findQuote(doc, pendingComment.quote);
			if (found) {
				marks.push({ thread: 'new', ...found });
				tops.set('new', topOf(found.from));
			}
		}
		threadPositions = positions;
		threadTops = tops;
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
		if (canEdit || selection.empty || pendingComment || !textAndMargin) {
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

	async function openAttest(slug: string): Promise<void> {
		if (!view) return;
		const doc = view.state.doc;
		const section = essaySections(doc).find((candidate) => candidate.slug === slug);
		if (!section) return;
		const text = sectionText(doc, section);
		await attestDialog?.show({ slug, title: section.title, level: section.level, text, sha256: await sha256Hex(text) });
	}

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
						refreshHashesSoon();
						placeCommentsSoon();
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
					? [ySyncPlugin(room.fragment, { mapping: shared.mapping }), yCursorPlugin(room.awareness), yUndoPlugin()]
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
				attestationLines({ attest: (slug) => void openAttest(slug), finishReview: (request) => void finishReview(request) }),
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
				if (!view) return;
				view.updateState(view.state.apply(transaction));
			}
		});
		describe(view.state);
		if (attestationsLoaded) setAttestationLines(view, { attestations, loaded: true });
		setAttestationLines(view, { requests: reviewRequests, you: reviewingPerson });
		refreshHashesSoon();
		placeComments();
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
		void loadAttestations();
		const chosenThread = untrack(() => startThread);
		void loadComments().then(() => {
			if (chosenThread) goToThread(chosenThread);
		});
		void loadReviewRequests();
		const chosenSection = untrack(() => startAt);
		if (chosenSection) setTimeout(() => goToSection(chosenSection), 300);
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
		clearTimeout(hashTimer);
		clearTimeout(commentTimer);
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
	/** Whether the "Name this version" box is open. */
	let naming = $state(false);
	/** The margin shows in commenting, and while editing once there is a comment. */
	const showMargin = $derived(mode === 'rich' && (!canEdit || comments.length > 0 || pendingComment !== null));
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

<svelte:window onbeforeunload={warnBeforeLeaving} />
<svelte:document onvisibilitychange={saveWhenHidden} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="essay-editor" class:is-commenting={!canEdit} onclickcapture={openReferencesApart}>
	<!--
		One slim bar, as in the approved mockups (essay-editor-mockups/3 and v2-1):
		the mode, then icons with tooltips, then the saved mark, who else is
		here, Share, History and Publish. Tools the mockups leave out sit under
		More; tools for the box the cursor is in show in a second row only then.
	-->
	<div class="editor-bar" role="toolbar" aria-label="Editing">
		{#if barStart}<div class="bar-group">{@render barStart()}</div>{/if}
		{#if canEdit && mode === 'rich'}
			<div class="bar-group" role="group" aria-label="Undo">
				<button type="button" class="tool icon-tool" title="Undo (Ctrl+Z)" aria-label="Undo" onclick={() => run(inRoom ? undoCommand : undo)}><Undo2 size={18} aria-hidden="true" /></button>
				<button type="button" class="tool icon-tool" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onclick={() => run(inRoom ? redoCommand : redo)}><Redo2 size={18} aria-hidden="true" /></button>
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
				<button type="button" class="tool" aria-pressed={showChecks} title="Spelling, grammar and definitions" onclick={toggleChecks}><SpellCheck size={18} aria-hidden="true" /> Checks</button>
				<button type="button" class="tool icon-tool" disabled={!active.hasSelection} title="Comment on the selected words (Ctrl+Alt+M)" aria-label="Comment" onclick={() => startComment()}><MessageSquarePlus size={18} aria-hidden="true" /></button>
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
				<span class="saved-mark small" role="status" aria-live="polite" title={statusText}>
					{#if liveStatus?.state === 'offline'}<CloudOff size={18} aria-hidden="true" />
					{:else if saving || dirty || joining}<CloudUpload size={18} aria-hidden="true" />
					{:else}<CloudCheck size={18} aria-hidden="true" />{/if}
					<span>{shortStatus}</span>
				</span>
			{/if}
			{#if people.length}
				<span class="people" title="Editing now: {people.join(', ')}">
					{#each people.slice(0, 4) as name, index (index)}<PersonAvatar {name} />{/each}
					<span class="visually-hidden">Editing now: {people.join(', ')}</span>
				</span>
			{/if}
			{#if mode === 'rich' && canEdit}
				<button type="button" class="tool icon-tool" title="Share and ask for review" aria-label="Share" onclick={openShare}><Share2 size={18} aria-hidden="true" /></button>
			{/if}
			{#if barEnd}{@render barEnd()}{/if}
		</div>
	</div>
	{#if canEdit && mode === 'rich' && (active.box || missingParts.length || active.inside.has('analysis_block') || active.inside.has('table') || missingFigureParts.length)}
		<div class="context-bar small" role="group" aria-label="This box">
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
	{#if belowBar}{@render belowBar()}{/if}
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
		{#if showMargin}
			<EssayComments
				essay={identifier}
				{version}
				{comments}
				you={commentingPerson}
				{mayResolveAny}
				positions={threadPositions}
				tops={threadTops}
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
				<button type="button" onclick={() => startComment('suggest')}><PenLine size={18} aria-hidden="true" /> Suggest</button>
				<button type="button" title="Ask the authors to show their sources" onclick={() => quickAsk('sources')}><LibraryBig size={18} aria-hidden="true" /> Sources?</button>
				<button type="button" title="Ask the authors to expand on this" onclick={() => quickAsk('expand')}><Plus size={18} aria-hidden="true" /> Expand</button>
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
<EssayAttestDialog bind:this={attestDialog} essay={identifier} {attestations} you={attestingPerson} yourRole={attestingRole} {canWriteOrEdit} onchange={attestationsChanged} />

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
	.editor-bar {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		padding: var(--space-1) 0;
		background: var(--color-paper);
		border-bottom: 1px solid var(--color-line);
	}

	.bar-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding-right: var(--space-2);
		border-right: 1px solid var(--color-line);
	}

	.bar-hint {
		margin: 0;
	}

	.bar-end {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-2);
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
		min-width: var(--layout-target-minimum);
		padding: var(--space-1);
	}

	.tool-select {
		width: auto;
		min-width: 0;
		max-width: 10rem;
		min-height: var(--layout-target-minimum);
		padding-top: var(--space-1);
		padding-bottom: var(--space-1);
		font-size: var(--font-size-small);
	}

	#add-block {
		width: 6.5rem;
	}

	#block-style {
		width: 9rem;
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

	.people {
		display: inline-flex;
	}

	.people > :global(.avatar + .avatar) {
		margin-left: -0.45rem;
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
	.text-and-margin.with-margin:not(.aligned) > :global(.comments) {
		order: -1;
	}

	.selection-menu {
		position: absolute;
		z-index: 4;
		display: flex;
		transform: translate(-50%, calc(-100% - var(--space-2)));
		padding: var(--space-1);
		border-radius: var(--radius-control);
		background: var(--color-band);
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
		color: var(--color-band-text);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.selection-menu button:hover {
		background: color-mix(in srgb, var(--color-band-text) 15%, transparent);
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

	/* Attesting belongs to editing (essay-editor-mockups/v2-1); commenting shows only what is in review (4). */
	.is-commenting .editor-area :global(.essay-attestations) {
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

	/* Open requests to review a section, above who attested to it (attestation-lines.ts). */
	.editor-area :global(.essay-in-review) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-line);
		border-left: 3px solid var(--color-link);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
		font-size: var(--font-size-small);
		font-style: normal;
		text-indent: 0;
	}

	.editor-area :global(.essay-in-review strong) {
		color: var(--color-link);
	}

	.in-review {
		border-left: 3px solid var(--color-link);
	}

	/* Who attested to each section, under its heading (attestation-lines.ts). */
	.editor-area :global(.essay-attestations) {
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

	.editor-area :global(.essay-attestation strong) {
		color: var(--color-ink);
	}

	.editor-area :global(.essay-attestation-date) {
		color: var(--color-link);
	}

	.editor-area :global(.essay-attestation.is-changed .essay-attestation-date) {
		color: var(--color-action);
	}

	.editor-area :global(.essay-attest-button) {
		font-size: var(--font-size-small);
		padding: 0 var(--space-2);
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
