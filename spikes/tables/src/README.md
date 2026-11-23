# Table spike source

Findings are in [`../REPORT.md`](../REPORT.md). Every nation in the sample data is fictional ("Sample Nation 2", "Sample Nation Ä" and so on).

## Rebuild

Needs Node 22, Typst 0.15.1, Python 3 with `pypdf` and `pypdfium2`, Java for EPUBCheck 5.3.0, and the `zip` command. The browser checks use the Playwright and Chromium already installed in the build container. Outputs go to `../out/`, which git ignores. Run every command from this folder.

```sh
npm ci
npm run data             # 1,000 fictional records, then the table definition
npm run build:print      # Typst PDFs at 6 x 9 in and 8.5 x 11 in (TYPST=path/to/typst if not on PATH)
npm run build:ebook      # one-chapter EPUB
java -jar <path to epubcheck.jar> ../out/epub/nations-directory.epub
npm run build:site       # the website candidates, prerendered
npm run check:site       # browser measurements and accessibility scans
python3 -I tools/render-pdf-pages.py ../out/print/nations-directory-6x9.pdf ../evidence/print-6x9 1 2
```

## Files

| File | Purpose |
| --- | --- |
| `tables/table-definition.mjs` | The one table shape, its checks, and the shared sort and search rules |
| `tables/build-nations-directory.mjs` | Turns nation records into the directory table definition |
| `data/generate-mock-nations.mjs` | Writes the fictional sample records |
| `print/data-table.typ`, `print/nations-directory.typ` | Typst renderer that reads the same JSON; test page with the trim size as an input |
| `print/build-print.mjs` | Builds and times the PDFs, then inspects them |
| `epub/render-table.mjs`, `epub/build-epub.mjs` | XHTML renderer and a one-chapter test EPUB |
| `site/` | SvelteKit app: one route per candidate (`site/routes/`), shared table pieces (`site/lib/tables/`), design-token CSS (`site/lib/styles/`) |
| `site/enhancers/` | Scripts for pages that send no Svelte code: the small no-library script, simple-datatables and DataTables set-up |
| `tools/check-site.cjs` | Playwright and axe-core measurements of every candidate |
| `tools/bundle-enhancers.mjs` | Bundles the enhancer scripts with esbuild |
| `tools/inspect-pdf-table.py`, `tools/render-pdf-pages.py` | PDF structure tags, color spaces, page images |
| `fonts/` | Atkinson Hyperlegible Next, SIL Open Font License (`fonts/OFL.txt`) |
