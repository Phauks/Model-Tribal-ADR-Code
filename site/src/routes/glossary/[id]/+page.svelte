<script lang="ts">
	import NoteList from '#lib/components/NoteList.svelte';
	import { basisLabels, statusLabels, usageLabels } from '#lib/glossary-labels.ts';
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

<article class="reading">
	<h1>
		{entry.term}
		{#if entry.expansion}<span class="expansion muted">({entry.expansion})</span>{/if}
	</h1>

	<dl class="summary-list">
		<div>
			<dt>Usage</dt>
			<dd>{usageLabels[entry.usage] ?? entry.usage}</dd>
		</div>
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
	</dl>

	<h2>Definition</h2>
	{@html data.definition}

	{#if data.usageNote}
		<h2>How the project uses it</h2>
		{@html data.usageNote}
	{/if}

	{#if data.useInstead.length > 0}
		<h2>Use instead</h2>
		<ul>
			{#each data.useInstead as other (other.id)}
				<li><a class="term-link" href="/glossary/{other.id}">{other.term}</a></li>
			{/each}
		</ul>
	{/if}

	{#if data.seeAlso.length > 0}
		<h2>See also</h2>
		<ul>
			{#each data.seeAlso as other (other.id)}
				<li><a class="term-link" href="/glossary/{other.id}">{other.term}</a></li>
			{/each}
		</ul>
	{/if}

	<p class="no-print">
		<a href="/requests?record=glossary/{entry.id}">Suggest a change to this term</a>
	</p>

	<NoteList notes={data.notes} />
</article>

<style>
	.expansion {
		display: block;
		font-size: var(--font-size-heading-3);
		font-weight: var(--font-weight-regular);
	}
</style>
