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
	- filters: a funnel at the right of each column header that can filter,
	  as in a spreadsheet (Trevor, Nov. 24, 2026: "filters should be on the
	  top of the columns of tables, not in a separate area"). A column marked
	  filterable opens a list of its values to tick, each with how many rows
	  it leaves, and a "Find a value" box when the list is long; a searchable
	  column opens a "Contains" box. A column being filtered shows a filled
	  funnel. The menus are popovers (HTML popover attribute), so they sit
	  above the table's scrolling box instead of being cut off by it.
	- download: names the downloaded files <download>.csv and .xlsx.
	- shareable: the search, sort, filters and columns shown go into the page
	  address as the reader changes them, and "Copy link" copies it, so the
	  link opens the table the same way.
	The tools appear only once scripts run; without them the full table shows.

	Readers can hide columns and add the ones marked optional (Trevor, Nov. 24,
	2026: "add ability to hide or add columns to tables"), from the columns
	icon in the control row. The row header always stays. A page can bind
	`shownColumns` (column keys) to set which columns start shown and to hear
	when the reader changes them; undefined means the default.

	A column marked sum gets a Sum row at the bottom of the table (Trevor,
	Nov. 24, 2026: "If you have a total, just put a Sum Row at the bottom of
	the table, separate it separately"): "Total" under the row headers and the
	column's sum under it, over the rows shown. It sits in the table's footer,
	below a heavy rule, and stays at the bottom however the table is sorted.

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
	import Columns3Cog from '@lucide/svelte/icons/columns-3-cog';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Funnel from '@lucide/svelte/icons/funnel';
	import Link from '@lucide/svelte/icons/link';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';
	import ColumnFilterMenu from '#lib/components/ColumnFilterMenu.svelte';
	import TableDownload from '#lib/components/TableDownload.svelte';
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import { pageStarted } from '#lib/page-started.ts';
	import { keepPlaced, type PopoverEdge } from '#lib/popover-place.ts';
	import {
		applyColumnFilters,
		columnTotal,
		defaultColumnKeys,
		filterChoices,
		filterIsActive,
		filterKind,
		filterRows,
		readTableState,
		shownColumnsOf,
		sortRows,
		writeTableState,
		type ColumnFilter,
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
		/** Puts a filter on the header of each column marked filterable or searchable. */
		filters?: boolean;
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
		/** How many rows there are in all, when the page passes only the first of them (with its own "Show all"), so the count reads "Showing 50 of 52". */
		total?: number;
		/** The keys of the columns shown; undefined shows every column not marked optional. Bind it to set or follow the reader's choice. */
		shownColumns?: string[];
		/** Each column's filter. A page can bind it to set the filters and to hear when the reader changes them, as Build a table does to carry them into a grouped table. */
		columnFilters?: ColumnFilters;
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
		count: showCount = true,
		tools = true,
		leftOut = $bindable([]),
		leaveOut = false,
		total,
		shownColumns = $bindable(undefined),
		columnFilters = $bindable({})
	}: Props = $props();

	// A table drawn on the server gets its buttons once the browser has it; one made later in the browser, such as a map view's table, starts with them, so it is drawn once and does not jump (src/lib/page-started.ts).
	let interactive = $state(pageStarted());
	let chosenSort = $state<TableSort | undefined>(undefined);
	let query = $state('');
	let copyStatus = $state('');

	let frame = $state<HTMLElement | undefined>();
	let fullScreen = $state(false);
	let fillingWindow = $state(false);

	const sort = $derived(chosenSort ?? defaultSort);
	/** The columns drawn: the reader's choice, or every column not marked optional. */
	const visibleColumns = $derived(shownColumnsOf(columns, shownColumns));
	const filterColumns = $derived(filters ? visibleColumns.filter((column) => filterKind(column) !== undefined) : []);
	const sumColumns = $derived(visibleColumns.filter((column) => column.sum));
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
	const narrowed = $derived(query.trim() !== '' || Object.values(columnFilters).some(filterIsActive) || leftOut.length > 0);
	const hasTools = $derived(tools || Boolean(searchLabel) || filterColumns.length > 0 || Boolean(download) || shareable);
	const rowHeader = $derived(columns.find((column) => column.isRowHeader) ?? columns[0]);
	const firstVisible = $derived(visibleColumns[0]);
	/** A row's name, for its leave-out button and its chip: its row header's text. */
	const rowLabel = (row: TableRow) => row.cells[rowHeader?.key ?? '']?.text || row.key;
	const allRows = $derived(Math.max(total ?? 0, rows.length));
	const count = $derived(
		`Showing ${shownRows.length.toLocaleString('en-US')} of ${allRows.toLocaleString('en-US')} ${
			allRows === 1 ? rowName[0] : rowName[1]
		}`
	);

	function sortBy(column: TableColumn) {
		const ascending = sort?.key !== column.key || sort.direction === 'descending';
		chosenSort = { key: column.key, direction: ascending ? 'ascending' : 'descending' };
	}

	/** The choices a column's menu offers, counted among the rows the other filters and the search leave, with any value ticked that no row has left. */
	function choicesFor(column: TableColumn) {
		const others = Object.fromEntries(Object.entries(columnFilters).filter(([key]) => key !== column.key));
		const choices = filterChoices(column, applyColumnFilters(filterRows(columns, rows, query), others).filter((row) => !leftOut.includes(row.key)));
		const missing = (columnFilters[column.key]?.values ?? []).filter((value) => !choices.some((choice) => choice.value === value));
		return [...choices, ...missing.map((value) => ({ value, count: 0 }))];
	}

	function setFilter(column: TableColumn, filter: ColumnFilter | undefined) {
		const { [column.key]: _old, ...rest } = columnFilters;
		columnFilters = filter && filterIsActive(filter) ? { ...rest, [column.key]: filter } : rest;
	}

	function clearFilters() {
		query = '';
		columnFilters = {};
		leftOut = [];
	}

	/** Shows or hides a column; a column hidden stops filtering, so no filter is left out of sight. */
	function showColumn(column: TableColumn, shown: boolean) {
		const now = visibleColumns.map((other) => other.key);
		const next = columns.filter((other) => (other === column ? shown : now.includes(other.key))).map((other) => other.key);
		shownColumns = next;
		if (!shown) setFilter(column, undefined);
	}

	function resetColumns() {
		const defaults = defaultColumnKeys(columns);
		for (const column of columns) if (!defaults.includes(column.key) && column !== rowHeader) setFilter(column, undefined);
		shownColumns = undefined;
	}

	/* The filter menus and the list of columns, as popovers placed under the button that opens them. */

	/** The popover open now, the button that opened it, and which edge they line up on. */
	let openPopover = $state.raw<{ key: string; popover: HTMLElement; anchor: HTMLElement; edge: PopoverEdge } | undefined>();

	function onPopoverToggle(event: Event, key: string, edge: PopoverEdge) {
		const popover = event.currentTarget as HTMLElement;
		if ((event as ToggleEvent).newState === 'open') {
			const anchor = document.querySelector<HTMLElement>(`[popovertarget="${popover.id}"]`);
			if (!anchor) return;
			openPopover = { key, popover, anchor, edge };
		} else if (openPopover?.popover === popover) {
			openPopover = undefined;
		}
	}

	// Placed under its button once its content is drawn, and again as the page or the table scrolls under it; the rows and the control row above them change as the reader ticks values, which moves the button.
	$effect(() => {
		if (!openPopover) return;
		const { popover, anchor, edge } = openPopover;
		return keepPlaced(popover, anchor, edge, frame ? [frame, document.body] : [document.body]);
	});

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
		// Escape closes an open menu first (the browser does that); the next one leaves the window.
		if (fillingWindow && event.key === 'Escape' && !openPopover) fillingWindow = false;
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
	// It waits until the table has read the address once (onMount), or a table
	// reached by a link within the site, which starts interactive, would wipe
	// the filters in the link before reading them.
	let addressRead = $state(false);
	$effect(() => {
		if (!interactive || !shareable || !addressRead) return;
		const changedColumns = shownColumns && shownColumns.join(',') !== defaultColumnKeys(columns).join(',') ? shownColumns : undefined;
		const parameters = writeTableState(
			identifier,
			{ query, sort: chosenSort, filters: columnFilters, columns: changedColumns },
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
			if (state.columns) shownColumns = state.columns;
		}
		addressRead = true;
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

<svelte:window onkeydown={onKeydown} />

<div class="data-table" class:filling-window={fillingWindow} bind:this={frame}>

{#if interactive && hasTools}
	{#if searchLabel}
	<div class="table-tools no-print">
		<div class="field">
			<label for="{identifier}-search">{searchLabel}</label>
			<input id="{identifier}-search" type="search" autocomplete="off" bind:value={query} />
		</div>
	</div>
	{/if}
	<div class="table-status no-print">
		<p class="small muted table-count" role="status">{showCount || narrowed ? count : ''}</p>
		{#if narrowed}
			<button type="button" class="button button-quiet small-button" onclick={clearFilters}>
				<RotateCcw aria-hidden="true" size="1.1em" strokeWidth={1.75} />Show all
			</button>
		{/if}
		{#if tools && columns.length > 1}
			<button
				type="button"
				class="icon-tool"
				class:open={openPopover?.key === '#columns'}
				aria-label="Columns"
				title="Show or hide columns"
				aria-expanded={openPopover?.key === '#columns'}
				popovertarget="{identifier}-columns"
			>
				<Columns3Cog aria-hidden="true" size="1.25em" strokeWidth={1.75} />
			</button>
		{/if}
		{#if shareable}
			<button type="button" class="icon-tool" aria-label="Copy link" title="Copy a link to the table as it is now" onclick={copyLink}>
				<Link aria-hidden="true" size="1.25em" strokeWidth={1.75} />
			</button>
		{/if}
		{#if tools || download}
			<TableDownload name={download ?? identifier} title={caption ?? download ?? identifier} table={() => ({ columns: visibleColumns, rows: shownRows })} />
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
				{#each visibleColumns as column (column.key)}
					{@const filtering = interactive && filterColumns.includes(column)}
					{@const active = filterIsActive(columnFilters[column.key])}
					<th
						scope="col"
						class:number={column.type === 'number'}
						aria-sort={sort?.key === column.key ? sort.direction : undefined}
					>
						{#snippet heading()}
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
						{/snippet}
						{#if filtering}
							<span class="header-cell">
								{@render heading()}
								<button
									type="button"
									class="filter-button no-print"
									class:active
									class:open={openPopover?.key === column.key}
									aria-label={active ? `Filter ${column.header}, filtered` : `Filter ${column.header}`}
									title="Filter {column.header}"
									aria-expanded={openPopover?.key === column.key}
									popovertarget="{identifier}-filter-{column.key}"
								>
									<Funnel aria-hidden="true" size="1em" strokeWidth={1.75} fill={active ? 'currentColor' : 'none'} />
								</button>
							</span>
						{:else}
							{@render heading()}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each visibleRows as row (row.key)}
				<tr id={row.anchor}>
					{#each visibleColumns as column (column.key)}
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
						{#if column.isRowHeader || (column === firstVisible && !columns.some((other) => other.isRowHeader))}
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
		{#if sumColumns.length > 0}
			<tfoot class="sum-row">
				<tr>
					{#each visibleColumns as column (column.key)}
						{#if column.sum}
							<td class="number">{columnTotal(column, shownRows).toLocaleString('en-US')}</td>
						{:else if column === firstVisible}
							<th scope="row">Total</th>
						{:else}
							<td></td>
						{/if}
					{/each}
				</tr>
			</tfoot>
		{/if}
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

{#if interactive}
	{#each filterColumns as column (column.key)}
		<div
			id="{identifier}-filter-{column.key}"
			class="table-popover no-print"
			popover="auto"
			role="dialog"
			aria-label="Filter {column.header}"
			ontoggle={(event) => onPopoverToggle(event, column.key, 'left')}
		>
			{#if openPopover?.key === column.key}
				<ColumnFilterMenu
					identifier="{identifier}-{column.key}"
					title={column.header}
					kind={filterKind(column) ?? 'contains'}
					choices={filterKind(column) === 'values' ? choicesFor(column) : []}
					filter={columnFilters[column.key]}
					onchange={(filter) => setFilter(column, filter)}
				/>
			{/if}
		</div>
	{/each}
	{#if tools && columns.length > 1}
		<div
			id="{identifier}-columns"
			class="table-popover no-print"
			popover="auto"
			role="dialog"
			aria-label="Columns"
			ontoggle={(event) => onPopoverToggle(event, '#columns', 'right')}
		>
			{#if openPopover?.key === '#columns'}
				<p class="popover-title">Columns</p>
				<ul class="popover-list popover-list-full">
					{#each columns as column (column.key)}
						<li class:locked={column === rowHeader}>
							<label>
								<input
									type="checkbox"
									checked={visibleColumns.includes(column)}
									disabled={column === rowHeader}
									onchange={(event) => showColumn(column, event.currentTarget.checked)}
								/>
								{column.header}
							</label>
						</li>
					{/each}
				</ul>
				<div class="popover-foot">
					<button type="button" class="popover-button" onclick={resetColumns}>Reset columns</button>
				</div>
			{/if}
		</div>
	{/if}
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

	/* A header with a filter: its name and sort arrows, then the funnel at the right. */
	.header-cell {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1);
	}

	th.number .header-cell {
		justify-content: flex-end;
	}

	.filter-button {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-1)) calc(-1 * var(--space-2)) 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.filter-button:hover {
		color: var(--color-ink);
	}

	/* A column being filtered: a filled funnel in the link color. */
	.filter-button.active {
		color: var(--color-link);
	}

	.filter-button.open,
	.icon-tool.open {
		color: var(--color-ink);
		background: var(--color-surface-raised);
		box-shadow: inset 0 0 0 1px var(--color-control-border);
	}

	/* The Sum row: below a heavy rule, in bold, and outside the sorted rows. */
	.sum-row :is(th, td) {
		border-top: 2px solid var(--color-ink);
		border-bottom: 0;
		background: var(--color-surface);
		font-weight: var(--font-weight-bold);
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
