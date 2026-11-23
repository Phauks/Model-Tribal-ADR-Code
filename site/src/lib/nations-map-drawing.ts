/**
 * Draws the views of the one map on /nations/map as SVG markup (site/DESIGN.md,
 * section 11). The page renders this markup with {@html}, so its outlines
 * reach the browser once, in the page itself, and not a second time in the
 * data the page hydrates from (src/routes/nations/map/+page.ts explains how).
 *
 * Each view is one drawing over the same layout: a framed box for the
 * contiguous United States on top, and framed boxes for Alaska, Hawaiʻi and
 * the territories below, each with its own label and scale bar (src/lib/map-geometry.ts). To add a
 * view, add its drawing to `drawNationsMaps` and its entry to the page's list
 * of views.
 *
 * The maps' styles are in the page, under .map-figure.
 */
import type { LandAreaKind, MapGeometry, ScaleBar } from './map-geometry.ts';
import type { ShadedMapView } from './shaded-map-views.ts';

/** A state or territory, with how many nations have a recorded presence there. */
export interface StateCount {
	code: string;
	name: string;
	count: number;
	/** Which map-class shade it gets, 0 to 4. */
	countClass: number;
}

/** A Bureau of Indian Affairs region, with how many nations it serves. */
export interface RegionCount {
	name: string;
	/** The id of the region's row in the table. */
	anchor: string;
	count: number;
}

/** A Census land area, with how many nations' records link to it. */
export interface LandAreaCount {
	identifier: string;
	name: string;
	kind: LandAreaKind;
	/** The id of the area's row in the table. */
	anchor: string;
	count: number;
}

export interface NationsMapCounts {
	states: StateCount[];
	regions: RegionCount[];
}

/**
 * The finished markup of the views drawn into the page, by the view's key.
 * The "Land areas" view is heavier, so it is drawn by `drawLandAreasMap` and
 * fetched only when a reader opens it (src/routes/nations/map/land-areas.json).
 */
export interface NationsMapDrawings {
	states: string;
	regions: string;
}

/** Every view's key, including views fetched when opened. */
export type NationsMapView = keyof NationsMapDrawings | 'lands' | ShadedMapView;

/** The Census Bureau's names for each kind of area, as the table and tooltips give them. */
export const landAreaKindLabels: Record<LandAreaKind, string> = {
	'federal-reservation-or-trust-land': 'Reservation or trust land (federal)',
	'state-reservation': 'State reservation',
	'oklahoma-tribal-statistical-area': 'Oklahoma tribal statistical area',
	'alaska-native-village-statistical-area': 'Alaska Native village statistical area',
	'tribal-designated-statistical-area': 'Tribal designated statistical area',
	'state-designated-tribal-statistical-area': 'State designated tribal statistical area'
};

/**
 * The three shades of the "Land areas" view: legal areas the federal
 * government holds or recognizes, state reservations, and the Census Bureau's
 * statistical areas, which are drawn for counting and are not legal
 * boundaries.
 */
export const landAreaGroups = [
	{ key: 'federal', label: 'Reservations and trust lands (federal)', kinds: ['federal-reservation-or-trust-land'] },
	{ key: 'state', label: 'State reservations', kinds: ['state-reservation'] },
	{
		key: 'statistical',
		label: 'Census statistical areas',
		kinds: [
			'oklahoma-tribal-statistical-area',
			'alaska-native-village-statistical-area',
			'tribal-designated-statistical-area',
			'state-designated-tribal-statistical-area'
		]
	}
] as const satisfies readonly { key: string; label: string; kinds: readonly LandAreaKind[] }[];

const groupOf = (kind: LandAreaKind) =>
	landAreaGroups.find((group) => (group.kinds as readonly LandAreaKind[]).includes(kind))?.key ?? 'statistical';

/** The id of a land area's row in the table. */
export const landAreaAnchor = (identifier: string) => `land-area-${identifier.toLowerCase()}`;


const escape = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const nations = (count: number) => `${count} ${count === 1 ? 'nation' : 'nations'}`;

/**
 * The small states and territories drawn as markers show only their two-letter
 * code, so their names start with it: what is seen is what can be spoken to
 * select it (WCAG 2.5.3, label in name).
 */
function describeState(state: StateCount, marked: boolean): string {
	const name = marked ? `${state.code}, ${state.name}` : state.name;
	return state.count === 0 ? `${name}: no nations recorded` : `${name}: ${nations(state.count)}`;
}

const describeRegion = (region: RegionCount) => `${region.name} Region: ${nations(region.count)}`;

const describeLandArea = (area: LandAreaCount) =>
	`${area.name}: ${landAreaKindLabels[area.kind]}` +
	(area.count === 0 ? '' : `, linked to ${nations(area.count)}`);

