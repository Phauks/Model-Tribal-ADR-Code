<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import BarChart from '#lib/components/BarChart.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.topic.title} · Data and charts</title>
	<meta name="description" content={data.topic.description} />
</svelte:head>

<div class="data-page">
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }, { label: 'Data and charts', href: '/nations/data' }]} />
	<h1>{data.topic.title}</h1>
	<p class="lead">{data.topic.description}</p>
	{#each data.charts as chart (chart.identifier)}
		<BarChart {chart} />
	{/each}
</div>

<style>
	.data-page {
		max-width: var(--layout-measure);
	}
</style>
