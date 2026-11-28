/**
 * The removals of Native nations on the Removals page (/nations/removals) and each journey's page (Trevor approved the v2 mockups on Nov. 28, 2026, design/removals-page): the kinds of move, and the curved arrows the map draws from the land a nation left to the land it was sent to.
 *
 * The arrows join two places. They are not the roads taken, and the key says so.
 *
 * This module runs in the browser and on the server.
 */

/** How the record shows the move was made (research/historic-maps/removals/evidence.json, findings.move). */
export type RemovalMove = 'forced' | 'pressured' | 'negotiated' | 'not carried out';

/** How the map draws a journey: solid where the move itself is on record, dashed where only the order is, and not at all where the move never happened. */
export type RemovalArrowStyle = 'solid' | 'dashed' | 'not carried out';

/** The kinds of move, in the order the filter lists them, with what each means (Trevor chose "Label each kind of move", Nov. 27, 2026). */
export const removalMoves: { value: RemovalMove; label: string; meaning: string }[] = [
	{ value: 'forced', label: 'Forced', meaning: 'Troops, prisoners, escorts or orders to kill' },
	{ value: 'pressured', label: 'Pressured', meaning: 'State laws, settlers, hunger or threats, without troops' },
	{ value: 'negotiated', label: 'Negotiated', meaning: 'A treaty move the record shows as agreed or chosen' },
	{ value: 'not carried out', label: 'Not carried out', meaning: 'Ordered or agreed, but the nation was never moved' }
];

export function moveLabel(move: RemovalMove): string {
	return removalMoves.find((entry) => entry.value === move)?.label ?? move;
}

/** "1838 to 1839", or one year alone. */
export function journeyYears([first, last]: [number, number]): string {
	return first === last ? String(first) : `${first} to ${last}`;
}

/** A list of names as a sentence says it: "Georgia, Tennessee and Alabama". */
export function namesInWords(names: string[]): string {
	if (names.length < 2) return names.join('');
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One stage's arrow: from the land left to the land sent to, in degrees, with its years. */
export interface RemovalArrow {
	from: [number, number];
	to: [number, number];
	years: [number, number];
}

/** What the map needs of a journey. */
export interface RemovalJourneyLine {
	id: string;
	/** The people's short name, written beside the chosen journey's arrow. */
	people: string;
	arrow: RemovalArrowStyle;
	arrows: RemovalArrow[];
}

/** What the map draws: every journey shown, the chosen one marked, and at a year, those under way that year bold and earlier ones faint. */
export interface RemovalJourneysShown {
	lines: RemovalJourneyLine[];
	chosen?: string;
	/** The timeline's year; undefined is all years. */
	year?: number;
	/** Writes the chosen journey's people beside its arrow. */
	labels?: boolean;
	/** Thinner arrows, for a phone. */
	scale?: number;
}

type Point = [number, number];
const earthRadius = 6378137;
const toMercator = ([longitude, latitude]: Point): Point => [(earthRadius * longitude * Math.PI) / 180, earthRadius * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))];
const toDegrees = ([x, y]: Point): Point => [((x / earthRadius) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / earthRadius)) - Math.PI / 2) * 180) / Math.PI];
const rounded = ([longitude, latitude]: Point): Point => [Math.round(longitude * 1e4) / 1e4, Math.round(latitude * 1e4) / 1e4];

/** How a journey is drawn at the shown year or with one chosen: chosen, another while one is chosen, under way in the year, past, or not yet begun (hidden). */
export type JourneyState = 'shown' | 'chosen' | 'other' | 'now' | 'past' | 'hidden';

function stateOf(line: RemovalJourneyLine, arrow: RemovalArrow, shown: RemovalJourneysShown): JourneyState {
	let state: JourneyState = 'shown';
	if (shown.year !== undefined) state = arrow.years[0] > shown.year ? 'hidden' : arrow.years[1] >= shown.year ? 'now' : 'past';
	if (state !== 'hidden' && shown.chosen) state = line.id === shown.chosen ? 'chosen' : 'other';
	return state;
}

/**
 * The map's features: each stage a gentle curve bowed to the left of its way (a quadratic curve in the flat map's own projection, so it looks the same on the flat map at any zoom), an arrowhead at its end turned along the curve, a ring at the land left, and the chosen journey's name at the middle of its first arrow.
 */
export function journeyFeatures(shown: RemovalJourneysShown): { lines: GeoJSON.FeatureCollection; heads: GeoJSON.FeatureCollection; starts: GeoJSON.FeatureCollection; labels: GeoJSON.FeatureCollection } {
	const lines: GeoJSON.Feature[] = [];
	const heads: GeoJSON.Feature[] = [];
	const starts: GeoJSON.Feature[] = [];
	const labels: GeoJSON.Feature[] = [];
	const steps = 40;
	for (const line of shown.lines) {
		if (line.arrow === 'not carried out') continue;
		line.arrows.forEach((arrow, index) => {
			const state = stateOf(line, arrow, shown);
			if (state === 'hidden') return;
			const start = toMercator(arrow.from);
			const end = toMercator(arrow.to);
			const across: Point = [end[0] - start[0], end[1] - start[1]];
			const bend: Point = [(start[0] + end[0]) / 2 - across[1] * 0.18, (start[1] + end[1]) / 2 + across[0] * 0.18];
			const curve: Point[] = [];
			for (let step = 0; step <= steps; step += 1) {
				const t = step / steps;
				curve.push([(1 - t) ** 2 * start[0] + 2 * (1 - t) * t * bend[0] + t * t * end[0], (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * bend[1] + t * t * end[1]]);
			}
			const before = curve[steps - 3];
			const angle = (Math.atan2(end[0] - before[0], end[1] - before[1]) * 180) / Math.PI;
			const properties = { journey: line.id, solid: line.arrow === 'solid', state, people: line.people };
			lines.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: curve.map((point) => rounded(toDegrees(point))) } });
			heads.push({ type: 'Feature', properties: { ...properties, angle: Math.round(angle * 10) / 10 }, geometry: { type: 'Point', coordinates: rounded(arrow.to) } });
			starts.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: rounded(arrow.from) } });
			if (shown.labels && state === 'chosen' && index === 0) labels.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: rounded(toDegrees(curve[steps / 2])) } });
		});
	}
	const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
	return { lines: collection(lines), heads: collection(heads), starts: collection(starts), labels: collection(labels) };
}

/** The box around a journey's arrows, [west, south, east, north], widened so the curves and arrowheads fit: for a journey's own small map. */
export function journeyBounds(arrows: RemovalArrow[], margin = 2.6): [number, number, number, number] {
	const points = arrows.flatMap((arrow) => [arrow.from, arrow.to]);
	const longitudes = points.map((point) => point[0]);
	const latitudes = points.map((point) => point[1]);
	return [Math.min(...longitudes) - margin, Math.min(...latitudes) - margin * 1.6, Math.max(...longitudes) + margin, Math.max(...latitudes) + margin * 1.6];
}
