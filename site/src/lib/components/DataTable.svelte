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
	  with how many rows each leaves. With addFilter, no menu shows until the
	  reader picks its column from "Add filter", and each added menu has a
	  button to take it away (Trevor, Nov. 23, 2026: "don't state the
	  filters, just have an add filter button").
	- download: names the downloaded files <download>.csv and .xlsx.
	- shareable: the search, sort and filters go into the page address as the
	  reader changes them, and "Copy link" copies it, so the link opens the
	  table the same way.
	The tools appear only once scripts run; without them the full table shows.

	Every table also has one control row (Trevor, Nov. 23, 2026: a .csv
	download "should always be available", any table can go full screen, and
	a reader can leave rows out "to see how things would change without
	it"): borderless icons at the right of the count for Copy link (when
	shareable), download (always: a list of .csv and .xlsx, TableDownload.svelte;
	the files are named `download`, or the table's identifier) and full screen (Lucide maximize and minimize, as on the map
	and the charts). `tools={false}` leaves the row off, for a table inside
	something with its own, such as a chart.

	Leaving rows out is for charts only (Trevor chose this on Nov. 23, 2026,
	after it showed on every table): `leaveOut` gives each row a button to
	leave it out, and a chart's own table turns it on and binds `leftOut`, so
	the rows left out are the same in every view of the chart. Left-out rows
	are listed to bring back one by one, then "Bring back all".

	Use:
	<DataTable identifier="nations" label="Table: nations" {columns} {rows}
		defaultSort={{ key: 'name', direction: 'ascending' }} searchLabel="Search nations" />
-->
<script lang="ts">
	import { flushSync, onMount, type Snippet } from 'svelte';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Link from '@lucide/svelte/icons/link';
	import ListFilterPlus from '@lucide/svelte/icons/list-filter-plus';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';
	import TableDownload from '#lib/components/TableDownload.svelte';
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import { pageStarted } from '#lib/page-started.ts';
	import {
		applyColumnFilters,
		filterChoices,
		filterRows,
		readTableState,
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
		/** Shows the filter menus only once the reader adds them with an "Add filter" button. */
		addFilter?: boolean;
		/** Names the downloaded files: this, plus .csv or .xlsx. */
		download?: string;
		/** Keeps the search, sort and filters in the page address and shows "Copy link". */
		shareable?: boolean;
		/** False leaves out "Showing N of N rows" until a filter or search narrows the table, as beside the map, where the count is clutter (Trevor, 2026-11-23). */
		count?: boolean;
		/** False leaves off the control row (.csv, full screen, leaving rows out), for a table inside something that has its own. */
		tools?: boolean;
		/** The rows left out, by key; bind it to share one list with something around the table, such as a chart's other views. */
		leftOut?: string[];
		/** Gives each row a button to leave it out; only a chart's own table turns it on (Trevor, Nov. 23, 2026: leaving data out stays on charts only). */
		leaveOut?: boolean;
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
		addFilter = false,
		download,
		shareable = false,
		count: showCount = true,
		tools = true,
		leftOut = $bindable([]),
		leaveOut = false
	}: Props = $props();

	// A table drawn on the server gets its buttons once the browser has it; one made later in the browser, such as a map view's table, starts with them, so it is drawn once and does not jump (src/lib/page-started.ts).
	let interactive = $state(pageStarted());
	let chosenSort = $state<TableSort | undefined>(undefined);
	let query = $state('');
	let columnFilters = $state<ColumnFilters>({});
	let copyStatus = $state('');

	let frame = $state<HTMLElement | undefined>();
	let fullScreen = $state(false);
	let fillingWindow = $state(false);

	const sort = $derived(chosenSort ?? defaultSort);
	const filterColumns = $derived(filters ? columns.filter((column) => column.filterable) : []);
	/** The filters the reader added, in the order added; a filter set from the page address counts as added. */
	let addedFilters = $state<string[]>([]);
	let addMenuOpen = $state(false);
	let addMenu = $state<HTMLElement | undefined>();
	const shownFilterColumns = $derived(
		addFilter
			? addedFilters
					.map((key) => filterColumns.find((column) => column.key === key))
					.filter((column): column is TableColumn => column !== undefined)
			: filterColumns
	);
	const addableColumns = $derived(filterColumns.filter((column) => !addedFilters.includes(column.key)));
	const shownRows = $derived.by(() => {
		const found = applyColumnFilters(filterRows(columns, rows, query), columnFilters).filter((row) => !leftOut.includes(row.key));
		return sort ? sortRows(columns, found, sort) : found;
	});
	/**
	 * A long table made in the browser, such as a map view's table fetched when the view is chosen, shows its first rows at once and adds the rest a batch at a time while the browser is otherwise idle. Laying out hundreds of rows at once froze the map page for most of a second (about 1 ms a row); in batches the page keeps answering, and the reader sees the table at once. A table drawn on the server has every row from the start, as do printing and an address that names a row.
	 */
	const firstBatch = 60;
	const laterBatch = 120;
	let drawnRows = $state(pageStarted() ? firstBatch : Infinity);
	const visibleRows = $derived(drawnRows >= shownRows.length ? shownRows : shownRows.slice(0, drawnRows));
	$effect(() => {
		if (drawnRows >= shownRows.length) return;
		if (location.hash && rows.some((row) => row.anchor === decodeURIComponent(location.hash.slice(1)))) {
			drawnRows = Infinity;
			return;
		}
		const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 16));
		const cancel = window.cancelIdleCallback ?? window.clearTimeout;
		const handle = idle(() => (drawnRows += laterBatch), { timeout: 250 });
		return () => cancel(handle);
	});
	const leftOutRows = $derived(rows.filter((row) => leftOut.includes(row.key)));
	const narrowed = $derived(query.trim() !== '' || Object.values(columnFilters).some(Boolean) || leftOut.length > 0);
	const hasTools = $derived(tools || Boolean(searchLabel) || filterColumns.length > 0 || Boolean(download) || shareable);
	const rowHeader = $derived(columns.find((column) => column.isRowHeader) ?? columns[0]);
	/** A row's name, for its leave-out button and its chip: its row header's text. */
	const rowLabel = (row: TableRow) => row.cells[rowHeader?.key ?? '']?.text || row.key;
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
		addedFilters = [];
		leftOut = [];
	}

	function addFilterFor(column: TableColumn) {
		addedFilters = [...addedFilters, column.key];
		addMenuOpen = false;
		// The new menu takes the focus, so the reader can pick a value at once.
		queueMicrotask(() => document.getElementById(`${identifier}-filter-${column.key}`)?.focus());
	}

	function removeFilter(column: TableColumn) {
		addedFilters = addedFilters.filter((key) => key !== column.key);
		const { [column.key]: _removed, ...rest } = columnFilters;
		columnFilters = rest;
	}

	function onWindowClick(event: MouseEvent) {
		if (addMenuOpen && addMenu && !addMenu.contains(event.target as Node)) addMenuOpen = false;
	}

	/** The table filling the screen, with the browser's full screen, or filling the window where the browser has none (as on an iPhone) or refuses. */
	async function toggleFullScreen() {
		if (fullScreen || fillingWindow) {
			if (document.fullscreenElement) await document.exitFullscreen();
			fillingWindow = false;
			return;
		}
		if (frame?.requestFullscreen) {
			try {
				await frame.requestFullscreen();
				return;
			} catch {
				// Refused: fill the window instead.
			}
		}
		fillingWindow = true;
	}

	function onKeydown(event: KeyboardEvent) {
		if (addMenuOpen && event.key === 'Escape') {
			addMenuOpen = false;
			return;
		}
		if (fillingWindow && event.key === 'Escape') fillingWindow = false;
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
			addedFilters = filterColumns.filter((column) => state.filters[column.key]).map((column) => column.key);
		}
		interactive = true;
		const onChange = () => {
			fullScreen = document.fullscreenElement === frame;
		};
		document.addEventListener('fullscreenchange', onChange);
		// Every row is printed.
		const beforePrint = () => {
			if (drawnRows < Infinity) {
				drawnRows = Infinity;
				flushSync();
			}
		};
		window.addEventListener('beforeprint', beforePrint);
		return () => {
			document.removeEventListener('fullscreenchange', onChange);
			window.removeEventListener('beforeprint', beforePrint);
		};
	});
