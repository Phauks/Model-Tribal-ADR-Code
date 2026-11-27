<script lang="ts">
	// Cards led by what they count (Trevor, Nov. 24, 2026: no colors, the title more prominent). Each opens the list of what it counts.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import Landmark from '@lucide/svelte/icons/landmark';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Mountain from '@lucide/svelte/icons/mountain';
	import Users from '@lucide/svelte/icons/users';
	import type { Component } from 'svelte';
	import BarChart from '#lib/components/BarChart.svelte';
	import { collectionIcon, groupIcons } from '#lib/collection-icons.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const number = (value: number) => value.toLocaleString('en-US');

	// Recognition (Trevor, Nov. 27, 2026: "delineate between federally recognized, state, and non-recognized"): the same cards, then the status chart; the finer breakdowns are on Data and charts.
	const tileIcons: Record<string, Component> = {
		'federally-recognized': Landmark,
		'state-recognized-only': MapPin,
		'not-recognized': CircleDashed,
		'alaska-native-entities': Mountain,
		'native-hawaiian-community': Users,
		'territorial-peoples': Users
	};
</script>

{#snippet recognitionSection()}
	<section id="recognition" aria-labelledby="recognition-heading">
		<h2 id="recognition-heading"><BadgeCheck size={20} aria-hidden="true" />Recognition</h2>
		<ul class="cards">
			{#each data.recognition.tiles as tile (tile.identifier)}
				{@const Icon = tileIcons[tile.identifier] ?? Users}
				<li id={tile.identifier}>
					<a href={tile.href}>
						<span class="title">{tile.title}</span>
						<span class="icon" aria-hidden="true"><Icon size={18} /></span>
						<span class="number">{number(tile.count)}</span>
					</a>
					{#if tile.note}<span class="years">{tile.note}</span>{/if}
				</li>
			{/each}
		</ul>
		{#if data.recognition.chart}
			<div class="chart"><BarChart chart={data.recognition.chart} headingLevel={3} /></div>
		{/if}
	</section>
{/snippet}

<svelte:head>
	<title>Statistics · Tribal Law Project</title>
	<meta name="description" content="How many nations, documents, laws, cases, people and other records the site holds." />
</svelte:head>

<div class="stats-page">
	<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} current="Statistics" />
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
						<!-- More about the number (Trevor, Nov. 27, 2026), such as documents with their pages, saved web pages and items without a copy. -->
						{#if collection.breakdown}
							<ul class="breakdown">
								{#each collection.breakdown as part (part)}
									<!-- "593 documents (11,010 pages)" wraps before the pages, never inside them. -->
									{@const [lead, pages] = part.split(' (')}
									<li>{lead}{#if pages}{' '}<span class="pages">({pages}</span>{/if}</li>
								{/each}
							</ul>
						{/if}
						{#if collection.heldBack}
							<span class="held"><Lock size={14} aria-hidden="true" />{number(collection.heldBack)} {collection.heldBackReason}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
		{#if group === 'Native nations'}{@render recognitionSection()}{/if}
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

	.chart {
		margin-top: var(--space-5);
	}

	.years,
	.breakdown,
	.held {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.breakdown {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.cards .breakdown li {
		/* One part to a line, so the parts of the number read as a sum. */
		display: block;
		position: static;
		padding: 0;
		border: 0;
		background: none;
	}

	.breakdown .pages {
		white-space: nowrap;
	}

	.held {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
