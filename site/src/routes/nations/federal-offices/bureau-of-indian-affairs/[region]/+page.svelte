<!--
	@component
	One regional office of the Bureau of Indian Affairs: what it is, its own
	page on bia.gov, and its agencies, each with the nations whose records name
	it and the agency's own page where it has one (Trevor, Nov. 23, 2026: each
	federal tie on a nation page opens a page about the office). Each agency's
	section has the agency's address segment as its anchor, so a nation page
	links straight to it. Which nations the region serves comes from the
	nations' own records, so References lists the sources those records cite.
	An info page (site/DESIGN.md, "Info pages").
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import type { NationIndexRow } from '#lib/server/nation-index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const name = $derived(`${data.office.name} Region`);
	const shortLink = (link: string) => link.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
	const glance = $derived([
		{ field: 'department', label: 'Department', items: [{ text: 'U.S. Department of the Interior' }] },
		{ field: 'agencies', label: 'Agencies', items: [{ text: data.agencies.length.toLocaleString('en-US') }] },
		{ field: 'nations', label: 'Nations', items: [{ text: data.count.toLocaleString('en-US') }] },
		{ field: 'official', label: 'Official page', items: [{ text: shortLink(data.office.link), link: data.office.link }] }
	]);
</script>

<svelte:head>
	<title>{name} · Bureau of Indian Affairs · Tribal Law Project</title>
</svelte:head>

{#snippet nationList(rows: NationIndexRow[])}
	<ul>
		{#each rows as row (row.id)}
			<li><a href="/nations/{row.id}">{row.name}</a>{#if row.statesText}{' '}<span class="muted small">({row.statesText})</span>{/if}</li>
		{/each}
	</ul>
{/snippet}

<InfoPage
	title="Bureau of Indian Affairs {name}"
	lead="One of the Bureau's 12 regional offices. It oversees the agencies below, which carry out the Bureau's programs for the nations listed under each."
	{glance}
	sources={data.sources}
	trail={[
		{ label: 'Nations', href: '/nations' },
		{ label: 'Federal offices', href: '/nations/federal-offices' }
	]}
>
	{#each data.agencies as agency (agency.key)}
		<Collapsible heading={agency.name} identifier={agency.key} count={agency.nations.length}>
			{#if agency.link}<p class="small">Official page: <a href={agency.link}>{shortLink(agency.link)}</a></p>{/if}
			{@render nationList(agency.nations)}
		</Collapsible>
	{/each}

	{#if data.unassigned.length > 0}
		<Collapsible heading={data.agencies.length > 0 ? 'No agency named' : 'Nations served'} identifier="no-agency" count={data.unassigned.length}>
			{@render nationList(data.unassigned)}
		</Collapsible>
	{/if}
</InfoPage>
