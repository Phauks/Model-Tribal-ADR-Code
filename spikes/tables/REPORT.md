# Table spike: one table definition for the website, the book and the ebook

**Recommendation: keep the "define once" approach, and do not adopt a data grid library.** Each table is one JSON definition. The build renders it three ways: a prerendered HTML `<table>` for the website, a Typst table for print, and an XHTML table for the ebook. On the website, a small Svelte component of our own adds sorting and search, using the same sort and search rules as the other two media. It adds 2.5 KB gzipped to a page. TanStack Table v9 is the named fallback if a table ever needs more than sorting and search.

This confirms the working idea from the design thread, with one change: a headless library is not needed for sorting and search. The pain with tables in past projects comes from describing the same table several times, once per output; the shared definition removes that, whichever code sorts the rows (analysis).

What the spike showed, with a 1,000-row table of fictional nations:

- **One definition, three outputs.** The same JSON produced the web table, a Typst table of 40 pages at 6 x 9 in (17 at 8.5 x 11 in), and an ebook chapter that EPUBCheck 5.3.0 passed with no messages.
- **Works without scripts.** Every candidate that renders a real `<table>` showed all 1,000 rows with scripts turned off. SVAR Svelte DataGrid showed 3.
- **Accessibility.** The tables built from the definition passed the automated scan (axe-core 4.11.0) with no problems, in light and dark. SVAR, simple-datatables and DataTables 3 each had a problem the spike could not configure away (details below).
- **Size.** Our component adds 2.5 KB gzipped to the page; TanStack adds 13.6 KB. Any hydrated Svelte page sends the rows twice (as HTML and as data), which doubled this page's HTML from 32 KB to 64 KB gzipped.
- **Speed.** Re-sorting 1,000 rows took 120 to 230 ms here, and 0.6 to 1.0 s with the CPU slowed 4 times, with or without a library. The cost is the browser laying out about 11,000 elements again, not the library.

Spike date: 2026-11-21. Run by Claude (AI assistant). Claude built the samples and measured them in Chromium. Licenses, sizes and behavior come from the installed packages and the measurements in `evidence/`; quoted guidance comes from the sources listed at the end. Statements marked "analysis" are Claude's reasoning from those measurements and sources.

## What was built

All candidates used the same inputs:

- **Data:** 1,000 fictional records shaped like `schemas/tribe.schema.json`, written by `src/data/generate-mock-nations.mjs` with a fixed seed. Twelve names test sorting: accented capitals (Ä, Å, É, Ø, Ž), an ʻokina, a lowercase name, and numbers that must sort as numbers (2 and 3 before 10).
- **Definition:** `src/tables/table-definition.mjs` describes the shape.
  - Each column has a key, a header, a type (text, number, date or action), and flags for row header, sortable and searchable. It also has a print width and the media that show it.
  - Each cell has the text readers see. It may also have a sort value, a link and hidden text for screen readers. A date shown as "March 4, 2026" sorts as `2026-03-04`.
  - The same file holds the one sort rule (`Intl.Collator`, numbers sorted as numbers, accents and case ignored). It also holds the one search rule: every word typed must appear, accents ignored. So all media agree.
  - `problemsIn()` checks a definition before rendering: a caption, exactly one row-header column, every cell present, and text in Unicode Normalization Form C.
- **Directory table:** `src/tables/build-nations-directory.mjs` turns records into the definition. Columns: Nation (the row header, linked), States, Recognition, Justice institutions, Review status, Last verified, and a "Report a problem" link (website only).

| Output | How | Files |
| --- | --- | --- |
| Website | SvelteKit 3.4 and Svelte 5.59, prerendered: the versions the site on main uses | `src/site/` |
| Print | Typst 0.15.1 reads the JSON directly with `json()`; the trim size is an input | `src/print/` |
| Ebook | XHTML table in a one-chapter EPUB 3 | `src/epub/` |

Website candidates. Each was given the shared sort and search rules where the library allows it:

