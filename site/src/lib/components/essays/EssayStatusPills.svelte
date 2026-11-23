<!--
	Where the draft stands, as short labels under the title
	(essay-editor-mockups/3): "Published, version 12", "3 draft changes",
	"+ 2 new blocks". Who saved the draft and when is in each label's tooltip.
-->
<script lang="ts">
	import Globe from '@lucide/svelte/icons/globe';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import type { EssayPageState } from '#lib/server/essay-page-state.ts';

	let { state }: { state: EssayPageState } = $props();

	const saved = $derived(`Newest draft: version ${state.latest.number}, saved ${state.latest.savedAtText}${state.latest.by === 'git' ? ', brought in from git' : ` by ${state.latest.by}`}.`);
</script>

<p class="pills no-print">
	{#if state.publishedVersion === null}
		<span class="pill pill-unpublished" title={saved}><Globe size={15} aria-hidden="true" /> Not published yet</span>
	{:else}
		<span class="pill pill-published" title="Readers see version {state.publishedVersion}."><Globe size={15} aria-hidden="true" /> Published, version {state.publishedVersion}</span>
	{/if}
	{#if state.draft?.changed}
		<span class="pill pill-draft" title={saved}><Pencil size={15} aria-hidden="true" /> {state.draft.changed} draft {state.draft.changed === 1 ? 'change' : 'changes'}</span>
	{/if}
	{#if state.draft?.added && state.publishedVersion !== null}
		<span class="pill pill-new" title={saved}><Plus size={15} aria-hidden="true" /> {state.draft.added} new {state.draft.added === 1 ? 'block' : 'blocks'}</span>
	{/if}
	{#if state.gitConflicts > 0}
		<a class="pill pill-conflict" href="/workspace/essays">Git changed {state.gitConflicts === 1 ? 'a paragraph' : `${state.gitConflicts} paragraphs`} also edited here</a>
	{/if}
</p>

<style>
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.15rem var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}

	.pill-published {
		border-color: var(--color-link);
		color: var(--color-link);
	}

	.pill-unpublished {
		border-style: dashed;
		color: var(--color-ink-muted);
	}

	.pill-draft {
		border-color: var(--color-action);
		color: var(--color-action);
	}

	.pill-new {
		border-style: dashed;
		border-color: var(--color-action);
		color: var(--color-action);
	}

	.pill-conflict {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
</style>
