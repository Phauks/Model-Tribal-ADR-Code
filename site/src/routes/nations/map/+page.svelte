<script lang="ts">
	import { onMount, tick } from 'svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import type { RecognitionBadge } from '#lib/recognition-badges.ts';
	import { replaceState } from '$app/navigation';
	import DataTable from '#lib/components/DataTable.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import ZoomableMap from '#lib/components/ZoomableMap.svelte';
	import type { NationsMapView } from '#lib/nations-map-drawing.ts';
	import type { LandAreaRow } from '#lib/server/nations-map.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * The views of the one map, in the order of their buttons. Map titles are
	 * in title case (Trevor, 2026-11-22). A new view needs
	 * an entry here, a drawing in src/lib/nations-map-drawing.ts and a snippet
	 * below for what goes under the map.
	 */
	const views: { key: NationsMapView; label: string; heading: string }[] = [
		{ key: 'states', label: 'Nations by State', heading: 'by-state-heading' },
		{ key: 'regions', label: 'Bureau of Indian Affairs Regions', heading: 'bureau-of-indian-affairs-regions' },
		{ key: 'lands', label: 'Land Areas', heading: 'land-areas' }
	];
	let current = $state<NationsMapView>('states');

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

	$effect(() => {
		if (current === 'lands' && !lands) void loadLands();
	});
	let tabs: HTMLButtonElement[] = $state([]);

	function choose(index: number, remember = true): void {
		const view = views[(index + views.length) % views.length];
		current = view.key;
		tabs[views.indexOf(view)]?.focus();
		if (remember) replaceState(view.key === views[0].key ? '' : `?view=${view.key}`, {});
	}

	function onTabKey(event: KeyboardEvent, index: number): void {
		const moves: Record<string, number> = {
			ArrowRight: index + 1,
			ArrowLeft: index - 1,
			Home: 0,
			End: views.length - 1
		};
		if (event.key in moves) {
			event.preventDefault();
			choose(moves[event.key]);
		}
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
		// A land area's row exists only once the view has been fetched.
		const view = anchor.startsWith('land-area-') ? 'lands' : (panel?.dataset.mapView ?? named);
		if (!view || !views.some((entry) => entry.key === view)) return;
		current = view as NationsMapView;
		if (view === 'lands') await loadLands();
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
			...(lands?.rows ?? []).map((row) => [row.anchor, row.nations] as const)
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

	const landAreaColumns: TableColumn[] = [
		{ key: 'area', header: 'Area', isRowHeader: true, sortable: true, custom: true },
		{ key: 'kind', header: 'Kind', sortable: true },
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
			.map-view-tabs {
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

<div class="map-view-tabs" role="tablist" aria-label="Map views">
	{#each views as view, index (view.key)}
		{@const isCurrent = view.key === current}
		<button
			bind:this={tabs[index]}
			type="button"
			role="tab"
			id="map-tab-{view.key}"
			aria-selected={isCurrent}
			aria-controls="map-view-{view.key}"
			tabindex={isCurrent ? 0 : -1}
			onclick={() => choose(index)}
			onkeydown={(event) => onTabKey(event, index)}
		>
			{view.label}
		</button>
	{/each}
</div>

{#each views as view (view.key)}
	<div
		class="map-view"
		id="map-view-{view.key}"
		data-map-view={view.key}
		role="tabpanel"
		aria-labelledby="map-tab-{view.key}"
		hidden={view.key !== current}
	>
		<h2 id={view.heading} class="view-heading">{view.label}</h2>
		<figure class="map-figure" data-print-part="maps">
			<div class="map-drawing" data-nations-map={view.key === 'states' ? '' : undefined}>
				<ZoomableMap label={view.label} maximum={view.key === 'lands' ? 16 : 8}>
					{#if view.key === 'lands'}
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
			{#if view.key === 'states'}
				<figcaption>
					<ul class="legend" aria-label="Key">
						{#each data.countClasses as entry (entry.key)}
							<li><span class="swatch count-{entry.key}" aria-hidden="true"></span>{entry.label}</li>
						{/each}
					</ul>
				</figcaption>
			{:else if view.key === 'lands'}
				<figcaption>
					<ul class="legend" aria-label="Key">
						{#each data.landAreaGroups as group (group.key)}
							<li><span class="swatch land-{group.key}" aria-hidden="true"></span>{group.label}</li>
						{/each}
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
					label="Table: nations by state"
					caption="Nations with a recorded presence, by state and territory"
					columns={stateColumns}
					rows={stateRows}
					defaultSort={{ key: 'state', direction: 'ascending' }}
					{cell}
				/>
			{:else if view.key === 'lands'}
				<p class="small muted map-note">
					Select an area to go to its row in the table, which lists the nations whose entries name it. Areas too small to see at this scale are marked with a dot. Outlines are from the Census Bureau’s 2020 cartographic boundary file, simplified for a national map. {@render insetNote()}
				</p>
				{#if lands}
					<DataTable
						identifier="land-areas"
						label="Table: land areas"
						caption="American Indian and Alaska Native areas in the 2020 census, and the nations whose entries name them"
						columns={landAreaColumns}
						rows={landAreaRows}
						defaultSort={{ key: 'area', direction: 'ascending' }}
						{cell}
					/>
				{/if}
			{:else if view.key === 'regions'}
				<p class="small muted map-note">
					Select a region to go to its row in the table. Hawaiʻi, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands are in no region. Lines are simplified for a national map. {@render insetNote()}
				</p>
				<DataTable
					identifier="regions"
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

{#snippet insetNote()}
	Alaska, Hawaiʻi, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands are in the boxes below, each drawn at its own scale and not in its true place.
{/snippet}

<div class="reading">
	<SourceList sources={data.sources} />
</div>

<style>
	.map-view-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-5) 0 var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	.map-view-tabs button {
		min-height: var(--layout-target-minimum);
		padding: var(--space-2) var(--space-4);
		border: 0;
		border-bottom: 4px solid transparent;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}

	.map-view-tabs button:hover {
		text-decoration: underline;
	}

	/* The chosen view is marked by weight and a bar, not color alone. */
	.map-view-tabs button[aria-selected='true'] {
		border-bottom-color: var(--color-action);
		font-weight: var(--font-weight-bold);
	}

	/* The buttons already name the view; the heading stays for screen readers, outlines and print. */
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
		.map-view-tabs {
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
		max-width: 975px;
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
