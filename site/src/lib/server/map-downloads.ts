/**
 * The map's layers as GeoJSON files (RFC 7946), for mapping programs (site/DESIGN.md, section 6,
 * "Download"). Trevor asked for them on Nov. 23, 2026. They are the same simplified shapes the
 * drawn map uses (geography/README.md), so a land area a nation asked to leave off the map is
 * left out here too. Each file names its source and the date it was retrieved.
 */
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon, Position } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import regionsTopology from '../../../geography/bureau-of-indian-affairs-regions.json';
import landAreasTopology from '../../../geography/census-land-areas-2020.json';
import officeList from '../../../geography/nation-office-points.json';
import withdrawnList from '../../../geography/withdrawn-land-areas.json';
import { displayName } from '../nation-labels.ts';
import { nations } from './content.ts';

/** A GeoJSON file with a note on where its shapes came from (a foreign member, which RFC 7946 allows). */
type SourcedCollection<G extends Polygon | MultiPolygon | Point> = FeatureCollection<G> & {
	source: string;
	retrieved?: string;
	note?: string;
};

/** Twice the signed area of a ring on the plane of longitude and latitude; positive is counterclockwise. */
function signedArea(ring: Position[]): number {
	let sum = 0;
	for (let index = 0; index < ring.length - 1; index += 1) {
		sum += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
	}
	return sum;
}

function round(ring: Position[]): Position[] {
	return ring.map(([longitude, latitude]) => [Math.round(longitude * 1e5) / 1e5, Math.round(latitude * 1e5) / 1e5]);
}

/**
 * RFC 7946 wants outer rings counterclockwise and holes clockwise. The files keep outer rings
 * clockwise, as d3-geo reads them (geography/README.md), so each ring is turned as needed.
 */
function rewound(polygon: Position[][]): Position[][] {
	return polygon.map((ring, index) => {
		const rounded = round(ring);
		const counterclockwise = signedArea(rounded) > 0;
		return (index === 0) === counterclockwise ? rounded : [...rounded].reverse();
	});
}

function geoJsonGeometry(geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
	return geometry.type === 'Polygon'
		? { type: 'Polygon', coordinates: rewound(geometry.coordinates) }
		: { type: 'MultiPolygon', coordinates: geometry.coordinates.map(rewound) };
}

function shapes(topology: unknown, object: string): Feature<Polygon | MultiPolygon, Record<string, unknown>>[] {
	const typed = topology as Topology<Record<string, GeometryCollection<Record<string, unknown>>>>;
	const collection = feature(typed, typed.objects[object]) as FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>;
	return collection.features.filter((item) => item.geometry);
}

const kindLabels: Record<string, string> = {
	'federal-reservation-or-trust-land': 'Federal reservation or off-reservation trust land',
	'state-reservation': 'State reservation',
	'oklahoma-tribal-statistical-area': 'Oklahoma tribal statistical area',
	'alaska-native-village-statistical-area': 'Alaska Native village statistical area',
	'tribal-designated-statistical-area': 'Tribal designated statistical area',
	'state-designated-tribal-statistical-area': 'State designated tribal statistical area'
};

export function landAreasGeoJson(): SourcedCollection<Polygon | MultiPolygon> {
	const withdrawn = new Set<string>(withdrawnList.codes);
	const metadata = (landAreasTopology as { metadata?: { retrieved?: string; file?: string } }).metadata;
	return {
		type: 'FeatureCollection',
		source: `U.S. Census Bureau, 2020 cartographic boundary file of American Indian/Alaska Native/Native Hawaiian areas, 1:500,000 (${metadata?.file ?? ''}), simplified for a national map by the Tribal Law Project`,
		retrieved: metadata?.retrieved,
		note: 'The Census Bureau’s areas, not a statement of any nation’s territory. Hawaiian home lands and areas a nation asked to leave off the map are left out.',
		features: shapes(landAreasTopology, 'areas')
			.filter((item) => !withdrawn.has(String(item.properties.geographic_identifier)))
			.map((item) => ({
				type: 'Feature',
				id: String(item.properties.geographic_identifier),
				properties: {
					name: item.properties.name,
					census_code: item.properties.geographic_identifier,
					kind: kindLabels[String(item.properties.kind)] ?? item.properties.kind
				},
				geometry: geoJsonGeometry(item.geometry)
			}))
	};
}

export function regionsGeoJson(): SourcedCollection<Polygon | MultiPolygon> {
	const metadata = (regionsTopology as { metadata?: { retrieved?: string; service?: string } }).metadata;
	return {
		type: 'FeatureCollection',
		source: `U.S. Department of the Interior, Bureau of Indian Affairs, Branch of Geospatial Support, BIA Regions (${metadata?.service ?? ''}), simplified for a national map by the Tribal Law Project`,
		retrieved: metadata?.retrieved,
		note: 'The Bureau’s administrative regions, not the lands of any nation.',
		features: shapes(regionsTopology, 'regions').map((item) => ({
			type: 'Feature',
			id: String(item.properties.region_identifier),
			properties: { name: `${item.properties.name} Region`, region_identifier: item.properties.region_identifier },
			geometry: geoJsonGeometry(item.geometry)
		}))
	};
}

export function officesGeoJson(): SourcedCollection<Point> {
	const names = new Map(nations().map((record) => [record.id, displayName(record.names.official)]));
	const list = officeList as { retrieved?: string; offices: { nation: string; address: string; point: number[]; precision: string }[] };
	return {
		type: 'FeatureCollection',
		source: 'Each nation’s public office address, placed by the U.S. Census Bureau’s geocoder, or at the middle of its ZIP code area when the address is a post office box',
		retrieved: list.retrieved,
		note: 'Offices of nations with no Census land area, as the drawn map marks them. precision says how each point was placed.',
		features: list.offices
			.filter((office) => names.has(office.nation))
			.map((office) => ({
				type: 'Feature',
				id: office.nation,
				properties: {
					nation: names.get(office.nation),
					page: `/nations/${office.nation}`,
					address: office.address,
					precision: office.precision === 'zip-code-area' ? 'ZIP code area' : office.precision
				},
				geometry: { type: 'Point', coordinates: [Math.round(office.point[0] * 1e5) / 1e5, Math.round(office.point[1] * 1e5) / 1e5] }
			}))
	};
}
