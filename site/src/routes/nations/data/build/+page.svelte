<!--
	Build a table (Trevor, Nov. 24, 2026: "build functionality so people can
	build their own tables too"). The reader picks a dataset, its columns and
	filters, and may group it by one column, or by two for a table with a
	column per value of the second, and count or sum each group. The result
	shows in the shared DataTable, or the shared BarChart when grouped by one
	column, with their downloads and full screen. The settings live in the
	page address, so "Copy link" shares the table as built. The work is done
	in src/lib/table-builder.ts.

	Filters and columns work as on every other table (Trevor, Nov. 24, 2026:
	readers and the team get one flow): the ungrouped table is the shared
	DataTable, with a funnel on each column header and its own list of columns,
	and the builder keeps what the reader sets there. A grouped result has no
	header for most of the data's columns, so its one funnel, beside Group by,
	opens the same filter menus column by column. A grouped table's totals are
	the shared table's Sum row.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import Funnel from '@lucide/svelte/icons/funnel';
	import Link from '@lucide/svelte/icons/link';
	import BarChart from '#lib/components/BarChart.svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import ColumnFilterMenu from '#lib/components/ColumnFilterMenu.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { keepPlaced } from '#lib/popover-place.ts';
	import { filterIsActive, type ColumnFilter, type ColumnFilters } from '#lib/tables/table-definition.ts';
	import {
		builderDatasetPath,
		builderFilterKind,
		builderPath,
		chosenColumns,
		crossTable,
		filterOptions,
		groupedChart,
		measureHeader,
		recordTable,
		resultTitle,
		settingsFromAddress,
		settingsToAddress,
		startingSettings,
		type BuilderDataset,
		type BuilderMeasure,
		type BuilderSettings
	} from '#lib/table-builder.ts';
	import type { PageProps } from './$types';
	import { copyText } from '#lib/clipboard.ts';

	let { data }: PageProps = $props();

	let loaded = $state<Record<string, BuilderDataset>>({});
	let settings = $state<BuilderSettings | undefined>();
	let loadFailed = $state(false);
	/** The grouped result's filter menu: open or not, and the column whose menu it shows, if any. */
	let filtersOpen = $state(false);
	let filterColumn = $state<string | undefined>();
	let filtersButton = $state<HTMLElement | undefined>();
	let filtersPopover = $state<HTMLElement | undefined>();
	let copyStatus = $state('');
	let essaysOpen = $state(false);
	/** The essays the signed-in person can edit, for "Add to essay"; empty for everyone else (src/routes/workspace/essays/editable.json). */
	let editableEssays = $state<{ identifier: string; title: string; editLink: string }[]>([]);

	const dataset = $derived(settings ? loaded[settings.dataset] : undefined);
	const groupable = $derived(dataset?.columns.filter((column) => column.type !== 'number') ?? []);
	const datasetChoices = $derived(
		data.datasets.map((summary) => ({ value: summary.identifier, label: `${summary.title} (${summary.rowCount.toLocaleString('en-US')})` }))
	);
	const groupChoices = $derived([{ value: '', label: 'None' }, ...groupable.map((column) => ({ value: column.key, label: column.header }))]);
	const acrossChoices = $derived([
		{ value: '', label: 'None' },
		...groupable.filter((column) => column.key !== settings?.groupBy).map((column) => ({ value: column.key, label: column.header }))
	]);
	const numberColumns = $derived(dataset?.columns.filter((column) => column.type === 'number') ?? []);
	const filtering = $derived(settings ? Object.values(settings.filters).some(filterIsActive) : false);

	const measures = $derived.by((): { value: string; label: string; measure: BuilderMeasure }[] => {
		if (!dataset) return [];
		return [
			{ value: 'rows', label: measureHeader(dataset, { kind: 'rows' }), measure: { kind: 'rows' } },
			...(dataset.nationColumn ? [{ value: 'nations', label: 'Nations', measure: { kind: 'nations' } as BuilderMeasure }] : []),
			...numberColumns.flatMap((column) => (['sum', 'average'] as const).map((kind) => ({ value: `${kind}.${column.key}`, label: measureHeader(dataset, { kind, column: column.key }), measure: { kind, column: column.key } as BuilderMeasure })))
		];
	});
	const measureValue = $derived(settings ? (settings.measure.kind === 'sum' || settings.measure.kind === 'average' ? `${settings.measure.kind}.${settings.measure.column}` : settings.measure.kind) : 'rows');

	// Every column and row of the dataset; the table shows the columns chosen and filters the rows itself. Built once per dataset, so ticking a filter doesn't redraw it.
	const records = $derived(dataset ? recordTable(dataset, startingSettings(dataset), true) : undefined);
	/** The columns the table shows: those chosen, and any being filtered, so no filter is out of sight. */
	const shownKeys = $derived(settings ? [...new Set([...settings.columns, ...Object.keys(settings.filters)])] : []);
	const chart = $derived(dataset && settings ? groupedChart(dataset, settings) : undefined);
	const cross = $derived(dataset && settings ? crossTable(dataset, settings) : undefined);
	const title = $derived(dataset && settings ? resultTitle(dataset, settings) : '');
	// Redraws the result when its columns change, so its sort and widths start fresh. The ungrouped table keeps its columns, which the reader shows and hides in it.
	const resultKey = $derived(settings ? (settings.groupBy ? JSON.stringify({ ...settings, columns: [] }) : settings.dataset) : '');

	async function open(identifier: string, parameters?: URLSearchParams): Promise<void> {
		if (!loaded[identifier]) {
			const response = await fetch(builderDatasetPath(identifier));
			if (!response.ok) throw new Error(String(response.status));
			loaded = { ...loaded, [identifier]: (await response.json()) as BuilderDataset };
		}
		const chosen = loaded[identifier];
		settings = parameters ? settingsFromAddress(parameters, chosen) : startingSettings(chosen);
	}

	function update(change: Partial<BuilderSettings>): void {
		if (!settings) return;
		settings = { ...settings, ...change };
		if (!settings.groupBy) settings = { ...settings, across: undefined, measure: { kind: 'rows' } };
		copyStatus = '';
	}

	function setFilter(key: string, filter: ColumnFilter | undefined): void {
		if (!settings) return;
		const { [key]: _old, ...rest } = settings.filters;
		update({ filters: filter && filterIsActive(filter) ? { ...rest, [key]: filter } : rest });
	}

	/** What a column's filter is set to, for the grouped result's list of filters. */
	function filterSummary(filter: ColumnFilter | undefined): string {
		if (!filter || !filterIsActive(filter)) return 'All';
		return [...(filter.values ?? []), ...(filter.contains ? [`contains “${filter.contains}”`] : [])].join(', ');
	}

	function onFiltersToggle(event: ToggleEvent): void {
		filtersOpen = event.newState === 'open';
		filterColumn = undefined;
	}

	// The grouped result's filter menu stays under its funnel as the page scrolls and the result changes size.
	$effect(() => {
		if (!filtersOpen || !filtersPopover || !filtersButton) return;
		void filterColumn;
		return keepPlaced(filtersPopover, filtersButton, 'left', [document.body]);
	});

	async function copyLink(): Promise<void> {
		try {
			await copyText(location.href);
			copyStatus = 'Link copied';
		} catch {
			copyStatus = 'Copy the address from the address bar';
		}
	}

	function onWindowClick(event: MouseEvent): void {
		const target = event.target as Element | null;
		if (!target?.closest('.essay-menu')) essaysOpen = false;
	}

	$effect(() => {
		if (!settings || !dataset) return;
		const next = `${builderPath}?${settingsToAddress(settings, dataset)}`;
		if (next !== `${location.pathname}${location.search}`) history.replaceState(history.state, '', next);
	});

	onMount(() => {
		const parameters = new URLSearchParams(location.search);
		const requested = parameters.get('data') ?? '';
		const identifier = data.datasets.some((summary) => summary.identifier === requested) ? requested : data.datasets[0].identifier;
		open(identifier, parameters).catch(() => (loadFailed = true));
		// The team makes essay charts here too (Trevor, Nov. 24, 2026: "it should be the same flow"); the list is empty unless someone who can edit an essay is signed in.
		fetch('/workspace/essays/editable.json')
			.then((response) => (response.ok ? response.json() : { essays: [] }))
			.then((body: { essays?: { identifier: string; title: string; editLink: string }[] }) => (editableEssays = body.essays ?? []))
			.catch(() => (editableEssays = []));
	});

	/** Where "Add to essay" takes the editor: the essay in Editing, which places this chart at its end (src/lib/table-builder.ts, essayChartFrom). */
	function addToEssayLink(editLink: string): string {
		return `${editLink}${editLink.includes('?') ? '&' : '?'}add-chart=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
	}
</script>

<svelte:window onclick={onWindowClick} />

<svelte:head>
	<title>Build a table · Model Tribal ADR Code</title>
	<meta name="description" content="Build a table from the site’s data on Native nations, courts, laws, gaming compacts, constitutions, treaties and tribal court opinions." />
</svelte:head>

<div class="builder-page">
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }, { label: 'Data and charts', href: '/nations/data' }]} />
	<h1>Build a table</h1>

	{#if loadFailed}
		<p role="alert">The data didn’t load. Reload the page to try again.</p>
	{:else if !settings || !dataset}
		<noscript><p>Building a table needs JavaScript.</p></noscript>
	{:else}
		<div class="builder-controls no-print">
			<div class="field">
				<Dropdown label="Data" id="builder-data" choices={datasetChoices} value={settings.dataset} onchange={(chosen) => open(chosen).catch(() => (loadFailed = true))} />
			</div>
			<div class="field">
				<Dropdown
					label="Group by"
					id="builder-group"
					choices={groupChoices}
					value={settings.groupBy ?? ''}
					onchange={(chosen) => update({ groupBy: chosen || undefined, across: settings?.across === chosen ? undefined : settings?.across })}
				/>
			</div>
			{#if settings.groupBy}
				<div class="field">
					<Dropdown label="Across" id="builder-across" choices={acrossChoices} value={settings.across ?? ''} onchange={(chosen) => update({ across: chosen || undefined })} />
				</div>
				<div class="field">
					<Dropdown
						label="Value"
						id="builder-value"
						choices={measures}
						value={measureValue}
						onchange={(chosen) => update({ measure: measures.find((option) => option.value === chosen)?.measure ?? { kind: 'rows' } })}
					/>
				</div>
				<button
					type="button"
					class="icon-tool filters-button"
					class:active={filtering}
					class:open={filtersOpen}
					aria-label={filtering ? 'Filters, filtered' : 'Filters'}
					title="Filter the data"
					aria-expanded={filtersOpen}
					popovertarget="builder-filters"
					bind:this={filtersButton}
				>
					<Funnel aria-hidden="true" size="1.25em" strokeWidth={1.75} fill={filtering ? 'currentColor' : 'none'} />
				</button>
			{/if}
			{#if chart && editableEssays.length > 0}
				<div class="essay-menu copy-link">
					<button type="button" class="icon-tool" aria-label="Add to essay" title="Add this chart to an essay" aria-expanded={essaysOpen} aria-controls="builder-essays" onclick={() => (essaysOpen = !essaysOpen)}>
						<FilePlus aria-hidden="true" size="1.25em" strokeWidth={1.75} />
					</button>
					{#if essaysOpen}
						<ul id="builder-essays" class="menu menu-end" aria-label="Add to essay">
							{#each editableEssays as essay (essay.identifier)}
								<li><a href={addToEssayLink(essay.editLink)}>{essay.title}</a></li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
			<button type="button" class="icon-tool" class:copy-link={!(chart && editableEssays.length > 0)} aria-label="Copy link" title="Copy a link to this table" onclick={copyLink}>
				<Link aria-hidden="true" size="1.25em" strokeWidth={1.75} />
			</button>
			<span class="small muted" role="status">{copyStatus}</span>
		</div>
		{#if settings.groupBy}
			<div id="builder-filters" class="table-popover no-print" popover="auto" role="dialog" aria-label="Filters" ontoggle={onFiltersToggle} bind:this={filtersPopover}>
				{#if filtersOpen && filterColumn}
					{@const column = dataset.columns.find((candidate) => candidate.key === filterColumn)}
					<button type="button" class="back-button" onclick={() => (filterColumn = undefined)}>
						<ArrowLeft aria-hidden="true" size="1em" strokeWidth={1.75} />Filters
					</button>
					<ColumnFilterMenu
						identifier="builder-filter-{filterColumn}"
						title={column?.header ?? filterColumn}
						kind={builderFilterKind(dataset, filterColumn) ?? 'values'}
						choices={builderFilterKind(dataset, filterColumn) === 'values' ? filterOptions(dataset, settings.filters, filterColumn) : []}
						filter={settings.filters[filterColumn]}
						onchange={(filter) => filterColumn && setFilter(filterColumn, filter)}
					/>
				{:else if filtersOpen}
					<p class="popover-title">Filters</p>
					<ul class="popover-list popover-list-full filter-columns">
						{#each dataset.columns.filter((column) => builderFilterKind(dataset as BuilderDataset, column.key)) as column (column.key)}
							{@const active = filterIsActive(settings.filters[column.key])}
							<li>
								<button type="button" class:active onclick={() => (filterColumn = column.key)}>
									<span class="filter-column-name">{column.header}</span>
									<span class="filter-column-value">{filterSummary(settings.filters[column.key])}</span>
									<ChevronRight aria-hidden="true" size="1em" strokeWidth={1.75} />
								</button>
							</li>
						{/each}
					</ul>
					{#if filtering}
						<div class="popover-foot">
							<button type="button" class="popover-button" onclick={() => update({ filters: {} })}>Clear all</button>
						</div>
					{/if}
				{/if}
			</div>
		{/if}


		{#key resultKey}
			{#if chart}
				<BarChart {chart} />
			{:else if cross}
				<h2 class="result-title">{title}</h2>
				<DataTable identifier="built" label="Table: {title}" columns={cross.columns} rows={cross.rows} download="table" />
				<p class="small"><a href={dataset.sourceHref}>Source</a></p>
			{:else if records && !settings.groupBy}
				<h2 class="result-title">{title}</h2>
				<DataTable
					identifier="built"
					label="Table: {title}"
					columns={records.columns}
					rows={records.rows}
					rowName={dataset.rowName}
					defaultSort={{ key: dataset.nameColumn, direction: 'ascending' }}
					download="table"
					filters
					bind:shownColumns={() => shownKeys, (keys) => update({ columns: chosenColumns(dataset as BuilderDataset, keys) })}
					bind:columnFilters={() => settings?.filters ?? {}, (filters: ColumnFilters) => update({ filters })}
				/>
				<p class="small"><a href={dataset.sourceHref}>Source</a></p>
			{/if}
		{/key}
	{/if}
</div>

<style>
	.builder-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-2) var(--space-4);
		margin-bottom: var(--space-3);
	}

	.builder-controls .field {
		flex: 0 1 var(--layout-field-short);
		margin: 0;
	}

	.builder-controls .field:first-child {
		flex-basis: 18rem;
	}

	.builder-controls :global(.dropdown) {
		margin: 0;
	}

	.builder-controls :global(.dropdown-control) {
		width: 100%;
	}

	.essay-menu {
		position: relative;
	}

	.menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + var(--space-1));
		left: 0;
		min-width: 14rem;
		max-height: 60vh;
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1) 0;
		list-style: none;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
	}

	.menu-end {
		left: auto;
		right: 0;
	}

	.menu a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	.menu a:hover,
	.menu a:focus-visible {
		background: var(--color-surface);
	}

	/* Borderless icons, as in the table's and chart's control rows. */
	.icon-tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-1);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.icon-tool:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	/* The grouped result's funnel, filled while the data is filtered, as on a column header. */
	.filters-button.active {
		color: var(--color-link);
	}

	.filters-button.open {
		color: var(--color-ink);
		background: var(--color-surface-raised);
		box-shadow: inset 0 0 0 1px var(--color-control-border);
	}

	.filter-columns button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 2.25rem;
		padding: 0 var(--space-1);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.filter-columns button:hover,
	.filter-columns button:focus-visible {
		background: var(--color-surface);
	}

	.filter-columns button.active .filter-column-name {
		font-weight: var(--font-weight-semibold);
	}

	.filter-column-value {
		overflow: hidden;
		max-width: 12rem;
		margin-left: auto;
		padding-left: var(--space-3);
		color: var(--color-ink-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.back-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		margin: 0 0 var(--space-1);
		padding: 0 var(--space-1);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		font: inherit;
		cursor: pointer;
	}

	.back-button:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	.copy-link {
		margin-left: auto;
	}

	.result-title {
		margin-top: var(--space-4);
	}
</style>
