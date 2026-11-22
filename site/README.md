# Website

The website is built with SvelteKit (Svelte 5, TypeScript) and served by a
Cloudflare Worker. Every public page is built ahead of time from the
plain-text files in `content/`, so the Worker mostly serves files. The
request form, sign-in and the co-author workspace are answered by the Worker
on request; [COLLABORATION.md](COLLABORATION.md) explains them and how to set
up sign-in. The design is in
[DESIGN.md](DESIGN.md), the colors and sizes are in
[design-tokens.json](design-tokens.json), the version is in
[version.txt](version.txt), and the history is in [CHANGELOG.md](CHANGELOG.md).

## Run it on your computer

Needs Node.js 22 or later. From this folder:

```sh
npm ci            # install the exact versions in package-lock.json
npm run dev       # development server with live reload
npm run build     # build the site into .svelte-kit/cloudflare
npm run preview   # build, then serve the built Worker locally with Wrangler
```

Checks that also run on every pull request (the "Website build" job in
`.github/workflows/checks.yml`):

```sh
npm run check             # TypeScript and Svelte
npm test                  # unit tests (Vitest), including the database code
npm run check:colors      # no color is written anywhere but design-tokens.json
npm run build
npm run check:built-site  # every page has a language, a title, one h1 and a skip link
npm run check:accessibility  # axe-core on every built page, light and dark themes
```

The accessibility check opens each page in Chromium through Playwright. Install
the browser once with `npx playwright install chromium`, or set `CHROMIUM_PATH`
to a Chromium that is already installed. Pass `--pages /,/nations/map` to check
only some pages. It covers the prerendered pages; the request form and sign-in
pages are answered by the Worker and are checked by hand.

## How it is deployed

Cloudflare Workers Builds deploys the site from GitHub
([decision record 0006](../docs/decisions/0006-secrets-only-in-cloudflare.md)).
No secret is stored in GitHub. The Worker's build settings in the Cloudflare
dashboard are:

| Setting | Value |
| --- | --- |
| Worker name | `model-tribal-adr-code` (must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | `site` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

Each merge to `main` deploys to
`https://model-tribal-adr-code.trevordgoldsmith.workers.dev` until a domain is
chosen ([what waits on the domain](../docs/domain-to-do.md)). `wrangler.jsonc` has no `main` or `assets` setting because
`@sveltejs/adapter-cloudflare` sets both when it builds.

## Cloudflare resources

Code refers to Cloudflare resources only by their binding names. The names of
the resources themselves appear in `wrangler.jsonc` and nowhere else, so a
resource can be renamed or replaced by editing that file.

| Binding | Resource | Use |
| --- | --- | --- |
| `database` | D1 database | People and roles, reviews, requests from nations. Tables come from `migrations/` ([COLLABORATION.md](COLLABORATION.md#database)). |
| `sourceDocuments` | Private R2 bucket | Copies of source documents, and files sent with requests (under `requests/`). Not served publicly. |
| `requestFormLimit` | Rate limit | At most five request-form submissions a minute from one connection. |

| `signInLimit`, `signInNetworkLimit` | Rate limits | Sign-in tries: five a minute per email address and step, thirty per network address. |
| `signInEmail` | Email Service | Sends sign-in codes from the `SIGN_IN_EMAIL_FROM` address in `vars` ([COLLABORATION.md](COLLABORATION.md#setting-up-sign-in)). |

No secrets are needed. One setting, `LEAD_AUTHOR_EMAIL`, is made in the
Cloudflare dashboard, as the Secret type so that deploys keep it, because
this repository is public. For trying sign-in on
a computer, put it in `site/.dev.vars`, which git ignores; codes are then
shown on the sign-in page instead of being emailed.

## How the parts fit

- **Design tokens.** `design-tokens.json` is turned into CSS custom
  properties (`--color-paper`, `--font-size-body`, `--space-4` and so on) by
  `src/lib/design-tokens.ts`, through a small Vite plugin in
  `vite.config.ts`. Changing the palette means changing only that file.
- **Themes.** Automatic (follows the device), Light or Dark. The choice is
  kept on the device only; a short script in `src/app.html` applies it before
  the page paints. Print always uses the light theme.
- **Type.** Atkinson Hyperlegible Next, served by the site itself through the
  Fontsource packages, with Noto Sans, Noto Sans Cherokee, Noto Sans Osage
  and Noto Sans Canadian Aboriginal as fallbacks that the browser downloads
  only for characters Atkinson Hyperlegible Next lacks. The fonts' SIL Open
  Font License texts are in `static/fonts/`.
- **Content.** `src/lib/server/content.ts` reads the glossary, sources,
  nation records and changelogs from the repository at build time.
  Restricted records, and records that need a nation's approval it has not
  yet given, are left out. Until nation records are merged into
  `content/tribes/`, the nations section shows the fictitious example from
  `schemas/examples/tribe.example.yaml`, marked as an example.
- **Map.** `/nations/map` has one map with buttons that switch between views: nations by state, and the Bureau of Indian Affairs regions. Alaska, Hawaiʻi and the territories are drawn in framed boxes below the other states, each with its own scale bar. `src/lib/map-geometry.ts` projects the shapes with d3-geo when the site is built. A small Vite plugin in `vite.config.ts` serves them as the module `virtual:map-geometry`, so the browser gets plain SVG. The region outlines are in `geography/`; see [geography/README.md](geography/README.md).
- **Nation pages.** Facts carry no citation marks; their sources are listed
  together at the end of the page (`src/lib/server/source-uses.ts`).
  Addresses link to Google Maps, phone numbers to the dialer and email
  addresses to a new message (`src/lib/contact-links.ts`). One "Report a
  problem" link sits at the top of the page.
- **Offline.** `src/service-worker/index.ts` saves the app shell, the fonts
  and the core pages when the site is first opened, saves other pages as
  they are read, and shows `/offline` for a page that was never saved.
  `/manifest.webmanifest` and `/icon.svg` make the site installable; both
  take their colors from the tokens.
- **Search engines.** `static/robots.txt` and a `noindex` tag ask search
  engines not to index the site while it is a 0.0.x draft.
