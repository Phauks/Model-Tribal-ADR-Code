// Shared geography for every candidate: state table, projection and feature loading.
// Census state codes come from the us-atlas feature ids (Census Bureau state codes).
import { readFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";
import { geoAlbersUsaTerritories } from "./composite-projections-loader.mjs";

export const mapWidth = 975;
export const mapHeight = 610;

// Census state code -> postal code. All 50 states, DC and the five inhabited territories.
export const postalCodeByCensusCode = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};

const atlasPath = new URL("./node_modules/us-atlas/states-10m.json", import.meta.url);

export function loadStates() {
  const topology = JSON.parse(readFileSync(atlasPath, "utf8"));
  const states = feature(topology, topology.objects.states).features.map((state) => ({
    ...state,
    properties: { ...state.properties, postal_code: postalCodeByCensusCode[state.id] },
  }));
  const interiorBorders = mesh(topology, topology.objects.states, (a, b) => a !== b);
  return { topology, states, interiorBorders };
}

// Fit every state and territory, insets included, inside the viewport with a margin.
export function makeProjection(states, margin = 12) {
  return geoAlbersUsaTerritories().fitExtent(
    [[margin, margin], [mapWidth - margin, mapHeight - margin]],
    { type: "FeatureCollection", features: states },
  );
}

// Places too small to see or hit with a pointer get a labeled marker beside them.
export const smallPlaceMarkers = ["DC", "RI", "DE", "PR", "VI", "GU", "MP", "AS"];

// Build-time join: postal code -> list of nations present (from tribe-profile-shaped records).
export function presenceByState(nations) {
  const byState = new Map();
  for (const nation of nations) {
    for (const presence of nation.states) {
      if (!byState.has(presence.state)) byState.set(presence.state, []);
      byState.get(presence.state).push({ id: nation.id, name: nation.names.official, kind: nation.kind, presence: presence.presence });
    }
  }
  for (const list of byState.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return byState;
}
