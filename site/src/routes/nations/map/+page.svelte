<script lang="ts">
	import { onMount, tick } from 'svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import type { RecognitionBadge } from '#lib/recognition-badges.ts';
	import { replaceState } from '$app/navigation';
	import DataTable from '#lib/components/DataTable.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import { mapViewChoices, mapViews } from '#lib/map-views.ts';
	import TileMap, { type TileMapCamera } from '#lib/components/TileMap.svelte';
	import ZoomableMap from '#lib/components/ZoomableMap.svelte';
	import type { NationsMapView } from '#lib/nations-map-drawing.ts';
	import type { LandAreaRow, ShadedViewData } from '#lib/server/nations-map.ts';
	import { isShadedMapView, shadedMapViews, type ShadedMapView } from '#lib/shaded-map-views.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * The views of the one map, picked from a searchable dropdown (Trevor, 2026-11-23) and listed in src/lib/map-views.ts. A new view needs an entry there, a drawing in src/lib/nations-map-drawing.ts and a snippet below for what goes under the map.
	 */
	const views = mapViews;
	let current = $state<NationsMapView>('states');

	/**
	 * The map is drawn with MapLibre from the project's own tiles where the device can (decision record 0039). The drawn map underneath stays for printing, and takes over if MapLibre cannot start, so a reader always has a map. Changing views keeps the reader's place.
	 */
	let tileMapWanted = $state(true);
	let tileMapReady = $state(false);
	let tileMapCamera = $state<TileMapCamera | undefined>();

	/**
	 * The "Land areas" view is fetched the first time it is shown, because its
	 * outlines are heavier than the rest of the page together.
	 */
	let lands = $state<{ drawing: string; rows: LandAreaRow[] } | undefined>();
	let landsFailed = $state(false);
	let landsLoading: Promise<void> | undefined;

	function loadLands(): Promise<void> {
		landsLoading ??= fetch('/nations/map/land-areas.json')
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json();
			})
			.then((body) => {
				lands = body;
			})
			.catch(() => {
				landsFailed = true;
				landsLoading = undefined;
			});
		return landsLoading;
	}

	/**
	 * The views that shade the land areas by a fact about their nations, such as Public Law 280 (src/lib/shaded-map-views.ts), are fetched the same way, each the first time it is shown.
	 */
	type ShadedBody = Omit<ShadedViewData, 'drawn' | 'labels'> & { drawing: string };
	let shaded = $state<Partial<Record<ShadedMapView, ShadedBody>>>({});
	let shadedFailed = $state<Partial<Record<ShadedMapView, boolean>>>({});
	const shadedLoading = new Map<ShadedMapView, Promise<void>>();

	function loadShaded(view: ShadedMapView): Promise<void> {
		let loading = shadedLoading.get(view);
		if (!loading) {
			shadedFailed[view] = false;
			loading = fetch(`/nations/map/views/${view}.json`)
				.then((response) => {
					if (!response.ok) throw new Error(String(response.status));
					return response.json();
				})
				.then((body: ShadedBody) => {
					shaded[view] = body;
				})
				.catch(() => {
					shadedFailed[view] = true;
					shadedLoading.delete(view);
				});
			shadedLoading.set(view, loading);
		}
		return loading;
	}

	$effect(() => {
		if (current === 'lands' && !lands) void loadLands();
		if (isShadedMapView(current) && !shaded[current]) void loadShaded(current);
	});
	function choose(key: NationsMapView): void {
		current = key;
		replaceState(key === views[0].key ? location.pathname : `?view=${key}`, {});
	}

	/**
	 * Shows the view that holds the part of the page the address points to,
	 * such as a region's row linked from a nation's page, or the view named in
	 * "?view=" when the reader shared a view.
	 */
	async function showAddressedView(): Promise<void> {
		const anchor = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
		let target = anchor ? document.getElementById(anchor) : null;
		const panel = target?.closest<HTMLElement>('[data-map-view]');
		const named = new URLSearchParams(location.search).get('view');
		// A land area's row, and a shaded view's row, exist only once the view has been fetched; their ids start with the view's key.
		const shadedView = shadedMapViews.find((key) => anchor.startsWith(`${key}-`));
		const view = anchor.startsWith('land-area-') ? 'lands' : (shadedView ?? panel?.dataset.mapView ?? named);
		if (!view || !views.some((entry) => entry.key === view)) return;
		current = view as NationsMapView;
		if (view === 'lands') await loadLands();
		if (isShadedMapView(view)) await loadShaded(view);
		await tick();
		target ??= anchor ? document.getElementById(anchor) : null;
		// A row reached from the map opens to show its nations.
		target?.querySelector('details.row-names')?.setAttribute('open', '');
		target?.scrollIntoView();
	}

	onMount(() => {
		void showAddressedView();
		const onHashChange = () => void showAddressedView();
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	});

	type ListedNation = { id: string; name: string; badges?: RecognitionBadge[] };
	const nationsByRow = $derived(
		new Map<string, ListedNation[]>([
			...data.stateRows.map((row) => [`state-${row.code}`, row.nations] as const),
			...data.regionRows.map((row) => [row.anchor, row.nations] as const),
			...(lands?.rows ?? []).map((row) => [row.anchor, row.nations] as const),
			...Object.values(shaded).flatMap((body) => body.areaRows.map((row) => [row.anchor, row.nations] as const))
		])
	);

	const stateColumns: TableColumn[] = [
		{ key: 'state', header: 'State or territory', isRowHeader: true, sortable: true, custom: true },
		{ key: 'count', header: 'Nations', type: 'number', sortable: true }
	];
	const stateRows: TableRow[] = $derived(
		data.stateRows.map((row) => ({
			key: `state-${row.code}`,
			anchor: `state-${row.code}`,
			cells: {
				state: { text: row.name },
				count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length }
			}
		}))
	);

	const regionColumns: TableColumn[] = [
		{ key: 'region', header: 'Region', isRowHeader: true, sortable: true, custom: true },
		{ key: 'count', header: 'Nations', type: 'number', sortable: true }
	];
	const regionRows: TableRow[] = $derived(
		data.regionRows.map((row) => ({
			key: row.anchor,
			anchor: row.anchor,
			cells: {
				region: { text: row.name },
				count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length },
				// Not a column: shown when the region's row is opened.
				states: { text: row.states.join(', ') }
			}
		}))
	);

	/** The Public Law 280 and Violence Against Women Act tables list nations; each name goes to the nation's Jurisdiction section, which has the facts and their sources. */
	function nationColumns(body: ShadedBody): TableColumn[] {
		const first: TableColumn[] = [
			{ key: 'nation', header: 'Nation', isRowHeader: true, sortable: true },
			{ key: 'states', header: 'States', sortable: true, filterable: true }
		];
		// Some tables say which kinds each nation has, one Yes column each, since the map can shade only one.
		if (body.kindColumns.length > 0) {
			return [...first, ...body.kindColumns.map((column) => ({ key: `kind-${column.key}`, header: column.header, sortable: true, filterable: true }))];
		}
		return [...first, { key: 'category', header: body.view === 'public-law-280' ? 'Summary' : 'Status', sortable: true, filterable: true }];
	}

	function nationRows(body: ShadedBody): TableRow[] {
		return body.nationRows.map((row) => ({
			key: row.anchor,
			anchor: row.anchor,
			cells: {
				nation: { text: row.name, href: `/nations/${row.id}#${body.section}` },
				states: { text: row.states.join(', '), values: row.states },
				category: { text: row.category },
				...Object.fromEntries(body.kindColumns.map((column) => [`kind-${column.key}`, { text: (row.kinds as Record<string, boolean>)[column.key] ? 'Yes' : '' }]))
			}
		}));
	}

	const healthServiceColumns: TableColumn[] = [
		{ key: 'area', header: 'Area', isRowHeader: true, sortable: true, custom: true },
		{ key: 'count', header: 'Nations', type: 'number', sortable: true }
	];

	function healthServiceRows(body: ShadedBody): TableRow[] {
		return body.areaRows.map((row) => ({
			key: row.anchor,
			anchor: row.anchor,
			cells: {
				area: { text: row.name },
				count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length },
				// Not a column: shown when the Area's row is opened.
				states: { text: row.states.join(', ') }
			}
		}));
	}

	const landAreaColumns: TableColumn[] = [
		{ key: 'area', header: 'Area', isRowHeader: true, sortable: true, custom: true },
		{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
		{ key: 'count', header: 'Nations linked', type: 'number', sortable: true }
	];
	const landAreaRows: TableRow[] = $derived(
		(lands?.rows ?? []).map((row) => ({
			key: row.anchor,
			anchor: row.anchor,
			cells: {
				area: { text: row.name },
				kind: { text: row.kindLabel },
				count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length }
			}
		}))
	);
