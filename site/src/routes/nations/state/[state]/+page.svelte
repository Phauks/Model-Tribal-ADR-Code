<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import NationBrowse from '#lib/components/NationBrowse.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import StateMap from '#lib/components/StateMap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.state.label} · Nations · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Nations with a presence in {data.state.label}" />

<h1>Nations with a presence in {data.state.label}</h1>
<p class="small muted">
	{data.state.count.toLocaleString('en-US')} {data.state.count === 1 ? 'page' : 'pages'}. Land areas are the Census Bureau’s 2020 outlines, not the nations’ own boundaries.
</p>
{#if data.bounds}
	<StateMap name={data.state.label} bounds={data.bounds} />
{/if}
<NationBrowse letters={data.letters} />

{#each data.groups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<h2 id="group-{group.entityType}">{group.label}</h2>
		<NationTable {group} identifier="nations-{data.state.key}-{group.entityType}" />
	</section>
{/each}
