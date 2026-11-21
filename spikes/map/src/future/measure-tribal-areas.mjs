// Future-layer feasibility test (not a map we publish). Reads the Census Bureau cartographic
// boundary file for American Indian, Alaska Native and Native Hawaiian Areas, then measures:
// size as TopoJSON and as SVG path data, render time with the same projection,
// and which states each area falls in (to see if it can cross-check the state-presence field).
// Usage: node future/measure-tribal-areas.mjs <cb_YYYY_us_aiannh_500k.shp> <output folder> [tab20_aiannh20_county20_natl.txt]
// The output folder should be outside the repository: nothing here is committed.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { read } from "shapefile";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { feature } from "topojson-client";
import { readFileSync } from "node:fs";
import { geoPath, geoContains, geoBounds } from "d3-geo";
import { loadStates, makeProjection } from "../geography.mjs";

const [shapefilePath, outputFolder, relationshipPath] = process.argv.slice(2);
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };

const areas = await read(shapefilePath, shapefilePath.replace(/\.shp$/, ".dbf"), { encoding: "utf-8" });
lap("read_shapefile_milliseconds");
const fieldNames = Object.keys(areas.features[0].properties);
const kinds = {};
for (const area of areas.features) kinds[area.properties.LSAD] = (kinds[area.properties.LSAD] ?? 0) + 1;

const sizes = {};
const fullTopology = topology({ areas }, 1e5);
const fullText = JSON.stringify(fullTopology);
sizes.topojson_full_detail_bytes = Buffer.byteLength(fullText);
sizes.topojson_full_detail_gzip_bytes = gzipSync(fullText).length;
const prepared = presimplify(fullTopology);
lap("topojson_and_simplify_milliseconds");

const { states } = loadStates();
const stateBounds = states.map((state) => ({ state, bounds: geoBounds(state) }));
const inside = ([longitude, latitude], [[west, south], [east, north]]) =>
  latitude >= south && latitude <= north && (west <= east ? longitude >= west && longitude <= east : longitude >= west || longitude <= east);
const projection = makeProjection(states);
const path = geoPath(projection);
// Simplification level is a placeholder; tuning it is part of building the layer, not this test.
const simplified = simplify(prepared, quantile(prepared, 0.5));
const simplifiedAreas = feature(simplified, simplified.objects.areas).features;
const svgPaths = simplifiedAreas.map((area) => path(area) ?? "").join("");
lap("project_to_svg_milliseconds");
const roundedPaths = svgPaths.replace(/(\d+\.\d{2})\d+/g, "$1");
sizes.svg_path_data_bytes = Buffer.byteLength(roundedPaths);
sizes.svg_path_data_gzip_bytes = gzipSync(roundedPaths).length;
const unplaced = simplifiedAreas.filter((area) => !path(area)).map((area) => area.properties.NAMELSAD);

// Which states does each area touch? Test every vertex of the full-detail area against the
// us-atlas state shapes. us-atlas is simplified, so a vertex on a state line can fall either
// side: this is an approximation for the feasibility test, not a source of record.
const statesOfArea = [];
for (const area of areas.features) {
  const found = new Set();
  const rings = area.geometry.type === "Polygon" ? [area.geometry.coordinates] : area.geometry.coordinates;
  const points = rings.flat(2);
  const step = Math.max(1, Math.floor(points.length / 400));
  for (let index = 0; index < points.length; index += step) {
    const match = stateBounds.find((candidate) => inside(points[index], candidate.bounds) && geoContains(candidate.state, points[index]));
    if (match) found.add(match.state.properties.postal_code);
  }
  statesOfArea.push({ census_geographic_identifier: area.properties.GEOID, name: area.properties.NAMELSAD, kind: area.properties.LSAD, states: [...found].sort() });
}
lap("state_overlap_milliseconds");

const multiState = statesOfArea.filter((area) => area.states.length > 1);
const noState = statesOfArea.filter((area) => area.states.length === 0);
const presenceStates = new Set(statesOfArea.flatMap((area) => area.states));
// Cross-check against the Census 2020 AIANNH-to-county relationship file, when given.
// The first two digits of a county code are the state code. Water-only parts are ignored.
let relationshipComparison = null;
if (relationshipPath) {
  const { postalCodeByCensusCode } = await import("../geography.mjs");
  const lines = readFileSync(relationshipPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split("|");
  const column = (name) => header.indexOf(name);
  const statesByArea = new Map();
  for (const line of lines) {
    const cells = line.split("|");
    const area = cells[column("GEOID_AIANNH_20")];
    if (!area || Number(cells[column("AREALAND_PART")]) === 0) continue;
    if (!statesByArea.has(area)) statesByArea.set(area, new Set());
    statesByArea.get(area).add(postalCodeByCensusCode[cells[column("GEOID_COUNTY_20")].slice(0, 2)]);
  }
  let agree = 0;
  const disagree = [];
  let missingFromRelationshipFile = 0;
  for (const area of statesOfArea) {
    const official = statesByArea.get(area.census_geographic_identifier);
    if (!official) { missingFromRelationshipFile += 1; continue; }
    const officialList = [...official].sort().join(",");
    if (officialList === area.states.join(",")) agree += 1;
    else disagree.push(`${area.name}: relationship file ${officialList}; geometry test ${area.states.join(",")}`);
  }
  relationshipComparison = {
    relationship_file_areas: statesByArea.size,
    relationship_file_areas_in_more_than_one_state: [...statesByArea.values()].filter((set) => set.size > 1).length,
    relationship_file_states: new Set([...statesByArea.values()].flatMap((set) => [...set])).size,
    agree,
    disagree: disagree.length,
    disagree_examples: disagree.slice(0, 8),
    areas_2025_not_in_2020_relationship_file: missingFromRelationshipFile,
  };
}
writeFileSync(`${outputFolder}/tribal-area-states.json`, JSON.stringify(statesOfArea, null, 1));
console.log(JSON.stringify({
  features: areas.features.length,
  field_names: fieldNames,
  kinds_by_legal_statistical_area_description_code: kinds,
  sizes,
  timings,
  unplaced_by_projection: unplaced.length,
  areas_in_more_than_one_state: multiState.length,
  areas_with_no_state_found: noState.length,
  examples_of_multi_state_areas: multiState.slice(0, 6).map((area) => `${area.name}: ${area.states.join(", ")}`),
  states_with_any_area: [...presenceStates].sort().join(" "),
  relationship_comparison: relationshipComparison,
}, null, 2));
