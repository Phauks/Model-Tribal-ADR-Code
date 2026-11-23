# Virus and malware scanning

Every file people send the project, and every attachment that arrives in the project inbox, is held until a virus scan says it is clean. One scanner serves the whole site. Decision record [0046](../docs/decisions/0046-scan-files-with-clamav-in-a-cloudflare-container.md) records the choices.

## In short

- **Held until clean.** A file is stored in the private `sourceDocuments` bucket as before, and is put in line for a scan at the same moment. Until its scan says clean, nothing on the site serves it, opens it or files it. A file where something is found is held for good.
- **One table is the whole link.** The site writes a row to `file_scans` (`migrations/0021_file_scans.sql`) and reads it back. The scanner, a Worker of its own, reads the waiting rows, scans each file in the bucket, and writes the result. The site has no binding to the scanner, so it runs the same whether or not the scanner is deployed; files simply wait.
- **The engine is ClamAV, YARA rules and structural checks**, in a Cloudflare Container with no internet access. It reports facts; the site's own policy decides clean, flagged or "could not be checked".
- **The provider can be swapped** with one setting, like the outreach email carrier: the project's own container, any outside service that speaks the same JSON, or off.

## Using it from site code

`src/lib/server/file-scans.ts` is the whole interface. For most files, two calls do everything:

- `storeSentFile(database, bucket, { objectKey, purpose, subject, bytes, httpMetadata })` stores a file someone sent and puts it in line in one step. If it cannot be put in line, the file is deleted again.
- `openScannedFile(database, bucket, objectKey)` opens it for serving only if its scan lets it out, and otherwise says it is `held` or `missing`; `heldFileAnswer` turns that into a status and a sentence for the route. A held file is not even read from the bucket.

Underneath, and for files written in pieces (uploads):

