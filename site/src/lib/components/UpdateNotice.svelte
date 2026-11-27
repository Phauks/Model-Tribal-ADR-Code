<script lang="ts">
	// Starts the update sequence (site/DESIGN.md, section 10, "Updates") and
	// shows the status line while kept pages are saved again after an update.
	// The notice that an update is ready lives in the masthead
	// (UpdateButton.svelte), as Trevor asked on Nov. 27, 2026, so it never
	// covers the page.
	import { onMount } from 'svelte';
	import { updated } from '$app/state';
	import { siteUpdates } from '#lib/site-updates.svelte.ts';

	onMount(() => {
		void siteUpdates.start();
	});

	$effect(() => {
		if (updated.current) siteUpdates.newBuildSeen();
	});
</script>

<div class="update-toasts no-print">
	{#if siteUpdates.resaving}
		<div class="notice update-toast" role="status">
			<p>
				Saving the latest copies of the pages you chose: {siteUpdates.resaving.done} of {siteUpdates
					.resaving.total} pages.
			</p>
		</div>
	{/if}
</div>

<style>
	/* Fixed to the bottom left, above the page; on a phone it spans the width less the side gutters. */
	.update-toasts {
		position: fixed;
		left: var(--space-4);
		bottom: var(--space-4);
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(var(--layout-popover), calc(100% - 2 * var(--space-4)));
		pointer-events: none;
	}

	.update-toast {
		pointer-events: auto;
		margin: 0;
		border: 2px solid var(--color-control-border);
		border-left-width: 6px;
		border-left-color: var(--color-link);
		font-size: var(--font-size-small);
	}

	.update-toast p {
		margin: 0;
	}
</style>
