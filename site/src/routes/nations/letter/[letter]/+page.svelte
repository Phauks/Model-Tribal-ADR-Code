<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import NationBrowse from '#lib/components/NationBrowse.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const heading = $derived(
		data.letter.key === 'other' ? 'Names that start with another character' : `Names that start with ${data.letter.label}`
	);
</script>

<svelte:head>
	<title>{data.letter.label} · Nations · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current={heading} />

<h1>{heading}</h1>
<p class="small muted">{data.letter.count.toLocaleString('en-US')} {data.letter.count === 1 ? 'page' : 'pages'}</p>
<NationBrowse letters={data.letters} current={data.letter.key} />

{#each data.groups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<NationTable {group} identifier="nations-{data.letter.key}-{group.entityType}" headingLevel={2} headingIdentifier="group-{group.entityType}" />
	</section>
{/each}

<nav class="pager no-print" aria-label="Other letters">
	{#if data.previous}<a href="/nations/letter/{data.previous.key}" rel="prev">‹ {data.previous.label}</a>{/if}
	{#if data.next}<a href="/nations/letter/{data.next.key}" rel="next">{data.next.label} ›</a>{/if}
</nav>

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
