<script lang="ts" module>
	import type { ShadedMapView } from '#lib/shaded-map-views.ts';

	/** The views of the map on /nations/map; each is a set of layers over the same basemap. The shaded views color the land areas by a fact about their nations (src/lib/shaded-map-views.ts). */
	export type TileMapView = 'states' | 'regions' | 'lands' | ShadedMapView;

	/** Where the map is looking, kept by the page so that changing views keeps the reader's place. */
	export interface TileMapCamera {
		center: [number, number];
		zoom: number;
	}

	/**
	 * Places the map can go to by name. The states and territories are where they really are on the map, so each has a button rather than a box drawn at its own scale (Trevor, 2026-11-22: every territory shown and named on its own). Bounds are west, south, east, north in degrees.
	 */
	export const tileMapPlaces: { name: string; bounds: [number, number, number, number] }[] = [
		{ name: 'The 48 contiguous states', bounds: [-125, 24.4, -66.9, 49.4] },
		{ name: 'Alaska', bounds: [-179.2, 51.2, -129.9, 71.4] },
		{ name: 'Hawaiʻi', bounds: [-160.3, 18.9, -154.8, 22.3] },
		{ name: 'Puerto Rico', bounds: [-67.3, 17.9, -65.2, 18.5] },
		{ name: 'U.S. Virgin Islands', bounds: [-65.1, 17.65, -64.55, 18.4] },
		{ name: 'Guam', bounds: [144.6, 13.2, 145.0, 13.7] },
		{ name: 'Northern Mariana Islands', bounds: [145.1, 14.1, 145.9, 20.6] },
		{ name: 'American Samoa', bounds: [-170.9, -14.6, -168.1, -11.0] }
	];
</script>

