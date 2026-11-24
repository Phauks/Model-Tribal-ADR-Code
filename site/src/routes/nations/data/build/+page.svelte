<!--
	Build a table (Trevor, Nov. 24, 2026: "build functionality so people can
	build their own tables too"). The reader picks a dataset, its columns and
	filters, and may group it by one column, or by two for a table with a
	column per value of the second, and count or sum each group. The result
	shows in the shared DataTable, or the shared BarChart when grouped by one
	column, with their downloads and full screen. The settings live in the
	page address, so "Copy link" shares the table as built. The work is done
	in src/lib/table-builder.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import Link from '@lucide/svelte/icons/link';
	import ListFilterPlus from '@lucide/svelte/icons/list-filter-plus';
	import X from '@lucide/svelte/icons/x';
	import BarChart from '#lib/components/BarChart.svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import {
		builderDatasetPath,
		builderPath,
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

	let { data }: PageProps = $props();

	let loaded = $state<Record<string, BuilderDataset>>({});
	let settings = $state<BuilderSettings | undefined>();
	let loadFailed = $state(false);
	let columnsOpen = $state(false);
	let addOpen = $state(false);
	let copyStatus = $state('');

	const dataset = $derived(settings ? loaded[settings.dataset] : undefined);
	const groupable = $derived(dataset?.columns.filter((column) => column.type !== 'number') ?? []);
	const numberColumns = $derived(dataset?.columns.filter((column) => column.type === 'number') ?? []);
	const addable = $derived(dataset && settings ? groupable.filter((column) => !(column.key in (settings as BuilderSettings).filters)) : []);

	const measures = $derived.by((): { value: string; label: string; measure: BuilderMeasure }[] => {
		if (!dataset) return [];
		return [
			{ value: 'rows', label: measureHeader(dataset, { kind: 'rows' }), measure: { kind: 'rows' } },
			...(dataset.nationColumn ? [{ value: 'nations', label: 'Nations', measure: { kind: 'nations' } as BuilderMeasure }] : []),
			...numberColumns.flatMap((column) => (['sum', 'average'] as const).map((kind) => ({ value: `${kind}.${column.key}`, label: measureHeader(dataset, { kind, column: column.key }), measure: { kind, column: column.key } as BuilderMeasure })))
		];
	});
	const measureValue = $derived(settings ? (settings.measure.kind === 'sum' || settings.measure.kind === 'average' ? `${settings.measure.kind}.${settings.measure.column}` : settings.measure.kind) : 'rows');

	const records = $derived(dataset && settings && !settings.groupBy ? recordTable(dataset, settings) : undefined);
	const chart = $derived(dataset && settings ? groupedChart(dataset, settings) : undefined);
	const cross = $derived(dataset && settings ? crossTable(dataset, settings) : undefined);
	const title = $derived(dataset && settings ? resultTitle(dataset, settings) : '');
	// Redraws the table when its columns change, so its sort and widths start fresh.
	const resultKey = $derived(settings ? JSON.stringify(settings) : '');

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

	function toggleColumn(key: string, on: boolean): void {
		if (!settings || !dataset) return;
		const chosen = new Set(settings.columns);
		if (on) chosen.add(key);
		else chosen.delete(key);
		update({ columns: dataset.columns.filter((column) => chosen.has(column.key)).map((column) => column.key) });
	}

	function setFilter(key: string, value: string | undefined): void {
		if (!settings) return;
		const filters = { ...settings.filters };
		if (value === undefined) delete filters[key];
		else filters[key] = value;
		update({ filters });
	}

	async function copyLink(): Promise<void> {
		try {
			await navigator.clipboard.writeText(location.href);
			copyStatus = 'Link copied';
		} catch {
			copyStatus = 'Copy the address from the address bar';
		}
	}

	function onWindowClick(event: MouseEvent): void {
		const target = event.target as Element | null;
		if (!target?.closest('.columns-menu')) columnsOpen = false;
		if (!target?.closest('.add-menu')) addOpen = false;
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
	});
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
				<label for="builder-data">Data</label>
				<select id="builder-data" value={settings.dataset} onchange={(event) => open(event.currentTarget.value).catch(() => (loadFailed = true))}>
					{#each data.datasets as summary (summary.identifier)}
						<option value={summary.identifier}>{summary.title} ({summary.rowCount.toLocaleString('en-US')})</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="builder-group">Group by</label>
				<select id="builder-group" value={settings.groupBy ?? ''} onchange={(event) => update({ groupBy: event.currentTarget.value || undefined, across: settings?.across === event.currentTarget.value ? undefined : settings?.across })}>
					<option value="">None</option>
					{#each groupable as column (column.key)}
						<option value={column.key}>{column.header}</option>
					{/each}
				</select>
			</div>
			{#if settings.groupBy}
				<div class="field">
					<label for="builder-across">Across</label>
					<select id="builder-across" value={settings.across ?? ''} onchange={(event) => update({ across: event.currentTarget.value || undefined })}>
						<option value="">None</option>
						{#each groupable.filter((column) => column.key !== settings?.groupBy) as column (column.key)}
							<option value={column.key}>{column.header}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="builder-value">Value</label>
					<select id="builder-value" value={measureValue} onchange={(event) => update({ measure: measures.find((option) => option.value === event.currentTarget.value)?.measure ?? { kind: 'rows' } })}>
						{#each measures as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<div class="builder-filters no-print">
			{#each Object.entries(settings.filters) as [key, value] (key)}
				{@const column = dataset.columns.find((candidate) => candidate.key === key)}
				<div class="field filter-field">
					<div class="filter-label">
						<label for="builder-filter-{key}">{column?.header ?? key}</label>
						<button type="button" class="icon-tool remove-filter" aria-label="Remove the {column?.header ?? key} filter" title="Remove filter" onclick={() => setFilter(key, undefined)}>
							<X aria-hidden="true" size="1.1em" strokeWidth={1.75} />
						</button>
					</div>
					<select id="builder-filter-{key}" {value} onchange={(event) => setFilter(key, event.currentTarget.value)}>
						{#each filterOptions(dataset, settings.filters, key) as option (option.value)}
							<option value={option.value}>{option.value} ({option.count.toLocaleString('en-US')})</option>
						{/each}
					</select>
				</div>
			{/each}
			<div class="add-menu">
				<button type="button" class="button button-quiet small-button" aria-expanded={addOpen} aria-controls="builder-add-filter" onclick={() => (addOpen = !addOpen)}>
					<ListFilterPlus aria-hidden="true" size="1.1em" strokeWidth={1.75} />Add filter
				</button>
				{#if addOpen}
					<ul id="builder-add-filter" class="menu" aria-label="Filter by">
						{#each addable as column (column.key)}
							<li>
								<button type="button" onclick={() => { addOpen = false; setFilter(column.key, filterOptions(dataset, settings?.filters ?? {}, column.key)[0]?.value ?? ''); }}>{column.header}</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			{#if !settings.groupBy}
				<div class="columns-menu">
					<button type="button" class="button button-quiet small-button" aria-expanded={columnsOpen} aria-controls="builder-columns" onclick={() => (columnsOpen = !columnsOpen)}>
						<Columns3 aria-hidden="true" size="1.1em" strokeWidth={1.75} />Columns
					</button>
					{#if columnsOpen}
						<fieldset id="builder-columns" class="menu">
							<legend class="visually-hidden">Columns</legend>
							{#each dataset.columns as column (column.key)}
								<label>
									<input type="checkbox" checked={column.key === dataset.nameColumn || settings.columns.includes(column.key)} disabled={column.key === dataset.nameColumn} onchange={(event) => toggleColumn(column.key, event.currentTarget.checked)} />
									{column.header}
								</label>
							{/each}
						</fieldset>
					{/if}
				</div>
			{/if}
			<button type="button" class="icon-tool copy-link" aria-label="Copy link" title="Copy a link to this table" onclick={copyLink}>
				<Link aria-hidden="true" size="1.25em" strokeWidth={1.75} />
			</button>
			<span class="small muted" role="status">{copyStatus}</span>
		</div>

		{#key resultKey}
			{#if chart}
				<BarChart {chart} />
			{:else if cross}
				<h2 class="result-title">{title}</h2>
				<DataTable identifier="built" label="Table: {title}" columns={cross.columns} rows={cross.rows} download="table" />
				<p class="small"><a href={dataset.sourceHref}>Source</a></p>
			{:else if records}
				<h2 class="result-title">{title}</h2>
				<DataTable
					identifier="built"
					label="Table: {title}"
					columns={records.columns}
					rows={records.rows}
					rowName={dataset.rowName}
					defaultSort={{ key: dataset.nameColumn, direction: 'ascending' }}
					download="table"
				/>
				<p class="small"><a href={dataset.sourceHref}>Source</a></p>
			{/if}
		{/key}
	{/if}
</div>

<style>
	.builder-controls,
	.builder-filters {
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

	.builder-controls select,
	.filter-field select {
		width: 100%;
	}

	.filter-field {
		flex: 0 1 14rem;
		margin: 0;
	}

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

	.add-menu,
	.columns-menu {
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

	.menu button,
	.menu label {
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

	.menu button:hover,
	.menu button:focus-visible,
	.menu label:hover {
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

	.copy-link {
		margin-left: auto;
	}

	.result-title {
		margin-top: var(--space-4);
	}
</style>
