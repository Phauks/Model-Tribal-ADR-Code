<!--
	@component
	The Removals page (Trevor approved the v2 mockups on Nov. 28, 2026, design/removals-page): where the United States moved Native nations, on the site's one map with its controls floating on it (MapExplorer.svelte). In place of Layers, a "Kind of move" filter; the key; the timeline of the removals' years, resting on All years; and the chosen journey's details on the right. Under the map, every journey in a table, and References. Each journey has its own page with its record (./[journey]).

	The arrows join places. They are not the roads taken, and the key says so. The two removals that were never carried out are in the table only.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import MapDetails from '#lib/components/MapDetails.svelte';
	import MapExplorer from '#lib/components/MapExplorer.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import TileMap, { type TileMapFeature, type TileMapLayers } from '#lib/components/TileMap.svelte';
	import type { SearchableChoice } from '#lib/components/SearchableDropdown.svelte';
	import type { MapDetails as MapDetailsType } from '#lib/map-details.ts';
	import { journeyYears, moveLabel, namesInWords, removalMoves, type RemovalMove } from '#lib/removal-journeys.ts';
	import { nationVerification } from '#lib/review-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import RemovalArrowMark from './RemovalArrowMark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const journeys = $derived(data.journeys);
	const byId = $derived(new Map(journeys.map((journey) => [journey.id, journey])));
	const first = $derived(Math.min(...journeys.map((journey) => journey.years[0])));
	const last = $derived(Math.max(...journeys.map((journey) => journey.years[1])));

	/** The kinds of move drawn on the map; Not carried out is never drawn. */
	const filterable = removalMoves.filter((entry) => entry.value !== 'not carried out');
	let kinds = $state<RemovalMove[]>(filterable.map((entry) => entry.value));
	const drawn = $derived(journeys.filter((journey) => journey.arrow !== 'not carried out' && kinds.includes(journey.move)));
	const notCarriedOut = $derived(journeys.filter((journey) => journey.move === 'not carried out').length);
	const countOf = (move: RemovalMove) => journeys.filter((journey) => journey.move === move).length;

	/** The timeline's year; undefined is all years. */
	let year = $state<number | undefined>(undefined);
	const marks = $derived([...new Set(drawn.map((journey) => journey.years[0]))]);
	let chosen = $state<string | undefined>(undefined);
	const chosenJourney = $derived(chosen ? byId.get(chosen) : undefined);

	/** A phone's map draws thinner arrows and opens wider, so the western journeys show. */
	let narrow = $state(false);
	onMount(() => {
		narrow = matchMedia('(max-width: 40rem)').matches;
	});
	const opening = $derived<[number, number, number, number]>(narrow ? [-124.5, 26, -71, 48] : [-123.5, 23, -74.5, 50]);
	/** The journeys' country, kept left of the details while a journey is chosen (Removals mockup v2). */
	const journeysBox: [number, number, number, number] = [-122, 27, -77, 47.5];
	let tileMap = $state<ReturnType<typeof TileMap>>();

	let tileMapReady = $state(false);
	let mapShape = $state<'flat' | 'globe'>('globe');
	// The map draws only the journeys; the shared map's own layers stay off, and the timeline never turns its borders on.
	let layers = $state<TileMapLayers>({ lands: false, states: false, offices: false, regions: false, borders: false, routes: false, homelands: false, reservations1909: false, scan1909: false });
	let cessions = $state(false);
	let colorBy = $state('');
	let statesColor = $state('');
	let baseMap = $state<'map' | 'satellite' | 'terrain' | 'topographic'>('map');

	const searchChoices = $derived<SearchableChoice<string>[]>(journeys.filter((journey) => journey.arrow !== 'not carried out').map((journey) => ({ value: journey.id, label: journey.peopleFull, description: journeyYears(journey.years), keywords: journey.nations.map((nation) => nation.name) })));

	function choose(id: string): void {
		const journey = byId.get(id);
		if (!journey) return;
		// A journey of a kind the filter hides is shown again when chosen.
		if (!kinds.includes(journey.move) && journey.move !== 'not carried out') kinds = [...kinds, journey.move];
		chosen = id;
		if (!narrow) tileMap?.showBounds(journeysBox, { top: 60, right: 340, bottom: 110, left: 10 });
	}

	const details = $derived<MapDetailsType | undefined>(
		chosenJourney
			? {
					kind: 'Removal',
					title: `${chosenJourney.people}, ${journeyYears(chosenJourney.years)}`,
					pill: moveLabel(chosenJourney.move),
					summary: chosenJourney.summary,
					lines: [
						{ label: 'From', value: namesInWords(chosenJourney.from) },
						{ label: 'To', value: chosenJourney.to },
						{
							label: 'Evidence',
							value: '',
							counts: [
								{ label: 'The order', count: chosenJourney.counts.order },
								{ label: 'The move', count: chosenJourney.counts.move },
								{ label: 'The force', count: chosenJourney.counts.force }
							]
						}
					],
					page: { href: `/nations/removals/${chosenJourney.id}`, label: 'Open the journey’s page' }
				}
			: undefined
	);

	const columns: TableColumn[] = [
		{ key: 'people', header: 'People', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'years', header: 'Years', sortable: true },
		{ key: 'move', header: 'Kind of move', sortable: true, filterable: true, custom: true },
		{ key: 'from', header: 'From', sortable: true, searchable: true },
		{ key: 'to', header: 'To', sortable: true, searchable: true },
		{ key: 'ordered', header: 'Ordered by', sortable: true, searchable: true, custom: true },
		{ key: 'nations', header: 'Nations today', sortable: true, searchable: true, custom: true }
	];
	const rows = $derived<TableRow[]>(
		journeys.map((journey) => ({
			key: journey.id,
			anchor: `journey-${journey.id}`,
			cells: {
				people: { text: journey.peopleFull, href: `/nations/removals/${journey.id}` },
				years: { text: journeyYears(journey.years), sortValue: journey.years[0] * 10000 + journey.years[1] },
				move: { text: moveLabel(journey.move), values: [moveLabel(journey.move)] },
				from: { text: journey.from.join(', ') },
				to: { text: journey.to },
				ordered: { text: journey.orderedBy.length > 0 ? journey.orderedBy.map((order) => order.citation).join('; ') : journey.orderedOtherwise },
				nations: { text: journey.nations.map((nation) => nation.name).join('; '), values: journey.nations.map((nation) => nation.name) }
			}
		}))
	);
