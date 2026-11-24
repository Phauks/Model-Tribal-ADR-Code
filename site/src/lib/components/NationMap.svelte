<!--
	@component
	The small map on a nation's page, with the same views as the map of all
	nations (Trevor, Nov. 22, 2026): States (where sources record the nation's
	presence), Bureau of Indian Affairs Region, and Land Areas (the Census
	areas the nation's entry names). Each view shows only the boxes that matter
	to the nation, the main one zoomed to them (src/lib/presence-map.ts). The
	views share one copy of each state outline, drawn with <use>.

	The views are picked from the same searchable dropdown as the map of all
	nations (src/lib/map-views.ts). Without scripts every view is shown, one after another. The same
	facts are listed in words under "At a glance", so the map is never the only
	way to them.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import type { NationMapData } from '#lib/presence-map.ts';
	import ZoomableMap from './ZoomableMap.svelte';
	import TileMap from './TileMap.svelte';
	import SearchableDropdown from './SearchableDropdown.svelte';
	import { nationMapViewChoices, type NationMapView } from '#lib/map-views.ts';
	import MapDetails from './MapDetails.svelte';
	import type { MapDetails as MapDetailsType } from '#lib/map-details.ts';

	let { map, nationName }: { map: NationMapData; nationName: string } = $props();

	const choices = $derived(nationMapViewChoices(map.views.map((view) => view.key)));
	let chosen = $state<NationMapView | undefined>();
	const currentKey = $derived(chosen ?? map.views[0]?.key);
	const current = $derived(Math.max(0, map.views.findIndex((view) => view.key === currentKey)));
	/** The Land Areas view is drawn with MapLibre over the site's tiles when the browser can (TileMap.svelte); the drawn map stays for print, offline reading and old devices. */
	let tileMapWanted = $state(true);
	/** Said to screen readers when the tiled map cannot start and the drawn map takes its place. */
	let tileMapProblem = $state('');
	let tileMapReady = $state(false);

	function choose(key: NationMapView): void {
		tileMapReady = false;
		chosen = key;
	}

	/**
	 * Choosing a land area on the tiled map shows its details under the map, as on the Map page, with a way to it there (Trevor, 2026-11-24, mockup 5). The Census Bureau's outlines carry no states, so the details give the outline's size instead.
	 */
	let chosenArea = $state<string | undefined>();
	let detailsPanel = $state<MapDetails | undefined>();
	const areaDetails = $derived.by((): MapDetailsType | undefined => {
		if (!chosenArea) return undefined;
		const area = map.landAreas.find((entry) => entry.code === chosenArea);
		if (!area) return undefined;
		const tiled = map.tileMap?.areas.find((entry) => entry.code === area.code);
		const squareMiles = tiled ? tiled.squareKilometers / 2.589988 : undefined;
		return {
			kind: area.kind,
			title: area.name,
			lines: squareMiles === undefined ? [] : [{ label: 'Size of the outline', value: `${squareMiles.toLocaleString('en-US', { maximumFractionDigits: squareMiles < 10 ? 1 : 0 })} square miles` }],
			page: { href: `/nations/map#land-area-${area.code.toLowerCase()}`, label: 'Open on the Map page' }
		};
	});
	async function chooseArea(anchor: string): Promise<void> {
		const code = anchor.replace(/^land-area-/, '');
		chosenArea = map.landAreas.find((entry) => entry.code.toLowerCase() === code)?.code;
		await tick();
		await detailsPanel?.focus();
	}

	const titles = $derived({
		states: `Map. States and territories where sources record a presence of ${nationName}: ${map.stateNames.join(', ')}.`,
		region: `Map. The Bureau of Indian Affairs ${map.region?.name ?? ''} and the regions around it.`,
		lands: `Map. Census land areas named in the entry for ${nationName}: ${map.landAreas.map((area) => area.name).join('; ')}.`
	});
</script>

<svelte:head>
	<noscript>
		<style>
			.nation-map-view[hidden] {
				display: block !important;
			}
			.nation-map-picker {
				display: none !important;
			}
		</style>
	</noscript>
</svelte:head>

<div class="nation-map" data-print-part="maps">
	<!-- One copy of each state outline, shared by the views. -->
	<svg class="shape-store" aria-hidden="true" focusable="false" width="0" height="0">
		<defs>
			{#each map.shapes as shape (shape.key)}
				<path id="nation-map-{shape.key}" d={shape.path} vector-effect="non-scaling-stroke" />
			{/each}
		</defs>
	</svg>
	<p class="visually-hidden" role="status">{tileMapProblem}</p>

	{#if map.views.length > 1}
		<div class="nation-map-picker">
			<SearchableDropdown label="Map view" choices={choices} value={currentKey} onchange={choose} />
		</div>
	{/if}

	{#each map.views as view, index (view.key)}
		{@const layout = view.layout}
		{@const tiled = view.key === 'lands' && tileMapReady && index === current}
		<figure
			class="nation-map-view"
			id="nation-map-view-{view.key}"
			aria-label={map.views.length > 1 ? `${view.label} map` : undefined}
			hidden={index !== current}
		>
			{#if view.key === 'lands' && map.tileMap && tileMapWanted && index === current}
				<div class="tile-holder" class:tiled>
					<TileMap
						view="lands"
						label="Land Areas map of {nationName}"
						data={map.tileMap}
						onselect={(anchor) => void chooseArea(anchor)}
						onready={() => (tileMapReady = true)}
						onfail={() => {
							tileMapWanted = false;
							tileMapReady = false;
							tileMapProblem = 'The interactive map could not be loaded, so the drawn map is shown.';
						}}
					/>
				</div>
			{/if}
			<div class="drawing" class:tiled class:waiting={view.key === 'lands' && map.tileMap && tileMapWanted && !tileMapReady && index === current} style:max-width="{layout.shareOfFullWidth * 100}%">
				<ZoomableMap label="{view.label} map of {nationName}" maximum={view.key === 'lands' ? 16 : 8}>
					<svg viewBox="0 0 {layout.width} {layout.height}" role="img" aria-labelledby="nation-map-title-{view.key}">
						<title id="nation-map-title-{view.key}">{titles[view.key]}</title>
						<defs>
							{#each layout.boxes as box (box.key)}
								<clipPath id="nation-map-{view.key}-box-{box.key}">
									<rect x={box.x} y={box.y} width={box.width} height={box.height} rx="3" />
								</clipPath>
							{/each}
						</defs>
						{#each layout.boxes as box (box.key)}
							{@const layers = view.layers[box.key]}
							<g clip-path="url(#nation-map-{view.key}-box-{box.key})">
								<g transform={box.transform}>
									{#each box.states as state (state.code)}
										<use href="#nation-map-{state.shape}" class={state.present ? 'state present' : 'state'} />
									{/each}
									{#each layers?.shapes ?? [] as shape, shapeIndex (shapeIndex)}
										<path class={shape.kind} d={shape.path} vector-effect="non-scaling-stroke" />
									{/each}
								</g>
							</g>
							{#each layers?.dots ?? [] as dot, dotIndex (dotIndex)}
								<circle class="land-area-dot" cx={dot.x} cy={dot.y} r="7" aria-hidden="true" />
							{/each}
							<rect class="inset-frame" x={box.x} y={box.y} width={box.width} height={box.height} rx="3" aria-hidden="true" />
						{/each}
						<g aria-hidden="true">
							{#each layout.labels as label (label.code)}
								{#if label.marker}
									{@const marker = label.marker}
									<line class="marker-line" x1={marker.fromX} y1={marker.fromY} x2={marker.x} y2={marker.y} />
									<circle class="state present" cx={marker.x} cy={marker.y} r="10" />
								{/if}
								<text class="label" class:on-state={!label.marker} text-anchor={label.align} x={label.x} y={label.y}>{label.code}</text>
							{/each}
							{#each layout.boxes as box (box.key)}
								{#each view.layers[box.key]?.labels ?? [] as label (label.text)}
									<text class="label region-label" text-anchor="middle" x={label.x} y={label.y}>{label.text}</text>
								{/each}
							{/each}
						</g>
					</svg>
				</ZoomableMap>
			</div>
			<figcaption>
				{#if view.key === 'states'}
					<p class="key"><span class="swatch" aria-hidden="true"></span>States and territories where sources record a presence</p>
					<p class="small muted">
						The map shows states{#if layout.zoomed}, zoomed to the part of the country around them{/if}.{#if layout.boxes.length > 1}
							Each box has its own scale and is not in its true place.{/if}
						<a href="/nations/map">Map of all nations by state</a>.
					</p>
				{:else if view.key === 'region'}
					<p class="key"><span class="swatch" aria-hidden="true"></span>Bureau of Indian Affairs {map.region?.name}</p>
					<p class="small muted">
						Region lines are simplified for a national map.
						<a href={map.region?.link}>All Bureau of Indian Affairs regions</a>.
					</p>
				{:else}
					<p class="key"><span class="swatch land" aria-hidden="true"></span>Census land areas named in this entry</p>
					{#if tiled && areaDetails}
						<div class="details"><MapDetails bind:this={detailsPanel} details={areaDetails} /></div>
					{/if}
					<ul class="small land-area-list stacked-list">
						{#each map.landAreas as area (area.name)}
							<li>{area.name} <span class="muted">({area.kind})</span></li>
						{/each}
					</ul>
					<p class="small muted">
						{#if tiled}
							Outlines are the Census Bureau’s 2020 areas, drawn over a map of OpenStreetMap data. They are not a statement of the nation’s own boundaries. A dot marks an area until it is big enough to see. Scroll over the map, or pinch, to zoom.
						{:else}
							Outlines are the Census Bureau’s 2020 areas, simplified for a national map. They are not a statement of the nation’s own boundaries.{#if Object.values(view.layers).some((layer) => layer.dots.length > 0)}{' '}A dot marks an area too small to see.{/if}
						{/if}
						<a href="/nations/map?view=lands">Map of all land areas</a>.
					</p>
				{/if}
			</figcaption>
		</figure>
	{/each}
</div>

<style>
	.nation-map {
		margin: 0 0 var(--space-5);
	}

	.shape-store {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}

	.nation-map-picker {
		margin-bottom: var(--space-2);
	}

	.nation-map-view {
		position: relative;
		margin: 0;
	}

	/* The tiled map is laid out out of sight while it loads, then takes the drawn map's place on screen; paper keeps the drawn map. */
	.tile-holder:not(.tiled) {
		position: absolute;
		inset: 0 0 auto;
		visibility: hidden;
	}

	@media screen {
		.drawing.tiled {
			display: none;
		}

		/* While the tiled map loads, the drawn map keeps its place but is not shown, so the reader never sees one map and then the other. It shows again if the tiled map cannot start, and always without scripts. */
		:global(html[data-scripts='on']) .drawing.waiting {
			visibility: hidden;
		}
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.inset-frame {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: calc(2px * var(--map-unzoom, 1));
	}

	circle.state {
		r: calc(10px * var(--map-unzoom, 1));
	}

	.state {
		fill: var(--color-map-class-0);
		stroke: var(--color-control-border);
		stroke-width: 0.75;
		stroke-linejoin: round;
	}

	.state.present,
	.swatch {
		fill: var(--color-map-class-3);
		background: var(--color-map-class-3);
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	/* Regions: every region outlined, the nation's own filled. */
	.region,
	.nation-region {
		fill: none;
		stroke: var(--color-ink-muted);
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	.nation-region {
		fill: var(--color-map-class-3);
		fill-opacity: 0.75;
		stroke: var(--color-ink);
		stroke-width: 2;
	}

	.land-area,
	.land-area-dot,
	.swatch.land {
		fill: var(--color-map-class-4);
		background: var(--color-map-class-4);
		stroke: var(--color-ink);
		stroke-width: 1;
	}

	.land-area-dot {
		r: calc(7px * var(--map-unzoom, 1));
		stroke-width: calc(1.5px * var(--map-unzoom, 1));
	}

	.marker-line {
		stroke: var(--color-ink-muted);
		stroke-width: calc(1.5px * var(--map-unzoom, 1));
	}

	.label {
		fill: var(--color-ink);
		font-family: var(--font-family-reading);
		font-size: calc(24px * var(--map-unzoom, 1));
		font-weight: var(--font-weight-bold);
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: calc(5px * var(--map-unzoom, 1));
		stroke-linejoin: round;
	}

	/* Text drawn on shading is paper with an ink halo, so it keeps its contrast (WCAG 1.4.3). */
	.label.on-state,
	.region-label {
		color: var(--color-paper);
		fill: var(--color-paper);
		stroke: var(--color-ink);
	}

	figcaption {
		margin-top: var(--space-2);
	}

	.key {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-small);
	}

	.swatch {
		display: inline-block;
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--color-ink);
	}

	figcaption .small {
		margin: 0;
	}

	.details {
		margin: var(--space-3) 0;
	}

	.land-area-list {
		margin: 0 0 var(--space-1);
	}
</style>
