<script lang="ts">
	// Using AI with Tribal Law: how readers can use AI tools safely (Trevor,
	// Nov. 23, 2026), edited on the website like the essays (content/about/using-ai.md).
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	{#if data.description}<meta name="description" content={data.description} />{/if}
</svelte:head>

<EssayArticle {...data} />
