# Files people send

Anyone who is signed in can send the project documents, pictures, sound recordings and videos on the website. The project's reviewers look at each file and decide where it goes. This is one path for every upload on the site. The essay editor's pictures and videos use it too, and the contribution forms keep their own uploads with the request they belong to (docs/contributions.md, "On the website"). Decision record [0038](decisions/0038-files-people-send-stored-in-the-bucket-with-youtube-links.md) records the choices.

## The pages

- **Send files** (`/uploads/send`). Files go in the upload table (see "The upload table"), with any number in a batch, and a YouTube link can be added too. The questions that apply to all of them sit in a panel beside the table: what the files are, which Native nations they are about, where they came from, how the project may use them, and whether the nation should see them first. There is also an "I am under 18" box, and the sender confirms they may share the files.
- **Intake** in the workspace (`/workspace/intake`, permission `review-uploads`). Files for the research library, such as what the lead author fetched for the pull list. There are no questions, only an optional note, and these files never enter the review queue. See "Intake".
- **Your uploads** (`/uploads`, also under Your account in the left sidebar). Everything the person has sent, with its status and a line explaining it. Here they answer a reviewer's question and withdraw a file before it is filed. Withdrawing deletes the file at once.
- **Uploads** in the workspace (`/workspace/uploads`, for the lead author and editors, permission `review-uploads`). The queue, oldest first, in five views: to review, waiting on someone, decided, not accepted or withdrawn, and all. It can be narrowed to one kind of file.
- **One upload** (`/workspace/uploads/<reference>`). The reviewer sees the file (picture, player or YouTube embed; documents are downloaded, never opened in the browser), what the checks found, and what the sender said. From here they ask the sender a question, leave a note for other reviewers, and then file it, keep it for reference, wait for the nation, or mark it not used with a reason the sender sees. A decided upload can be reopened. Each step is written to the activity log.
- **Files about your nation** (`/workspace/nation-uploads`, for nation reviewers, permission `comment-on-nation-uploads`). The files people sent that name the reviewer's nation, with a page for each where they see it and comment for the nation. See "Comments from the nation".

## Statuses

| Status | Meaning |
| --- | --- |
| Sending | Still arriving. Choosing the same file again picks up where it stopped. |
| Checking | It arrived and is held until the virus check says every stored copy is clean. Reviewers see it under "Waiting on someone". |
| Not accepted | The checks refused it; the reason is shown. |
| Waiting for review | It arrived and is in the queue. |
| In review | A reviewer took it. |
| Needs your answer | A reviewer asked the sender a question. Reviewers see "Waiting for the sender". |
| Waiting for the nation | The nation should see it first. |
| Filed | Filed where it belongs, with who can see it. |
| Kept for reference | Kept privately as background; never shown. |
| Not used | Declined, with a reason. The file is deleted 30 days later; the record stays. |
| Withdrawn | The sender took it back; the file was deleted. |

## Kinds and sizes

| Kind | Types | Largest |
| --- | --- | --- |
| Document | PDF, Word (.docx), Excel (.xlsx), OpenDocument text and spreadsheet, plain text, CSV, Markdown | 100 MB |
| Picture | JPEG, PNG, WebP, GIF, TIFF, HEIC | 50 MB |
| Sound recording | MP3, M4A, WAV, FLAC, Ogg | 1 GB |
| Video | MP4, MOV, WebM, or a YouTube link | 5 GB |

The type comes from the file's first bytes, not its name. Archives, programs, web pages, SVG pictures, macro-enabled Office files (.docm, .xlsm, .pptm), older Office files (.doc, .xls) and password-protected files are refused, each with a plain reason (OWASP File Upload Cheat Sheet, "List allowed extensions" and "File content validation").

There is no limit on how many files a batch holds, how many an account sends in a day, or how much waits for review (decision record 0038, "Limits"). Anyone who can reach the page counts as vetted. Cloudflare stops one account from starting more than 600 files a minute (`uploadLimit` in `site/wrangler.jsonc`), which guards against a runaway script. When that happens the page waits a few seconds and carries on, so a person never sees it as a limit.

## The upload table

Send files and Intake share one table (`site/src/lib/components/FileSender.svelte`), modeled on the upload screens of Google Drive and Dropbox (mockups in project files, `design/upload-table/`).

