<!--
	@component
	A data table that readers can sort and search (spikes/tables/REPORT.md).

	The page is built with every row already in order, as a plain <table>, so
	it reads the same with scripts turned off. Once scripts run, sortable
	headers become buttons and, when searchLabel is given, a search box and a
	live count appear above the table. Sorting follows the WAI-ARIA Authoring
	Practices sortable table example: the sorted column's header carries
	aria-sort, and the button names the column.

	Columns marked custom are drawn by the page through the cell snippet; the
	cell's text is still what the search box looks in.

	Three more tools, each turned on by the page (Trevor chose filterable,
	downloadable tables on Nov. 23, 2026):
	- filters: a menu for each column marked filterable, listing its values
	  with how many rows each leaves.
	- download: a "Download CSV" button that saves the rows as shown, after
	  search, filters and sort, as <download>.csv.
	- shareable: the search, sort and filters go into the page address as the
	  reader changes them, and "Copy link" copies it, so the link opens the
	  table the same way.
	The tools appear only once scripts run; without them the full table shows.

	Use:
	<DataTable identifier="nations" label="Table: nations" {columns} {rows}
		defaultSort={{ key: 'name', direction: 'ascending' }} searchLabel="Search nations" />
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import Download from '@lucide/svelte/icons/download';
	import Link from '@lucide/svelte/icons/link';
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import {
		applyColumnFilters,
		filterChoices,
		filterRows,
		readTableState,
		rowsToCsv,
		sortRows,
		writeTableState,
		type ColumnFilters,
		type TableColumn,
		type TableRow,
		type TableSort
	} from '#lib/tables/table-definition.ts';

	interface Props {
		/** Unique on the page; used for element ids. */
		identifier: string;
		/** The scrolling region's accessible name, such as "Table: nations". */
		label: string;
		/** Shown above the table and read first by screen readers. */
		caption?: string;
		columns: TableColumn[];
		rows: TableRow[];
		/** The order the table is built in. Rows keep their given order when left out. */
		defaultSort?: TableSort;
		/** Shows a search box with this label. */
		searchLabel?: string;
		/** What one row is, for the count: [singular, plural]. */
		rowName?: [string, string];
		/** Draws the cells of columns marked custom. */
		cell?: Snippet<[TableRow, TableColumn]>;
		/** Shown in place of the default message when a search finds nothing; gets the search text. */
		empty?: Snippet<[string]>;
		/** Shows a menu for each filterable column. */
		filters?: boolean;
		/** Shows a "Download CSV" button; the file is named this, plus .csv. */
		download?: string;
		/** Keeps the search, sort and filters in the page address and shows "Copy link". */
		shareable?: boolean;
		/** False leaves out "Showing N of N rows" until a filter or search narrows the table, as beside the map, where the count is clutter (Trevor, 2026-11-23). */
		count?: boolean;
	}

	let {
		identifier,
		label,
		caption,
		columns,
		rows,
		defaultSort,
		searchLabel,
		rowName = ['row', 'rows'],
		cell,
		empty,
		filters = false,
		download,
		shareable = false,
		count: showCount = true
	}: Props = $props();

	let interactive = $state(false);
	let chosenSort = $state<TableSort | undefined>(undefined);
	let query = $state('');
	let columnFilters = $state<ColumnFilters>({});
	let copyStatus = $state('');

	const sort = $derived(chosenSort ?? defaultSort);
	const filterColumns = $derived(filters ? columns.filter((column) => column.filterable) : []);
	const shownRows = $derived.by(() => {
		const found = applyColumnFilters(filterRows(columns, rows, query), columnFilters);
		return sort ? sortRows(columns, found, sort) : found;
	});
	const narrowed = $derived(query.trim() !== '' || Object.values(columnFilters).some(Boolean));
	const hasTools = $derived(Boolean(searchLabel) || filterColumns.length > 0 || Boolean(download) || shareable);
	const count = $derived(
		`Showing ${shownRows.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} ${
			rows.length === 1 ? rowName[0] : rowName[1]
		}`
	);

	function sortBy(column: TableColumn) {
		const ascending = sort?.key !== column.key || sort.direction === 'descending';
		chosenSort = { key: column.key, direction: ascending ? 'ascending' : 'descending' };
	}

	/** The choices a column's menu offers, counted among the rows the other filters and the search leave. */
	function choicesFor(column: TableColumn) {
		const others = Object.fromEntries(Object.entries(columnFilters).filter(([key]) => key !== column.key));
		return filterChoices(column, applyColumnFilters(filterRows(columns, rows, query), others));
	}

	function clearFilters() {
		query = '';
		columnFilters = {};
	}

	function saveCsv() {
		const text = rowsToCsv(columns, shownRows, location.origin);
		const address = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = address;
		link.download = `${download}.csv`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(address), 0);
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(location.href);
			copyStatus = 'Link copied.';
		} catch {
			copyStatus = `Copy this link: ${location.href}`;
		}
	}

	// Keeps the page address in step with the table, without adding to the
	// browser's history at each keystroke.
	$effect(() => {
		if (!interactive || !shareable) return;
		const parameters = writeTableState(
			identifier,
			{ query, sort: chosenSort, filters: columnFilters },
			new URLSearchParams(location.search),
			defaultSort
		);
		const search = parameters.toString();
		const next = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
		if (next !== `${location.pathname}${location.search}${location.hash}`) {
			history.replaceState(history.state, '', next);
		}
		copyStatus = '';
	});

	onMount(() => {
		if (shareable) {
			const state = readTableState(identifier, columns, new URLSearchParams(location.search));
			query = state.query;
			chosenSort = state.sort;
			columnFilters = state.filters;
		}
		interactive = true;
	});
