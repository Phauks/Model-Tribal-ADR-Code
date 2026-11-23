<script lang="ts">
	/**
	 * The thin bar at the top of a video call's page, which has the whole
	 * window (src/routes/+layout.svelte): the room's name, when it runs, and
	 * any links, so the call itself gets the rest of the screen.
	 */
	import type { Snippet } from 'svelte';

	let { title, when, children }: { title: string; when?: string; children?: Snippet } = $props();
</script>

<header class="call-bar">
	<h1>{title}</h1>
	{#if when}<p class="small">{when}</p>{/if}
	{#if children}<div class="small links">{@render children()}</div>{/if}
</header>

<style>
	.call-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
	}

	h1 {
		font-size: 1.25rem;
		margin: 0;
	}

	p,
	.links {
		margin: 0;
	}

	.links :global(p) {
		margin: 0;
	}
</style>