- Files can be dropped anywhere on the page, folders included, and the whole page shows that it will take them. The Files and Folder buttons do the same. Hidden files that folders carry (`.DS_Store`, `desktop.ini`, `Thumbs.db`) are left out.
- There is one row per file, with its name (and its folder path), size and status. Tabs show all files, or only the ones that are ready, sending, sent or have a problem. Find narrows the rows by name, and the checkboxes let several rows be removed at once.
- A batch starts by sending six files at once and adds one more each time the last round went faster, up to ten; being told to slow down, or a request that hears nothing back, takes two away (never fewer than two). Small files spend most of their time waiting on the server, so more at once helps them most. Starting a file does not count against the limit on workspace changes (30 a minute), only against the upload limit. A request that hears nothing back in a minute (three minutes for a piece) is given up, so a stuck file moves to Problems and frees its place. A sending file can be paused and carried on later. A file that stopped (for example, the connection dropped) can be tried again, alone or with every other stopped file; a refused file says why.
- A total at the bottom gives how many files and bytes are sent and about how long is left. Leaving the page while files are sending asks first.
- On a phone the table becomes a list.

## How a file travels

1. The browser asks to start (`POST /uploads/pieces`) with the file's name, size and the answers. The Worker checks the account's allowance and starts a multipart upload in the private `sourceDocuments` bucket at `uploads/<identifier>/original` (Cloudflare R2, "Use the R2 multipart API from Workers").
2. The browser sends the file in 10 MB pieces (`PUT /uploads/pieces/<reference>/<number>`), one at a time, retrying a dropped piece. Pieces keep each request well under the Workers request size limit of 100 MB (Cloudflare Workers, "Limits"). The first piece decides the file's type and size limit. Each piece is hashed with SHA-256 and searched for hidden content: scripts, launch actions and attached files in a PDF; macros, outside links and embedded objects in Office and OpenDocument files. A refused piece ends the upload and drops what arrived.
3. When every piece is in (`POST /uploads/pieces/<reference>/finish`), the Worker joins them, records a fingerprint, and holds the file at "Checking" for the virus check (see "The virus check"). The fingerprint is the SHA-256 of a one-piece file, or "pieces:" and the SHA-256 of the piece hashes for a longer one. A picture of 20 MB or less gets a copy at `uploads/<identifier>/preview` without its Exif, XMP and text metadata, which can say where a photo was taken. That copy is what a reviewer sees and what gets filed.
4. If the sender closes the page, choosing the same file again (same name and size) picks up at the first missing piece. A file that does not finish within 7 days is given up, matching the bucket's default rule that drops unfinished multipart uploads after 7 days (Cloudflare R2, "Object lifecycles").

A YouTube link (`POST /uploads/links`) stores nothing but the video's 11-character identifier. Reviewers watch it embedded from youtube-nocookie.com, YouTube's privacy-enhanced mode (YouTube Help, "Embed videos & playlists").

## The virus check

Every stored copy of a file, the file as sent and a picture's copy without location, is put in line for the project's virus scanner as soon as the file is finished (`requestScan`, site/SCANNING.md). The file waits at "Checking" until every copy has a result:

- **Clean**, or released by a reviewer: the file moves into the queue at "Waiting for review".
- **Something found:** the file is refused and deleted at once. The sender sees "Not accepted" with what the check found, and the record stays.
- **Could not be checked** (locked with a password, too large, or the check gave up): the file stays held. A reviewer can release it from its page, giving a reason that goes in the history, or put it back in line. A file where something was found can never be released.

Files move on when the queue, the file's own page or Your uploads is opened (`advanceCheckedUploads`); the scanner writes only its own table. Nothing is shown, downloaded, played or filed until its scan allows it, and the check is made against the very bytes that were scanned, so a copy replaced afterwards is held again. Essay figures are filed with their essay at once but are not served until they pass. If the scans table cannot be read, every file stays held. Deleting a file also deletes its scan results (`forgetScan`).

## Filing and showing

Filing sets where the file goes: a nation page source, picture or video, a story, an essay figure, or the private research library. The reviewer also gives the page, a caption, the credit, a description for people who cannot see a picture, a transcript for a recording or video, and who can see it. A file a person gave also gets its contribution filing number. A file the sender marked "background only" cannot be filed for everyone. The file stays where it is in the bucket; nothing is copied.

A filed file is served at `/files/<reference>/<name>` with byte ranges, so the browser's own player can play and seek a video or recording stored in the bucket. Everyone can open it once it is filed for everyone, once its embargo date has passed, or, for an essay figure, once its essay is published. Reviewers can always open it, and anyone with comment access to an essay can open its figures while it is a draft, so co-authors see them in the editor. Pictures, sound and video are shown in the browser with a Content-Security-Policy that blocks scripts and with `nosniff`; documents are always downloaded (OWASP File Upload Cheat Sheet, "File Storage Location").

## Comments from the nation

A nation reviewer sees the files people sent that name their nation, as decision record 0038 set out: they comment, and only the project's reviewers file. A file shows up once it has arrived and stays while it is in review or decided. Files that were withdrawn, refused or deleted do not show. The nation reviewer sees the file, what it is, where it came from, how the project may use it, whether the sender asked that the nation see it first, and where it was filed. They do not see who sent it, the reviewers' notes, or the questions and answers between the sender and reviewers, because the sender gave those to the project and not to the nation. A picture is shown as its copy without location details.

