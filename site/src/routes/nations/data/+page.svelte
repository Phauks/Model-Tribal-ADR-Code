<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Data and charts · Tribal Law Project</title>
	<meta name="description" content="Charts of Native nations’ courts, constitutions, jurisdiction, recognition, gaming compacts, treaties and cases, by topic." />
</svelte:head>

<div class="data-page">
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Data and charts" />
	<h1>Data and charts</h1>
	<p class="lead">Counts drawn from the nation pages and the documents behind them. Every bar opens the records it counts.</p>
	<ul class="topic-list">
		{#each data.topics as topic (topic.identifier)}
			<li>
				<h2><a href={topic.href}>{topic.title}</a> <CountBadge count={topic.charts.length} label="charts" /></h2>
				<p>{topic.description}</p>
				<ul class="chart-links">
					{#each topic.charts as chart (chart.href)}
						<li><a href={chart.href}>{chart.title}</a></li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>
	<div class="build">
		<h2><a href="/laws/by-decade">Federal law by decade</a></h2>
		<p>How many treaties, statutes, executive orders, regulations and other federal documents were made in each decade.</p>
	</div>
	<div class="build">
		<h2><a href="/nations/data/build">Build a table</a></h2>
		<p>Pick a data set, choose its columns, filter, group and count, and see it as a table or a chart.</p>
	</div>
</div>

<style>
	.data-page {
		max-width: var(--layout-measure);
	}

	.topic-list {
		list-style: none;
		padding: 0;
	}

	.topic-list > li {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.build {
		padding: var(--space-3) 0;
	}

	.topic-list h2,
	.build h2 {
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-heading-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.topic-list p,
	.build p {
		margin: 0 0 var(--space-1);
	}

	.chart-links {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
	}
</style>
