<script lang="ts">
	// The bar an essay page shows above the text to a person with access to
	// the essay, and to nobody else (Trevor, 2026-11-22: review and edit in
	// place; draft status only for people with access). It is the same slim
	// bar as the editor's (essay-editor-mockups/3 and v2-1): the mode, what
	// to show (Published only or With drafts), then Edit, History and
	// Publish. Where the draft stands shows as labels under the title
	// (EssayStatusPills.svelte). The page's state comes from
	// src/lib/server/essay-page-state.ts.
	import History from '@lucide/svelte/icons/history';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Send from '@lucide/svelte/icons/send';
	import EssayModePicker from './EssayModePicker.svelte';
	import EssayViewPicker from './EssayViewPicker.svelte';
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
</script>

<div class="access-bar no-print" role="region" aria-label="Draft and editing">
	<EssayModePicker bind:mode canEdit={state.canEdit} />
	{#if state.draft && state.publishedVersion !== null}
		<EssayViewPicker bind:view bind:mode />
	{/if}
	<div class="end">
		{#if state.canEdit}
			<button class="button" type="button" onclick={() => (mode = 'editing')}><Pencil size={16} aria-hidden="true" /> Edit</button>
		{/if}
		<a class="icon-link" href="/workspace/essays/{state.identifier}" title="History: every saved version" aria-label="History"><History size={18} aria-hidden="true" /></a>
		{#if state.canPublish && state.draft}
			<form method="post" action="/workspace/essays/{state.identifier}?/publish">
				<input type="hidden" name="version" value={state.latest.number} />
				<button class="button" type="submit" title="Publish version {state.latest.number} for readers"><Send size={16} aria-hidden="true" /> Publish</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.access-bar {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-paper);
	}

	.end {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.end form {
		display: inline;
		margin: 0;
	}

	.button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.icon-link {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border-radius: var(--radius-control);
		color: var(--color-ink);
	}

	.icon-link:hover {
		background: var(--color-surface);
	}
</style>
