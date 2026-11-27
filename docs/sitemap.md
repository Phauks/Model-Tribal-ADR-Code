# Sitemap

How the site tells search engines which pages it has, and how the site is opened to them at the first release. Trevor Goldsmith chose on Nov. 26, 2026 to build the sitemap now and keep the site closed, and asked that it keep itself up to date as the site grows.

Everything here is project design unless a source is cited.

## In short

- **The sitemap is at `/sitemap.xml`.** It is an index[^protocol] naming one file per part of the site: `/sitemaps/nations.xml`, `laws`, `people`, `cases`, `source-documents`, `pages`, and `essays` once an essay is published. A part longer than 50,000 pages, the protocol's limit for one file,[^protocol] is split into `cases`, `cases-2` and so on, with no change to the code.
- **It comes from the same lists as search.** The build reads every item of every collection in the registry (`site/src/lib/server/collections.ts`) and every page search finds (`site/src/lib/server/search-index.ts`). A new record, or a new collection with its registry entry, is in the sitemap from the next deploy. Merging data and publishing site text both deploy.
- **It is written when a crawler asks.** The build lists the pages into files only the Worker reads (`/sitemaps/built/`, never served to readers). The Worker then leaves out what nations chose to hide, adds the published essays from the database, and moves a nation's date when its own team publishes a change, so all three are current without waiting for a deploy.
- **Each page carries the day it last changed** (`lastmod`), where that is known: the newest merged change to the files the page is made from, or for a source document the day its copy was taken. A page made from no one file, such as the Map, has no date rather than a wrong one.
- **The site stays closed until the first release.** robots.txt still says `Disallow: /` and every page still says `noindex`. Opening is one line (below).

## What is left out

| Left out | How |
| --- | --- |
| Tribal court opinions held for a privacy review, and those waiting to be redacted | Not in the collection's list: an opinion is listed only while its copy is served (`tribal-court-opinions.ts`, `research/capture-index-overrides.json`). |
| The Interior Board's probate decisions and decisions about minors | Never written into `content/` (`research/ibia/held-back.csv` gives citations only). |
| State court opinions about children and estates | Held privately, never written into `content/` (`research/state-court-opinions/summary.json` gives only how many). |
| Restricted nation records, and those waiting for the nation's approval | Not in `nations()` or `documentHistories()`, and their copies are withheld (`content.ts`, `isWithheld`). |
| What a nation chose to hide or cite only (decision record 0056) | Filtered when the sitemap is asked for (`filterSitemapEntries` in `site/src/lib/restricted-files.ts`), the same rules as `/search/index.json`. A case's or law's page that shows a hidden copy is left out too. |
| Private and signed-in pages | `site/src/lib/private-pages.ts`, the same lists `hooks.server.ts` uses to keep them out of caches. |
| Tools with nothing to read, and views of a page | `notInSitemap` in `site/src/lib/server/sitemap-build.ts` (search, Starred, Read offline, Verify a file), and any address with a query, such as a land cession's view of the Map. |
| Files and other sites | Only the site's own pages are listed. A source document's page (`/copies/view/…`) is listed, not the file. |

`site/tests/sitemap.test.ts` checks each row against the real records: no held opinion, no Board decision on the held list, no state court opinion held back, no unpublished nation, no private page, and nothing a nation hid or asked to cite only.

## Stubs

Stubs (`site/src/lib/stubs.ts`) are listed. On Nov. 26, 2026 most case, law and person pages were still stubs, and each has the citation and where to read the text, which is what people search for: leaving them out would have left 84 of about 7,500 cases. The privacy holds above apply to them as to every page. To leave stubs out until they have a write-up, set `sitemapLeavesOutStubs` to `true` in `site/src/lib/sitemap.ts`; the build then takes them out (`site/src/lib/server/stub-list.ts`).

## Opening the site at the first release

Set `openToSearchEngines` to `true` in `site/src/lib/search-engines.ts`. That one change:

- drops the `noindex` tag from every page (`site/src/routes/+layout.svelte`); private pages keep their own;
- writes robots.txt to let crawlers in, keep them out of every private and signed-in page, and name the sitemap with a `Sitemap:` line.[^robots] While the site is closed the line is there but commented out.

Then submit `https://triballawproject.org/sitemap.xml` in Google Search Console and Bing Webmaster Tools. The checklist is section 2 of [domain-to-do.md](domain-to-do.md).

## Where the parts of it live

- `site/src/lib/sitemap.ts`: the shared rules: parts, the XML, dates.
- `site/src/lib/server/sitemap-build.ts`: what the build lists, and each page's date (one read of `git log` over `content/`). A shallow clone's cut-off commit gives no date, since its date is not when the file changed.
- `site/src/routes/sitemaps/built/[part].json`: the lists as built.
- `site/src/lib/server/sitemap-live.ts`, `site/src/routes/sitemap.xml`, `site/src/routes/sitemaps/[part].xml`: what a crawler gets.
- `site/tools/nation-page-changes-worker.js`: answers "not found" for the lists as built, so only the Worker reads them.
- `site/tools/edge-cache-worker.js`: Cloudflare's edge keeps the index and each part for up to an hour under the `nation-restrictions` tag, so a nation's new choice purges them at once ([edge-caching.md](edge-caching.md)). A newly published essay or a nation's own page change can take that hour to appear, since neither purges.

[^protocol]: Sitemaps.org, *Sitemaps XML format* (2016), https://www.sitemaps.org/protocol.html ("Each Sitemap file that you provide must have no more than 50,000 URLs and must be no larger than 50MB"; sitemap index files).
[^robots]: M. Koster et al., *Robots Exclusion Protocol*, RFC 9309 (2022), https://www.rfc-editor.org/rfc/rfc9309; the `Sitemap:` line is from Sitemaps.org, *Sitemaps XML format*, "Informing search engine crawlers".
