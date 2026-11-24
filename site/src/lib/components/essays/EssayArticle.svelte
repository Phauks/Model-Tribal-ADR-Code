<script lang="ts">
	// An essay as readers see it (src/lib/server/essay-pages.ts): the text with
	// its case, quotation and analysis boxes, numbered citation markers that
	// preview their source (CitationPopup.svelte), a button under each
	// quotation that opens it in its paragraph (quote-context-view.ts), the Sources list,
	// and when this version was published.
	//
	// The page is the same for every reader. When the browser holds the
	// signed-in hint, the newest publication also asks the workspace what
	// this person may do with the essay; a person with access gets the
	// page's controls in the masthead (PageControls.svelte), the draft with
	// its changes marked, and the editor in place of the text, loaded only
	// then, with its tools in the masthead's second row.
	//
	// A page about the site, such as the About page (src/lib/server/about-pages.ts),
	// has no section, and shows the text from git until it is first published.
	import Breadcrumbs from '../Breadcrumbs.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { editingOutline } from '#lib/essays/editing-outline.svelte.ts';
	import type { OutlineItem } from '#lib/site-sections.ts';
	import { figurePlayers } from '#lib/essays/figure-players.ts';
	import { quoteContext } from '#lib/essays/quote-context-view.ts';
	import SourceList from '#lib/components/SourceList.svelte';
	import EssayStatusPills from '#lib/components/essays/EssayStatusPills.svelte';
	import { offerPageControls, type PageControls, type PageMode } from '#lib/page-editing.svelte.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import type { SourceEntry } from '#lib/server/source-uses.ts';
	import type { EssayPageState } from '#lib/server/essay-page-state.ts';

	interface Publication {
		number: number;
		publishedAtText: string;
		link: string;
	}

	let {
		identifier,
		section,
		sectionLink,
		title,
		html,
		sources,
		publication,
		isNewest,
		newest,
		publicationCount,
		path,
		unpublished = false
	}: {
		identifier: string;
		section?: string;
		sectionLink?: string;
		title: string;
		html: string;
		sources: SourceEntry[];
		publication?: Publication;
		isNewest: boolean;
		newest?: Publication;
		publicationCount: number;
		path: string;
		/** Nothing is published yet: readers see only that, and people with access see the draft. */
		unpublished?: boolean;
	} = $props();

	const viewKey = 'essay-view';
	let access = $state<EssayPageState | null>(null);
	let view = $state<'published' | 'drafts'>('drafts');
	let mode = $state<'reading' | 'commenting' | 'editing'>('reading');

	const shown = $derived(
		access?.draft && (view === 'drafts' || unpublished) ? { html: access.draft.html, sources: access.draft.sources } : { html, sources }
	);
	const shownTitle = $derived(unpublished && access ? access.title : title);

	async function loadAccess(): Promise<void> {
		const response = await fetch(`/workspace/essays/${identifier}/page`, {
			headers: { Accept: 'application/json' },
			redirect: 'manual'
		}).catch(() => null);
		if (!response?.ok || !response.headers.get('Content-Type')?.includes('application/json')) return;
		const answer = (await response.json()) as EssayPageState;
		// Two loads can cross; never step back to an older version.
		if (access && answer.latest.number < access.latest.number) return;
		access = answer;
	}

	// The editor's last save lands after it closes: show that text, and open the editor on it next time.
	/*
	 * The page's controls in the masthead, after the site's name
	 * (PageControls.svelte; design/header-page-controls, approved by Trevor on
	 * Nov. 23, 2026): Reading, Commenting and Editing; whether draft changes
	 * show, where something is published to compare them with; History; and
	 * Publish. Reading, Publish sends the newest version to readers; editing,
	 * it opens the list of versions to choose one.
	 */
	$effect(() => {
		if (!access) return;
		const state = access;
		const controls: PageControls = {
			modes: state.canEdit ? ['reading', 'commenting', 'editing'] : ['reading', 'commenting'],
			get mode() {
				return mode;
			},
			setMode: (chosen: PageMode) => {
				mode = chosen;
			},
			get drafts() {
				const offered = mode === 'reading' ? state.draft !== null && state.publishedVersion !== null : state.publishedVersion !== null;
				if (!offered) return null;
				return {
					// Commenting and editing always show the draft with its changes marked.
					shown: mode === 'reading' ? view === 'drafts' : true,
					set: (shown: boolean) => {
						view = shown ? 'drafts' : 'published';
						if (!shown) mode = 'reading';
					}
				};
			},
			history: { title: 'History: every saved version', href: `/workspace/essays/${identifier}` },
			get publish() {
				if (!state.canPublish) return null;
				if (mode === 'editing') return { title: 'Choose a saved version to publish', href: `/workspace/essays/${identifier}` };
				if (mode === 'reading' && state.draft) {
					return {
						title: `Publish version ${state.latest.number} for readers`,
						action: `/workspace/essays/${identifier}?/publish`,
						fields: { version: String(state.latest.number) }
					};
				}
				return null;
			}
		};
		return offerPageControls(controls);
	});

	function saved(): void {
		if (mode === 'reading') void loadAccess();
	}

	onMount(() => {
		if (!isNewest) return;
		if (!readSignedInHint(document.cookie).signedIn) return;
		try {
			if (localStorage.getItem(viewKey) === 'published') view = 'published';
		} catch {
			// Storage can be blocked; the choice is then not remembered.
		}
		// A review request's link opens the draft for commenting at its section: ?review=<section>, or ?review for the whole draft.
		const asked = new URL(location.href).searchParams;
		if (asked.has('review')) reviewAt = asked.get('review') || null;
		// Comments for you opens the page at a comment, with ?comment=.
		if (asked.get('comment')) {
			commentAt = asked.get('comment');
			reviewAt ??= null;
		}
		// The workspace's Edit button opens the page with ?edit.
		openToEdit = asked.has('edit');
		void loadAccess();
	});

	let reviewAt = $state<string | null | undefined>(undefined);
	let commentAt = $state<string | null>(null);
	let openToEdit = false;
	let openedForReview = false;
	$effect(() => {
		if (access && (reviewAt !== undefined || openToEdit) && !openedForReview) {
			openedForReview = true;
			view = 'drafts';
			mode = openToEdit && access.canEdit ? 'editing' : 'commenting';
		}
	});

	function rememberView(): void {
		try {
			localStorage.setItem(viewKey, view);
		} catch {
			// As above.
		}
	}

	$effect(() => {
		if (access) rememberView();
	});

	// While editing or commenting, the sidebar lists the essay as the draft stands, with Your work under it
	// (essay-editor-mockups/4 and v2-1); reading, it lists the published headings again.
	function showOutline(items: OutlineItem[]): void {
		editingOutline.current = { path, items, work: access?.work ?? null };
	}
	$effect(() => {
		if (mode === 'reading') editingOutline.current = null;
	});
	onDestroy(() => {
		if (editingOutline.current?.path === path) editingOutline.current = null;
	});

	// Back to reading: show what was just saved.
	let previousMode: typeof mode = 'reading';
	$effect(() => {
		if (mode === 'reading' && previousMode !== 'reading') void loadAccess();
		previousMode = mode;
	});
