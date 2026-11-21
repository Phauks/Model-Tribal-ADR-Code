// Candidate 1: d3-geo at build time. Writes two static SVG files and the sample web page.
//   out/d3/presence-map.svg        web version: CSS classes and design tokens, links, titles
//   out/d3/presence-map-print.svg  print version: grayscale fills as attributes, no CSS
//   out/site/index.html            inline web SVG + table alternative + small script
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { geoPath } from "d3-geo";
import { loadStates, makeProjection, presenceByState, smallPlaceMarkers, mapWidth, mapHeight } from "./geography.mjs";

const started = performance.now();
const output = new URL("../out/", import.meta.url);
mkdirSync(new URL("d3/", output), { recursive: true });
mkdirSync(new URL("site/", output), { recursive: true });

const { nations } = JSON.parse(readFileSync(new URL("./data/mock-nations.json", import.meta.url), "utf8"));
const { states, interiorBorders } = loadStates();
const projection = makeProjection(states);
const path = geoPath(projection);
const presence = presenceByState(nations);

// Count classes. Thresholds are a spike choice; the real map would set them from the data.
function countClass(count) {
  if (count === 0) return "none";
  if (count === 1) return "one";
  if (count === 2) return "two";
  return "three-or-more";
}
const legendEntries = [
  { key: "none", label: "No nations listed" },
  { key: "one", label: "1 nation" },
  { key: "two", label: "2 nations" },
  { key: "three-or-more", label: "3 or more nations" },
];
// Print grays: luminance steps chosen to stay distinct after Standard black-and-white printing.
const printFill = { none: "#ffffff", one: "#c8c8c8", two: "#8c8c8c", "three-or-more": "#4a4a4a" };

const escapeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const round = (pathData) => pathData.replace(/(\d+\.\d{2})\d+/g, "$1");

function describe(state) {
  const list = presence.get(state.properties.postal_code) ?? [];
  const name = state.properties.name;
  if (list.length === 0) return `${name}: no nations listed`;
  return `${name}: ${list.length} ${list.length === 1 ? "nation" : "nations"} (${list.map((entry) => entry.name).join(", ")})`;
}

// Marker offsets in pixels from the state's centroid, for places too small to point at.
const markerOffset = { PR: [-30, -26], DC: [40, 22], RI: [28, 10], DE: [36, 6], VI: [-34, -16], GU: [0, 18], MP: [16, 0], AS: [0, 18] };

function renderStates(mode) {
  return states
    .map((state) => {
      const code = state.properties.postal_code;
      const list = presence.get(code) ?? [];
      const key = countClass(list.length);
      const pathData = round(path(state));
      const title = `<title>${escapeText(describe(state))}</title>`;
      if (mode === "print") return `<path d="${pathData}" fill="${printFill[key]}"/>`;
      const shape = `<path class="state count-${key}" d="${pathData}" data-state="${code}" data-count="${list.length}">${title}</path>`;
      // Only states with nations become links: few tab stops, and the link works with no script.
      // Places with a marker get their link on the marker only, so each place is one tab stop.
      const linked = list.length > 0 && !smallPlaceMarkers.includes(code);
      return linked ? `<a href="#state-${code}" aria-label="${escapeText(describe(state))}">${shape}</a>` : shape;
    })
    .join("\n");
}

function renderMarkers(mode) {
  return smallPlaceMarkers
    .map((code) => {
      const state = states.find((candidate) => candidate.properties.postal_code === code);
      const [centerX, centerY] = path.centroid(state);
      const [offsetX, offsetY] = markerOffset[code];
      const markerX = centerX + offsetX;
      const markerY = centerY + offsetY;
      const list = presence.get(code) ?? [];
      const key = countClass(list.length);
      const line = `<line x1="${centerX.toFixed(1)}" y1="${centerY.toFixed(1)}" x2="${markerX.toFixed(1)}" y2="${markerY.toFixed(1)}"`;
      if (mode === "print") {
        return `${line} stroke="#000" stroke-width="0.6"/><circle cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="9" fill="${printFill[key]}" stroke="#000" stroke-width="1"/><text x="${(markerX + 13).toFixed(1)}" y="${(markerY + 7).toFixed(1)}" font-family="Atkinson Hyperlegible Next" font-size="20" fill="#000">${code}</text>`;
      }
      const marker = `${line} class="marker-line"/><circle class="state marker count-${key}" cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="9" data-state="${code}" data-count="${list.length}"><title>${escapeText(describe(state))}</title></circle><text class="marker-label" x="${(markerX + 12).toFixed(1)}" y="${(markerY + 4).toFixed(1)}">${code}</text>`;
      return list.length > 0 ? `<a href="#state-${code}" aria-label="${escapeText(describe(state))}">${marker}</a>` : `<g>${marker}</g>`;
    })
    .join("\n");
}

