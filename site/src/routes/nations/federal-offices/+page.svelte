<!--
	@component
	The federal offices that serve Native nations (approved mockup, Nov. 28, 2026: Trevor asked for "a map, or a better way of interacting"). The site's one map, with a switch between the Bureau of Indian Affairs, its regions drawn and each regional office pinned, and the Indian Health Service, each nation's land shaded by its Area. Choosing a region, an Area or a nation opens its offices beside the map; under the map, one table lists every region, agency and Area. Which office serves a nation comes from the nations' own records (Trevor, Nov. 23, 2026: each federal tie on a nation page opens a page about the office).
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import MapDetails from '#lib/components/MapDetails.svelte';
	import MapExplorer from '#lib/components/MapExplorer.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import TileMap, { storedBaseMap, type TileMapLayers, type TileMapPadding, type TileMapPin } from '#lib/components/TileMap.svelte';
	import { nationsLine, type MapDetails as MapDetailsType } from '#lib/map-details.ts';
	import { patternDefinitions, patternFor, shapeFor, shapePath } from '#lib/map-shapes.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { AreaPlace, OfficePlace, RegionPlace } from '#lib/server/federal-offices.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Which agency's offices the map shows. */
	type Agency = 'bureau' | 'health';
	let agency = $state<Agency>('bureau');
	const agencies: { value: Agency; label: string }[] = [
		{ value: 'bureau', label: 'Bureau of Indian Affairs' },
		{ value: 'health', label: 'Indian Health Service' }
	];

	/** Nations' land on both; the regions' lines with the Bureau of Indian Affairs. */
	const layers = $derived<TileMapLayers>({ lands: true, states: false, offices: false, regions: agency === 'bureau', borders: false, routes: false, homelands: false, reservations1909: false, scan1909: false });
	const pins = $derived<TileMapPin[]>(
		agency === 'bureau' ? data.regions.flatMap((region) => (region.address ? [{ name: region.address.lines[region.address.lines.length - 1].replace(/,.*$/, ''), point: region.address.point, anchor: region.anchor }] : [])) : []
	);
	const mapLabel = $derived(agency === 'bureau' ? 'Bureau of Indian Affairs regions and regional offices' : 'Nations’ land by Indian Health Service Area');

	let tileMap = $state<TileMap | undefined>();
	let tileMapReady = $state(false);
	let mapShape = $state<'flat' | 'globe'>('globe');
	let baseMap = $state(storedBaseMap());

	/** What the details beside the map are about. */
	type Chosen = { kind: 'region'; region: RegionPlace } | { kind: 'area'; area: AreaPlace } | { kind: 'nation'; id: string };
	let chosen = $state<Chosen | undefined>();

	const regionByAnchor = $derived(new Map(data.regions.map((region) => [region.anchor, region])));
	const areaByAnchor = $derived(new Map(data.areas.map((area) => [area.anchor, area])));

	/** A place chosen on the map: a region or its office, an Area, a nation's land, or the office of a nation with no land. */
	function select(anchor: string): void {
		const region = regionByAnchor.get(anchor);
		if (region) return void (chosen = { kind: 'region', region });
		const area = areaByAnchor.get(anchor);
		if (area) return void (chosen = { kind: 'area', area });
		if (anchor.startsWith('/nations/')) return chooseNation(anchor.slice('/nations/'.length));
		if (anchor.startsWith('land-area-')) {
			const code = anchor.slice('land-area-'.length);
			const found = Object.entries(data.landAreas).find(([key]) => key.toLowerCase() === code)?.[1] ?? [];
			if (found.length > 0) chooseNation(found[0]);
		}
	}

	function chooseNation(id: string): void {
		if (data.nations[id]) chosen = { kind: 'nation', id };
	}

	/** The search finds nations, regions and Areas. */
	const searchChoices = $derived([
		...Object.entries(data.nations)
			.map(([id, nation]) => ({ value: `nation:${id}`, label: nation.name, group: 'Nations' }))
			.sort((first, second) => first.label.localeCompare(second.label, 'en')),
		...data.regions.map((region) => ({ value: region.anchor, label: region.name, group: 'Bureau of Indian Affairs regions' })),
		...data.areas.map((area) => ({ value: area.anchor, label: area.name, group: 'Indian Health Service Areas' }))
	]);

	let frameWidth = $state(0);
	/** Room around a nation the map moves to: beside the details on a wide screen; on a phone the details cover the map, so a small margin. */
	function padding(): TileMapPadding {
		if (frameWidth < 640) return 24;
		return { top: 80, bottom: 48, left: 24, right: chosen ? 380 : 72 };
	}

	function onSearch(value: string): void {
		if (value.startsWith('nation:')) {
			const id = value.slice('nation:'.length);
			chooseNation(id);
			tileMap?.showNation(id, padding());
			return;
		}
		if (regionByAnchor.has(value)) agency = 'bureau';
		if (areaByAnchor.has(value)) agency = 'health';
		select(value);
	}

	const officeLink = (link: string | undefined, label: string) => (link ? [{ label, href: link, external: true }] : undefined);

	/** The details of what is chosen, in the shape the map's details panel takes. */
	const details = $derived.by((): MapDetailsType | undefined => {
		if (!chosen) return undefined;
		if (chosen.kind === 'region') {
			const region = chosen.region;
			return {
				kind: 'Bureau of Indian Affairs region',
				title: region.name,
				lines: [
					{ label: 'States', value: region.states.join(', ') || 'None Identified' },
					nationsLine('Nations', region.nations),
					{ label: 'Agencies', value: region.agencies.length.toLocaleString('en-US'), noun: { one: 'agency', many: 'agencies' }, nations: region.agencies.map((office) => ({ id: office.key, name: office.name, href: office.href })) },
					{ label: 'Regional office', value: '', block: region.address ? region.address.lines.map((text) => ({ text })) : [{ text: 'None Identified' }] },
					{ label: 'Official page', value: region.link ? '' : 'None Identified', links: officeLink(region.link, 'bia.gov') }
				],
				page: { href: region.href, label: 'Open the region’s page' }
			};
		}
		if (chosen.kind === 'area') {
			const area = chosen.area;
			return {
				kind: 'Indian Health Service Area',
				title: area.name,
				lines: [
					{ label: 'States', value: area.states.join(', ') || 'None Identified' },
					nationsLine('Nations', area.nations),
					area.serviceUnits.length > 0
						? { label: 'Service units', value: area.serviceUnits.length.toLocaleString('en-US'), noun: { one: 'service unit', many: 'service units' }, nations: area.serviceUnits.map((unit) => ({ id: unit, name: unit, href: `${area.href}#service-units` })) }
						: { label: 'Service units', value: 'None Identified' },
					{ label: 'Area office', value: 'None Identified' },
					{ label: 'Official page', value: area.link ? '' : 'None Identified', links: officeLink(area.link, 'ihs.gov') }
				],
				page: { href: area.href, label: 'Open the Area’s page' }
			};
		}
		const nation = data.nations[chosen.id];
		return {
			kind: 'Nation',
			title: nation.name,
			nation: chosen.id,
			badges: nation.badges,
			lines: [
				{
					label: 'Bureau of Indian Affairs',
					value: '',
					block: nation.region ? [{ text: nation.region.name, href: nation.region.href }, ...(nation.agency ? [{ text: nation.agency.name, href: nation.agency.href, small: true }] : [])] : [{ text: 'None Identified' }]
				},
				{
					label: 'Indian Health Service',
					value: '',
					block: nation.area ? [{ text: nation.area.name, href: nation.area.href }, ...(nation.serviceUnit ? [{ text: nation.serviceUnit, small: true }] : [])] : [{ text: 'None Identified' }]
				}
			],
			page: { href: `/nations/${chosen.id}`, label: 'Open the nation’s page' }
		};
	});

	/** The shade each land area group is drawn in, as on the Map page. */
	const landGroupShade: Record<string, number> = { federal: 4, state: 3, statistical: 2 };
	const areaLegend = $derived(data.areas.map((area) => ({ name: area.name, shade: data.areaShades[area.name.replace(/ Area$/, '')] ?? 0 })));

	/** One table of every office: the regions, their agencies and the Areas. */
	const columns: TableColumn[] = [
		{ key: 'office', header: 'Office', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
		{ key: 'partOf', header: 'Part of', sortable: true },
		{ key: 'address', header: 'Office address', sortable: true, custom: true },
		{ key: 'states', header: 'States', sortable: true, filterable: true, custom: true },
		{ key: 'nations', header: 'Nations', type: 'number', sortable: true }
	];
	const officeRow = (office: OfficePlace, kind: string, partOf: { text: string; href?: string }): TableRow => ({
		key: `${kind}-${office.key}`,
		cells: {
			office: { text: office.name, href: office.href },
			kind: { text: kind },
			partOf,
			address: { text: office.address ? office.address.lines.join('\n') : 'None Identified' },
			states: { text: office.states.join(', ') || 'None Identified', values: office.states },
			nations: { text: office.nations.length.toLocaleString('en-US'), sortValue: office.nations.length }
		}
	});
	const rows: TableRow[] = $derived([
		...data.regions.flatMap((region) => [officeRow(region, 'Region', { text: 'Bureau of Indian Affairs' }), ...region.agencies.map((office) => officeRow(office, 'Agency', { text: region.name, href: region.href }))]),
		...data.areas.map((area) => officeRow(area, 'Area', { text: 'Indian Health Service' }))
	]);
</script>

<svelte:head>
	<title>Federal offices · Nations · Tribal Law Project</title>
	<meta name="description" content="Which Bureau of Indian Affairs region and agency, and which Indian Health Service Area, serve each Native nation, and where their offices are." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Federal offices" />

<!-- The category patterns, drawn once for the key (src/lib/map-shapes.ts). -->
<svg class="pattern-definitions" aria-hidden="true" focusable="false"><defs>{@html patternDefinitions()}</defs></svg>

<h1>Federal offices that serve Native nations</h1>
<p class="lead">Which Bureau of Indian Affairs region and agency, and which Indian Health Service Area, serve each Native nation, and where their offices are. Pick a place on the map or find a nation.</p>

<div class="map-frame explorer-frame live-frame no-print" data-map-full-screen bind:clientWidth={frameWidth}>
	<div class="map-drawing" class:tiled={tileMapReady}>
		<div class="tile-holder">
			<TileMap
				bind:this={tileMap}
				view={agency === 'health' ? 'indian-health-service' : 'lands'}
				label={mapLabel}
				bind:shape={mapShape}
				onselect={(anchor) => {
					tileMap?.clearFound();
					select(anchor);
				}}
				layerSwitches={layers}
				statesBy=""
				bind:baseMap
				outlines={true}
				{pins}
				onready={() => (tileMapReady = true)}
				onfail={() => (tileMapReady = false)}
			/>
		</div>
	</div>
	{#if tileMapReady}
		<div class="explorer">
			<MapExplorer
				{layers}
				cessions={false}
				colorBy=""
				colorChoices={[]}
				statesColor=""
				statesColorChoices={[]}
				bind:baseMap
				year={undefined}
				first={2026}
				last={2026}
				marks={[]}
				timeline={false}
				searchLabel="Find a nation or office"
				places={searchChoices}
				onplace={onSearch}
				key={explorerKey}
				details={details ? explorerDetails : undefined}
				{switcher}
			/>
		</div>
	{/if}
</div>

{#snippet switcher()}
	<div class="office-switch map-float" role="group" aria-label="Show the offices of">
		{#each agencies as choice (choice.value)}
			<button type="button" aria-pressed={agency === choice.value} onclick={() => (agency = choice.value)}>{choice.label}</button>
		{/each}
	</div>
{/snippet}

{#snippet categorySwatch(shade: number)}
	{@const shape = shapeFor(shade)}
	{#if shape}
		<svg class="shape-swatch" viewBox="0 0 44 20" aria-hidden="true"><rect class="area-swatch" x="0.5" y="2.5" width="19" height="15" style:fill={patternFor(shade) ? `url(#area-pattern-${shade})` : `var(--color-map-class-${shade})`} /><path d={shapePath(shape, 33, 10, 6)} style:fill="var(--color-map-class-{shade})" /></svg>
	{:else}
		<span class="swatch count-0" aria-hidden="true"></span>
	{/if}
{/snippet}

{#snippet explorerKey()}
	<ul class="map-key" aria-label="Key">
		{#if agency === 'bureau'}
			{#each data.landAreaGroups as group (group.key)}
				<li>{@render categorySwatch(landGroupShade[group.key] ?? 0)}{group.label}</li>
			{/each}
			<li><span class="swatch region" aria-hidden="true"></span>Bureau of Indian Affairs region</li>
			<li><span class="pin-swatch" aria-hidden="true"></span>Regional office</li>
		{:else}
			{#each areaLegend as entry (entry.name)}
				<li>{@render categorySwatch(entry.shade)}{entry.name}</li>
			{/each}
			<li><span class="swatch count-0" aria-hidden="true"></span>No Area recorded yet</li>
		{/if}
	</ul>
	<p class="key-note">{agency === 'bureau' ? 'Region lines are simplified for a national map.' : 'Each nation’s land is shaded by the Indian Health Service Area its entry names.'}</p>
{/snippet}

{#snippet explorerDetails()}
	{#if details}
		<MapDetails {details} back={{ label: 'Close', onclick: () => (chosen = undefined) }} />
	{/if}
{/snippet}

<DataTable identifier="offices" label="Table: offices" {columns} {rows} defaultSort={{ key: 'nations', direction: 'descending' }} rowName={['office', 'offices']} download="federal-offices" filters shareable count={false}>
	{#snippet heading(count)}<h2 id="offices">Offices {@render count()}</h2>{/snippet}
	{#snippet cell(row: TableRow, column: TableColumn)}
		{@const text = row.cells[column.key]?.text ?? ''}
		{#if column.key === 'address'}
			{#each text.split('\n') as line, index (index)}{#if index > 0}<br />{/if}{line}{/each}
		{:else if column.key === 'states'}
			{@const names = row.cells.states?.values ?? []}
			{#if names.length > 3}
				{names.slice(0, 3).join(', ')}<br /><span class="muted">and {names.length - 3} more</span>
			{:else}
				{text}
			{/if}
		{/if}
	{/snippet}
</DataTable>

<SourceList sources={data.sources} />

<style>
	.lead {
		max-width: none;
	}

	.map-frame {
		container: map-frame / inline-size;
		position: relative;
	}

	.live-frame {
		margin: var(--space-5) 0;
	}

	/* Without scripts there is no map, so the table is the page. */
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

		.explorer-frame :global(.tile-holder) {
			height: 100%;
		}
	}

	/* The controls cover the map but let the reader reach it between them. */
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

	/* The switch between the two agencies, in the Layers button's place: two buttons joined, the chosen one in the action color. */
	.office-switch {
		display: inline-flex;
		min-height: var(--layout-target-minimum);
		overflow: hidden;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
	}

	.office-switch button {
		display: inline-flex;
		align-items: center;
		padding: 0 var(--space-3);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--font-weight-bold);
		white-space: nowrap;
		cursor: pointer;
	}

	.office-switch button + button {
		border-left: 1px solid var(--color-control-border);
	}

	.office-switch button[aria-pressed='true'] {
		background: var(--color-action);
		color: var(--color-action-text);
	}

	.office-switch button:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: -3px;
	}

	@media (max-width: 40rem) {
		.office-switch {
			max-width: calc(100vw - var(--layout-target-minimum) * 2 - var(--space-3) * 4);
		}

		.office-switch button {
			padding: var(--space-1) var(--space-2);
			font-size: var(--font-size-small);
			line-height: 1.15;
			text-align: left;
			white-space: normal;
		}
	}

	.map-key {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.map-key li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.key-note {
		max-width: 17rem;
		margin: var(--space-1) 0 0;
		color: var(--color-ink-muted);
		line-height: 1.4;
	}

	.swatch {
		display: inline-block;
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--color-control-border);
	}

	.swatch.count-0 {
		background: var(--color-map-class-0);
	}

	.swatch.region {
		border: 2px solid var(--color-action);
		background: transparent;
	}

	/* The regional office's pin, as on the map: the action color with a paper ring. */
	.pin-swatch {
		flex: none;
		width: 14px;
		height: 14px;
		margin-inline: 3px;
		border: 2px solid var(--color-paper);
		border-radius: 50%;
		background: var(--color-action);
		box-shadow: 0 0 0 1px var(--color-action);
	}

	.shape-swatch {
		flex: none;
		width: 2.75rem;
		height: 1.25rem;
	}

	.shape-swatch .area-swatch {
		stroke: var(--color-control-border);
		stroke-width: 1;
	}

	.shape-swatch path {
		stroke: var(--color-ink);
		stroke-width: 1.2;
	}

	.pattern-definitions {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}
</style>
