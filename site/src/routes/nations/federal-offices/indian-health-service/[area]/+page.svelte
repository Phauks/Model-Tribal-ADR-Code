<!--
	@component
	One Area of the Indian Health Service: what it is, its own page on ihs.gov,
	the nations whose records name it, and its service units and health
	programs (Trevor, Nov. 23, 2026: "Indian Health Service: California Area"
	on a nation page opens a page about the program). Which nations the Area
	serves comes from the nations' own records, so the Sources list is the
	sources those records cite.
-->
<script lang="ts">
	import NationTable from '#lib/components/NationTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const name = $derived(`${data.office.name} Area`);
</script>

<svelte:head>
	<title>{name} · Indian Health Service · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › <a href="/nations/federal-offices">Federal offices</a> › {name}
</nav>

<div class="reading">
	<h1>Indian Health Service {name}</h1>
	<p>
		The Indian Health Service, part of the U.S. Department of Health and Human Services, provides health care to American Indians and Alaska Natives through 12 Areas. The {name} office oversees the service units and health programs in its region, some run by the Indian Health Service and some by the nations or Tribal organizations themselves.
	</p>
	<p>Official page: <a href={data.office.link}>{data.office.link.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></p>
</div>

<section aria-labelledby="nations-served">
	<h2 id="nations-served">Nations served</h2>
	<p class="small muted">{data.count.toLocaleString('en-US')} {data.count === 1 ? 'page names' : 'pages name'} this Area.</p>
	{#each data.groups as group (group.entityType)}
		{#if data.groups.length > 1}<h3>{group.label}</h3>{/if}
		<NationTable {group} identifier="health-area-{data.office.key}-{group.entityType}" />
	{/each}
</section>

{#if data.serviceUnits.length > 0}
	<section aria-labelledby="service-units" class="reading">
		<h2 id="service-units">Service units and health programs</h2>
		<ul>
			{#each data.serviceUnits as unit (unit.name)}
				<li>
					{unit.name}:
					{#each unit.nations as nation, index (nation.id)}{index > 0 ? '; ' : ''}<a href="/nations/{nation.id}">{nation.name}</a>{#if nation.runBy}{' '}<span class="muted">({nation.runBy})</span>{/if}{/each}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.sources.length > 0}
	<section aria-labelledby="sources" class="reading">
		<h2 id="sources">Sources</h2>
		<ol class="small">
			{#each data.sources as source (source.title)}
				<li>{#if source.link}<a href={source.link}>{source.title}</a>{:else}{source.title}{/if}</li>
			{/each}
		</ol>
	</section>
{/if}
