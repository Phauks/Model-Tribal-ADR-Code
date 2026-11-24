<script lang="ts">
	// The caret that opens and shuts a part of the sidebar (SiteSidebar.svelte).
	// It sits to the left of the label it opens (Trevor, Nov. 23, 2026). Its name
	// stays the same, such as "Pages in Nations"; whether it is open is told by
	// aria-expanded, so a screen reader does not hear "Unfold Nations, collapsed".
	// Without a target it is an empty space of the same width, so labels in a
	// list line up. Without scripts nothing can fold, so neither shows.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		expanded = false,
		id,
		controls,
		name = '',
		size = 'item',
		onclick
	}: {
		expanded?: boolean;
		/** Its own id, for a heading's label that opens it too (SidebarGroups.svelte). */
		id?: string;
		/** The id of what it opens; leave it out for the empty space. */
		controls?: string;
		name?: string;
		/** A section's row is taller than an outline entry's. */
		size?: 'section' | 'item';
		onclick?: () => void;
	} = $props();
</script>

{#if controls}
	<button
		type="button"
		{id}
		class="fold needs-scripts {size}"
		aria-expanded={expanded}
		aria-controls={controls}
		title={name}
		{onclick}
	>
		<ChevronRight size={16} aria-hidden="true" />
		<span class="visually-hidden">{name}</span>
	</button>
{:else}
	<span class="fold needs-scripts space {size}" aria-hidden="true"></span>
{/if}

<style>
	.fold {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		margin: 0.2rem 0 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	/* Centered on a section's 2.5rem row. */
	.fold.section {
		margin-top: 0.375rem;
	}

	button.fold:hover {
		background: var(--color-surface);
		color: var(--color-ink);
	}

	.fold :global(svg) {
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.fold[aria-expanded='true'] :global(svg) {
		transform: rotate(90deg);
	}

	/* On phones every control is at least the site's touch size. */
	:global(.sidebar-narrow) .fold {
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
		margin-top: 0;
	}
</style>
