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
		Counts drawn from the nation pages and the laws behind them. Pick a bar about provisions to read them in <a href="/nations/recourse">Find recourse</a>, or open any chart as a table to sort it and download it.
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
		max-width: 60rem;
	}
</style>
