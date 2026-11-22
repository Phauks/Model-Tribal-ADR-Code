<script lang="ts">
	import GlossaryEntry from '#lib/components/GlossaryEntry.svelte';
	import PageTools from '#lib/components/PageTools.svelte';
	import ReportLink from '#lib/components/ReportLink.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
	const lettersWithEntries = $derived(new Set(data.groups.map((group) => group.letter)));
</script>

<svelte:head>
	<title>Glossary · Model Tribal ADR Code</title>
	<meta
		name="description"
		content="Terms the Model Tribal ADR Code defines, how it uses them, and what to write instead."
	/>
</svelte:head>

<div class="reading">
	<h1>Glossary</h1>
	<ReportLink record="glossary" />
	<PageTools downloads={[{ label: 'Download every term', format: 'JSON', link: '/glossary/terms.json' }]} />
	<p class="lead">
		The {data.count} words the project defines, how it uses them, and what to write instead where a
		word is best avoided. Each entry cites its sources, listed together at the end of the page, or says
		it is the project’s own choice.
	</p>
</div>

<nav aria-label="Glossary letters" class="letters no-print">
	<ul>
		{#each alphabet as letter (letter)}
			<li>
				{#if lettersWithEntries.has(letter)}
					<a href="#letter-{letter}">{letter}</a>
				{:else}
					<span class="muted" aria-hidden="true">{letter}</span>
				{/if}
			</li>
		{/each}
	</ul>
</nav>

<div class="reading">
	{#each data.groups as group (group.letter)}
		<section aria-labelledby="letter-{group.letter}" class="letter-group">
			<h2 id="letter-{group.letter}">{group.letter}</h2>
			{#each group.items as entry (entry.id)}
				<GlossaryEntry {entry} headingLevel={3} onGlossaryPage />
			{/each}
		</section>
	{/each}

	<SourceList sources={data.sources} introduction="Each source below is followed by the entries on this page that cite it." />
</div>

<style>
	.letters ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		list-style: none;
		padding: 0;
	}

	.letters a,
	.letters span {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		font-weight: var(--font-weight-semibold);
	}

	.letter-group {
		scroll-margin-top: var(--space-6);
	}

	.letter-group :global(.glossary-entry) {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--color-line);
	}

	.letter-group :global(.glossary-entry:last-child) {
		border-bottom: none;
	}
</style>
