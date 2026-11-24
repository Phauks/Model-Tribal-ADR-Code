<script lang="ts">
	// One level of an outline in the sidebar, and the levels under it
	// (SiteSidebar.svelte): a section's pages, a page's headings. Each entry
	// with entries under it has a caret to its left; the entry that is the page
	// or heading being read is marked with a bar across its whole row.
	// While an essay is edited, its case, law and analysis boxes show their
	// icons, and a dot after an entry marks a draft change (amber), something
	// new (an amber ring) or a section in review (purple), as in
	// essay-editor-mockups/4 and v2-1 (src/lib/essays/editor-outline.ts).
	import Landmark from '@lucide/svelte/icons/landmark';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Scale from '@lucide/svelte/icons/scale';
	import type { OutlineItem, OutlineMark } from '#lib/site-sections.ts';
	import FoldButton from './FoldButton.svelte';
	import Self from './SidebarTree.svelte';

	let {
		items,
		listId,
		depth = 1,
		shut = false,
		flush = false,
		isActive,
		isCurrent,
		isOpen,
		ontoggle
	}: {
		items: OutlineItem[];
		listId: string;
		depth?: number;
		shut?: boolean;
		/** A top-level list in the second column, with no rule or indent of its own. */
		flush?: boolean;
		/** The page or heading being read. */
		isActive: (item: OutlineItem) => boolean;
		/** The page being read (as opposed to a heading on it). */
		isCurrent: (item: OutlineItem) => boolean;
		isOpen: (item: OutlineItem) => boolean;
		ontoggle: (item: OutlineItem) => void;
	} = $props();

	const kindIcons = { case: Scale, law: Landmark, analysis: Lightbulb };
	const markWords: Record<OutlineMark, string> = { changed: 'Changed in the draft', new: 'New in the draft', review: 'In review' };

	/** A case's name and its year: "Worcester v. Georgia" and " (1832)". */
	function caseParts(label: string): [string, string] {
		const at = label.search(/\s\(\d{4}\)$/);
		return at > 0 ? [label.slice(0, at), label.slice(at)] : [label, ''];
	}

	function ariaCurrent(item: OutlineItem): 'page' | 'location' | undefined {
		if (isCurrent(item)) return 'page';
		return item.link.startsWith('#') && isActive(item) ? 'location' : undefined;
	}
</script>

<ul class="outline" class:flush data-depth={depth} id={listId} hidden={shut}>
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
					{#if item.kind}
						{@const Icon = kindIcons[item.kind]}
						<span class="kind kind-{item.kind}"><Icon size={15} aria-hidden="true" /></span>
					{/if}
					<span class="label"
						>{#if item.kind === 'case'}{@const [name, year] = caseParts(item.label)}<em>{name}</em>{year}{:else}{item.label}{/if}{#if item.note}{' '}<span
								class="note">({item.note})</span
							>{/if}</span
					>
					{#if item.mark}<span class="mark mark-{item.mark}" title={markWords[item.mark]}><span class="visually-hidden">({markWords[item.mark]})</span></span>{/if}
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

	.outline.flush {
		border-left: 0;
		margin-left: 0 !important;
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

	.label {
		flex: 1;
		min-width: 0;
	}

	.kind {
		flex: none;
		display: inline-flex;
		align-self: center;
	}

	.kind-case,
	.kind-analysis {
		color: var(--color-link);
	}

	.kind-law {
		color: var(--color-action);
	}

	/* The dots, in the status colors of the essay's pills (EssayStatusPills.svelte). */
	.mark {
		flex: none;
		align-self: center;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
	}

	.mark-changed {
		background: var(--color-status-draft-rule);
	}

	.mark-new {
		border: 2px solid var(--color-status-draft-rule);
	}

	.mark-review {
		background: var(--color-status-review-rule);
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
