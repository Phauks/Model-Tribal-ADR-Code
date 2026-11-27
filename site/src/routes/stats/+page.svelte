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
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { collectionIcon, groupIcons } from '#lib/collection-icons.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const number = (value: number) => value.toLocaleString('en-US');

	// Recognition (Trevor, Nov. 27, 2026: "delineate between federally recognized, state, and non-recognized"): the same cards, then the charts, then which collections hold records of nations of each status.
	const tileIcons: Record<string, Component> = {
		'federally-recognized': Landmark,
		'state-recognized-only': MapPin,
		'not-recognized': CircleDashed,
		'alaska-native-entities': Mountain,
		'native-hawaiian-community': Users,
		'territorial-peoples': Users
	};
	const listFiltered = (href: string, identifier: string, status: string) => (href.startsWith('/stats/') ? `${href}?${new URLSearchParams({ [`${identifier}.recognition`]: status })}` : href);
	const collectionColumns: TableColumn[] = $derived([
		{ key: 'collection', header: 'Collection', isRowHeader: true, sortable: true },
		...data.recognition.statuses.map((status) => ({ key: status, header: status, type: 'number' as const, sortable: true })),
		{ key: 'total', header: 'All nations', type: 'number' as const, sortable: true }
	]);
	const collectionRows: TableRow[] = $derived(
		data.recognition.collections.map((row) => ({
			key: row.identifier,
			cells: {
				collection: { text: row.title, href: row.href },
				...Object.fromEntries(
					data.recognition.statuses.map((status) => [
						status,
						{ text: number(row.counts[status]), sortValue: row.counts[status], href: row.counts[status] ? listFiltered(row.href, row.identifier, status) : undefined }
					])
				),
				total: { text: number(row.total), sortValue: row.total, href: row.href }
			}
		}))
	);
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
		<div class="charts">
			{#each data.recognition.charts as chart (chart.identifier)}
				<BarChart {chart} headingLevel={3} />
			{/each}
		</div>
		{#if collectionRows.length}
			<h3 id="nations-in-collections">Nations With Records in Each Collection</h3>
			<p class="table-note">How many nations of each status a collection holds at least one record about. A number opens those records.</p>
			<DataTable
				identifier="nations-in-collections"
				label="Table: Nations With Records in Each Collection"
				columns={collectionColumns}
				rows={collectionRows}
				download="nations-in-collections"
				rowName={['collection', 'collections']}
				count={false}
			/>
		{/if}
	</section>
{/snippet}

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

	.charts {
		display: grid;
		gap: var(--space-5);
		margin-top: var(--space-5);
	}

	h3 {
		font-size: var(--font-size-large);
		margin: var(--space-5) 0 var(--space-1);
	}

	.table-note {
		margin: 0 0 var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
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