/** Lines of a region's label; two-word names that sit in narrow regions wrap. */
const labelLines = (name: string) => (name === 'Eastern Oklahoma' ? ['Eastern', 'Oklahoma'] : [name]);

/** An SVG shape with a tooltip, such as a path or a circle. */
const titled = (tag: 'path' | 'circle', attributes: string, title: string) =>
	`<${tag} ${attributes}><title>${escape(title)}</title></${tag}>`;

const link = (anchor: string, label: string, content: string) =>
	`<a href="#${escape(anchor)}" aria-label="${escape(label)}">${content}</a>`;

/** A scale bar: a line with end ticks, and the distance it stands for. */
const drawScaleBar = (bar: ScaleBar) =>
	`<path class="scale-bar" d="M${bar.x},${bar.y - 5}V${bar.y}H${bar.x + bar.length}V${bar.y - 5}"/>` +
	`<text class="map-label scale-label" x="${bar.x + bar.length + 6}" y="${bar.y + 1}">${escape(bar.label)}</text>`;

/** The map's frames, drawn behind the shapes. */
const drawFrames = (geometry: MapGeometry) =>
	`<g class="inset-frames" aria-hidden="true">` +
	geometry.frames
		.map(
			(frame) =>
				`<rect class="inset-frame" x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="3"/>`
		)
		.join('') +
	`</g>`;

/**
 * The frames' labels and every scale bar, drawn over the shapes. The labels
 * are hidden from screen readers because each shape names its own place.
 */
const drawFrameLabels = (geometry: MapGeometry) =>
	`<g class="inset-labels" aria-hidden="true">` +
	geometry.frames
		.map((frame) => {
			const lines = frame.label
				.map(
					(line, index) =>
						`<tspan x="${frame.x + 10}" dy="${index === 0 ? 0 : '1.15em'}">${escape(line)}</tspan>`
				)
				.join('');
			return (
				`<text class="map-label inset-label" x="${frame.x + 10}" y="${frame.y + 20}">${lines}</text>` +
				drawScaleBar(frame.scaleBar)
			);
		})
		.join('') +
	`</g>`;

/**
 * A place that nothing links to, such as a territory with no nations recorded,
 * still shows its tooltip and an outline on hover, so a reader can see what
 * the pointer is on. Only places with a table row are links.
 */
const linkOrPlace = (anchor: string, label: string, content: string, linked: boolean) =>
	linked ? link(anchor, label, content) : `<g class="unlinked">${content}</g>`;

function drawStates(geometry: MapGeometry, counts: Map<string, StateCount>): string {
	const shapes: string[] = [];
	const markers: string[] = [];
	for (const shape of geometry.states) {
		const state = counts.get(shape.code) ?? { code: shape.code, name: shape.code, count: 0, countClass: 0 };
		const description = describeState(state, Boolean(shape.marker));
		const fill = `state count-${state.count > 0 ? state.countClass : 0}`;
		const outline = titled('path', `class="${fill}${shape.island ? ' island' : ''}" d="${shape.path}"`, description);
		const marker = shape.marker;
		if (!marker) {
			shapes.push(linkOrPlace(`state-${shape.code}`, description, outline, state.count > 0));
			continue;
		}
		// A small place's outline, marker line, dot and code are one link, so
		// pointing at any of them lights up all of them. Islands also get a wide
		// invisible stroke around their outline to point at, with the same tooltip.
		const hitArea = shape.island ? titled('path', `class="hit-area" aria-hidden="true" d="${shape.path}"`, description) : '';
		const line = `<line class="marker-line" x1="${marker.fromX}" y1="${marker.fromY}" x2="${marker.x}" y2="${marker.y}"/>`;
		const dot = titled('circle', `class="${fill}" cx="${marker.x}" cy="${marker.y}" r="9"`, description);
		const onLeft = marker.labelSide === 'left';
		const code = `<text class="map-label marker-label${onLeft ? ' label-on-left' : ''}" x="${marker.x + (onLeft ? -12 : 12)}" y="${marker.y + 5}">${escape(shape.code)}</text>`;
		markers.push(linkOrPlace(`state-${shape.code}`, description, hitArea + outline + line + dot + code, state.count > 0));
	}
	return (
		`<svg class="map" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="by-state-title">` +
		`<title id="by-state-title">Number of nations with a recorded presence in each state and territory</title>` +
		drawFrames(geometry) +
		`<g class="states">${shapes.join('')}</g>` +
		`<path class="state-borders" d="${geometry.stateBorders}"/>` +
		`<g class="markers">${markers.join('')}</g>` +
		drawFrameLabels(geometry) +
		`</svg>`
	);
}

