// Bundles the two scripts used by pages that send no Svelte code
// (csr = false) into ../out/site-static/enhancers/, minified, so their size
// can be compared with the hydrated candidates. In the real site this would
// be a Vite entry instead.

import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, '..', 'site', 'enhancers', 'enhance-table.js'), join(here, '..', 'site', 'enhancers', 'simple-datatables.js'), join(here, '..', 'site', 'enhancers', 'datatables.js')],
  outdir: join(here, '..', '..', 'out', 'site-static', 'enhancers'),
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  logLevel: 'info',
});
// The two libraries' own style sheets, copied beside their scripts.
const require = createRequire(import.meta.url);
copyFileSync(require.resolve('simple-datatables/dist/style.css'), join(here, '..', '..', 'out', 'site-static', 'enhancers', 'simple-datatables.css'));
copyFileSync(require.resolve('datatables.net-dt/css/dataTables.dataTables.min.css'), join(here, '..', '..', 'out', 'site-static', 'enhancers', 'datatables.css'));
