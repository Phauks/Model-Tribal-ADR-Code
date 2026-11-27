<script lang="ts">
	import type { Snippet } from 'svelte';
	// Coverage (improvements report, Nov. 24, 2026, idea 6): which sections of
	// each nation's page say None Identified, so contributors and nations can
	// see where help is needed. Each bar opens the table filtered to the
	// nations missing that section.
	import Check from '@lucide/svelte/icons/check';
	import BarChart from '#lib/components/BarChart.svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Coverage · Nations</title>
	<meta name="description" content="Which sections of each nation’s page say None Identified." />
</svelte:head>

<div class="coverage-page">
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Coverage" />
	<h1>Coverage</h1>
	<p class="lead">Which sections of each nation’s page say None Identified. <a href="/requests?kind=contribute">Contribute</a></p>
	<BarChart chart={data.chart} />
	<DataTable
		identifier="coverage"
		label="Table: coverage of each nation’s page"
		columns={data.columns}
		rows={data.rows}
		defaultSort={{ key: 'name', direction: 'ascending' }}
		searchLabel="Search nations"
		rowName={['nation', 'nations']}
		filters
		shareable
		download="coverage"
	>
		{#snippet heading(count: Snippet)}<h2 id="coverage-table">Nations {@render count()}</h2>{/snippet}
		{#snippet cell(row, column)}
			{@const text = row.cells[column.key]?.text}
			{#if text === 'Found'}
				<span class="found"><Check size={18} aria-hidden="true" /><span class="visually-hidden">Found</span></span>
			{:else}
				<span class="none">{text}</span>
			{/if}
		{/snippet}
	</DataTable>
</div>

<style>
	.found {
		display: inline-flex;
		color: var(--color-ink-muted);
	}

	.none {
		color: var(--color-ink);
		white-space: nowrap;
	}
</style>
