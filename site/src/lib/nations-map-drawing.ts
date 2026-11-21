/**
 * Draws the two maps of /nations/map as SVG markup (site/DESIGN.md, section
 * 11). The page renders this markup with {@html}, so its outlines reach the
 * browser once, in the page itself, and not a second time in the data the
 * page hydrates from (src/routes/nations/map/+page.ts explains how).
 *
 * The maps' styles are in the page, under .map-figure.
 */
import type { MapGeometry } from './map-geometry.ts';

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

export interface NationsMapCounts {
	states: StateCount[];
	regions: RegionCount[];
}

/** The finished markup of each map. */
export interface NationsMapDrawings {
	states: string;
	regions: string;
}

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

/** Lines of a region's label; two-word names that sit in narrow regions wrap. */
const labelLines = (name: string) => (name === 'Eastern Oklahoma' ? ['Eastern', 'Oklahoma'] : [name]);

/** An SVG shape with a tooltip, such as a path or a circle. */
const titled = (tag: 'path' | 'circle', attributes: string, title: string) =>
	`<${tag} ${attributes}><title>${escape(title)}</title></${tag}>`;

const link = (anchor: string, label: string, content: string) =>
	`<a href="#${escape(anchor)}" aria-label="${escape(label)}">${content}</a>`;

function drawStates(geometry: MapGeometry, counts: Map<string, StateCount>): string {
	const shapes: string[] = [];
	const markers: string[] = [];
	for (const shape of geometry.states) {
		const state = counts.get(shape.code) ?? { code: shape.code, name: shape.code, count: 0, countClass: 0 };
		const description = describeState(state, Boolean(shape.marker));
		const fill = `state count-${state.count > 0 ? state.countClass : 0}`;
		const outline = titled('path', `class="${fill}" d="${shape.path}"`, description);
		shapes.push(!shape.marker && state.count > 0 ? link(`state-${shape.code}`, description, outline) : outline);

		const marker = shape.marker;
		if (!marker) continue;
		markers.push(
			`<line class="marker-line" x1="${marker.fromX}" y1="${marker.fromY}" x2="${marker.x}" y2="${marker.y}"/>`
		);
		const dot = titled('circle', `class="${fill}" cx="${marker.x}" cy="${marker.y}" r="9"`, description);
		const code = `<text class="map-label marker-label" x="${marker.x + 12}" y="${marker.y + 5}">${escape(shape.code)}</text>`;
		markers.push(state.count > 0 ? link(`state-${shape.code}`, description, dot + code) : dot + code);
	}
	return (
		`<svg class="map" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="by-state-title">` +
		`<title id="by-state-title">Number of nations with a recorded presence in each state and territory</title>` +
		`<g class="states">${shapes.join('')}</g>` +
		`<path class="state-borders" d="${geometry.stateBorders}"/>` +
		`<g class="markers">${markers.join('')}</g>` +
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
		`<path class="land" d="${geometry.land}"/>` +
		`<g class="regions">${regions.join('')}</g>` +
		`<path class="state-borders faint" d="${geometry.stateBorders}"/>` +
		`<path class="region-borders" d="${geometry.regionBorders}"/>` +
		`<g class="region-labels" aria-hidden="true">${labels.join('')}</g>` +
		`</svg>`
	);
}

export function drawNationsMaps(geometry: MapGeometry, counts: NationsMapCounts): NationsMapDrawings {
	return {
		states: drawStates(geometry, new Map(counts.states.map((state) => [state.code, state]))),
		regions: drawRegions(geometry, new Map(counts.regions.map((region) => [region.name, region])))
	};
}
