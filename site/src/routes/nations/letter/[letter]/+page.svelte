<script lang="ts">
	import NationBrowse from '#lib/components/NationBrowse.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import PageTools from '#lib/components/PageTools.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const heading = $derived(
		data.letter.key === 'other' ? 'Names that start with another character' : `Names that start with ${data.letter.label}`
	);
</script>

<svelte:head>
	<title>{data.letter.label} · Nations · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › {data.letter.label}
</nav>

<h1>{heading}</h1>
<p class="small muted">{data.letter.count.toLocaleString('en-US')} {data.letter.count === 1 ? 'page' : 'pages'}</p>
<NationBrowse letters={data.letters} current={data.letter.key} />
<PageTools downloads={[{ label: 'Download the full list', format: 'CSV', link: '/nations/nations.csv' }]} />

{#each data.groups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		{#if data.groups.length > 1 || group.entityType !== 'native-nation'}
			<h2 id="group-{group.entityType}">{group.label}</h2>
		{:else}
			<h2 id="group-{group.entityType}" class="visually-hidden">{group.label}</h2>
		{/if}
		<NationTable {group} identifier="nations-{data.letter.key}-{group.entityType}" />
	</section>
{/each}

<nav class="pager no-print" aria-label="Other letters">
	{#if data.previous}<a href="/nations/letter/{data.previous.key}" rel="prev">‹ {data.previous.label}</a>{/if}
	{#if data.next}<a href="/nations/letter/{data.next.key}" rel="next">{data.next.label} ›</a>{/if}
</nav>
<p>
	<strong>Is your nation missing?</strong>
	<a href="/requests?kind=add-nation">Ask to be added</a>.
</p>

<style>
	.pager {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		margin-top: var(--space-5);
	}

	.pager a {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		font-weight: var(--font-weight-semibold);
	}

	.pager a[rel='next'] {
		margin-left: auto;
	}
</style>
