<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import ColumnChart from '#lib/components/ColumnChart.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Federal law by decade · Tribal Law Project</title>
	<meta name="description" content="How many treaties, statutes, executive orders, regulations and other federal documents about Native nations were made in each decade." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Federal law', href: '/laws' }]} current="By decade" />
<h1>Federal law by decade</h1>
<p class="lead">What the United States made about Native nations{data.home.years ? `, ${data.home.years},` : ''} in each decade, by who made it.</p>
<ColumnChart chart={data.home.chart} />

<style>
	h1 {
		margin-bottom: var(--space-1);
	}

	.lead {
		margin: 0 0 var(--space-5);
		color: var(--color-ink-muted);
	}
</style>
