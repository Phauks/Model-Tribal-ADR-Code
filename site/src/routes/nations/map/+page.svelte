<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { flushSync, onMount, tick } from 'svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import type { RecognitionBadge } from '#lib/recognition-badges.ts';
	import { replaceState } from '$app/navigation';
	import DataTable from '#lib/components/DataTable.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import LazySourceList from '#lib/components/LazySourceList.svelte';
	import { mapViewChoices, mapViews } from '#lib/map-views.ts';
	import TileMap, { storedBaseMap, storedOutlines, storedPlaceNames, tileMapPlaces, type TileMapCamera, type TileMapFeature, type TileMapLayers } from '#lib/components/TileMap.svelte';
	import MapExplorer from '#lib/components/MapExplorer.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import ZoomableMap from '#lib/components/ZoomableMap.svelte';
	import type { NationsMapView } from '#lib/nations-map-drawing.ts';
	import type { LandAreaRow, ShadedViewData } from '#lib/server/nations-map.ts';
	import { isShadedMapView, shadedMapViews, shadedViewDefinitions, type ShadedMapView } from '#lib/shaded-map-views.ts';
	import { shapeFor, shapePath } from '#lib/map-shapes.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { byStateColumns, byStateRows, categoryColumns, categoryRows, landAreaColumns, landAreaRows as buildLandAreaRows, mapTableFile, nationColumns, nationRows, regionColumns, regionRows as buildRegionRows, stateColumns, stateRows as buildStateRows } from '#lib/map-tables.ts';
	import { mapTableOnScreen } from '#lib/map-table-on-screen.svelte.ts';
	import MapDetails from '#lib/components/MapDetails.svelte';
	import { nationsLine, type MapDetails as MapDetailsType, type MapDetailsContact, type MapDetailsLine } from '#lib/map-details.ts';
	import MapIcon from '@lucide/svelte/icons/map';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ViewSwitch from '#lib/components/ViewSwitch.svelte';
	import { censusYearFor, cessionLines, readCessionsSwitch, type CessionDetail } from '#lib/historic-map.ts';
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
	/** Said to screen readers when the tiled map cannot start and the drawn map takes its place. */
	let tileMapProblem = $state('');
	let tileMapReady = $state(false);
	let tileMap = $state<TileMap | undefined>();

	let tileMapCamera = $state<TileMapCamera | undefined>();
	/** The tiled map's shape: flat (Web Mercator, which stretches places far from the equator, such as Alaska) or a globe, where every place keeps its true size (Trevor, 2026-11-23). */
	let mapShape = $state<'flat' | 'globe'>('flat');

	/**
	 * The layers on the map (Trevor, 2026-11-26, map redesign D): today's layers and the history layers, each turned on and off from the buttons across the top of the map or the Layers list. The map opens on nations' land and states, with the offices of nations with no land area (mockup D1).
	 */
	let layers = $state<TileMapLayers>({ lands: true, states: true, offices: true, regions: false, borders: false, routes: false, homelands: false });
	/** How the land is colored: '' for one color, or a shaded view's key (src/lib/shaded-map-views.ts). */
	let colorBy = $state('');
	const colorChoices = $derived([{ value: '', label: 'Nothing (one color)' }, ...mapViewChoices.filter((choice) => isShadedMapView(choice.value)).map((choice) => ({ ...choice, group: undefined }))]);
	/** The base map and its switches, which the Layers list sets and every map on the site remembers. */
	let baseMap = $state(storedBaseMap());
	let placeNames = $state(storedPlaceNames());
	let outlines = $state(storedOutlines());

	/**
	 * The view whose table is under the map, whose drawn copy prints, and which the Download menu offers: the land's coloring if it has one, then States, Nations' land or the regions, whichever is on first.
	 */
	const primary = $derived<NationsMapView>(isShadedMapView(colorBy) ? colorBy : layers.states ? 'states' : layers.lands ? 'lands' : layers.regions ? 'regions' : 'states');
	$effect(() => {
		const key = primary;
		if (key !== current && key !== pending) void choose(key);
	});
	// The land areas' table is fetched when Nations' land is on, so a land area chosen on the map has its details.
	$effect(() => {
		if (layers.lands) void loadLands();
	});

	/** Turns on the layers that show a view, such as a view named in the address. */
	function showView(key: NationsMapView): void {
		if (isShadedMapView(key)) {
			colorBy = key;
			layers = { ...layers, lands: true };
		} else if (key === 'lands') {
			colorBy = '';
			layers = { ...layers, lands: true, states: false };
		} else if (key === 'regions') {
			colorBy = '';
			layers = { ...layers, regions: true, states: false };
		} else {
			colorBy = '';
			layers = { ...layers, states: true };
		}
	}

	/**
	 * The timeline along the bottom of the map (map redesign D), from the first day the Newberry Library's Atlas draws (1783) to the latest Census year. It rests on Today (year undefined), so the map looks as it does today until the reader moves it; moving it back turns on the borders of the time (MapExplorer.svelte).
	 */
	let cessionsOn = $state(false);
	let year = $state<number | undefined>();
	const lastYear = $derived(data.historic.censusYears[data.historic.censusYears.length - 1] ?? new Date().getFullYear());
	const firstYear = 1783;
	const shownYear = $derived(year ?? lastYear);
	const timelineMarks = $derived([...new Set([...data.historic.borderYears, ...data.historic.cessionYears, ...data.historic.censusYears])].sort((one, other) => one - other));
	const censusShown = $derived(censusYearFor(shownYear, data.historic.censusYears));
	/** Whether the map shows a past year, which leaves out today's layers. */
	const pastShown = $derived(tileMapReady && year !== undefined && year < lastYear);

	/** The cessions' details, fetched the first time the reader turns them on or opens one. */
	let cessionList = $state.raw<CessionDetail[] | undefined>();
	let cessionsLoading: Promise<void> | undefined;
	function loadCessions(): Promise<void> {
		cessionsLoading ??= fetch('/nations/map/land-cessions.json')
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json() as Promise<CessionDetail[]>;
			})
			.then((body) => {
				cessionList = body;
			})
			.catch(() => {
				cessionsLoading = undefined;
			});
		return cessionsLoading;
	}
	$effect(() => {
		if (cessionsOn) void loadCessions();
	});

	/**
	 * The "Land areas" view's table is fetched the first time the view is chosen, because its rows are heavy. Its drawn copy, the Census Bureau's outlines, is fetched apart and only when it is needed (see loadDrawing).
	 */
	let lands = $state.raw<{ rows: LandAreaRow[] } | undefined>();
	let landsFailed = $state(false);
	let landsLoading: Promise<void> | undefined;

	function loadLands(): Promise<void> {
		landsLoading ??= fetch('/nations/map/land-areas.json')
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json();
			})
			.then((body: { rows: LandAreaRow[] }) => {
				for (const row of body.rows) listedNations.set(row.anchor, row.nations);
				lands = body;
			})
			.catch(() => {
				landsFailed = true;
				landsLoading = undefined;
			});
		return landsLoading;
	}

	/**
	 * The views that shade the land areas by a fact about their nations, such as Public Law 280 (src/lib/shaded-map-views.ts), are fetched the same way, each the first time it is chosen.
	 */
	type ShadedBody = Omit<ShadedViewData, 'drawn' | 'labels' | 'drawnStates' | 'offices'>;
	/** Each view's rows are only read, so they are kept as they arrive rather than watched one by one. */
	let shaded = $state.raw<Partial<Record<ShadedMapView, ShadedBody>>>({});
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
					for (const row of body.areaRows) listedNations.set(row.anchor, row.nations);
					shaded = { ...shaded, [view]: body };
				})
				.catch(() => {
					shadedFailed[view] = true;
					shadedLoading.delete(view);
				});
			shadedLoading.set(view, loading);
		}
		return loading;
	}

	/** Fetches what a view shows beside the map, if it is fetched at all; it settles once the view can be shown, or has failed to load. */
	function loadView(key: NationsMapView): Promise<void> {
		if (key === 'lands') return loadLands();
		if (isShadedMapView(key)) return loadShaded(key);
		return Promise.resolve();
	}

	/**
	 * The drawn copy of a fetched view. The tiled map is what a reader sees, so the drawn copy is needed only for printing, which always uses it, or when the tiled map cannot start. It is fetched for the view on screen once the reader has stayed on it a few seconds, or at once when the tiled map has failed, and put in the page only then or while printing, since thousands of hidden outlines slow every change to the page.
	 */
	type ViewDrawing = { drawing: string; stateDrawing?: string };
	let viewDrawings = $state.raw<Partial<Record<NationsMapView, ViewDrawing>>>({});
	let drawingsFailed = $state<Partial<Record<NationsMapView, boolean>>>({});
	const drawingLoading = new Map<NationsMapView, Promise<void>>();
	function loadDrawing(key: NationsMapView): void {
		if (key !== 'lands' && !isShadedMapView(key)) return;
		if (drawingLoading.has(key)) return;
		drawingsFailed[key] = false;
		drawingLoading.set(
			key,
			fetch(`/nations/map/view-drawings/${key}.json`)
				.then((response) => {
					if (!response.ok) throw new Error(String(response.status));
					return response.json();
				})
				.then((body: ViewDrawing) => {
					viewDrawings = { ...viewDrawings, [key]: body };
				})
				.catch(() => {
					drawingsFailed[key] = true;
					drawingLoading.delete(key);
				})
		);
	}

	/** While the page prints, every view's drawn copy that has arrived is in the page (src/lib/motion.ts finishes any movement first). */
	let printing = $state(false);
	const showDrawn = $derived(!tileMapWanted || printing);

	$effect(() => {
		const key = current;
		if (!tileMapWanted) {
			loadDrawing(key);
			return;
		}
		const timer = setTimeout(() => loadDrawing(key), 3000);
		return () => clearTimeout(timer);
	});

	/**
	 * Choosing a view fetches its table first, if it has not been fetched, and then changes the map and the table together, so the table beside the map never stands empty or belongs to another view. The picker shows the new choice at once.
	 */
	let pending = $state<NationsMapView | undefined>();
	async function choose(key: NationsMapView): Promise<void> {
		replaceState(key === views[0].key ? location.pathname : `?view=${key}`, {});
		pending = key;
		await loadView(key);
		if (pending !== key) return;
		pending = undefined;
		current = key;
	}

	/** Starts fetching a view's table while the reader is on it in the picker, before choosing it. */
	function prefetch(key: NationsMapView): void {
		void loadView(key);
	}

	/**
	 * Shows the view that holds the part of the page the address points to,
	 * such as a region's row linked from a nation's page, or the view named in
	 * "?view=" when the reader shared a view.
	 */
	async function showAddressedView(): Promise<void> {
		const cessionNamed = new URLSearchParams(location.search).get('cession');
		const anchor = cessionNamed ? `cession-${cessionNamed}` : location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
		// A cession's details, linked from a treaty's page as ?cession=<number> or shared by the address the details keep, turn the cessions on at the year it was made.
		if (anchor.startsWith('cession-')) {
			cessionsOn = true;
			await loadCessions();
			const cession = cessionList?.find((entry) => `cession-${entry.royce}` === anchor);
			if (cession?.dates[0]) year = Number(cession.dates[0].slice(0, 4));
			const shownView = new URLSearchParams(location.search).get('view');
			if (shownView && views.some((entry) => entry.key === shownView)) {
				await loadView(shownView as NationsMapView);
				showView(shownView as NationsMapView);
			}
			if (cession) void select(anchor);
			return;
		}
		let target = anchor ? document.getElementById(anchor) : null;
		const panel = target?.closest<HTMLElement>('[data-map-view]');
		const named = new URLSearchParams(location.search).get('view');
		// A land area's row, and a shaded view's row, exist only once the view has been fetched; their ids start with the view's key.
		const shadedView = shadedMapViews.find((key) => anchor.startsWith(`${key}-`));
		const view = anchor.startsWith('land-area-') ? 'lands' : (shadedView ?? panel?.dataset.mapView ?? named);
		if (!view || !views.some((entry) => entry.key === view)) return;
		await loadView(view as NationsMapView);
		showView(view as NationsMapView);
		current = view as NationsMapView;
		// A state's row is in the view's by-state table.
		if (shadedView && anchor.startsWith(`${shadedView}-state-`) && (shaded[shadedView]?.stateRows.length ?? 0) > 0) shownBy[shadedView] = 'state';
		await tick();
		target ??= anchor ? document.getElementById(anchor) : null;
		// A place named in the address, such as a region's row linked from a nation's page, opens its preview; a row the address points to opens its folded table first.
		if (anchor && previewOf(anchor)) void select(anchor);
		else if (target) {
			const folded = target.closest<HTMLDetailsElement>('details.collapsible');
			if (folded) folded.open = true;
			target.scrollIntoView();
		}
	}

	onMount(() => {
		cessionsOn = readCessionsSwitch();
		void showAddressedView();
		const onHashChange = () => void showAddressedView();
		window.addEventListener('hashchange', onHashChange);
		document.addEventListener('click', onDrawnClick);
		// The drawn copies go into the page before the browser lays out the printed pages, and leave it after.
		const beforePrint = () => {
			printing = true;
			flushSync();
		};
		const afterPrint = () => (printing = false);
		window.addEventListener('beforeprint', beforePrint);
		window.addEventListener('afterprint', afterPrint);
		return () => {
			window.removeEventListener('beforeprint', beforePrint);
			window.removeEventListener('afterprint', afterPrint);
			window.removeEventListener('hashchange', onHashChange);
			document.removeEventListener('click', onDrawnClick);
		};
	});

	type ListedNation = { id: string; name: string; badges?: RecognitionBadge[] };
	/**
	 * The nations each table row names, by the row's id: the page's own rows, and the rows of fetched views, added when they arrive and before their table is drawn. The second is a plain map, so adding a view's rows does not redraw every other table on the page.
	 */
	const pageNations = $derived(
		new Map<string, ListedNation[]>([
			...data.stateRows.map((row) => [`state-${row.code}`, row.nations] as const),
			...data.regionRows.map((row) => [row.anchor, row.nations] as const)
		])
	);
	const listedNations = new Map<string, ListedNation[]>();

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
	let detailsPanel = $state<MapDetails | undefined>();

	/** A place's details: its facts, each count of nations opening to those nations (Trevor, 2026-11-24, mockup 3A), each linked to its page, or to the part of it that holds the view's facts and their sources. */
	type PreviewLine = MapDetailsLine;
	type Preview = MapDetailsType;

	/** A nation's seal, website and contact, from its own small file (/nations/<id>/preview.json), fetched when its preview first opens. */
	type ContactLine = MapDetailsContact;
	type NationDetail = { image?: { src: string; kind: string }; website?: ContactLine; office?: string; address?: ContactLine; phone?: ContactLine; email?: ContactLine };
	let nationDetails = $state<Record<string, NationDetail | null>>({});
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

	/** A shape chosen on a history layer (borders, removal routes, homelands), shown in the details until another place is chosen. */
	let chosenFeature = $state<TileMapFeature | undefined>();
	const territoryWords: Record<string, string> = { state: 'State', territory: 'Territory', 'unorganized-territory': 'Unorganized territory', district: 'District of Columbia', other: 'Claimed or shared, not U.S.' };
	/** A date in the Newberry Library's file (18380523) as words. */
	const dayWords = (day: number) => readableDate(`${String(day).slice(0, 4)}-${String(day).slice(4, 6)}-${String(day).slice(6, 8)}`);
	function featurePreview(feature: TileMapFeature): Preview {
		if (feature.kind === 'border') {
			const state = data.stateRows.find((row) => row.name === feature.name);
			const lines: PreviewLine[] = [{ label: `From ${dayWords(feature.from)}`, value: feature.change + (feature.citation ? ` ${feature.citation}` : '') }];
			lines.push({ label: 'Until', value: feature.to >= 99990000 ? 'Today' : dayWords(feature.to) });
			if (state) lines.push(nationsLine('Nations there today', state.nations));
			lines.push({ label: 'Source', value: 'Newberry Library, Atlas of Historical County Boundaries' });
			return { kind: `${territoryWords[feature.territory] ?? 'Territory'}${year !== undefined ? `, ${year}` : ''}`, title: feature.name, lines, table: true };
		}
		if (feature.kind === 'homeland') {
			return {
				kind: 'Homeland found by the Indian Claims Commission',
				title: feature.named,
				lines: [
					{ label: 'What this is', value: 'The land the Indian Claims Commission found this nation held, in its claim against the United States. A finding, not the nation’s own account of its homeland.' },
					{ label: 'Area on the map', value: String(feature.area) },
					{ label: 'Source', value: 'Indian Land Areas Judicially Established, 1978 (U.S. Geological Survey, traced by the National Park Service)' }
				],
				table: true
			};
		}
		return {
			kind: 'Removal route',
			title: feature.routes ? `Trail of Tears: ${feature.routes}` : 'Trail of Tears',
			lines: [
				{ label: 'When', value: '1837 to 1839' },
				{ label: 'Who', value: 'The Cherokee Nation, removed from its homeland in the Southeast to Indian Territory' },
				{ label: 'Source', value: 'National Park Service, Trail of Tears National Historic Trail' }
			],
			table: true
		};
	}

	function previewOf(key: string): Preview | undefined {
		if (key === 'feature') return chosenFeature ? featurePreview(chosenFeature) : undefined;
		if (key.startsWith('cession-')) {
			const cession = cessionList?.find((entry) => `cession-${entry.royce}` === key);
			return cession ? { kind: 'Land cession', title: `Royce cession ${cession.royce}`, lines: cessionLines(cession, data.historic.volume), table: true } : undefined;
		}
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
		if (state) return { kind: 'State or territory', title: state.name, lines: [nationsLine('Nations', state.nations)], nations: state.nations, page: { href: `/nations/state/${state.code.toLowerCase()}`, label: 'Open the state’s page' } };
		const region = data.regionRows.find((row) => row.anchor === key);
		if (region) return { kind: 'Bureau of Indian Affairs region', title: region.name, lines: [...(region.states.length > 0 ? [{ label: 'States', value: region.states.join(', ') }] : []), nationsLine('Nations', region.nations)], nations: region.nations };
		const area = lands?.rows.find((row) => row.anchor === key);
		if (area) return onlyNation({ kind: area.kindLabel, title: area.name, lines: [nationsLine('Nations', area.nations)], nations: area.nations });
		for (const body of Object.values(shaded)) {
			const nationRow = body.nationRows.find((row) => row.anchor === key);
			if (nationRow) return previewOf(`nation:${nationRow.id}`);
			const definition = shadedViewDefinitions[body.view];
			const areaRow = body.areaRows.find((row) => row.anchor === key);
			if (areaRow) {
				const lines: PreviewLine[] = [];
				if (definition.valueHeader && areaRow.value !== undefined) lines.push({ label: definition.valueHeader, value: areaRow.value.toLocaleString('en-US') });
				if (areaRow.states.length > 0) lines.push({ label: 'States', value: areaRow.states.join(', ') });
				lines.push(nationsLine('Nations', areaRow.nations, body.section));
				return onlyNation({ kind: definition.categoryHeader ?? 'Category', title: areaRow.name, lines, nations: areaRow.nations });
			}
			const stateRow = body.stateRows.find((row) => row.anchor === key);
			if (stateRow) {
				const counts = stateRow.counts as Record<string, number>;
				const members = stateRow.members as Record<string, string[]>;
				const names = body.stateNations as Record<string, string>;
				const named = (ids: string[]) => ids.map((id) => ({ id, name: names[id] ?? id }));
				const lines = [
					nationsLine('Nations', named([...new Set(Object.values(members).flat())]), body.section),
					...body.stateColumns.filter((column) => (counts[column.key] ?? 0) > 0).map((column) => nationsLine(column.header, named(members[column.key] ?? []), body.section))
				];
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
		return { ...nation, lines: [{ label: place.kind, value: place.title }, ...place.lines.filter((line) => line.label !== 'States' && !line.nations), ...nation.lines] };
	}

	const shownPreview = $derived(preview ? previewOf(preview) : undefined);
	$effect(() => {
		if (shownPreview?.nation) loadNationDetail(shownPreview.nation);
	});

	/** Opens a place's or nation's preview, keeping its row's id in the address so the link can be shared. */
	async function select(key: string): Promise<void> {
		if (key.startsWith('/nations/')) key = `nation:${key.slice('/nations/'.length)}`;
		if (key.startsWith('cession-')) await loadCessions();
		preview = key;
		if (!key.startsWith('nation:') && location.hash !== `#${key}`) history.replaceState(history.state, '', `#${key}`);
		await tick();
		await detailsPanel?.focus();
	}

	/** A shape on a history layer opens its details; it has no row, so it is not kept in the address. */
	async function chooseFeature(feature: TileMapFeature): Promise<void> {
		chosenFeature = feature;
		preview = 'feature';
		if (location.hash) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
		await tick();
		await detailsPanel?.focus();
	}

	/** Closing the details leaves the place out of the address. */
	async function closeDetails(key: NationsMapView): Promise<void> {
		preview = undefined;
		chosenFeature = undefined;
		const search = new URLSearchParams(location.search);
		search.delete('cession');
		const query = search.size > 0 ? `?${search}` : '';
		if (location.hash || query !== location.search) history.replaceState(history.state, '', `${location.pathname}${query}`);
		await tick();
		document.getElementById(`map-table-${key}`)?.focus({ preventScroll: true });
	}

	/** A count in a table opens its row's list of nations, as the row's name does. */
	function openRowNames(event: MouseEvent, anchor: string): void {
		const names = document.getElementById(anchor)?.querySelector<HTMLDetailsElement>('details.row-names, details.count-names');
		if (!names) return;
		event.preventDefault();
		names.open = true;
		names.querySelector<HTMLElement>('summary')?.focus();
	}

	/** The nations a count in a by-state table is made of: one category's, or for the total, all the state's. */
	function stateCountNations(body: ShadedBody, row: TableRow, column: TableColumn): { id: string; name: string }[] {
		const state = body.stateRows.find((candidate) => candidate.anchor === row.key);
		if (!state) return [];
		const members = state.members as Record<string, string[]>;
		const ids = column.key === 'total' ? [...new Set(Object.values(members).flat())] : (members[column.key.replace(/^count-/, '')] ?? []);
		return ids.map((id) => ({ id, name: (body.stateNations as Record<string, string>)[id] ?? id })).sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }));
	}

	/** The states the Go to menu lists after the places that are always there. */
	const goToStates = $derived(data.stateRows.map((row) => row.name).filter((name) => !tileMapPlaces.some((place) => place.name === name)).sort((first, second) => first.localeCompare(second, 'en')));
	// The places the tiled map draws on their own, then every other state with a nation, under "States".
	const goToChoices = $derived([
		...tileMapPlaces.map((place) => ({ value: place.name, label: place.name })),
		...goToStates.map((name) => ({ value: name, label: name, group: 'States' }))
	]);
	let goToPlace = $state('');
	/** What the map's search finds: the places and states, then every nation by name (mockup D: "Find a nation, state or place"). */
	const searchChoices = $derived([
		...tileMapPlaces.map((place) => ({ value: `place:${place.name}`, label: place.name, group: 'Places' })),
		...goToStates.map((name) => ({ value: `place:${name}`, label: name, group: 'States' })),
		...[...nationIndex.values()].sort((first, second) => first.name.localeCompare(second.name, 'en')).map((nation) => ({ value: `nation:${nation.id}`, label: nation.name, group: 'Nations' }))
	]);
	function onSearch(value: string): void {
		if (value.startsWith('place:')) tileMap?.showPlace(value.slice('place:'.length));
		else if (value.startsWith('nation:')) void select(value);
	}

	let tileHolder = $state<HTMLElement | undefined>();

	/** The folded table's heading under the map, and its number of rows. */
	function tableHeading(key: NationsMapView): string {
		if (key === 'states') return 'Nations by state';
		if (key === 'lands') return 'Land areas';
		if (key === 'regions') return 'Bureau of Indian Affairs regions';
		return views.find((entry) => entry.key === key)?.label ?? '';
	}
	function tableCount(key: NationsMapView): number | undefined {
		if (key === 'states') return data.stateRows.length;
		if (key === 'regions') return data.regionRows.length;
		if (key === 'lands') return lands?.rows.length;
		if (isShadedMapView(key)) {
			const body = shaded[key];
			if (!body) return undefined;
			return byOf(key) === 'state' ? body.stateRows.length : shadedViewDefinitions[key].rows === 'nations' ? body.nationRows.length : body.areaRows.length;
		}
		return undefined;
	}

	/** What the map shows, for screen readers: the layers that are on. */
	const mapLabel = $derived(
		[
			layers.lands ? (isShadedMapView(colorBy) ? `Nations’ land by ${views.find((entry) => entry.key === colorBy)?.label ?? ''}` : 'Nations’ land') : '',
			layers.states && !pastShown ? 'States by number of nations' : '',
			layers.regions && !pastShown ? 'Bureau of Indian Affairs regions' : '',
			layers.borders ? `Borders${year === undefined ? '' : ` in ${year}`}` : '',
			cessionsOn ? 'Land cessions' : '',
			layers.routes ? 'Removal routes' : '',
			layers.homelands ? 'Homelands found by the Indian Claims Commission' : ''
		]
			.filter(Boolean)
			.join(', ') || 'Base map'
	);

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
	{@const nations = pageNations.get(row.key) ?? listedNations.get(row.key) ?? []}
	{@const name = row.cells[column.key]?.text ?? ''}
	{#if column.key === 'count'}
		<!-- The count opens the same list of nations as the row's name. -->
		{#if nations.length === 0}{name}{:else}<a class="count-link" href="#{row.anchor}" aria-label="{name} {nations.length === 1 ? 'nation' : 'nations'}: show {nations.length === 1 ? 'it' : 'them'}" onclick={(event) => openRowNames(event, row.anchor ?? '')}>{name}</a>{/if}
	{:else if nations.length === 0}
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
	<title>Map · Nations · Tribal Law Project</title>
	<!-- The tiled map's data starts coming while the page is still arriving, rather than after it starts (src/lib/tile-map-loading.ts fetches the same address, and the browser hands it this copy). -->
	<link rel="preload" href="/nations/map/tile-map.json" as="fetch" crossorigin="anonymous" />
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

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Map of Native Nations" />

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
		aria-busy={view.key === current && pending !== undefined ? 'true' : undefined}
	>
		<h2 id={view.heading} class="view-heading">{view.label}</h2>
		<figure class="map-figure" data-print-part="maps">
			<!-- Where the interactive map cannot start, the drawn map takes its place, with the view picker above it. -->
			{#if !tileMapWanted}
				<div class="map-toolbar no-print">
					{#if view.key === current}
						<div class="map-view-picker">
							<SearchableDropdown label="Map view" choices={mapViewChoices} value={pending ?? current} onchange={(key) => showView(key)} onhighlight={prefetch} />
						</div>
					{/if}
					{#if isShadedMapView(view.key) && (shaded[view.key]?.stateRows.length ?? 0) > 0}
						{@const key = view.key}
						<div class="shown-by">
							<span class="shown-by-label" aria-hidden="true">Show</span>
							<ViewSwitch
								label="Show {view.label} by"
								value={byOf(key)}
								onchange={(value) => (shownBy[key] = value)}
								choices={[
									{ value: 'nation', label: 'Nations', title: 'Shade each nation’s land areas and offices', icon: MapPin, showLabel: true },
									{ value: 'state', label: 'States', title: 'Shade each state by what most of its nations have', icon: MapIcon, showLabel: true }
								]}
							/>
						</div>
					{/if}
				</div>
			{/if}
			<!-- The map is the page's main body, with its controls floating quietly on it (Trevor, 2026-11-26, map redesign D). The frame goes full screen with them. -->
			<div class="map-frame" class:explorer-frame={tileMapWanted && view.key === current} data-map-full-screen>
				<div class="map-drawing" {@attach placeTileMap(view.key)} class:tiled={tileMapReady && view.key === current} class:waiting={tileMapWanted && !tileMapReady && view.key === current} data-nations-map={view.key === 'states' ? '' : undefined}>
					<p class="map-loading small muted" aria-hidden="true">Loading the map…</p>
					<div class="drawn-map">
					<ZoomableMap label={view.label} maximum={view.key === 'lands' ? 16 : 8}>
						{#if view.key === 'lands' || isShadedMapView(view.key)}
							<!-- A fetched view's drawn copy is in the page only when it is what the reader sees: when printing, or when there is no tiled map. -->
							{@const drawn = viewDrawings[view.key]}
							{@const failed = drawingsFailed[view.key] || (view.key === 'lands' ? landsFailed : isShadedMapView(view.key) && shadedFailed[view.key])}
							{#if showDrawn && drawn}
								{@html byOf(view.key) === 'state' && drawn.stateDrawing ? drawn.stateDrawing : drawn.drawing}
							{:else if showDrawn && failed}
								<p class="map-status">This view could not be loaded. Check your connection and choose the view again.</p>
							{:else if showDrawn}
								<p class="map-status">Loading the view…</p>
							{/if}
							<noscript><p class="map-status">This view needs JavaScript to load its map and table.</p></noscript>
						{:else}
							<!-- svelte-ignore hydration_html_changed -->
							{@html data.drawings[view.key]}
						{/if}
					</ZoomableMap>
					</div>
				</div>
				{#if view.key === current && tileMapReady}
					<div class="explorer no-print">
						<MapExplorer
							bind:layers
							bind:cessions={cessionsOn}
							bind:colorBy
							{colorChoices}
							bind:baseMap
							bind:placeNames
							bind:outlines
							bind:year
							first={firstYear}
							last={lastYear}
							marks={timelineMarks}
							places={searchChoices}
							onplace={onSearch}
							key={explorerKey}
							details={shownPreview ? explorerDetails : undefined}
						/>
					</div>
				{/if}
			</div>
			<!-- The drawn map's key, for print and where the interactive map cannot start; on screen the key floats on the map. -->
			{#if view.key === 'states' || view.key === 'lands' || (isShadedMapView(view.key) && shaded[view.key])}
				<figcaption class:print-only={tileMapReady}>
					<ul class="legend" aria-label="Key">
					{#if view.key === 'states'}
						{#each data.countClasses as entry (entry.key)}
							<li><span class="swatch count-{entry.key}" aria-hidden="true"></span>{entry.label}</li>
						{/each}
					{:else if isShadedMapView(view.key) && shaded[view.key]}
						{#each shaded[view.key]?.legend ?? [] as entry (entry.key)}
							<li>{@render categorySwatch(entry.shade)}{entry.label}</li>
						{/each}
					{:else if view.key === 'lands'}
						{#each data.landAreaGroups as group (group.key)}
							<li><span class="swatch land-{group.key}" aria-hidden="true"></span>{group.label}</li>
						{/each}
					{/if}
					</ul>
				</figcaption>
			{/if}
		</figure>
		<!-- The table stays under the map, folded, as on the rest of the site (mockup D1). -->
		<div class="map-below">
			<Collapsible heading={tableHeading(view.key)} identifier="map-table-heading-{view.key}" count={tableCount(view.key)} open={false}>
			<div class="map-side-table" id="map-table-{view.key}" tabindex="-1">
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
					>
						{#snippet cell(row: TableRow, column: TableColumn)}
							{@const counted = stateCountNations(body, row, column)}
							{@const number = row.cells[column.key]?.text ?? ''}
							{#if counted.length === 0}
								{number}
							{:else}
								<!-- Each count opens to the nations it is made of, each linked to the part of its page with the view's facts and their sources. -->
								<details class="count-names">
									<summary aria-label="{number} {counted.length === 1 ? 'nation' : 'nations'} in {row.cells.state?.text}: {column.header}">{number}</summary>
									<ul>
										{#each counted as nation (nation.id)}
											<li><a href="/nations/{nation.id}#{body.section}">{nation.name}</a></li>
										{/each}
									</ul>
								</details>
							{/if}
						{/snippet}
					</DataTable>
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
			</Collapsible>
		</div>
	</div>
{/each}

<!-- The one tiled map, moved into the view on screen, so changing what is shown keeps the map, its place and its tiles (Trevor, 2026-11-23). -->
<div class="tile-map-home">
	{#if tileMapWanted}
		<div class="tile-holder" bind:this={tileHolder}>
			<TileMap
				bind:this={tileMap}
				view={isShadedMapView(colorBy) ? colorBy : 'lands'}
				label={mapLabel}
				bind:shape={mapShape}
				bind:camera={tileMapCamera}
				onselect={(anchor) => void select(anchor)}
				{year}
				bind:cessions={cessionsOn}
				oncession={(royce) => void select(`cession-${royce}`)}
				layerSwitches={layers}
				onfeature={(feature) => void chooseFeature(feature)}
				bind:baseMap
				bind:placeNames
				bind:outlines
				onready={() => (tileMapReady = true)}
				onfail={() => {
					tileMapWanted = false;
					tileMapReady = false;
					tileMapProblem = 'The interactive map could not be loaded, so the drawn map is shown.';
				}}
			/>
		</div>
	{/if}
</div>
<p class="visually-hidden" role="status">{tileMapProblem}</p>

<!-- The key on the map lists only what is on (mockup D1). -->
{#snippet explorerKey()}
	<ul class="legend map-key" aria-label="Key">
		{#if layers.lands && !(pastShown && censusShown === undefined)}
			{#if isShadedMapView(colorBy) && shaded[colorBy]}
				{#each shaded[colorBy]?.legend ?? [] as entry (entry.key)}
					<li>{@render categorySwatch(entry.shade)}{entry.label}</li>
				{/each}
			{:else}
				{#each data.landAreaGroups as group (group.key)}
					<li><span class="swatch land-{group.key}" aria-hidden="true"></span>{group.label}{#if pastShown}, {censusShown}{/if}</li>
				{/each}
			{/if}
		{/if}
		{#if layers.states && !pastShown && !isShadedMapView(colorBy)}
			<li><span class="swatch states-range" aria-hidden="true"></span>Nations per state: 1 to 50+</li>
		{/if}
		{#if layers.regions && !pastShown}
			<li><span class="swatch region" aria-hidden="true"></span>Bureau of Indian Affairs region</li>
		{/if}
		{#if layers.offices && !pastShown}
			<li><span class="swatch office" aria-hidden="true"></span>Office</li>
		{/if}
		{#if layers.borders}
			<li><span class="swatch border-state" aria-hidden="true"></span>State</li>
			{#if pastShown}
				<li><span class="swatch border-territory" aria-hidden="true"></span>Territory</li>
				<li><span class="swatch border-unorganized" aria-hidden="true"></span>Unorganized territory</li>
				<li><span class="swatch border-other" aria-hidden="true"></span>Claimed or shared, not U.S.</li>
			{/if}
		{/if}
		{#if cessionsOn}
			{#if pastShown}
				<li><span class="swatch cession-by" aria-hidden="true"></span>Ceded by {shownYear}</li>
				<li><span class="swatch cession-in" aria-hidden="true"></span>Ceded in {shownYear}</li>
			{:else}
				<li><span class="swatch cession-by" aria-hidden="true"></span>Land ceded to the United States</li>
			{/if}
		{/if}
		{#if layers.routes}
			<li><span class="swatch route" aria-hidden="true"></span>Removal route, 1837 to 1839</li>
		{/if}
		{#if layers.homelands}
			<li><span class="swatch homeland" aria-hidden="true"></span>Homeland found by the Indian Claims Commission</li>
		{/if}
	</ul>
{/snippet}

{#snippet explorerDetails()}
	{#if shownPreview}
		{@const detail = shownPreview.nation ? nationDetails[shownPreview.nation] : undefined}
		<MapDetails
			bind:this={detailsPanel}
			details={shownPreview}
			image={detail?.image ? { src: detail.image.src, alt: `${detail.image.kind} of ${shownPreview.title}` } : undefined}
			contact={detail ? [detail.website, detail.address, detail.phone, detail.email].filter((entry) => entry !== undefined) : []}
			back={{ label: 'Close', onclick: () => void closeDetails(current) }}
		/>
	{/if}
{/snippet}

<!-- A category's key mark: its shape in its shade, as on the map (src/lib/map-shapes.ts), or a plain swatch for no fact recorded. -->
{#snippet categorySwatch(shade: number)}
	{@const shape = shapeFor(shade)}
	{#if shape}
		<svg class="shape-swatch" viewBox="0 0 20 20" aria-hidden="true"><path d={shapePath(shape, 10, 10, 6)} style:fill="var(--color-map-class-{shade})" /></svg>
	{:else}
		<span class="swatch count-{shade}" aria-hidden="true"></span>
	{/if}
{/snippet}

{#snippet officeKey()}
	<li><span class="swatch office" aria-hidden="true"></span>Office of a nation with no Census land area</li>
{/snippet}


<div class="reading">
	<LazySourceList count={data.sourceCount} url="/nations/map/sources.json" serverSources={data.sources} />
</div>

<style>
	/* While a chosen view's table is on its way, the pointer says so; the map and the table then change together. */
	.map-view[aria-busy='true'] {
		cursor: progress;
	}

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

	/* The table is focused when the back arrow brings it back, but is not a control. */
	.map-side-table:focus {
		outline: none;
	}

	/* Show by Nations or States, labeled like the fields beside it. */
	.shown-by-label {
		display: block;
		margin-bottom: var(--space-1);
		font-weight: var(--font-weight-bold);
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

	/* A count in a by-state table opens to its nations, listed under the number and read left to right. */
	.count-names summary {
		cursor: pointer;
		color: var(--color-link);
	}

	.count-names ul {
		min-width: 12rem;
		margin: var(--space-2) 0 var(--space-1);
		padding-left: 1.1em;
		text-align: left;
		font-weight: normal;
	}

	/*
	 * The map is the page's main body, as wide as the page's column and nearly as tall as the window, with its controls floating on it (Trevor, 2026-11-26, map redesign D). The table and References follow it, folded. Where the interactive map cannot start, the drawn map stands in its place at its own size.
	 */
	.map-frame {
		container: map-frame / inline-size;
		position: relative;
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

	/* The controls cover the map but let the reader reach it between them. */
	.explorer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.explorer > :global(*) {
		pointer-events: auto;
	}

	/* A phone's map is shorter, so the page under it shows. */
	@media screen and (max-width: 40rem) {
		.map-frame.explorer-frame {
			height: clamp(26rem, calc(100vh - 10rem), 40rem);
			margin-inline: calc(var(--space-4) * -1);
			border-inline: 0;
			border-radius: 0;
		}
	}

	.map-below {
		margin-top: var(--space-4);
	}

	/* On the map, the key is a short list, one row each. */
	/* One entry a line, as in mockup D (the page's .legend, below, runs entries side by side). */
	.legend.map-key {
		display: grid;
		gap: 2px;
		margin: 0;
	}

	.swatch.states-range {
		background: linear-gradient(90deg, var(--color-map-class-1), var(--color-map-class-4));
	}

	.swatch.region {
		border: 2px solid var(--color-action);
		background: transparent;
	}

	.swatch.border-state {
		background: var(--color-map-class-1);
	}

	.swatch.border-territory {
		background: var(--color-status-published-background);
	}

	.swatch.border-unorganized {
		background: var(--color-surface);
	}

	.swatch.border-other {
		background: var(--color-line);
	}

	.swatch.route {
		height: 0;
		border: 0;
		border-top: 3px solid var(--color-action);
	}

	.swatch.homeland {
		border: 2px dashed var(--color-status-draft-rule);
		background: color-mix(in srgb, var(--color-status-draft-rule) 18%, transparent);
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
	.swatch.cession-by {
		background: color-mix(in srgb, var(--color-timeline-treaty) 30%, var(--color-paper));
		border: 1px solid var(--color-timeline-treaty);
	}
	.swatch.cession-in {
		background: color-mix(in srgb, var(--color-timeline-treaty) 75%, var(--color-paper));
		border: 1px solid var(--color-timeline-treaty);
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
	/* A category's shape (src/lib/map-shapes.ts) keeps its size on screen as the drawing zooms, as the dots do, and is ringed in ink, as on the tiled map. */
	.map-drawing :global(.land-area.dot.shape),
	.map-drawing :global(.office.shape) {
		transform-box: fill-box;
		transform-origin: center;
		scale: var(--map-unzoom, 1);
		stroke: var(--color-ink);
		stroke-width: 1px;
	}
	.map-drawing :global(.office.shape) {
		stroke-width: 1.5px;
	}
	.shape-swatch {
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
	}
	.shape-swatch path {
		stroke: var(--color-ink);
		stroke-width: 1.2;
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
