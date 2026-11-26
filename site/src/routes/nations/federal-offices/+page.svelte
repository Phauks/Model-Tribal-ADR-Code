<!--
	@component
	The federal offices that serve Native nations: the 12 Areas of the Indian
	Health Service and the 12 regions of the Bureau of Indian Affairs, each with
	how many nation pages name it (Trevor, Nov. 23, 2026: each federal tie on a
	nation page opens a page about the office).
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Federal offices · Nations · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />

<h1>Federal offices that serve Native nations</h1>

<section aria-labelledby="indian-health-service">
	<h2 id="indian-health-service">Indian Health Service Areas</h2>
	<ul class="office-list">
		{#each data.areas as area (area.key)}
			<li>
				<a href="/nations/federal-offices/indian-health-service/{area.key}">{area.name} Area</a>
				<CountBadge count={area.count} label={area.count === 1 ? 'nation' : 'nations'} />
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="bureau-of-indian-affairs">
	<h2 id="bureau-of-indian-affairs">Bureau of Indian Affairs regions</h2>
	<ul class="office-list">
		{#each data.regions as region (region.key)}
			<li>
				<a href="/nations/federal-offices/bureau-of-indian-affairs/{region.key}">{region.name} Region</a>
				<CountBadge count={region.count} label={region.count === 1 ? 'nation' : 'nations'} />
			</li>
		{/each}
	</ul>
</section>

<style>
	.office-list {
		columns: var(--layout-card-min) auto;
		column-gap: var(--space-5);
		list-style: none;
		padding: 0;
	}

	.office-list li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		break-inside: avoid;
	}

	.office-list a {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
	}
</style>
