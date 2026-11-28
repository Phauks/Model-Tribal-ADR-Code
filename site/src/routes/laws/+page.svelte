<script lang="ts">
	// The Federal law section's own page (Home A in picture cards, Trevor, Nov. 27, 2026, mockup home-A2): a card for each group of its menu, by who made the law, then how many documents each made in each decade.
	import ColumnChart from '#lib/components/ColumnChart.svelte';
	import SectionCards, { sectionCardsOf } from '#lib/components/SectionCards.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'federal-law')!;
	const cards = $derived(
		sectionCardsOf(section, data.counts).map((card) => {
			const years = data.home.groupYears[card.title];
			return { ...card, line: years ? `${card.line}, ${years}.` : `${card.line}.` };
		})
	);
</script>

<svelte:head>
	<title>Federal law · Tribal Law Project</title>
	<meta name="description" content="The United States’ treaties, statutes, the U.S. Code’s Title 25, executive orders, regulations, Federal Register notices and agency records about Native nations." />
</svelte:head>

<div class="federal-home">
	<h1>{section.title}</h1>
	<p class="lead">What the United States has made about Native nations{data.home.years ? `, ${data.home.years},` : ''} by who made it.</p>
	<SectionCards {cards} swatches>
		{#snippet footer()}
			<ColumnChart chart={data.home.chart} />
		{/snippet}
	</SectionCards>
</div>

<style>
	.federal-home h1 {
		margin-bottom: var(--space-1);
	}

	.lead {
		margin: 0 0 var(--space-5);
		color: var(--color-ink-muted);
		font-size: 1.05rem;
	}
</style>
