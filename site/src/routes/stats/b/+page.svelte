<script lang="ts">
	// Design A2: a band of headline numbers, then each group as a list of rows.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import { collectionIcon, groupIcons } from '#lib/collection-icons.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const number = (value: number) => value.toLocaleString('en-US');
	const all = $derived(data.groups.flatMap(({ collections }) => collections));
	const headline = $derived(['native-nations', 'source-copies', 'tribal-court-opinions', 'supreme-court-cases'].flatMap((key) => all.filter((collection) => collection.identifier === key)));
</script>

<svelte:head>
	<title>Statistics · Model Tribal ADR Code</title>
</svelte:head>

<div class="stats-page">
	<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} />
	<h1>Statistics</h1>
	<div class="band">
		<ul class="headline">
			{#each headline as collection (collection.identifier)}
				<li><a href={collection.href}><span class="number">{number(collection.count)}</span><span>{collection.title}</span></a></li>
			{/each}
		</ul>
		<p class="counted">Counted {readableDate(data.built)}</p>
	</div>
	{#each data.groups as { group, collections }, index (group)}
		{@const GroupIcon = groupIcons[group]}
		<section style:--accent="var(--color-chart-series-{(index % 7) + 1})">
			<h2><span class="group-icon" aria-hidden="true"><GroupIcon size={22} /></span>{group}</h2>
			<ul class="rows">
				{#each collections as collection (collection.identifier)}
					{@const Icon = collectionIcon(collection.identifier)}
					<li id={collection.identifier}>
						<span class="icon" aria-hidden="true"><Icon size={18} /></span>
						<span class="label">
							<a href={collection.href}>{collection.title}</a>
							{#if collection.heldBack}<span class="held"><Lock size={13} aria-hidden="true" />{number(collection.heldBack)} {collection.heldBackReason}</span>{/if}
						</span>
						<span class="number">{number(collection.count)}</span>
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

	.band {
		background: var(--color-band);
		color: var(--color-band-text);
		border-radius: var(--radius-panel);
		padding: var(--space-4);
		margin: var(--space-3) 0 var(--space-5);
	}

	.headline {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-3);
	}

	.headline a {
		display: flex;
		flex-direction: column;
		color: inherit;
		text-decoration: none;
	}

	.headline a:hover span:last-child,
	.headline a:focus-visible span:last-child {
		text-decoration: underline;
	}

	.headline .number {
		font-size: var(--font-size-display);
		font-weight: 700;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.counted {
		margin: var(--space-3) 0 0;
		font-size: var(--font-size-small);
		opacity: 0.85;
	}

	section {
		display: grid;
		grid-template-columns: 13rem 1fr;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
	}

	@media (max-width: 40rem) {
		section {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-heading-3);
		margin: var(--space-1) 0 0;
		align-self: start;
	}

	.group-icon {
		color: var(--accent);
		display: inline-flex;
	}

	.rows {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.rows li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.rows li:last-child {
		border-bottom: none;
	}

	.icon {
		color: var(--accent);
		display: inline-flex;
	}

	.label {
		display: flex;
		flex-direction: column;
		align-items: start;
	}

	.rows .number {
		font-size: var(--font-size-heading-3);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.held {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}
</style>
