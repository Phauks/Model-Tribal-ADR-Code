// Places each removal in research/historic-maps/removals/removals.json on the map and writes site/geography/removals.json, which tools/build-historic-maps.mjs turns into the arrows of the "Forced journeys" tiles (Trevor, 2026-11-26: "can we at least identify where tribes migrated to?").
//
// Each removal stage names the land a nation was moved from and the land it was sent to. Each end becomes one point, found in this order:
//
// - a named place with a Wikidata item (a fort, agency or reserve): the item's coordinates (property P625; Wikidata's data is CC0). Looked-up coordinates are kept in research/historic-maps/removals/wikidata-places.json, so a rebuild needs no network unless a place is new.
// - the nation's present land, by Census code: the label point in geography/census-land-area-points-2020.json.
// - land in Royce's schedule, by cession number: a point inside the largest of those cession shapes (the Forest Service's tracing, downloaded by scripts/maps/land_cessions.py fetch).
//
// An end with none of these is left without a point, and the removal gets no arrow until one is added; the run lists them.
//
// Run from site/:
//   node tools/removal-places.mjs [--work /tmp/historic-maps]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import polylabel from 'polylabel';

const researchPath = new URL('../../research/historic-maps/removals/removals.json', import.meta.url);
const placesCachePath = new URL('../../research/historic-maps/removals/wikidata-places.json', import.meta.url);
const outputPath = new URL('../geography/removals.json', import.meta.url);
const censusPointsPath = new URL('../geography/census-land-area-points-2020.json', import.meta.url);

function option(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	return index > 0 ? process.argv[index + 1] : fallback;
}

const round = (point) => point.map((value) => Math.round(value * 1e4) / 1e4);

function ringArea(ring) {
	let sum = 0;
	for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) sum += (ring[previous][0] - ring[index][0]) * (ring[previous][1] + ring[index][1]);
	return Math.abs(sum / 2);
}

/** Wikidata coordinates for each item, from the cache or, for new items, from Wikidata's API. */
async function wikidataPoints(items) {
	const cache = existsSync(placesCachePath) ? JSON.parse(readFileSync(placesCachePath, 'utf8')) : {};
	const missing = [...items].filter((item) => !(item in cache));
	for (let start = 0; start < missing.length; start += 40) {
		const batch = missing.slice(start, start + 40);
		const address = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=claims|labels&languages=en&format=json`;
		const response = await fetch(address, { headers: { 'User-Agent': 'tribal-law-project-maps/1.0' } });
		if (!response.ok) throw new Error(`${address} answered ${response.status}`);
		const { entities } = await response.json();
		for (const item of batch) {
			const entity = entities[item];
			const value = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
			cache[item] = { label: entity?.labels?.en?.value ?? null, point: value ? round([value.longitude, value.latitude]) : null };
		}
	}
	writeFileSync(placesCachePath, `${JSON.stringify(Object.fromEntries(Object.entries(cache).sort()), null, '\t')}\n`);
	return cache;
}

function roycePoints(work) {
	const path = join(work, 'cessions.geojson');
	if (!existsSync(path)) throw new Error(`No ${path}. Run python3 ../scripts/maps/land_cessions.py fetch --work ${work} first.`);
	const shapes = new Map();
	for (const feature of JSON.parse(readFileSync(path, 'utf8')).features) {
		const number = String(feature.properties['edw.s_usa.BdyPol_TribalCededLands.cessnum'] ?? '').trim();
		if (!number || !feature.geometry) continue;
		const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
		shapes.set(number, [...(shapes.get(number) ?? []), ...polygons]);
	}
	return (numbers) => {
		const polygons = numbers.flatMap((number) => shapes.get(String(number)) ?? []);
		if (!polygons.length) return null;
		const largest = polygons.reduce((best, polygon) => (ringArea(polygon[0]) > ringArea(best[0]) ? polygon : best));
		return round(polylabel(largest, 0.01));
	};
}

async function main() {
	const work = option('work', '/tmp/historic-maps');
	const research = JSON.parse(readFileSync(researchPath, 'utf8'));
	const census = new Map(JSON.parse(readFileSync(censusPointsPath, 'utf8')).areas.map((area) => [area.code, area]));
	const items = new Set(research.removals.flatMap((removal) => [removal.from.place?.wikidata, removal.to.place?.wikidata]).filter(Boolean));
	const wikidata = await wikidataPoints(items);
	const royce = roycePoints(work);
	const unplaced = [];

	const place = (end, removal, side) => {
		if (end.place?.wikidata && wikidata[end.place.wikidata]?.point) return { name: end.place.name, point: wikidata[end.place.wikidata].point, basis: `Wikidata ${end.place.wikidata}` };
		if (end.census_code && census.has(end.census_code)) return { name: census.get(end.census_code).name, point: census.get(end.census_code).point, basis: `Census Bureau area ${end.census_code} (2020)` };
		if (end.royce?.length) {
			const point = royce(end.royce);
			if (point) return { name: end.description, point, basis: `Royce cession ${end.royce.join(', ')}` };
		}
		unplaced.push(`${removal.id} (${side})`);
		return { name: end.description, point: null, basis: null };
	};

	const removals = research.removals.map((removal) => ({
		id: removal.id,
		journey: removal.journey,
		stage: removal.stage,
		people: removal.people,
		nations: removal.nations,
		years: removal.years,
		kind: removal.kind,
		from: { description: removal.from.description, ...place(removal.from, removal, 'from') },
		to: { description: removal.to.description, ...place(removal.to, removal, 'to') },
		legal_basis: removal.legal_basis,
		quote: removal.quote,
		quote_source: removal.quote_source,
		review: 'Unverified'
	}));
	const output = {
		description: "Each stage of a removal of a Native nation: the land it was moved from, the land it was sent to, the years, and the treaty, law or order behind it, with one point for each end. Compiled from treaties, statutes and official reports in research/historic-maps/removals/removals.json; placed by site/tools/removal-places.mjs. The points mark where, not the road taken.",
		research: 'research/historic-maps/removals/removals.json',
		analysis: 'research/analyses/2026-11-27-removal-routes-for-the-map.md',
		removals
	};
	writeFileSync(outputPath, `${JSON.stringify(output, null, '\t')}\n`);
	console.log(`Placed ${removals.length - new Set(unplaced.map((entry) => entry.split(' ')[0])).size} of ${removals.length} removals in geography/removals.json.`);
	if (unplaced.length) console.log(`Ends without a point: ${unplaced.join('; ')}`);
}

await main();
