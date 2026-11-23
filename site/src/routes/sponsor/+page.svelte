<script lang="ts">
	// The Sponsorship page: an invitation for organizations to help pay for the
	// work (Trevor, Nov. 23, 2026), edited on the website like the essays
	// (content/about/sponsor.md). Below it, the sponsors who chose to be
	// listed (docs/sponsorship.md). Amounts are never shown.
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import SponsorCard from '#lib/components/SponsorCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { sponsors, giftsOpen, ...article } = $derived(data);
</script>

<svelte:head>
	{#if data.description}<meta name="description" content={data.description} />{/if}
</svelte:head>

<EssayArticle {...article} />

{#if sponsors.length > 0 || giftsOpen}
	<section class="reading sponsors" aria-labelledby="sponsors-heading">
		{#if sponsors.length > 0}
			<h2 id="sponsors-heading">Thank you to our sponsors</h2>
			<div class="grid">
				{#each sponsors as sponsor, index (sponsor.slug ?? `anonymous-${index}`)}
					<SponsorCard {sponsor} />
				{/each}
			</div>
		{/if}
		{#if giftsOpen}
			{#if sponsors.length === 0}<h2 id="sponsors-heading">Become a sponsor</h2>{/if}
			<p><a class="button button-quiet" href="/account/sponsorship">Become a sponsor, or manage your sponsorship</a></p>
		{/if}
	</section>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: var(--space-4);
		margin: 0 0 var(--space-5);
	}
</style>
