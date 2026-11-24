<script lang="ts" module>
	import { isShadedMapView, type ShadedMapView } from '#lib/shaded-map-views.ts';

	/** The views of the map on /nations/map; each is a set of layers over the same basemap. The shaded views color the land areas by a fact about their nations (src/lib/shaded-map-views.ts). */
	export type TileMapView = 'states' | 'regions' | 'lands' | ShadedMapView;

	/** Where the map is looking, kept by the page so that changing views keeps the reader's place. */
	export interface TileMapCamera {
		center: [number, number];
		zoom: number;
	}

	/**
	 * Places the map can go to by name. The states and territories are where they really are on the map, so the map page's Go to menu names each rather than drawing a box at its own scale (Trevor, 2026-11-22: every territory shown and named on its own). Bounds are west, south, east, north in degrees.
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
	// Ways to zoom and move: the + and - buttons, the keyboard once the map has focus (arrows move, + and - zoom), the scroll wheel over the map, a trackpad pinch, and two fingers on a touch screen. On a touch screen one finger still scrolls the page, and MapLibre says to use two, so the map never traps a reader scrolling past it.
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
		by = 'nation',
		shape = $bindable('flat'),
		onready,
		onfail,
		onselect
	}: {
		view: TileMapView;
		/** For a shaded view: shade each nation's land areas, or each state by the category most of its nations have. */
		by?: 'nation' | 'state';
		/** Flat (Web Mercator, which stretches places far from the equator) or a globe, where every place keeps its true size. */
		shape?: 'flat' | 'globe';
		/** What the map shows, for screen readers, such as "Nations by State". */
		label: string;
		/** One nation's land areas, for its page: the map shows only those, fitted to them, with no table to go to. Without it the map shows every nation and fetches its data from /nations/map/tile-map.json. */
		data?: TileMapData;
		camera?: TileMapCamera;
		onready?: () => void;
		onfail?: () => void;
		/** Called with what a selected place goes to: a row's id, or a nation's page (/nations/<id>) for an office with no row. Without it, a row is reached through the address and a page is opened. */
		onselect?: (anchor: string) => void;
	} = $props();

	const oneNation = $derived(given !== undefined);

	/** Lucide's map and globe icons, drawn in the text color so they follow the theme. */
	const lucide = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
	const shapeIcons = {
		flat: lucide('<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>'),
		globe: lucide('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>')
	};
	/** Lucide's rotate-ccw icon, for the button that puts the map back as it opened. */
	const resetIcon = lucide('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');
	/** Lucide's maximize and minimize icons, for the full screen button. */
	const fullScreenIcons = {
		enter: lucide('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
		leave: lucide('<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>')
	};

	// Changing the view, or showing it by state, swaps the layers on the same map, so it does not reload (Trevor, 2026-11-23).
	$effect(() => {
		void view;
		void by;
		const words = `Map: ${label}. Use the arrow keys to move and the plus and minus keys to zoom.`;
		if (!ready || !map) return;
		void restyleMap?.();
		map.getCanvas().setAttribute('aria-label', `${words} ${oneNation ? 'The list under the map names the same areas.' : 'The table beside the map lists the same places.'}`);
	});

	// The shape can change while the map is open; the style built for each theme carries it too.
	$effect(() => {
		const type = shape === 'globe' ? 'globe' : 'mercator';
		if (ready && map) map.setProjection({ type });
	});

	let container: HTMLDivElement | undefined = $state();
	let map: MapLibreMap | undefined;
	/** Redraws the map's layers for the view, the theme and the shape, keeping the map, its place and its tiles. */
	let restyleMap: (() => Promise<void>) | undefined;
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
		// Where there are no basemap tiles, the background reads as water, with the world's land drawn on it from the basemap's one whole-world tile (see the "world" source below).
		const flavor = { ...basemaps.namedFlavor(dark ? 'black' : 'white'), background: colors.surface, earth: colors.paper, water: colors.surface };
		const base = basemaps.layers('basemap', flavor, { lang: 'en' }) as LayerSpecification[];
		const worldLand: LayerSpecification = { id: 'world-land', type: 'fill', source: 'world', 'source-layer': 'earth', paint: { 'fill-color': colors.paper } };
		base.splice(base.findIndex((layer) => layer.type === 'background') + 1, 0, worldLand);
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
		} else if (isShadedMapView(view) && by === 'state') {
			// A shaded view by state: each state takes the shade of the category most of its nations have.
			const entries = Object.entries(shadingIn(data)?.states ?? {});
			const byStateShade = (entries.length > 0
				? ['match', ['get', 'code'], ...entries.flatMap(([code, state]) => [code, colors.classes[state.shade]]), colors.classes[0]]
				: colors.classes[0]) as unknown as ExpressionSpecification;
			fills.push({ id: 'states', type: 'fill', source: 'places', 'source-layer': 'states', paint: { 'fill-color': hovered(byStateShade), 'fill-opacity': 0.85 } });
			tops.push({ id: 'states-lines', type: 'line', source: 'places', 'source-layer': 'states', paint: { 'line-color': colors.line, 'line-width': 0.8 } });
		} else if (isShadedMapView(view)) {
			// A shaded view: each area takes its category's shade, and areas with no fact stay the lightest. Only areas with a fact get a dot, so the dots show where the facts are.
			const shading = shadingIn(data);
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
		if (!oneNation && by === 'nation') {
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
			projection: { type: shape === 'globe' ? 'globe' : 'mercator' },
			glyphs: `${origin}/map-tiles/assets/glyphs/{fontstack}/{range}.pbf`,
			sprite: `${origin}/map-tiles/assets/sprites/${dark ? 'black' : 'white'}`,
			sources: {
				basemap: {
					type: 'vector',
					tiles: [`${origin}/map-tiles/${data.tiles.basemap}/{z}/{x}/{y}.mvt`],
					maxzoom: data.tiles.maximumZoom,
					attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, <a href="https://protomaps.com">Protomaps</a>'
				},
				/**
				 * The basemap is cut to the United States and its territories (geography/map-tile-region.json), so elsewhere, such as across the Pacific or in Europe, it has no tiles past the first zoom levels and the map was blank there (Trevor, 2026-11-23). This source reads only the basemap's zoom 0 tile, which holds the whole world in outline, and MapLibre enlarges it at every zoom: the rest of the world's land shows in rough outline, while the United States and its territories keep their full detail on top.
				 */
				world: {
					type: 'vector',
					tiles: [`${origin}/map-tiles/${data.tiles.basemap}/{z}/{x}/{y}.mvt`],
					maxzoom: 0
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
							const shaded = shadingIn(data)?.offices[office.nation];
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
						features: (shadingIn(data)?.labels ?? []).map((label) => ({ type: 'Feature', properties: { name: label.name }, geometry: { type: 'Point', coordinates: label.point } }))
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

	/** The current view's shades and rows, if it is a shaded view (src/lib/shaded-map-views.ts). */
	function shadingIn(data: TileMapData) {
		return isShadedMapView(view) ? data.shading?.[view] : undefined;
	}

	/** An area's dot's properties: on a shaded view, its shade and the row it goes to in that view's table. */
	function propertiesOf(area: TileMapData['areas'][number], data: TileMapData): Record<string, unknown> {
		if (!isShadedMapView(view)) return area;
		const shaded = shadingIn(data)?.areas[area.code];
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
		if (onselect) onselect(anchor);
		// An office on a view whose table has no row for it goes to the nation's own page.
		else if (anchor.startsWith('/')) location.assign(anchor);
		else location.hash = anchor;
	}

	/** Moves the map to one of the places in tileMapPlaces, by name; the map page's Go to menu calls it. */
	export function showPlace(name: string): void {
		const place = tileMapPlaces.find((entry) => entry.name === name);
		// The move takes its time from the motion tokens, so Reduce motion makes it a jump (src/lib/motion.ts).
		if (place) map?.fitBounds(place.bounds, { padding: 24, maxZoom: 10, duration: motionDuration('long'), easing: motionEasing('standard') });
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
					// The scroll wheel zooms the map whenever the pointer is over it (Trevor, 2026-11-23). On a touch screen one finger still scrolls the page and two move the map, so the map never traps a reader.
					cooperativeGestures: matchMedia('(pointer: coarse)').matches,
					dragRotate: false,
					pitchWithRotate: false,
					touchPitch: false,
					attributionControl: false
				});
				map.touchZoomRotate.disableRotation();
				map.keyboard.disableRotation();
				// The credit line, then the buttons, all in the bottom-right corner (Trevor, 2026-11-23). MapLibre stacks each later bottom control above the earlier ones, so the credit line is added first and the zoom buttons last, on top.
				map.addControl(new maplibre.AttributionControl({ compact: false }), 'bottom-right');
				// Full screen, where the browser allows it (Trevor, 2026-11-23). On the map page the whole view goes full screen, its picker, key, preview and table with it, from the element marked data-map-full-screen; elsewhere the map alone does.
				const mapElement = container;
				const viewGroup = document.createElement('div');
				viewGroup.className = 'maplibregl-ctrl maplibregl-ctrl-group map-buttons';
				// Reset puts the map back as it first opened: the 48 contiguous states, or a nation's own lands (Trevor, 2026-11-23).
				const resetButton = document.createElement('button');
				resetButton.type = 'button';
				resetButton.title = 'Reset the map';
				resetButton.setAttribute('aria-label', 'Reset the map');
				resetButton.innerHTML = resetIcon;
				resetButton.addEventListener('click', () => {
					const bounds = oneNation ? boundsOfAreas(data.areas) : tileMapPlaces[0].bounds;
					map?.fitBounds(bounds, { padding: oneNation ? 32 : 16, maxZoom: oneNation ? 12 : 10, duration: motionDuration('long'), easing: motionEasing('standard') });
				});
				viewGroup.append(resetButton);
				if (document.fullscreenEnabled) {
					const fullScreenButton = document.createElement('button');
					fullScreenButton.type = 'button';
					const showFullScreenState = () => {
						const on = document.fullscreenElement !== null && document.fullscreenElement.contains(mapElement);
						const words = on ? 'Leave full screen' : 'Full screen';
						fullScreenButton.title = words;
						fullScreenButton.setAttribute('aria-label', words);
						fullScreenButton.innerHTML = on ? fullScreenIcons.leave : fullScreenIcons.enter;
					};
					fullScreenButton.addEventListener('click', () => {
						if (document.fullscreenElement) void document.exitFullscreen();
						else void (mapElement.closest<HTMLElement>('[data-map-full-screen]') ?? mapElement).requestFullscreen().catch(() => {});
					});
					showFullScreenState();
					document.addEventListener('fullscreenchange', showFullScreenState);
					cleanups.push(() => document.removeEventListener('fullscreenchange', showFullScreenState));
					viewGroup.append(fullScreenButton);
				}
				map.addControl({ onAdd: () => viewGroup, onRemove: () => viewGroup.remove() }, 'bottom-right');
				// Flat or globe, as two buttons inside the map (Trevor, 2026-11-23).
				const shapeButtons = document.createElement('div');
				shapeButtons.className = 'maplibregl-ctrl maplibregl-ctrl-group map-buttons map-shape';
				shapeButtons.setAttribute('role', 'group');
				shapeButtons.setAttribute('aria-label', 'Map shape');
				const shapeChoices: { value: 'flat' | 'globe'; label: string; icon: string }[] = [
					{ value: 'flat', label: 'Flat map', icon: shapeIcons.flat },
					{ value: 'globe', label: 'Globe, every place at its true size', icon: shapeIcons.globe }
				];
				const pressed = () => {
					for (const button of shapeButtons.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.shape === shape));
				};
				for (const choice of shapeChoices) {
					const button = document.createElement('button');
					button.type = 'button';
					button.dataset.shape = choice.value;
					button.title = choice.label;
					button.setAttribute('aria-label', choice.label);
					button.innerHTML = choice.icon;
					button.addEventListener('click', () => {
						shape = choice.value;
						pressed();
					});
					shapeButtons.append(button);
				}
				pressed();
				map.addControl({ onAdd: () => shapeButtons, onRemove: () => shapeButtons.remove() }, 'bottom-right');
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
				// The distance scale sits at the bottom of the map (Trevor, 2026-11-23).
				map.addControl(new maplibre.ScaleControl({ unit: 'imperial' }), 'bottom-left');
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
					{ layer: 'states', source: 'places', sourceLayer: 'states', anchor: (properties) => (by === 'state' ? shadingIn(data)?.states[String(properties.code)]?.anchor : data.states[String(properties.code)]?.anchor) },
					{ layer: 'regions', source: 'regions', anchor: (properties) => String(properties.anchor) },
					{ layer: 'area-dots', source: 'area-points', anchor: (properties) => String(properties.anchor) },
					{ layer: 'office-dots', source: 'offices', anchor: (properties) => String(properties.anchor ?? '') },
					{
						layer: 'land-areas',
						source: 'places',
						sourceLayer: 'land-areas',
						anchor: (properties) => (isShadedMapView(view) ? shadingIn(data)?.areas[String(properties.code)]?.anchor : `land-area-${String(properties.code).toLowerCase()}`)
					}
				];
				let hover: { source: string; sourceLayer?: string; id: string | number } | undefined;
				const clearHover = () => {
					if (hover && map) map.setFeatureState(hover, { hover: false });
					hover = undefined;
				};
				// A nation's page has no table to go to, so its map has nothing to select.
				for (const entry of oneNation ? [] : interactive) {
					// Every layer a view may have is listened to, since changing the view swaps the layers on the same map.
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
				restyleMap = restyle;
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

<style>
	.tile-map {
		width: 100%;
		aspect-ratio: 975 / 883;
		border: 1px solid var(--color-line);
		background: var(--color-paper);
	}

	/* A map that is full screen by itself fills the screen. */
	.tile-map:fullscreen {
		aspect-ratio: auto;
		height: 100%;
		border: 0;
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

	/* The distance scale sits above the credit line, which runs along the bottom. */
	.tile-map :global(.maplibregl-ctrl-bottom-left) {
		bottom: 2.25rem;
	}

	.tile-map :global(.map-buttons button) {
		display: grid;
		place-items: center;
		color: var(--color-ink);
	}

	/* The shape on screen is marked as the site marks a chosen option. */
	.tile-map :global(.map-shape button[aria-pressed='true']) {
		background: var(--color-action);
		color: var(--color-action-text);
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

	@media print {
		.tile-map {
			display: none;
		}
	}
</style>
