# 0038. Files people send are stored in the private bucket, and a video can be a YouTube link

- **Status:** Accepted (lead author, Nov. 23, 2026)
- **Date:** 2026-11-23

## Context

On Nov. 23, 2026 the lead author asked for a way for people, contributors for example, to upload files that the project reviews and files, possibly separate from the forms.[^ask] He then asked that videos be allowed on the website, with print to be worked out later.[^video] The proposal offered two ways to handle video: store originals in the private bucket and copy filed public videos to Cloudflare Stream, or keep everything in the bucket. Stream would add encoding for slow connections and its own pricing: $5 per 1,000 minutes stored and $1 per 1,000 minutes watched.[^stream] The lead author answered: "Build with r2, we also might just end up with YouTube linking anyways?"[^choice]

## Decision

- **One upload path for the site.** Signed-in people send files on a Send files page and follow them on Your uploads. Reviewers (the lead author and editors) work through an Uploads queue in the workspace. The essay editor's figures use the same path, without the queue. Forms keep their own uploads with their request. Details are in [docs/uploads.md](../uploads.md).
- **Stored in the private bucket, in pieces.** Files go to the `sourceDocuments` bucket in 10 MB pieces through the Worker, as R2 multipart uploads.[^multipart] No secret keys and no new service are needed. Nothing under `uploads/` is public.
- **No Cloudflare Stream.** Videos and recordings play from the bucket in the browser's own player, using byte ranges. Filed files are served at `/files/<reference>/<name>`.
- **A YouTube link can stand in for any video.** A sender or the essay editor can give a YouTube link instead of a file. It is reviewed like a file and embedded in YouTube's privacy-enhanced mode.[^youtube]
- **The proposal's other defaults stand.**
  - Sound recordings are included.
  - Size limits: documents 100 MB, pictures 50 MB, sound 1 GB, video 5 GB.
  - Per-account limits: none (changed on Nov. 23, 2026; see "Limits" below). The first version allowed 20 files a day and 5 GB waiting for review, or 50 files and 20 GB for confirmed contributors.
  - Files are checked by type and for hidden content, and pictures get a copy without location details.
  - Nation reviewers may comment on uploads about their nation, but not file them.

### Limits (Nov. 23, 2026)

Trevor Goldsmith, Nov. 23, 2026: "the 20 a day is a crazy stupid thing to have. Assume if they have access to this page they have been vetted." Send files and Intake no longer limit how many files a batch holds, how many an account sends in a day, or how much waits for review. Cloudflare's per-minute limit on starting files stays, raised to 600 a minute, only as a guard against a runaway script; the upload page waits and carries on when it is reached. The size limit for each kind of file is unchanged.

## Consequences

- Every video plays from one copy at its original quality. A large video may load slowly on a weak connection. A YouTube link avoids that when the video is already there, at the cost of depending on YouTube and its terms.
- Storage is the bucket's ordinary R2 pricing, with no per-minute charges.
- A virus scan (ClamAV in a Cloudflare Container), nation reviewers' comments and email notices come later; docs/uploads.md lists them.
- How video appears in the printed book is still open. The likely form is a still frame, a caption and a short link once the project has its domain.

## Sources

[^ask]: Lead author, message in the project chat, Nov. 23, 2026 (project records).
[^video]: Lead author, message relayed to the uploads thread, Nov. 23, 2026 (project records).
[^stream]: Cloudflare, "Stream: Pricing," https://developers.cloudflare.com/stream/pricing/.
[^choice]: Lead author, message relayed to the uploads thread, Nov. 23, 2026 (project records).
[^multipart]: Cloudflare R2, "Use the R2 multipart API from Workers," https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/.
[^youtube]: YouTube Help, "Embed videos & playlists," https://support.google.com/youtube/answer/171780.
