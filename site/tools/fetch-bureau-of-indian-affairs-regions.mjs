// Downloads the Bureau of Indian Affairs' official region boundaries and
// writes a simplified copy for the map at geography/bureau-of-indian-affairs-regions.json.
//
// Source: U.S. Department of the Interior, Bureau of Indian Affairs, Office of
// Trust Services, Division of Land Titles and Records, Branch of Geospatial
// Support, "BIA Regions" feature service (source record
// content/sources/b/bia-regions-2026.yaml). Run again to refresh the copy;
// the website build reads only the file this writes.
//
// Run from site/:  node tools/fetch-bureau-of-indian-affairs-regions.mjs

import { writeFileSync } from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';

const service =
	'https://biamaps.geoplatform.gov/server/rest/services/BOGS/BIA_Regions/FeatureServer/0/query';
const query = new URLSearchParams({
	where: '1=1',
	outFields: 'REGIONNAME,REGIONID',
	returnGeometry: 'true',
	outSR: '4326',
	f: 'geojson'
});

// Keeps this share of the points, by visual importance. About 3 percent keeps
// every region recognizable at the size of a national map (975 by 610 units)
// while keeping the file small (project choice, checked by eye).
const shareOfPointsKept = 0.03;

const response = await fetch(`${service}?${query}`);
if (!response.ok) throw new Error(`The service answered ${response.status} ${response.statusText}`);
const regions = await response.json();
if (regions.features?.length !== 12) {
	throw new Error(`Expected the 12 regions; the service returned ${regions.features?.length}`);
}

/** Twice the signed area of a ring of longitude and latitude pairs; negative when clockwise. */
function signedArea(ring) {
	let sum = 0;
	for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
		sum += (ring[previous][0] - ring[index][0]) * (ring[previous][1] + ring[index][1]);
	}
	return sum;
}

/**
 * The service writes outer rings counterclockwise, as GeoJSON (RFC 7946)
 * asks. d3-geo works on the sphere and reads a counterclockwise outer ring as
 * "everything except this shape", so outer rings are turned clockwise and
 * holes counterclockwise, the order d3-geo expects (d3-geo README, "geoPath").
 */
function windForSphere(polygon) {
	return polygon.map((ring, index) => {
		const clockwise = signedArea(ring) < 0;
		const wantClockwise = index === 0;
		return clockwise === wantClockwise ? ring : [...ring].reverse();
	});
}

function windGeometry(geometry) {
	if (geometry.type === 'Polygon') return { ...geometry, coordinates: windForSphere(geometry.coordinates) };
	return { ...geometry, coordinates: geometry.coordinates.map(windForSphere) };
}

const features = regions.features
	.map((feature) => ({
		type: 'Feature',
		properties: {
			name: feature.properties.REGIONNAME,
			region_identifier: feature.properties.REGIONID
		},
		geometry: windGeometry(feature.geometry)
	}))
	.sort((first, second) => first.properties.name.localeCompare(second.properties.name, 'en'));

const fullDetail = topology({ regions: { type: 'FeatureCollection', features } }, 1e6);
const prepared = presimplify(fullDetail);
const simplified = simplify(prepared, quantile(prepared, shareOfPointsKept));

const retrieved = new Date().toISOString().slice(0, 10);
const output = {
	...simplified,
	metadata: {
		source: 'bia-regions-2026',
		service,
		retrieved,
		simplification: `topojson-simplify, ${shareOfPointsKept * 100} percent of points kept by visual importance`
	}
};
// Rounds coordinates the simplifier left as long decimals, to keep the file small.
const text = JSON.stringify(output, (key, value) =>
	typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1e6) / 1e6 : value
);
writeFileSync(new URL('../geography/bureau-of-indian-affairs-regions.json', import.meta.url), `${text}\n`);
console.log(`Wrote ${features.length} regions (${text.length.toLocaleString('en-US')} bytes), retrieved ${retrieved}.`);
