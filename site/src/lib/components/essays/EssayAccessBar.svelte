<script lang="ts">
	// The bar an essay page shows above the text to a person with access to
	// the essay, and to nobody else (Trevor, 2026-11-22: review and edit in
	// place; draft status only for people with access). It says where the
	// draft stands and holds the two choices: what to show (Published only
	// or With drafts) and what to do (Reading Commenting or Editing). The page's state
	// comes from src/lib/server/essay-page-state.ts.
	// An Edit button sits beside the Mode choice so editing is easy to find
	// (Trevor, Nov. 23, 2026: "cannot figure out how to access it"), and Done
	// goes back to reading.
	import Pencil from '@lucide/svelte/icons/pencil';
	import Check from '@lucide/svelte/icons/check';
	import type { EssayPageState } from '#lib/server/essay-page-state.ts';

	let {
		state,
		view = $bindable(),
		mode = $bindable()
	}: {
		state: EssayPageState;
		view: 'published' | 'drafts';
		mode: 'reading' | 'commenting' | 'editing';
	} = $props();

	const draftSummary = $derived.by(() => {
		const draft = state.draft;
		if (!draft) return null;
		const parts = [];
		if (draft.changed) parts.push(`${draft.changed} changed ${draft.changed === 1 ? 'block' : 'blocks'}`);
		if (draft.added) parts.push(`${draft.added} new ${draft.added === 1 ? 'block' : 'blocks'}`);
		return parts.join(', ');
	});
</script>

<div class="access-bar no-print" role="region" aria-label="Draft and editing">
	<p class="status small">
		{#if state.publishedVersion === null}
			<span class="dot dot-draft" aria-hidden="true"></span> Not published yet. Draft: version {state.latest.number}, saved {state.latest.savedAtText} by {state.latest.by}.
		{:else if state.draft}
			<span class="dot dot-draft" aria-hidden="true"></span> Draft: version {state.latest.number}, saved {state.latest.savedAtText} by {state.latest.by}{draftSummary ? ` (${draftSummary})` : ''}. Readers see version {state.publishedVersion}.
		{:else}
			<span class="dot dot-published" aria-hidden="true"></span> Readers see the newest version ({state.publishedVersion}).
		{/if}
		{#if state.gitConflicts > 0}
			<strong>Git changed {state.gitConflicts === 1 ? 'a paragraph' : `${state.gitConflicts} paragraphs`} also edited here.</strong>
			<a href="/workspace/essays">Settle it</a>.
		{/if}
	</p>
	<div class="controls">
		{#if state.canEdit && mode === 'reading'}
			<button class="button" type="button" onclick={() => (mode = 'editing')}><Pencil size={16} aria-hidden="true" /> Edit</button>
		{:else if mode !== 'reading'}
			<button class="button" type="button" onclick={() => (mode = 'reading')}><Check size={16} aria-hidden="true" /> Done</button>
		{/if}
		{#if state.draft && state.publishedVersion !== null}
			<label class="small" for="essay-view">Show</label>
			<select id="essay-view" bind:value={view} disabled={mode !== 'reading'}>
				<option value="published">Published only</option>
				<option value="drafts">With drafts</option>
			</select>
		{/if}
		<label class="small" for="essay-mode">Mode</label>
		<select id="essay-mode" bind:value={mode}>
			<option value="reading">Reading</option>
			<!-- Commenting: select words in the draft and comment on them; the text stays as the authors wrote it. -->
			<option value="commenting">Commenting</option>
			{#if state.canEdit}<option value="editing">Editing</option>{/if}
		</select>
		<a class="small" href="/workspace/essays/{state.identifier}">History</a>
		{#if state.canPublish && state.draft && mode === 'reading'}
			<form method="post" action="/workspace/essays/{state.identifier}?/publish">
				<input type="hidden" name="version" value={state.latest.number} />
				<button class="button" type="submit">Publish version {state.latest.number}</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.access-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin: 0 0 var(--space-4);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface);
	}

	.status {
		margin: 0;
		flex: 1 1 20rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.controls .button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.controls form {
		display: inline;
		margin: 0;
	}

	.dot {
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		border-radius: 50%;
		margin-right: var(--space-1);
		vertical-align: 0.05em;
	}

	.dot-draft {
		background: var(--color-action);
	}

	.dot-published {
		background: var(--color-link);
	}
</style>
