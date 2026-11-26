<!--
	Where one chart's numbers on Data and charts come from (Trevor, Nov. 23,
	2026: "clicking source should link to source"): how the numbers were
	gathered, the documents read when they are the source themselves, and
	every source the chart's records cite, grouped by bar.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { dataChartTrail } from '#lib/data-chart-list.ts';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Sources · {data.chart.title} · Tribal Law Project</title>
	<meta name="description" content={data.source} />
</svelte:head>

<Breadcrumbs trail={dataChartTrail(data.chart)} />

<h1>Sources: {data.chart.title}</h1>
<p class="lead">{data.source}</p>

<h2>What each line counts</h2>
<ul class="bars">
	{#each data.bars as bar (bar.label)}
		<li>{#if bar.href}<a href={bar.href}>{bar.label}</a>{:else}{bar.label}{/if} <span class="muted">({bar.value.toLocaleString('en-US')})</span></li>
	{/each}
</ul>

{#if data.documents.length > 0}
	<h2>Documents read</h2>
	<ol class="documents">
		{#each data.documents as document, index (index)}
			<li>
				{#if document.href}<a href={document.href}>{document.text}</a>{:else}{document.text}{/if}
				{#if document.detail}<span class="small muted">, {document.detail}</span>{/if}
			</li>
		{/each}
	</ol>
{/if}

{#if data.sources.length > 0}
	<div class="reading">
		<SourceList sources={data.sources} />
	</div>
{/if}

<style>
	.bars,
	.documents {
		max-width: var(--layout-measure);
	}

	.bars li,
	.documents li {
		margin-bottom: var(--space-1);
	}
</style>
