# Wayback Worker

The Wayback Worker saves the source library's original links in the Internet Archive's Wayback Machine, signed in with the project's archive.org keys. Without the keys, Save Page Now allows 3 saves a minute and 200 a day; signed in, it allows 7 a minute and 30,000 a day, and a save runs in the background instead of holding the request open ([Save Page Now 2 API](https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA)). The lead author chose on 2026-11-24 to keep the keys in Cloudflare, with this Worker doing the saves, so the keys never reach GitHub (decision record 0006).

## How it works

- **The list.** `research/wayback-queue.tsv` on main lists every source record that has an original link and no archived copy, except links already on archive.org and Federal Register pages (federalregister.gov sends Save Page Now to a block page). `scripts/captures/wayback_queue.py --write` writes it; the archive workflow's catch-up job rewrites it whenever it commits captures.
- **The saves.** Every minute the Worker checks on the saves it has already asked for, then asks for up to 6 more. It reads the list from main once an hour. A save that fails is tried again a day later, at most 3 times. A save whose capture is of another site (a login wall or a signed download link) is not used; it is listed for a person to check. If a capture taken in the last 30 days exists, the Archive returns it instead of making a new one.
- **The results.** What the Worker has done is one JSON object in the private bucket at `wayback/progress.json`. Its address answers three read-only pages, which hold only public links: `/` is a progress page for people (links left, captured, captured in the last 24 hours, being saved, failed, given up, the latest captures and problems, and the last error), refreshed every minute; `/status.json` gives the same counts, and the site's Service checks page (Workers, "Wayback captures") shows them; `/captures.json` lists every capture for the archive workflow.
- **When something goes wrong.** Each call to the Archive gives up after 20 seconds. A link whose save fails is tried again a day later. If the list can't be read, the Worker keeps working from the last copy. If the Archive refuses the keys, the Worker stops saving, the progress page and Service checks show the problem, and the Worker's logs are in the Cloudflare dashboard (observability is on).
- **Into the records.** The catch-up job reads `/captures.json`, writes each capture into its record with `scripts/apply_archive_report.py`, and commits to the captures pull request, so every change to a record is still reviewed. While the Worker answers, the job only looks up copies the Archive already holds and leaves the saving to the Worker.

## Setting it up

1. Make a free account at archive.org and open https://archive.org/account/s3.php for the access key and secret key.
2. In the Cloudflare dashboard, under Secrets Store, add them as `ARCHIVE_ORG_ACCESS_KEY` and `ARCHIVE_ORG_SECRET_KEY` (scope Workers), in the same store as the site's own keys.
3. Create a Workers Builds project for this Worker: connect the repository, root directory `site/wayback`, build command `cd .. && npm ci`, deploy command `npx wrangler deploy`. The build token needs the "Account Secrets Store Edit" permission.

After the first deploy, `https://model-tribal-adr-code-wayback.trevordgoldsmith.workers.dev/` shows its progress within a few minutes. Set the build watch path to `site/wayback/*`, because the Worker uses no other site code.