</script>

<svelte:head>
	<title>Removals · Nations · Tribal Law Project</title>
	<meta name="description" content="Where the United States moved Native nations, {first} to {last}, and the record of each move: the order, the move and the force." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Removals" />

<div class="reading">
	<h1>Removals</h1>
	<p class="lead">Where the United States moved Native nations, {first} to {last}, and the record of each move.</p>
	<div class="status-badges">
		<ReviewStatus status={nationVerification(undefined)} description="Review by the nations:">
			<p><strong>Unverified.</strong> The nations whose removals are shown have not reviewed this page yet.</p>
		</ReviewStatus>
	</div>
</div>

<div class="map-frame explorer-frame live-frame no-print" data-map-full-screen>
	<div class="map-drawing" class:tiled={tileMapReady}>
		<div class="tile-holder">
			{#key opening.join(',')}
				<TileMap
					bind:this={tileMap}
					view="lands"
					label="Removals of Native nations, {first} to {last}"
					data={data.map}
					{opening}
					bind:shape={mapShape}
					layerSwitches={layers}
					bind:baseMap
					journeys={{ lines: drawn, chosen, year, labels: true, scale: narrow ? 0.7 : 1 }}
					onfeature={(feature: TileMapFeature) => {
						if (feature.kind === 'journey') choose(feature.id);
					}}
					onready={() => (tileMapReady = true)}
					onfail={() => (tileMapReady = false)}
				/>
			{/key}
		</div>
	</div>
	{#if tileMapReady}
		<div class="explorer">
			<MapExplorer
				bind:layers
				bind:cessions
				bind:colorBy
				colorChoices={[]}
				bind:statesColor
				statesColorChoices={[]}
				bind:baseMap
				bind:year
				{first}
				{last}
				{marks}
				ticks={[first, 1830, 1850, 1870, last]}
				thinMarks={false}
				yearTurnsOnBorders={false}
				restLabel="All years"
				searchLabel="Find a nation or people"
				places={searchChoices}
				onplace={choose}
				filter={{ label: 'Kind of move', count: kinds.length, panel: kindFilter }}
				key={journeyKey}
				details={details ? journeyDetails : undefined}
			/>
		</div>
	{/if}
</div>

{#snippet kindFilter()}
	<section class="kind-filter" aria-label="Kind of move">
		<p class="map-panel-heading">Kind of move</p>
		{#each filterable as entry (entry.value)}
			<label class="kind-row">
				<input
					type="checkbox"
					checked={kinds.includes(entry.value)}
					onchange={(event) => {
						kinds = event.currentTarget.checked ? [...kinds, entry.value] : kinds.filter((kind) => kind !== entry.value);
						if (chosenJourney && !kinds.includes(chosenJourney.move)) chosen = undefined;
					}}
				/>
				<span class="kind-words">{entry.label}<CountBadge count={countOf(entry.value)} /><span class="kind-meaning">{entry.meaning}</span></span>
			</label>
		{/each}
		<p class="kind-meaning kind-note">Not carried out ({notCarriedOut}): in the table only.</p>
	</section>
{/snippet}

{#snippet journeyKey()}
	<ul class="journey-key" aria-label="Key">
		<li><RemovalArrowMark style="solid" />Order and move on record</li>
		<li><RemovalArrowMark style="dashed" />Order on record; move not yet found</li>
		<li><RemovalArrowMark style="start" />Land left</li>
	</ul>
	<p class="journey-note">Arrows join places. They are not the roads taken.</p>
{/snippet}

{#snippet journeyDetails()}
	{#if details}
		<MapDetails {details} back={{ label: 'Close', onclick: () => (chosen = undefined) }} />
	{/if}
{/snippet}

<div class="removals-below">
	<Collapsible heading="Journeys" identifier="journeys" count={journeys.length}>
		<DataTable identifier="removal-journeys" label="Table: removal journeys" title="" count={false} filters download="removals" {columns} {rows} defaultSort={{ key: 'years', direction: 'ascending' }} {cell} />
	</Collapsible>
	<SourceList sources={data.sources} />
</div>

{#snippet cell(row: TableRow, column: TableColumn)}
	{@const journey = byId.get(row.key)}
	{#if journey && column.key === 'move'}
		<span class="move-line"
			><span class="move-pill">{moveLabel(journey.move)}</span><span class="move-record"
				>{#if journey.arrow === 'solid'}<RemovalArrowMark style="solid" />On record{:else if journey.arrow === 'dashed'}<RemovalArrowMark style="dashed" />Not yet found{:else}Not on the map{/if}</span
			></span
		>
	{:else if journey && column.key === 'ordered'}
		{#if journey.orderedBy.length > 0}
			{#each journey.orderedBy as order, index (order.citation)}{#if index > 0}{'; '}{/if}{#if order.link}<a href={order.link}>{order.citation}</a>{:else}{order.citation}{/if}{/each}
		{:else}
			<span class="muted">{journey.orderedOtherwise}</span>
		{/if}
	{:else if journey && column.key === 'nations'}
		{#each journey.nations as nation, index (nation.id)}{#if index > 0}<br />{/if}<a href="/nations/{nation.id}">{nation.name}</a>{/each}
	{/if}
{/snippet}

<style>
	.lead {
		margin: var(--space-1) 0 var(--space-3);
		max-width: none;
	}

	/* The map, as on the Map page: as wide as the page's column and nearly as tall as the window, its controls floating on it (map redesign D). */
	.map-frame {
		container: map-frame / inline-size;
		position: relative;
	}

	.live-frame {
		margin: var(--space-5) 0;
	}

	/* Without scripts there is no map; the table names every journey. */
	:global(html:not([data-scripts='on'])) .live-frame {
		display: none;
	}

	@media screen {
		.map-frame.explorer-frame {
			height: clamp(28rem, calc(100vh - 12rem), 50rem);
			overflow: hidden;
			border: 1px solid var(--color-line);
			border-radius: var(--radius-panel);
			background: var(--color-surface);
		}

		.map-frame.explorer-frame:fullscreen {
			height: 100%;
			border: 0;
			border-radius: 0;
		}

		.explorer-frame .map-drawing {
			position: absolute;
			inset: 0;
			max-width: none;
		}

		.explorer-frame .map-drawing:not(.tiled) :global(.tile-map) {
			inset: 0;
		}

		.explorer-frame :global(.tile-holder) {
			height: 100%;
		}
	}

	.explorer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.explorer > :global(*) {
		pointer-events: auto;
	}

	@media screen and (max-width: 40rem) {
		.map-frame.explorer-frame {
			height: clamp(26rem, calc(100vh - 10rem), 40rem);
			margin-inline: calc(var(--space-4) * -1);
			border-inline: 0;
			border-radius: 0;
		}
	}

	/* On a phone the map's credits take three lines here (the Census Bureau's states and the journeys' places), so the timeline sits a line higher than on the Map page. */
	@container map-frame (max-width: 40rem) {
		.explorer :global(.explorer-timeline) {
			bottom: 4.25rem;
		}
	}

	/* The filter in place of Layers, in the look of the Layers list (MapExplorer.svelte). */
	.kind-filter {
		padding: var(--space-2) 0;
	}

	.kind-filter .map-panel-heading {
		margin: 0 0 var(--space-1);
	}

	.kind-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 3px 0;
		line-height: 1.25;
		cursor: pointer;
	}

	.kind-row input {
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--color-action);
	}

	.kind-words {
		flex: 1;
	}

	.kind-meaning {
		display: block;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.kind-note {
		margin: var(--space-2) 0 0;
	}

	.journey-key {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.journey-key li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.journey-note {
		max-width: 16rem;
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
	}

	.removals-below {
		margin-top: var(--space-4);
	}

	.move-line {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
	}

	.move-record {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
</style>