function drawRegions(geometry: MapGeometry, counts: Map<string, RegionCount>): string {
	const regions: string[] = [];
	const labels: string[] = [];
	for (const shape of geometry.regions) {
		const region = counts.get(shape.name);
		if (!region) continue;
		const description = describeRegion(region);
		regions.push(
			link(region.anchor, description, titled('path', `class="region" d="${shape.path}"`, description))
		);
		if (!shape.showLabel) continue;
		const lines = labelLines(shape.name)
			.map(
				(line, index) =>
					`<tspan x="${shape.label.x}" dy="${index === 0 ? 0 : '1.1em'}">${escape(line)}</tspan>`
			)
			.join('');
		labels.push(
			`<text class="map-label region-label" x="${shape.label.x}" y="${shape.label.y}">${lines}</text>`
		);
	}
	return (
		`<svg class="map" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="regions-title">` +
		`<title id="regions-title">The twelve regions of the Bureau of Indian Affairs</title>` +
		drawFrames(geometry) +
		`<path class="land" d="${geometry.land}"/>` +
		`<g class="regions">${regions.join('')}</g>` +
		`<path class="state-borders faint" d="${geometry.stateBorders}"/>` +
		`<path class="region-borders" d="${geometry.regionBorders}"/>` +
		`<g class="region-labels" aria-hidden="true">${labels.join('')}</g>` +
		drawFrameLabels(geometry) +
		`</svg>`
	);
}

export function drawLandAreasMap(geometry: MapGeometry, areas: LandAreaCount[], offices: DrawnOffice[] = []): string {
	const counts = new Map(areas.map((area) => [area.identifier, area]));
	// Statistical areas first, so the legal areas inside them are drawn on top.
	const layers: Record<string, string[]> = { statistical: [], state: [], federal: [] };
	for (const shape of geometry.landAreas) {
		const area = counts.get(shape.identifier);
		if (!area) continue;
		const group = groupOf(shape.kind);
		const description = describeLandArea(area);
		const drawn = shape.dot
			? titled('circle', `class="land-area land-${group} dot" cx="${shape.dot.x}" cy="${shape.dot.y}" r="3"`, description)
			: titled('path', `class="land-area land-${group}" d="${shape.path}"`, description);
		layers[group].push(link(area.anchor, description, drawn));
	}
	return (
		`<svg class="map" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="lands-title">` +
		`<title id="lands-title">American Indian and Alaska Native areas, as the Census Bureau draws them</title>` +
		drawFrames(geometry) +
		`<path class="land" d="${geometry.land}"/>` +
		`<path class="state-borders faint" d="${geometry.stateBorders}"/>` +
		`<g class="land-areas">${layers.statistical.join('')}${layers.state.join('')}${layers.federal.join('')}</g>` +
		drawOffices(geometry, offices) +
		drawFrameLabels(geometry) +
		`</svg>`
	);
}

/** A land area as a shaded view draws it (src/lib/shaded-map-views.ts): its map-class shade, its tooltip, and the table row it goes to if it has one. */
export interface ShadedLandArea {
	identifier: string;
	shade: number;
	anchor?: string;
	description: string;
}

/** A nation with no Census land area, marked at its office: its shade, its tooltip, and where selecting it goes (a row of the view's table, or the nation's page). */
export interface DrawnOffice {
	nation: string;
	shade: number;
	href?: string;
	description: string;
}

/** Office dots, drawn over the land areas with a dark ring so they read apart from the areas' own dots. */
function drawOffices(geometry: MapGeometry, offices: DrawnOffice[]): string {
	const byNation = new Map(offices.map((office) => [office.nation, office]));
	const drawn = geometry.offices.flatMap((place) => {
		const office = byNation.get(place.nation);
		if (!office) return [];
		const dot = titled('circle', `class="office count-${office.shade}" cx="${place.x}" cy="${place.y}" r="4"`, office.description);
		return [office.href ? `<a href="${escape(office.href)}" aria-label="${escape(office.description)}">${dot}</a>` : `<g class="unlinked">${dot}</g>`];
	});
	return drawn.length > 0 ? `<g class="offices">${drawn.join('')}</g>` : '';
}

