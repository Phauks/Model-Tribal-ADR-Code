<!--
	@component
	One regional office of the Bureau of Indian Affairs: what it is, its own
	page on bia.gov, and its agencies, each with the nations whose records name
	it and the agency's own page where it has one (Trevor, Nov. 23, 2026: each
	federal tie on a nation page opens a page about the office). Each agency's
	section has the agency's address segment as its anchor, so a nation page
	links straight to it. Which nations the region serves comes from the
	nations' own records, so the Sources list is the sources those records
	cite.
-->
<script lang="ts">
	import type { NationIndexRow } from '#lib/server/nation-index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const name = $derived(`${data.office.name} Region`);
</script>

<svelte:head>
	<title>{name} · Bureau of Indian Affairs · Model Tribal ADR Code</title>
</svelte:head>

{#snippet nationList(rows: NationIndexRow[])}
	<ul>
		{#each rows as row (row.id)}
			<li><a href="/nations/{row.id}">{row.name}</a>{#if row.statesText}{' '}<span class="muted small">({row.statesText})</span>{/if}</li>
		{/each}
	</ul>
{/snippet}

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › <a href="/nations/federal-offices">Federal offices</a> › {name}
</nav>

<div class="reading">
	<h1>Bureau of Indian Affairs {name}</h1>
	<p>
		The Bureau of Indian Affairs, part of the U.S. Department of the Interior, works with federally recognized nations through 12 regional offices. The {name} office oversees the agencies below, which carry out the Bureau's programs for the nations listed under each.
	</p>
	<p>Official page: <a href={data.office.link}>{data.office.link.replace(/^https:\/\/(www\.)?/, '')}</a></p>
	<p class="small muted">{data.count.toLocaleString('en-US')} {data.count === 1 ? 'page names' : 'pages name'} this region.</p>

	{#each data.agencies as agency (agency.key)}
		<section aria-labelledby={agency.key}>
			<h2 id={agency.key}>{agency.name}</h2>
			{#if agency.link}<p class="small">Official page: <a href={agency.link}>{agency.link.replace(/^https:\/\/(www\.)?/, '')}</a></p>{/if}
			{@render nationList(agency.nations)}
		</section>
	{/each}

	{#if data.unassigned.length > 0}
		<section aria-labelledby="no-agency">
			<h2 id="no-agency">{data.agencies.length > 0 ? 'No agency named' : 'Nations served'}</h2>
			{@render nationList(data.unassigned)}
		</section>
	{/if}

	{#if data.sources.length > 0}
		<section aria-labelledby="sources">
			<h2 id="sources">Sources</h2>
			<ol class="small sources">
				{#each data.sources as source (source.title)}
					<li>{#if source.link}<a href={source.link}>{source.title}</a>{:else}{source.title}{/if}</li>
				{/each}
			</ol>
		</section>
	{/if}
</div>

<style>
	/* Each source is a link on its own line in small type; the space between them keeps each a 24 pixel target (WCAG 2.2, 2.5.8) however its title wraps. */
	.sources > li + li {
		margin-top: var(--space-2);
	}
</style>
