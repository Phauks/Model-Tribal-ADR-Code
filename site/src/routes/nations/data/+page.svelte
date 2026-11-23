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
	<!-- Title and a one-line lead as the approved mockup has them (design/data-views, Trevor chose it Nov. 23, 2026); the sidebar and breadcrumb keep the page's short name. -->
	<h1>Dispute resolution in tribal law</h1>
	<p class="lead">Counts from Native nations’ own laws, courts, constitutions and gaming compacts. Pick a bar to list what it counts.</p>
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
