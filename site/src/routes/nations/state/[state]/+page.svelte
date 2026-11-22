<script lang="ts">
	import NationBrowse from '#lib/components/NationBrowse.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import PageTools from '#lib/components/PageTools.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.state.label} · Nations · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › <a href="/nations#by-state">By state</a> › {data.state.label}
</nav>

<h1>Nations with a presence in {data.state.label}</h1>
<p class="small muted">
	{data.state.count.toLocaleString('en-US')} {data.state.count === 1 ? 'page' : 'pages'}. The map shows presence in a state, not boundaries.
</p>
<NationBrowse letters={data.letters} />
<PageTools downloads={[{ label: 'Download the full list', format: 'CSV', link: '/nations/nations.csv' }]} />

{#each data.groups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<h2 id="group-{group.entityType}">{group.label}</h2>
		<NationTable {group} identifier="nations-{data.state.key}-{group.entityType}" />
	</section>
{/each}

<p>
	<strong>Is your nation missing?</strong>
	<a href="/requests?kind=add-nation">Ask to be added</a>.
</p>
