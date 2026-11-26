<script lang="ts">
	// Cards led by what they count (Trevor, Nov. 24, 2026: no colors, the title more prominent). Each opens the list of what it counts.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import { collectionIcon, groupIcons } from '#lib/collection-icons.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const number = (value: number) => value.toLocaleString('en-US');
</script>

<svelte:head>
	<title>Statistics · Tribal Law Project</title>
	<meta name="description" content="How many nations, documents, laws, cases, people and other records the site holds." />
</svelte:head>

<div class="stats-page">
	<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} />
	<h1>Statistics</h1>
	<p class="counted">Counted {readableDate(data.built)}</p>
	{#each data.groups as { group, collections } (group)}
		{@const GroupIcon = groupIcons[group]}
		<section>
			<h2><GroupIcon size={20} aria-hidden="true" />{group}</h2>
			<ul class="cards">
				{#each collections as collection (collection.identifier)}
					{@const Icon = collectionIcon(collection.identifier)}
					<li id={collection.identifier}>
						<a href={collection.href}>
							<span class="title">{collection.title}</span>
							<span class="icon" aria-hidden="true"><Icon size={18} /></span>
							<span class="number">{number(collection.count)}</span>
						</a>
						{#if collection.years}<span class="years">{collection.years}</span>{/if}
						{#if collection.heldBack}
							<span class="held"><Lock size={14} aria-hidden="true" />{number(collection.heldBack)} {collection.heldBackReason}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.stats-page {
		max-width: var(--layout-measure);
	}

	h1 {
		margin-bottom: 0;
	}

	.counted {
		margin: var(--space-1) 0 var(--space-4);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	section {
		margin-bottom: var(--space-5);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-heading-3);
		margin: 0 0 var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}

	h2 :global(svg) {
		color: var(--color-ink-muted);
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
		gap: var(--space-3);
	}

	.cards li {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		transition: border-color var(--motion-duration-short) var(--motion-easing-standard);
	}

	.cards li:hover,
	.cards li:focus-within {
		border-color: var(--color-link);
	}

	.cards a {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'title icon' 'number number';
		align-content: start;
		gap: var(--space-1) var(--space-2);
		text-decoration: none;
		color: var(--color-ink);
	}

	.cards a::after {
		/* The whole card opens the list. */
		content: '';
		position: absolute;
		inset: 0;
	}

	.title {
		grid-area: title;
		font-size: var(--font-size-large);
		font-weight: 700;
		line-height: 1.25;
		/* Two lines, so the numbers in a row line up. */
		min-height: 2.5em;
	}

	.cards a:hover .title,
	.cards a:focus-visible .title {
		color: var(--color-link);
		text-decoration: underline;
	}

	.icon {
		grid-area: icon;
		color: var(--color-ink-muted);
	}

	.number {
		grid-area: number;
		align-self: end;
		font-size: var(--font-size-heading-2);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.years,
	.held {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.held {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
