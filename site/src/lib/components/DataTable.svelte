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

	Use:
	<DataTable identifier="nations" label="Table: nations" {columns} {rows}
		defaultSort={{ key: 'name', direction: 'ascending' }} searchLabel="Search nations" />
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import {
		filterRows,
		sortRows,
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
		empty
	}: Props = $props();

	let interactive = $state(false);
	let chosenSort = $state<TableSort | undefined>(undefined);
	let query = $state('');

	const sort = $derived(chosenSort ?? defaultSort);
	const shownRows = $derived.by(() => {
		const found = filterRows(columns, rows, query);
		return sort ? sortRows(columns, found, sort) : found;
	});
	const count = $derived(
		`Showing ${shownRows.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} ${
			rows.length === 1 ? rowName[0] : rowName[1]
		}`
	);

	function sortBy(column: TableColumn) {
		const ascending = sort?.key !== column.key || sort.direction === 'descending';
		chosenSort = { key: column.key, direction: ascending ? 'ascending' : 'descending' };
	}

	onMount(() => {
		interactive = true;
	});
</script>

{#if interactive && searchLabel}
	<div class="table-tools no-print">
		<div class="field">
			<label for="{identifier}-search">{searchLabel}</label>
			<input id="{identifier}-search" type="search" autocomplete="off" bind:value={query} />
		</div>
		<p class="small muted table-count" role="status">{count}</p>
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

	.table-count {
		margin: 0 0 var(--space-2);
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
