<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const opinionGroups = $derived(data.groups.filter((group) => group.slug.startsWith('opinions-')));
	const federal = $derived(data.groups.filter((group) => !group.title.startsWith('Nations’') && !group.slug.startsWith('opinions-')));
	const nationGroups = $derived(data.groups.filter((group) => group.title.startsWith('Nations’')));
</script>

<svelte:head>
	<title>Copies of documents · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Copies of documents</h1>
	<p class="lead">
		This site keeps its own copy of many documents it cites, so they open quickly and stay available if the site that published them moves or goes down. They include federal statutes and Federal Register notices, which anyone may share (17 U.S.C. § 105), Native nations’ constitutions and laws, and tribal court opinions.
	</p>
	<p>
		The address a document was published at is still the source cited. Apart from court opinions, each copy is byte for byte the file found there on the date shown, and its SHA-256 lets anyone check that: <a href="/downloads#checking">Checking a file</a>, on the Downloads page, does it in your browser. Journal articles, books and other works under copyright are not copied here.
	</p>
	<p>
		Tribal court opinions come from the Caselaw Access Project at Harvard Law School Library, which released them without restriction in 2024. Each opinion is shown as its own page made from the project’s copy, with the publisher’s headnotes removed, and links to that copy.
	</p>

	{#if data.total === 0}
		<p>No copies are listed yet.</p>
	{:else}
		<h2>Federal documents</h2>
		<ul>
			{#each federal as group (group.slug)}
				<li><a href="/copies/list/{group.slug}">{group.title}</a> ({group.count})</li>
			{/each}
		</ul>
		{#if opinionGroups.length > 0}
			<h2>Tribal court opinions</h2>
			<ul>
				{#each opinionGroups as group (group.slug)}
					<li><a href="/copies/list/{group.slug}">{group.title.replace('Tribal court opinions: ', '')}</a> ({group.count})</li>
				{/each}
			</ul>
		{/if}
		<h2>Nations’ constitutions and laws</h2>
		<ul class="letters">
			{#each nationGroups as group (group.slug)}
				<li>
					<a href="/copies/list/{group.slug}" aria-label={group.title}
						>{group.slug === 'other-nations' ? 'Other' : group.slug.toUpperCase()}</a
					>
					<span class="muted">({group.count})</span>
				</li>
			{/each}
		</ul>
		<p>
			<a href="/copies/list.csv" download>Download the full list (CSV)</a>, with each copy’s address on this site, the address it was published at, the date it was made and its SHA-256.
		</p>
	{/if}
</div>

<style>
	.letters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		list-style: none;
		padding: 0;
	}
</style>
