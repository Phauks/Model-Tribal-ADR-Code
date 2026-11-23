<script lang="ts">
	import GlossaryEntry from '#lib/components/GlossaryEntry.svelte';
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
	<GlossaryEntry {entry} headingLevel={1} />

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

	<SourceList sources={data.sources} />
</div>

