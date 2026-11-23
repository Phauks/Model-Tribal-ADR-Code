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
	import { isShadedMapView, shadedMapViews, shadedViewDefinitions, type ShadedMapView } from '#lib/shaded-map-views.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { byStateColumns, byStateRows, categoryColumns, categoryRows, landAreaColumns, landAreaRows as buildLandAreaRows, mapTableFile, nationColumns, nationRows, regionColumns, regionRows as buildRegionRows, stateColumns, stateRows as buildStateRows } from '#lib/map-tables.ts';
	import { mapTableOnScreen } from '#lib/map-table-on-screen.svelte.ts';
	import X from '@lucide/svelte/icons/x';
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
	/** The tiled map's shape: flat (Web Mercator, which stretches places far from the equator, such as Alaska) or a globe, where every place keeps its true size (Trevor, 2026-11-23). */
	let mapShape = $state<'flat' | 'globe'>('flat');

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
	type ShadedBody = Omit<ShadedViewData, 'drawn' | 'labels' | 'drawnStates'> & { drawing: string; stateDrawing?: string };
	let shaded = $state<Partial<Record<ShadedMapView, ShadedBody>>>({});
	let shadedFailed = $state<Partial<Record<ShadedMapView, boolean>>>({});
	/** Whether each shaded view shows its nations' land areas or its states (Trevor, Nov. 23, 2026: a by-state variant of each view, since dots are hard to read). */
	let shownBy = $state<Partial<Record<ShadedMapView, 'nation' | 'state'>>>({});
	const byOf = (view: string): 'nation' | 'state' => (isShadedMapView(view) ? (shownBy[view] ?? 'nation') : 'nation');
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
		// A state's row is in the view's by-state table.
		if (shadedView && anchor.startsWith(`${shadedView}-state-`) && (shaded[shadedView]?.stateRows.length ?? 0) > 0) shownBy[shadedView] = 'state';
		await tick();
		target ??= anchor ? document.getElementById(anchor) : null;
		// A place named in the address, such as a region's row linked from a nation's page, opens its preview.
		if (anchor && previewOf(anchor)) void select(anchor);
		else target?.scrollIntoView();
	}

	onMount(() => {
		void showAddressedView();
		const onHashChange = () => void showAddressedView();
		window.addEventListener('hashchange', onHashChange);
		document.addEventListener('click', onDrawnClick);
		return () => {
			window.removeEventListener('hashchange', onHashChange);
			document.removeEventListener('click', onDrawnClick);
		};
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

	const stateRows: TableRow[] = $derived(buildStateRows(data.stateRows));
	const regionRows: TableRow[] = $derived(buildRegionRows(data.regionRows));
	const landAreaRows: TableRow[] = $derived(buildLandAreaRows(lands?.rows ?? []));

	// The Download menu offers the table of the view on screen.
	$effect(() => {
		const view = views.find((entry) => entry.key === current);
		const by = byOf(current);
		mapTableOnScreen.file = mapTableFile(current, by);
		mapTableOnScreen.label = `${view?.label ?? ''}${by === 'state' ? ' by State' : ''}`;
	});

	/**
	 * Selecting a place on the map opens a short preview of it beside the map, with a link to its full page (Trevor, 2026-11-23), rather than sending the reader down the table. A place's preview is keyed by its table row's id; a nation's, by "nation:" and its id.
	 */
	let preview = $state<string | undefined>();
	let previewHeading = $state<HTMLElement | undefined>();

	type PreviewLine = { label: string; value: string };
	type Preview = { kind: string; title: string; nation?: string; badges?: RecognitionBadge[]; lines: PreviewLine[]; nations?: ListedNation[]; page?: { href: string; label: string } };

	/** A nation's seal, website and contact, from its own small file (/nations/<id>/preview.json), fetched when its preview first opens. */
	type ContactLine = { label: string; lines: string[]; link?: string; external?: boolean };
	type NationDetail = { image?: { src: string; kind: string }; website?: ContactLine; office?: string; address?: ContactLine; phone?: ContactLine; email?: ContactLine };
	let nationDetails = $state<Record<string, NationDetail | null>>({});
	let hiddenImages = $state<Record<string, boolean>>({});
	function loadNationDetail(id: string): void {
		if (id in nationDetails) return;
		nationDetails[id] = null;
		fetch(`/nations/${id}/preview.json`)
			.then((response) => (response.ok ? (response.json() as Promise<NationDetail>) : undefined))
			.then((detail) => {
				if (detail) nationDetails[id] = detail;
			})
			.catch(() => {});
	}

	/** Every nation the page knows, with its states, from the table of nations by state. */
	const nationIndex = $derived.by(() => {
		const index = new Map<string, ListedNation & { states: string[] }>();
		for (const row of data.stateRows) {
			for (const nation of row.nations) {
				const entry = index.get(nation.id) ?? { ...nation, states: [] };
				entry.states.push(row.name);
				index.set(nation.id, entry);
			}
		}
		return index;
	});

	function previewOf(key: string): Preview | undefined {
		if (key.startsWith('nation:')) {
			const id = key.slice('nation:'.length);
			const nation = nationIndex.get(id);
			const body = isShadedMapView(current) ? shaded[current] : undefined;
			const row = body?.nationRows.find((entry) => entry.id === id);
			const lines: PreviewLine[] = [];
			if (body && row) {
				const definition = shadedViewDefinitions[body.view];
				const kinds = body.kindColumns.filter((column) => (row.kinds as Record<string, boolean>)[column.key]).map((column) => column.header);
				if (kinds.length > 0) lines.push({ label: views.find((entry) => entry.key === body.view)?.label ?? '', value: kinds.join('; ') });
				else lines.push({ label: definition.categoryHeader ?? views.find((entry) => entry.key === body.view)?.label ?? '', value: row.category });
			}
			const states = row?.states ?? nation?.states ?? [];
			if (states.length > 0) lines.push({ label: states.length === 1 ? 'State' : 'States', value: states.join(', ') });
			const name = row?.name ?? nation?.name;
			if (!name) return undefined;
			return { kind: 'Nation', title: name, nation: id, badges: nation?.badges, lines, page: { href: `/nations/${id}`, label: 'Open the nation’s page' } };
		}
		const state = data.stateRows.find((row) => `state-${row.code}` === key);
		if (state) return { kind: 'State or territory', title: state.name, lines: [], nations: state.nations, page: { href: `/nations/state/${state.code.toLowerCase()}`, label: 'Open the state’s page' } };
		const region = data.regionRows.find((row) => row.anchor === key);
		if (region) return { kind: 'Bureau of Indian Affairs region', title: region.name, lines: region.states.length > 0 ? [{ label: 'States', value: region.states.join(', ') }] : [], nations: region.nations };
		const area = lands?.rows.find((row) => row.anchor === key);
		if (area) return onlyNation({ kind: area.kindLabel, title: area.name, lines: [], nations: area.nations });
		for (const body of Object.values(shaded)) {
			const nationRow = body.nationRows.find((row) => row.anchor === key);
			if (nationRow) return previewOf(`nation:${nationRow.id}`);
			const definition = shadedViewDefinitions[body.view];
			const areaRow = body.areaRows.find((row) => row.anchor === key);
			if (areaRow) {
				const lines: PreviewLine[] = [];
				if (definition.valueHeader && areaRow.value !== undefined) lines.push({ label: definition.valueHeader, value: areaRow.value.toLocaleString('en-US') });
				if (areaRow.states.length > 0) lines.push({ label: 'States', value: areaRow.states.join(', ') });
				return onlyNation({ kind: definition.categoryHeader ?? 'Category', title: areaRow.name, lines, nations: areaRow.nations });
			}
			const stateRow = body.stateRows.find((row) => row.anchor === key);
			if (stateRow) {
				const counts = stateRow.counts as Record<string, number>;
				const lines = [{ label: 'Nations', value: stateRow.total.toLocaleString('en-US') }, ...body.stateColumns.filter((column) => (counts[column.key] ?? 0) > 0).map((column) => ({ label: column.header, value: (counts[column.key] ?? 0).toLocaleString('en-US') }))];
				return { kind: 'State or territory', title: stateRow.name, lines, page: { href: `/nations/state/${stateRow.code.toLowerCase()}`, label: 'Open the state’s page' } };
			}
		}
		return undefined;
	}

	/** A place that only one nation's entry names opens that nation's preview, which names the place. */
	function onlyNation(place: Preview): Preview {
		const only = place.nations?.length === 1 ? place.nations[0] : undefined;
		const nation = only ? previewOf(`nation:${only.id}`) : undefined;
		if (!nation) return place;
		return { ...nation, lines: [{ label: place.kind, value: place.title }, ...place.lines.filter((line) => line.label !== 'States'), ...nation.lines] };
	}

	const shownPreview = $derived(preview ? previewOf(preview) : undefined);
	$effect(() => {
		if (shownPreview?.nation) loadNationDetail(shownPreview.nation);
	});

	/** Opens a place's or nation's preview, keeping its row's id in the address so the link can be shared. */
	async function select(key: string): Promise<void> {
		if (key.startsWith('/nations/')) key = `nation:${key.slice('/nations/'.length)}`;
		preview = key;
		if (!key.startsWith('nation:') && location.hash !== `#${key}`) history.replaceState(history.state, '', `#${key}`);
		await tick();
		previewHeading?.focus({ preventScroll: true });
		previewHeading?.closest('aside')?.scrollIntoView({ block: 'nearest' });
	}

	let tileHolder = $state<HTMLElement | undefined>();

	/** Puts the tiled map into the view on screen. */
	function placeTileMap(key: NationsMapView) {
		return (node: HTMLElement) => {
			if (key === current && tileHolder && tileHolder.parentElement !== node) node.prepend(tileHolder);
		};
	}

	/** A place on the drawn map is a link to its row; it opens the preview instead. */
	function onDrawnClick(event: MouseEvent): void {
		const link = (event.target as Element | null)?.closest?.('.drawn-map a[href^="#"]');
		if (!link) return;
		event.preventDefault();
		void select(decodeURIComponent((link.getAttribute('href') ?? '').slice(1)));
	}
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
		<!-- The view, and how it is shown, are chosen on the map itself (Trevor, 2026-11-23). -->
		<div class="map-toolbar no-print">
		{#if view.key === current}
			<div class="map-view-picker">
				<SearchableDropdown label="Map view" choices={mapViewChoices} value={current} onchange={choose} />
			</div>
		{/if}
		{#if isShadedMapView(view.key) && (shaded[view.key]?.stateRows.length ?? 0) > 0}
			{@const key = view.key}
			<fieldset class="shown-by">
				<legend class="small">Show by</legend>
				<div class="shown-by-choices">
					{#each [{ value: 'nation', label: 'Nation' }, { value: 'state', label: 'State' }] as choice (choice.value)}
						<label class="shown-by-choice">
							<input class="visually-hidden" type="radio" name="shown-by-{key}" value={choice.value} checked={byOf(key) === choice.value} onchange={() => (shownBy[key] = choice.value as 'nation' | 'state')} />
							{choice.label}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
		</div>
			<div class="map-drawing" {@attach placeTileMap(view.key)} class:tiled={tileMapReady && view.key === current} class:waiting={tileMapWanted && !tileMapReady && view.key === current} data-nations-map={view.key === 'states' ? '' : undefined}>
				<p class="map-loading small muted" aria-hidden="true">Loading the map…</p>
				<div class="drawn-map">
				<ZoomableMap label={view.label} maximum={view.key === 'lands' ? 16 : 8}>
					{#if isShadedMapView(view.key)}
						{@const body = shaded[view.key]}
						{#if body && byOf(view.key) === 'state' && body.stateDrawing}
							{@html body.stateDrawing}
						{:else if body}
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
						{#if byOf(view.key) === 'nation'}{@render officeKey()}{/if}
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
			{#if view.key === current && shownPreview}
				{@const detail = shownPreview.nation ? nationDetails[shownPreview.nation] : undefined}
				<aside class="map-preview" aria-labelledby="map-preview-title">
					<div class="preview-top">
						<p class="small muted preview-kind">{shownPreview.kind}</p>
						<button type="button" class="icon-button preview-close" aria-label="Close the preview" title="Close" onclick={() => (preview = undefined)}>
							<X aria-hidden="true" size={20} />
						</button>
					</div>
					<div class="preview-head">
						{#if detail?.image && shownPreview.nation && !hiddenImages[shownPreview.nation]}
							{@const id = shownPreview.nation}
							<img class="preview-image" src={detail.image.src} alt="{detail.image.kind} of {shownPreview.title}" width="64" height="64" onerror={() => (hiddenImages[id] = true)} />
						{/if}
						<h3 id="map-preview-title" tabindex="-1" bind:this={previewHeading}>
							{shownPreview.title}{#if shownPreview.badges}{' '}<RecognitionBadges badges={shownPreview.badges} size="small" />{/if}
						</h3>
					</div>
					{#if shownPreview.lines.length > 0}
						<dl class="preview-facts">
							{#each shownPreview.lines as line (line.label)}
								<div><dt>{line.label}</dt><dd>{line.value}</dd></div>
							{/each}
						</dl>
					{/if}
					{#if detail && (detail.website || detail.address || detail.phone || detail.email)}
						<dl class="preview-facts preview-contact">
							{#each [detail.website, detail.address, detail.phone, detail.email] as contact, index (index)}
								{#if contact}
									<div>
										<dt>{contact.label}</dt>
										<dd>
											{#if contact.link}
												<a href={contact.link} target={contact.external ? '_blank' : undefined} rel={contact.external ? 'noopener noreferrer' : undefined}>{#each contact.lines as line, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{line}{/each}</a>
											{:else}
												{#each contact.lines as line, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{line}{/each}
											{/if}
										</dd>
									</div>
								{/if}
							{/each}
						</dl>
					{/if}
					{#if shownPreview.nations && shownPreview.nations.length > 0}
						<p class="small preview-count">{shownPreview.nations.length.toLocaleString('en-US')} {shownPreview.nations.length === 1 ? 'nation' : 'nations'}</p>
						<ul class="preview-nations">
							{#each shownPreview.nations as nation (nation.id)}
								<li><button type="button" class="link-button" onclick={() => void select(`nation:${nation.id}`)}>{nation.name}</button></li>
							{/each}
						</ul>
					{/if}
					{#if shownPreview.page}
						<p class="preview-actions"><a class="button" href={shownPreview.page.href}>{shownPreview.page.label}</a></p>
					{/if}
				</aside>
			{/if}
			{#if view.key === 'states'}
				<DataTable
					identifier="nations-by-state"
					count={false}
					label="Table: nations by state"
					caption="Nations with a recorded presence, by state and territory"
					columns={stateColumns}
					rows={stateRows}
					defaultSort={{ key: 'state', direction: 'ascending' }}
					{cell}
				/>
			{:else if view.key === 'lands'}
				{#if lands}
					<DataTable
						identifier="land-areas"
						count={false}
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
				{@const definition = shadedViewDefinitions[view.key]}
				{#if byOf(view.key) === 'state'}
					<p class="small muted map-note">
						Each state is shaded by what most of its nations have, counting nations with nothing recorded. A nation in more than one state counts in each, except that a fact naming one state, such as a gaming compact, an agreement or state recognition, counts only there.
					</p>
				{:else}
					<p class="small muted map-note">
						{definition.note}
					</p>
				{/if}
				{#if body && byOf(view.key) === 'state'}
					<div class="by-state-table">
					<DataTable
						identifier="{view.key}-by-state"
						count={false}
						label="Table: {view.label}, by state"
						caption="{view.label}: how many of each state’s nations have each category"
						columns={byStateColumns(body)}
						rows={byStateRows(body)}
						defaultSort={{ key: 'state', direction: 'ascending' }}
					/>
					</div>
				{:else if body && definition.rows !== 'nations'}
					<DataTable
						identifier={view.key}
						count={false}
						label="Table: {view.label}"
						caption={definition.caption}
						columns={categoryColumns(body)}
						rows={categoryRows(body)}
						defaultSort={{ key: 'area', direction: 'ascending' }}
						{cell}
					/>
				{:else if body}
					<DataTable
						identifier={view.key}
						count={false}
						filters
						label="Table: {view.label}"
						caption={definition.caption}
						columns={nationColumns(body)}
						rows={nationRows(body)}
						defaultSort={{ key: 'nation', direction: 'ascending' }}
					/>
				{/if}
			{:else if view.key === 'regions'}
				<DataTable
					identifier="regions"
					count={false}
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

<!-- The one tiled map, moved into the view on screen, so changing the view keeps the map, its place and its tiles (Trevor, 2026-11-23). -->
<div class="tile-map-home">
	{#if tileMapWanted}
		<div class="tile-holder" bind:this={tileHolder}>
			<TileMap
				view={current}
				by={byOf(current)}
				label={byOf(current) === 'state' ? `${views.find((entry) => entry.key === current)?.label ?? ''}, by state` : (views.find((entry) => entry.key === current)?.label ?? '')}
				bind:shape={mapShape}
				bind:camera={tileMapCamera}
				onselect={(anchor) => void select(anchor)}
				onready={() => (tileMapReady = true)}
				onfail={() => {
					tileMapWanted = false;
					tileMapReady = false;
				}}
			/>
		</div>
	{/if}
</div>

{#snippet officeKey()}
	<li><span class="swatch office" aria-hidden="true"></span>Office of a nation with no Census land area</li>
{/snippet}


<div class="reading">
	<SourceList sources={data.sources} />
</div>

<style>
	/* The view picker and the switches sit on top of the map, as part of it. */
	.map-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3) var(--space-5);
		margin: 0 0 var(--space-3);
	}

	.map-view-picker {
		flex: 1 1 16rem;
		max-width: 24rem;
	}

	/* A selected place's preview stays in view beside the map while the table scrolls under it. */
	.map-preview {
		position: sticky;
		top: var(--space-3);
		z-index: 3;
		margin: 0 0 var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
	}

	.preview-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
	}

	.preview-kind {
		margin: 0;
	}

	.preview-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
	}

	/* The nation's seal or logo, where it may be shown. */
	.preview-image {
		flex: none;
		width: 64px;
		height: 64px;
		object-fit: contain;
	}

	.map-preview h3 {
		margin: 0;
	}

	.preview-contact {
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.preview-contact a {
		overflow-wrap: anywhere;
	}

	.preview-facts {
		margin: 0 0 var(--space-3);
	}

	.preview-facts div {
		margin: 0 0 var(--space-1);
	}

	.preview-facts dt {
		font-weight: var(--font-weight-semibold);
	}

	.preview-facts dd {
		margin: 0;
	}

	.preview-count {
		margin: 0 0 var(--space-1);
		font-weight: var(--font-weight-semibold);
	}

	.preview-nations {
		max-height: 12rem;
		overflow-y: auto;
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}

	/* A nation in the list opens its own preview: a button that reads as a link. */
	.link-button {
		min-height: 24px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		text-align: left;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.18em;
		cursor: pointer;
	}

	.preview-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}

	/* Show by nation or by state: two buttons side by side, as the reading settings' alignment choices are. */
	.shown-by {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.shown-by legend {
		float: left;
		margin-right: var(--space-2);
	}

	.shown-by-choices {
		display: inline-flex;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.shown-by-choice {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-3);
		box-sizing: border-box;
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
	}

	.shown-by-choice + .shown-by-choice {
		border-left: 2px solid var(--color-control-border);
	}

	.shown-by-choice:has(input:checked) {
		background: var(--color-action);
		color: var(--color-action-text);
		box-shadow: inset 0 -4px 0 var(--color-action-text);
	}

	.shown-by-choice:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
		background: var(--color-focus);
		color: var(--focus-text);
	}

	/* A state's name breaks only between words, however narrow the column. */
	.by-state-table :global(tbody th a) {
		overflow-wrap: normal;
		hyphens: none;
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

		/*
		 * While the tiled map loads, the drawn map keeps its place but is not shown, so the reader never sees one map and then another (Trevor, 2026-11-23). It shows again only if the tiled map cannot start. The page's first script marks the page with data-scripts="on" before it paints; without scripts the drawn map is the map.
		 */
		:global(html[data-scripts='on']) .map-drawing.waiting .drawn-map {
			visibility: hidden;
		}

		:global(html[data-scripts='on']) .map-drawing.waiting .map-loading {
			display: block;
		}
	}

	/* Until the tiled map is moved into the view on screen, it is not shown. */
	.tile-map-home {
		display: none;
	}

	.map-loading {
		display: none;
		position: absolute;
		inset: var(--space-6) 0 auto;
		margin: 0;
		text-align: center;
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
			max-width: min(975px, calc((100vh - 18rem) * 975 / 883));
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
