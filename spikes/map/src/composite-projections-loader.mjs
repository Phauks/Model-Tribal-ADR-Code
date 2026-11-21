// d3-composite-projections 2.0.0 is "type": "module" but its "main" is a UMD bundle and its
// ESM entry (index.js) uses extensionless imports, so plain Node ESM cannot import it.
// Bundlers (Vite, Rollup) resolve the "module" field and work. For Node build scripts we
// load the UMD bundle with a global d3 object, which is the bundle's browser code path.
import * as geo from "d3-geo";
import * as path from "d3-path";
globalThis.d3 = { ...geo, ...path };
await import("d3-composite-projections/d3-composite-projections.js");
export const geoAlbersUsaTerritories = globalThis.d3.geoAlbersUsaTerritories;
delete globalThis.d3;
