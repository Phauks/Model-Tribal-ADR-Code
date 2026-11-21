<script lang="ts">
	import { usageLabels } from '#lib/glossary-labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
	const lettersWithEntries = $derived(new Set(data.groups.map((group) => group.letter)));
</script>

<svelte:head>
	<title>Glossary · Model Tribal ADR Code</title>
	<meta name="description" content="Terms the Model Tribal ADR Code defines, with when to use them." />
</svelte:head>

<div class="reading">
	<h1>Glossary</h1>
	<p class="lead">
		Words the project defines, how it uses them, and what to write instead where a word is best
		avoided. Each entry cites its sources or says it is the project’s own choice.
	</p>
</div>

<nav aria-label="Glossary letters" class="letters">
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

{#each data.groups as group (group.letter)}
	<section aria-labelledby="letter-{group.letter}">
		<h2 id="letter-{group.letter}">{group.letter}</h2>
		<ul class="entries">
			{#each group.items as entry (entry.id)}
				<li>
					<a href="/glossary/{entry.id}">{entry.term}</a>
					{#if entry.expansion}<span class="muted">({entry.expansion})</span>{/if}
					<span class="chip">{usageLabels[entry.usage] ?? entry.usage}</span>
				</li>
			{/each}
		</ul>
	</section>
{/each}

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

	.entries {
		list-style: none;
		padding: 0;
	}

	.entries li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
</style>
