// Candidate 2: Observable Plot at build time, rendered in Node through jsdom.
// Same data and projection as the d3-geo candidate. Writes out/plot/presence-map.svg.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import * as Plot from "@observablehq/plot";
import { loadStates, makeProjection, presenceByState, mapWidth, mapHeight } from "./geography.mjs";

const started = performance.now();
const output = new URL("../out/plot/", import.meta.url);
mkdirSync(output, { recursive: true });
const { document } = new JSDOM("").window;

const { nations } = JSON.parse(readFileSync(new URL("./data/mock-nations.json", import.meta.url), "utf8"));
const { states, interiorBorders } = loadStates();
const presence = presenceByState(nations);
const countOf = (state) => (presence.get(state.properties.postal_code) ?? []).length;
const tokenFor = (count) => ["var(--map-count-none)", "var(--map-count-one)", "var(--map-count-two)"][count] ?? "var(--map-count-three-or-more)";

function render(fill, stroke) {
  return Plot.plot({
    document,
    width: mapWidth,
    height: mapHeight,
    projection: () => makeProjection(states),
    color: { type: "identity" },
    marks: [
      Plot.geo(states, { fill, stroke, strokeWidth: 0.6, title: (state) => `${state.properties.name}: ${countOf(state)} nations` }),
      Plot.geo(interiorBorders, { stroke, strokeWidth: 0.8 }),
    ],
  }).outerHTML;
}

// Web: does Plot pass CSS custom properties through as fills?
const webSvg = render((state) => tokenFor(countOf(state)), "var(--color-border)");
// Print: plain grays.
const printSvg = render((state) => ["#ffffff", "#c8c8c8", "#8c8c8c"][countOf(state)] ?? "#4a4a4a", "#000000");
writeFileSync(new URL("presence-map.svg", output), webSvg);
writeFileSync(new URL("presence-map-print.svg", output), printSvg);

console.log(JSON.stringify({
  candidate: "Observable Plot build time (jsdom)",
  milliseconds: Math.round(performance.now() - started),
  web_svg_bytes: Buffer.byteLength(webSvg),
  print_svg_bytes: Buffer.byteLength(printSvg),
  custom_properties_kept: (webSvg.match(/var\(--map-count/g) ?? []).length,
  title_elements: (webSvg.match(/<title>/g) ?? []).length,
  has_style_element: webSvg.includes("<style"),
}));
