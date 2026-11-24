<!--
	Published only or With drafts, beside the mode in the bar
	(essay-editor-mockups/v2-1: "Published only or With drafts now sits in the
	top bar"). Reading, it chooses which text shows. In Commenting and
	Editing the text is always the draft with its changes marked, so choosing
	Published only goes back to reading the published text.
-->
<script lang="ts">
	import Layers from '@lucide/svelte/icons/layers';

	let {
		view = $bindable(),
		mode = $bindable()
	}: {
		view: 'published' | 'drafts';
		mode: 'reading' | 'commenting' | 'editing';
	} = $props();

	const shown = $derived(mode === 'reading' ? view : 'drafts');
</script>

<span class="view-picker">
	<Layers size={18} aria-hidden="true" />
	<label class="visually-hidden" for="essay-view">Show</label>
	<select
		id="essay-view"
		value={shown}
		onchange={(event) => {
			view = event.currentTarget.value as 'published' | 'drafts';
			if (view === 'published') mode = 'reading';
		}}
	>
		<option value="published">Published only</option>
		<option value="drafts">With drafts</option>
	</select>
</span>

<style>
	.view-picker {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.view-picker :global(svg) {
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
	}
</style>
