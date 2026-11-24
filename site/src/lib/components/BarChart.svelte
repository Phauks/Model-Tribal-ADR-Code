<!--
	@component
	A horizontal bar chart (Trevor chose bar charts on Nov. 23, 2026). Bars run
	sideways so long names read on one line. The chart is plain HTML built
	ahead of time, so it reads without scripts and prints: each bar is a list
	item holding its name and number, which is what a screen reader reads; the
	drawn bar is decoration. A bar with an address is a link, such as to Find
	recourse filtered to the provisions it counts.

	The icon buttons at the chart's top right (Trevor, Nov. 23, 2026) switch
	it between bars, a pie (only for a chart whose bars are parts of one
	whole) and a sortable table, and a download icon lists the numbers as a
	.csv file or an Excel workbook (.xlsx), whatever the view. Without scripts
	the bars and the table both show, and the download list still opens to
	the chart's published files.

	Every bar with an address leads to the records it counts (Trevor, Nov. 23,
	2026: "all tables should be clickable into the data to explain itself"):
	the whole row, name, bar and number, is one link and lights up as one, and
	in the table both the name and the number are links. A pie's slices and
	its key lead to the same places.

	A reader can leave any item out, such as the largest, to see how the rest
	compare without it (Trevor, Nov. 23, 2026), from whichever view they are
	in: a bar's row, a pie key's entry (an "Other" entry leaves out every item
	it folds) or a table row. All views read one list, `left`, so an item left
	out in one is left out in all, and a new view drawn from `kept` gets the
	same for free. The scale, the pie's shares, the table and the total are
	worked out again from the items left; the left out items are listed to
	bring back one by one, and "Bring back all" restores every one in one
	click, whichever view is showing. A chart with `shown` draws only that many bars and offers
	"Show all"; the table always has every row.

	Use:
	<BarChart chart={{ identifier, title, description, labelHeader, valueHeader, source, bars }} />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Table from '@lucide/svelte/icons/table';
	import X from '@lucide/svelte/icons/x';
	import { chartTable, pieSlices, scaleTop, shareText, slicePath, type BarChartData } from '#lib/bar-chart.ts';
	import TableDownload from '#lib/components/TableDownload.svelte';
	import DataTable from './DataTable.svelte';
	import ViewSwitch from './ViewSwitch.svelte';

	let { chart, headingLevel = 2 }: { chart: BarChartData; headingLevel?: 2 | 3 } = $props();

	let interactive = $state(false);
	let showAll = $state(false);
	/** Which the reader sees: bars, a pie, or the same numbers as a table. */
	let shownAs = $state<'chart' | 'pie' | 'table'>('chart');
	/** The bars the reader has left out, by name. */
	let left = $state<string[]>([]);
	/** The pie slice under the pointer or keyboard focus, which its key entry lights up with. */
	let lit = $state<string | undefined>();

	const kept = $derived(chart.bars.filter((bar) => !left.includes(bar.label)));
	const leftOut = $derived(chart.bars.filter((bar) => left.includes(bar.label)));
	const total = $derived(kept.reduce((sum, bar) => sum + bar.value, 0));
	const scale = $derived(scaleTop(Math.max(0, ...kept.map((bar) => bar.value))));
	const ticks = $derived(
		Array.from({ length: Math.round(scale.top / scale.step) + 1 }, (_, index) => index * scale.step)
	);
	const limited = $derived(chart.shown !== undefined && kept.length > chart.shown);
	const bars = $derived(limited && !showAll ? kept.slice(0, chart.shown) : kept);
	/** The rows shown, for the downloads. */
	const table = $derived(chartTable({ ...chart, bars: kept }));
	/** Every row, for the table view, which marks the left out ones itself from the same list. */
	const fullTable = $derived(chartTable(chart));
	const slices = $derived(pieSlices(kept));
	const percent = (value: number) => `${(value / scale.top) * 100}%`;
	const pieRadius = 100;

	/** The chart filling the screen (Trevor, Nov. 23, 2026), with the browser's full screen where it has one, or filling the window where it does not, as on an iPhone. */
	let figure = $state<HTMLElement | undefined>();
	let fullScreen = $state(false);
	let fillingWindow = $state(false);

	async function toggleFullScreen() {
		if (fullScreen || fillingWindow) {
			if (document.fullscreenElement) await document.exitFullscreen();
			fillingWindow = false;
			return;
		}
		if (figure?.requestFullscreen) {
			try {
				await figure.requestFullscreen();
				return;
			} catch {
				// Refused, as in a frame without permission: fill the window instead.
			}
		}
		fillingWindow = true;
	}

	function onKeydown(event: KeyboardEvent) {
		if (fillingWindow && event.key === 'Escape') fillingWindow = false;
	}

	function leaveOut(...labels: string[]) {
		left = [...left, ...labels.filter((label) => !left.includes(label))];
	}

	function bringBack(label: string) {
		left = left.filter((item) => item !== label);
	}

	onMount(() => {
		interactive = true;
		const onChange = () => {
			fullScreen = document.fullscreenElement === figure;
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});
</script>

<svelte:window onkeydown={onKeydown} />

<figure class="chart" class:filling-window={fillingWindow} id={chart.identifier} aria-labelledby="{chart.identifier}-title" data-print-part="tables" bind:this={figure}>
	<div class="chart-head">
		<svelte:element this={`h${headingLevel}`} id="{chart.identifier}-title" class="chart-title">{chart.title}</svelte:element>
		<div class="chart-tools no-print">
			{#if interactive}
				<ViewSwitch
					label="Show {chart.title} as"
					value={shownAs}
					onchange={(value) => (shownAs = value)}
					choices={[
						{ value: 'chart', label: 'Bars', title: 'Show as bars', icon: ChartBar },
						...(chart.partsOfWhole ? [{ value: 'pie' as const, label: 'Pie', title: 'Show as a pie', icon: ChartPie }] : []),
						{ value: 'table', label: 'Table', title: 'Show as a table', icon: Table }
					]}
				/>
			{/if}
			<TableDownload name={chart.identifier} title={chart.title} table={() => table} csvHref={chart.csvHref} xlsxHref={chart.xlsxHref} published={left.length === 0} {interactive} label="Download the numbers" />
			{#if interactive}
				<button type="button" class="view-button" aria-label={fullScreen || fillingWindow ? 'Leave full screen' : 'Full screen'} title={fullScreen || fillingWindow ? 'Leave full screen' : 'Full screen'} onclick={toggleFullScreen}>
					{#if fullScreen || fillingWindow}<Minimize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{:else}<Maximize aria-hidden="true" size="1.25em" strokeWidth={1.75} />{/if}
				</button>
			{/if}
		</div>
	</div>
	<p class="chart-description">{chart.description}</p>
	{#if leftOut.length > 0}
		<div class="left-out no-print">
			<p class="small" role="status">
				Left out: {leftOut.length.toLocaleString('en-US')} of {chart.bars.length.toLocaleString('en-US')}. {chart.partsOfWhole ? 'The scale, shares and total count' : 'The scale counts'} only what is shown.
			</p>
			<ul class="left-out-list" aria-label="Left out">
				{#each leftOut as bar (bar.label)}
					<li>
						<button type="button" class="chip-button" aria-label="Bring back {bar.label}" onclick={() => bringBack(bar.label)}>
							{bar.label} ({bar.value.toLocaleString('en-US')})<X aria-hidden="true" size="1em" />
						</button>
					</li>
				{/each}
			</ul>
			<button type="button" class="button button-quiet small-button" onclick={() => (left = [])}>
				<RotateCcw aria-hidden="true" size="1.1em" strokeWidth={1.75} />Bring back all
			</button>
		</div>
	{/if}
	<div class="chart-view" hidden={interactive && shownAs !== 'chart'}>
		<div class="plot" style:--grid-step={percent(scale.step)}>
			<ol class="bars">
				{#each bars as bar (bar.label)}
					<li class:linked={Boolean(bar.href)} class:with-tools={interactive}>
						<span class="bar-label">
							{#if bar.href}<a href={bar.href}>{bar.label}<span class="visually-hidden">: {bar.value.toLocaleString('en-US')}</span></a>{:else}{bar.label}{/if}
						</span>
						<span class="bar-track" aria-hidden="true"><span class="bar-fill" style:width={percent(bar.value)}></span></span>
						<span class="bar-value" aria-hidden={bar.href ? 'true' : undefined}>{bar.value.toLocaleString('en-US')}</span>
						{#if interactive}
							<button type="button" class="leave-out no-print" aria-label="Leave out {bar.label}" title="Leave out {bar.label}" onclick={() => leaveOut(bar.label)}>
								<EyeOff aria-hidden="true" size="1em" strokeWidth={1.75} />
							</button>
						{/if}
					</li>
				{/each}
			</ol>
			<div class="axis-row" class:with-tools={interactive} aria-hidden="true">
				<span></span>
				<span class="axis">
					{#each ticks as tick (tick)}
						<span style:left={percent(tick)}>{tick.toLocaleString('en-US')}</span>
					{/each}
				</span>
				<span></span>
				{#if interactive}<span></span>{/if}
			</div>
		</div>
		{#if limited && interactive}
			<button type="button" class="link-button no-print" aria-expanded={showAll} onclick={() => (showAll = !showAll)}>
				{showAll ? `Show the first ${chart.shown}` : `Show all ${kept.length}`}
			</button>
		{:else if limited}
			<p class="small muted">The first {chart.shown} of {kept.length}; the table lists every one.</p>
		{/if}
	</div>
	{#if chart.partsOfWhole && interactive && shownAs === 'pie'}
		<div class="pie-view">
			<svg class="pie" viewBox="0 0 {pieRadius * 2} {pieRadius * 2}" role="img" aria-labelledby="{chart.identifier}-title">
				{#each slices as slice (slice.label)}
					{@const title = `${slice.label}: ${slice.value.toLocaleString('en-US')} (${shareText(slice.share)})`}
					{#if slice.href}
						<a href={slice.href} aria-label={title} onpointerenter={() => (lit = slice.label)} onpointerleave={() => (lit = undefined)} onfocus={() => (lit = slice.label)} onblur={() => (lit = undefined)}>
							<path d={slicePath(slice, pieRadius)} class="slice series-{slice.series}" class:lit={lit === slice.label} class:dim={lit !== undefined && lit !== slice.label}><title>{title}</title></path>
						</a>
					{:else}
						<path d={slicePath(slice, pieRadius)} class="slice series-{slice.series}" class:lit={lit === slice.label} class:dim={lit !== undefined && lit !== slice.label} role="presentation" onpointerenter={() => (lit = slice.label)} onpointerleave={() => (lit = undefined)}><title>{title}</title></path>
					{/if}
				{/each}
			</svg>
			<ol class="pie-key">
				{#each slices as slice (slice.label)}
					<li class:lit={lit === slice.label} onpointerenter={() => (lit = slice.label)} onpointerleave={() => (lit = undefined)}>
						<span class="swatch series-{slice.series}" aria-hidden="true"></span>
						<span class="key-label">
							{#if slice.href}<a href={slice.href} onfocus={() => (lit = slice.label)} onblur={() => (lit = undefined)}>{slice.label}</a>{:else}{slice.label}{#if slice.folded > 1}{" "}<span class="small muted">(in the table)</span>{/if}{/if}
						</span>
						<span class="key-value">{slice.value.toLocaleString('en-US')}</span>
						<span class="key-share">{shareText(slice.share)}</span>
						<button type="button" class="leave-out no-print" aria-label="Leave out {slice.label}" title="Leave out {slice.label}" onclick={() => leaveOut(...slice.members)}>
							<EyeOff aria-hidden="true" size="1em" strokeWidth={1.75} />
						</button>
					</li>
				{/each}
			</ol>
		</div>
	{/if}
	<div class="chart-table" class:no-print={shownAs !== 'table'} hidden={interactive && shownAs !== 'table'}>
		<DataTable
			identifier="{chart.identifier}-table"
			label="Table: {chart.title}"
			columns={fullTable.columns}
			rows={fullTable.rows}
			bind:leftOut={left}
			leaveOut
			defaultSort={{ key: 'value', direction: 'descending' }}
			count={false}
			tools={false}
		>
			{#snippet cell(row)}
				{@const href = row.cells.label?.href}
				{#if href}<a {href}>{row.cells.value?.text}</a>{:else}{row.cells.value?.text}{/if}
			{/snippet}
		</DataTable>
	</div>
	{#if chart.partsOfWhole}
		<p class="small chart-total">Total: {total.toLocaleString('en-US')} {chart.valueHeader.toLocaleLowerCase('en-US')}{leftOut.length > 0 ? ' shown' : ''}</p>
	{/if}
	<!-- Only the word "Source", which links to where the numbers come from (Trevor, Nov. 23, 2026); a bar's own page lists the source of each record it counts. -->
	<figcaption class="small">
		{#if chart.sourceHref}<a class="chart-source" href={chart.sourceHref} title={chart.source}>Source</a>{:else}<span class="chart-source" title={chart.source}>Source</span>{/if}
	</figcaption>
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
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-1) var(--space-3);
	}

	/* On a narrow screen the title takes the line and the tools wrap under it, at the right. */
	.chart-title {
		flex: 1 1 14rem;
	}

	.chart-tools {
		margin-left: auto;
	}

	.chart-title {
		margin-top: 0;
	}

	/* The view switch and the download list (.csv and .xlsx), on one line at the top right: borderless icon buttons, the view in use marked. */
	.chart-tools {
		display: flex;
		flex-shrink: 0;
		align-items: center;
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

	/* A bar with an address: the name's link covers the whole row, so the bar and the number open it too (Trevor, Nov. 23, 2026). The cover sits above the bar's track, which is positioned and would otherwise take the click. */
	.bars li.linked {
		position: relative;
	}

	.bars li.linked a::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	/* Pointing at any part of a bar's row, its name, bar or number, lights all three up together (Trevor, Nov. 23, 2026). */
	.bars li.linked:hover {
		background: var(--color-surface);
	}

	.bars li.linked:hover a,
	.bars li.linked:has(a:focus-visible) a {
		text-decoration-thickness: 3px;
	}

	.bars li.linked:hover .bar-fill {
		background: var(--color-action);
	}

	/* The button that leaves a bar out sits at the row's end, above the row's link. */
	.bars li.with-tools,
	.axis-row.with-tools {
		grid-template-columns: var(--label-width) minmax(0, 1fr) var(--value-width, 3.5rem) 1.75rem;
	}

	.leave-out {
		position: relative;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		border-radius: var(--radius-control);
		padding: 0;
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
		opacity: 0.55;
	}

	.bars li:hover .leave-out,
	.pie-key li:hover .leave-out,
	.leave-out:focus-visible {
		opacity: 1;
	}

	.leave-out:hover {
		color: var(--color-ink);
		background: var(--color-surface-raised);
	}

	.left-out {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
	}

	.left-out p {
		margin: 0;
	}

	.left-out .button {
		gap: var(--space-1);
	}

	.left-out-list {
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

	/* The pie: slices in the chart palette's fixed order, parted by a thin line of the panel's color, with a key giving each name, number and share. */
	.pie-view {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-5);
	}

	.pie {
		width: min(100%, 16rem);
		height: auto;
		flex-shrink: 0;
	}

	.slice {
		stroke: var(--color-surface-raised);
		stroke-width: 2;
		print-color-adjust: exact;
	}

	.slice.dim {
		opacity: 0.45;
	}

	.slice.lit {
		stroke: var(--color-ink);
	}

	.series-1 { fill: var(--color-chart-series-1); background: var(--color-chart-series-1); }
	.series-2 { fill: var(--color-chart-series-2); background: var(--color-chart-series-2); }
	.series-3 { fill: var(--color-chart-series-3); background: var(--color-chart-series-3); }
	.series-4 { fill: var(--color-chart-series-4); background: var(--color-chart-series-4); }
	.series-5 { fill: var(--color-chart-series-5); background: var(--color-chart-series-5); }
	.series-6 { fill: var(--color-chart-series-6); background: var(--color-chart-series-6); }
	.series-7 { fill: var(--color-chart-series-7); background: var(--color-chart-series-7); }

	.pie-key {
		flex: 1 1 16rem;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: var(--font-size-small);
	}

	.pie-key li {
		display: grid;
		grid-template-columns: 1rem minmax(0, 1fr) auto 3rem 1.75rem;
		gap: var(--space-2);
		align-items: center;
		min-height: 1.9rem;
		padding: 0 var(--space-1);
		border-radius: var(--radius-control);
	}

	.pie-key li.lit {
		background: var(--color-surface);
	}

	.pie-key li.lit a {
		text-decoration-thickness: 3px;
	}

	.swatch {
		width: 1rem;
		height: 1rem;
		border-radius: 3px;
		print-color-adjust: exact;
	}

	.key-value,
	.key-share {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.key-share {
		color: var(--color-ink-muted);
	}

	/* Full screen: the chart fills the screen, scrolling if it is taller. */
	.chart:fullscreen,
	.chart.filling-window {
		overflow: auto;
		padding: var(--space-6);
		margin: 0;
		border: 0;
		border-radius: 0;
	}

	.chart.filling-window {
		position: fixed;
		inset: 0;
		z-index: 1000;
	}

	.chart:fullscreen .pie,
	.chart.filling-window .pie {
		width: min(100%, 28rem);
	}

	.chart-source {
		display: inline-flex;
		align-items: center;
		min-height: 24px;
	}

	.chart-total {
		margin: var(--space-2) 0 0;
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

		/* Every other number on the scale, so they do not run together. */
		.axis span:nth-child(even) {
			visibility: hidden;
		}
	}
</style>
