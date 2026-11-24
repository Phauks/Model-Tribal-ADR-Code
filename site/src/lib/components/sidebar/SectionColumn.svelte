<script lang="ts">
	// The sidebar's second column: the pages of the section being read
	// (SiteSidebar.svelte). Trevor chose on Nov. 23, 2026 to keep the first
	// column to the site's sections and list a section's pages here instead:
	// its own pages, then its long list (the nations, the stories, the
	// glossary's terms) with a filter, in groups by letter when it is long.
	// The page being read opens under its entry into its headings
	// (src/lib/sidebar-outline.ts). Without scripts the filter is hidden and
	// the whole list shows.
	import Search from '@lucide/svelte/icons/search';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import { filterEntries, letterGroups, type SectionContents } from '#lib/sidebar-outline.ts';
	import type { OutlineItem, SiteSection } from '#lib/site-sections.ts';
	import SidebarTree from './SidebarTree.svelte';
	import NewEssayButton from '#lib/components/essays/NewEssayButton.svelte';
	import { newEssayPlace } from '#lib/essays/new-essay.svelte.ts';

	let {
		idSuffix,
		section,
		contents,
		outlineTitle,
		sectionIsCurrent,
		isActive,
		isCurrent,
		isOpen,
		ontoggle
	}: {
		idSuffix: string;
		section: SiteSection;
		contents: SectionContents;
		/** A heading above a page's outline when the section lists no pages, such as the code's title. */
		outlineTitle: string | undefined;
		/** Whether the reader is on the section's own page. */
		sectionIsCurrent: boolean;
		isActive: (item: OutlineItem) => boolean;
		isCurrent: (item: OutlineItem) => boolean;
		isOpen: (item: OutlineItem) => boolean;
		ontoggle: (item: OutlineItem) => void;
	} = $props();

	/** A list this long gets a filter, and one longer still is grouped by letter. */
	const filterFrom = 10;
	const groupFrom = 60;

	let filter = $state('');
	const entries = $derived(contents.entries);
	const shown = $derived(entries ? filterEntries(entries.items, filter) : []);
	const groups = $derived(
		entries && entries.items.length > groupFrom ? letterGroups(shown) : [{ letter: '', items: shown }]
	);
	const listIdentifier = $derived(`sidebar-column-${idSuffix}`);
</script>

<!-- "New essay" sits beside the section's name, as in essay-editor-mockups/4 and v2-1 (new-essay.svelte.ts). -->
<div class="column-title">
	<a href={section.link} aria-current={sectionIsCurrent ? 'page' : undefined}>{section.label}</a>
	{#if newEssayPlace.current?.sectionLink === section.link}<NewEssayButton part={newEssayPlace.current.part} sectionLabel={section.label} size={18} compact />{/if}
</div>
{#if outlineTitle}<p class="outline-title">{outlineTitle}</p>{/if}
{#if contents.pages.length > 0}
	<SidebarTree items={contents.pages} listIdentifier="{listIdentifier}-pages" flush {isActive} {isCurrent} {isOpen} {ontoggle} />
{/if}
{#if entries && entries.items.length > 0}
	<div class="entries" class:after-pages={contents.pages.length > 0}>
		{#if entries.title}
			<p class="entries-title">
				<span>{entries.title} <CountBadge count={entries.count ?? entries.items.length} label={entries.noun} /></span>
				{#if entries.viewAll}<a href={entries.viewAll} aria-current={sectionIsCurrent && entries.viewAll === section.link ? 'page' : undefined}>View all</a>{/if}
			</p>
		{/if}
		{#if entries.items.length > filterFrom}
			<label class="filter needs-scripts">
				<Search size={16} aria-hidden="true" />
				<span class="visually-hidden">Filter {entries.noun}</span>
				<input type="search" placeholder="Filter {entries.noun}" autocomplete="off" bind:value={filter} />
			</label>
		{/if}
		{#if shown.length === 0}
			<p class="none" role="status">No {entries.noun} match.</p>
		{/if}
		{#each groups as group (group.letter)}
			{#if group.letter}<p class="letter">{group.letter}</p>{/if}
			<!-- A long list is plain links, kept light because it can hold every nation;
			     only the page being read, with its headings, is a full outline. -->
			<ul class="entry-list">
				{#each group.items as item (item.link)}
					<li>
						{#if item.children?.length}
							<SidebarTree items={[item]} listIdentifier="{listIdentifier}-here" flush {isActive} {isCurrent} {isOpen} {ontoggle} />
						{:else}
							<a href={item.link} aria-current={isCurrent(item) ? 'page' : undefined}>{item.label}</a>
						{/if}
					</li>
				{/each}
			</ul>
		{/each}
	</div>
{/if}

<style>
	.column-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		padding-right: var(--space-2);
	}

	.column-title a {
		flex: 1;
		display: flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
	}

	.column-title a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.column-title a[aria-current='page'] {
		color: var(--color-link);
	}

	.outline-title {
		margin: var(--space-2) var(--space-3) var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.entries.after-pages {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.entries-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		padding: 0 0 0 var(--space-3);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.entries-title a {
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		font-weight: var(--font-weight-semibold);
	}

	.entries-title a:hover {
		background: var(--color-surface);
	}

	.filter {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		padding: 0 var(--space-2);
		min-height: 2.5rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink-muted);
	}

	.filter input {
		flex: 1;
		min-width: 0;
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
	}

	.letter {
		margin: var(--space-3) var(--space-3) var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.entry-list {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: var(--font-size-small);
	}

	/* Lined up with the outline's labels, which leave room for a caret. */
	.entry-list :global(> li > a) {
		display: block;
		padding: 0.35rem var(--space-3) 0.35rem calc(2px + 1.75rem + var(--space-1));
		color: var(--color-ink-muted);
		text-decoration: none;
		line-height: 1.35;
	}

	:global(:root:not([data-scripts='on'])) .entry-list :global(> li > a) {
		padding-left: calc(2px + var(--space-3));
	}

	.entry-list :global(> li > a:hover) {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.entry-list :global(> li > a[aria-current='page']) {
		box-shadow: inset 3px 0 var(--color-action);
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	:global(.sidebar-narrow) .entry-list :global(> li > a) {
		display: flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		box-sizing: border-box;
	}

	.none {
		margin: var(--space-2) var(--space-3);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	:global(.sidebar-narrow) .filter {
		min-height: var(--layout-target-minimum);
	}

	:global(.sidebar-narrow) .column-title a {
		min-height: var(--layout-target-minimum);
	}
</style>
