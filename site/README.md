# Website

The website is built with SvelteKit (Svelte 5, TypeScript) and served by a Cloudflare Worker. Every public page is built ahead of time from the plain-text files in `content/`, so the Worker mostly serves files. The request form, sign-in and the co-author workspace are answered by the Worker on request; [COLLABORATION.md](COLLABORATION.md) explains them and how to set up sign-in. The design is in [DESIGN.md](DESIGN.md), the colors and sizes are in [design-tokens.json](design-tokens.json), the version is in [version.txt](version.txt), and the history is in [CHANGELOG.md](CHANGELOG.md).

## Run it on your computer

Needs Node.js 26 or later and npm 12 (the version in `.node-version` and the `packageManager` field of `package.json`; `npm install --global npm@12` updates an older npm). From this folder:

```sh
npm ci            # install the exact versions in package-lock.json
npm run dev       # development server with live reload
npm run build     # build the site into .svelte-kit/cloudflare
npm run preview   # build, then serve the built Worker locally with Wrangler
```

### First run

The workspace, account, events, uploads and request pages are answered by the Worker and read the database. To try them on your computer, fill the local copy of the database with made-up people and records, then serve the built Worker:

```sh
npm run database:seed:local   # apply the migrations to the local database and add the fixtures
npm run preview               # build, then serve it at http://localhost:8787
```

The seed writes only to the local copy in `.wrangler/state`, never the live database, and running it again is safe. It adds one account for each role at example.org, such as `lead-author@example.org`, `co-author@example.org` and `nation-reviewer@example.org`, and `reader@example.org`, who signed up but has no workspace access; with them come a draft essay, a nation team, two sent files, an upcoming event, a request and a test book order. Every fixture account's password is `local fixture password`. The roles that need two-step sign-in have it set up already: `npm run database:seed:local -- --code` prints the code to type, and the seed also prints a link an authenticator app can read. If `site/.dev.vars` does not exist, the seed writes it with `LEAD_AUTHOR_EMAIL=lead-author@example.org`. For a one-time link instead of the password, run `npm run sign-in-link -- reader@example.org --local`.

### Checks

Checks that also run on every pull request (the "Website" and "Accessibility" jobs in `.github/workflows/checks.yml`):

```sh
npm run check             # TypeScript and Svelte
npm test                  # unit tests (Vitest), including the database code
npm run check:colors      # no color is written anywhere but design-tokens.json
npm run build
npm run check:built-site  # every page has a language, a title, one h1 and a skip link
npm run check:built-worker   # the built Worker starts, and its scheduled and email handlers answer
npm run check:accessibility  # axe-core on every built page, light and dark themes
npm run check:accessibility:live  # axe-core on the Worker's pages and on open menus and dialogs
```

The accessibility checks open each page in Chromium through Playwright. Install the browser once with `npx playwright install chromium`, or set `CHROMIUM_PATH` to a Chromium that is already installed. `check:accessibility` covers the prerendered pages as first loaded; pass `--pages /,/nations/map` to check only some. `check:accessibility:live` serves the built Worker with Wrangler on the local database, which it fills with the fixtures of First run, and covers what the other cannot reach: the sign-in, request, account, profile, events, uploads and workspace pages, signed out and as the fixture accounts, and the header's menus and dialogs, the sidebar and dropdowns while open. Pass `--only /workspace,/sign-in` to check only some pages. Problems it may not fail on for now are listed, with the reason, at the top of `tools/check-accessibility-live.mjs`.

## How it is deployed

Cloudflare Workers Builds deploys the site from GitHub ([decision record 0006](../docs/decisions/0006-secrets-only-in-cloudflare.md)). No secret is stored in GitHub. The Worker's build settings in the Cloudflare dashboard are:

