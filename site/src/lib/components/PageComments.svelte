<!--
	Commenting on every page that is not an essay, such as a law, a case, a
	nation, a list, a chart or the home page (docs/editing.md, "Comments on
	other pages"; src/lib/page-comment-paths.ts says which pages; mockups
	design/page-comments, Nov. 26, 2026). For a person with comment access or
	above on the page (src/lib/server/page-comments.ts), the masthead offers
	Commenting beside Reading and Editing, with the number of open comments.
	In Commenting, selecting words on the page opens a small dark menu:
	Comment, Suggest, Sources? and Check?. The cards are the essays' own
	(EssayComments.svelte): on a wide window they sit in a column on the
	right, each level with its words, and the words are highlighted; on a
	narrow one they stack under the title, and the comment being written
	opens at the bottom of the screen. Readers never see comments.
-->
<script lang="ts">
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import SearchCheck from '@lucide/svelte/icons/search-check';
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import EssayComments from '#lib/components/essays/EssayComments.svelte';
	import { commentAsks, type CommentAsk, type CommentDraft, type EssayComment } from '#lib/essays/comments.ts';
	import { offerPageControls, pageHasOwnCommenting, type PageMode } from '#lib/page-editing.svelte.ts';
	import { findOnPage, pageText, quoteOfRange, type PageText } from '#lib/page-comment-anchors.ts';
	import { pagePath } from '#lib/page-comment-paths.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { readStored, writeStored } from '#lib/browser-storage.ts';
	import { sendJson } from '#lib/send-json.ts';
	import { sendProblem } from '#lib/problem-reports.ts';

	type Level = 'no-access' | 'comment' | 'contribute' | 'full';

	const modeKey = 'page-comments-mode';
	const cardsSelector = '.page-comments';
	/** Every ask but "Make this a case box", which is for essays. */
	const offeredAsks = commentAsks.filter((ask) => ask !== 'case-box');

	let path = $state<string | null>(null);
	let level = $state<Level>('no-access');
	let mode = $state<PageMode>('reading');
	let comments = $state.raw<EssayComment[]>([]);
	let you = $state<string | null>(null);
	let mayResolveAny = $state(false);
	let pending = $state<CommentDraft | null>(null);
	let current = $state<string | null>(null);
	let problem = $state('');

	// Where each thread's words are, for the cards.
	let positions = $state.raw<Map<string, number | null>>(new Map());
	let tops = $state.raw<Map<string, number>>(new Map());
	let wide = $state(true);
	let menu = $state<{ top: number; left: number } | null>(null);

	let cards = $state<HTMLDivElement>();
	let text: PageText | null = null;
	let ranges = new Map<string, Range>();

	// A page with commenting of its own, such as an essay on About, keeps it (joinPageControls).
	const commenting = $derived(mode === 'commenting' && level !== 'no-access' && !pageHasOwnCommenting());
	const openCount = $derived(comments.filter((comment) => comment.threadIdentifier === null && !comment.resolvedAt).length);
	const nation = $derived(path?.startsWith('nations/') ?? false);

	function pathHere(): string | null {
		// A "Page not found" or other error is not a page of the site, so it takes no comments.
		if (page.error) return null;
		return pagePath(location.pathname);
	}

	function main(): HTMLElement | null {
		return document.getElementById('main-content');
	}

	async function load(): Promise<void> {
		path = pathHere();
		comments = [];
		pending = null;
		menu = null;
		if (!path) {
			level = 'no-access';
			return;
		}
		const asked = path;
		const response = await fetch(`/workspace/page-comments?page=${encodeURIComponent(asked)}`).catch(() => /* expected: offline; the comments are left out, and the server reports its own failures. */ null);
		if (asked !== path) return;
		const answer = response?.ok ? ((await response.json().catch((problem) => void sendProblem(problem, { code: 'page-comments.load' }))) as { level: Level; comments?: EssayComment[]; you?: string; mayResolveAny?: boolean } | null) : null;
		level = answer?.level ?? 'no-access';
		comments = answer?.comments ?? [];
		you = answer?.you ?? null;
		mayResolveAny = answer?.mayResolveAny ?? false;
		await tick();
		place();
	}

	/** Finds each thread's words on the page, highlights them and works out where its card goes. */
	function place(): void {
		const root = main();
		if (!root || !commenting) {
			clearHighlights();
			return;
		}
		text = pageText(root, cardsSelector);
		ranges = new Map();
		const foundAt = new Map<string, number | null>();
		for (const comment of comments) {
			if (comment.threadIdentifier !== null || !comment.quote) continue;
			const found = findOnPage(text, { quote: comment.quote, prefix: comment.quotePrefix ?? '', suffix: comment.quoteSuffix ?? '' });
			foundAt.set(comment.identifier, found?.start ?? null);
			if (found) ranges.set(comment.identifier, found.range);
		}
		if (pending) {
			const found = findOnPage(text, pending.quote);
			if (found) ranges.set('new', found.range);
		}
		positions = foundAt;
		measure();
		highlight();
	}

	/** How far down the cards' column each thread's words are. */
	function measure(): void {
		const column = cards?.getBoundingClientRect().top ?? 0;
		tops = new Map([...ranges].map(([key, range]) => [key, Math.max(0, range.getBoundingClientRect().top - column - 12)]));
	}

	function highlight(): void {
		if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
		const open = new Set(comments.filter((comment) => comment.threadIdentifier === null && !comment.resolvedAt).map((comment) => comment.identifier));
		const shown = [...ranges].filter(([key]) => key === 'new' || open.has(key) || key === current);
		CSS.highlights.set('page-comments', new Highlight(...shown.map(([, range]) => range)));
		const chosen = ranges.get(pending ? 'new' : (current ?? ''));
		if (chosen) CSS.highlights.set('page-comment-current', new Highlight(chosen));
		else CSS.highlights.delete('page-comment-current');
	}

	function clearHighlights(): void {
		if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
		CSS.highlights.delete('page-comments');
		CSS.highlights.delete('page-comment-current');
	}

	function setMode(next: PageMode): void {
		mode = next === 'commenting' ? 'commenting' : 'reading';
		writeStored(modeKey, mode === 'commenting' ? 'commenting' : null, 'session');
		menu = null;
		if (mode !== 'commenting') pending = null;
		void tick().then(place);
	}

	/* Selecting words ------------------------------------------------------- */

	/** The selection, when it is words on the page outside the cards. */
	function selectedRange(): Range | null {
		const selection = document.getSelection();
		if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
		const range = selection.getRangeAt(0);
		const root = main();
		const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
		if (!root || !start || !root.contains(range.commonAncestorContainer) || start.closest(`${cardsSelector}, input, textarea, button`)) return null;
		return range;
	}

	function onSelection(): void {
		if (!commenting) return;
		const range = selectedRange();
		if (!range || !range.toString().trim()) {
			menu = null;
			return;
		}
		const box = range.getClientRects()[0] ?? range.getBoundingClientRect();
		menu = { top: box.top + window.scrollY, left: Math.min(Math.max(box.left + box.width / 2, 170), window.innerWidth - 170) + window.scrollX };
	}

	function selectedQuote() {
		const range = selectedRange();
		const root = main();
		if (!range || !root) return null;
		text = pageText(root, cardsSelector);
		return quoteOfRange(text, range);
	}

	function startComment(kind: 'comment' | 'suggest' = 'comment'): void {
		const quote = selectedQuote();
		if (!quote) return;
		pending = kind === 'suggest' ? { quote, asks: ['rewrite'], body: quote.quote, suggest: true } : { quote, asks: [], body: '' };
		current = null;
		menu = null;
		document.getSelection()?.removeAllRanges();
		void tick().then(place);
	}

	/** A one-click ask on the selected words, sent at once. */
	async function quickAsk(ask: CommentAsk): Promise<void> {
		const quote = selectedQuote();
		if (!quote || !path) return;
		menu = null;
		document.getSelection()?.removeAllRanges();
		problem = '';
		const sent = await sendJson<{ comments: EssayComment[] }>(
			`/workspace/page-comments?page=${encodeURIComponent(path)}`,
			'POST',
			{ body: '', asks: [ask], quote, title: pageTitle() },
			{ complete: (answer) => !!answer.comments }
		);
		if (!sent.ok) {
			problem = sent.problem;
			return;
		}
		const before = new Set(comments.map((comment) => comment.identifier));
		const added = sent.answer.comments.find((comment) => !before.has(comment.identifier) && comment.threadIdentifier === null);
		if (added) current = added.identifier;
		changed(sent.answer.comments);
	}

	function pageTitle(): string {
		return main()?.querySelector('h1')?.textContent?.trim() || document.title;
	}

	function changed(next: EssayComment[]): void {
		comments = next;
		void tick().then(place);
	}

	/** Shows a thread's words on the page. */
	function go(thread: string, focus = false): void {
		current = thread;
		pending = null;
		const range = ranges.get(thread);
		if (range && focus) {
			const box = range.getBoundingClientRect();
			window.scrollTo({ top: box.top + window.scrollY - window.innerHeight / 3 });
		}
		highlight();
	}

	/* Layout ------------------------------------------------------------------ */

	/** Puts the cards inside the page: in a column on the right on a wide page, under the title on a narrow one. */
	function attachCards(node: HTMLDivElement) {
		const root = main();
		if (!root) return;
		const title = root.querySelector('.record-introduction') ?? root.querySelector('h1');
		if (wide || !title) root.append(node);
		else title.after(node);
		return () => node.remove();
	}

	onMount(() => {
		if (!readSignedInHint(document.cookie).signedIn) return;
		const asked = new URL(location.href).searchParams.get('comment');
		if (asked || readStored(modeKey, 'session') === 'commenting') mode = 'commenting';
		if (asked) current = asked;
		void load().then(() => {
			if (asked) void tick().then(() => go(asked, true));
		});

		const root = main();
		const watcher = new ResizeObserver(() => {
			const next = (main()?.clientWidth ?? 0) >= 860;
			if (next !== wide) wide = next;
			if (commenting) measure();
		});
		if (root) watcher.observe(root);
		let selectionTimer = 0;
		const onSelectionChange = () => {
			window.clearTimeout(selectionTimer);
			selectionTimer = window.setTimeout(onSelection, 120);
		};
		// Folding a section moves the words below it.
		const onToggle = () => commenting && void tick().then(measure);
		document.addEventListener('selectionchange', onSelectionChange);
		document.addEventListener('toggle', onToggle, true);
		return () => {
			watcher.disconnect();
			document.removeEventListener('selectionchange', onSelectionChange);
			document.removeEventListener('toggle', onToggle, true);
			clearHighlights();
		};
	});

	afterNavigate(({ type }) => {
		if (type === 'enter') return;
		current = null;
		void load();
	});

	$effect(() => {
		const on = commenting && wide;
		document.documentElement.classList.toggle('page-commenting', on);
		return () => document.documentElement.classList.remove('page-commenting');
	});

	$effect(() => {
		void commenting;
		void wide;
		void tick().then(place);
	});

	$effect(() => {
		void current;
		void pending;
		highlight();
	});

	// The masthead's Commenting button, on every page that takes comments.
	$effect(() => {
		if (level === 'no-access' || !path) return;
		return offerPageControls(
			{
				modes: ['reading', 'commenting'],
				get mode() {
					return mode;
				},
				setMode,
				get openComments() {
					return openCount;
				}
			},
			{ fallback: true }
		);
	});