A comment from the nation appears on the reviewer's page for that upload, marked as coming from the nation, and is written to the activity log. The sender does not see it. If the lead author lowers a nation reviewer's access to their nation below comment, the page stops showing that nation's files. Comments are stored in `upload_nation_comments`, with the nation each one speaks for (migration `0018_upload_nation_comments.sql`).

## Intake

Intake is for files that go straight to the research library, without a reviewer: what the lead author fetched for the pull list (`research/documents-to-get.md` in project files), and any other document the project should keep (general intake). It is for people with `review-uploads`.

1. The page sends each file like any other, with `pulled: true` and the note in place of the answers (`POST /uploads/pieces`). The upload is marked `from_pull_list` (migration `20261123T2057_add_pulled_uploads.sql`) and kept out of the review queue and its counts.
2. Once the virus check passes, the Worker leaves a note for the intake script in the bucket, `intake/waiting/<reference>.json`, with the file's key, name, size and type and the sender's note.
3. Someone with the bucket keys runs `python3 scripts/captures/mirror_captures.py intake --captures /mnt/project-files/research/captures`. It downloads each waiting file, hashes it with SHA-256, and checks the capture index for the same hash, because people send the same file twice. It reads the first pages of a new file and matches them to an open item of the pull list. A Westlaw print, found by its "For Educational Use Only" line, only matches Westlaw items. Each match suggests a topic, bucket key, record, title and link. A file that matches nothing is general intake, and a person gives it a topic and a name. The plan is written to `research/intake-plan.json` in project files.
4. A person checks the plan and sets each file's action: `file`, `held` (already in the index), `decline` with a reason, or `skip`. Then `intake --apply research/intake-plan.json` copies each file to its key inside the bucket, checks the copy by size, SHA-256 metadata and its bytes, adds the index row, fills the source record's `file` field, and answers the Worker with `intake/filed/<reference>.json` or `intake/declined/<reference>.json`.
5. The next time Intake, Uploads or Your uploads is opened, the Worker settles each answered file (`settlePulledFiles`): a filed one becomes "Filed", with the capture's key as its filed key, and the upload's own copy is deleted, so the bucket holds one copy. A declined one becomes "Not used", with the reason. Before it deletes anything, the Worker checks that the capture key is outside `uploads/` and `intake/` and that the copy there is the same size.

The bucket notes carry everything between the Worker and the script, so the script needs only the bucket keys it already uses, not the database. The person running it then moves the matched items to Done on the pull list and writes the batch up in `research/pull-results/`.

## Essay figures

The essay editor sends a picture, sound recording or video the same way, with `wayIn: "essay-figure"` and the essay's identifier on `POST /uploads/pieces` or `POST /uploads/links`. The writer needs "contribute" access to that essay. Figures skip the queue, because publishing the essay is the review, and are filed with the essay as soon as they arrive.

## Deleting

- Withdrawn files are deleted at once.
- Not used files are deleted 30 days after the decision. The workspace queue does this when it is opened.
- When someone deletes their account (`deleteAccount`, docs/contributor-profiles.md), `forgetAccountUploads` deletes everything they sent that was not filed or kept for reference. Filed and kept files stay, no longer tied to the account.
- Every deletion leaves the upload's record and its activity log entries, so the sender and reviewers can see what happened.

## Database

Migration `20261123T2057_add_pulled_uploads.sql` adds `uploads.from_pull_list`, set for files sent on Intake.

Migration `0018_upload_nation_comments.sql` adds `upload_nation_comments`, the comments from nations. Migration `0010_uploads.sql` adds `uploads`, `upload_pieces` (each piece's size, hash and bucket tag, and what the checks found), `upload_links` (nations an upload is about) and `upload_messages` (questions, answers and reviewers' notes). It also rebuilds the activity log to allow entries about uploads. Every entry keeps its sequence number and fields, so its seal still matches.

## Not built yet

- Email notices to the sender when a status changes. These wait on the project's domain.
- Showing filed files on nation, story and essay pages. Today a reviewer files a file and puts its `/files/` address on the page by pull request or in the essay editor.
- Video in print: a still frame, a caption and a short link or QR code, once the domain exists.

## Sources

- Cloudflare R2, "Use the R2 multipart API from Workers," https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/.
- Cloudflare R2, "Object lifecycles," https://developers.cloudflare.com/r2/buckets/object-lifecycles/.
- Cloudflare Workers, "Limits: Request limits," https://developers.cloudflare.com/workers/platform/limits/#request-limits.
- OWASP, "File Upload Cheat Sheet," https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html.
- YouTube Help, "Embed videos & playlists," https://support.google.com/youtube/answer/171780.
- MDN, "HTTP range requests," https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests.