| Candidate | What it is | License |
| --- | --- | --- |
| No library, Svelte state | A Svelte 5 component sorts and searches with the shared rules; the page hydrates | MIT (project code) |
| No library, small script | The page sends no Svelte code (`csr = false`); a 2.3 KB script sorts and searches the rows already in the page | MIT (project code) |
| TanStack Table v9 (9.3.2) | Headless: the library holds sort and search state; the markup is the same `<table>` | MIT |
| SVAR Svelte DataGrid (2.7.6) | A complete grid component with its own markup and theme | MIT |
| simple-datatables (10.3.0) | Enhances an existing `<table>` | LGPL-3.0 |
| DataTables 3 (3.1.5) | Enhances an existing `<table>`; no longer needs jQuery | MIT |

An eighth page tested a CSS shortcut (`content-visibility: auto` on rows) that might let the browser skip rows that are off screen.

Licenses come from each package's `package.json` (`license` field) and SVAR's `license.txt`. The DataTables README says "DataTables is dependency free".

## Website results

Measured in Chromium with Playwright on this container (`src/tools/check-site.cjs`; output in `evidence/site-output.json`; tables printed by `src/tools/summarize-site-output.mjs`).

- **Ready** is the time from navigation until the table could be sorted.
- **Sort click** is the median of seven clicks on "Nation". Each is timed from the click until the browser drew the frame after the last change.
- **Search** is timed the same way, for typing "Sample Nation 99". Every candidate found the expected 19 rows.
- **4 times slower** repeats the test with the CPU slowed 4 times through the Chrome DevTools Protocol, as a rough stand-in for a modest phone (analysis).
- One machine and one run: treat differences under about 50 ms, or under about 500 ms in the slowed runs, as noise. Earlier runs during the spike moved by that much (analysis).

| Candidate | Rows in the prerendered HTML | Rows readable without scripts | HTML, gzipped | JavaScript, gzipped (whole page) | Ready, normal CPU | Ready, CPU slowed 4 times | Sort click, median (4 times slower) | Search, "Sample Nation 99" (4 times slower) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline page, no table | 0 | n/a | 0.9 KB | 41.6 KB | 55 ms | 137 ms | n/a | n/a |
| No library, Svelte state | 1000 | 1000 | 64.4 KB | 44.1 KB | 782 ms | 3412 ms | 174 ms (793 ms) | 47 ms (181 ms) |
| No library, small script | 1000 | 1000 | 31.8 KB | 1.1 KB | 378 ms | 1932 ms | 124 ms (642 ms) | 25 ms (175 ms) |
| No library, small script, off-screen rows skipped | 1000 | 1000 | 31.9 KB | 1.1 KB | 528 ms | 1786 ms | 129 ms (624 ms) | 40 ms (124 ms) |
| TanStack Table v9 | 1000 | 1000 | 64.4 KB | 55.2 KB | 675 ms | 2989 ms | 195 ms (783 ms) | 58 ms (268 ms) |
| SVAR Svelte DataGrid | 0 | 3 | 34.3 KB | 81.1 KB | 199 ms | 850 ms | 19 ms (74 ms) | 14 ms (79 ms) |
| simple-datatables | 1000 | 1000 | 31.8 KB | 22.7 KB | 1023 ms | 5449 ms | 227 ms (966 ms) | 49 ms (181 ms) |
| DataTables 3 | 1000 | 1000 | 31.8 KB | 42.5 KB | 755 ms | 3639 ms | 168 ms (747 ms) | 18 ms (81 ms) |

