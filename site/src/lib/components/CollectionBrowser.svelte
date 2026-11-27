<!--
	@component
	A Federal collection's own page, browsed as a table grouped by President,
	decade or year, with its filters in the side column
	(src/lib/collection-browser.ts, sidebar/CollectionFilters.svelte; Trevor
	chose this for the executive orders on Nov. 27, 2026,
	design/federal-navigation/mockups/C2-*.png, and asked for it to serve the
	other Federal collections too). Every choice is a link or a form that
	sends the reader's choices in the address, so the Worker draws the page
	with them applied, it works without scripts, and any view can be shared.
	With scripts, a group's heading folds its rows.
-->
<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Filter from '@lucide/svelte/icons/filter';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import { crumbOf, type BrowseView } from '#lib/collection-browser.ts';
	import { readableDate } from '#lib/readable-date.ts';

	let { view, section }: { view: BrowseView; section: { label: string; href: string } } = $props();

	const number = (value: number) => value.toLocaleString('en-US');
	const crumbName = $derived(crumbOf(view.title));
	const trail = $derived(view.focus ? [{ label: section.label, href: section.href }, { label: crumbName, href: view.path }] : [{ label: section.label, href: section.href }]);

	// The number and date come before the title, the filters' columns after it (mockup C2).
	const leading = $derived(view.columns.filter((column) => column.key === 'number' || column.key === 'date'));
	const trailing = $derived(view.columns.filter((column) => column.key !== 'number' && column.key !== 'date'));
	const columnCount = $derived(view.columns.length + 1);
	const grouped = $derived(view.groupings.find((grouping) => grouping.chosen)?.key !== 'none');
	const sort = $derived(view.sorts.find((candidate) => candidate.chosen)!);
	const otherSort = $derived(view.sorts.find((candidate) => !candidate.chosen)!);

	/** Groups folded by the reader, by their place in the table; a new view opens them all again. */
	let folded = $state(new Set<number>());
	$effect(() => {
		void view;
		folded = new Set();
	});
	function toggle(index: number) {
		const next = new Set(folded);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		folded = next;
	}
</script>

