<!--
	@component
	A section's home page as picture cards (Trevor chose the picture cards on
	Nov. 27, 2026, design/section-homes and design/federal-navigation mockup
	home-A2): one card for each group of the section's menu, with the group's
	picture (or its icon when it has none), its name, one line and its links
	with their counts, so the page and the menu never disagree. Under the cards
	goes the "Picture credits" fold, which credits each picture from its own
	record. A section's home is for finding the way only, so no tables or
	charts go on it (Trevor, Nov. 28, 2026). Each link is a row with the
	menu's icon, its name and its count, a rule between rows (Trevor chose A,
	Nov. 28, 2026, design/section-homes/landing-v2/0-link-styles.png); the cards
	sit three to a row on a wide screen.

	Use:
	<SectionCards cards={sectionCardsOf(section, counts)} />
-->
<script module lang="ts">
	import type { NavigationCounts, NavigationIconName, NavigationSection, SectionPicture } from '#lib/site-navigation.ts';

	export interface SectionCard {
		title: string;
		line: string;
		picture?: SectionPicture;
		/** Shown where the card has no picture. */
		icon?: NavigationIconName;
		/** `soon` marks a page not published yet, shown without a link. */
		links: { label: string; href: string; icon: NavigationIconName; count?: number; soon?: boolean }[];
	}

	/** A section's menu groups as cards, in menu order, each link with its icon and count (src/lib/site-navigation.ts). */
	export function sectionCardsOf(section: NavigationSection, counts?: NavigationCounts): SectionCard[] {
		return section.groups.map((group) => ({
			title: group.title,
			line: group.line ?? '',
			picture: group.picture,
			icon: group.links[0]?.icon,
			links: group.links.map((link) => ({ label: link.label, href: link.link, icon: link.icon, count: link.count ? counts?.[link.count] : undefined, soon: link.soon }))
		}));
	}
</script>

<script lang="ts">
	import { navigationIcons } from '#lib/navigation-icons.ts';
	import CountBadge from './CountBadge.svelte';

	let { cards }: { cards: SectionCard[] } = $props();
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
				<h2 id={idOf(index)}>{card.title}</h2>
				{#if card.line}<p class="card-line">{card.line}</p>{/if}
				<ul class="card-links">
					{#each card.links as link (link.href)}
						{@const LinkIcon = navigationIcons[link.icon]}
						<li>
							{#if link.soon}
								<span class="card-link soon"><LinkIcon size={18} aria-hidden="true" /><span class="link-label">{link.label} <span class="soon-note">soon</span></span></span>
							{:else}
								<a class="card-link" href={link.href}><LinkIcon size={18} aria-hidden="true" /><span class="link-label">{link.label}</span>{#if link.count}<CountBadge count={link.count} />{/if}</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/each}
</div>

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
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
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


	.card-line {
		margin: 0 0 var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	@media (min-width: 56rem) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.card-links {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card-links li + li {
		border-top: 1px solid var(--color-line);
	}

	/* Each link a row like the menu's: icon, name, count; the whole row is the target. */
	.card-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 calc(-1 * var(--space-2));
		padding: 0.55rem var(--space-2);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
	}

	a.card-link:hover {
		background: var(--color-surface);
		color: var(--color-link);
	}

	.card-link :global(svg) {
		flex: none;
		color: var(--color-link);
	}

	.link-label {
		flex: 1;
	}

	.card-link.soon {
		color: var(--color-ink-muted);
	}

	.card-link.soon :global(svg) {
		color: var(--color-ink-muted);
	}

	.soon-note {
		margin-left: 0.3rem;
		font-size: var(--font-size-small);
		font-weight: normal;
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
