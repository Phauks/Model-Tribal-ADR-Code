<!--
	@component
	The federal self-governance, self-determination and block grant programs
	that nation pages list, each with how many nations take part as far as the
	project's lists show (Trevor, Nov. 26, 2026: each program on a nation page
	opens a page about it). The self-governance compacts come first, as in
	each nation's At a glance.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const selfGovernance = $derived(data.programs.filter((entry) => entry.program.glance));
	const others = $derived(data.programs.filter((entry) => !entry.program.glance));
</script>

<svelte:head>
	<title>Self-governance and federal programs · Nations · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />

<h1>Self-governance and federal programs</h1>

{#each [{ id: 'self-governance', heading: 'Self-governance compacts', list: selfGovernance }, { id: 'other-programs', heading: 'Self-determination and block grant programs', list: others }] as part (part.id)}
	<section aria-labelledby={part.id}>
		<h2 id={part.id}>{part.heading}</h2>
		<ul class="program-list">
			{#each part.list as entry (entry.program.key)}
				<li>
					<a href="/nations/federal-programs/{entry.program.key}">{entry.program.title}</a>
					<CountBadge count={entry.count} label={entry.count === 1 ? 'nation' : 'nations'} />
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	.program-list {
		columns: var(--layout-card-min) auto;
		column-gap: var(--space-5);
		list-style: none;
		padding: 0;
	}

	.program-list li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		break-inside: avoid;
	}

	.program-list a {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
	}
</style>
