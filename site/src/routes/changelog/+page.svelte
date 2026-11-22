<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Changelog · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Changelog</h1>
	<p class="lead">
		The content, the website and the print edition each have their own version number, starting at
		0.0.1. Each version below lists what changed.
	</p>

	<nav aria-label="Changelogs on this page">
		<ul>
			{#each data.tracks as track (track.id)}
				<li><a href="#{track.id}">{track.title}</a></li>
			{/each}
		</ul>
	</nav>

	{#each data.tracks as track (track.id)}
		<section aria-labelledby={track.id}>
			<h2 id={track.id}>{track.title}</h2>
			{@html track.html}
		</section>
	{/each}
</div>
