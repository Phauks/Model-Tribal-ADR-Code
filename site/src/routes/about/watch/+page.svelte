<script lang="ts">
	// Source watch: what the project's watcher does on other sites and how to
	// keep it away (content/about/watch.md), edited on the website like the essays.
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	{#if data.description}<meta name="description" content={data.description} />{/if}
</svelte:head>

<EssayArticle {...data} />