</script>

<svelte:window onkeydown={onKeydown} onclick={onWindowClick} />

<div class="data-table" class:filling-window={fillingWindow} bind:this={frame}>

{#if interactive && hasTools}
	{#if searchLabel || filterColumns.length > 0}
	<div class="table-tools no-print">
		{#if searchLabel}
			<div class="field">
				<label for="{identifier}-search">{searchLabel}</label>
				<input id="{identifier}-search" type="search" autocomplete="off" bind:value={query} />
			</div>
		{/if}
		{#each shownFilterColumns as column (column.key)}
			<div class="field filter-field">
				{#if addFilter}
					<div class="filter-label">
						<label for="{identifier}-filter-{column.key}">{column.header}</label>
						<button type="button" class="icon-tool remove-filter" aria-label="Remove the {column.header} filter" title="Remove filter" onclick={() => removeFilter(column)}>
							<X aria-hidden="true" size="1.1em" strokeWidth={1.75} />
						</button>
					</div>
				{:else}
					<label for="{identifier}-filter-{column.key}">{column.header}</label>
				{/if}
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
		{#if addFilter && addableColumns.length > 0}
			<div class="add-filter" bind:this={addMenu}>
				<button
					type="button"
					class="button button-quiet small-button"
					aria-expanded={addMenuOpen}
					aria-controls="{identifier}-add-filter"
					onclick={() => (addMenuOpen = !addMenuOpen)}
				>
					<ListFilterPlus aria-hidden="true" size="1.1em" strokeWidth={1.75} />Add filter
				</button>
				{#if addMenuOpen}
					<ul id="{identifier}-add-filter" class="add-filter-menu" aria-label="Filter by">
						{#each addableColumns as column (column.key)}
							<li><button type="button" onclick={() => addFilterFor(column)}>{column.header}</button></li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
	{/if}
	<div class="table-status no-print">
		<p class="small muted table-count" role="status">{showCount || narrowed ? count : ''}</p>
		{#if narrowed && (filterColumns.length > 0 || searchLabel || leftOut.length > 0)}
			<button type="button" class="button button-quiet small-button" onclick={clearFilters}>
				<RotateCcw aria-hidden="true" size="1.1em" strokeWidth={1.75} />Show all
			</button>
		{/if}
		{#if shareable}
			<button type="button" class="icon-tool" aria-label="Copy link" title="Copy a link to the table as it is now" onclick={copyLink}>
				<Link aria-hidden="true" size="1.25em" strokeWidth={1.75} />
			</button>
		{/if}
		{#if tools || download}
			<TableDownload name={download ?? identifier} title={caption ?? download ?? identifier} table={() => ({ columns, rows: shownRows })} />
		{/if}
		{#if tools}
			<button type="button" class="icon-tool" aria-label={fullScreen || fillingWindow ? 'Leave full screen' : 'Full screen'} title={fullScreen || fillingWindow ? 'Leave full screen' : 'Full screen'} onclick={toggleFullScreen}>
				{#if fullScreen || fillingWindow}<Minimize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{:else}<Maximize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{/if}
			</button>
		{/if}
		{#if copyStatus}<p class="small table-copied" role="status">{copyStatus}</p>{/if}
		{#if leftOutRows.length > 0}
			<ul class="left-out" aria-label="Left out">
				{#each leftOutRows as row (row.key)}
					<li>
						<button type="button" class="chip-button" aria-label="Bring back {rowLabel(row)}" onclick={() => (leftOut = leftOut.filter((key) => key !== row.key))}>
							{rowLabel(row)}<X aria-hidden="true" size="1em" />
						</button>
					</li>
				{/each}
				<li>
					<button type="button" class="button button-quiet small-button" onclick={() => (leftOut = [])}>
						<RotateCcw aria-hidden="true" size="1.1em" strokeWidth={1.75} />Bring back all
					</button>
				</li>
			</ul>
		{/if}
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
			{#each visibleRows as row (row.key)}
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
						{#if column.isRowHeader || (column === columns[0] && !columns.some((other) => other.isRowHeader))}
							{@const Cell = column.isRowHeader ? 'th' : 'td'}
							<svelte:element this={Cell} scope={column.isRowHeader ? 'row' : undefined} class:number={column.type === 'number'}>
								{#if interactive && leaveOut}
									<span class="row-head">
										<span class="row-head-content">{@render content()}</span>
										<button type="button" class="leave-out no-print" aria-label="Leave out {rowLabel(row)}" title="Leave out this row" onclick={() => (leftOut = [...leftOut, row.key])}>
											<EyeOff aria-hidden="true" size="1em" strokeWidth={1.75} />
										</button>
									</span>
								{:else}
									{@render content()}
								{/if}
							</svelte:element>
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
</div>

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
		max-width: var(--layout-field);
		margin: 0;
	}

	.table-tools .filter-field {
		flex: 0 1 14rem;
	}

	.filter-field select {
		width: 100%;
	}

	/* An added filter's name, with the button that takes it away at its right. */
	.filter-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-1);
	}

	.filter-label label {
		font-weight: var(--font-weight-semibold);
	}

	.remove-filter {
		min-width: 2rem;
		min-height: 2rem;
		margin: calc(-1 * var(--space-1)) 0;
	}

	.add-filter {
		position: relative;
	}

	.add-filter-menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + var(--space-1));
		left: 0;
		min-width: 12rem;
		margin: 0;
		padding: var(--space-1) 0;
		list-style: none;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
	}

	.add-filter-menu button {
		display: block;
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.add-filter-menu button:hover,
	.add-filter-menu button:focus-visible {
		background: var(--color-surface);
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

	/* The control row's icons: borderless, at the right of the count, as on the charts. */
	.icon-tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-1);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		font: inherit;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.icon-tool:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	.left-out {
		flex-basis: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.chip-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	/* Each row's leave-out button sits at the end of its first cell, faint until the row is pointed at. */
	.row-head {
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
	}

	.row-head-content {
		flex: 1 1 auto;
		min-width: 0;
	}

	.leave-out {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 0;
		border-radius: var(--radius-control);
		padding: 0;
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
		opacity: 0.4;
	}

	tr:hover .leave-out,
	.leave-out:focus-visible {
		opacity: 1;
	}

	.leave-out:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	/*
	 * Full screen: the table fills the screen under its controls and scrolls
	 * inside its own box, both ways, so its end stays at the edge of the screen
	 * and the sideways scroll bar is always in view (Trevor, Nov. 24, 2026:
	 * "it should always keep the end of the table locked, so you cannot go over
	 * the side"). The frame itself never scrolls sideways; it scrolls down only
	 * when the controls are taller than the screen. The header row stays at the
	 * top as the rows scroll under it.
	 */
	.data-table:fullscreen,
	.data-table.filling-window {
		display: flex;
		flex-direction: column;
		overflow: hidden auto;
		padding: var(--space-6);
		background: var(--color-paper);
	}

	.data-table:fullscreen > *,
	.data-table.filling-window > * {
		flex: none;
	}

	.data-table:fullscreen > .table-scroll,
	.data-table.filling-window > .table-scroll {
		flex: 1 1 auto;
		min-height: 12rem;
		overflow: auto;
		margin-bottom: 0;
	}

	.data-table:fullscreen thead th,
	.data-table.filling-window thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		box-shadow: inset 0 -1px 0 var(--color-line);
	}

	.data-table.filling-window {
		position: fixed;
		inset: 0;
		z-index: 1000;
	}

	/* The table and its controls end at the edge of the column, however wide the table is. */
	.data-table {
		min-width: 0;
		max-width: 100%;
	}

	.table-empty {
		margin-top: calc(-1 * var(--space-3));
	}
</style>
