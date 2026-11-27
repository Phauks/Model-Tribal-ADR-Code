<!--
	@component
	A data table that readers can sort and search (spikes/tables/REPORT.md).

	The page is built with every row already in order, as a plain <table>, so
	it reads the same with scripts turned off. Sortable headers are buttons,
	and the title row, its count and its icons are drawn with the page, so
	nothing moves when scripts start (see below). Sorting follows the WAI-ARIA Authoring
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
	  it leaves, and a "Find a value" box when the list is long. A searchable
	  column opens the same list when its values are few enough to pick from
	  (Trevor, Nov. 27, 2026: filters should show the options), and a
	  "Contains" box for the row's name or values nearly every row has its
	  own of (filterKindFor). A column being filtered shows a filled
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

	A column of buttons (Cancel, Undo, Restore) can mark its header
	hiddenHeader, so the header is read by screen readers but not shown, and
	keepOutOfDownload, so the .csv and .xlsx files leave it out. A column of
	private details, such as the access needs people gave when they
	registered for an event, is kept out of downloads too.

	A column marked sum gets a Sum row at the bottom of the table (Trevor,
	Nov. 24, 2026: "If you have a total, just put a Sum Row at the bottom of
	the table, separate it separately"): "Total" under the row headers and the
	column's sum under it, over the rows shown. It sits in the table's footer,
	below a heavy rule, and stays at the bottom however the table is sorted.

	Every table sits in a box with a title row, the way a chart does (Trevor
	chose this on Nov. 27, 2026, from design/table-title-row/: "A. Title row
	on the table"). The row is part of the page as built, so the table no
	longer moves down when scripts run. At its left is the page's `heading`
	snippet with the table's count badge ("19", then "8 of 19" when narrowed),
	or, with no heading, the table's title from `title` or `label` with the
	same badge, so every table names itself inside its box (Trevor, Nov. 27,
	2026: "check that all tables have titles"). At its right are
	borderless icons, always in this order: Search (when searchLabel is
	given; it opens a box in the row), Columns, Copy link (when shareable),
	download (always: a list of .csv and .xlsx, TableDownload.svelte; the files
	are named `download`, or the table's identifier) and full screen (Lucide
	maximize and minimize, as on the map and the charts; Trevor, Nov. 23,
	2026: a .csv download "should always be available"). Under the row, each
	column being filtered gets a chip naming what it keeps, with an x to
	remove it, then "Show all". `tools={false}` leaves the row off, for a
	table inside something with its own, such as a chart.

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
	import { flushSync, onMount, tick, type Snippet } from 'svelte';
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
	import Search from '@lucide/svelte/icons/search';
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
		filterKindFor,
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
	import { copyPageLink, replaceAddressSearch } from '#lib/clipboard.ts';
	import { FullScreen } from '#lib/full-screen.svelte.ts';

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
		/**
		 * The table's heading, drawn at the left of its title row; it gets the table's count badge to place, such as `<h3 id="treaties-heading">Treaties {@render count()}</h3>`. Without it the title row shows `title` (or `label` without "Table: ") and the badge. A heading that names only this table belongs here, not above the box.
		 */
		heading?: Snippet<[count: Snippet]>;
		/** The table's title in its title row, when there is no `heading`; defaults to `label` without "Table: ", such as "Treaties" for "Table: treaties". */
		title?: string;
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
		columnFilters = $bindable({}),
		heading,
		title
	}: Props = $props();

	// A table drawn on the server gets its buttons once the browser has it; one made later in the browser, such as a map view's table, starts with them, so it is drawn once and does not jump (src/lib/page-started.ts).
	let interactive = $state(pageStarted());
	let chosenSort = $state<TableSort | undefined>(undefined);
	let query = $state('');
	let copyStatus = $state('');

	let frame = $state<HTMLElement | undefined>();
	const fullScreen = new FullScreen(() => frame);

	const sort = $derived(chosenSort ?? defaultSort);
	/** The columns drawn: the reader's choice, or every column not marked optional. */
	const visibleColumns = $derived(shownColumnsOf(columns, shownColumns));
	/** Each column's kind of filter, from its rows: a list to tick or a "Contains" box. */
	const filterKinds = $derived(new Map(filters ? columns.map((column) => [column.key, filterKindFor(column, rows)]) : []));
	const filterColumns = $derived(filters ? visibleColumns.filter((column) => filterKinds.get(column.key) !== undefined) : []);
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
	/** The title row is drawn with the page, so the table does not move down once scripts run (Trevor chose a title row on every table, Nov. 27, 2026). */
	const titleRow = $derived(tools || Boolean(searchLabel) || filterColumns.length > 0 || Boolean(download) || shareable);
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

	/** Fewer rows than the table has: narrowed, or only the first of them passed. */
	const partial = $derived(shownRows.length < allRows);
	/** The count in the heading's badge: "19", or "8 of 19" when narrowed. */
	const badgeText = $derived(partial ? `${shownRows.length.toLocaleString('en-US')} of ${allRows.toLocaleString('en-US')}` : allRows.toLocaleString('en-US'));
	/** The table's title, for a title row without a heading of its own: every table names itself (Trevor, Nov. 27, 2026: "check that all tables have titles"). */
	const tableTitle = $derived.by(() => {
		const text = (title ?? label.replace(/^Table:\s*/, '')).trim();
		return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
	});
	/** The count badge shows unless the page turned the count off and nothing is narrowed. */
	const badgeShown = $derived(showCount || narrowed || partial);

	/** One chip for each column being filtered, naming what it keeps. */
	const chips = $derived(
		columns.flatMap((column) => {
			const filter = columnFilters[column.key];
			if (!filterIsActive(filter)) return [];
			const parts = [...(filter?.values ?? [])];
			if (filter?.contains?.trim()) parts.push(`contains “${filter.contains.trim()}”`);
			return [{ column, text: parts.join(', ') }];
		})
	);

	/* The search: an icon in the title row that opens a box in its place. */
	let searchOpen = $state(false);
	let searchInput = $state<HTMLInputElement | undefined>();

	async function openSearch() {
		searchOpen = true;
		await tick();
		searchInput?.focus();
	}

	function closeSearch() {
		query = '';
		searchOpen = false;
	}

	function onSearchKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		// Escape closes the search box; it does not also leave full screen.
		event.stopPropagation();
		event.preventDefault();
		closeSearch();
	}

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

	function onKeydown(event: KeyboardEvent) {
		// Escape closes an open menu first (the browser does that); the next one leaves the window.
		if (!openPopover) fullScreen.leaveOnEscape(event);
	}

	async function copyLink() {
		copyStatus = await copyPageLink();
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
		replaceAddressSearch(parameters.toString());
		copyStatus = '';
	});

	onMount(() => {
		if (shareable) {
			const state = readTableState(identifier, columns, new URLSearchParams(location.search));
			query = state.query;
			chosenSort = state.sort;
			columnFilters = state.filters;
			if (state.columns) shownColumns = state.columns;
			if (query) searchOpen = true;
		}
		addressRead = true;
		interactive = true;
		const stopFollowingFullScreen = fullScreen.follow();
		// Every row is printed.
		const beforePrint = () => {
			if (drawnRows < Infinity) {
				drawnRows = Infinity;
				flushSync();
			}
		};
		window.addEventListener('beforeprint', beforePrint);
		return () => {
			stopFollowingFullScreen();
			window.removeEventListener('beforeprint', beforePrint);
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet countBadge()}<span class="count-badge"><span class="visually-hidden">, </span>{badgeText}</span>{/snippet}

<div class="data-table" class:boxed={titleRow} class:filling-window={fullScreen.fillingWindow} bind:this={frame}>

{#if titleRow}
	<div class="table-head">
		<div class="table-title">
			{#if heading}
				{@render heading(countBadge)}
			{:else}
				<p class="table-name">{tableTitle}{#if badgeShown}{' '}{@render countBadge()}{/if}</p>
			{/if}
		</div>
		{#if searchLabel && searchOpen}
			<div class="table-search no-print">
				<Search aria-hidden="true" size="1.1em" strokeWidth={1.75} />
				<label class="visually-hidden" for="{identifier}-search">{searchLabel}</label>
				<input id="{identifier}-search" type="search" autocomplete="off" placeholder={searchLabel} bind:value={query} bind:this={searchInput} onkeydown={onSearchKeydown} />
				<button type="button" class="search-close" aria-label="Close search" title="Close search" onclick={closeSearch}>
					<X aria-hidden="true" size="1.1em" strokeWidth={1.75} />
				</button>
			</div>
		{/if}
		<div class="table-icons no-print">
			{#if searchLabel && !searchOpen}
				<button type="button" class="icon-tool" aria-label={searchLabel} title={searchLabel} onclick={openSearch}>
					<Search aria-hidden="true" size="1.25em" strokeWidth={1.75} />
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
				<button type="button" class="icon-tool" aria-label={fullScreen.shown ? 'Leave full screen' : 'Full screen'} title={fullScreen.shown ? 'Leave full screen' : 'Full screen'} onclick={fullScreen.toggle}>
					{#if fullScreen.shown}<Minimize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{:else}<Maximize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{/if}
				</button>
			{/if}
		</div>
	</div>
	<p class="visually-hidden table-live-count" role="status">{interactive && (showCount || narrowed) ? count : ''}</p>
	{#if copyStatus}<p class="small table-copied" role="status">{copyStatus}</p>{/if}
	{#if interactive && chips.length > 0}
		<ul class="table-chips no-print" aria-label="Filters">
			{#each chips as chip (chip.column.key)}
				<li>
					<button type="button" class="filter-chip" aria-label="Remove the filter on {chip.column.header}: {chip.text}" onclick={() => setFilter(chip.column, undefined)}>
						{chip.column.header}:<b>{chip.text}</b><X aria-hidden="true" size="1em" strokeWidth={1.75} />
					</button>
				</li>
			{/each}
			<li>
				<button type="button" class="show-all" onclick={clearFilters}>
					<RotateCcw aria-hidden="true" size="1em" strokeWidth={1.75} />Show all
				</button>
			</li>
		</ul>
	{/if}
{/if}
{#if interactive && titleRow && leftOutRows.length > 0}
	<ul class="left-out no-print" aria-label="Left out">
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

<div class="table-scroll" role="region" aria-label={label} data-print-part="tables" {@attach keyboardScroll}>
	<table id={identifier}>
		{#if caption}<caption>{caption}</caption>{/if}
		<thead>
			<tr>
				{#each visibleColumns as column (column.key)}
					{@const filtering = filterColumns.includes(column)}
					{@const active = filterIsActive(columnFilters[column.key])}
					<th
						scope="col"
						class:number={column.type === 'number'}
						aria-sort={sort?.key === column.key ? sort.direction : undefined}
					>
						{#snippet heading()}
							{#if column.sortable}
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
							{:else if column.hiddenHeader}
								<span class="visually-hidden">{column.header}</span>
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
							{:else if value?.parts}
								{#each value.parts as part, index (index)}{#if index > 0}{'; '}{/if}{#if part.href}<a href={part.href}>{part.text}</a>{:else}{part.text}{/if}{/each}
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
					kind={filterKinds.get(column.key) ?? 'contains'}
					choices={filterKinds.get(column.key) === 'values' ? choicesFor(column) : []}
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
	/*
	 * The table is a box with a title row, as a chart is (Trevor chose this on
	 * Nov. 27, 2026, design/table-title-row/): the heading and its count at the
	 * left, the tools as borderless icons at the right, then a chip for each
	 * filter.
	 */
	.data-table.boxed {
		margin: 0 0 var(--space-6);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
	}

	.data-table.boxed .table-scroll {
		margin-bottom: 0;
	}

	.data-table.boxed > :last-child :global(table) {
		margin-bottom: 0;
	}

	.table-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-3);
		margin-bottom: var(--space-3);
	}

	/* On a narrow screen the title takes the line and the tools wrap under it, at the right. */
	.table-title {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.table-title:empty {
		flex-basis: 0;
	}

	.table-title > :global(:is(h2, h3, h4)) {
		margin: 0;
	}

	.table-icons {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}

	.table-search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 16rem;
		max-width: var(--layout-field);
		min-height: 2.5rem;
		padding: 0 var(--space-1) 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink-muted);
	}

	/* The site's focus ring (focus F1, a ring with no fill) goes round the whole box, not the input inside it. */
	.table-search:focus-within {
		outline: 3px solid var(--focus-ring, var(--color-focus-ring));
		outline-offset: 2px;
	}

	.table-search input:focus-visible {
		outline: none;
		box-shadow: none;
		background: transparent;
		color: var(--color-ink);
	}

	/* The box has its own close button, so the browser's clear button is left off. */
	.table-search input::-webkit-search-cancel-button {
		appearance: none;
	}

	.table-search input {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		outline: none;
	}

	.search-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		min-height: 2rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.search-close:hover {
		color: var(--color-ink);
	}

	.table-chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
		font-size: var(--font-size-small);
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0 var(--space-2) 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}

	.filter-chip b {
		font-weight: var(--font-weight-semibold);
	}

	.filter-chip:hover {
		border-color: var(--color-ink-muted);
	}

	.show-all {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0 var(--space-2);
		border: 0;
		background: transparent;
		color: var(--color-link);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	@media print {
		.data-table.boxed {
			padding: 0;
			border: 0;
			background: none;
		}
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

	/* A title without a heading of its own reads as one: the heading face, bold, at the size of a section heading inside a page. */
	.table-name {
		margin: 0;
		font-family: var(--font-family-heading);
		font-size: var(--font-size-heading-3);
		font-weight: var(--font-weight-bold);
		line-height: var(--font-line-height-heading);
		text-wrap: pretty;
	}

	.table-copied {
		margin: calc(-1 * var(--space-2)) 0 var(--space-3);
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

	/* The title row's icons: borderless, at the right, as on the charts. */
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
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		list-style: none;
		margin: 0 0 var(--space-3);
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
