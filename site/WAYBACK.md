# Wayback Worker

The Wayback Worker saves the source library's original links in the Internet Archive's Wayback Machine, signed in with the project's archive.org keys. Without the keys, Save Page Now allows 3 saves a minute and 200 a day; signed in, it allows 7 a minute and 30,000 a day, and a save runs in the background instead of holding the request open ([Save Page Now 2 API](https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA)). The lead author chose on 2026-11-24 to keep the keys in Cloudflare, with this Worker doing the saves, so the keys never reach GitHub (decision record 0006). Only this Worker uses them, so they are secrets on the Worker itself rather than in the account's Secrets Store.

## How it works

- **The list.** `research/wayback-queue.tsv` on main lists every source record that has an original link and no archived copy, except links already on archive.org and Federal Register and eCFR pages (both federalregister.gov and ecfr.gov send Save Page Now to a block page at unblock.federalregister.gov). `scripts/captures/wayback_queue.py --write` writes it; the archive workflow's catch-up job rewrites it whenever it commits captures.
- **The saves.** Every minute the Worker checks on the saves it has already asked for, then asks for up to 6 more. It reads the list from main once an hour. A save that fails is tried again a day later, at most 3 times. After each failure the Worker first asks the Archive's capture index for a copy it already holds, and takes the newest one that loaded: of any age for Federal Register, GovInfo, Library of Congress and Oklahoma State University treaty pages, whose documents do not change, and from the last year for other sites (the same rules as `scripts/find_archived_copies.py` and the archive workflow's `--reuse-days 365`). This matters most for the Library of Congress, which often answers Save Page Now with "not found" or never finishes, although its United States Reports pages are there. A save that ends on another site of the same organization (archive.legmt.gov to mca.legmt.gov) or on a host that serves a site's uploaded files (Squarespace, Wix, Divio, Revize, Dropbox, Higher Logic, CivicLive) is used. A save whose capture is of any other site (a login wall or a signed download link) is not used; it is listed for a person to check. Raising `RETRY_ROUND` in `worker.ts` gives every link that was given up on its 3 tries back once. If a capture taken in the last 30 days exists, the Archive answers "The same snapshot had been made N hours ago" instead of making a new one; the Worker then looks up that capture in the Archive's capture index and records it as captured, without using up a try.
- **The results.** What the Worker has done is one JSON object in the private bucket at `wayback/progress.json`. Its address answers three read-only pages, which hold only public links: `/` is a progress page for people, refreshed every minute. Its "Right now" section lists the links waiting on the Archive and how long ago each was asked for, says when the Worker is paused and why or when it next tries a failed link, and counts save requests in the last minute (of the Worker's 6), the last hour (of 360) and the last 24 hours (of the Archive's 30,000), and captures in the last hour. Below that are the totals (links left, captured, failed, given up), the latest captures and problems, and the last error; `/status.json` gives the same counts, and the site's Service checks page (Workers, "Wayback captures") shows them; `/captures.json` lists every capture for the archive workflow.
- **When something goes wrong.** Each call to the Archive gives up after 20 seconds. A link whose save fails is tried again a day later. If the list can't be read, the Worker keeps working from the last copy. If the Archive refuses the keys, the Worker stops saving, the progress page and Service checks show the problem, and the Worker's logs are in the Cloudflare dashboard (observability is on).
- **Into the records.** The catch-up job reads `/captures.json`, writes each capture into its record with `scripts/apply_archive_report.py`, and commits to the captures pull request, so every change to a record is still reviewed. While the Worker answers, the job only looks up copies the Archive already holds and leaves the saving to the Worker.

## Is it working?

The progress page names one of six states. The cron runs every minute even when there is nothing to save, so a last run more than five minutes old always means the schedule has stopped, never that the list is empty.

- **Saving**: links are being saved, or are due to be.
- **Waiting to try failed links again**: every link left failed in the last day, and each is tried again a day after its failure.
- **Idle: nothing left to save**: every link on the list is captured, given up on, or marked by hand.
- **Paused: daily limit reached**: the Archive's daily limit was reached; saving starts again within the hour.
- **Stopped: the archive.org keys are missing or refused**: add the two secrets to the Worker, or make new keys and replace them.
- **Not running**: the Worker hasn't run in over five minutes; check its cron trigger and logs in the Cloudflare dashboard.

The site's Service checks page shows the same state as its "Wayback captures" row, and the workspace's Wayback captures page shows the "Right now" section. The site reaches the Worker through the service binding `waybackWorker` (site/wrangler.jsonc), because a Worker cannot fetch another Worker's workers.dev address on the same account.

## Links that fail

The workspace page Wayback captures (`/workspace/wayback`, lead author only) lists every link the Worker could not save, newest first, with the reason and the number of tries. For each link you can:

- open the page, to see whether it still loads;
- **Save it yourself**, which opens Save Page Now for that link in your own browser;
- paste the Wayback link if your save worked, marking it **Saved by hand**. The capture must be of the same site, and the archive workflow then writes it into the record like any other capture;
- mark **It failed for me too**;
- **Send a file**, which opens the site's upload page with the description and source already filled in, so the file goes through the usual virus scan and review; then mark **I sent a file**.

A marked link is not tried again. The marks are kept beside the Worker's progress at `wayback/marks.json`, and Clear the mark undoes one.

## Setting it up

1. Make a free account at archive.org and open https://archive.org/account/s3.php for the access key and secret key.
2. Create a Workers Builds project for this Worker: connect the repository, root directory `site/wayback`, build command `cd .. && npm ci`, deploy command `npx wrangler deploy`, build watch path `site/wayback/*`.
3. After the first deploy, open the Worker (tribal-law-project-wayback) > Settings > Variables and Secrets, and add two secrets of type Secret: `ARCHIVE_ORG_ACCESS_KEY` and `ARCHIVE_ORG_SECRET_KEY`. Until they are set, the progress page says the keys are missing.

After the first deploy, `https://tribal-law-project-wayback.trevordgoldsmith.workers.dev/` shows its progress within a few minutes.
