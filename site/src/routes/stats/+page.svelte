<script lang="ts">
	// Design A1: cards, each group with its own accent color and icon.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import { collectionIcon, groupIcons } from '#lib/collection-icons.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const number = (value: number) => value.toLocaleString('en-US');
</script>

<svelte:head>
	<title>Statistics · Model Tribal ADR Code</title>
	<meta name="description" content="How many nations, documents, laws, cases, people and other records the site holds." />
</svelte:head>

<div class="stats-page">
	<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} />
	<h1>Statistics</h1>
	<p class="counted">Counted {readableDate(data.built)}</p>
	{#each data.groups as { group, collections }, index (group)}
		{@const GroupIcon = groupIcons[group]}
		<section style:--accent="var(--color-chart-series-{(index % 7) + 1})">
			<h2><span class="group-icon" aria-hidden="true"><GroupIcon size={18} /></span>{group}</h2>
			<ul class="cards">
				{#each collections as collection (collection.identifier)}
					{@const Icon = collectionIcon(collection.identifier)}
					<li id={collection.identifier}>
						<a href={collection.href}>
							<span class="icon" aria-hidden="true"><Icon size={20} /></span>
							<span class="number">{number(collection.count)}</span>
							<span class="title">{collection.title}</span>
						</a>
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

	.group-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		color: var(--color-paper);
		background: var(--accent);
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
		border: 1px solid var(--color-line);
		border-top: 4px solid var(--accent);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		transition: border-color var(--motion-duration-short) var(--motion-easing-standard);
	}

	.cards li:hover,
	.cards li:focus-within {
		border-color: var(--accent);
	}

	.cards a {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'number icon' 'title title';
		gap: var(--space-1) var(--space-2);
		padding: var(--space-3) var(--space-3) var(--space-2);
		align-content: start;
		text-decoration: none;
		color: var(--color-ink);
		flex: 1;
	}

	.cards a::after {
		/* The whole card opens the collection. */
		content: '';
		position: absolute;
		inset: 0;
	}

	.icon {
		grid-area: icon;
		color: var(--accent);
	}

	.number {
		grid-area: number;
		font-size: var(--font-size-heading-1);
		font-weight: 700;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.title {
		grid-area: title;
		font-weight: 600;
		color: var(--color-ink-muted);
	}

	.cards a:hover .title,
	.cards a:focus-visible .title {
		color: var(--color-link);
		text-decoration: underline;
	}

	.held {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-3) var(--space-3);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}
</style>