</script>

<!--
	A row's name opens the list of its nations, with the arrow before the
	name (Trevor, 2026-11-22). The count is already in its own column, so the
	name is all the row needs. A row with no nations has nothing to open.
-->
{#snippet cell(row: TableRow, column: TableColumn)}
	{@const nations = nationsByRow.get(row.key) ?? []}
	{@const name = row.cells[column.key]?.text ?? ''}
	{#if nations.length === 0}
		<span class="row-name-only">{name}</span>
	{:else}
		<details class="row-names">
			<summary>{name}</summary>
			{#if row.cells.states?.text}
				<p class="small">States where these nations have a presence: {row.cells.states.text}</p>
			{/if}
			<ul>
				{#each nations as nation (nation.id)}
					<li>
						<a href="/nations/{nation.id}">{nation.name}</a>{#if nation.badges}{' '}<RecognitionBadges
								badges={nation.badges}
								size="small"
							/>{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
{/snippet}

<svelte:head>
	<title>Map · Nations · Model Tribal ADR Code</title>
	<!-- Without scripts the view buttons cannot work, so every view is shown, one after another. -->
	<noscript>
		<style>
			.map-view[hidden] {
				display: block !important;
			}
			.map-view-picker {
				display: none !important;
			}
		</style>
	</noscript>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › Map
</nav>

<div class="reading">
	<h1>Map of Native Nations</h1>
</div>

<div class="map-view-picker">
	<SearchableDropdown label="Map view" choices={mapViewChoices} value={current} onchange={choose} />
</div>

{#each views as view (view.key)}
	<div
		class="map-view"
		id="map-view-{view.key}"
		data-map-view={view.key}
		role="region"
		aria-labelledby={view.heading}
		hidden={view.key !== current}
	>
		<h2 id={view.heading} class="view-heading">{view.label}</h2>
		<figure class="map-figure" data-print-part="maps">
			<div class="map-drawing" class:tiled={tileMapReady && view.key === current} data-nations-map={view.key === 'states' ? '' : undefined}>
				{#if tileMapWanted && view.key === current}
					{#key view.key}
						<TileMap
							view={view.key}
							label={view.label}
							bind:camera={tileMapCamera}
							onready={() => (tileMapReady = true)}
							onfail={() => {
								tileMapWanted = false;
								tileMapReady = false;
							}}
						/>
					{/key}
				{/if}
				<div class="drawn-map">
				<ZoomableMap label={view.label} maximum={view.key === 'lands' ? 16 : 8}>
					{#if isShadedMapView(view.key)}
						{@const body = shaded[view.key]}
						{#if body}
							{@html body.drawing}
						{:else if shadedFailed[view.key]}
							<p class="map-status">This view could not be loaded. Check your connection and choose the view again.</p>
						{:else}
							<p class="map-status">Loading the view…</p>
							<noscript><p class="map-status">This view needs JavaScript to load its map and table.</p></noscript>
						{/if}
					{:else if view.key === 'lands'}
						{#if lands}
							{@html lands.drawing}
						{:else if landsFailed}
							<p class="map-status">The land areas could not be loaded. Check your connection and choose the view again.</p>
						{:else}
							<p class="map-status">Loading the land areas…</p>
							<noscript><p class="map-status">This view needs JavaScript to load its map and table.</p></noscript>
						{/if}
					{:else}
						<!-- svelte-ignore hydration_html_changed -->
						{@html data.drawings[view.key]}
					{/if}
				</ZoomableMap>
				</div>
			</div>
			{#if view.key === 'states'}
				<figcaption>
					<ul class="legend" aria-label="Key">
						{#each data.countClasses as entry (entry.key)}
							<li><span class="swatch count-{entry.key}" aria-hidden="true"></span>{entry.label}</li>
						{/each}
						{#if tileMapReady}{@render officeKey()}{/if}
					</ul>
				</figcaption>
			{:else if isShadedMapView(view.key) && shaded[view.key]}
				<figcaption>
					<ul class="legend" aria-label="Key">
						{#each shaded[view.key]?.legend ?? [] as entry (entry.key)}
							<li><span class="swatch count-{entry.shade}" aria-hidden="true"></span>{entry.label}</li>
						{/each}
						{@render officeKey()}
					</ul>
				</figcaption>
			{:else if view.key === 'lands'}
				<figcaption>
					<ul class="legend" aria-label="Key">
						{#each data.landAreaGroups as group (group.key)}
							<li><span class="swatch land-{group.key}" aria-hidden="true"></span>{group.label}</li>
						{/each}
						{@render officeKey()}
					</ul>
				</figcaption>
			{/if}
		</figure>
		<!-- Beside the map on wide screens, under it on narrow ones. -->
		<div class="map-side">
			{#if view.key === 'states'}
				<p class="small muted map-note">
					Select a state to go to its row in the table. Each nation’s states, with their sources, are on the nation’s own page. {@render insetNote()}
				</p>
				<DataTable
					identifier="nations-by-state"
					download="nations-by-state"
					label="Table: nations by state"
					caption="Nations with a recorded presence, by state and territory"
					columns={stateColumns}
					rows={stateRows}
					defaultSort={{ key: 'state', direction: 'ascending' }}
					{cell}
				/>
			{:else if view.key === 'lands'}
				<p class="small muted map-note">
					Select an area to go to its row in the table, which lists the nations whose entries name it. Areas too small to see at this scale are marked with a dot{tileMapReady ? ', and nearby dots are grouped into numbered circles until you zoom in' : ''}. Outlines are from the Census Bureau’s 2020 cartographic boundary file{tileMapReady ? '' : ', simplified for a national map'}. {@render officeNote()} Selecting one goes to the nation’s page. {@render insetNote()}
				</p>
				{#if lands}
					<DataTable
						identifier="land-areas"
						download="land-areas"
						filters
						label="Table: land areas"
						caption="American Indian and Alaska Native areas in the 2020 census, and the nations whose entries name them"
						columns={landAreaColumns}
						rows={landAreaRows}
						defaultSort={{ key: 'area', direction: 'ascending' }}
						{cell}
					/>
				{/if}
			{:else if isShadedMapView(view.key)}
				{@const body = shaded[view.key]}
				<p class="small muted map-note">
					{@render shadedNote(view.key)} {@render officeNote()} {@render insetNote()}
				</p>
				{#if body && view.key === 'indian-health-service'}
					<DataTable
						identifier="indian-health-service-areas"
						download="indian-health-service-areas"
						label="Table: Indian Health Service Areas"
						caption="Nations each Indian Health Service Area serves, as each nation’s entry records it"
						columns={healthServiceColumns}
						rows={healthServiceRows(body)}
						defaultSort={{ key: 'area', direction: 'ascending' }}
						{cell}
					/>
				{:else if body}
					<DataTable
						identifier={view.key}
						download={view.key}
						filters
						label="Table: {view.label}"
						caption={view.key === 'public-law-280'
							? 'Nations with a Public Law 280 fact recorded, and a summary of what the facts say'
							: view.key === 'courts-and-peacemaking'
								? 'Nations with a court or forum recorded, and which kinds'
								: view.key === 'other-jurisdiction-laws'
									? 'Nations under another federal law on jurisdiction, and which'
									: view.key === 'agreements-with-states'
										? 'Nations with an agreement recorded, and which kinds'
										: 'Nations recorded as exercising special Tribal criminal jurisdiction, or holding a grant to prepare for it'}
						columns={nationColumns(body)}
						rows={nationRows(body)}
						defaultSort={{ key: 'nation', direction: 'ascending' }}
					/>
				{/if}
			{:else if view.key === 'regions'}
				<p class="small muted map-note">
					Select a region to go to its row in the table. Hawaiʻi, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands are in no region. Lines are simplified for a national map. {@render insetNote()}
				</p>
				<DataTable
					identifier="regions"
					download="regions"
					label="Table: regions"
					caption="Nations each region serves, as the Bureau’s Tribal Leaders Directory lists them"
					columns={regionColumns}
					rows={regionRows}
					defaultSort={{ key: 'region', direction: 'ascending' }}
					{cell}
				/>
			{/if}
		</div>
	</div>
{/each}

{#snippet officeKey()}
	<li><span class="swatch office" aria-hidden="true"></span>Office of a nation with no Census land area</li>
{/snippet}

<!-- Said under every view that draws office dots: how many nations they mark, and how many are only in the tables. -->
{#snippet officeNote()}
	Ringed dots mark the offices of {data.offices.placed} nations with no Census land area, where their entries give an address; {data.offices.unplaced} more have neither, so they are not on the map; the Nations by State view lists every nation.
{/snippet}

{#snippet shadedNote(key: ShadedMapView)}
	{#if key === 'courts-and-peacemaking'}
		Each nation’s land areas are shaded by the first of these it has: peacemaking or a traditional forum, a healing to wellness court, a tribal court, or only a Court of Indian Offenses, which the Bureau of Indian Affairs runs. The table shows every kind each nation has. A nation missing here may still have a court: the record is only as complete as its sources. Each nation’s page lists its courts and forums, with their sources. Select an area to go to its nation’s row.
	{:else if key === 'other-jurisdiction-laws'}
		Each nation’s land areas are shaded by the first of these that applies to it: a federal law other than Public Law 280 that gives a state criminal or civil jurisdiction, such as the Kansas Act or a land claims settlement act; jurisdiction over child custody cases reassumed under the Indian Child Welfare Act (25 U.S.C. § 1918); or longer sentences under the Tribal Law and Order Act (25 U.S.C. § 1302(b)). The table shows every one each nation has. Each nation’s page has the facts and their sources. Select an area to go to its nation’s row.
	{:else if key === 'agreements-with-states'}
		Each nation’s land areas are shaded by the first kind of agreement it has with a state, county, city or federal agency: cross-deputization or law enforcement, child welfare, tax, or another kind. Most sources do not say whether an agreement is still in force; each nation’s page gives the agreement, the other party, its date and its sources. Select an area to go to its nation’s row.
	{:else if key === 'public-law-280'}
		Each nation’s land areas are shaded by one summary of its Public Law 280 facts. The summary is only a guide: what the state may do differs by subject, by state and over time, and some nations are in more than one state. Each nation’s page has the facts, the state each applies in and their sources. Nations with no land area on the map are still in the table. Select an area to go to its nation’s row.
	{:else if key === 'violence-against-women-act'}
		Shaded areas belong to nations that sources record as exercising special Tribal criminal jurisdiction over non-Indians under the Violence Against Women Act (25 U.S.C. § 1304), or as holding a federal grant to prepare for it. A grant can pay for planning, so it is never counted as exercising. A nation missing here may still exercise it: the record is only as complete as its sources. Select an area to go to its nation’s row.
	{:else}
		Each nation’s land areas are shaded by the Indian Health Service Area its entry names, and each Area’s name is written on the map. Neighboring Areas are given different shades. Select an area to go to its Area’s row, which lists its nations.
	{/if}
{/snippet}

{#snippet insetNote()}
	{#if tileMapReady}
		Alaska, Hawaiʻi, Puerto Rico, the U.S. Virgin Islands, Guam, the Northern Mariana Islands and American Samoa are in their true places; the buttons under the map go to each. Hold Ctrl or ⌘ and scroll, or pinch, to zoom.
	{:else}
		Alaska, Hawaiʻi, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands are in the boxes below, each drawn at its own scale and not in its true place.
	{/if}
{/snippet}

<div class="reading">
	<SourceList sources={data.sources} />
</div>

<style>
	.map-view-picker {
		margin: var(--space-5) 0 var(--space-4);
	}

	/* The dropdown already names the view; the heading stays for screen readers, outlines and print. */
	.view-heading {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media print {
		.map-view-picker {
			display: none;
		}

		.map-view[hidden] {
			display: block;
		}

		.view-heading {
			position: static;
			width: auto;
			height: auto;
			margin: var(--space-5) 0 0;
			overflow: visible;
			clip-path: none;
			white-space: normal;
		}
	}

	.map-status {
		padding: var(--space-6) 0;
		text-align: center;
	}

	.map-figure {
		margin: var(--space-5) 0;
	}

	.map-drawing {
		position: relative;
		max-width: 975px;
	}

	/*
	 * The MapLibre map (src/lib/components/TileMap.svelte) starts hidden on top of the drawn map, the same size, and replaces it on screen once its first view has loaded. Print always uses the drawn map.
	 */
	.map-drawing:not(.tiled) :global(.tile-map) {
		position: absolute;
		inset: 0 0 auto;
		visibility: hidden;
	}

	@media screen {
		.map-drawing.tiled .drawn-map {
			display: none;
		}
	}

	.map-note {
		margin: 0 0 var(--space-3);
	}

	/* Each row's name opens its nations; names without nations line up with the rest. */
	.row-names summary {
		cursor: pointer;
	}

	.row-name-only {
		display: inline-block;
		padding-left: 1.1em;
	}

	.row-names p,
	.row-names ul {
		margin: var(--space-2) 0 var(--space-1);
		font-weight: normal;
	}

	.row-names ul {
		padding-left: 1.1em;
	}

	/*
	 * Trevor chose on 2026-11-22 (mockup A, project files design/map-layout/)
	 * a smaller map pinned on the left with the table scrolling beside it, and
	 * zooming for detail. The map is sized to fit the window's height, using
	 * the drawing's shape (its viewBox is 975 by 883). On narrower screens the
	 * map is pinned to the top of the window and the table scrolls under it,
	 * when the window is tall enough to leave room for the table.
	 */
	@media screen and (min-width: 1100px) {
		.map-view:not([hidden]) {
			display: grid;
			grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
			gap: var(--space-6);
			align-items: start;
			margin-top: var(--space-5);
		}

		.map-figure {
			position: sticky;
			top: var(--space-3);
			margin: 0;
		}

		.map-drawing {
			max-width: min(975px, calc((100vh - 13rem) * 975 / 883));
		}
	}

	@media screen and (max-width: 1099.98px) and (min-height: 600px) {
		.map-figure {
			position: sticky;
			top: 0;
			z-index: 2;
			margin-bottom: var(--space-3);
			padding-bottom: var(--space-1);
			border-bottom: 1px solid var(--color-line);
			background: var(--color-paper);
		}

		.map-drawing {
			max-width: min(975px, calc(42vh * 975 / 883));
			margin-inline: auto;
		}

		.map-figure .legend {
			justify-content: center;
			margin: var(--space-1) 0;
			font-size: var(--font-size-small);
		}
	}

	.map-drawing :global(.map) {
		display: block;
		width: 100%;
		height: auto;
	}

	/* Line widths, text and dots are multiplied by --map-unzoom, which zooming
	   sets to 1 divided by the zoom (src/lib/components/ZoomableMap.svelte), so
	   they keep their size on screen while the shapes grow. */
	.map-drawing :global(.marker-line + circle) {
		r: calc(9px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.land-area.dot) {
		r: calc(3px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.state),
	.swatch {
		stroke: var(--color-control-border);
		stroke-width: calc(0.5px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.count-0) {
		fill: var(--color-map-class-0);
	}
	.swatch.count-0 {
		background: var(--color-map-class-0);
	}
	.map-drawing :global(.count-1) {
		fill: var(--color-map-class-1);
	}
	.swatch.count-1 {
		background: var(--color-map-class-1);
	}
	.map-drawing :global(.count-2) {
		fill: var(--color-map-class-2);
	}
	.swatch.count-2 {
		background: var(--color-map-class-2);
	}
	.map-drawing :global(.count-3) {
		fill: var(--color-map-class-3);
	}
	.swatch.count-3 {
		background: var(--color-map-class-3);
	}
	.map-drawing :global(.count-4) {
		fill: var(--color-map-class-4);
	}
	.swatch.count-4 {
		background: var(--color-map-class-4);
	}

	.map-drawing :global(.land) {
		fill: var(--color-map-class-0);
		stroke: var(--color-control-border);
		stroke-width: calc(0.5px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.land-federal),
	.swatch.land-federal {
		fill: var(--color-map-class-4);
		background: var(--color-map-class-4);
	}
	.map-drawing :global(.land-state),
	.swatch.land-state {
		fill: var(--color-map-class-3);
		background: var(--color-map-class-3);
	}
	.map-drawing :global(.land-statistical),
	.swatch.land-statistical {
		fill: var(--color-map-class-2);
		background: var(--color-map-class-2);
	}
	.map-drawing :global(.land-area) {
		stroke: var(--color-ink-muted);
		stroke-width: calc(0.4px * var(--map-unzoom, 1));
	}
	/* An office of a nation with no Census land area: a dot with a dark ring, as on the tiled map. */
	.map-drawing :global(.office) {
		r: calc(4px * var(--map-unzoom, 1));
		stroke: var(--color-ink);
		stroke-width: calc(1.5px * var(--map-unzoom, 1));
	}
	.map-drawing :global(a:hover .office),
	.map-drawing :global(a:focus .office) {
		fill: var(--color-focus);
	}
	.swatch.office {
		border: 2px solid var(--color-ink);
		border-radius: 50%;
		background: var(--color-map-class-0);
	}

	.map-drawing :global(.land-area.dot) {
		stroke: var(--color-paper);
		stroke-width: calc(0.8px * var(--map-unzoom, 1));
	}
	.map-drawing :global(a:hover .land-area),
	.map-drawing :global(a:focus .land-area) {
		fill: var(--color-focus);
	}

	.map-drawing :global(.region) {
		fill: var(--color-map-class-1);
	}

	.map-drawing :global(a:hover .state),
	.map-drawing :global(a:focus .state),
	.map-drawing :global(a:hover .region),
	.map-drawing :global(a:focus .region) {
		fill: var(--color-focus);
	}

	/* Small islands are only a few map units across, so on hover their outline
	   also gets a wide stroke in the focus color, and the line to their marker
	   darkens, so that the place itself visibly lights up. */
	.map-drawing :global(a:hover .island),
	.map-drawing :global(a:focus .island) {
		stroke: var(--color-focus);
		stroke-width: calc(3px * var(--map-unzoom, 1));
	}
	.map-drawing :global(a:hover .marker-line),
	.map-drawing :global(a:focus .marker-line),
	.map-drawing :global(.unlinked:hover .marker-line) {
		stroke: var(--color-ink);
		stroke-width: calc(1.2px * var(--map-unzoom, 1));
	}

	/* Places with no table row to go to are not links, but still outline on
	   hover so a reader sees which place the tooltip names. */
	.map-drawing :global(.unlinked:hover .state) {
		stroke: var(--color-ink);
		stroke-width: calc(1.5px * var(--map-unzoom, 1));
	}

	/* An invisible wide band around each small island that takes the pointer. */
	.map-drawing :global(.hit-area) {
		fill: none;
		stroke: transparent;
		stroke-width: calc(12px * var(--map-unzoom, 1));
		stroke-linejoin: round;
		pointer-events: stroke;
	}

	.map-drawing :global(.state-borders) {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: calc(0.6px * var(--map-unzoom, 1));
		stroke-linejoin: round;
	}

	.map-drawing :global(.state-borders.faint) {
		stroke: var(--color-line);
	}

	.map-drawing :global(.region-borders) {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: calc(1.6px * var(--map-unzoom, 1));
		stroke-linejoin: round;
	}

	.map-drawing :global(.marker-line) {
		stroke: var(--color-ink-muted);
		stroke-width: calc(0.8px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.map-label) {
		fill: var(--color-ink);
		font-family: var(--font-family-reading);
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: calc(3px * var(--map-unzoom, 1));
		stroke-linejoin: round;
	}

	.map-drawing :global(.marker-label) {
		font-size: calc(16px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.label-on-left) {
		text-anchor: end;
	}

	.map-drawing :global(.inset-frame) {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: calc(1px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.inset-label) {
		font-size: calc(14px * var(--map-unzoom, 1));
		font-weight: var(--font-weight-semibold);
	}

	.map-drawing :global(.scale-bar) {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: calc(1.5px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.scale-label) {
		font-size: calc(13px * var(--map-unzoom, 1));
	}

	.map-drawing :global(.region-label) {
		font-size: calc(17px * var(--map-unzoom, 1));
		font-weight: var(--font-weight-semibold);
		text-anchor: middle;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		display: inline-block;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--color-control-border);
	}
</style>