function renderLegend(mode) {
  // Print needs larger type: the 975-unit map is about 4.6 in wide on a 6 x 9 in page.
  const step = mode === "print" ? 28 : 22;
  const left = mode === "print" ? 700 : 760;
  const top = mapHeight - step * legendEntries.length - 10;
  const rows = legendEntries.map((entry, index) => {
    const y = top + index * step;
    const swatch = mode === "print"
      ? `<rect x="${left}" y="${y}" width="22" height="22" fill="${printFill[entry.key]}" stroke="#000" stroke-width="1"/>`
      : `<rect class="count-${entry.key} legend-swatch" x="${left}" y="${y}" width="16" height="16"/>`;
    const text = mode === "print"
      ? `<text x="${left + 30}" y="${y + 17}" font-family="Atkinson Hyperlegible Next" font-size="20" fill="#000">${entry.label}</text>`
      : `<text class="legend-label" x="${left + 24}" y="${y + 12}">${entry.label}</text>`;
    return swatch + text;
  });
  return `<g aria-hidden="true">${rows.join("")}</g>`;
}

const borders = round(path(interiorBorders));
const titleText = "Native nations by state: number of nations with a presence in each state, DC and territory (mock data)";

const webSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="presence-map" viewBox="0 0 ${mapWidth} ${mapHeight}" role="group" aria-labelledby="presence-map-title">
<title id="presence-map-title">${titleText}</title>
<g class="states">${renderStates("web")}</g>
<path class="borders" d="${borders}"/>
<g class="markers">${renderMarkers("web")}</g>
${renderLegend("web")}
</svg>`;

const printSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapWidth} ${mapHeight}" width="${mapWidth}" height="${mapHeight}">
<g stroke="#000" stroke-width="0.5" stroke-linejoin="round">${renderStates("print")}</g>
<path d="${borders}" fill="none" stroke="#000" stroke-width="0.7"/>
<g>${renderMarkers("print")}</g>
${renderLegend("print")}
</svg>`;

writeFileSync(new URL("d3/presence-map.svg", output), webSvg);
writeFileSync(new URL("d3/presence-map-print.svg", output), printSvg);

// Table alternative: every state, DC and territory with at least one nation, plus a full list.
const tableRows = states
  .filter((state) => presence.has(state.properties.postal_code))
  .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
  .map((state) => {
    const code = state.properties.postal_code;
    const list = presence.get(code);
    return `<tr id="state-${code}"><th scope="row">${escapeText(state.properties.name)}</th><td>${list.length}</td><td><ul>${list.map((entry) => `<li>${escapeText(entry.name)} <span class="presence-kind">(${entry.presence.replace(/-/g, " ")})</span></li>`).join("")}</ul></td></tr>`;
  })
  .join("\n");

const template = readFileSync(new URL("./site/template.html", import.meta.url), "utf8");
const page = template.replace("<!-- map -->", webSvg).replace("<!-- table rows -->", tableRows);
writeFileSync(new URL("site/index.html", output), page);
for (const file of ["map.css", "map.js", "service-worker.js", "manifest.webmanifest", "AtkinsonHyperlegibleNext-Regular.ttf"]) {
  copyFileSync(new URL(`./site/${file}`, import.meta.url), new URL(`site/${file}`, output));
}

const elapsed = performance.now() - started;
console.log(JSON.stringify({
  candidate: "d3-geo build time",
  milliseconds: Math.round(elapsed),
  web_svg_bytes: Buffer.byteLength(webSvg),
  print_svg_bytes: Buffer.byteLength(printSvg),
  page_bytes: Buffer.byteLength(page),
}));
