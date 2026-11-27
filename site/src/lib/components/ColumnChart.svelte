<!--
	@component
	A stacked column chart along a time line, such as how many documents each
	maker of federal law issued in each decade (column-chart.ts). It is plain
	HTML built ahead of time, so it reads without scripts and prints: each
	column is a list item whose text, read by a screen reader, gives its name,
	total and parts; the drawn column is decoration, except that a part with an
	address is a link to the records it counts (Trevor, Nov. 23, 2026: "all
	tables should be clickable into the data to explain itself").

	Like the bar chart (BarChart.svelte), the icon buttons at the top right
	switch between the columns and a sortable table, download the numbers as
	.csv or .xlsx, and fill the screen; the one word "Source" sits under it.

	Use:
	<ColumnChart chart={{ identifier, title, labelHeader, series, columns, source }} />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import Table from '@lucide/svelte/icons/table';
	import { columnSpoken, columnTable, columnTotal, type ColumnChartData } from '#lib/column-chart.ts';
	import TableDownload from '#lib/components/TableDownload.svelte';
	import DataTable from './DataTable.svelte';
	import ViewSwitch from './ViewSwitch.svelte';
	import { FullScreen } from '#lib/full-screen.svelte.ts';

	let { chart, headingLevel = 2 }: { chart: ColumnChartData; headingLevel?: 2 | 3 } = $props();

	let interactive = $state(false);
	let shownAs = $state<'chart' | 'table'>('chart');
	const table = $derived(columnTable(chart));
	const tallest = $derived(Math.max(1, ...chart.columns.map(columnTotal)));
	const share = (value: number) => `${(value / tallest) * 100}%`;

	let figure = $state<HTMLElement | undefined>();
	const fullScreen = new FullScreen(() => figure);

	function onKeydown(event: KeyboardEvent) {
		fullScreen.leaveOnEscape(event);
	}

	onMount(() => {
		interactive = true;
		return fullScreen.follow();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<figure class="column-chart" class:filling-window={fullScreen.fillingWindow} id={chart.identifier} aria-labelledby="{chart.identifier}-title" data-print-part="tables" bind:this={figure} style:--column-count={chart.columns.length}>
	<div class="chart-head">
		<svelte:element this={`h${headingLevel}`} id="{chart.identifier}-title" class="chart-title">{chart.title}</svelte:element>
		<div class="chart-tools no-print">
			{#if interactive}
				<ViewSwitch
					label="Show {chart.title} as"
					value={shownAs}
					onchange={(value) => (shownAs = value)}
					choices={[
						{ value: 'chart', label: 'Columns', title: 'Show as columns', icon: ChartColumn },
						{ value: 'table', label: 'Table', title: 'Show as a table', icon: Table }
					]}
				/>
			{/if}
			<TableDownload name={chart.identifier} title={chart.title} table={() => table} {interactive} label="Download the numbers" />
			{#if interactive}
				<button type="button" class="view-button" aria-label={fullScreen.shown ? 'Leave full screen' : 'Full screen'} title={fullScreen.shown ? 'Leave full screen' : 'Full screen'} onclick={fullScreen.toggle}>
					{#if fullScreen.shown}<Minimize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{:else}<Maximize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{/if}
				</button>
			{/if}
		</div>
	</div>
	{#if chart.description}<p class="chart-description">{chart.description}</p>{/if}
	<div class="chart-view" hidden={interactive && shownAs !== 'chart'}>
		<ul class="key" aria-label="Key">
			{#each chart.series as series, index (series.key)}
				<li><span class="swatch series-{index + 1}" aria-hidden="true"></span>{series.label}</li>
			{/each}
		</ul>
		<ol class="columns">
			{#each chart.columns as column (column.label)}
				<li title={columnSpoken(chart, column)}>
					<span class="visually-hidden">{columnSpoken(chart, column)}</span>
					<span class="stack" style:height={share(columnTotal(column))}>
						{#each chart.series as series, index (series.key)}
							{@const value = column.values[series.key] ?? 0}
							{@const href = column.links?.[series.key]}
							{#if value > 0}
								{#if href}
									<a class="part series-{index + 1}" {href} style:flex-grow={value} aria-label="{column.label}, {series.label}: {value.toLocaleString('en-US')}"></a>
								{:else}
									<span class="part series-{index + 1}" style:flex-grow={value} aria-hidden="true"></span>
								{/if}
							{/if}
						{/each}
					</span>
				</li>
			{/each}
		</ol>
		<div class="axis" aria-hidden="true">
			{#each chart.columns as column (column.label)}<span>{column.axisLabel ?? ''}</span>{/each}
		</div>
	</div>
	<div class="chart-table" class:no-print={shownAs !== 'table'} hidden={interactive && shownAs !== 'table'}>
		<DataTable identifier="{chart.identifier}-table" label="Table: {chart.title}" columns={table.columns} rows={table.rows} count={false} tools={false} />
	</div>
	<!-- Only the word "Source", which links to where the numbers come from (Trevor, Nov. 23, 2026). -->
	<figcaption class="small">
		{#if chart.sourceHref}<a class="chart-source" href={chart.sourceHref} title={chart.source}>Source</a>{:else}<span class="chart-source" title={chart.source}>Source</span>{/if}
	</figcaption>
</figure>

<style>
	.column-chart {
		margin: var(--space-6) 0 0;
	}

	/* The title over a rule, with the icon buttons at its right (mockup home-A2). */
	.chart-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-3);
		padding-bottom: var(--space-1);
		margin-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	.chart-title {
		flex: 1 1 10rem;
		margin: 0;
	}

	.chart-tools {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}

	.view-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.view-button:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	.chart-description {
		margin: 0 0 var(--space-3);
		max-width: var(--layout-measure);
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
		font-size: var(--font-size-small);
	}

	.key li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
	}

	/* The columns share the width evenly and stand on one base line. */
	.columns {
		display: grid;
		grid-template-columns: repeat(var(--column-count), minmax(0, 1fr));
		gap: 3px;
		align-items: end;
		height: 13rem;
		margin: 0;
		padding: 0;
		list-style: none;
		border-bottom: 1px solid var(--color-control-border);
	}

	.columns li {
		display: flex;
		align-items: flex-end;
		height: 100%;
	}

	/* The first series at the bottom, as the key lists them. */
	.stack {
		display: flex;
		flex-direction: column-reverse;
		width: 100%;
		min-height: 1px;
	}

	.part {
		display: block;
		flex-basis: 0;
		min-height: 1px;
	}

	a.part:hover,
	a.part:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 1px;
	}

	.axis {
		display: grid;
		grid-template-columns: repeat(var(--column-count), minmax(0, 1fr));
		gap: 3px;
		margin-top: var(--space-1);
		font-size: var(--font-size-small);
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	/* A label names the column it starts under and runs on over its neighbors. */
	.axis span {
		white-space: nowrap;
		overflow: visible;
	}

	.series-1 { background: var(--color-chart-series-1); }
	.series-2 { background: var(--color-chart-series-2); }
	.series-3 { background: var(--color-chart-series-3); }
	.series-4 { background: var(--color-chart-series-4); }
	.series-5 { background: var(--color-chart-series-5); }
	.series-6 { background: var(--color-chart-series-6); }
	.series-7 { background: var(--color-chart-series-7); }

	.chart-source {
		display: inline-flex;
		align-items: center;
		min-height: 24px;
	}

	figcaption {
		margin-top: var(--space-2);
	}

	.column-chart:fullscreen,
	.column-chart.filling-window {
		overflow: auto;
		padding: var(--space-6);
		margin: 0;
		background: var(--color-paper);
	}

	.column-chart.filling-window {
		position: fixed;
		inset: 0;
		z-index: 1000;
	}

	.column-chart:fullscreen .columns,
	.column-chart.filling-window .columns {
		height: 60vh;
	}
</style>