| Candidate | Markup | Row headers kept | Caption | Keyboard: Tab to "Nation", then Enter or Space sorts | Page at 320 px | Accessibility scan (light / dark) | Colors follow tokens in dark mode | Requests to other hosts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No library, Svelte state | `<table>`, 7 `th scope="col"` | 1000 of 1000 | Yes | 3 Tab presses; Enter yes, Space yes | No sideways scroll | 0 / 0 | Yes | None |
| No library, small script | `<table>`, 7 `th scope="col"` | 1000 of 1000 | Yes | 3 Tab presses; Enter yes, Space yes | No sideways scroll | 0 / 0 | Yes | None |
| No library, small script, off-screen rows skipped | `<table>`, 7 `th scope="col"` | 1000 of 1000 | Yes | 3 Tab presses; Enter yes, Space yes | No sideways scroll | 0 / 0 | Yes | None |
| TanStack Table v9 | `<table>`, 7 `th scope="col"` | 1000 of 1000 | Yes | 3 Tab presses; Enter yes, Space yes | No sideways scroll | 0 / 0 | Yes | None |
| SVAR Svelte DataGrid | `div role="grid"`, 21 rows in the page | 0 of 1000 | No | 2 Tab presses; Enter yes, Space yes | No sideways scroll | aria-valid-attr-value (1), target-size (1) / same | No (header rgb(32, 38, 43), token rgb(22, 41, 45)) | None |
| simple-datatables | `<table>`, 7 `th scope="col"` | 0 of 1000 | Yes | 3 Tab presses; Enter yes, Space yes | No sideways scroll | scope-attr-valid (1000) / same | Yes | None |
| DataTables 3 | `<table>`, 7 `th scope="col"` | 1000 of 1000 | Yes | 3 Tab presses; Enter yes, Space no | No sideways scroll | 0 / 0 | Yes | None |

Every candidate set `aria-sort` on the sorted column. "Colors follow tokens" compares the header's computed colors with the `surface` and `ink` tokens. The tokens are copied from `site/design-tokens.json` on main (warm paper, teal links). Screenshots of each candidate in both themes and at 320 px are in `evidence/`.

### What the numbers mean

