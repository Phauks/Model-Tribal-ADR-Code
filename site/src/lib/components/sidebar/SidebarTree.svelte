<script lang="ts">
	// One level of an outline in the sidebar, and the levels under it
	// (SiteSidebar.svelte): a section's pages, a page's headings. Each entry
	// with entries under it has a caret to its left; the entry that is the page
	// or heading being read is marked with a bar across its whole row.
	import type { OutlineItem } from '#lib/site-sections.ts';
	import FoldButton from './FoldButton.svelte';
	import Self from './SidebarTree.svelte';

	let {
		items,
		listId,
		depth = 1,
		shut = false,
		isActive,
		isCurrent,
		isOpen,
		ontoggle
	}: {
		items: OutlineItem[];
		listId: string;
		depth?: number;
		shut?: boolean;
		/** The page or heading being read. */
		isActive: (item: OutlineItem) => boolean;
		/** The page being read (as opposed to a heading on it). */
		isCurrent: (item: OutlineItem) => boolean;
		isOpen: (item: OutlineItem) => boolean;
		ontoggle: (item: OutlineItem) => void;
	} = $props();

	function ariaCurrent(item: OutlineItem): 'page' | 'location' | undefined {
		if (isCurrent(item)) return 'page';
		return item.link.startsWith('#') && isActive(item) ? 'location' : undefined;
	}
</script>

<ul class="outline" data-depth={depth} id={listId} hidden={shut}>
	{#each items as item, index (item.link)}
		{@const branch = Boolean(item.children?.length)}
		{@const open = branch && isOpen(item)}
		{@const active = isActive(item)}
		<li>
			<div class="entry" class:active>
				<FoldButton
					controls={branch ? `${listId}-${index}` : undefined}
					expanded={open}
					name="Contents of {item.label}"
					onclick={() => ontoggle(item)}
				/>
				<a href={item.link} class:active aria-current={ariaCurrent(item)}>
					{#if item.number}<span class="number">{item.number}</span>{/if}
					<span class="label"
						>{item.label}{#if item.note}{' '}<span class="note">({item.note})</span>{/if}</span
					>
				</a>
			</div>
			{#if branch && item.children}
				<Self
					items={item.children}
					listId="{listId}-{index}"
					depth={depth + 1}
					shut={!open}
					{isActive}
					{isCurrent}
					{isOpen}
					{ontoggle}
				/>
			{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.outline {
		font-size: var(--font-size-small);
		border-left: 1px solid var(--color-line);
		margin-left: var(--space-3) !important;
	}

	/* Without scripts nothing can be unfolded, so everything shows. */
	:global(:root:not([data-scripts='on'])) .outline[hidden] {
		display: block;
	}

	.entry {
		display: flex;
		align-items: flex-start;
		/* The bar marking where the reader is spans the whole row, caret included. */
		margin-left: -1px;
		border-left: 3px solid transparent;
	}

	a {
		display: flex;
		flex: 1;
		min-width: 0;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.35rem var(--space-3) 0.35rem var(--space-1);
		color: var(--color-ink-muted);
		text-decoration: none;
		line-height: 1.35;
	}

	:global(:root:not([data-scripts='on'])) a {
		padding-left: var(--space-3);
	}

	a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.number {
		flex: none;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.note {
		font-style: italic;
	}

	/* The page or heading being read: an orange bar and ink text. */
	.entry.active,
	.entry:has(> a[aria-current='page']) {
		border-left-color: var(--color-action);
		background: var(--color-surface);
	}

	a.active,
	a[aria-current='page'] {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	a.active .number,
	a[aria-current='page'] .number {
		color: var(--color-ink);
	}

	/* On phones each entry is at least the site's touch size. */
	:global(.sidebar-narrow) a {
		min-height: var(--layout-target-minimum);
		align-items: center;
	}
</style>
