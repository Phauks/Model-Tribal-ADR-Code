# Map spike source

Findings are in [`../REPORT.md`](../REPORT.md). Every nation named in
`data/mock-nations.json` is fictional.

## Rebuild

Needs Node 22, Typst 0.15.1 and Python 3 with `pypdf`. The browser checks use
the Playwright and Chromium already installed in the build container. Outputs
go to `../out/`, which git ignores.

```sh
npm ci
node build-d3.mjs        # web SVG, print SVG and the sample page in ../out/site/
node build-plot.mjs      # Observable Plot version in ../out/plot/
typst compile --root .. --ignore-system-fonts --font-path site print/map-page.typ ../out/print/map-page.pdf
python3 -I tools/measure_pdf_color.py ../out/print/map-page.pdf
python3 -I tools/contrast.py

# Browser checks: serve ../out/site on localhost, then
node tools/check-site.cjs http://localhost:8765 <path to axe.min.js> ../evidence
```

## Future layer test (nothing committed from it)

```sh
# Download cb_2025_us_aiannh_500k.zip and tab20_aiannh20_county20_natl.txt from
# www2.census.gov into a folder outside the repository, then:
node future/measure-tribal-areas.mjs <folder>/cb_2025_us_aiannh_500k.shp <folder> <folder>/tab20_aiannh20_county20_natl.txt
```

## Files

| File | Purpose |
| --- | --- |
| `geography.mjs` | State table, projection and the join from tribe records to states |
| `composite-projections-loader.mjs` | Loads d3-composite-projections in plain Node |
| `build-d3.mjs`, `build-plot.mjs` | The two built candidates |
| `site/` | Page template, design-token CSS, script, service worker, manifest, font (SIL Open Font License, `site/OFL.txt`) |
| `print/` | Typst test pages |
| `tools/` | PDF color check, contrast ratios, browser checks, color control fixture |
| `future/measure-tribal-areas.mjs` | Feasibility test for a Census tribal areas layer |
