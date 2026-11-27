<script lang="ts" module>
	import { isShadedMapView, type ShadedMapView } from '#lib/shaded-map-views.ts';
	import { patternImage, patternImageName, patternOfImageName, shapeImage, shapeImageName, shapeOfShade, type MapShape } from '#lib/map-shapes.ts';
	import { readStored, writeStored } from '#lib/browser-storage.ts';

	/** The views of the map on /nations/map; each is a set of layers over the same basemap. The shaded views color the land areas by a fact about their nations (src/lib/shaded-map-views.ts). */
	export type TileMapView = 'states' | 'regions' | 'lands' | ShadedMapView;

	/** The base maps under the project's layers (Trevor, 2026-11-24, mockup 1A): the site's own map of towns, roads and water, a picture from the U.S. Geological Survey's National Map fetched through the site (src/lib/server/map-imagery.ts), or the site's own map with the survey's shaded relief and contour lines over it. */
	export type TileMapBase = 'map' | 'satellite' | 'terrain' | 'topographic';
	export const tileMapBases: { value: TileMapBase; label: string; credit?: string }[] = [
		{ value: 'map', label: 'Map' },
		{ value: 'satellite', label: 'Satellite', credit: 'USGS The National Map: Orthoimagery' },
		{ value: 'terrain', label: 'Terrain', credit: 'USGS The National Map: Shaded Relief' },
		{ value: 'topographic', label: 'Topographic', credit: 'USGS The National Map: Shaded Relief and Contours' }
	];

	/**
	 * The layers the Map page turns on and off (Trevor, 2026-11-26, map redesign D): today's layers, which the map draws at Today only, and the history layers, which follow the timeline's year. Land cessions keep their own switch (the cessions prop), shared with nation and treaty pages.
	 */
	export interface TileMapLayers {
		lands: boolean;
		states: boolean;
		offices: boolean;
		regions: boolean;
		borders: boolean;
		routes: boolean;
		homelands: boolean;
	}

	/** A shape from a history layer that the reader chose, for the details beside the map. */
	export type TileMapFeature =
		| { kind: 'border'; id: string; name: string; territory: string; from: number; to: number; change: string; citation: string }
		| { kind: 'homeland'; area: number; named: string }
		| { kind: 'route'; routes: string };

	/** The base map and switches are remembered on the device, and every map on the site shares them. */
	const baseStorage = 'map-base';
	const placeNamesStorage = 'map-place-names';
	const outlinesStorage = 'map-land-outlines';
	export function storedBaseMap(): TileMapBase {
		const stored = typeof window === 'undefined' ? null : readStored(baseStorage);
		return tileMapBases.some((entry) => entry.value === stored) ? (stored as TileMapBase) : 'map';
	}
	/** Whether place names and roads are drawn over a picture base map, as remembered on the device. */
	export const storedPlaceNames = () => typeof window === 'undefined' || readStored(placeNamesStorage) !== 'off';
	/** Whether land areas are outlined, as remembered on the device. */
	export const storedOutlines = () => typeof window === 'undefined' || readStored(outlinesStorage) !== 'off';

	/** Where the map is looking, kept by the page so that changing views keeps the reader's place. */
	export interface TileMapCamera {
		center: [number, number];
		zoom: number;
	}

	/**
	 * Places the map can go to by name. The states and territories are where they really are on the map, so the map page's Go to menu names each rather than drawing a box at its own scale (Trevor, 2026-11-22: every territory shown and named on its own). Bounds are west, south, east, north in degrees.
	 */
	/** Room to leave around what the map moves to, in pixels: one number for every side, or each side's own. */
	export type TileMapPadding = number | { top: number; right: number; bottom: number; left: number };

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
	import { onMount, tick } from 'svelte';
	import type { Map as MapLibreMap, StyleSpecification, LayerSpecification, SourceSpecification, ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
	import type { TileMapData } from '#lib/server/nations-map.ts';
	import { motionDuration, motionEasing } from '#lib/motion.ts';
	import { censusYearFor, writeCessionsSwitch } from '#lib/historic-map.ts';
	import { loadAllNationsTileMapData, loadTileMapLibrary } from '#lib/tile-map-loading.ts';
	import { drawGlobeSky, type GlobeSkyColors, type Star } from '#lib/globe-sky.ts';

	let {
		view,
		label,
		data: given,
		camera = $bindable(),
		by = 'nation',
		shape = $bindable('flat'),
		onready,
		onfail,
		onselect,
		opening: openingBox,
		year,
		cessions = $bindable(false),
		cessionsShown,
		cessionsAlways = false,
		cessionsBounds,
		oncession,
		layerSwitches,
		statesBy = 'count',
		onfeature,
		baseMap = $bindable(storedBaseMap()),
		placeNames = $bindable(storedPlaceNames()),
		outlines = $bindable(storedOutlines())
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
		/** Where the map opens, and where its reset button goes back to, [west, south, east, north] in degrees: a state's page opens on the state (Trevor, 2026-11-24). Without it the map opens on the 48 contiguous states, or on a nation's lands. */
		opening?: [number, number, number, number];
		/** The year the slider under the map picks (YearSlider.svelte): the land the United States had taken by then, and the Census Bureau's land areas as they were then. Without it, or at the latest Census year, the land areas are today's. */
		year?: number;
		/** Whether Royce's land cessions are drawn, from the Historic switch in the Layers menu (historic maps mockup A), remembered on the device. */
		cessions?: boolean;
		/** Only these cessions, by Royce's number: a nation's page shows the cessions that name it. */
		cessionsShown?: string[];
		/** A treaty's page: its cessions are always drawn, whatever the year, with no switch and no land areas (mockup 7). */
		cessionsAlways?: boolean;
		/** The box around cessionsShown; turning the switch on widens a nation's map to take them in (mockup 6). */
		cessionsBounds?: [number, number, number, number];
		/** Called with Royce's number when the reader chooses a cession on the map. */
		oncession?: (royce: string) => void;
		/**
		 * The Map page's layers (map redesign D). With them the map draws each layer that is on, together, rather than one view: "view" then says only how the land is colored ("lands" for one color, or a shaded view), and the page draws its own Layers list, so the map keeps only zoom, flat or globe, and full screen, at the top right.
		 */
		layerSwitches?: TileMapLayers;
		/** On the Map page, how the States layer is colored: 'count' for its number of nations, a shaded view's key for what most of its nations have, or '' for outlines only. */
		statesBy?: string;
		/** Called with a shape from the borders, removal routes or homelands layer that the reader chose. */
		onfeature?: (feature: TileMapFeature) => void;
		/** The base map, which the page's Layers list can choose too; remembered on the device. */
		baseMap?: TileMapBase;
		/** On a picture base map, whether place names and roads are drawn over it. */
		placeNames?: boolean;
		/** Whether the land areas are outlined. */
		outlines?: boolean;
	} = $props();

	const explorer = $derived(layerSwitches !== undefined);

	const oneNation = $derived(given !== undefined);

	/** Lucide's map and globe icons, drawn in the text color so they follow the theme. */
	const lucide = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
	const shapeIcons = {
		flat: lucide('<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>'),
		globe: lucide('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>')
	};
	/** Lucide's rotate-ccw icon, for the button that puts the map back as it opened. */
	const resetIcon = lucide('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');
	/** Lucide's layers icon, for the base map button. */
	const layersIcon = lucide('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>');
	const layersIdentifier = $props.id();
	const layersMenuIdentifier = `map-layers-${layersIdentifier}`;
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
		showShape();
		if (ready && map) {
			map.setProjection({ type });
			showStarCredit(map, type === 'globe');
		}
		drawSkySoon();
	});

	/**
	 * The starry sky behind the globe (Trevor, 2026-11-27, mockup A), drawn on a canvas under the map by src/lib/globe-sky.ts: a night sky in both themes, its stars where the real sky is behind that side of the earth at the moment the map opened. It moves only when the reader moves the globe, and the flat map has none. The stars are fetched the first time the globe is shown.
	 */
	let skyCanvas: HTMLCanvasElement | undefined = $state();
	let skyStars: Star[] | undefined;
	let skyStarsLoading = false;
	let skyFrame = 0;
	const skyTime = new Date();

	function drawSkySoon(): void {
		if (skyFrame || typeof requestAnimationFrame === 'undefined') return;
		skyFrame = requestAnimationFrame(() => {
			skyFrame = 0;
			drawSky();
		});
	}

	function drawSky(): void {
		if (!skyCanvas || !container) return;
		const shown = ready && map !== undefined && shape === 'globe';
		skyCanvas.hidden = !shown;
		if (!shown || !map) return;
		if (!skyStars) {
			if (!skyStarsLoading) {
				skyStarsLoading = true;
				fetch('/map-sky/stars.json')
					.then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
					.then((file: { stars: Star[] }) => {
						skyStars = file.stars;
						drawSkySoon();
					})
					.catch(() => {
						// Without the stars the globe still shows, on the plain sky.
						skyStars = [];
						drawSkySoon();
					});
			}
			return;
		}
		const width = container.clientWidth;
		const height = container.clientHeight;
		const ratio = window.devicePixelRatio || 1;
		if (skyCanvas.width !== Math.round(width * ratio) || skyCanvas.height !== Math.round(height * ratio)) {
			skyCanvas.width = Math.round(width * ratio);
			skyCanvas.height = Math.round(height * ratio);
		}
		const context = skyCanvas.getContext('2d');
		if (!context) return;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		const center = map.getCenter();
		const colors: GlobeSkyColors = {
			sky: token('map-sky'),
			skyEdge: token('map-sky-edge'),
			star: token('map-sky-star'),
			starCool: token('map-sky-star-cool'),
			starWarm: token('map-sky-star-warm'),
			glow: token('map-sky-glow')
		};
		drawGlobeSky(context, skyStars, { width, height, longitude: center.lng, latitude: center.lat, zoom: map.getZoom(), fieldOfView: map.getVerticalFieldOfView(), time: skyTime }, colors);
	}

	/** The stars' credit, which ESA's license asks for, in the map's credit line while the globe is shown: an empty source carrying it, with a layer so MapLibre lists it. */
	const starCredit = '<a href="https://www.cosmos.esa.int/web/hipparcos">Stars: ESA Hipparcos</a>';
	const starCreditSource: SourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: starCredit };
	const starCreditLayer: LayerSpecification = { id: 'star-credit', type: 'circle', source: 'star-credit' };
	function showStarCredit(shown: MapLibreMap, on: boolean): void {
		if (on && !shown.getSource('star-credit')) {
			shown.addSource('star-credit', starCreditSource);
			shown.addLayer(starCreditLayer);
		} else if (!on && shown.getSource('star-credit')) {
			shown.removeLayer('star-credit');
			shown.removeSource('star-credit');
		}
	}

	/** The flat-or-globe button, which names and shows the shape it switches to. */
	let shapeButton: HTMLButtonElement | undefined;
	function showShape(): void {
		if (!shapeButton) return;
		const next = shape === 'globe' ? { label: 'Show as a flat map', icon: shapeIcons.flat } : { label: 'Show as a globe, every place at its true size', icon: shapeIcons.globe };
		shapeButton.title = next.label;
		shapeButton.setAttribute('aria-label', next.label);
		shapeButton.innerHTML = next.icon;
	}

	let container: HTMLDivElement | undefined = $state();
	let map: MapLibreMap | undefined;
	/** Redraws the map's layers for the view, the theme and the shape, keeping the map, its place and its tiles. */
	let restyleMap: (() => Promise<void>) | undefined;
	let ready = $state(false);

	/**
	 * The base map and what is drawn on it, chosen from the Layers button (mockup 1A), or on the Map page from its Layers list, and remembered on the device (storedBaseMap above).
	 */
	let layersOpen = $state(false);
	let layersButton: HTMLButtonElement | undefined;
	let layersMenu: HTMLElement | undefined = $state();
	let layersMenuBottom = $state(0);
	/** Whether the view draws land areas, so the outline switch has something to turn off. */
	const hasLandAreas = $derived((oneNation && !cessionsAlways) || view === 'lands' || (isShadedMapView(view) && by === 'nation'));

	$effect(() => {
		writeStored(baseStorage, baseMap);
		writeStored(placeNamesStorage, placeNames ? 'on' : 'off');
		// The Map page has its own Nations' land switch and no outline switch, so it leaves the nation pages' choice alone.
		if (!explorer) writeStored(outlinesStorage, outlines ? 'on' : 'off');
	});
	$effect(() => {
		if (!cessionsAlways && ready) writeCessionsSwitch(cessions);
	});
	const drawsCessions = $derived(cessions || cessionsAlways);
	let cessionsWereOn: boolean | undefined;
	$effect(() => {
		const on = cessions;
		if (!ready || !map) return;
		const turnedOn = cessionsWereOn === false && on;
		cessionsWereOn = on;
		if (!turnedOn || !cessionsBounds || !oneNation) return;
		const box = map.getBounds();
		const around: [number, number, number, number] = [Math.min(box.getWest(), cessionsBounds[0]), Math.min(box.getSouth(), cessionsBounds[1]), Math.max(box.getEast(), cessionsBounds[2]), Math.max(box.getNorth(), cessionsBounds[3])];
		map.fitBounds(around, { padding: 16, duration: motionDuration('long'), easing: motionEasing('standard') });
	});
	// A new base map or switch redraws the map's layers on the same map, as changing the view does.
	let styledWith = '';
	$effect(() => {
		const wanted = `${baseMap} ${placeNames} ${outlines} ${drawsCessions} ${year} ${statesBy} ${cessionsShown?.join(',')} ${JSON.stringify(layerSwitches ?? {})}`;
		if (!ready || !map) return;
		if (styledWith === '') styledWith = wanted;
		if (wanted === styledWith) return;
		styledWith = wanted;
		restyleSoon();
	});
	/** Moving the slider asks for many redraws a second; only the last one in each frame is drawn. */
	let restyleFrame = 0;
	function restyleSoon(): void {
		if (restyleFrame) return;
		restyleFrame = requestAnimationFrame(() => {
			restyleFrame = 0;
			void restyleMap?.();
		});
	}

	/**
	 * Places the menu beside the Layers button where it fits. On a short map, or when choosing a picture adds a row, it moves down so it never reaches past the map's top.
	 */
	function placeLayers(): void {
		if (!layersOpen || !layersButton || !container || !layersMenu) return;
		const box = container.getBoundingClientRect();
		const besideButton = Math.max(8, box.bottom - layersButton.getBoundingClientRect().bottom);
		layersMenuBottom = Math.max(8, Math.min(besideButton, box.height - 8 - layersMenu.offsetHeight));
	}
	$effect(() => {
		if (!layersMenu) return;
		const watcher = new ResizeObserver(placeLayers);
		watcher.observe(layersMenu);
		return () => watcher.disconnect();
	});

	function toggleLayers(): void {
		layersOpen = !layersOpen;
		if (layersOpen) {
			void tick().then(() => {
				placeLayers();
				layersMenu?.querySelector<HTMLElement>('input:checked')?.focus();
			});
		}
		layersButton?.setAttribute('aria-expanded', String(layersOpen));
	}
	function closeLayers(returnFocus: boolean): void {
		if (!layersOpen) return;
		layersOpen = false;
		layersButton?.setAttribute('aria-expanded', 'false');
		if (returnFocus) layersButton?.focus();
	}

	/** The map's data is the same for every view, so it is fetched once a page (src/lib/tile-map-loading.ts). */
	function loadData(): Promise<TileMapData> {
		if (given) return Promise.resolve(given);
		return loadAllNationsTileMapData();
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

	/** The size, in screen pixels, the category shapes' images are made at; each layer scales them to its own size. */
	const shapeImageSize = 6;
	/** Each category shade's shape image, the darkest by default as for the dots' shades. */
	const shapeImageOfShade = ['match', ['get', 'shade'], 1, shapeImageName('triangle'), 2, shapeImageName('circle'), 3, shapeImageName('square'), shapeImageName('diamond')] as unknown as ExpressionSpecification;
	const shapeByImageName = new Map(Object.values(shapeOfShade).map((shape): [string, MapShape] => [shapeImageName(shape), shape]));

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
		const [, , basemaps] = await loadTileMapLibrary();
		const dark = isDark();
		const colors = {
			paper: token('paper'),
			ink: token('ink'),
			muted: token('ink-muted'),
			line: token('control-border'),
			lineLight: token('line'),
			focus: token('focus'),
			surface: token('surface'),
			action: token('action'),
			actionText: token('action-text'),
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
		// A shape under the pointer, or one the reader found with the map's search, takes the focus color.
		const hovered = (color: ExpressionSpecification | string): ExpressionSpecification => ['case', ['any', ['boolean', ['feature-state', 'hover'], false], ['boolean', ['feature-state', 'found'], false]], colors.focus, color];
		/** Each category's pattern over its areas' shade (src/lib/map-shapes.ts): stripes, dots and a grid, the darkest shade solid, so no area rests on its shade alone. `shadeOf` gives each area's shade, 0 to 4. */
		const patternOver = (id: string, from: { source: string; 'source-layer'?: string; filter?: FilterSpecification }, shadeOf: ExpressionSpecification): LayerSpecification => ({
			id,
			type: 'fill',
			source: from.source,
			...(from['source-layer'] ? { 'source-layer': from['source-layer'] } : {}),
			filter: ['all', ...(from.filter ? [from.filter] : []), ['match', shadeOf, [1, 2, 3], true, false]] as FilterSpecification,
			paint: { 'fill-pattern': ['match', shadeOf, 3, patternImageName('stripes', colors.paper), 2, patternImageName('dots', colors.ink), patternImageName('grid', colors.ink)] as unknown as ExpressionSpecification }
		});

		// An earlier year than the latest Census year shows the Census Bureau's land areas as they were drawn that year, and none before its first (historic maps mockup A). The dots and names are from the 2020 Census, so they are left out before it.
		const censusYears = data.tiles.landAreaYears;
		const pastYear = year !== undefined && year < censusYears[censusYears.length - 1];
		const census = pastYear && year !== undefined ? censusYearFor(year, censusYears) : undefined;
		const landSource = pastYear ? 'areas-by-year' : 'places';
		const inCensusYear: FilterSpecification | undefined = census === undefined ? undefined : ['all', ['<=', ['get', 'from'], census], ['>=', ['get', 'to'], census]];
		const hideLandAreas = (pastYear && census === undefined) || cessionsAlways;
		const hideDots = hideLandAreas || (pastYear && (census ?? 0) < 2020);

		const fills: LayerSpecification[] = [];
		const tops: LayerSpecification[] = [];

		/**
		 * The states and territories as they stood on the timeline's day (the Newberry Library's Atlas of Historical County Boundaries): states pale teal, territories pale green, unorganized territory paper, land claimed or shared with another country grey. At Today, the states as they stand now.
		 */
		const borderDay = year === undefined || !pastYear ? 99990101 : year * 10000 + 701;
		const addBorders = () => {
			const onDay: FilterSpecification = ['all', ['<=', ['get', 'from'], borderDay], ['>=', ['get', 'to'], borderDay]];
			const kindShade = ['match', ['get', 'kind'], 'state', colors.classes[1], 'district', colors.classes[1], 'territory', token('status-published-background'), 'unorganized-territory', colors.surface, colors.lineLight] as unknown as ExpressionSpecification;
			fills.push({ id: 'borders', type: 'fill', source: 'borders', 'source-layer': 'borders', filter: onDay, paint: { 'fill-color': hovered(kindShade), 'fill-opacity': 0.9 } });
			tops.push(
				{ id: 'borders-lines', type: 'line', source: 'borders', 'source-layer': 'borders', filter: onDay, paint: { 'line-color': colors.ink, 'line-width': 0.9, 'line-opacity': 0.7 } },
				{
					id: 'borders-names',
					type: 'symbol',
					source: 'borders',
					// One point for each shape, so a state cut across tiles is named once.
					'source-layer': 'border-names',
					filter: onDay,
					layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-max-width': 7, 'text-padding': 4 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 1.5 }
				}
			);
		};
		/** The lands the Indian Claims Commission found each nation held, from the 1978 map: findings, so dashed and lightly filled, never solid borders (map redesign D; decision 0056). */
		const addHomelands = () => {
			const gold = token('status-draft-rule');
			fills.push({ id: 'homelands', type: 'fill', source: 'homelands', 'source-layer': 'homelands', paint: { 'fill-color': gold, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.12] } });
			tops.push(
				{ id: 'homelands-lines', type: 'line', source: 'homelands', 'source-layer': 'homelands', paint: { 'line-color': gold, 'line-width': 1.6, 'line-dasharray': [3, 2] } },
				{
					id: 'homelands-names',
					type: 'symbol',
					source: 'homelands',
					'source-layer': 'homelands',
					minzoom: 5,
					layout: { 'text-field': ['get', 'named'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-max-width': 8, 'text-padding': 4 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 1.5 }
				}
			);
		};
		/** The removal routes the National Park Service maps (the Trail of Tears, 1837 to 1839), in the action color with a paper edge so they read over any layer. */
		const addRoutes = () => {
			tops.push(
				{ id: 'routes-edge', type: 'line', source: 'routes', 'source-layer': 'routes', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': colors.paper, 'line-width': 4.5 } },
				{ id: 'routes', type: 'line', source: 'routes', 'source-layer': 'routes', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': colors.action, 'line-width': 2.5 } }
			);
		};
		/** Each state shaded by its number of nations, with its name and number. */
		const addStatesByCount = () => {
			fills.push({ id: 'states', type: 'fill', source: 'places', 'source-layer': 'states', paint: { 'fill-color': hovered(stateShade), 'fill-opacity': 0.85 } });
			tops.push({ id: 'states-lines', type: 'line', source: 'places', 'source-layer': 'states', paint: { 'line-color': colors.line, 'line-width': 0.8 } });
			// Each state's name and its number of nations, as on the approved States view (map engine mockup 4). On the two darkest shades the words are paper with an ink halo, so they keep their contrast, as on the drawn map.
			const onDark: ExpressionSpecification = ['>=', ['get', 'countClass'], 3];
			tops.push({
				id: 'states-names',
				type: 'symbol',
				source: 'state-names',
				layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'count']]], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-max-width': 8, 'text-padding': 2 },
				paint: { 'text-color': ['case', onDark, colors.paper, colors.ink], 'text-halo-color': ['case', onDark, colors.ink, colors.paper], 'text-halo-width': 1.5 }
			});
		};
		/** The Bureau of Indian Affairs' regions: shaded on their own view; on the Map page, outlined in orange over the other layers (map redesign D). */
		const addRegions = (outlined: boolean) => {
			// A clear fill still lets the reader choose a region anywhere inside it.
			fills.push({ id: 'regions', type: 'fill', source: 'regions', paint: { 'fill-color': hovered(colors.classes[1]), 'fill-opacity': outlined ? ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0] : 0.75 } });
			tops.push({ id: 'regions-lines', type: 'line', source: 'regions', paint: { 'line-color': outlined ? colors.action : colors.classes[4], 'line-width': outlined ? 2 : 1.4 } });
			tops.push({
				id: 'regions-names',
				type: 'symbol',
				source: 'region-names',
				layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-max-width': 8 },
				paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2 }
			});
		};
		/** A shaded view by state: each state takes the shade of the category most of its nations have. */
		const addStatesByCategory = (shading = shadingIn(data)) => {
			// A shaded view by state: each state takes the shade of the category most of its nations have.
			const entries = Object.entries(shading?.states ?? {});
			const byStateShade = (entries.length > 0
				? ['match', ['get', 'code'], ...entries.flatMap(([code, state]) => [code, colors.classes[state.shade]]), colors.classes[0]]
				: colors.classes[0]) as unknown as ExpressionSpecification;
			fills.push({ id: 'states', type: 'fill', source: 'places', 'source-layer': 'states', paint: { 'fill-color': hovered(byStateShade), 'fill-opacity': 0.85 } });
			const stateShadeNumber = (entries.length > 0 ? ['match', ['get', 'code'], ...entries.flatMap(([code, state]) => [code, state.shade]), 0] : ['literal', 0]) as unknown as ExpressionSpecification;
			fills.push(patternOver('states-patterns', { source: 'places', 'source-layer': 'states' }, stateShadeNumber));
			tops.push({ id: 'states-lines', type: 'line', source: 'places', 'source-layer': 'states', paint: { 'line-color': colors.line, 'line-width': 0.8 } });
		};
		/** The states outlined and named, with a clear fill so a state can still be pointed at and chosen. */
		const addStatesOutlined = () => {
			const marked: ExpressionSpecification = ['any', ['boolean', ['feature-state', 'hover'], false], ['boolean', ['feature-state', 'found'], false]];
			fills.push({ id: 'states', type: 'fill', source: 'places', 'source-layer': 'states', paint: { 'fill-color': colors.focus, 'fill-opacity': ['case', marked, 0.35, 0] } });
			tops.push(
				{ id: 'states-lines', type: 'line', source: 'places', 'source-layer': 'states', paint: { 'line-color': colors.ink, 'line-width': 1, 'line-opacity': 0.6 } },
				{
					id: 'states-names',
					type: 'symbol',
					source: 'state-names',
					layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-max-width': 8, 'text-padding': 2 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 1.5 }
				}
			);
		};
		/** A shaded view's land areas, each in its category's shade. */
		const addShadedLands = () => {
			// A shaded view: each area takes its category's shade, and areas with no fact stay the lightest. Only areas with a fact get a dot, so the dots show where the facts are.
			const shading = shadingIn(data);
			const entries = Object.entries(shading?.areas ?? {});
			const areaShade = (entries.length > 0
				? ['match', ['to-string', ['get', 'code']], ...entries.flatMap(([code, area]) => [code, colors.classes[area.shade]]), colors.classes[0]]
				: colors.classes[0]) as unknown as ExpressionSpecification;
			const dotShade = ['match', ['get', 'shade'], 1, colors.classes[1], 2, colors.classes[2], 3, colors.classes[3], colors.classes[4]] as unknown as ExpressionSpecification;
			// A past year shows the areas as the Census Bureau drew them that year, colored by the facts recorded today (Trevor, 2026-11-27: the coloring ignored the timeline).
			const thatYear: { filter?: FilterSpecification } = inCensusYear ? { filter: inCensusYear } : {};
			fills.push({ id: 'land-areas', type: 'fill', source: landSource, 'source-layer': 'land-areas', ...thatYear, paint: { 'fill-color': hovered(areaShade), 'fill-opacity': 0.85 } });
			const areaShadeNumber = (entries.length > 0 ? ['match', ['to-string', ['get', 'code']], ...entries.flatMap(([code, area]) => [code, area.shade]), 0] : ['literal', 0]) as unknown as ExpressionSpecification;
			fills.push(patternOver('land-areas-patterns', { source: landSource, 'source-layer': 'land-areas', ...thatYear }, areaShadeNumber));
			tops.push(
				{ id: 'land-areas-lines', type: 'line', source: landSource, 'source-layer': 'land-areas', ...thatYear, paint: { 'line-color': colors.line, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 10, 1.4] } },
				// Each small area's dot takes its category's shape as well as its shade (src/lib/map-shapes.ts), so no reader has to tell the shades apart.
				{
					id: 'area-dots',
					type: 'symbol',
					source: 'area-points',
					filter: ['>', ['get', 'shade'], 0],
					layout: { 'icon-image': shapeImageOfShade, 'icon-size': 5 / shapeImageSize, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
					paint: { 'icon-color': hovered(dotShade), 'icon-halo-color': colors.ink, 'icon-halo-width': 1, 'icon-opacity': dotOpacity }
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
		};
		/** The land areas in one color by kind, with dots for small ones grouped into numbered circles. */
		const addLands = () => {
			// On a nation's page, only the nation's own areas are drawn.
			const filters: FilterSpecification[] = [
				...(oneNation ? [['in', ['to-string', ['get', 'code']], ['literal', data.areas.map((area) => area.code)]] as FilterSpecification] : []),
				...(inCensusYear ? [inCensusYear] : [])
			];
			const onlyTheseAreas: { filter?: FilterSpecification } = filters.length === 0 ? {} : { filter: filters.length === 1 ? filters[0] : (['all', ...filters] as FilterSpecification) };
			fills.push({ id: 'land-areas', type: 'fill', source: landSource, 'source-layer': 'land-areas', ...onlyTheseAreas, paint: { 'fill-color': hovered(groupShade), 'fill-opacity': 0.55 } });
			fills.push(patternOver('land-areas-patterns', { source: landSource, 'source-layer': 'land-areas', ...onlyTheseAreas }, ['match', ['get', 'kind'], 'federal-reservation-or-trust-land', 4, 'state-reservation', 3, 2]));
			tops.push(
				{ id: 'land-areas-lines', type: 'line', source: landSource, 'source-layer': 'land-areas', ...onlyTheseAreas, paint: { 'line-color': colors.classes[4], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 10, 1.6] } },
				{
					id: 'area-groups',
					type: 'circle',
					source: 'area-points',
					filter: ['has', 'point_count'],
					paint: {
						// Orange, the action color, so the numbered circles stand out from the teal areas (map engine mockup).
						'circle-color': colors.action,
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
					paint: { 'text-color': colors.actionText }
				},
				// Each small area's dot takes its group's shape: federal lands the darkest shade's diamond, state reservations the square, statistical areas the circle (src/lib/map-shapes.ts).
				{
					id: 'area-dots',
					type: 'symbol',
					source: 'area-points',
					filter: ['!', ['has', 'point_count']],
					layout: { 'icon-image': ['match', ['get', 'group'], 'federal', shapeImageName('diamond'), 'state', shapeImageName('square'), shapeImageName('circle')], 'icon-size': 5 / shapeImageSize, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
					paint: { 'icon-color': hovered(pointShade), 'icon-halo-color': colors.ink, 'icon-halo-width': 1, 'icon-opacity': dotOpacity }
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
		};
		/** Nations with no Census land area, marked at their offices with a dark ring. */
		const addOffices = () => {
			const officeShade = ['match', ['get', 'shade'], 1, colors.classes[1], 2, colors.classes[2], 3, colors.classes[3], 4, colors.classes[4], colors.classes[0]] as unknown as ExpressionSpecification;
			// On a category view an office with a category takes its category's shape too, and one with none stays a ringed circle.
			const officeDots: LayerSpecification = isShadedMapView(view)
				? {
						id: 'office-dots',
						type: 'symbol',
						source: 'offices',
						layout: { 'icon-image': ['match', ['get', 'shade'], 0, shapeImageName('circle'), shapeImageOfShade], 'icon-size': 5.5 / shapeImageSize, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
						paint: { 'icon-color': hovered(officeShade), 'icon-halo-color': colors.ink, 'icon-halo-width': 2 }
					}
				: { id: 'office-dots', type: 'circle', source: 'offices', paint: { 'circle-color': hovered(officeShade), 'circle-radius': 5.5, 'circle-stroke-color': colors.ink, 'circle-stroke-width': 2 } };
			tops.push(
				officeDots,
				{
					id: 'office-names',
					type: 'symbol',
					source: 'offices',
					minzoom: 6,
					layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-max-width': 9, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 2 }
				}
			);
		};

		const layersOn = layerSwitches;
		if (layersOn) {
			// The Map page (map redesign D): every layer that is on, from the bottom up. Today's layers are drawn at Today only.
			const today = !pastYear;
			if (layersOn.borders) addBorders();
			// The states are colored on their own, apart from the land (Trevor, 2026-11-27): by number of nations, by what most of their nations have in a view, or not at all.
			if (layersOn.states && today) {
				if (isShadedMapView(statesBy)) addStatesByCategory(data.shading?.[statesBy]);
				else if (statesBy === 'count') addStatesByCount();
				else addStatesOutlined();
			}
			if (layersOn.regions && today) addRegions(true);
			if (layersOn.homelands) addHomelands();
			if (layersOn.lands) {
				if (isShadedMapView(view)) addShadedLands();
				else addLands();
			}
			if (layersOn.routes) addRoutes();
			if (layersOn.offices) addOffices();
		} else {
			if (view === 'states') addStatesByCount();
			else if (view === 'regions') addRegions(false);
			else if (isShadedMapView(view) && by === 'state') addStatesByCategory();
			else if (isShadedMapView(view)) addShadedLands();
			else addLands();
			// Nations with no Census land area, on every view of the big map.
			if (!oneNation && by === 'nation') addOffices();
		}

		// Royce's land cessions (historic maps mockup A), under the land areas: light for land ceded by the slider's year, dark for land ceded in it, with Royce's numbers once zoomed in. A treaty's page draws its own cessions dark.
		if (drawsCessions) {
			const cessionColor = token('timeline-treaty');
			const byYear: FilterSpecification[] = cessionsAlways || year === undefined ? [] : [['<=', ['get', 'year'], year]];
			const only: FilterSpecification[] = cessionsShown ? [['in', ['get', 'royce'], ['literal', cessionsShown]]] : [];
			const filter = ['all', ...byYear, ...only] as FilterSpecification;
			const inThisYear: ExpressionSpecification | boolean = cessionsAlways ? true : year === undefined ? false : ['==', ['get', 'year'], year];
			// Above a view's shades of states or regions, so it shows on every view, and under the land areas.
			const landFill = fills.findIndex((layer) => layer.id === 'land-areas');
			fills.splice(landFill === -1 ? fills.length : landFill, 0, { id: 'cession-fills', type: 'fill', source: 'cessions', 'source-layer': 'cessions', filter, paint: { 'fill-color': hovered(cessionColor), 'fill-opacity': ['case', inThisYear, 0.7, 0.22] } } as LayerSpecification);
			tops.unshift(
				{ id: 'cession-lines', type: 'line', source: 'cessions', 'source-layer': 'cessions', filter, paint: { 'line-color': cessionColor, 'line-width': ['case', inThisYear, 2.2, 0.7], 'line-opacity': ['case', inThisYear, 1, 0.7] } },
				{
					id: 'cession-numbers',
					type: 'symbol',
					source: 'cessions',
					'source-layer': 'cessions',
					filter,
					minzoom: 5.2,
					layout: { 'text-field': ['get', 'royce'], 'text-font': ['Noto Sans Medium'], 'text-size': 11, 'text-padding': 4 },
					paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 1.5 }
				}
			);
		}
		const landAreaLayers = new Set(['land-areas', 'land-areas-patterns', 'land-areas-lines']);
		const dotLayers = new Set(['area-groups', 'area-group-counts', 'area-dots', 'area-names']);
		// The offices mark nations with no land area today, so they go with today's map too.
		const officeLayers = new Set(['office-dots', 'office-names']);
		// The Map page's map shows the land areas themselves, without the numbered circles that group small ones (mockup D1).
		const groupLayers = new Set(['area-groups', 'area-group-counts']);
		const yearHides = (layer: LayerSpecification) => (hideLandAreas && landAreaLayers.has(layer.id)) || (hideDots && dotLayers.has(layer.id)) || (pastYear && officeLayers.has(layer.id)) || (explorer && groupLayers.has(layer.id));
		for (const list of [fills, tops]) {
			for (let index = list.length - 1; index >= 0; index -= 1) if (yearHides(list[index])) list.splice(index, 1);
		}

		// On a picture base map the shades let the picture show through, and land areas are outlined in a light orange that reads on photos (mockup 1A). The reader can also turn the land area outlines off, and on a picture keep or drop the place names and roads.
		const picture = baseMap !== 'map';
		const landLayers = new Set(['land-areas', 'land-areas-patterns', 'land-areas-lines']);
		const shownFills = fills.filter((layer) => outlines || !landLayers.has(layer.id));
		const shownTops = tops.filter((layer) => outlines || !landLayers.has(layer.id));
		if (picture) {
			const onPictureLine = token('band-progress');
			for (const layer of shownFills) {
				if (layer.type === 'fill' && layer.paint && !layer.id.startsWith('cession')) layer.paint['fill-opacity'] = layer.id === 'land-areas' && !isShadedMapView(view) ? 0.2 : 0.6;
			}
			for (const layer of shownTops) {
				if (layer.id === 'land-areas-lines' && layer.type === 'line' && layer.paint) {
					layer.paint['line-color'] = isShadedMapView(view) ? colors.paper : onPictureLine;
					layer.paint['line-width'] = ['interpolate', ['linear'], ['zoom'], 3, 1, 10, 2];
				}
			}
		}
		/**
		 * The survey's pictures cover the whole world only to zoom 8, and the United States and its territories closer in. Under each picture is the same picture from zoom 8 or further out, enlarged, so closer in elsewhere, or where a picture fails to arrive, the reader sees a softer picture rather than a dark square (Trevor, 2026-11-24, panning to West Africa). Under that is the world's land from the site's own map.
		 */
		const pictureLayers = (name: 'satellite' | 'terrain', paint: { 'raster-opacity'?: number; 'raster-brightness-max'?: number } = {}): LayerSpecification[] => [
			{ id: `imagery-${name}-far`, type: 'raster', source: `imagery-${name}-far`, paint: { ...paint } },
			{ id: `imagery-${name}`, type: 'raster', source: `imagery-${name}`, paint: { ...paint } }
		];
		let layers: LayerSpecification[];
		if (baseMap === 'satellite' || baseMap === 'terrain') {
			layers = [
				{ id: 'background', type: 'background', paint: { 'background-color': colors.surface } },
				worldLand,
				...pictureLayers(baseMap),
				...shownFills,
				...(placeNames ? over : []),
				...shownTops
			];
		} else if (baseMap === 'topographic') {
			// The site's own land, water and parks, with the survey's shaded relief laid over the land and its contour lines over that. Neither carries names, so the only names are the site's own, which the reader can turn off.
			const water = under.findIndex((layer) => layer.id.startsWith('water'));
			const firstWater = water === -1 ? under.length : water;
			const relief = pictureLayers('terrain', dark ? { 'raster-opacity': 0.55, 'raster-brightness-max': 0.45 } : { 'raster-opacity': 0.7 });
			const contours: LayerSpecification = { id: 'contours', type: 'raster', source: 'imagery-contours', minzoom: 10, paint: { 'raster-opacity': dark ? 1 : 0.85 } };
			layers = [...under.slice(0, firstWater), ...relief, ...under.slice(firstWater), contours, ...shownFills, ...(placeNames ? over : []), ...shownTops];
		} else {
			layers = [...under, ...shownFills, ...over, ...shownTops];
		}
		const credit = tileMapBases.find((entry) => entry.value === baseMap)?.credit ?? '';
		const origin = location.origin;
		const imageryTiles = (name: string) => [`${origin}/map-tiles/imagery/${name}/{z}/{x}/{y}`];
		const pictureSources = (name: 'satellite' | 'terrain'): Record<string, SourceSpecification> => ({
			[`imagery-${name}-far`]: { type: 'raster', tiles: imageryTiles(name), tileSize: 256, maxzoom: 8 },
			[`imagery-${name}`]: { type: 'raster', tiles: imageryTiles(name), tileSize: 256, maxzoom: 16, attribution: credit }
		});
		const pictures: Record<string, SourceSpecification> =
			baseMap === 'satellite' || baseMap === 'terrain'
				? pictureSources(baseMap)
				: baseMap === 'topographic'
					? { ...pictureSources('terrain'), 'imagery-contours': { type: 'raster', tiles: imageryTiles('contours'), tileSize: 256, minzoom: 10, maxzoom: 16 } }
					: {};

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
				// The picture base maps, each a source only while it is shown.
				...pictures,
				/**
				 * The basemap is cut to the United States and its territories (geography/map-tile-region.json). Elsewhere the site serves a copy of the whole world's map to zoom 8 in its place (src/lib/server/map-tile-serving.ts), so the reader can move anywhere (Trevor, 2026-11-24). Closer in than zoom 8 outside the United States, this source enlarges the world copy's land, so it never goes blank.
				 */
				world: {
					type: 'vector',
					tiles: [`${origin}/map-tiles/${data.tiles.worldBasemap}/{z}/{x}/{y}.mvt`],
					maxzoom: data.tiles.worldMaximumZoom
				},
				places: {
					type: 'vector',
					tiles: [`${origin}/map-tiles/${data.tiles.landAreas}/{z}/{x}/{y}.mvt`],
					maxzoom: 12,
					promoteId: { states: 'code', 'land-areas': 'code' },
					attribution: 'U.S. Census Bureau'
				},
				// The historic layers, each a source only while it is drawn, so its credit shows only then.
				...(drawsCessions
					? { cessions: { type: 'vector', tiles: [`${origin}/map-tiles/${data.tiles.landCessions}/{z}/{x}/{y}.mvt`], maxzoom: data.tiles.landCessionsMaximumZoom, promoteId: { cessions: 'royce' }, attribution: 'U.S. Forest Service, after Royce (1899)' } as SourceSpecification }
					: {}),
				...(layerSwitches?.borders ? { borders: { type: 'vector', tiles: [`${origin}/map-tiles/${data.tiles.borders}/{z}/{x}/{y}.mvt`], maxzoom: data.tiles.bordersMaximumZoom, promoteId: { borders: 'id' }, attribution: 'Newberry Library, Atlas of Historical County Boundaries' } as SourceSpecification } : {}),
				...(layerSwitches?.homelands ? { homelands: { type: 'vector', tiles: [`${origin}/map-tiles/${data.tiles.homelands}/{z}/{x}/{y}.mvt`], maxzoom: data.tiles.homelandsMaximumZoom, promoteId: { homelands: 'area' }, attribution: 'National Park Service, after the U.S. Geological Survey (1978)' } as SourceSpecification } : {}),
				...(layerSwitches?.routes ? { routes: { type: 'vector', tiles: [`${origin}/map-tiles/${data.tiles.removalRoutes}/{z}/{x}/{y}.mvt`], maxzoom: data.tiles.removalRoutesMaximumZoom, attribution: 'National Park Service' } as SourceSpecification } : {}),
				...(pastYear ? { 'areas-by-year': { type: 'vector', tiles: [`${origin}/map-tiles/${data.tiles.landAreasByYear}/{z}/{x}/{y}.mvt`], maxzoom: 12, promoteId: { 'land-areas': 'code' }, attribution: 'U.S. Census Bureau' } as SourceSpecification } : {}),
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
				'state-names': {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: Object.values(data.states).flatMap((state) =>
							'point' in state && state.point ? [{ type: 'Feature' as const, properties: { name: state.name, count: state.count, countClass: state.countClass }, geometry: { type: 'Point' as const, coordinates: state.point } }] : []
						)
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
				},
				...(shape === 'globe' ? { 'star-credit': starCreditSource } : {})
			},
			layers: shape === 'globe' ? [...layers, starCreditLayer] : layers
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

	/**
	 * The shapes the reader found with the map's search: a state, or a nation's land areas and office. They keep the focus color until the reader finds something else or closes the details (Trevor, 2026-11-27: finding a nation should mark it and go to it).
	 */
	type FoundShape = { source: string; sourceLayer?: string; id: string | number };
	let found: FoundShape[] = [];
	function markFound(shapes: FoundShape[]): void {
		for (const shape of found) if (map?.getSource(shape.source)) map.setFeatureState(shape, { found: false });
		found = shapes;
		markFoundAgain();
	}
	/** A redrawn map can drop a source and add it back, losing its marks, so they are set again after each redraw. */
	function markFoundAgain(): void {
		for (const shape of found) if (map?.getSource(shape.source)) map.setFeatureState(shape, { found: true });
	}
	/** Clears what the search found, as when the reader closes its details. */
	export function clearFound(): void {
		markFound([]);
	}

	/** Moves the map to one of the places in tileMapPlaces, or a state, by name; the map page's search calls it. A state is marked too. */
	export function showPlace(name: string, padding: TileMapPadding = 24): void {
		const place = tileMapPlaces.find((entry) => entry.name === name);
		// The move takes its time from the motion tokens, so Reduce motion makes it a jump (src/lib/motion.ts).
		if (place) {
			markFound([]);
			map?.fitBounds(place.bounds, { padding, maxZoom: 10, duration: motionDuration('long'), easing: motionEasing('standard') });
			return;
		}
		// Every state is a place too, from the map's data.
		void loadData().then((data) => {
			const entry = Object.entries(data.states).find(([, state]) => 'name' in state && state.name === name);
			if (!entry) return;
			const [code, state] = entry;
			markFound([{ source: 'places', sourceLayer: 'states', id: code }]);
			if ('bounds' in state && state.bounds) map?.fitBounds(state.bounds, { padding, maxZoom: 10, duration: motionDuration('long'), easing: motionEasing('standard') });
		});
	}

	/** Moves the map to a nation's land areas, or to its office if it has none, and marks them. The padding keeps them clear of what floats over the map. */
	export function showNation(id: string, padding: TileMapPadding = 48): void {
		void loadData().then((data) => {
			const codes = new Set(data.nationAreas?.[id] ?? []);
			const areas = data.areas.filter((area) => codes.has(area.code));
			const officeIndex = (data.offices ?? []).findIndex((office) => office.nation === id);
			markFound([
				...areas.flatMap((area): FoundShape[] => [
					{ source: 'places', sourceLayer: 'land-areas', id: area.code },
					{ source: 'areas-by-year', sourceLayer: 'land-areas', id: area.code },
					{ source: 'area-points', id: Number(area.code) }
				]),
				...(officeIndex === -1 ? [] : [{ source: 'offices', id: officeIndex }])
			]);
			const moving = { padding, duration: motionDuration('long'), easing: motionEasing('standard') };
			if (areas.length > 0) map?.fitBounds(boundsOfAreas(areas), { ...moving, maxZoom: 10 });
			else if (officeIndex !== -1) map?.flyTo({ center: data.offices[officeIndex].point, zoom: 8, padding: typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding, duration: moving.duration, easing: moving.easing });
		});
	}

	/** How close a nation's map opens: close enough to see the smallest rancheria, rather than stopping at zoom 12 (Trevor, 2026-11-24, mockup 5). */
	const nationClosestZoom = 15;

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
				const [[{ default: maplibre }], data] = await Promise.all([loadTileMapLibrary(), loadData()]);
				if (stopped || !container) return;
				if (data.areas.length === 0 && oneNation && !openingBox) throw new Error('The nation has no land areas to show');
				const style = await styleFor(data);
				const start = camera ?? undefined;
				// A nation's map opens on its lands, and with the cessions on, on the land its predecessors ceded too (mockup 6).
				const ownBounds = (): [number, number, number, number] => {
					const lands = boundsOfAreas(data.areas);
					if (!cessions || !cessionsBounds) return lands;
					return [Math.min(lands[0], cessionsBounds[0]), Math.min(lands[1], cessionsBounds[1]), Math.max(lands[2], cessionsBounds[2]), Math.max(lands[3], cessionsBounds[3])];
				};
				const opening = openingBox
					? { bounds: openingBox, fitBoundsOptions: { padding: 16, maxZoom: 10 } }
					: oneNation
						? { bounds: ownBounds(), fitBoundsOptions: { padding: 32, maxZoom: nationClosestZoom } }
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
				// The category shapes are drawn here as distance fields, once per style, when a layer first asks for one; MapLibre colors them by category and rings them in ink.
				const loaded = map;
				loaded.on('styleimagemissing', (event: { id: string }) => {
					if (loaded.hasImage(event.id)) return;
					const shape = shapeByImageName.get(event.id);
					if (shape) loaded.addImage(event.id, shapeImage(shape, shapeImageSize, 1), { sdf: true, pixelRatio: 1 });
					const pattern = patternOfImageName(event.id);
					if (pattern) loaded.addImage(event.id, patternImage(pattern.pattern, pattern.color, 2), { pixelRatio: 2 });
				});
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
					const bounds = openingBox ?? (oneNation ? boundsOfAreas(data.areas) : tileMapPlaces[0].bounds);
					const ownLands = oneNation && !openingBox;
					map?.fitBounds(bounds, { padding: ownLands ? 32 : 16, maxZoom: ownLands ? nationClosestZoom : 10, duration: motionDuration('long'), easing: motionEasing('standard') });
				});
				// The Map page keeps only zoom, flat or globe, and full screen (map redesign D).
				if (!explorer) viewGroup.append(resetButton);
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
				// On the Map page the buttons stand at the top right, zoom first, each group apart (map redesign D); elsewhere they stack in the bottom-right corner, zoom on top.
				const corner = explorer ? 'top-right' : 'bottom-right';
				if (explorer) map.addControl(new maplibre.NavigationControl({ showCompass: false }), corner);
				else map.addControl({ onAdd: () => viewGroup, onRemove: () => viewGroup.remove() }, corner);
				// Flat or globe, as one button inside the map that switches between them (Trevor, 2026-11-23; one button rather than two, 2026-11-26). It shows the shape it switches to.
				const shapeButtons = document.createElement('div');
				shapeButtons.className = 'maplibregl-ctrl maplibregl-ctrl-group map-buttons map-shape';
				const shapeToggle = document.createElement('button');
				shapeToggle.type = 'button';
				shapeToggle.addEventListener('click', () => {
					shape = shape === 'globe' ? 'flat' : 'globe';
					showShape();
				});
				shapeButtons.append(shapeToggle);
				shapeButton = shapeToggle;
				showShape();
				map.addControl({ onAdd: () => shapeButtons, onRemove: () => shapeButtons.remove() }, corner);
				if (explorer) {
					if (viewGroup.childElementCount > 0) map.addControl({ onAdd: () => viewGroup, onRemove: () => viewGroup.remove() }, corner);
				} else map.addControl(new maplibre.NavigationControl({ showCompass: false }), corner);
				// The Layers button, at the top of the stack (mockup 1A): it opens the menu of base maps drawn below in this component.
				const layersGroup = document.createElement('div');
				layersGroup.className = 'maplibregl-ctrl maplibregl-ctrl-group map-buttons map-layers';
				const layersToggle = document.createElement('button');
				layersToggle.type = 'button';
				layersToggle.title = 'Base map and layers';
				layersToggle.setAttribute('aria-label', 'Base map and layers');
				layersToggle.setAttribute('aria-expanded', 'false');
				layersToggle.setAttribute('aria-controls', layersMenuIdentifier);
				layersToggle.innerHTML = layersIcon;
				layersToggle.addEventListener('click', toggleLayers);
				layersButton = layersToggle;
				layersGroup.append(layersToggle);
				// The Map page draws its own Layers list beside its search.
				if (!explorer) map.addControl({ onAdd: () => layersGroup, onRemove: () => layersGroup.remove() }, 'bottom-right');
				// The menu closes when the reader clicks elsewhere or presses Escape.
				const onOutside = (event: PointerEvent) => {
					const target = event.target as Node | null;
					if (layersOpen && target && !layersMenu?.contains(target) && !layersGroup.contains(target)) closeLayers(false);
				};
				document.addEventListener('pointerdown', onOutside);
				cleanups.push(() => document.removeEventListener('pointerdown', onOutside));
				// The distance scale sits at the bottom of the map (Trevor, 2026-11-23).
				// The Map page's map has no distance scale: its key and Layers list take that corner (mockup D).
				if (!explorer) map.addControl(new maplibre.ScaleControl({ unit: 'imperial' }), 'bottom-left');
				const sameInWords = oneNation ? 'The list under the map names the same areas.' : 'The table beside the map lists the same places.';
				map.getCanvas().setAttribute('aria-label', `Map: ${label}. Use the arrow keys to move and the plus and minus keys to zoom. ${sameInWords}`);

				// If the first view does not finish loading, the reader keeps the drawn map rather than an empty frame.
				const giveUp = setTimeout(fail, 20000);
				cleanups.push(() => clearTimeout(giveUp));
				map.once('load', () => {
					clearTimeout(giveUp);
					ready = true;
					onready?.();
					drawSkySoon();
				});
				map.on('error', (event) => {
					if (!ready && /\/map-tiles\//.test(String((event.error as Error | undefined)?.message ?? ''))) fail();
				});
				// The sky behind the globe follows the map as it moves and resizes.
				map.on('move', drawSkySoon);
				map.on('resize', drawSkySoon);
				map.on('moveend', () => {
					if (!map) return;
					const center = map.getCenter();
					camera = { center: [center.lng, center.lat], zoom: map.getZoom() };
				});

				// Selecting a place goes to its row; hovering marks it, as the drawn map does.
				const interactive: { layer: string; source: string; sourceLayer?: string; anchor: (properties: Record<string, unknown>) => string | undefined }[] = [
					{ layer: 'states', source: 'places', sourceLayer: 'states', anchor: (properties) => (explorer ? (isShadedMapView(statesBy) ? data.shading?.[statesBy]?.states[String(properties.code)]?.anchor : data.states[String(properties.code)]?.anchor) : by === 'state' ? shadingIn(data)?.states[String(properties.code)]?.anchor : data.states[String(properties.code)]?.anchor) },
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
				// On a nation's page only its land areas can be chosen, and only where the page shows their details under the map (mockup 5).
				const chosenLayers = oneNation ? (onselect ? interactive.filter((entry) => entry.layer === 'land-areas' || entry.layer === 'area-dots') : []) : interactive;
				for (const entry of chosenLayers) {
					// Every layer a view may have is listened to, since changing the view swaps the layers on the same map. On the Map page, where layers lie over each other, one click handler below picks the top one.
					if (!explorer)
						map.on('click', entry.layer, (event) => {
							const found = event.features?.[0];
							if (found) openRow(entry.anchor(found.properties ?? {}));
						});
					map.on('mousemove', entry.layer, (event) => {
						const found = event.features?.[0];
						if (!map || !found || found.id === undefined) return;
						clearHover();
						// The land areas come from today's tiles or a past year's, so the hover goes to the source the shape came from.
						hover = { source: found.source, sourceLayer: found.sourceLayer, id: found.id };
						map.setFeatureState(hover, { hover: true });
						map.getCanvas().style.cursor = 'pointer';
					});
					map.on('mouseleave', entry.layer, () => {
						clearHover();
						if (map) map.getCanvas().style.cursor = '';
					});
				}
				/** Cessions overlap, so the one made in the slider's year wins, then the latest. */
				const chosenCession = (features: import('maplibre-gl').MapGeoJSONFeature[] | undefined) =>
					[...(features ?? [])].sort((first, second) => Number(second.properties?.year === year) - Number(first.properties?.year === year) || Number(second.properties?.year) - Number(first.properties?.year))[0];
				// On the Map page (map redesign D) the layers lie over each other, so a click goes to the topmost thing under the pointer: a removal route, a land area or its dot or an office, a homeland, a cession, a region, a state, then a state or territory of the past. A numbered circle opens on its own (below).
				if (explorer) {
					const history: Record<string, (properties: Record<string, unknown>) => TileMapFeature> = {
						routes: (properties) => ({ kind: 'route', routes: String(properties.routes ?? '') }),
						homelands: (properties) => ({ kind: 'homeland', area: Number(properties.area), named: String(properties.named ?? '') }),
						borders: (properties) => ({ kind: 'border', id: String(properties.id), name: String(properties.name ?? ''), territory: String(properties.kind ?? ''), from: Number(properties.from), to: Number(properties.to), change: String(properties.change ?? ''), citation: String(properties.citation ?? '') })
					};
					const order = ['routes', 'area-groups', 'area-dots', 'office-dots', 'land-areas', 'homelands', 'cession-fills', 'regions', 'states', 'borders'];
					map.on('click', (event) => {
						if (!map) return;
						for (const layer of order) {
							if (!map.getLayer(layer)) continue;
							const features = map.queryRenderedFeatures(event.point, { layers: [layer] });
							if (features.length === 0) continue;
							if (layer === 'area-groups') return;
							if (layer in history) onfeature?.(history[layer](features[0].properties ?? {}));
							else if (layer === 'cession-fills') {
								const found = chosenCession(features);
								if (found) oncession?.(String(found.properties?.royce));
							} else {
								const entry = interactive.find((item) => item.layer === layer);
								if (entry) openRow(entry.anchor(features[0].properties ?? {}));
							}
							return;
						}
					});
					for (const [layer, source] of [['homelands', 'homelands'], ['borders', 'borders']]) {
						map.on('mousemove', layer, (event) => {
							const found = event.features?.[0];
							if (!map || !found || found.id === undefined) return;
							clearHover();
							hover = { source, sourceLayer: source, id: found.id };
							map.setFeatureState(hover, { hover: true });
							map.getCanvas().style.cursor = 'pointer';
						});
						map.on('mouseleave', layer, () => {
							clearHover();
							if (map) map.getCanvas().style.cursor = '';
						});
					}
					map.on('mouseenter', 'routes', () => {
						if (map) map.getCanvas().style.cursor = 'pointer';
					});
					map.on('mouseleave', 'routes', () => {
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

				// Choosing a cession opens its details (mockup 2A). Cessions overlap, so the one made in the slider's year wins, then the latest; a land area, dot or office drawn over it wins over both.
				if (oncession) {
					const above = ['land-areas', 'area-dots', 'area-groups', 'office-dots'];
					const onTop = (point: import('maplibre-gl').PointLike) => (map ? map.queryRenderedFeatures(point, { layers: above.filter((layer) => map?.getLayer(layer)) }).length > 0 : false);
					if (!explorer) map.on('click', 'cession-fills', (event) => {
						if (onTop(event.point)) return;
						const found = chosenCession(event.features);
						if (found) oncession(String(found.properties?.royce));
					});
					map.on('mousemove', 'cession-fills', (event) => {
						if (!map || onTop(event.point)) return;
						const found = chosenCession(event.features);
						if (!found || found.id === undefined) return;
						clearHover();
						hover = { source: 'cessions', sourceLayer: 'cessions', id: found.id };
						map.setFeatureState(hover, { hover: true });
						map.getCanvas().style.cursor = 'pointer';
					});
					map.on('mouseleave', 'cession-fills', () => {
						clearHover();
						if (map) map.getCanvas().style.cursor = '';
					});
				}

				// The map follows the site's theme: the sun and moon button sets data-theme, and without it the system setting decides.
				const restyle = async () => {
					if (map) {
						map.setStyle(await styleFor(data));
						markFoundAgain();
					}
					drawSkySoon();
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
			if (skyFrame) cancelAnimationFrame(skyFrame);
			skyFrame = 0;
			map?.remove();
			map = undefined;
		};
	});
</script>

<div class="tile-map" class:ready class:explorer bind:this={container} role="region" aria-label="Map: {label}">
	<!-- The starry sky behind the globe, under MapLibre's canvas; only a picture, so screen readers skip it. -->
	<canvas class="globe-sky" bind:this={skyCanvas} hidden aria-hidden="true"></canvas>
	<!-- The base map menu (mockup 1A), opened by the Layers button in the map's corner stack. Escape closes it and returns to the button. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="layers-menu"
		id={layersMenuIdentifier}
		role="group"
		aria-label="Base map and layers"
		hidden={!layersOpen}
		style:bottom="{layersMenuBottom}px"
		bind:this={layersMenu}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				closeLayers(true);
			}
		}}
	>
		<fieldset class="layers-bases">
			<legend>Base map</legend>
			<div class="layers-choices">
				{#each tileMapBases as choice (choice.value)}
					<label class="layers-base" class:chosen={baseMap === choice.value}>
						<input class="visually-hidden" type="radio" name="{layersMenuIdentifier}-base" value={choice.value} checked={baseMap === choice.value} onchange={() => (baseMap = choice.value)} />
						<img src="/map-bases/{choice.value}.png" alt="" width="96" height="72" />
						<span>{choice.label}</span>
					</label>
				{/each}
			</div>
		</fieldset>
		{#if baseMap !== 'map'}
			<label class="layers-switch"><input type="checkbox" bind:checked={placeNames} />Place names and roads</label>
		{/if}
		{#if hasLandAreas}
			<label class="layers-switch"><input type="checkbox" bind:checked={outlines} />Land area outlines</label>
		{/if}
		{#if !cessionsAlways}
			<fieldset class="layers-historic">
				<legend>Historic</legend>
				<label class="layers-switch"><input type="checkbox" bind:checked={cessions} />Land cessions <span class="layers-note">Royce, 1899</span></label>
			</fieldset>
		{/if}
	</div>
</div>

<style>
	.tile-map {
		container: tile-map / inline-size;
		width: 100%;
		aspect-ratio: 975 / 883;
		border: 1px solid var(--color-line);
		background: var(--color-paper);
	}

	/* The sky behind the globe fills the map under MapLibre's canvas, which comes after it, and lets every press through to the map. */
	.globe-sky {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.globe-sky[hidden] {
		display: none;
	}

	/* A map that is full screen by itself fills the screen. */
	.tile-map:fullscreen {
		aspect-ratio: auto;
		height: 100%;
		border: 0;
	}

	/* On the Map page the map fills the frame the page gives it (map redesign D). */
	.tile-map.explorer {
		aspect-ratio: auto;
		height: 100%;
		border: 0;
	}

	/* MapLibre's controls and credit line, in the site's colors and type, and in the map controls' one look: paper, a 1px border, the control corner and one soft shadow (global.css, "Controls that float on a map"). */
	.tile-map :global(.maplibregl-ctrl-group) {
		overflow: hidden;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		box-shadow: var(--map-float-shadow);
	}

	/* The Map page's buttons stand at the top right, a little apart (map redesign D). */
	.tile-map.explorer :global(.maplibregl-ctrl-top-right .maplibregl-ctrl) {
		margin: var(--space-3) var(--space-3) 0 0;
	}

	.tile-map.explorer :global(.maplibregl-ctrl-top-right .maplibregl-ctrl + .maplibregl-ctrl) {
		margin-top: var(--space-2);
	}

	.tile-map :global(.maplibregl-ctrl-group button) {
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
	}

	.tile-map :global(.maplibregl-ctrl-group button + button) {
		border-top: 1px solid var(--color-line);
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

	/* The base map menu opens to the left of the corner stack (mockup 1A). */
	.layers-menu {
		position: absolute;
		max-height: calc(100% - 1rem);
		overflow-y: auto;
		right: calc(var(--layout-target-minimum) + 1.25rem);
		z-index: 3;
		width: min(18rem, calc(100% - var(--layout-target-minimum) - 2rem));
		padding: var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
		color: var(--color-ink);
	}

	.layers-menu[hidden] {
		display: none;
	}

	.layers-bases {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.layers-bases legend {
		margin-bottom: var(--space-2);
		padding: 0;
		font-weight: var(--font-weight-bold);
	}

	.layers-choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.layers-base {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-1);
		padding: var(--space-1);
		border: 2px solid var(--color-line);
		border-radius: var(--radius-control);
		text-align: center;
		cursor: pointer;
	}

	.layers-base img {
		width: 100%;
		height: auto;
		/* Wide and short, as in the mockup, so the menu fits on a short map. */
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: 3px;
	}

	.layers-base.chosen {
		border-color: var(--color-action);
		box-shadow: inset 0 -3px 0 var(--color-action);
	}

	.layers-base.chosen span::before {
		content: '✓ ';
		color: var(--color-action);
		font-weight: var(--font-weight-bold);
	}

	.layers-base:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 1px;
	}

	.layers-switch {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
		margin-top: var(--space-1);
	}

	.layers-historic {
		margin: var(--space-3) 0 0;
		padding: 0;
		border: 0;
		border-top: 1px solid var(--color-line);
	}

	.layers-historic legend {
		margin: 0 0 var(--space-1);
		padding: var(--space-2) 0 0;
		font-weight: var(--font-weight-bold);
	}

	.layers-note {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.layers-switch input {
		width: 1.15rem;
		height: 1.15rem;
		accent-color: var(--color-action);
	}

	/* The Layers button is marked while its menu is open. */
	.tile-map :global(.map-layers button[aria-expanded='true']) {
		background: var(--color-focus);
		color: var(--focus-text, var(--color-ink));
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

	/* On a narrow map the button groups sit side by side along the bottom, each laid out across, so the stack is never taller than the map and "+" is never cut off (mockup audit, 2026-11-23). The credit line keeps its own row under them. */
	@container tile-map (max-width: 27rem) {
		.tile-map :global(.maplibregl-ctrl-bottom-right) {
			display: flex;
			flex-wrap: wrap-reverse;
			flex-direction: row-reverse;
			align-items: flex-end;
			left: 0;
		}

		.tile-map :global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl) {
			float: none;
			margin: 0 var(--space-2) var(--space-2) 0;
		}

		.tile-map :global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group) {
			display: flex;
		}

		.tile-map :global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button) {
			border-top: 0;
			border-left: 1px solid var(--color-control-border);
		}

		/* The credit line comes first, so it is the bottom row, under the buttons. */
		.tile-map :global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib) {
			order: -1;
			flex-basis: 100%;
			margin: 0;
		}

		/* The distance scale moves to the top corner, out of the buttons' way. */
		.tile-map :global(.maplibregl-ctrl-bottom-left) {
			top: 0;
			bottom: auto;
		}

		.tile-map :global(.maplibregl-ctrl-bottom-left .maplibregl-ctrl) {
			margin: var(--space-2) 0 0 var(--space-2);
		}
	}

	/* On a narrow Map page (a phone), the map's buttons stand at the bottom right, above the timeline (mockup D on a phone). */
	@container tile-map (max-width: 40rem) {
		.tile-map.explorer :global(.maplibregl-ctrl-top-right) {
			top: auto;
			/* Above the timeline, which takes two rows on a phone (MapExplorer.svelte). */
			bottom: 11rem;
		}

		.tile-map.explorer :global(.maplibregl-ctrl-top-right .maplibregl-ctrl) {
			margin: var(--space-2) var(--space-3) 0 0;
		}

	}

	@media print {
		.tile-map {
			display: none;
		}
	}
</style>
