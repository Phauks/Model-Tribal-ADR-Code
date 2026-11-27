<script lang="ts">
	// The Courts and cases section's own page (Trevor, Nov. 27, 2026, design/section-homes/nav/2-balanced-menu-and-page.png): a picture card for each court system, the same groups and links as the section's menu, side by side with none above another, then the directory of every court beneath them.
	import CountBadge from '#lib/components/CountBadge.svelte';
	import SectionCards, { sectionCardsOf } from '#lib/components/SectionCards.svelte';
	import { navigationIcons } from '#lib/navigation-icons.ts';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'courts-and-cases')!;
	const cards = $derived(sectionCardsOf(section, data.counts));
	const beneath = section.groups.filter((group) => group.beneath);
</script>

<svelte:head>
	<title>Courts and cases · Tribal Law Project</title>
	<meta name="description" content="Opinions of Tribal, state and territorial courts, cases of the Supreme Court of the United States and other federal courts, decisions of federal agency boards, and a directory of courts." />
</svelte:head>

<div class="courts-home">
	<h1>{section.title}</h1>
	<p class="lead">Decisions of the courts that shape Native law, by the kind of court that made them.</p>
	<SectionCards {cards}>
		{#snippet footer()}
			{#each beneath as group (group.title)}
				{#each group.links as link (link.link)}
					{@const Icon = navigationIcons[link.icon]}
					<p class="beneath">
						<Icon size={20} aria-hidden="true" /><strong>{group.title}</strong><a href={link.link}>{link.label}</a>{#if link.count && data.counts[link.count]}<CountBadge count={data.counts[link.count]} />{/if}{#if group.line}<span class="beneath-line">{group.line}</span>{/if}
					</p>
				{/each}
			{/each}
		{/snippet}
	</SectionCards>
</div>

<style>
	.courts-home h1 {
		margin-bottom: var(--space-1);
	}

	.lead {
		margin: 0 0 var(--space-5);
		color: var(--color-ink-muted);
		font-size: 1.05rem;
	}

	.courts-home :global(.cards) {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12.5rem), 1fr));
	}

	.beneath {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: var(--space-4) 0 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.beneath :global(svg) {
		color: var(--color-link);
	}

	.beneath-line {
		color: var(--color-ink-muted);
	}
</style>
