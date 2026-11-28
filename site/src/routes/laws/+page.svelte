<script lang="ts">
	// The Federal law section's own page (Home A in picture cards, Trevor, Nov. 27, 2026, mockup home-A2): a card for each group of its menu, by who made the law, each with its years. The decade chart is a page of its own, /laws/by-decade, since a section's home is for finding the way only (Trevor, Nov. 28, 2026).
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { sectionCardsOf } from '#lib/components/SectionCards.svelte';
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

<SectionHome {section} {cards} lead="What the United States has made about Native nations{data.home.years ? `, ${data.home.years},` : ''} by who made it." />
