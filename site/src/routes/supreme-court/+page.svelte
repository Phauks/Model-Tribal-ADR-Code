<!--
	@component
	The Courts of the Supreme Court of the United States that decided a case
	this site cites, each named for its Chief Justice, oldest first.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Supreme Court · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} />

<div class="reading">
	<h1>Supreme Court of the United States</h1>
	<ul class="court-list">
		{#each data.courts as court (court.key)}
			<li>
				<a href="/supreme-court/{court.key}">{court.name}</a>
				<span class="muted">{court.years}</span>
				<CountBadge count={court.cases} label={court.cases === 1 ? 'case' : 'cases'} />
			</li>
		{/each}
	</ul>
</div>

<style>
	.court-list {
		padding: 0;
		list-style: none;
	}

	.court-list li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
</style>