<script lang="ts">
	// The map drawn in the browser with MapLibre GL JS from the project's own tiles (decision record 0039): the Census Bureau's land areas and states, over a basemap of OpenStreetMap data, all served by the site's own Worker under /map-tiles/. No third party sees where a reader looks.
	//
	// MapLibre and the map's data are loaded only when this component starts, so other pages carry none of it. If the device cannot draw it (no WebGL), the tiles do not load, or the reader is offline, the component calls onfail and the page keeps showing the drawn map, which also stays for printing.
	//
	// Ways to zoom and move: the + and - buttons, the keyboard once the map has focus (arrows move, + and - zoom), Ctrl or ⌘ with the scroll wheel, a trackpad pinch, and two fingers on a touch screen. A plain scroll or one-finger drag still scrolls the page, and MapLibre says how to zoom instead, so the map never traps a reader scrolling past it.
	//
	// Small land areas get a dot until their outline is big enough to see, and nearby dots are grouped into numbered circles when zoomed out. Selecting a place goes to its row in the table.
	import { onMount } from 'svelte';
	import type { Map as MapLibreMap, StyleSpecification, LayerSpecification, ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
	import type { TileMapData } from '#lib/server/nations-map.ts';
	import { motionDuration, motionEasing } from '#lib/motion.ts';

	let {
		view,
		label,
		data: given,
		camera = $bindable(),
		onready,
		onfail
	}: {
		view: TileMapView;
		/** What the map shows, for screen readers, such as "Nations by State". */
		label: string;
		/** One nation's land areas, for its page: the map shows only those, fitted to them, with no place buttons or table to go to. Without it the map shows every nation and fetches its data from /nations/map/tile-map.json. */
		data?: TileMapData;
		camera?: TileMapCamera;
		onready?: () => void;
		onfail?: () => void;
	} = $props();

	const oneNation = $derived(given !== undefined);

	let container: HTMLDivElement | undefined = $state();
	let map: MapLibreMap | undefined;
	let ready = $state(false);

	let dataLoading: Promise<TileMapData> | undefined;
	/** The map's data is the same for every view, so it is fetched once a page. */
	function loadData(): Promise<TileMapData> {
		if (given) return Promise.resolve(given);
		dataLoading ??= fetch('/nations/map/tile-map.json').then((response) => {
			if (!response.ok) throw new Error(`The map data answered ${response.status}`);
			return response.json() as Promise<TileMapData>;
		});
		return dataLoading;
	}

	function canDrawMaps(): boolean {
		if (!navigator.onLine) return false;
		try {
			return Boolean(document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl'));
		} catch {
			return false;
		}
	}

	/** A color token's value in the current theme (design-tokens.json), so the map follows the site's light and dark themes. */
	function token(name: string): string {
		return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
	}

	function isDark(): boolean {
		const chosen = document.documentElement.dataset.theme;
		if (chosen === 'dark' || chosen === 'light') return chosen === 'dark';
		return matchMedia('(prefers-color-scheme: dark)').matches;
	}

	/** Dots fade in for areas too small to see as shapes at each zoom, and out once their outline is big enough. */
	const dotOpacity: ExpressionSpecification = [
		'interpolate',
		['linear'],
		['zoom'],
		3,
		['case', ['<', ['get', 'squareKilometers'], 4000], 1, 0],
		5,
		['case', ['<', ['get', 'squareKilometers'], 800], 1, 0],
		7,
		['case', ['<', ['get', 'squareKilometers'], 60], 1, 0],
		9,
		['case', ['<', ['get', 'squareKilometers'], 6], 1, 0],
		11,
		['case', ['<', ['get', 'squareKilometers'], 0.6], 1, 0],
		13,
		0
	];

	async function styleFor(data: TileMapData): Promise<StyleSpecification> {
		const basemaps = await import('@protomaps/basemaps');
		const dark = isDark();
		const colors = {
			paper: token('paper'),
			ink: token('ink'),
			muted: token('ink-muted'),
			line: token('control-border'),
			focus: token('focus'),
			surface: token('surface'),
			classes: [0, 1, 2, 3, 4].map((step) => token(`map-class-${step}`))
		};
		const flavor = { ...basemaps.namedFlavor(dark ? 'black' : 'white'), background: colors.paper, earth: colors.paper, water: colors.surface };
		const base = basemaps.layers('basemap', flavor, { lang: 'en' }) as LayerSpecification[];
		// The project's layers go above the land and water and below the roads and names, so towns and roads still show through.
		const firstRoad = base.findIndex((layer) => layer.id.startsWith('roads_'));
		const under = base.slice(0, firstRoad);
		const over = base.slice(firstRoad);

		const stateShade: ExpressionSpecification = [
			'match',
			['get', 'code'],
			...Object.entries(data.states).flatMap(([code, state]) => [code, colors.classes[state.countClass]]),
			colors.classes[0]
		] as unknown as ExpressionSpecification;
		const groupShade: ExpressionSpecification = [
			'match',
			['get', 'kind'],
			'federal-reservation-or-trust-land',
			colors.classes[4],
			'state-reservation',
			colors.classes[3],
			colors.classes[2]
		];
		const pointShade: ExpressionSpecification = ['match', ['get', 'group'], 'federal', colors.classes[4], 'state', colors.classes[3], colors.classes[2]];
		const hovered = (color: ExpressionSpecification | string): ExpressionSpecification => ['case', ['boolean', ['feature-state', 'hover'], false], colors.focus, color];

		const fills: LayerSpecification[] = [];
		const tops: LayerSpecification[] = [];
		if (view === 'states') {
			fills.push({ id: 'states', type: 'fill', source: 'places', 'source-layer': 'states', paint: { 'fill-color': hovered(stateShade), 'fill-opacity': 0.85 } });
			tops.push({ id: 'states-lines', type: 'line', source: 'places', 'source-layer': 'states', paint: { 'line-color': colors.line, 'line-width': 0.8 } });
		} else if (view === 'regions') {
			fills.push({ id: 'regions', type: 'fill', source: 'regions', paint: { 'fill-color': hovered(colors.classes[1]), 'fill-opacity': 0.75 } });
			tops.push({ id: 'regions-lines', type: 'line', source: 'regions', paint: { 'line-color': colors.classes[4], 'line-width': 1.4 } });
			tops.push({
				id: 'regions-names',
				type: 'symbol',
				source: 'region-names',
				layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-max-width': 8 },
				paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2 }
			});
		} else if (view !== 'lands') {
			// A shaded view: each area takes its category's shade, and areas with no fact stay the lightest. Only areas with a fact get a dot, so the dots show where the facts are.
			const shading = data.shading?.[view];
			const entries = Object.entries(shading?.areas ?? {});
			const areaShade = (entries.length > 0
				? ['match', ['to-string', ['get', 'code']], ...entries.flatMap(([code, area]) => [code, colors.classes[area.shade]]), colors.classes[0]]
				: colors.classes[0]) as unknown as ExpressionSpecification;
			const dotShade = ['match', ['get', 'shade'], 1, colors.classes[1], 2, colors.classes[2], 3, colors.classes[3], colors.classes[4]] as unknown as ExpressionSpecification;
			fills.push({ id: 'land-areas', type: 'fill', source: 'places', 'source-layer': 'land-areas', paint: { 'fill-color': hovered(areaShade), 'fill-opacity': 0.85 } });
			tops.push(
				{ id: 'land-areas-lines', type: 'line', source: 'places', 'source-layer': 'land-areas', paint: { 'line-color': colors.line, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 10, 1.4] } },
				{
					id: 'area-dots',
					type: 'circle',
					source: 'area-points',
					filter: ['>', ['get', 'shade'], 0],
					paint: {
						'circle-color': hovered(dotShade),
						'circle-radius': 5,
						'circle-stroke-color': colors.ink,
						'circle-stroke-width': 1,
						'circle-opacity': dotOpacity,
						'circle-stroke-opacity': dotOpacity
					}
				},
				{
					id: 'area-names',
					type: 'symbol',
					source: 'area-points',
					minzoom: 6,
					filter: ['>', ['get', 'shade'], 0],
					layout: {
						'text-field': ['get', 'label'],
						'text-font': ['Noto Sans Medium'],
						'text-size': 12,
						'text-max-width': 9,
						'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
						'text-radial-offset': 0.8,
						'symbol-sort-key': ['-', 0, ['get', 'squareKilometers']]
					},
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2 }
				},
				{
					id: 'shaded-labels',
					type: 'symbol',
					source: 'shaded-labels',
					maxzoom: 7,
					layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 14, 'text-max-width': 8, 'text-padding': 4 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2.5 }
				}
			);
		} else {
			// On a nation's page, only the nation's own areas are drawn.
			const onlyTheseAreas: { filter?: FilterSpecification } = oneNation
				? { filter: ['in', ['to-string', ['get', 'code']], ['literal', data.areas.map((area) => area.code)]] }
				: {};
			fills.push({ id: 'land-areas', type: 'fill', source: 'places', 'source-layer': 'land-areas', ...onlyTheseAreas, paint: { 'fill-color': hovered(groupShade), 'fill-opacity': 0.55 } });
			tops.push(
				{ id: 'land-areas-lines', type: 'line', source: 'places', 'source-layer': 'land-areas', ...onlyTheseAreas, paint: { 'line-color': colors.classes[4], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 10, 1.6] } },
				{
					id: 'area-groups',
					type: 'circle',
					source: 'area-points',
					filter: ['has', 'point_count'],
					paint: {
						'circle-color': colors.classes[3],
						'circle-radius': ['step', ['get', 'point_count'], 12, 10, 16, 40, 21],
						'circle-stroke-color': colors.paper,
						'circle-stroke-width': 1.5
					}
				},
				{
					id: 'area-group-counts',
					type: 'symbol',
					source: 'area-points',
					filter: ['has', 'point_count'],
					layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true },
					paint: { 'text-color': colors.paper }
				},
				{
					id: 'area-dots',
					type: 'circle',
					source: 'area-points',
					filter: ['!', ['has', 'point_count']],
					paint: {
						'circle-color': hovered(pointShade),
						'circle-radius': 5,
						'circle-stroke-color': colors.paper,
						'circle-stroke-width': 1.5,
						'circle-opacity': dotOpacity,
						'circle-stroke-opacity': dotOpacity
					}
				},
				{
					id: 'area-names',
					type: 'symbol',
					source: 'area-points',
					minzoom: oneNation ? 0 : 6,
					filter: ['!', ['has', 'point_count']],
					layout: {
						'text-field': ['get', 'label'],
						'text-font': ['Noto Sans Medium'],
						'text-size': 12,
						'text-max-width': 9,
						'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
						'text-radial-offset': 0.8,
						// Larger areas win when names collide.
						'symbol-sort-key': ['-', 0, ['get', 'squareKilometers']]
					},
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2 }
				}
			);
		}

		// Nations with no Census land area, marked at their offices with a dark ring, on every view of the big map.
		if (!oneNation) {
			const officeShade = ['match', ['get', 'shade'], 1, colors.classes[1], 2, colors.classes[2], 3, colors.classes[3], 4, colors.classes[4], colors.classes[0]] as unknown as ExpressionSpecification;
			tops.push(
				{
					id: 'office-dots',
					type: 'circle',
					source: 'offices',
					paint: { 'circle-color': hovered(officeShade), 'circle-radius': 5.5, 'circle-stroke-color': colors.ink, 'circle-stroke-width': 2 }
				},
				{
					id: 'office-names',
					type: 'symbol',
					source: 'offices',
					minzoom: 6,
					layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-max-width': 9, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2 }
				}
			);
		}

		const origin = location.origin;
		return {
			version: 8,
			glyphs: `${origin}/map-tiles/assets/glyphs/{fontstack}/{range}.pbf`,
			sprite: `${origin}/map-tiles/assets/sprites/${dark ? 'black' : 'white'}`,
			sources: {
				basemap: {
					type: 'vector',
					tiles: [`${origin}/map-tiles/${data.tiles.basemap}/{z}/{x}/{y}.mvt`],
					maxzoom: data.tiles.maximumZoom,
					attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, <a href="https://protomaps.com">Protomaps</a>'
				},
				places: {
					type: 'vector',
					tiles: [`${origin}/map-tiles/${data.tiles.landAreas}/{z}/{x}/{y}.mvt`],
					maxzoom: 12,
					promoteId: { states: 'code', 'land-areas': 'code' },
					attribution: 'U.S. Census Bureau'
				},
				regions: { type: 'geojson', data: data.regions, promoteId: 'name', attribution: 'Bureau of Indian Affairs' },
				offices: {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: (data.offices ?? []).map((office, index) => {
							const shaded = view === 'states' || view === 'regions' || view === 'lands' ? undefined : data.shading?.[view]?.offices[office.nation];
							return {
								type: 'Feature',
								id: index,
								properties: { name: office.name, shade: shaded?.shade ?? 0, anchor: shaded ? shaded.anchor : office.anchor },
								geometry: { type: 'Point', coordinates: office.point }
							};
						})
					}
				},
				'shaded-labels': {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: (view === 'states' || view === 'regions' || view === 'lands' ? [] : (data.shading?.[view]?.labels ?? [])).map((label) => ({ type: 'Feature', properties: { name: label.name }, geometry: { type: 'Point', coordinates: label.point } }))
					}
				},
				'region-names': {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: data.regions.features.map((region) => ({ type: 'Feature', properties: { name: region.properties.name }, geometry: { type: 'Point', coordinates: labelPointOf(region.geometry) } }))
					}
				},
				'area-points': {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: data.areas.map((area) => ({ type: 'Feature', id: Number(area.code), properties: propertiesOf(area, data), geometry: { type: 'Point', coordinates: area.point } }))
					},
					// Numbered circles would hide the shades, so only the "Land areas" view groups its dots.
					cluster: !oneNation && view === 'lands',
					clusterMaxZoom: 5,
					clusterRadius: 40
				}
			},
			layers: [...under, ...fills, ...over, ...tops]
		};
	}

	/** An area's dot's properties: on a shaded view, its shade and the row it goes to in that view's table. */
	function propertiesOf(area: TileMapData['areas'][number], data: TileMapData): Record<string, unknown> {
		if (view === 'states' || view === 'regions' || view === 'lands') return area;
		const shaded = data.shading?.[view]?.areas[area.code];
		return { ...area, shade: shaded?.shade ?? 0, anchor: shaded?.anchor ?? '' };
	}

	/** A point for a region's name: the middle of its largest piece's bounding box (regions are large and mostly compact). */
	function labelPointOf(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
		const pieces = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
		let best: [number, number] = [0, 0];
		let bestSize = -1;
		for (const piece of pieces) {
			const xs = piece[0].map((point) => point[0]);
			const ys = piece[0].map((point) => point[1]);
			const size = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
			if (size > bestSize) {
				bestSize = size;
				best = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
			}
		}
		return best;
	}

	/** Goes to a place's row in the table; the page opens the row and its view (src/routes/nations/map/+page.svelte). */
	function openRow(anchor: string | undefined): void {
		if (!anchor) return;
		// An office on a view whose table has no row for it goes to the nation's own page.
		if (anchor.startsWith('/')) location.assign(anchor);
		else location.hash = anchor;
	}

	function showPlace(bounds: [number, number, number, number]): void {
		// The move takes its time from the motion tokens, so Reduce motion makes it a jump (src/lib/motion.ts).
		map?.fitBounds(bounds, { padding: 24, maxZoom: 10, duration: motionDuration('long'), easing: motionEasing('standard') });
	}

	/** The box around a nation's areas. An area across the 180th meridian (west greater than east) is boxed by its dot alone. */
	function boundsOfAreas(areas: TileMapData['areas']): [number, number, number, number] {
		const boxes = areas.map((area) => (area.bounds[0] <= area.bounds[2] ? area.bounds : [area.point[0], area.point[1], area.point[0], area.point[1]]));
		return [Math.min(...boxes.map((box) => box[0])), Math.min(...boxes.map((box) => box[1])), Math.max(...boxes.map((box) => box[2])), Math.max(...boxes.map((box) => box[3]))];
	}

	onMount(() => {
		let stopped = false;
		let cleanups: (() => void)[] = [];
		const fail = () => {
			if (stopped) return;
			stopped = true;
			map?.remove();
			map = undefined;
			onfail?.();
		};
		if (!canDrawMaps()) {
			fail();
			return;
		}

		void (async () => {
			try {
				const [{ default: maplibre }, data] = await Promise.all([import('maplibre-gl'), loadData(), import('maplibre-gl/dist/maplibre-gl.css')]);
				if (stopped || !container) return;
				if (data.areas.length === 0 && oneNation) throw new Error('The nation has no land areas to show');
				const style = await styleFor(data);
				const start = camera ?? undefined;
				const opening = oneNation
					? { bounds: boundsOfAreas(data.areas), fitBoundsOptions: { padding: 32, maxZoom: 12 } }
					: start
						? { center: start.center, zoom: start.zoom }
						: { bounds: tileMapPlaces[0].bounds, fitBoundsOptions: { padding: 16 } };
				map = new maplibre.Map({
					container,
					style,
					...opening,
					minZoom: 1,
					maxZoom: 16,
					cooperativeGestures: true,
					dragRotate: false,
					pitchWithRotate: false,
					touchPitch: false,
					attributionControl: false
				});
				map.touchZoomRotate.disableRotation();
				map.keyboard.disableRotation();
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
				map.addControl(new maplibre.AttributionControl({ compact: false }), 'bottom-right');
				map.addControl(new maplibre.ScaleControl({ unit: 'imperial' }), 'top-left');
				const sameInWords = oneNation ? 'The list under the map names the same areas.' : 'The table beside the map lists the same places.';
				map.getCanvas().setAttribute('aria-label', `Map: ${label}. Use the arrow keys to move and the plus and minus keys to zoom. ${sameInWords}`);

				// If the first view does not finish loading, the reader keeps the drawn map rather than an empty frame.
				const giveUp = setTimeout(fail, 20000);
				cleanups.push(() => clearTimeout(giveUp));
				map.once('load', () => {
					clearTimeout(giveUp);
					ready = true;
					onready?.();
				});
				map.on('error', (event) => {
					if (!ready && /\/map-tiles\//.test(String((event.error as Error | undefined)?.message ?? ''))) fail();
				});
				map.on('moveend', () => {
					if (!map) return;
					const center = map.getCenter();
					camera = { center: [center.lng, center.lat], zoom: map.getZoom() };
				});

				// Selecting a place goes to its row; hovering marks it, as the drawn map does.
				const interactive: { layer: string; source: string; sourceLayer?: string; anchor: (properties: Record<string, unknown>) => string | undefined }[] = [
					{ layer: 'states', source: 'places', sourceLayer: 'states', anchor: (properties) => data.states[String(properties.code)]?.anchor },
					{ layer: 'regions', source: 'regions', anchor: (properties) => String(properties.anchor) },
					{ layer: 'area-dots', source: 'area-points', anchor: (properties) => String(properties.anchor) },
					{ layer: 'office-dots', source: 'offices', anchor: (properties) => String(properties.anchor ?? '') },
					{
						layer: 'land-areas',
						source: 'places',
						sourceLayer: 'land-areas',
						anchor: (properties) =>
							view === 'states' || view === 'regions' || view === 'lands'
								? `land-area-${String(properties.code).toLowerCase()}`
								: data.shading?.[view]?.areas[String(properties.code)]?.anchor
					}
				];
				let hover: { source: string; sourceLayer?: string; id: string | number } | undefined;
				const clearHover = () => {
					if (hover && map) map.setFeatureState(hover, { hover: false });
					hover = undefined;
				};
				// A nation's page has no table to go to, so its map has nothing to select.
				for (const entry of oneNation ? [] : interactive) {
					if (!map.getLayer(entry.layer) && !style.layers.some((layer) => layer.id === entry.layer)) continue;
					map.on('click', entry.layer, (event) => {
						const found = event.features?.[0];
						if (found) openRow(entry.anchor(found.properties ?? {}));
					});
					map.on('mousemove', entry.layer, (event) => {
						const found = event.features?.[0];
						if (!map || !found || found.id === undefined) return;
						clearHover();
						hover = { source: entry.source, sourceLayer: entry.sourceLayer, id: found.id };
						map.setFeatureState(hover, { hover: true });
						map.getCanvas().style.cursor = 'pointer';
					});
					map.on('mouseleave', entry.layer, () => {
						clearHover();
						if (map) map.getCanvas().style.cursor = '';
					});
				}
				// A numbered circle opens to its areas.
				map.on('click', 'area-groups', async (event) => {
					const found = event.features?.[0];
					const source = map?.getSource('area-points') as import('maplibre-gl').GeoJSONSource | undefined;
					if (!found || !source || !map) return;
					const zoom = await source.getClusterExpansionZoom(Number(found.properties?.cluster_id));
					map.easeTo({ center: (found.geometry as GeoJSON.Point).coordinates as [number, number], zoom, duration: motionDuration('medium'), easing: motionEasing('standard') });
				});

				// The map follows the site's theme: the sun and moon button sets data-theme, and without it the system setting decides.
				const restyle = async () => {
					if (map) map.setStyle(await styleFor(data));
				};
				const themeWatcher = new MutationObserver(() => void restyle());
				themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
				const scheme = matchMedia('(prefers-color-scheme: dark)');
				scheme.addEventListener('change', restyle);
				cleanups.push(() => themeWatcher.disconnect(), () => scheme.removeEventListener('change', restyle));
			} catch {
				fail();
			}
		})();

		return () => {
			stopped = true;
			for (const cleanup of cleanups) cleanup();
			cleanups = [];
			map?.remove();
			map = undefined;
		};
	});
</script>

<div class="tile-map" class:ready bind:this={container} role="region" aria-label="Map: {label}"></div>
{#if ready && !oneNation}
	<nav class="places" aria-label="Go to a part of the map">
		{#each tileMapPlaces as place (place.name)}
			<button type="button" onclick={() => showPlace(place.bounds)}>{place.name}</button>
		{/each}
	</nav>
{/if}

<style>
	.tile-map {
		width: 100%;
		aspect-ratio: 975 / 883;
		border: 1px solid var(--color-line);
		background: var(--color-paper);
	}

	/* MapLibre's controls and credit line, in the site's colors and type. */
	.tile-map :global(.maplibregl-ctrl-group) {
		border: 1px solid var(--color-control-border);
		background: var(--color-paper);
		box-shadow: none;
	}

	.tile-map :global(.maplibregl-ctrl-group button) {
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
	}

	.tile-map :global(.maplibregl-ctrl-group button + button) {
		border-top: 1px solid var(--color-control-border);
	}

	.tile-map :global(.maplibregl-ctrl-attrib),
	.tile-map :global(.maplibregl-ctrl-scale) {
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
	}

	.tile-map :global(.maplibregl-ctrl-attrib a) {
		color: var(--color-ink);
	}

	.tile-map :global(.maplibregl-ctrl-scale) {
		border-color: var(--color-ink);
	}

	.tile-map :global(.maplibregl-cooperative-gesture-screen) {
		font: inherit;
	}

	.tile-map :global(.maplibregl-canvas:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
	}

	/* MapLibre's control icons are dark; in the dark theme they are turned light. */
	:global(:root[data-theme='dark']) .tile-map :global(.maplibregl-ctrl-icon) {
		filter: invert(1);
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .tile-map :global(.maplibregl-ctrl-icon) {
			filter: invert(1);
		}
	}

	.places {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}

	.places button {
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.places button:hover {
		text-decoration: underline;
	}

	@media print {
		.tile-map,
		.places {
			display: none;
		}
	}
</style>
