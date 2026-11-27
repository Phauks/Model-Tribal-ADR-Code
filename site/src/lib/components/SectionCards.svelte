<!--
	@component
	A section's home page as picture cards (Trevor chose the picture cards on
	Nov. 27, 2026, design/section-homes and design/federal-navigation mockup
	home-A2): one card for each group of the section's menu, with the group's
	picture (or its icon when it has none), its name, one line and its links
	with their counts, so the page and the menu never disagree. Under the cards
	go `footer`, such as a directory line or a chart, and the "Picture credits"
	fold, which credits each picture from its own record.

	Use:
	<SectionCards cards={sectionCardsOf(section, counts)} footer={chart} />
-->
<script module lang="ts">
	import type { NavigationCounts, NavigationIconName, NavigationSection, SectionPicture } from '#lib/site-navigation.ts';

	export interface SectionCard {
		title: string;
		line: string;
		picture?: SectionPicture;
		/** Shown where the card has no picture. */
		icon?: NavigationIconName;
		links: { label: string; href: string; count?: number }[];
	}

	/** A section's menu groups as cards, each link with its count (src/lib/site-navigation.ts). Links not published yet are left out. */
	export function sectionCardsOf(section: NavigationSection, counts?: NavigationCounts): SectionCard[] {
		return section.groups.map((group) => ({
			title: group.title,
			line: group.line ?? '',
			picture: group.picture,
			icon: group.links[0]?.icon,
			links: group.links.filter((link) => !link.soon).map((link) => ({ label: link.label, href: link.link, count: link.count ? counts?.[link.count] : undefined }))
		}));
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { navigationIcons } from '#lib/navigation-icons.ts';
	import CountBadge from './CountBadge.svelte';

	let { cards, footer, swatches = false }: {
		cards: SectionCard[];
		footer?: Snippet;
		/** Marks each card's name with the chart color of its place, for a footer chart whose series are the cards (series-1, series-2 and so on). */
		swatches?: boolean;
	} = $props();
	const idOf = (index: number) => `section-card-${index + 1}`;
	const credited = $derived(cards.filter((card) => card.picture));
</script>

<div class="cards">
	{#each cards as card, index (card.title)}
		{@const Icon = card.icon ? navigationIcons[card.icon] : undefined}
		<section class="card" aria-labelledby={idOf(index)}>
			{#if card.picture}
				<img src={card.picture.src} alt={card.picture.alt} width={card.picture.width} height={card.picture.height} loading="lazy" decoding="async" />
			{:else if Icon}
				<span class="card-icon" aria-hidden="true"><Icon size={28} /></span>
			{/if}
			<div class="card-body">
				<h2 id={idOf(index)}>{#if swatches}<span class="swatch series-{index + 1}" aria-hidden="true"></span>{/if}{card.title}</h2>
				{#if card.line}<p class="card-line">{card.line}</p>{/if}
				<ul class="card-links">
					{#each card.links as link (link.href)}
						<li><a href={link.href}>{link.label}</a>{#if link.count}<CountBadge count={link.count} />{/if}</li>
					{/each}
				</ul>
			</div>
		</section>
	{/each}
</div>

{@render footer?.()}

{#if credited.length > 0}
	<details class="credits">
		<summary>Picture credits</summary>
		<ol>
			{#each credited as card (card.title)}
				<li>{card.title}: {card.picture?.credit}{#if card.picture?.source}{' '}<a href={card.picture.source}>Record</a>{/if}</li>
			{/each}
		</ol>
	</details>
{/if}

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		gap: var(--space-4);
		align-items: stretch;
	}

	.card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}

	.card img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 9 / 5;
		object-fit: cover;
		border-bottom: 1px solid var(--color-line);
	}

	.card-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 9 / 5;
		color: var(--color-ink-muted);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
	}

	.card-body {
		padding: var(--space-4);
	}

	.card-body h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.15rem;
	}

	.card-body h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		flex: none;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 2px;
	}

	.series-1 { background: var(--color-chart-series-1); }
	.series-2 { background: var(--color-chart-series-2); }
	.series-3 { background: var(--color-chart-series-3); }
	.series-4 { background: var(--color-chart-series-4); }
	.series-5 { background: var(--color-chart-series-5); }
	.series-6 { background: var(--color-chart-series-6); }
	.series-7 { background: var(--color-chart-series-7); }

	.card-line {
		margin: 0 0 var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.card-links {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card-links li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.credits {
		margin-top: var(--space-6);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.credits ol {
		margin: var(--space-2) 0 0;
		padding-left: 1.25rem;
	}
</style>