/** The middle of a drawn shape's bounding box, read from its path. */
function middleOf(path: string): { x: number; y: number } | undefined {
	const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
	if (numbers.length < 2) return undefined;
	const xs = numbers.filter((_, index) => index % 2 === 0);
	const ys = numbers.filter((_, index) => index % 2 === 1);
	return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

const median = (values: number[]) => [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];

/** A state or territory on a shaded view's by-state map: its map-class shade, its tooltip, and its row in the view's table if it has one. */
export interface ShadedState {
	code: string;
	shade: number;
	anchor?: string;
	description: string;
}

/**
 * A shaded view by state (src/lib/shaded-map-views.ts): each state and territory takes the shade of the category most of its nations have, drawn as the Nations by State view draws its states.
 */
export function drawShadedStatesMap(geometry: MapGeometry, view: { key: string; title: string; states: ShadedState[] }): string {
	const byCode = new Map(view.states.map((state) => [state.code, state]));
	const shapes: string[] = [];
	const markers: string[] = [];
	for (const shape of geometry.states) {
		const state = byCode.get(shape.code) ?? { code: shape.code, shade: 0, description: shape.code };
		const description = shape.marker ? `${shape.code}, ${state.description}` : state.description;
		const fill = `state count-${state.shade}`;
		const outline = titled('path', `class="${fill}${shape.island ? ' island' : ''}" d="${shape.path}"`, description);
		const marker = shape.marker;
		if (!marker) {
			shapes.push(linkOrPlace(state.anchor ?? '', description, outline, Boolean(state.anchor)));
			continue;
		}
		const hitArea = shape.island ? titled('path', `class="hit-area" aria-hidden="true" d="${shape.path}"`, description) : '';
		const line = `<line class="marker-line" x1="${marker.fromX}" y1="${marker.fromY}" x2="${marker.x}" y2="${marker.y}"/>`;
		const dot = titled('circle', `class="${fill}" cx="${marker.x}" cy="${marker.y}" r="9"`, description);
		const onLeft = marker.labelSide === 'left';
		const code = `<text class="map-label marker-label${onLeft ? ' label-on-left' : ''}" x="${marker.x + (onLeft ? -12 : 12)}" y="${marker.y + 5}">${escape(shape.code)}</text>`;
		markers.push(linkOrPlace(state.anchor ?? '', description, hitArea + outline + line + dot + code, Boolean(state.anchor)));
	}
	const titleId = `${view.key}-by-state-title`;
	return (
		`<svg class="map" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="${titleId}">` +
		`<title id="${titleId}">${escape(view.title)}, by state</title>` +
		drawFrames(geometry) +
		`<g class="states">${shapes.join('')}</g>` +
		`<path class="state-borders" d="${geometry.stateBorders}"/>` +
		`<g class="markers">${markers.join('')}</g>` +
		drawFrameLabels(geometry) +
		`</svg>`
	);
}

/**
 * A view that shades each land area by a fact about its nations, such as Public Law 280 (src/lib/shaded-map-views.ts). Areas with no fact are drawn in the lightest shade and go nowhere; the rest go to their row in the view's table. Labels, if given, are written at the middle of their areas, as the Indian Health Service view names its Areas.
 */
export function drawShadedLandAreasMap(
	geometry: MapGeometry,
	view: { key: string; title: string; areas: ShadedLandArea[]; offices?: DrawnOffice[]; labels?: { name: string; identifiers: string[] }[] }
): string {
	const byIdentifier = new Map(view.areas.map((area) => [area.identifier, area]));
	const unrecorded: string[] = [];
	const recorded: string[] = [];
	const middles = new Map<string, { x: number; y: number }>();
	for (const shape of geometry.landAreas) {
		const area = byIdentifier.get(shape.identifier);
		if (!area) continue;
		const middle = shape.dot ?? middleOf(shape.path);
		if (middle) middles.set(shape.identifier, middle);
		const fill = `land-area count-${area.shade}`;
		const drawn = shape.dot
			? titled('circle', `class="${fill} dot" cx="${shape.dot.x}" cy="${shape.dot.y}" r="3"`, area.description)
			: titled('path', `class="${fill}" d="${shape.path}"`, area.description);
		if (area.anchor) recorded.push(link(area.anchor, area.description, drawn));
		else unrecorded.push(`<g class="unlinked">${drawn}</g>`);
	}
	const labels = (view.labels ?? []).flatMap((label) => {
		const points = label.identifiers.map((identifier) => middles.get(identifier)).filter((point): point is { x: number; y: number } => Boolean(point));
		if (points.length === 0) return [];
		const x = median(points.map((point) => point.x));
		const y = median(points.map((point) => point.y));
		return [`<text class="map-label region-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${escape(label.name)}</text>`];
	});
	const titleId = `${view.key}-title`;
	return (
		`<svg class="map" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="${titleId}">` +
		`<title id="${titleId}">${escape(view.title)}</title>` +
		drawFrames(geometry) +
		`<path class="land" d="${geometry.land}"/>` +
		`<path class="state-borders faint" d="${geometry.stateBorders}"/>` +
		`<g class="land-areas">${unrecorded.join('')}${recorded.join('')}</g>` +
		drawOffices(geometry, view.offices ?? []) +
		(labels.length > 0 ? `<g class="region-labels" aria-hidden="true">${labels.join('')}</g>` : '') +
		drawFrameLabels(geometry) +
		`</svg>`
	);
}

export function drawNationsMaps(geometry: MapGeometry, counts: NationsMapCounts): NationsMapDrawings {
	return {
		states: drawStates(geometry, new Map(counts.states.map((state) => [state.code, state]))),
		regions: drawRegions(geometry, new Map(counts.regions.map((region) => [region.name, region])))
	};
}