| Setting | Value |
| --- | --- |
| Worker name | `tribal-law-project-site` (must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | `site` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

Each merge to `main` deploys to `https://triballawproject.org`, a Custom Domain of the Worker; the workers.dev address is off ([what waited on the domain](../docs/domain-to-do.md)). `wrangler.jsonc` has no `main` or `assets` setting because `@sveltejs/adapter-cloudflare` sets both when it builds. The last three steps of `npm run build` (`tools/add-scheduled-run.mjs`, `tools/add-nation-page-changes.mjs` and `tools/add-mail-handlers.mjs`) wrap the Worker the adapter makes, so the adapter is pinned to one version in `package.json`; after changing it, run `npm run build` and `npm run check:built-worker`.

## Cloudflare resources

Code refers to Cloudflare resources only by their binding names. The names of the resources themselves appear in `wrangler.jsonc` and nowhere else, so a resource can be renamed or replaced by editing that file.

| Binding | Resource | Use |
| --- | --- | --- |
| `database` | D1 database | People and roles, reviews, requests from nations. Tables come from `migrations/` ([COLLABORATION.md](COLLABORATION.md#database)). |
| `sourceDocuments` | Private R2 bucket | Copies of source documents, and files sent with requests (under `requests/`). Not served publicly. |
| `requestFormLimit` | Rate limit | At most five request-form submissions a minute from one connection. |

| `signInLimit`, `signInNetworkLimit` | Rate limits | Sign-in tries: five a minute per email address and step, thirty per network address. |
| `signInEmail` | Email Service | Sends sign-in codes from the `SIGN_IN_EMAIL_FROM` address in `vars` ([COLLABORATION.md](COLLABORATION.md#setting-up-sign-in)). |

No secrets are needed. One setting, `LEAD_AUTHOR_EMAIL`, is made in the Cloudflare dashboard, as the Secret type so that deploys keep it, because this repository is public. For trying sign-in on a computer, put it in `site/.dev.vars`, which git ignores; codes are then shown on the sign-in page instead of being emailed.

## How the parts fit

- **Design tokens.** `design-tokens.json` is turned into CSS custom properties (`--color-paper`, `--font-size-body`, `--space-4` and so on) by `src/lib/design-tokens.ts`, through a small Vite plugin in `vite.config.ts`. Changing the palette means changing only that file.
- **Themes.** Automatic (follows the device), Light or Dark. The choice is kept on the device only; a short script in `src/app.html` applies it before the page paints. Print always uses the light theme.
- **Type.** Atkinson Hyperlegible Next, served by the site itself through the Fontsource packages, with Noto Sans, Noto Sans Cherokee, Noto Sans Osage and Noto Sans Canadian Aboriginal as fallbacks that the browser downloads only for characters Atkinson Hyperlegible Next lacks. The fonts' SIL Open Font License texts are in `static/fonts/`.
- **Content.** `src/lib/server/content.ts` reads the glossary, sources, nation records and changelogs from the repository at build time. Restricted records, and records that need a nation's approval it has not yet given, are left out. Until nation records are merged into `content/tribes/`, the nations section shows the fictitious example from `schemas/examples/tribe.example.yaml`, marked as an example.
- **Map.** `/nations/map` has one map with buttons that switch between views: nations by state, the Bureau of Indian Affairs regions, and the Census Bureau's land areas. Alaska, Hawaiʻi and the territories are drawn in framed boxes below the other states, each with its own scale bar. `src/lib/map-geometry.ts` projects the shapes with d3-geo when the site is built. A small Vite plugin in `vite.config.ts` serves them as the module `virtual:map-geometry`, so the browser gets plain SVG. The region and land area outlines are in `geography/`; see [geography/README.md](geography/README.md).
- **Nation pages.** Facts carry no citation marks; their sources are listed together at the end of the page (`src/lib/server/source-uses.ts`). Addresses link to Google Maps, phone numbers to the dialer and email addresses to a new message (`src/lib/contact-links.ts`). One "Report a problem" link sits at the top of the page.
- **Offline.** `src/service-worker/index.ts` saves the app shell, the fonts and the core pages when the site is first opened, saves other pages as they are read, and shows `/offline` for a page that was never saved. `/manifest.webmanifest` and `/icon.svg` make the site installable; both take their colors from the tokens.
- **Search engines.** robots.txt (`src/routes/robots.txt`) and a `noindex` tag ask search engines not to index the site while it is a 0.0.x draft; `openToSearchEngines` in `src/lib/search-engines.ts` opens both at the first release. The sitemap at `/sitemap.xml` is built from the collections registry and written when a crawler asks ([docs/sitemap.md](../docs/sitemap.md)).
