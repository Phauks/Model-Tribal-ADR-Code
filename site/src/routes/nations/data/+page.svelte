<script lang="ts">
	import BarChart from '#lib/components/BarChart.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Data and charts · Model Tribal ADR Code</title>
	<meta
		name="description"
		content="Counts of dispute resolution provisions, courts, constitutions and gaming compact dispute clauses across Native nations."
	/>
</svelte:head>

<div class="data-page">
	<nav aria-label="Breadcrumb" class="small breadcrumb"><a href="/nations">Nations</a> › Data and charts</nav>
	<h1>Data and charts</h1>
	<p class="lead">
		Counts drawn from the nation pages and the laws behind them. Pick any bar to see what it counts: a bar about provisions opens them in <a href="/nations/recourse">Find recourse</a>, and every other bar opens the nations or compacts behind it, each with its source. The buttons at a chart’s top right show it as a table to sort and download.
	</p>
	{#each data.charts as chart (chart.identifier)}
		<BarChart {chart} />
	{/each}
</div>

<style>
	.breadcrumb {
		margin-bottom: var(--space-2);
	}

	.data-page {
		max-width: var(--layout-measure);
	}
</style>
