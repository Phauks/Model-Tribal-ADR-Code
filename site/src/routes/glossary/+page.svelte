<script lang="ts">
	import GlossaryEntry from '#lib/components/GlossaryEntry.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
	const lettersWithEntries = $derived(new Set(data.groups.map((group) => group.letter)));
</script>

<svelte:head>
	<title>Glossary · Tribal Law Project</title>
	<meta
		name="description"
		content="Terms the Model Tribal ADR Code defines, how it uses them, and what to write instead."
	/>
</svelte:head>

<div class="reading">
	<h1>Glossary</h1>
	<p class="lead">
		The words defined here, how they are used, and what to write instead where a
		word is best avoided. Each entry cites its sources, listed together at the end of the page, or says
		it is our own choice.
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

	<SourceList sources={data.sources} />
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

	.letter-group > h2 {
		margin-bottom: var(--space-2);
		padding-bottom: var(--space-1);
		font-size: var(--font-size-display);
		color: var(--color-link);
		border-bottom: 3px solid var(--color-link);
	}

	.letter-group :global(.glossary-entry) {
		padding: var(--space-3) 0 var(--space-5);
		border-bottom: 1px solid var(--color-line);
	}

	.letter-group :global(.glossary-entry:last-child) {
		border-bottom: none;
	}
</style>