</script>

{#if commenting && path}
	<div class="page-comments" class:is-wide={wide} bind:this={cards} {@attach attachCards}>
		{#key path}
			<EssayComments
				address="/workspace/page-comments?page={encodeURIComponent(path)}"
				peopleAddress="/workspace/page-comments?page={encodeURIComponent(path)}&people"
				{offeredAsks}
				newCommentFields={{ title: pageTitle() }}
				seenBy={nation ? "Not shown to readers; the nation's team sees it" : 'Not shown to readers'}
				nobodyElse="No one else can see the comments on this page yet."
				{comments}
				{you}
				{mayResolveAny}
				{positions}
				{tops}
				lines={new Map()}
				aligned={wide}
				bind:pending
				bind:current
				onchange={changed}
				ongo={go}
			/>
		{/key}
		{#if problem}<p class="field-error small" role="alert">{problem}</p>{/if}
	</div>
{/if}

{#if commenting && menu}
	<!-- The menu for the selected words; pressing it keeps the selection. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="selection-menu" role="group" aria-label="The selected words" style:top="{menu.top}px" style:left="{menu.left}px" onmousedown={(event) => event.preventDefault()}>
		<button type="button" onclick={() => startComment()}><MessageSquarePlus size={18} aria-hidden="true" /> Comment</button>
		<button type="button" onclick={() => startComment('suggest')}><PenLine size={18} aria-hidden="true" /> Suggest</button>
		<button type="button" title="Ask for the sources" onclick={() => quickAsk('sources')}><LibraryBig size={18} aria-hidden="true" /> Sources?</button>
		<button type="button" title="Ask for this fact to be checked" onclick={() => quickAsk('check')}><SearchCheck size={18} aria-hidden="true" /> Check?</button>
	</div>
{/if}

<style>
	/* A column on the right of the page for the cards (design/page-comments). */
	:global(html.page-commenting #main-content) {
		position: relative;
		padding-right: calc(21rem + var(--space-6));
	}

	.page-comments.is-wide {
		position: absolute;
		top: 0;
		right: var(--space-4);
		width: 21rem;
	}

	.page-comments:not(.is-wide) {
		margin: var(--space-3) 0;
	}

	/* On a narrow page, the comment being written opens at the bottom of the screen. */
	.page-comments:not(.is-wide) :global(.new-card) {
		position: fixed;
		z-index: 30;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 70vh;
		overflow-y: auto;
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-width: 2px 0 0;
		border-radius: 14px 14px 0 0;
		box-shadow: 0 -6px 20px color-mix(in srgb, var(--color-ink) 22%, transparent);
	}

	:global(::highlight(page-comments)) {
		background-color: var(--color-comment-highlight);
		text-decoration: underline 2px var(--color-comment-rule);
		text-underline-offset: 4px;
	}

	:global(::highlight(page-comment-current)) {
		background-color: color-mix(in srgb, var(--color-comment-rule) 35%, var(--color-comment-highlight));
	}

	.selection-menu {
		position: absolute;
		z-index: 40;
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

	@media print {
		.page-comments,
		.selection-menu {
			display: none;
		}

		:global(html.page-commenting #main-content) {
			padding-right: 0;
		}
	}
</style>
