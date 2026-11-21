# Website

The website is built with SvelteKit (Svelte 5, TypeScript) and served by a
Cloudflare Worker. Every page is built ahead of time from the plain-text
files in `content/`, so the Worker mostly serves files. The design is in
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
npm run check:colors      # no color is written anywhere but design-tokens.json
npm run build
npm run check:built-site  # every page has a language, a title, one h1 and a skip link
```

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
chosen. `wrangler.jsonc` has no `main` or `assets` setting because
`@sveltejs/adapter-cloudflare` sets both when it builds.

## Cloudflare resources

Code refers to Cloudflare resources only by their binding names. The names of
the resources themselves appear in `wrangler.jsonc` and nowhere else, so a
resource can be renamed or replaced by editing that file.

| Binding | Resource | Use |
| --- | --- | --- |
| `database` | D1 database | Sign-in and collaboration. No tables yet. |
| `sourceDocuments` | Private R2 bucket | Copies of source documents. Not served publicly. |

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
- **Offline.** `src/service-worker/index.ts` saves the app shell, the fonts
  and the core pages when the site is first opened, saves other pages as
  they are read, and shows `/offline` for a page that was never saved.
  `/manifest.webmanifest` and `/icon.svg` make the site installable; both
  take their colors from the tokens.
- **Search engines.** `static/robots.txt` and a `noindex` tag ask search
  engines not to index the site while it is a 0.0.x draft.