</script>

<svelte:head>
	<title>{[shownTitle, section, 'Model Tribal ADR Code'].filter(Boolean).join(' · ')}</title>
	{#if unpublished}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<!-- The page's controls are in the masthead, so in every mode the page starts as it does for readers. -->
{#if section && sectionLink}
	<Breadcrumbs trail={[{ label: section, href: sectionLink }]} />
{/if}

<article class="reading essay">
	<!-- The editor shows the title as the essay's own first heading, to edit there. -->
	<h1 class:visually-hidden={mode !== 'reading'}>{shownTitle}</h1>
	{#if access && mode === 'reading'}<EssayStatusPills state={access} />{/if}
	{#if unpublished && !access}
		<p>This page is not published yet.</p>
	{/if}
	{#if !isNewest && publication && newest}
		<div class="notice" role="note">
			<p>
				This is an earlier version, published {publication.publishedAtText}. <a href={newest.link}>Read the current version</a>, published {newest.publishedAtText}.
			</p>
		</div>
	{/if}
	{#if access && mode !== 'reading'}
		{#await import('#lib/components/essays/EssayEditor.svelte')}
			<p class="small muted">Opening the editor…</p>
		{:then { default: EssayEditor }}
			{#key mode}
				<!-- Commenting opens the same draft without editing it, so comments land on the words the authors see. -->
				<EssayEditor {identifier} text={access.text} version={access.latest.number} canEdit={access.canEdit && mode === 'editing'} autoSave={mode === 'editing'} live startAt={reviewAt ?? null} startThread={commentAt} publishedText={access.publishedText} publishedVersion={access.publishedVersion} yourName={access.you?.name ?? null} onsaved={saved} onoutline={showOutline} toolsInMasthead>
					{#snippet titleExtras(extras)}
						<EssayStatusPills state={access!} inReview={extras.inReview} />
						{#if mode === 'commenting'}<p class="small muted essay-size">{extras.lines.toLocaleString('en-US')} lines · {extras.words.toLocaleString('en-US')} words</p>{/if}
					{/snippet}
				</EssayEditor>
			{/key}
		{:catch}
			<p class="small">The editor could not be opened. <a href="/workspace/essays/{identifier}/edit">Open it in the workspace</a>.</p>
		{/await}
	{:else}
		<div class="essay-text" use:figurePlayers use:quoteContext={shown.html}>
			{@html shown.html}
		</div>
		<SourceList sources={shown.sources} />
	{/if}
	{#if publication}
		<p class="small muted essay-dateline" data-print-part="pageDetails">
			Published {publication.publishedAtText}.
			{#if publicationCount > 1 && section}<a class="no-print" href="{path}/history">Earlier versions</a>{/if}
		</p>
	{/if}
</article>

<style>
	/* Marks on the draft view, shown only to people with access (src/lib/essays/render.ts). */
	.essay-text :global(.essay-draft-mark) {
		position: relative;
		margin-left: calc(-1 * var(--space-3));
		padding-left: calc(var(--space-3) - 3px);
		border-left: 3px solid var(--color-action);
	}

	.essay-text :global(.essay-draft-added) {
		border-left-style: dashed;
		border-left-color: var(--color-link);
	}

	/* The label sits in the empty space to the right of the text column. */
	.essay-text :global(.essay-draft-mark::before) {
		content: attr(data-draft);
		position: absolute;
		top: 0;
		left: 100%;
		margin-left: var(--space-3);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	@media (max-width: 48rem) {
		.essay-text :global(.essay-draft-mark::before) {
			position: static;
			display: block;
			margin: 0;
		}
	}
</style>