1. After storing a file, call `requestScan(database, { objectKey, purpose, subject })`. `purpose` is one of `ScanPurpose` (`'upload'`, `'mail-attachment'`, `'mail-outgoing'`, `'request-file'`, `'nation-picture'`, `'nation-team-proof'`, `'profile-picture'`; add a new name for a new kind of file); `subject` is your own name for it, such as an upload reference or an attachment identifier. Asking again for the same key starts the scan over, so a replaced file is never covered by an old result.
2. Before serving, opening or filing the file, read its scan with `fileScan` (one) or `fileScans` (many, by key) and go ahead only if `mayServe(scan, object)` is true. Pass the bucket object when you have it: a result counts only for the bytes that were scanned (the object's etag), so a file replaced after its scan is held again. A file with no scan row is held too.
3. Show where it stands with `scanStatusWords(scan)`, which gives a short label and a sentence for senders and reviewers. `stillScanning(scan)` says whether to look again later.
4. A reviewer can release a file that could not be checked (locked with a password, too large, or the scan gave up) with `releaseByHand`, giving a reason; the caller checks the person's permission and writes the activity log entry. A file where something was found can never be released. `scanAgain` puts a file back in line, and `forgetScan` removes the row when the file itself is deleted.

What each status means:

| Status | Meaning | Served? |
| --- | --- | --- |
| `waiting` | In line. With `reason = 'no-engine'`, no scanner is running yet. | No |
| `scanning` | The scanner has it now. | No |
| `retrying` | The scanner could not finish; it tries again at `next_try_at` (after 1, 5, 15, 60, 180, 360 and 720 minutes). | No |
| `clean` | Scanned, nothing found. `active_content` notes scripts or macros. | Yes, for the scanned bytes |
| `flagged` | Something was found; `reason` names it. | Never |
| `cannot-scan` | Locked (`encrypted`), larger than the scanner takes (`too-large`), ClamAV stopped at its limits (`limits-exceeded`), or not in the bucket (`missing`). | No, until a reviewer releases it |
| `failed` | Eight tries without an answer. | No, until scanned again or released |
| `released-by-hand` | A reviewer released a file that could not be checked. | Yes |

## The scan guard

`tests/scan-guard.test.ts` makes sure no file from outside the project gets around the scanner. It reads the code of every Worker in `site/` (each `wrangler.jsonc` "main", plus the website) with the TypeScript checker and finds, by type rather than by name:

- every place that reads the bytes of a `File`, a `Blob` or a `Request` body, which is how a file arrives; and
- every `get`, `put` and multipart call on an `R2Bucket`.

Each one must be listed in the test with what it is. A bucket call that stores a file from outside must be `storeSentFile` (or sit in a module that calls `requestScan`, as uploads do); one that serves such a file must be `openScannedFile` (or check `mayServe` in the same function); only the scanner may read a file to scan it; and anything else must say why it is the project's own file. A new call or a new way in that is not listed fails the test, so it is looked at before it ships. The test also fails if a bucket loses its type (so the checker cannot see it) or a migration adds a `BLOB` column (so files cannot hide in the database).

What it does not cover: code outside `site/` (the project's own Python scripts, which never take files from people), and the inbound mail's HTML body, which is shown only in a sandboxed frame that runs no scripts and loads nothing (a listed exception). The raw message is kept but never served.

Files from outside today: uploads (`upload`), request and form files (`request-file`), nation page pictures (`nation-picture`), proof sent to join a nation's team (`nation-team-proof`), profile pictures (`profile-picture`), email attachments (`mail-attachment`) and files attached to outgoing email (`mail-outgoing`; the message waits until they pass).

## How a scan runs

1. Every minute the scanner Worker's cron wakes the scan desk, a Durable Object (`src/lib/server/scanning/scan-desk.ts`). The desk sets an alarm and, in it, takes the oldest waiting file.
2. It reads the object from the bucket. A file over the size limit (`SCAN_SIZE_LIMIT_MB`, 2048) is held as `too-large` without being sent.
3. It streams the file to the provider (`src/lib/server/scanning/providers.ts`). For the container provider it first wakes the engine, which takes a minute or so after sleeping, because ClamAV loads about 3.6 million signatures.
4. The engine answers with facts: ClamAV's result, any YARA rules that matched, and what the structural checks found (a zip bomb, archives nested too deep or with too many entries, a password lock, PDF scripts or Office macros). `src/lib/server/scanning/verdict.ts` turns them into clean, flagged or "could not be checked", in a fixed order: a ClamAV signature, then a YARA rule that counts (the extended tier; suspicious rules only from a score of 75), then a structural attack, then a password lock.
5. The desk writes the result, the object's etag and size, and the engine's version (code, YARA rules and ClamAV signatures, such as `engine/1+yara-rules/20261120+clamav-db/28191`) to the row, and takes the next file. An error of any kind leaves the file held and tries again later; nothing is ever marked clean unless the whole file was scanned and nothing was found.

An alarm may run for 15 minutes and is retried if it fails, while a request's leftover work is cut off 30 seconds after its response (Cloudflare, "Durable Objects: Alarms"; "Workers: Limits"), which is why the desk works in its alarm.

## The scan engine

`scanner/engine/` is a small Rust service that runs beside the ClamAV daemon in one container image:

- `POST /scan` writes the body to a scratch file, has clamd scan it by path, and at the same time runs the YARA rules and the structural checks over the same bytes. It answers with the facts as JSON, the shape `RawScanResult` in `src/lib/server/scanning/scan-port.ts` reads.
- It never reports clean when ClamAV did not answer: that is `clam: unavailable`, which the site retries. An engine fault is a 503, also retried.
- ClamAV is set to take files up to 2 GiB and, with `AlertExceedsMax`, to report a file it could not finish rather than pass it (`entrypoint.sh`).
- The ClamAV signatures and the YARA Forge rules (the "extended" set) are downloaded when the image is built and baked in, because the container has no internet access. A build with `--build-arg YARA_RULES=off` leaves the rules out, for a machine that cannot reach GitHub; its results say `yara-rules/none`.

Run its tests with `cargo test` in `scanner/engine`, and the whole image against the EICAR test file with `tests/eicar_e2e.sh` (needs Docker). The pull request checks run both when the engine changes; the image check is shown but not required, because ClamAV's download servers sometimes turn away busy build machines. Built on a laptop-class machine, the image started in about 12 seconds, used about 1 GiB of memory with ClamAV's signatures loaded, named the EICAR file `Eicar-Test-Signature`, and passed a plain text file.

## Swapping the provider

The scanner Worker's `SCAN_PROVIDER` setting (`scanner/wrangler.jsonc`) picks who scans:

- `container` (the default): the engine above.
- `http`: any service at `SCAN_HTTP_ADDRESS` that takes the file as the body of a `POST` and answers with the same JSON. If it needs a key, set the secret `SCAN_HTTP_TOKEN` in the Cloudflare dashboard (Worker > Settings > Variables and Secrets); it is sent as a bearer token. This is how the same engine could run somewhere else, or another product be put behind a small adapter.
- `off`: nothing is scanned. Every file stays held.

An unknown name, or `http` without an address, counts as `off`, so a mistake holds files rather than clearing them. Services that share uploaded files with others, such as VirusTotal's public service, should not be used: files people send and the nations' email are private.

## Setting it up

The scanner deploys with its own Workers Builds project, like the live editing Worker:

1. In the Cloudflare dashboard, create a Worker from this repository with root directory `site/scanner`, build command `cd .. && npm ci`, deploy command `npx wrangler deploy`, and build watch paths `site/scanner/*` and `site/src/lib/server/scanning/*`. The name must be `model-tribal-adr-code-scanner`.
2. Apply the migration: `npx wrangler d1 migrations apply database --remote` from `site/`.
3. The first deploy builds the engine image (about ten minutes) and provisions the container, which can take a few minutes more.
4. Optional: for fresh signatures every day, create a deploy hook for the scanner Worker (Settings > Builds > Deploy Hooks) and save its address as the secret `SCAN_REBUILD_HOOK_URL`. The Worker calls it daily at 06:23 UTC, and the rebuild downloads the day's signatures. Without it, signatures are as fresh as the scanner's last deploy, and each result records which signatures it used.

## Cost

Containers are part of the Workers Paid plan the project already has, billed only while an instance runs. The engine is a `standard-1` instance (half a CPU, 4 GiB of memory, 8 GB of disk) that sleeps ten minutes after its last scan. The plan includes 25 GiB-hours of memory, 375 vCPU-minutes and 200 GB-hours of disk a month; beyond that memory is $0.0000025 per GiB-second, about $0.036 for an hour of this instance (Cloudflare, "Containers: Pricing"). A day with a few uploads wakes it once or twice, so ordinary use should stay within what the plan includes. Keeping it awake all month would be about $26 of memory, which is why it sleeps. The daily rebuild uses about 10 of the 6,000 Workers Builds minutes a month (Cloudflare, "Workers Builds: Limits & pricing").

## Where it came from

The engine, the provider interface and the verdict policy are adapted from Trevor Goldsmith's Magna Carta repository (`containers/scan`, `apps/scan-worker`, `packages/file-manager/src/scan-port.ts` and `verdict.ts`). That repository is "All rights reserved"; Trevor, its owner, directed this reuse, and the copied code is published here under this repository's MIT licence for code. Left out from the original: the Magika file-type engine (the site already finds types from a file's first bytes), the signature prefilter, the score histogram, and the per-firm policies.

## Sources

- Cloudflare, "Containers: Pricing," https://developers.cloudflare.com/containers/platform/pricing/.
- Cloudflare, "Containers: Limits and instance types," https://developers.cloudflare.com/containers/platform/limits/.
- Cloudflare, "Deploy Containers," https://developers.cloudflare.com/containers/guides/deploy/.
- Cloudflare, "Durable Objects: Alarms," https://developers.cloudflare.com/durable-objects/api/alarms/.
- Cloudflare, "Workers Builds: Limits & pricing," https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/.
- ClamAV, "Configuration," https://docs.clamav.net/manual/Usage/Configuration.html.
- YARA Forge, https://github.com/YARAHQ/yara-forge.
- OWASP, "File Upload Cheat Sheet," https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html.