</script>

{#if interactive && hasTools}
	{#if searchLabel || filterColumns.length > 0}
	<div class="table-tools no-print">
		{#if searchLabel}
			<div class="field">
				<label for="{identifier}-search">{searchLabel}</label>
				<input id="{identifier}-search" type="search" autocomplete="off" bind:value={query} />
			</div>
		{/if}
		{#each filterColumns as column (column.key)}
			<div class="field filter-field">
				<label for="{identifier}-filter-{column.key}">{column.header}</label>
				<select id="{identifier}-filter-{column.key}" bind:value={columnFilters[column.key]}>
					<option value="">All</option>
					{#each choicesFor(column) as choice (choice.value)}
						<option value={choice.value}>{choice.value} ({choice.count.toLocaleString('en-US')})</option>
					{/each}
					{#if columnFilters[column.key] && !choicesFor(column).some((choice) => choice.value === columnFilters[column.key])}
						<option value={columnFilters[column.key]}>{columnFilters[column.key]} (0)</option>
					{/if}
				</select>
			</div>
		{/each}
	</div>
	{/if}
	<div class="table-status no-print">
		<p class="small muted table-count" role="status">{showCount || narrowed ? count : ''}</p>
		{#if narrowed && (filterColumns.length > 0 || searchLabel)}
			<button type="button" class="button button-quiet small-button" onclick={clearFilters}>Show all</button>
		{/if}
		{#if shareable}
			<button type="button" class="button button-quiet small-button" onclick={copyLink}>
				<Link aria-hidden="true" size="1.1em" strokeWidth={1.75} />Copy link
			</button>
		{/if}
		{#if download}
			<button type="button" class="button button-quiet small-button" onclick={saveCsv}>
				<Download aria-hidden="true" size="1.1em" strokeWidth={1.75} />Download CSV
			</button>
		{/if}
		{#if copyStatus}<p class="small table-copied" role="status">{copyStatus}</p>{/if}
	</div>
{/if}

<div class="table-scroll" role="region" aria-label={label} data-print-part="tables" {@attach keyboardScroll}>
	<table id={identifier}>
		{#if caption}<caption>{caption}</caption>{/if}
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th
						scope="col"
						class:number={column.type === 'number'}
						aria-sort={sort?.key === column.key ? sort.direction : undefined}
					>
						{#if interactive && column.sortable}
							<button type="button" class="sort-button" onclick={() => sortBy(column)}>
								{column.header}
								{#if sort?.key === column.key && sort.direction === 'ascending'}
									<ArrowUp aria-hidden="true" size="1em" />
								{:else if sort?.key === column.key}
									<ArrowDown aria-hidden="true" size="1em" />
								{:else}
									<ArrowUpDown aria-hidden="true" size="1em" class="muted" />
								{/if}
							</button>
						{:else}
							{column.header}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each shownRows as row (row.key)}
				<tr id={row.anchor}>
					{#each columns as column (column.key)}
						{@const value = row.cells[column.key]}
						{#snippet content()}
							{#if column.custom && cell}
								{@render cell(row, column)}
							{:else if value?.href}
								<a href={value.href}>{value.text}</a>
							{:else}
								{value?.text ?? ''}
							{/if}
						{/snippet}
						{#if column.isRowHeader}
							<th scope="row">{@render content()}</th>
						{:else}
							<td class:number={column.type === 'number'}>{@render content()}</td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
{#if shownRows.length === 0 && query.trim() !== ''}
	<div class="table-empty">
		{#if empty}
			{@render empty(query.trim())}
		{:else}
			<p>Nothing matches “{query.trim()}”.</p>
		{/if}
	</div>
{:else if shownRows.length === 0 && narrowed}
	<div class="table-empty">
		<p>No rows match these filters.</p>
	</div>
{/if}

<style>
	.table-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-2) var(--space-4);
		margin-bottom: var(--space-3);
	}

	.table-tools .field {
		flex: 1 1 16rem;
		max-width: 28rem;
		margin: 0;
	}

	.table-tools .filter-field {
		flex: 0 1 14rem;
	}

	.filter-field select {
		width: 100%;
	}

	.table-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-bottom: var(--space-3);
	}

	.table-count {
		margin: 0;
		margin-right: auto;
	}

	.table-copied {
		flex-basis: 100%;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.small-button {
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
	}

	caption {
		text-align: left;
		font-weight: var(--font-weight-semibold);
		padding-bottom: var(--space-2);
	}

	.number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* The header stays a header: the button takes its text and adds the arrow. */
	.sort-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		margin: calc(-1 * var(--space-2)) 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
	}

	.sort-button :global(svg) {
		flex: none;
	}

	.table-empty {
		margin-top: calc(-1 * var(--space-3));
	}
</style>
