<script lang="ts">
	// The list of published essays in one part of the work (Foundations or Essays).
	let {
		section,
		lead,
		essays
	}: {
		section: string;
		lead: string;
		essays: { identifier: string; title: string; link: string; publishedAtText: string }[];
	} = $props();
</script>

<svelte:head>
	<title>{section} · Model Tribal ADR Code</title>
	<meta name="description" content={lead} />
</svelte:head>

<div class="reading">
	<h1>{section}</h1>
	<p class="lead">{lead}</p>
	{#if essays.length === 0}
		<p>Nothing is published here yet.</p>
	{:else}
		<ul class="essay-list">
			{#each essays as essay (essay.identifier)}
				<li>
					<a href={essay.link}>{essay.title}</a>
					<span class="small muted">Published {essay.publishedAtText}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