- **Our component costs 2.5 KB; TanStack costs 13.6 KB.** Both are measured against the baseline page, which already carries 41.6 KB of SvelteKit and Svelte. The difference, 11.1 KB, is TanStack. TanStack's announcement gives about 25 KB for the whole package, and it leaves unused features out of the bundle (TanStack Table v9 announcement). The spike registered only sorting and filtering.
- **TanStack server-renders.** The design thread had not found SSR mentioned. It works: the prerendered page held all 1,000 rows, hydrated without errors and passed the scan (measured).
- **Hydrated pages send the rows twice.** The two hydrated pages (Svelte state and TanStack) are 1.18 MB of HTML, 64 KB gzipped. The same table on a page with no Svelte code is 0.75 MB, 32 KB gzipped (measured). SvelteKit renders a page on the server and then "will render the component again in the browser to make it interactive" (SvelteKit docs, page options). To do that it puts the page's data in the HTML (measured).
- **Turning hydration off saves that, at a price.** With `csr = false`, SvelteKit "does not ship any JavaScript to the client" (same page), and a 2.3 KB script did the sorting. But the site on main already has Svelte code on every page, such as the theme button (pull request #16). It would stop working on such a page unless rewritten as a plain script (analysis). So the spike recommends the Svelte component. The small script stays an option for a page that grows too heavy.
- **Sorting speed depends on the rows in the page, not the library.** Every candidate that keeps all 1,000 rows in the page took 120 to 230 ms per sort (0.6 to 1.0 s slowed). SVAR took about 20 ms because only about 20 rows exist in its page at a time (virtual scrolling; measured).
- **The CSS shortcut does not help tables.** `content-visibility: auto` on the rows changed sorting time by less than the noise (measured). This is expected. The CSS Containment specification says size containment "has no effect" when an element's box "is an internal table box". It excludes the same boxes, other than cells, from layout containment (CSS Containment Module Level 2, sections 3.1 and 3.2).
- **The real directory is smaller.** `site/DESIGN.md` counts 575 federally recognized nations, plus the other groups. That is roughly 60 percent of this test (analysis). If sorting still feels slow on phones, the directory can be grouped by state or paged without changing the definition (analysis). The nations page on main already groups its table by kind of entity.

### Findings per library

**SVAR Svelte DataGrid: rejected.**

- **Not prerendered.** It prerendered the header and 3 rows. With scripts off, 3 of 1,000 rows were readable, and "Sample Nation 987" could not be found (measured).
- **Most rows are never in the page.** With scripts on, only about 20 rows exist in the page at a time. That is virtual scrolling, which SVAR lists as a feature in its README. The browser's find-in-page cannot reach the other rows (measured; analysis).
- **Grid, not table.** It renders `div` elements with `role="grid"`, with no row headers and no caption (measured). The WAI-ARIA Authoring Practices call a table "a static tabular structure ... not an interactive widget" and keep the grid pattern for interactive widgets (APG, table pattern). The directory is a table of facts with links (analysis).
- **Scan failures.** A critical one: `aria-rowindex="0"` on the first row, where the value must be 1 or more. Also one link target under 24 px (measured, axe-core).
- **Its own colors.** Its themes use their own variables (`--wx-*`; 14 for tables in the Willow theme source), not the design tokens. In dark mode its header measured `rgb(32, 38, 43)` against the token's `rgb(22, 41, 45)`.
- **Outside requests.** Its themes load fonts and an icon font from `cdn.svar.dev` unless `fonts={false}` is set (`Willow.svelte` source). That conflicts with self-hosted fonts and offline reading (analysis).
- **Search keeps every row.** Its `search-rows` action kept all rows; filtering needed `filter-rows` with a custom function (measured).
- **The largest download:** 81 KB gzipped for the page (measured).

**simple-datatables: rejected.**

- **Row headers lost.** It rewrote the 1,000 row headers as `<td scope="row">`. The table lost its row headers, and the scan flagged 1,000 invalid `scope` attributes (measured).
- **Slowest to become ready:** about 1.0 s, and 5.4 s with the CPU slowed (measured).
- **Search default.** A row matched if any typed word matched, so "Sample Nation 99" matched all 1,000 rows. `searchAnd: true` fixed it (measured).
- **License.** It is LGPL-3.0. Shipping it in a bundle means meeting section 4, "Combined Works": a prominent notice, copies of the GPL and LGPL, and either source that lets readers relink a modified library or "a suitable shared library mechanism" (LGPL-3.0, section 4). Serving it as a separate, unmodified file could meet that, but it is work an MIT library does not need (analysis).

**DataTables 3: workable, not recommended.**

- **What works.** It kept the row headers and caption, passed the scan, and searched fastest of the full-table candidates (measured).
- **Space does not sort.** Its sort control is a `div` with `role="button"`. Enter sorted, Space did not (measured). The button pattern says both keys activate a button (APG, button pattern).
- **It reads our attributes as its own settings.** It treats `data-sortable`, `data-searchable` and `data-type` on headers as its own options. The spike's first markup used those names, and every column became unsortable (measured). The spike's attributes now start with `data-table-`.
- **Dates sorted as text** until each cell's sort value was copied into DataTables' `data-order` attribute (measured).
- **Its own layout.** It wraps the table in its own layout `div` elements and adds a third, unsorted state on the third click (measured).
- **Size.** 42.5 KB gzipped, about 17 times our component (measured).

**TanStack Table v9: works; the fallback.** It kept every accessibility property of the markup, because the markup is ours (measured). Its value is in features this table does not use yet: faceted column filters, pagination, column visibility, grouping and row selection (feature folders in `@tanstack/table-core` 9.3.1, `dist/features/`). Adopt it when a table needs those (analysis).

**Not built:**

| Library | License | Size, gzipped, minimal import | Why not built |
| --- | --- | --- | --- |
| AG Grid Community 36.3.0 | MIT | 322 KB | A `div` grid with `role="grid"` (package source), so the same problems as SVAR, at four times SVAR's size |
| Tabulator 6.7.1 | MIT | 103 KB | Builds its layout from `div` elements with `role="grid"` (69 `createElement("div")` against 2 `createElement("table")` in its source) |
| Grid.js 6.2.0 | MIT | 16.5 KB | Renders a `<table>`, but was last published 2024-03-03 (npm registry), so it may be unmaintained (analysis) |

Sizes come from bundling a minimal import of each with esbuild 0.28 and gzip -9.

### Sorting with accents, ʻokina and numbers

- **All candidates sorted alike.** Each produced the same order for the twelve test names (measured). Each was either given the shared rule or sorts by language itself (simple-datatables and DataTables). Descending: Zebra, Ž, Ø, lowercase, ʻOkina, É, Aardvark, Ä, Å, then the numbers from 1000 down. "Sample Nation 2" and "3" came before "10". The date column sorted by date, not by its text.
- **An ʻokina is not ignored.** "Sample Nation ʻOkina" sorted between "É" and "lowercase", not with the O names (measured with `Intl.Collator('en')`). The project needs a rule for where names that begin with an ʻokina, or other marks, sort. The definition's `sortValue` can carry that rule without changing the displayed name (analysis). This is a style-guide question, best settled with the communities whose names it affects. The style guide already asks that names be written as each nation writes them (analysis).

### Accessibility notes for the real build

- **Pattern followed.** Sortable headers hold a `<button>`, and the sorted column's `<th>` carries `aria-sort`, as in the WAI-ARIA Authoring Practices sortable table example (APG, sortable table). The search box and sort buttons appear only once the script runs, so a reader without scripts never meets a control that does nothing (project choice).
- **Every link is a tab stop.** In a table, "all focusable elements ... are included in the page tab sequence" (APG, grid pattern). With a name link and a "Report a problem" link on each row, passing the test table takes about 2,000 Tab presses (analysis). Trevor has since chosen one report link at the top of each nation page instead of links beside each fact (project memory, 2026-11-21). If the directory follows that, each row keeps one link. A "skip the table" link would still help (analysis).
- **Two layout bugs the spike found.**
  - Hidden link text positioned `absolute` widened the page to 1,179 px on a 320 px screen, so the page scrolled sideways. `position: relative` on the table's scroll box fixed it (measured before and after).
  - At 320 px the caption scrolls sideways with the table, so its end is cut off (`evidence/site-no-library-320px.png`). The real build should put the table's visible title above the scroll box (analysis).
- **Not tested:** screen readers (NVDA, VoiceOver), Firefox and Safari.

## Print results

Built by `src/print/build-print.mjs`; output in `evidence/print-output.json`. Page images: `evidence/print-6x9-page-1.png` and `-page-2.png`.

| Measure | 6 x 9 in | 8.5 x 11 in |
| --- | --- | --- |
| Pages for 1,000 rows (7.5 pt text) | 40 | 17 |
| Compile time: 5 runs each, with and without row-header tags | 0.63 to 0.92 s | 0.60 to 0.83 s |
| Header row repeats on each page | Yes (page 2 image) | Yes |
| Color | Grayscale only: one ICC color space with one component on every page | Same |
| PDF tags | `Table`, `THead`, `TBody`, 1,001 `TR`, 6 `TH` with Scope Column, 6,000 `TD`, `Caption` | Same |

- **Trim size is an input.** The page reads `page-width` and `page-height` from `--input`, because the book's trim size is not decided (project memory). Column widths are fractions, so the table reflows to any page.
- **No code generation.** Typst reads the same JSON file the website uses, with `json()`. Rows are stored already sorted by the shared rule, so print does no sorting of its own.
- **Header tags come from `table.header`.** Typst "uses this function to attach accessibility metadata to tables" (Typst docs, table).
- **Row headers in the PDF need a feature flag.**
  - Typst's `pdf.header-cell(scope: "row")` tags a row header. But "the API of this feature is temporary", and it needs the `a11y-extras` feature flag (Typst docs, `pdf.header-cell`).
  - With the flag, the PDF had 1,000 Row headers. It no longer grouped rows into `THead` and `TBody` (measured).
  - The template calls the function only when it exists, so it builds either way. Whether to turn the flag on is for a later check with a PDF accessibility checker (analysis).

## Ebook results

- **EPUBCheck 5.3.0:** "No errors or warnings detected" (`evidence/epubcheck-output.txt`). Lulu requires EPUBCheck version 5 (project memory, from the EPUB spike).
- **Accessibility scan** of the chapter in Chromium: no problems, after one fix (the first run asked for a `<main>` landmark). DAISY Ace was not run; the EPUB spike already showed how to run it (analysis).
- **Structure:** the XHTML keeps the caption, `th scope="col"`, and 1,000 `th scope="row"` (measured).
- **Size:** the 1,000-row chapter is 159 KB of XHTML, 13 KB zipped. A directory this long may read better split by state or by letter in the ebook (analysis).

## Recommendation in detail

1. **Adopt the table definition.** Turn `table-definition.mjs` into a JSON Schema in `schemas/` and a shared module. Run the `problemsIn()` checks in continuous integration (analysis).
2. **Website:** render every table as a prerendered `<table>` from the definition.
   - Tables that need sorting and search use the Svelte component (`src/site/lib/tables/NoLibraryTable.svelte` and its parts).
   - Small tables, such as comparisons and profile facts, need no script.
   - This replaces the plain tables now on main, whose style sheet says "Simple tables until the table library is chosen" (`site/src/lib/styles/global.css`).
3. **Fallback:** if a table needs faceted filters, pagination or column choice, use TanStack Table v9 with the same definition and markup. `src/site/lib/tables/TanStackTable.svelte` shows how.
4. **Print:** start from `src/print/data-table.typ` in `pdf/`.
5. **Ebook:** call `src/epub/render-table.mjs` from the custom ebook pipeline (decision record 0011).

## Open questions

1. **Sorting names that begin with an ʻokina or other marks:** add a rule to the style guide (see above).
2. **Very long tables in print and the ebook:** keep one 1,000-row table, or split by state or letter?
3. **Report links in the directory:** one per row, or only on each nation's page?

## Limits

- **Mock data only,** on one machine, one run per figure, in Chromium only.
- **Automated accessibility checks only;** no screen-reader test.
- **adapter-static stood in** for the Cloudflare adapter. Both write the same prerendered HTML (analysis).
- **The token subset** in `src/site/lib/styles/tokens.css` is copied from main. Tables read only tokens, so later palette changes need no table changes (analysis).

## Files

- `evidence/site-output.json`: every website measurement
- `evidence/site-*-light.png`, `-dark.png`, `-320px.png`: each candidate in both themes and on a narrow screen (none for the CSS-shortcut page, which looks the same as the small-script page)
- `evidence/print-output.json`, `evidence/print-6x9-page-1.png`, `evidence/print-6x9-page-2.png`
- `evidence/epubcheck-output.txt`
- `src/`: see `src/README.md` to rebuild

## Sources

- WAI-ARIA Authoring Practices, table pattern: https://www.w3.org/WAI/ARIA/apg/patterns/table/
- WAI-ARIA Authoring Practices, sortable table example: https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/
- WAI-ARIA Authoring Practices, grid pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- WAI-ARIA Authoring Practices, button pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- SvelteKit docs, page options (`ssr`, `csr`, hydration): https://svelte.dev/docs/kit/page-options
- TanStack Table v9 announcement: https://tanstack.com/blog/announcing-tanstack-table-v9
- SVAR Svelte DataGrid: https://svar.dev/svelte/datagrid/ and the package README
- DataTables package README: https://www.npmjs.com/package/datatables.net
- GNU Lesser General Public License, version 3: https://www.gnu.org/licenses/lgpl-3.0.txt
- CSS Containment Module Level 2: https://www.w3.org/TR/css-contain-2/
- Typst docs, `table`: https://typst.app/docs/reference/model/table/ ; `pdf.header-cell`: https://typst.app/docs/reference/pdf/header-cell/
- EPUBCheck 5.3.0: https://github.com/w3c/epubcheck/releases/tag/v5.3.0
- axe-core 4.11.0: https://github.com/dequelabs/axe-core
- npm registry metadata for each package (versions, licenses, publish dates): https://www.npmjs.com/
- Project files: `site/DESIGN.md`, `site/design-tokens.json`, `site/src/lib/styles/global.css`, `spikes/map/REPORT.md`, decision record 0011, and the EPUB spike report in the project's shared files (`spikes/epub/REPORT.md`)
