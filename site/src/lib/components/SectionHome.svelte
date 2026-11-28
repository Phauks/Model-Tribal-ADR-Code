<script lang="ts">
	// A section's own page: its name, one line, and a picture card for each group of its menu (SectionCards.svelte), so the page and the menu never disagree (src/lib/site-navigation.ts). A section's home is for finding the way only: no tables or charts, which live on pages of their own (Trevor, Nov. 28, 2026: "pages like https://triballawproject.org/laws are catches for navigation"; design/section-homes/landing-v2). The section's name in the section bar and the phone Menu sheet links here (Trevor, Nov. 27, 2026: no "All of …" link; every section has a home).
	import type { NavigationCounts, NavigationSection } from '#lib/site-navigation.ts';
	import SectionCards, { sectionCardsOf, type SectionCard } from './SectionCards.svelte';

	let { section, counts, lead, cards }: {
		section: NavigationSection;
		counts?: NavigationCounts;
		/** One line under the section's name. */
		lead: string;
		/** The cards, where the page changes them, such as adding each group's years; by default the section's menu groups. */
		cards?: SectionCard[];
	} = $props();
</script>

<div class="section-home">
	<h1>{section.title ?? section.label}</h1>
	<p class="lead">{lead}</p>
	<SectionCards cards={cards ?? sectionCardsOf(section, counts)} />
</div>

<style>
	.section-home h1 {
		margin-bottom: var(--space-1);
	}

	.lead {
		margin: 0 0 var(--space-5);
		color: var(--color-ink-muted);
		font-size: 1.05rem;
	}
</style>
