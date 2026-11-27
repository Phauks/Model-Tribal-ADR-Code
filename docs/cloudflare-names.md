# Cloudflare names

The lead author renamed the project's Workers in the Cloudflare dashboard on Nov. 26, 2026, and the databases and buckets moved to new ones under the new names the same day. This page lists the names in use.

## Workers

| Worker | Old name | Folder | Wrangler file |
| --- | --- | --- | --- |
| `tribal-law-project-site` | `model-tribal-adr-code` | `site` | `site/wrangler.jsonc` |
| `tribal-law-project-live` | `model-tribal-adr-code-live` | `site/live` | `site/live/wrangler.jsonc` |
| `tribal-law-project-scanner` | `model-tribal-adr-code-scanner` | `site/scanner` | `site/scanner/wrangler.jsonc` |
| `tribal-law-project-wayback` | `model-tribal-adr-code-wayback` | `site/wayback` | `site/wayback/wrangler.jsonc` |
| `tribal-law-project-radar` | none | `site/watch` | `site/watch/wrangler.jsonc` ([source watch](source-watch.md)) |

Each Worker's `name` in its Wrangler file must match the name in the dashboard. When they differ, Workers Builds deploys under the dashboard's name, prints a "Failed to match Worker name" warning and offers a pull request of its own. The rename kept each Worker's build settings, schedules, secrets, Custom Domain (`triballawproject.org`) and the site's bindings to the other three, which Cloudflare rewrote to the new names.

The Wayback Worker's public address moved with it, to `https://tribal-law-project-wayback.trevordgoldsmith.workers.dev`. The old address answers 404 (Cloudflare error 1042).

## Databases and buckets

Cloudflare cannot rename a D1 database or an R2 bucket, so on Nov. 26, 2026 the project moved to new ones under the new names and switched the bindings in one pull request.

| Kind | Name | Old name | Binding | How it was moved |
| --- | --- | --- | --- | --- |
| D1 | `tribal-law-project` (`eeb27102-f50e-40ff-bebd-5347c5c055c7`) | `model-tribal-adr-code` | `database` (site, live, scanner, watch) | Copied on Cloudflare's side: 127 tables, 4,800 rows and all 60 migrations matched, then a catch-up pass for rows written during the switch |
| D1 | `tribal-law-project-library` (`90c5f0f5-6352-459e-a946-b3f18ea97d96`) | `model-tribal-adr-code-library` | `sourceLibrary` (site) | Loaded from the change files under `_library/d1/` in the bucket, as the site's hourly run does |
| R2 | `tribal-law-project-files` | `model-tribal-adr-code-sources` | `sourceDocuments` (site, live, scanner, wayback, watch) | R2 data migration (Super Slurper), then a second pass for files written during the switch |
| R2 | `tribal-law-project-mail` | `model-tribal-adr-code-mail` | `mailFiles` (site, scanner) | R2 data migration for mail received during the switch |

Site code reaches them only by binding name, so the switch changed the Wrangler files, the default bucket in the scripts and the Service checks labels, not the site's code. Migrations are applied with `npx wrangler d1 migrations apply database --remote`, which follows the binding.

The old databases and buckets stay, unused, until the lead author deletes them. Nothing should be written to them after the switch.

### How the switch went

A temporary module in the Wayback Worker (PR #541, removed afterwards) copied the site's database on Cloudflare's side and loaded the new library database from the change files. The switch (PR #546) merged at 23:43 UTC on Nov. 26. The live, scanner and Wayback Workers deployed on the new bindings at once. The site's own deploys were failing on Cloudflare's 64 MiB Worker size limit, so it stayed on the old database and bucket until the size fix (PR #566) deployed at 01:44 UTC on Nov. 27. Then a catch-up pass copied the 2,563 rows the site had written to the old database in between, and a second R2 data migration with "Skip existing" copied the files written to the old bucket.

## GitHub repository

The lead author renamed the repository from `Phauks/Model-Tribal-ADR-Code` to `Phauks/Tribal-Law-Project` on Nov. 26, 2026. GitHub redirects the old address. The Workers Builds connections are tied to the repository's id, not its name, so all five Workers kept building from `main` after the rename. Links in the site, the schemas' `$id`s, the issue and pull request templates and the citation style name the new repository. Decision records and research notes keep the name they were written with.

Names that are not Cloudflare resources (the npm package names, User-Agent strings, download file names, the token keys of the scheduled run and the mail run, and the authenticator key label) keep `model-tribal-adr-code`. Changing the token keys or the authenticator label would break saved settings and set-up authenticator apps.
