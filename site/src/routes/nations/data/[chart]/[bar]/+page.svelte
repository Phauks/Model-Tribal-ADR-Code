<!--
	The records behind one bar on Data and charts (Trevor, Nov. 23, 2026: "all
	tables should be clickable into the data to explain itself"): the nations
	or compacts the bar counts, each linked to its page or document, with the
	source of each fact cited beside it and listed under Sources.
-->
<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.bar.label} · {data.chart.title} · Model Tribal ADR Code</title>
	<meta name="description" content={data.description} />
</svelte:head>

<nav aria-label="Breadcrumb" class="small breadcrumb">
	<a href="/nations">Nations</a> › <a href="/nations/data">Data and charts</a> ›
	<a href="/nations/data#{data.chart.identifier}">{data.chart.title}</a>
</nav>

<h1>{data.bar.label}</h1>
<p class="lead count-line">
	<span class="count">{data.bar.value.toLocaleString('en-US')}</span>
	{data.bar.value === 1 ? data.rowName[0] : data.rowName[1]} in “{data.chart.title}”
</p>
<p class="description">{data.description}</p>

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
	.breadcrumb {
		margin-bottom: var(--space-2);
	}

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

	.detail {
		display: block;
	}
</style>
