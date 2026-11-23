<script lang="ts">
	// The Sponsorship page: an invitation for organizations to help pay for the
	// work (Trevor, Nov. 23, 2026). It names no tiers, prices or payments yet,
	// and is edited on the website like the essays (content/about/sponsor.md).
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	{#if data.description}<meta name="description" content={data.description} />{/if}
</svelte:head>

<EssayArticle {...data} />
