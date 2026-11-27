<!--
	@component
	One Area of the Indian Health Service: what it is, its own page on ihs.gov,
	the nations whose records name it, and its service units and health
	programs (Trevor, Nov. 23, 2026: "Indian Health Service: California Area"
	on a nation page opens a page about the program). Which nations the Area
	serves comes from the nations' own records, so References lists the
	sources those records cite. An info page (site/DESIGN.md, "Info pages").
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const name = $derived(`${data.office.name} Area`);
	const glance = $derived(
		[
			{ field: 'department', label: 'Department', items: [{ text: 'U.S. Department of Health and Human Services' }] },
			{ field: 'nations', label: 'Nations', items: [{ text: data.count.toLocaleString('en-US') }] },
			{ field: 'units', label: 'Service units', items: data.serviceUnits.length > 0 ? [{ text: data.serviceUnits.length.toLocaleString('en-US') }] : [] },
			{
				field: 'official',
				label: 'Official page',
				items: [{ text: data.office.link.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''), link: data.office.link }]
			}
		].filter((group) => group.items.length > 0)
	);
</script>

<svelte:head>
	<title>{name} · Indian Health Service · Tribal Law Project</title>
</svelte:head>

<InfoPage
	title="Indian Health Service {name}"
	lead="One of the Indian Health Service's 12 Areas. It oversees the service units and health programs in its region, some run by the Indian Health Service and some by the nations or Tribal organizations themselves."
	{glance}
	sources={data.sources}
	trail={[
		{ label: 'Nations', href: '/nations' },
		{ label: 'Federal offices', href: '/nations/federal-offices' }
	]}
>
	{#if data.serviceUnits.length > 0}
		<Collapsible heading="Service units and health programs" identifier="service-units" count={data.serviceUnits.length}>
			<ul>
				{#each data.serviceUnits as unit (unit.name)}
					<li>
						{unit.name}:
						{#each unit.nations as nation, index (nation.id)}{index > 0 ? '; ' : ''}<a href="/nations/{nation.id}">{nation.name}</a>{#if nation.runBy}{' '}<span class="muted">({nation.runBy})</span>{/if}{/each}
					</li>
				{/each}
			</ul>
		</Collapsible>
	{/if}

	<Collapsible heading="Nations served" identifier="nations-served" count={data.count} class="past-glance">
		{#each data.groups as group (group.entityType)}
			<NationTable {group} identifier="health-area-{data.office.key}-{group.entityType}" headingLevel={3} />
		{/each}
	</Collapsible>
</InfoPage>

<style>
	/* The table of nations is wide, so it starts under Key facts rather than squeezed beside it; the service units, a list, run beside it. */
	:global(.collapsible.past-glance) {
		clear: both;
	}
</style>
