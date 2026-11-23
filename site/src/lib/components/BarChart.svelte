<!--
	@component
	A horizontal bar chart (Trevor chose bar charts on Nov. 23, 2026). Bars run
	sideways so long names read on one line. The chart is plain HTML built
	ahead of time, so it reads without scripts and prints: each bar is a list
	item holding its name and number, which is what a screen reader reads; the
	drawn bar is decoration. A bar with an address is a link, such as to Find
	recourse filtered to the provisions it counts.

	Under the chart, "Show as a table" opens the same numbers as a sortable
	table with a CSV download. A chart with `shown` draws only that many bars
	and offers "Show all"; the table always has every row.

	Use:
	<BarChart chart={{ identifier, title, description, labelHeader, valueHeader, source, bars }} />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { chartTable, scaleTop, type BarChartData } from '#lib/bar-chart.ts';
	import DataTable from './DataTable.svelte';

	let { chart, headingLevel = 2 }: { chart: BarChartData; headingLevel?: 2 | 3 } = $props();

	let interactive = $state(false);
	let showAll = $state(false);

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
	<svelte:element this={`h${headingLevel}`} id="{chart.identifier}-title" class="chart-title">{chart.title}</svelte:element>
	<p class="chart-description">{chart.description}</p>
	<div class="plot" style:--grid-step={percent(scale.step)}>
		<ol class="bars">
			{#each bars as bar (bar.label)}
				<li>
					<span class="bar-label">
						{#if bar.href}<a href={bar.href}>{bar.label}</a>{:else}{bar.label}{/if}
					</span>
					<span class="bar-track" aria-hidden="true"><span class="bar-fill" style:width={percent(bar.value)}></span></span>
					<span class="bar-value">{bar.value.toLocaleString('en-US')}</span>
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
	<details class="chart-table no-print">
		<summary>Show as a table</summary>
		<DataTable
			identifier="{chart.identifier}-table"
			label="Table: {chart.title}"
			columns={table.columns}
			rows={table.rows}
			defaultSort={{ key: 'value', direction: 'descending' }}
			download={chart.identifier}
		/>
	</details>
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

	.chart-title {
		margin-top: 0;
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

	.chart-table summary {
		cursor: pointer;
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2) 0;
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
