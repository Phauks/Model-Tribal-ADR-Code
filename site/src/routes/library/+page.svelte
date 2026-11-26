<script lang="ts">
	// The Library section's own page (docs/outline.md, "The website"): the pages it
	// gathers, each at its own address (src/lib/library-pages.ts).
	import { libraryPages } from '#lib/library-pages.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const numbers = new Intl.NumberFormat('en-US');
	const copiesNote = $derived(
		[
			`${numbers.format(data.copies.federal)} United States documents`,
			`${numbers.format(data.copies.nations)} nations’ documents`,
			`${numbers.format(data.copies.opinions)} tribal court opinions`
		].join(', ')
	);
</script>

<svelte:head>
	<title>Library · Tribal Law Project</title>
	<meta
		name="description"
		content="The documents behind the model code: copies of the laws, constitutions and court opinions it cites, data and map files to download, and a way to check a downloaded file."
	/>
</svelte:head>

<div class="reading">
	<h1>Library</h1>
	<p class="lead">
		The documents behind the model code, and the files you can take away from this site. A nation’s own sources are listed on its page.
	</p>

	<ul class="library-list">
		{#each libraryPages as libraryPage (libraryPage.link)}
			<li>
				<h2><a href={libraryPage.link}>{libraryPage.label}</a></h2>
				<p>{libraryPage.description}</p>
				{#if libraryPage.link === '/copies'}
					<p class="small muted">{copiesNote}.</p>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.library-list {
		list-style: none;
		padding: 0;
	}

	.library-list li {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.library-list h2 {
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-heading-3);
	}

	.library-list p {
		margin: 0 0 var(--space-1);
	}
</style>
