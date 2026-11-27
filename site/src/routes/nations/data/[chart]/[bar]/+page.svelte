<!--
	The records behind one bar on Data and charts (Trevor, Nov. 23, 2026: "all
	tables should be clickable into the data to explain itself"): the nations
	or compacts the bar counts, each linked to its page or document, with the
	source of each fact cited beside it and listed under Sources.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { dataChartTrail } from '#lib/data-chart-list.ts';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.bar.label} · {data.chart.title} · Tribal Law Project</title>
	<meta name="description" content={data.description} />
</svelte:head>

<Breadcrumbs trail={dataChartTrail(data.chart)} current={data.bar.label} />

<h1>{data.bar.label}</h1>
<p class="lead count-line">
	<span class="count">{data.bar.value.toLocaleString('en-US')}</span>
	{data.bar.value === 1 ? data.rowName[0] : data.rowName[1]} in “{data.chart.title}”
</p>
<p class="description">{data.description}</p>

<div class="records-table">
	<DataTable
		identifier="records"
		label="Table: {data.bar.label}"
		columns={data.columns}
		rows={data.rows}
		defaultSort={{ key: data.columns[0].key, direction: 'ascending' }}
		rowName={data.rowName}
		searchLabel={data.rows.length >= 10 ? `Search these ${data.rowName[1]}` : undefined}
		filters={data.rows.length > 5}
		download="{data.chart.identifier}-{data.bar.slug}"
		shareable
		{cell}
	/>
</div>

{#snippet cell(row: TableRow, column: TableColumn)}
	{@const items = data.items[row.key]?.[column.key] ?? []}
	{#if items.length === 1 && !items[0].href}
		{items[0].text}<CitationMarks marks={items[0].citations} />
		{#if items[0].detail}<span class="small muted detail">{items[0].detail}</span>{/if}
	{:else if items.length > 0}
		<ul class="items">
			{#each items as item, index (index)}
				<li>
					{#if item.href}<a href={item.href}>{item.text}</a>{:else}{item.text}{/if}<CitationMarks marks={item.citations} />
					{#if item.detail}<span class="small muted detail">{item.detail}</span>{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<span class="muted">None listed</span>
	{/if}
{/snippet}

{#if data.sources.length > 0}
	<div class="reading">
		<SourceList sources={data.sources} />
	</div>
{/if}

<style>
	.count-line {
		margin-bottom: var(--space-2);
	}

	.count {
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
	}

	.description {
		max-width: var(--layout-measure);
	}

	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.items li + li {
		margin-top: var(--space-1);
	}

	/*
	 * Each item's source marker stands apart from a sentence, beside a link, so
	 * it gets the 24 pixel target WCAG 2.2, 2.5.8 asks for, as on the contact
	 * card; each item's line is at least as tall, so links on lines one under
	 * another keep their spacing.
	 */
	.records-table :global(.note-marker) {
		display: inline-block;
		min-width: 24px;
		min-height: 24px;
		line-height: 24px;
		text-align: center;
		vertical-align: top;
	}

	.items li {
		min-height: 24px;
		line-height: 24px;
	}

	/* A long name wraps inside its own box, so its link stays one target rather than two scraps of line. */
	.items li > a {
		display: inline-block;
	}

	.detail {
		display: block;
	}
</style>
