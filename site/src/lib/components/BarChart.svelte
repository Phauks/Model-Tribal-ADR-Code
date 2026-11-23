<!--
	@component
	A horizontal bar chart (Trevor chose bar charts on Nov. 23, 2026). Bars run
	sideways so long names read on one line. The chart is plain HTML built
	ahead of time, so it reads without scripts and prints: each bar is a list
	item holding its name and number, which is what a screen reader reads; the
	drawn bar is decoration. A bar with an address is a link, such as to Find
	recourse filtered to the provisions it counts.

	Two icon buttons at the chart's top right switch it between the chart and
	the same numbers as a sortable table with a CSV download (Trevor, Nov. 23,
	2026, in place of a "Show as a table" line under the chart). Without
	scripts both show, one after the other. A chart with `shown` draws only
	that many bars and offers "Show all"; the table always has every row.

	Every bar with an address leads to the records it counts (Trevor, Nov. 23,
	2026: "all tables should be clickable into the data to explain itself"):
	the whole row, name, bar and number, is one link, and in the table both
	the name and the number are links.

	Use:
	<BarChart chart={{ identifier, title, description, labelHeader, valueHeader, source, bars }} />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import Table from '@lucide/svelte/icons/table';
	import { chartTable, scaleTop, type BarChartData } from '#lib/bar-chart.ts';
	import DataTable from './DataTable.svelte';

	let { chart, headingLevel = 2 }: { chart: BarChartData; headingLevel?: 2 | 3 } = $props();

	let interactive = $state(false);
	let showAll = $state(false);
	/** Which the reader sees: the chart, or the same numbers as a table. */
	let shownAs = $state<'chart' | 'table'>('chart');

	const scale = $derived(scaleTop(Math.max(0, ...chart.bars.map((bar) => bar.value))));
	const ticks = $derived(
		Array.from({ length: Math.round(scale.top / scale.step) + 1 }, (_, index) => index * scale.step)
	);
	const limited = $derived(chart.shown !== undefined && chart.bars.length > chart.shown);
	const bars = $derived(limited && !showAll ? chart.bars.slice(0, chart.shown) : chart.bars);
	const table = $derived(chartTable(chart));
	const percent = (value: number) => `${(value / scale.top) * 100}%`;

	onMount(() => {
		interactive = true;
	});
</script>

