# 0058. Draw the large families of item pages when a reader opens them

- **Status:** Accepted
- **Date:** 2026-11-24
- **Extends:** decision record [0004](0004-content-as-plain-files.md) (content as plain files in git)

## Context

Every page of the site was built ahead of time from the records in `content/`. By Nov. 24, 2026 that meant 22,247 files (1.3 GB), and the production build on Cloudflare took 15.4 minutes: 8.1 of them building pages and about 2.5 uploading the 10,533 files that had changed. Almost every page file changes on every build, because SvelteKit writes the build's version into each page, so each deploy uploaded nearly all of them again. More families of pages were on the way (more Supreme Court cases, treaties, biographies), and Cloudflare stops a build at about 31 minutes. Trevor Goldsmith asked on Nov. 24, 2026 whether it made sense to build every page before anyone reads it.

The page loaders read `content/` from disk, which only the build can do. The Worker has no copy of the repository, and putting every record into the Worker would make it larger and slower to start.

## Decision

- **Which pages.** Cases (`/cases/<id>`), laws (`/laws/<key>`), biographies (`/biographies/<person>`), and the Supreme Court's Justices, Presidents and Courts (`/supreme-court/justices/<key>`, `/supreme-court/presidents/<key>`, `/supreme-court/<court>`). Together they were 8,540 of the built files.
- **Data at build time, page on request.** The build still works out each page's data, with the same code as before, and writes it once as a static file, `/page-data/<family>/<key>.json` (`src/routes/page-data`). *Changed Nov. 27, 2026:* the pages are now packed into a fixed number of files for each family by a hash of each key, `/page-data/<family>/<number>.json`, each a JSON object from key to page data (`src/lib/page-data.ts`). One file for each page had come to some 46,000 files, more than half of the site's, and Cloudflare takes at most 100,000 in a version. A file now changes when any page in it changes, and the Worker keeps whole files in memory rather than single pages. That file holds no build version, so it changes only when the records behind it change, and Cloudflare uploads it only then. When a reader opens the page, the Worker reads the file through the static files (`ASSETS`) binding, keeps it in memory for the next reader of that page, and draws the page with the same component (`src/lib/server/page-data.ts`). A key with no file answers 404.
- **What a reader sees does not change.** The HTML is the same as the prebuilt page's, except that the script policy comes as a header rather than a `<meta>` tag, as on every page the Worker draws.
- **Everything else stays prebuilt**, including nation pages, the opinions tables, copies, search, downloads and the files the checksums cover. Restrictions and privacy holds work as before: privacy holds are applied when the data is built, and none of these families was among the pages redrawn for a nation's restrictions (decision record 0056).
- **Offline.** These pages are saved for offline reading as a reader opens them, like any page. They are no longer part of the "Everything else" collection a reader can save at once from Settings, which had grown to hundreds of megabytes because of them, and a saved copy is dropped at the next update and saved again when the page is next opened online. The data files are never saved offline.

## Consequences

- On the same machine, the build fell from 203 to 150 seconds and the prerender step from 143 to 82 seconds. The build output fell from 22,247 files (1.3 GB) to 17,977 (872 MB), and the six families' data is 27 MB in 4,270 files instead of 398 MB in 8,540.
- Each page view of these families runs the Worker: about 20 ms locally to read the data and draw the page. Cloudflare's edge cache does not keep Worker responses on `workers.dev`, so caching at the edge waits for the custom domain, as for the map tiles.
- The accessibility check of prebuilt pages no longer sees these families. The check of the Worker's pages (`tools/check-accessibility-live.mjs`) now opens one page of each.
- Another family can move the same way by adding it to `src/lib/page-data.ts` and the data route, and pointing its page's load at `builtPageData`.
- Because these pages are now drawn by the Worker, filtering them for a nation's restrictions could be done on request later, without redrawing them from built HTML.

## Sources

- Build times: Cloudflare Workers Builds history for the site's Worker, build of commit e3c66f8c (Nov. 24, 2026), and local builds of e3c66f8c and of this change on the same machine.
- Cloudflare, "Limits" (Workers static assets: 100,000 files per version on the paid plan): https://developers.cloudflare.com/workers/platform/limits/#static-assets
- Cloudflare, "Workers Builds limits and pricing" (20-minute build timeout, 4 vCPU): https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
