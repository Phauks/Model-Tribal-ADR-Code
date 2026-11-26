# Cloudflare names

The lead author renamed the project's Workers in the Cloudflare dashboard on Nov. 26, 2026. The databases and buckets keep their old names for now. This page lists the names in use and what the remaining moves would take.

## Workers

| Worker | Old name | Folder | Wrangler file |
| --- | --- | --- | --- |
| `tribal-law-project-site` | `model-tribal-adr-code` | `site` | `site/wrangler.jsonc` |
| `tribal-law-project-live` | `model-tribal-adr-code-live` | `site/live` | `site/live/wrangler.jsonc` |
| `tribal-law-project-scanner` | `model-tribal-adr-code-scanner` | `site/scanner` | `site/scanner/wrangler.jsonc` |
| `tribal-law-project-wayback` | `model-tribal-adr-code-wayback` | `site/wayback` | `site/wayback/wrangler.jsonc` |
| `tribal-law-project-watch` (planned) | none | | ([source watch](source-watch.md)) |

Each Worker's `name` in its Wrangler file must match the name in the dashboard. When they differ, Workers Builds deploys under the dashboard's name, prints a "Failed to match Worker name" warning and offers a pull request of its own. The rename kept each Worker's build settings, schedules, secrets, Custom Domain (`triballawproject.org`) and the site's bindings to the other three, which Cloudflare rewrote to the new names.

The Wayback Worker's public address moved with it, to `https://tribal-law-project-wayback.trevordgoldsmith.workers.dev`. The old address answers 404 (Cloudflare error 1042).

## Databases and buckets not yet moved

| Kind | Name | Binding | Size on Nov. 26, 2026 |
| --- | --- | --- | --- |
| D1 | `model-tribal-adr-code` | `database` (site, live, scanner) | 3.5 MB |
| D1 | `model-tribal-adr-code-library` | `sourceLibrary` (site) | 1.1 GB |
| R2 | `model-tribal-adr-code-sources` | `sourceDocuments` (site, live, scanner, wayback) | 24,889 objects, 19.6 GB |
| R2 | `model-tribal-adr-code-mail` | `mailFiles` (site, scanner) | empty |

Site code reaches them only by binding name, so a move changes the Wrangler files, a few scripts and the Service checks labels, not the site's code.

### Renaming a D1 database

The Cloudflare API's call for changing a D1 database takes only its read replication setting, not a name, so a new name means a new database:

1. Pause writes: there are no outside users yet, but the scanner and the site's scheduled run write every minute.
2. `npx wrangler d1 export model-tribal-adr-code --remote --output=site.sql`, create `tribal-law-project` with `npx wrangler d1 create`, then `npx wrangler d1 execute tribal-law-project --remote --file=site.sql`. The export carries the `d1_migrations` table, so later migrations apply in order.
3. Change `database_name` and `database_id` in `site/wrangler.jsonc`, `site/live/wrangler.jsonc` and `site/scanner/wrangler.jsonc`, and merge. All three Workers redeploy from `main`.
4. Check the Service checks page, then delete the old database after a week.

The library database is rebuilt from the source bucket by `scripts/library/build_library.py`, so it can be made fresh under its new name (`tribal-law-project-library`) instead of copied, and only `site/wrangler.jsonc` names it.

### Moving to a new R2 bucket

R2 buckets cannot be renamed. The move is a copy:

1. Create the new bucket (for example `tribal-law-project-sources`), private, in the same location.
2. Copy every object, keeping keys, with Cloudflare's R2 data migration tool or `rclone`, then compare object counts and total size with the old bucket.
3. Change `bucket_name` in the four Wrangler files, the default bucket in `scripts/library/library.py`, `scripts/library/build_library.py`, `scripts/captures/mirror_captures.py`, `scripts/books/publish_file_sets.py`, `scripts/law/supreme_court_people.py`, `site/tools/seed-local-database.mjs` and `site/tools/build-map-tiles.mjs`, and the bucket label in `site/src/lib/server/service-checks.ts`. Merge.
4. Copy again for anything written between steps 2 and 3 (sent files, Wayback progress, captures), then keep the old bucket read-only for a while before deleting it.

The mail bucket is empty, so it can simply be made new under `tribal-law-project-mail` and the two Wrangler files and `site/MAIL.md` changed.

Names that are not Cloudflare resources (the npm package names, User-Agent strings, download file names, the token keys of the scheduled run and the mail run, and the authenticator key label) keep `model-tribal-adr-code`. Changing the token keys or the authenticator label would break saved settings and set-up authenticator apps.