<figure class="chart" id={chart.identifier} aria-labelledby="{chart.identifier}-title" data-print-part="tables">
	<div class="chart-head">
		<svelte:element this={`h${headingLevel}`} id="{chart.identifier}-title" class="chart-title">{chart.title}</svelte:element>
		{#if interactive}
			<div class="view-switch no-print" role="group" aria-label="Show {chart.title} as">
				<button type="button" class="view-button" aria-pressed={shownAs === 'chart'} aria-label="Chart" title="Show as a chart" onclick={() => (shownAs = 'chart')}>
					<ChartBar aria-hidden="true" size="1.25em" strokeWidth={1.75} />
				</button>
				<button type="button" class="view-button" aria-pressed={shownAs === 'table'} aria-label="Table" title="Show as a table" onclick={() => (shownAs = 'table')}>
					<Table aria-hidden="true" size="1.25em" strokeWidth={1.75} />
				</button>
			</div>
		{/if}
	</div>
	<p class="chart-description">{chart.description}</p>
	<div class="chart-view" hidden={interactive && shownAs !== 'chart'}>
		<div class="plot" style:--grid-step={percent(scale.step)}>
			<ol class="bars">
				{#each bars as bar (bar.label)}
					<li class:linked={Boolean(bar.href)}>
						<span class="bar-label">
							{#if bar.href}<a href={bar.href}>{bar.label}<span class="visually-hidden">: {bar.value.toLocaleString('en-US')}</span></a>{:else}{bar.label}{/if}
						</span>
						<span class="bar-track" aria-hidden="true"><span class="bar-fill" style:width={percent(bar.value)}></span></span>
						<span class="bar-value" aria-hidden={bar.href ? 'true' : undefined}>{bar.value.toLocaleString('en-US')}</span>
					</li>
				{/each}
			</ol>
			<div class="axis-row" aria-hidden="true">
				<span></span>
				<span class="axis">
					{#each ticks as tick (tick)}
						<span style:left={percent(tick)}>{tick.toLocaleString('en-US')}</span>
					{/each}
				</span>
				<span></span>
			</div>
		</div>
		{#if limited && interactive}
			<button type="button" class="link-button no-print" aria-expanded={showAll} onclick={() => (showAll = !showAll)}>
				{showAll ? `Show the first ${chart.shown}` : `Show all ${chart.bars.length}`}
			</button>
		{:else if limited}
			<p class="small muted">The first {chart.shown} of {chart.bars.length}; the table lists every one.</p>
		{/if}
	</div>
	<div class="chart-table" class:no-print={shownAs !== 'table'} hidden={interactive && shownAs !== 'table'}>
		<DataTable
			identifier="{chart.identifier}-table"
			label="Table: {chart.title}"
			columns={table.columns}
			rows={table.rows}
			defaultSort={{ key: 'value', direction: 'descending' }}
			download={chart.identifier}
		>
			{#snippet cell(row)}
				{@const href = row.cells.label?.href}
				{#if href}<a {href}>{row.cells.value?.text}</a>{:else}{row.cells.value?.text}{/if}
			{/snippet}
		</DataTable>
	</div>
	<figcaption class="small muted">Source: {chart.source}</figcaption>
</figure>

<style>
	.chart {
		margin: 0 0 var(--space-6);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		/* Room for the label column: about 16 characters on a phone, more on wide screens. */
		--label-width: minmax(7rem, 15rem);
	}

	.chart-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.chart-title {
		margin-top: 0;
	}

	/* The chart and table switch, at the top right: two borderless icon buttons, the one in use marked. */
	.view-switch {
		display: flex;
		flex-shrink: 0;
		gap: var(--space-1);
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

	.view-button[aria-pressed='true'] {
		color: var(--color-link);
		box-shadow: inset 0 -2px 0 var(--color-link);
	}

	/* A bar with an address: the name's link covers the whole row, so the bar and the number open it too. */
	.bars li.linked {
		position: relative;
	}

	.bars li.linked a::after {
		content: '';
		position: absolute;
		inset: 0;
	}

	.bars li.linked:hover {
		background: var(--color-surface);
	}

	.chart-description {
		margin: 0 0 var(--space-3);
		max-width: var(--layout-measure);
	}

	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.bars li,
	.axis-row {
		display: grid;
		grid-template-columns: var(--label-width) minmax(0, 1fr) var(--value-width, 3.5rem);
		gap: var(--space-3);
		align-items: center;
	}

	.bars li {
		min-height: 1.9rem;
		font-size: var(--font-size-small);
	}

	.bar-label {
		text-align: right;
		line-height: 1.25;
	}

	.bar-track {
		position: relative;
		height: 1.1rem;
		/* Gridlines on round numbers, under the bars. */
		background-image: repeating-linear-gradient(
			to right,
			var(--color-line) 0 1px,
			transparent 1px var(--grid-step)
		);
	}

	.bar-fill {
		position: absolute;
		inset: 0 auto 0 0;
		min-width: 2px;
		border-radius: 0 3px 3px 0;
		background: var(--color-link);
		print-color-adjust: exact;
	}

	.bars li:has(a:hover) .bar-fill,
	.bars li:has(a:focus-visible) .bar-fill {
		background: var(--color-action);
	}

	.bar-value {
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.axis {
		position: relative;
		height: 1.4rem;
		margin-top: var(--space-1);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.axis span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	.link-button {
		margin-top: var(--space-2);
		border: 0;
		padding: var(--space-1) 0;
		background: transparent;
		color: var(--color-link);
		text-decoration: underline;
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	figcaption {
		margin-top: var(--space-2);
	}

	.chart-table {
		margin-top: var(--space-3);
	}

	[hidden] {
		display: none !important;
	}

	@media (max-width: 40rem) {
		.chart {
			padding: var(--space-3);
			--label-width: minmax(5rem, 8rem);
			--value-width: 2.5rem;
		}

		.bars li,
		.axis-row {
			gap: var(--space-2);
		}
	}
</style>