<div class="collection-browser">
	<Breadcrumbs {trail} current={view.focus ?? crumbName} />
	<h1>{view.title}</h1>
	<p class="lead">{view.lead}{#if view.years}<span class="years">{view.years}</span>{/if}</p>

	<form class="find" method="get" action={view.path} role="search">
		<label class="visually-hidden" for="collection-find-main">{view.findHint}</label>
		<Search size={18} aria-hidden="true" />
		<input id="collection-find-main" type="search" name="q" value={view.find} placeholder={view.findHint} autocomplete="off" />
		{#each view.kept as field (`${field.name}=${field.value}`)}<input type="hidden" name={field.name} value={field.value} />{/each}
	</form>

	<div class="controls">
		<div class="group-by">
			<span class="control-label" id="group-by-label">Group by</span>
			<ul class="segments" aria-labelledby="group-by-label">
				{#each view.groupings as grouping (grouping.key)}
					<li><a href={grouping.href} aria-current={grouping.chosen ? 'true' : undefined} data-sveltekit-noscroll data-sveltekit-keepfocus>{grouping.label}</a></li>
				{/each}
			</ul>
		</div>
		<details class="sort">
			<summary><span class="visually-hidden">Order: </span>{sort.label}<ChevronDown size={16} aria-hidden="true" /></summary>
			<ul>
				{#each view.sorts as choice (choice.key)}
					<li><a href={choice.href} aria-current={choice.chosen ? 'true' : undefined} data-sveltekit-noscroll>{choice.label}</a></li>
				{/each}
			</ul>
		</details>
	</div>

	<p class="showing">
		{#if view.chips.length > 0}<Filter size={16} aria-hidden="true" />{/if}
		<span>Showing {number(view.shown)} of {number(view.total)}</span>
		{#each view.chips as chip (chip.href)}
			<a class="chip" href={chip.href} data-sveltekit-noscroll>{chip.label}<X size={14} aria-hidden="true" /><span class="visually-hidden"> (remove)</span></a>
		{/each}
		{#if view.clear}<a class="clear" href={view.clear} data-sveltekit-noscroll>Clear</a>{/if}
	</p>

	{#if view.groups.length > 0}
		<div class="table-scroll">
			<table>
				<caption class="visually-hidden">{view.focus ? `${view.title}: ${view.focus}` : view.title}</caption>
				<thead>
					<tr>
						{#each leading as column (column.key)}
							<th scope="col" class={column.key}>
								{#if column.key === 'date'}
									<a class="sort-header" href={otherSort.href} data-sveltekit-noscroll aria-label="Date, {sort.label.toLocaleLowerCase('en-US')}; show {otherSort.label.toLocaleLowerCase('en-US')}"
										>{column.label}{#if sort.key === 'newest'}<ArrowDown size={14} aria-hidden="true" />{:else}<ArrowUp size={14} aria-hidden="true" />{/if}</a
									>
								{:else}
									{column.label}
								{/if}
							</th>
						{/each}
						<th scope="col" class="title">Title</th>
						{#each trailing as column (column.key)}<th scope="col" class:wide={column.wide}>{column.label}</th>{/each}
					</tr>
				</thead>
				{#each view.groups as group, index (index)}
					<tbody>
						{#if grouped}
							<tr class="group">
								<th scope="rowgroup" colspan={columnCount}>
									<button type="button" class="fold" aria-expanded={!folded.has(index)} onclick={() => toggle(index)}>
										{#if folded.has(index)}<ChevronRight size={16} aria-hidden="true" />{:else}<ChevronDown size={16} aria-hidden="true" />{/if}
										<span class="group-name">{group.label}</span>
									</button>
									<CountBadge count={group.count} />
									{#if group.detail}<span class="group-detail">{group.detail}</span>{/if}
								</th>
							</tr>
						{/if}
						{#if !folded.has(index)}
							{#each group.rows as row (row.key)}
								<tr>
									{#each leading as column (column.key)}
										<td class={column.key}>{#if column.key === 'date'}{row.date ? readableDate(row.date) : ''}{:else}{row.number ?? '—'}{/if}</td>
									{/each}
									<th scope="row" class="title"><a href={row.href}>{row.title}</a></th>
									{#each trailing as column (column.key)}<td class:wide={column.wide}>{row.cells[column.key]}</td>{/each}
								</tr>
							{/each}
						{/if}
					</tbody>
				{/each}
			</table>
		</div>
		{#if view.more}<p class="show-more"><a href={view.more.href} data-sveltekit-noscroll>{view.more.label}</a></p>{/if}
	{:else}
		<p class="none">None Identified</p>
	{/if}
</div>

<style>
	h1 {
		margin-bottom: 0;
	}

	.lead {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		margin: var(--space-1) 0 var(--space-4);
		color: var(--color-ink-muted);
	}

	.years {
		font-variant-numeric: tabular-nums;
	}

	.find {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 44rem;
		margin-bottom: var(--space-4);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink-muted);
	}

	.find:focus-within {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.find input {
		flex: 1;
		min-width: 0;
		min-height: 3rem;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
	}

	.find input:focus {
		outline: none;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-5);
		margin-bottom: var(--space-3);
	}

	.group-by {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		white-space: nowrap;
	}

	.control-label {
		color: var(--color-ink-muted);
	}

	.segments {
		display: flex;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.segments a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		margin-left: -1px;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		text-decoration: none;
	}

	.segments li:first-child a {
		margin-left: 0;
		border-radius: var(--radius-control) 0 0 var(--radius-control);
	}

	.segments li:last-child a {
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
	}

	.segments a:hover {
		background: var(--color-surface);
	}

	.segments a[aria-current='true'] {
		position: relative;
		border-color: var(--color-band);
		background: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-bold);
	}

	.sort {
		position: relative;
	}

	.sort summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		cursor: pointer;
		list-style: none;
	}

	.sort summary::-webkit-details-marker {
		display: none;
	}

	.sort ul {
		position: absolute;
		z-index: 5;
		top: calc(100% + var(--space-1));
		left: 0;
		min-width: 100%;
		margin: 0;
		padding: var(--space-1) 0;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		list-style: none;
	}

	.sort ul a {
		display: block;
		padding: var(--space-2) var(--space-3);
		color: var(--color-ink);
		text-decoration: none;
		white-space: nowrap;
	}

	.sort ul a:hover,
	.sort ul a[aria-current='true'] {
		background: var(--color-surface);
	}

	.sort ul a[aria-current='true'] {
		font-weight: var(--font-weight-bold);
	}

	.showing {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0 var(--space-3);
		border-radius: 999px;
		background: var(--color-band);
		color: var(--color-band-text);
		text-decoration: none;
	}

	.chip:visited {
		color: var(--color-band-text);
	}

	td.wide {
		white-space: nowrap;
	}

	td.number,
	td.date {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	td.date {
		color: var(--color-ink-muted);
	}

	th.title {
		font-weight: inherit;
	}

	thead th.title {
		width: 100%;
		font-weight: var(--font-weight-semibold);
	}

	.sort-header {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: inherit;
		text-decoration: none;
	}

	tr.group th {
		padding-top: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 2px solid var(--color-line);
		background: var(--color-surface);
		white-space: nowrap;
	}

	.fold {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	/* Without scripts the rows cannot fold, so the chevron is left out. */
	:global(:root:not([data-scripts='on'])) .fold :global(svg) {
		display: none;
	}

	.group-detail {
		margin-left: var(--space-3);
		color: var(--color-ink-muted);
		font-weight: normal;
		font-variant-numeric: tabular-nums;
		white-space: normal;
	}

	.show-more {
		margin-top: calc(-1 * var(--space-3));
	}

	/* Phones keep the number, the date and the title (mockup C2, phone). */
	@media (max-width: 40rem) {
		.wide {
			display: none;
		}

		.segments a {
			padding: 0 var(--space-2);
		}

		.controls {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
