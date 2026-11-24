<!--
	The page's Reading, Commenting and Editing choice, at the start of the
	bar (essay-editor-mockups/3: "pick Reading, Commenting or Editing").
-->
<script lang="ts">
	import BookOpenText from '@lucide/svelte/icons/book-open-text';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Pencil from '@lucide/svelte/icons/pencil';

	let { mode = $bindable(), canEdit }: { mode: 'reading' | 'commenting' | 'editing'; canEdit: boolean } = $props();
</script>

<span class="mode-picker">
	{#if mode === 'editing'}<Pencil size={18} aria-hidden="true" />{:else if mode === 'commenting'}<MessageSquare size={18} aria-hidden="true" />{:else}<BookOpenText size={18} aria-hidden="true" />{/if}
	<label class="visually-hidden" for="essay-mode">Mode</label>
	<select id="essay-mode" bind:value={mode}>
		<option value="reading">Reading</option>
		<option value="commenting">Commenting</option>
		{#if canEdit}<option value="editing">Editing</option>{/if}
	</select>
</span>

<style>
	.mode-picker {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.mode-picker :global(svg) {
		position: absolute;
		left: calc(var(--space-1) + 2px);
		pointer-events: none;
	}

	/* As wide as the choice shown, as on the mockups, where the browser can. */
	select {
		width: auto;
		min-width: 0;
		field-sizing: content;
		min-height: var(--bar-target, var(--layout-target-minimum));
		font-size: var(--font-size-small);
		padding-left: calc(var(--space-1) + 1.5rem);
		font-weight: var(--font-weight-semibold);
	}
</style>
