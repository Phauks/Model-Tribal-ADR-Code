<script lang="ts">
	import GlossaryEntry from '#lib/components/GlossaryEntry.svelte';
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
		{#if entry.aliases.length > 0}
			<div>
				<dt>Other forms</dt>
				<dd>{entry.aliases.join(', ')}</dd>
			</div>
		{/if}
		<div>
			<dt>On the glossary page</dt>
			<dd><a href="/glossary#{entry.id}">/glossary#{entry.id}</a></dd>
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

	<SourceList sources={data.sources} introduction="Each source below is followed by the parts of this entry that cite it." />
</div>
