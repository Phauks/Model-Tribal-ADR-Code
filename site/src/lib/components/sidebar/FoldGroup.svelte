<script lang="ts">
	// A list in the sidebar under a heading that folds it: the site's Sections,
	// Your account, the Workspace and each of the Workspace's categories. They
	// share this one component, so they look and behave alike (Trevor, Nov. 24,
	// 2026: "refactor to use one component"). The heading's name is the label of
	// its caret, so clicking either opens or shuts the list (Trevor, Nov. 24,
	// 2026: "should be able to open section by clicking text, not just the
	// arrow"). The caller passes the list's items; their links get the same
	// look here: the page or section being read has an orange bar.
	import type { Snippet } from 'svelte';
	import FoldButton from './FoldButton.svelte';

	let {
		id,
		title,
		open,
		folds = true,
		nested = false,
		listClass = '',
		ontoggle,
		after,
		children
	}: {
		/** The start of the ids of the heading, its caret and its list. */
		id: string;
		title: string;
		open: boolean;
		/** Whether it folds; when it does not, the heading is left out (the phone menu's sections). */
		folds?: boolean;
		/** A group inside another, such as a Workspace category: set in a little. */
		nested?: boolean;
		/** A class of the list's own, for the caller's rules (such as "sections"). */
		listClass?: string;
		ontoggle: () => void;
		/** Anything shown at the end of the heading, such as a count. */
		after?: Snippet;
		/** The list's items, each an <li>. */
		children: Snippet;
	} = $props();
</script>

<div class="fold-group" class:nested>
	{#if folds}
		<div class="group-heading">
			<FoldButton id="{id}-fold" controls="{id}-list" expanded={open} name="Pages in {title}" onclick={ontoggle} />
			<label class="group-title" for="{id}-fold" id="{id}-title">{title}</label>
			{@render after?.()}
		</div>
	{/if}
	<ul class="fold-list {listClass}" id="{id}-list" aria-labelledby={folds ? `${id}-title` : undefined} hidden={folds && !open}>
		{@render children()}
	</ul>
</div>

<style>
	.fold-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.nested {
		margin-left: var(--space-3);
	}

	.group-heading {
		display: flex;
		align-items: center;
		margin-bottom: var(--space-1);
	}

	.group-title {
		flex: 1;
		margin: 0;
		padding: 0 var(--space-3) 0 var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.group-title:hover {
		color: var(--color-ink);
		text-decoration: underline;
	}

	/* Without scripts nothing folds: no caret, the name is plain, and the list shows. */
	:global(:root:not([data-scripts='on'])) .group-title {
		padding-left: var(--space-3);
		cursor: auto;
		text-decoration: none;
	}

	:global(:root:not([data-scripts='on'])) .fold-list[hidden] {
		display: block;
	}

	/* Every list's links look alike: a row of ink in semibold, like the sections. */
	.fold-list > :global(li > a),
	.fold-list > :global(li > .unbuilt) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	/* Named but not linked yet, such as a section whose pages are not published. */
	.fold-list > :global(li > .unbuilt) {
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-regular);
	}

	.fold-list > :global(li > a:hover) {
		background: var(--color-surface);
		text-decoration: underline;
	}

	/* The section or page being read: an orange bar and the link color. */
	.fold-list > :global(li.current > a),
	.fold-list > :global(li > a[aria-current='page']) {
		border-left: 3px solid var(--color-action);
		border-radius: 0;
		background: var(--color-surface);
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	/* On phones each link is at least the site's touch size. */
	:global(.sidebar-narrow) .fold-list > :global(li > a),
	:global(.sidebar-narrow) .fold-list > :global(li > .unbuilt) {
		min-height: var(--layout-target-minimum);
	}
</style>
