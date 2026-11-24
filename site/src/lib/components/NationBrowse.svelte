<!--
	@component
	The ways to browse the Native nations index: one link per first letter,
	with the letters that start no name shown as plain text, and a link to the
	table of every nation. The current letter is marked with aria-current.
-->
<script lang="ts">
	import type { BrowseLink } from '#lib/server/nation-index.ts';

	let { letters, current }: { letters: BrowseLink[]; current?: string } = $props();
</script>

<nav class="nation-browse no-print" aria-label="Nations by first letter">
	<ul class="letters">
		{#each letters as letter (letter.key)}
			<li>
				{#if letter.count > 0}
					<a
						href="/nations/letter/{letter.key}"
						aria-current={current === letter.key ? 'page' : undefined}
						title="{letter.count.toLocaleString('en-US')} {letter.count === 1 ? 'page' : 'pages'}"
						>{letter.label}</a
					>
				{:else}
					<span class="muted" title="No names start with {letter.label}">{letter.label}</span>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="small"><a href="/nations">All Native nations</a> · <a href="/nations/map">See the map</a></p>
</nav>

<style>
	.letters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
	}

	.letters a,
	.letters span {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.letters a:hover {
		text-decoration: underline;
	}

	.letters span {
		border-style: dashed;
		font-weight: var(--font-weight-regular);
	}

	.letters a[aria-current='page'] {
		background: var(--color-band);
		border-color: var(--color-band);
		color: var(--color-band-text);
	}
</style>
