<script lang="ts">
	import GlossaryEntry from '#lib/components/GlossaryEntry.svelte';
	import PageTools from '#lib/components/PageTools.svelte';
	import ReportLink from '#lib/components/ReportLink.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import { basisLabels, statusLabels } from '#lib/glossary-labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const entry = $derived(data.entry);
</script>

<svelte:head>
	<title>{entry.term} · Glossary · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/glossary">Glossary</a> › {entry.term}
</nav>

<div class="reading">
	<GlossaryEntry {entry} headingLevel={1}>
		<ReportLink record="glossary/{entry.id}" />
		<PageTools />
	</GlossaryEntry>

	<h2>About this entry</h2>
	<dl class="summary-list">
		{#if entry.basis}
			<div>
				<dt>Basis</dt>
				<dd>{basisLabels[entry.basis] ?? entry.basis}</dd>
			</div>
		{/if}
		<div>
			<dt>Status</dt>
			<dd>{statusLabels[entry.status] ?? entry.status}</dd>
		</div>
		<div>
			<dt>In the glossary</dt>
			<dd><a href="/glossary#{entry.id}">See {entry.term} among all the terms</a></dd>
		</div>
	</dl>

	{#if data.linkedFrom.length > 0}
		<h2>Other entries that use this term</h2>
		<ul>
			{#each data.linkedFrom as other (other.id)}
				<li><a class="term-link" href="/glossary/{other.id}">{other.term}</a></li>
			{/each}
		</ul>
	{/if}

	<nav class="nearby" aria-labelledby="nearby-heading">
		<h2 id="nearby-heading">Entries near {entry.term}</h2>
		<ol>
			{#each data.nearby.before as other (other.id)}
				<li><a href="/glossary/{other.id}">{other.term}</a></li>
			{/each}
			<li aria-current="page"><b>{entry.term}</b></li>
			{#each data.nearby.after as other (other.id)}
				<li><a href="/glossary/{other.id}">{other.term}</a></li>
			{/each}
		</ol>
	</nav>

	<SourceList sources={data.sources} introduction="Each source below is followed by the parts of this entry that cite it." />
</div>

<style>
	.nearby ol {
		list-style: none;
		margin: 0 0 var(--space-5);
		padding: 0;
		border-left: 2px solid var(--color-line);
	}

	.nearby li {
		padding: var(--space-1) var(--space-4);
	}

	.nearby li[aria-current='page'] {
		margin-left: -2px;
		border-left: 2px solid var(--color-track-alternative-dispute-resolution);
	}
</style>
