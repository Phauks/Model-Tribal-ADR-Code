<script lang="ts">
	import CountBadge from '#lib/components/CountBadge.svelte';
	import NationBrowse from '#lib/components/NationBrowse.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Nations · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Native nations</h1>
	{#if data.example}
		<div class="notice" role="note">
			<p>The nation records are not published yet. The page below is a fictitious example that shows the layout.</p>
		</div>
	{/if}
</div>


<section aria-labelledby="by-letter">
	<h2 id="by-letter">Native nations by first letter</h2>
	<p class="small muted">{data.nationCount.toLocaleString('en-US')} pages, listed by the official name their sources give.</p>
	<NationBrowse letters={data.letters} />
</section>

<section aria-labelledby="by-state">
	<h2 id="by-state">By state</h2>
	<p class="small muted">A nation with a presence in more than one state is listed under each.</p>
	<ul class="state-list">
		{#each data.states as state (state.key)}
			<li>
				<a href="/nations/state/{state.key}">{state.label}</a>
				<CountBadge count={state.count} label={state.count === 1 ? 'nation' : 'nations'} />
			</li>
		{/each}
	</ul>
</section>

{#each data.otherGroups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<h2 id="group-{group.entityType}">{group.label}</h2>
		<NationTable {group} identifier="nations-{group.entityType}" />
	</section>
{/each}

<style>
	.state-list {
		columns: var(--layout-card-min) auto;
		column-gap: var(--space-5);
		list-style: none;
		padding: 0;
	}

	.state-list li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		break-inside: avoid;
	}

	.state-list a {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
	}
</style>
