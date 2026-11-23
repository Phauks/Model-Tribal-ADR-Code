<script lang="ts">
	// An essay as readers see it (src/lib/server/essay-pages.ts): the text with
	// its case, quotation and analysis boxes, numbered citation markers that
	// open their source in place (CitationPopup.svelte), the Sources list,
	// and when this version was published.
	//
	// The page is the same for every reader. When the browser holds the
	// signed-in hint, the newest publication also asks the workspace what
	// this person may do with the essay; a person with access gets the bar
	// above the text (EssayAccessBar.svelte), the draft with its changes
	// marked, and the editor in place of the text, loaded only then.
	import { onMount } from 'svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import EssayAccessBar from '#lib/components/essays/EssayAccessBar.svelte';
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
		path
	}: {
		identifier: string;
		section: string;
		sectionLink: string;
		title: string;
		html: string;
		sources: SourceEntry[];
		publication: Publication;
		isNewest: boolean;
		newest: Publication;
		publicationCount: number;
		path: string;
	} = $props();

	const viewKey = 'essay-view';
	let access = $state<EssayPageState | null>(null);
	let view = $state<'published' | 'drafts'>('drafts');
	let mode = $state<'reading' | 'editing'>('reading');

	const shown = $derived(
		access?.draft && view === 'drafts' ? { html: access.draft.html, sources: access.draft.sources } : { html, sources }
	);

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
		void loadAccess();
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

	// Back to reading: show what was just saved.
	let previousMode: typeof mode = 'reading';
	$effect(() => {
		if (mode === 'reading' && previousMode === 'editing') void loadAccess();
		previousMode = mode;
	});
</script>

<svelte:head>
	<title>{title} · {section} · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small no-print">
	<a href={sectionLink}>{section}</a> › {title}
</nav>

{#if access}
	<EssayAccessBar state={access} bind:view bind:mode />
{/if}

<article class="reading essay">
	<!-- The editor shows the title as the essay's own first heading, to edit there. -->
	<h1 class:visually-hidden={mode === 'editing'}>{title}</h1>
	{#if !isNewest}
		<div class="notice" role="note">
			<p>
				This is an earlier version, published {publication.publishedAtText}. <a href={newest.link}>Read the current version</a>, published {newest.publishedAtText}.
			</p>
		</div>
	{/if}
	{#if access && mode === 'editing'}
		{#await import('#lib/components/essays/EssayEditor.svelte')}
			<p class="small muted">Opening the editor…</p>
		{:then { default: EssayEditor }}
			<EssayEditor {identifier} text={access.text} version={access.latest.number} canEdit={access.canEdit} autoSave onsaved={saved} />
		{:catch}
			<p class="small">The editor could not be opened. <a href="/workspace/essays/{identifier}/edit">Open it in the workspace</a>.</p>
		{/await}
	{:else}
		<div class="essay-text">
			{@html shown.html}
		</div>
		<SourceList sources={shown.sources} />
	{/if}
	<p class="small muted essay-dateline" data-print-part="pageDetails">
		Published {publication.publishedAtText}.
		{#if publicationCount > 1}<a class="no-print" href="{path}/history">Earlier versions</a>{/if}
	</p>
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
