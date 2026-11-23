# Sign-in and co-author collaboration

How co-authors sign in, who can do what, how sign-offs are recorded, and how requests from Native nations are handled once they arrive. The public side of requests is specified in [docs/requests.md](../docs/requests.md); this page covers how the website builds it. Everything here is project design unless a source is cited.

## In short

- **Sign-in is the site's own** ([decision record 0024](../docs/decisions/0024-own-sign-in.md)). People sign in with a code sent to their email address, or with a password they chose. No outside sign-in service is used and nobody needs an account anywhere else. The account only proves who someone is. The site's database decides what they may do.
- **Nobody reaches the workspace until the lead author adds them.** There is no open access to the workspace. Anyone with a verified email address may sign in to register as a contributor and keep a profile ([docs/contributor-profiles.md](../docs/contributor-profiles.md), [decision record 0022](../docs/decisions/0022-open-registration-for-contributors.md)).
- **The lead author is the administrator**: full access to everything, and the only person who adds people, changes roles, grants and restricts access to documents, and reads the activity log ([decision record 0023](../docs/decisions/0023-permission-levels-per-document.md)).
- **Readers and requesters never need an account.** The request form at `/requests` works without signing in and without JavaScript (docs/requests.md, principle 5).
- **Essays are edited here; other content changes by pull request.** Essays live in the private bucket and are written, saved and published in the workspace (see [Essays](#essays) and [docs/editing.md](../docs/editing.md)). Every other record still changes only by pull request; for those the workspace records who approved which version, handles requests, and manages access.
- **Secrets live only in Cloudflare** ([decision record 0006](../docs/decisions/0006-secrets-only-in-cloudflare.md)).

## Who can do what

Two layers decide it ([decision record 0023](../docs/decisions/0023-permission-levels-per-document.md)): a **role** for workspace-wide tasks, and a **level on each document**. Both are stored in the database and changed by the lead author, on the People page (`/workspace/people`) and the Access page (`/workspace/access`). Every change is recorded with who made it and when. The rules are in `src/lib/permissions.ts` and `src/lib/server/access.ts` and are checked on the server for every page and every form, reading the database each time; the page only hides buttons a person cannot use.

| Role | Can do | Starts at, on every document |
| --- | --- | --- |
| Lead author | The administrator. Everything below, and adds, changes and removes people, grants and restricts access, reads the activity log, and can remove contributors who signed up. The project always keeps at least one. | Full, always; cannot be restricted |
| Editor | Reads requests and their uploaded files, changes their status, decides them; reads contributor registrations; signs off on content or asks for changes. | Contribute |
| Advisor | Signs off on content or asks for changes, as a project advisor; comments. Does not see requests. | Comment |
| Co-author | Comments. Does not see requests. | Comment |
| Contributor | Works only on what the lead author grants, for example writing one assigned essay. Cannot sign off or publish. | No access |
| Nation reviewer | Reviews one nation's record, for that nation: approves it, asks for changes, or comments. Comments on files people sent about that nation. | No access, except comment and approve on their own nation's record |

### Access to each document

Each person has one of four levels on each document (a nation record, a glossary term, a provision or an essay):

| Level | Allows |
| --- | --- |
| No access | Cannot open the document or see that it is being worked on. |
| Comment | Reads the document and its drafts, and comments. |
| Contribute | Comment, and edits the draft and saves versions of it. |
| Full | Contribute, and restores an earlier version, resolves or hides others' comments, and submits the draft for publishing. |

There is no view-only level: anyone who can open a document can comment on it, because the project wants their feedback. Contribute and full take effect in the website editor (decision record 0021); until it exists, content still changes by pull request.

A person's level on a document is, most specific first:

1. full, for the lead author, always;
2. a grant for that document;
3. a grant for every document of that kind, which also covers drafts that have no file yet;
4. their role's default (table above).

A grant of "No access" is how the lead author keeps someone out of a document their role would open. A grant can have an end date. Changing a grant ends the old one and adds a new one, so the history of who had what stays in the database. Only the lead author grants access; full access to a document does not let a person grant it to others.

The Access page shows an overview (people by role and status, grants in force and about to end, refused attempts in the last 30 days, and whether the activity log is intact), each person's level on each kind of document, and every grant, with a form to grant, restrict or end access.

Code that shows or changes a document calls `requireDocumentLevel(event, database, subject, minimum)` from `src/lib/server/access.ts`, which reads the person's grants fresh and refuses with 403 below the minimum. The website editor's rooms call it before connecting someone and re-check on every saved version, and `onAccessChanged` lets a room disconnect someone whose access was lowered.

Requests are limited to editors and the lead author because they hold requesters' contact details and may describe restricted material (charter, commitment 6).

A nation reviewer is how a nation's own office can approve its record (charter, commitment 4: "sent to nation", "reviewed by nation", "approved by nation"). The approval is recorded in the workspace; the record's `review.status` is then changed by pull request, citing the approval.

## Nation teams

Each Native nation can choose a team of people who keep its own page up to date ([decision record 0041](../docs/decisions/0041-nation-teams-keep-their-own-pages.md)). The rules are in `src/lib/nation-teams.ts`; the database side is `src/lib/server/nation-teams.ts` (migration 0015).

1. **Asking.** A signed-in person asks from `/profile/nation-team`, linked from their profile. They name the nation, their title or office, how the nation chose them (a letter, a resolution, or an office that speaks for it) and the parts of the page, and upload the letter or resolution. The file goes to the private bucket under `nation-teams/<identifier>/proof` and is only ever downloaded, never shown as a page.
2. **Confirming.** The lead author opens the request at `/workspace/nation-teams`, writes to the nation's office using a contact the project already had for the nation (never one the person gave), records which contact, and then confirms the place the office agreed to, with how it was confirmed, or declines with a reason the person sees.
3. **The team.** Everyone on a team sees `/workspace/nation-teams/<nation>`: who is on it, at what level and for which parts, until when, who added them, and the team's activity log.

| Level | On that nation's record | Adds people |
| --- | --- | --- |
| Steward | Full | Yes: up to their own level and parts, for this nation only |
| Editor | Full | No |
| Drafter | Contribute | No |
| Reviewer | Comment, and approves for the nation | No |

- A place is for one nation. The nation comes from the page's address, and every load and form checks the person's own place on that nation, so nobody can add people to another nation's team.
- A place counts as a grant on the nation's record (`grantsOf`), after any grant the lead author made for that person and record, so the lead author can always lower or remove someone's access.
- Every place ends after two years at most. Anyone can leave a team. A steward can end anyone's place on the team except a person the project confirmed directly with the nation's office.
- The lead author can suspend a person together with everyone they added, and everyone those people added.
- Every change is written to the activity log under the target "grant", identifier `nation-team/<nation>`.
- Someone new to the project gets a person record with the "Nation reviewer" role for that nation. If they already have an account, it is linked at once; otherwise when they first sign in with that address.

### Editing the nation's page

A team edits its nation's page at `/workspace/nation-teams/<nation>/edit` (decision record 0041, "Stage 2"). The rules are in `src/lib/nation-page-changes.ts`; the database side is `src/lib/server/nation-page-changes.ts` (migration 0020, table `nation_page_changes`).

| Part | Who | Goes live |
| --- | --- | --- |
| About, in the nation's own words | Drafters write, editors publish | When published |
| A note on courts and dispute resolution | Drafters write, editors publish | When published |
| Statements beside government records (recognition, laws and agreements, jurisdiction) | Drafters write, editors publish | When published |
| Pictures, each with a required description, and an optional caption and credit | Drafters write, editors publish | When published |
| Contacts (office, and email, phone, website or mailing address) | Drafters write, editors publish | 3 days later, or at once when a second editor approves |
| Hiding a part of the page | Any editor, whatever parts their place covers | At once |

- **Who said it.** Facts the project cites to government records are never edited by a nation; its statement is shown beside them. Every addition says "Written by" whoever the change is credited to (the nation's name unless the person types another, such as "Navajo Nation Judicial Branch"), and the date. A person's own name is never shown unless they type it.
- **No pictures by default.** Pages start with none; the project does not choose pictures for nations (the lead author, Nov. 23, 2026). Pictures go to the private bucket under `nation-pages/<nation>/pictures/<identifier>` and are never deleted there. Readers get only the pictures in the live version, at `/nations/<id>/pictures/<identifier>`; the team can see every picture its changes named, at `/workspace/nation-teams/<nation>/pictures/<identifier>`.
- **Versions.** Each publish adds a row; the page shows, for each part, the newest published row whose time to go live has come. Each person keeps one draft per part. An editor can publish anyone's draft (the writer stays recorded), cancel a waiting change, and put an earlier version back from `/workspace/nation-teams/<nation>/changes`. That history is private to the team and the project: nation pages never get a public history.
- **Log.** Every draft, publish, approval, cancellation and restore is written to the sealed activity log under the target "document", identifier `nation-page/<nation>`.

**How the changes reach a prerendered page.** Nation pages are built ahead of time from the records in `content/`, which the Worker cannot read, so the changes are added as the page is sent:

1. The page has empty places marked `data-nation-slot` (top, courts, law, jurisdiction, glance, contacts) in `src/routes/nations/[id]/+page.svelte`. They hold no Svelte content, so hydration leaves what is put in them alone.
2. `/nations/<id>/changes.json` returns the HTML for each place (`src/lib/server/nation-page-overlay.ts`), with everything the nation typed escaped and links limited to https.
3. `tools/add-nation-page-changes.mjs`, the last step of `npm run build`, wraps the built Worker with `tools/nation-page-changes-worker.js` and sets `assets.run_worker_first` to `/nations/*`. For a nation's page it reads `changes.json` and fills the places with `HTMLRewriter` as the page streams out, with an ETag that changes when a different version goes live. Pages of nations with no changes pass through untouched.
4. After a move within the site the page comes from the build, so it fills the places itself from `changes.json` (`src/lib/nation-page-slots.ts`).
5. Hiding works by a style in the top place, so a hidden part disappears at once; the project removes it from the site's files when it follows up. A reader's device always asks for a nation's page, its `changes.json` and its pictures again when it is online, and never saves a nation's pictures (`src/service-worker/index.ts`), so a hidden part or an undone change is gone the next time the page is opened; the saved copy answers only offline. Nations' changes stay in the database and are never copied into git, whose history is public and permanent, so a nation can always take its words back (the lead author, Nov. 23, 2026). The print edition shows the cited records only.

**Claimed or unclaimed, like a map listing** (the lead author, Nov. 23, 2026). A nation's page says "Unclaimed" until someone the project confirmed with the nation's office has a current place on its team (`claimOf` in `src/lib/server/nation-teams.ts`); then it says "Claimed by the nation" and when. The build always writes the "Unclaimed" line (marked `data-build-status`) with a "Claim this page" link to `/profile/nation-team?nation=<id>`; for a claimed page the top place hides it and shows the claimed line instead.

**Problem reports go to the team too.** A report about a claimed page that asks for a correction, asks a question or offers material appears for the nation's team on its edit page, with where and what was reported but never who sent it; requests to restrict or remove material stay with the project. An editor answers "Fixed on the page" or "No change needed", with an optional note, which goes into the report's own history (table `nation_team_report_answers`). The project still sees every report, and its Requests list shows the team's part: with the team, the team's answer, or no answer in 7 days, when the project steps in (`src/lib/nation-team-reports.ts`). The report form tells the sender this.

**The project's review** (stage 3). A nation's changes go live without waiting for the project, so the project reads each one afterwards on `/workspace/nation-pages` ("Nations' changes"; permission `review-nation-pages`, held by the lead author and editors), oldest first, within 7 days. The workspace overview counts what waits and what is past 7 days. For each change the reviewer can:

- **Mark read**, leaving it as it is.
- **Undo** it, with a note. The change is set aside and the page goes back to the version before it; the team's history shows it as "Undone by the project" with the note, and the team cannot put it back by restoring.
- **Pause and ask.** Publishing for the nation stops until the project resumes it, and the team sees the question at the top of its edit page and answers there. Drafts, cancelling a waiting change and hiding keep working, so a nation can always take something off its page.
- **Suspend** the person who published it, with everyone they added (the lead author only, as on the team page). Their changes stay until undone.

Reviews and pauses are in `nation_page_reviews` and `nation_page_pauses` (migration 20261123T0438_add_nation_page_review.sql); the rules are in `src/lib/nation-page-review.ts` and the storage in `src/lib/server/nation-page-review.ts`. Every step goes into the sealed activity log under `nation-page/<nation>`.

**In Recent changes.** Each change a nation's team published is listed at `/changes` once it is live, under the nation's page, with the part of the page it changed and the name the team gave on the page, never the words, like every nation page change. The project's undo takes it off the list. The "Who" filter has "Nations' teams" once there is one.

Still to build: emails to a nation's office about changes, and notices to people following the page. Teams open to nations once the project domain can send email.

## Essays

Essays are kept in the private `sourceDocuments` bucket and edited at `/workspace/essays` ([decision record 0021](../docs/decisions/0021-edit-drafts-in-the-browser-keep-essays-in-the-bucket.md), [docs/editing.md](../docs/editing.md)).

- **Levels.** Comment access lets a person read every saved version and compare them. Contribute access lets them edit and save versions. Full access also lets them publish a version, restore an earlier one as a new version, hold a publication back from readers, save the git text over edits made here, and start a new essay (full access to every essay). Each page and action checks the level on that essay with `requireDocumentLevel`, as every workspace page does.
- **Versions never change.** Each save writes a new file, `essays/<id>/versions/<number>-<first 12 characters of the SHA-256>.md`, refused if the name is taken (`If-None-Match: *`), and adds a row to `essay_versions` and an entry to the activity log. Database triggers refuse any change to a saved version or deletion of one. A save names the version the writer started from; if someone saved after that, the save is refused and the editor shows both, so nobody's text is lost.
- **Publishing** makes a saved version the essay's page. Before publishing, the site renders the version and refuses it if a citation key or glossary link points to nothing. A publication can be held back from readers (with a reason, for the log), for example while a nation's request is reviewed; it is never deleted.
- **Pages.** The Worker renders essay pages on request from the newest listed publication (`/foundations/<id>` for Part I, `/essays/<id>` for the rest) and caches the result for each file and site build. Earlier publications stay readable from the page's version list.
- **Git copy.** `/published-essays.json` lists every listed publication with its SHA-256, and `/published-essays/<id>/<number>.md` serves each one. The hourly workflow `.github/workflows/copy-published-essays.yml` copies new ones to the `published-essays` branch.
- **Live editing.** Several people can edit an essay at once in a live editing room: one Durable Object per essay (`EssayRoom`, `src/lib/server/live/essay-room.ts`) in its own Worker, `model-tribal-adr-code-live` (`live/wrangler.jsonc`), so the website's deploys do not close people's connections. The room starts from the newest saved version, keeps every change in its own storage, and saves one version after each pause with the note "Edited live by" and the editors' names, through the same `saveVersion` as the editor's Save. If someone saved a version another way meanwhile, the room combines the two paragraph by paragraph. Comment access can read along; contribute or full access can type. The live Worker has no public address and deploys with its own Workers Builds project: root directory `site/live`, build command `cd .. && npm ci`, deploy command `npx wrangler deploy`, with build watch paths `site/live/*`, `site/src/lib/server/live/*`, `site/src/lib/essays/*`, `site/src/lib/server/essays.ts`, `site/src/lib/server/events.ts`, `site/src/lib/server/identifiers.ts` and `site/package-lock.json`. The website reaches the rooms through its `essayRooms` binding: the browser opens a WebSocket to `/workspace/essays/<id>/live`, which `src/hooks.server.ts` hands to `src/lib/server/live-editing.ts` before SvelteKit routes it. That file checks the Origin header, the session and the person's level on the essay, then passes the connection to the room with the person's name and level. The browser side is `joinEssayRoom` in `src/lib/essays/live.ts`. To try it on a computer, build the site, then run `npx wrangler dev -c .svelte-kit/cloudflare/worker/wrangler.json -c live/wrangler.jsonc`.
- **Text from git.** Essay text merged in `content/essays/` is saved here by itself after each build, as a new draft version, merged paragraph by paragraph with edits made here since (docs/editing.md, "Text from git comes in by itself"). Only a paragraph changed both here and in git waits for a person, on the Essays page.

## Reviews and sign-offs

`/workspace/reviews` lists the documents the person can open: nation records that are not restricted (including records held back until the nation approves them), glossary terms and essays. Provisions join the list when their records exist. Anyone who can open a document can comment on it; only the lead author, editors and advisors sign off for the project, and only a nation reviewer, on their own nation's record, approves for the nation. The list is built with the site, so it always matches the deployed content.

A review is one of **Approved**, **Changes requested** or **Comment**, with a note. It records:

- the person and the capacity they reviewed in (lead author, editor, advisor, co-author, or "for the nation"), kept even if their role changes later;
- the version it applies to: the content version and, when Workers Builds built the site, the commit (for example `content 0.0.3, commit 1a2b3c4d5e6f`).

So when the text changes later, it is clear which approvals came before the change.

## Protection against unauthorized changes

Every request that changes something in the workspace passes these checks, in order (`src/hooks.server.ts`):

1. **From this site's own pages.** A change sent from another site is refused, using the browser's `Sec-Fetch-Site` header, or `Origin` where that is missing (`src/lib/server/request-guard.ts`). This is a second, independent check beside SvelteKit's own check on form submissions, and the session cookie is `SameSite=Lax`. (OWASP, *Cross-Site Request Forgery Prevention Cheat Sheet*; Svelte, *SvelteKit configuration: csrf*.)
2. **Not too many.** Each signed-in person may make 30 changes a minute (the `workspaceChangeLimit` binding in `wrangler.jsonc`, keyed by the person rather than the address, as Cloudflare recommends). Refused page views count too, so they cannot flood the log. (Cloudflare, *Rate Limiting*.)
3. **Allowed.** The page or form checks the person's role or document level from the database. A refusal is answered with 403 and recorded in the activity log with what was tried. (OWASP, *Authorization Cheat Sheet*; OWASP Top 10, *A01:2021 Broken Access Control*.)

Content on the public site changes only by pull request, so any change can be reverted with git; drafts in the website editor keep named versions that someone with full access can restore.

## Activity log

`/workspace/activity` (lead author only) lists everything done in the workspace, newest first, filtered by kind or person: invitations, role and access changes, reviews, requests, saved document versions, contributor profile changes, and refused attempts.

- **Entries cannot be changed or deleted.** The database refuses (triggers in `migrations/0002_permission_tiers.sql`).
- **Entries are sealed.** Each entry's seal is the SHA-256 hash of the entry and the seal before it, so changing, removing or reordering an entry breaks every seal after it (`src/lib/server/activity-seals.ts`; Schneier & Kelsey 1999). New entries are sealed after each change, and the whole chain is checked each time the Access or Activity page opens. The result shows on both pages and on the Overview.
- **What it cannot do.** Someone with full control of the Cloudflare account could remove the rules and write a new, consistent chain. To catch that, the Activity page shows the latest seal and offers the whole log with its seals as a download; keep a copy now and then somewhere outside Cloudflare. D1 Time Travel can restore the database to an earlier minute (Cloudflare, *Time Travel and backups*).
- **Personal details.** Because entries cannot be edited, do not put a requester's contact details in request notes: the 12-month deletion of personal details (docs/requests.md) cannot reach the log.

OWASP recommends logging access-control failures and protecting logs from tampering (OWASP, *Logging Cheat Sheet*; NIST SP 800-92).

## Address book

`/workspace/address-book` (lead author only, permission `manage-address-book`) is the project's private list of contacts: each Native nation's government as an organization, the leader the federal Tribal Leaders Directory names for it, and anyone else the project writes to. The lead author asked for it on Nov. 23, 2026 ("We should have internal contacts, so that csv becomes the basis of our address book"; "Maintain this list in the server with knowledge or source and up to dateness"). Nothing in it is shown on the public site.

- **Tables** (`migrations/0012_address_book.sql`): `contacts` (person or organization, linked to a nation and, for a person, to the organization they act for), `contact_methods` (emails and phones), `contact_tags`, and `contact_changes`, which keeps every change with the row as it was. Leaders' own addresses live only here and in the private outreach list in project files, never in the repository (lead author's decision, Nov. 23, 2026).
- **Where each address came from.** Every email and phone records the kind of source, such as the nation's website or the federal directory, and the page it was read on. It also records the first day it was recorded and the last day it was seen there.
- **When an address needs checking** (`src/lib/address-book.ts`): a leader's or state-listed address after 180 days, any other after a year, and any address once the nation's next election, as the federal directory gives it, has passed since the last check. The rule is worked out when the page is read, so it can change without a migration.
- **Checking against the directories.** The site rereads the federal and Alaska directories every Monday at 09:41 UTC, and whenever the lead author presses "Check now". The Monday run is a cron trigger in `wrangler.jsonc`, passed to `/address-book/scheduled` the same way as the hourly following run. An email still listed counts as checked that day; one no longer listed is marked replaced, and the address now listed is added to the same contact with a note naming who holds it. Addresses read on a nation's website are marked checked by hand on the contact's page.
- **Keeping in step with the nation pages** (lead author's choice, Nov. 23, 2026). The nation profiles stay the published, cited record. The Differences page (`/workspace/address-book/differences`, `src/lib/address-book-sync.ts`) lists office emails and phones that only the pages show, that only the book holds, or that a page still shows after the book marked them out of use. Page-only ones are brought into the book by a button there and by "Check now"; the others are fixed by a pull request to the profile, using the page's CSV download. Leaders' addresses are never compared, since they never go on a page.
- **Mailing list.** `mailingList()` in `src/lib/server/address-book.ts` gives one email per contact (the first choice in use, each address once), and the page offers it as a CSV download. Mail code marks a hard bounce with `editContactMethod()`, status `bounced`. Unsubscribes are kept by the mail code, not here: retiring an address is not an unsubscribe.
- **Seeding.** `scripts/outreach/import_address_book.py` turns the private outreach list and the two directories into SQL that is loaded into D1 directly; the SQL is never committed.

## Requests from nations

The form at `/requests` follows docs/requests.md step by step, with a branch for adding a nation that is missing. Each request gets a reference such as `20261121-K7QX3M` (the date, then six characters from Crockford's base 32, which leaves out I, L, O and U so a reference read aloud is hard to get wrong).

In the workspace, `/workspace/requests` lists requests with the project's own targets from docs/requests.md: acknowledge within 7 days, hide material named in a restrict or remove request within 7 days, decide within 30 days of acknowledging. A request's page shows its details, its proof and uploaded files, and its history, and lets an editor change its status, add notes, resolve it (a declined request needs the reasons given to the requester) or reopen it.

**Hiding material is still done by pull request.** Setting a request to "Hidden, pending review" records when that was done; the change itself is a pull request that sets `sensitivity.tribal_review_required: true` or `sensitivity.restricted: true`, with a commit message that does not repeat the material.

**Uploads** are kept in the private `sourceDocuments` bucket under `requests/`. The form accepts PDF, PNG, JPEG and WebP files up to 10 MB, checked by their first bytes rather than their names, and the workspace only ever offers them as downloads, so an uploaded file cannot run as a page of the site.

**Personal details** (name, role and contact) are deleted 12 months after a request is resolved, unless the person asked to be credited (docs/requests.md). This runs whenever an editor opens the request list, so no scheduled job is needed.

**Spam.** The form has a hidden field that people never see and bots tend to fill in, and Cloudflare limits each connection to five submissions a minute (the `requestFormLimit` binding in `wrangler.jsonc`). Neither asks the requester to make an account or solve a puzzle.

## Forms

The Forms page (`/forms`) lists the contributor forms in `docs/contributor-forms/` and the model forms in `content/forms/` (docs/contributions.md, "On the website"). At build time `src/lib/server/form-catalog.ts` turns each Markdown file into a template: the form as HTML with a token where each field goes, the same Markdown with the tokens, the list of fields with their labels, and the file's SHA-256. The templates reach the Worker as the `virtual:forms` module, because the form pages answer forms sent to them. `src/lib/forms.ts` fills a template in three ways: fields to fill in online, lines to fill in by hand (`/forms/<form>/print`, built ahead of time), and the answers as text.

A contributor form sent from `/forms/<form>` opens a request (kind `contribute`, or `restrict` for a change or withdrawal) with a row in `form_submissions`: the form, version, checksum, how it was signed, the typed name and the answers. Signed online, it also gets a filled copy in the bucket at `forms/<request>/<submission>.md`. Uploaded, the photos or scans are files of the request in `request_sources`, checked like any upload. Both ways use the hidden field and the `requestFormLimit` rate limit. A request with a form keeps its personal details after it is resolved.

On the request's page in the workspace, editors see each form, open the filled form (while the site still has that exact version), download the stored copy, and file the forms under a filing number, which is logged.

## Files people send

Anyone signed in can send files on `/uploads/send` and follow them on `/uploads` (Your uploads, also under Your account in the left sidebar). The lead author and editors review them on `/workspace/uploads` (permission `review-uploads`). Files arrive in 10 MB pieces into the private bucket under `uploads/<identifier>/`, are checked by type and for hidden content as they arrive, and wait for a reviewer, who files them, keeps them for reference, or says why they were not used. A YouTube link can stand in for a video. Filed files are served at `/files/<reference>/<name>`. The code is in `src/lib/uploads.ts`, `src/lib/server/uploads.ts`, `src/lib/server/upload-checks.ts` and `src/lib/server/upload-serving.ts`; the design is docs/uploads.md and decision record 0038. A nation reviewer reads and comments on the files that name their nation on `/workspace/nation-uploads` (permission `comment-on-nation-uploads`); they never see who sent a file.

## Virus and malware scanning

Files people send and email attachments are held until a virus scan says they are clean. Site code puts a file in line with `requestScan` and serves it only when `mayServe` says yes (`src/lib/server/file-scans.ts`); the scanner, a Worker of its own (`model-tribal-adr-code-scanner`, `scanner/wrangler.jsonc`), scans waiting files with ClamAV, YARA rules and structural checks in a Cloudflare Container and writes the results to the `file_scans` table. The provider is a setting. Everything about it, including how to set it up, is in SCANNING.md; the choices are decision record 0046.

## How sign-in works

The "Sign in" button in the masthead of every page opens a panel under it with the same forms as `/sign-in`, so people sign in or create an account without leaving the page they are reading, and come back to it afterwards (Trevor, Nov. 23, 2026; `src/lib/components/AccountLink.svelte` and `SignInForms.svelte`). The panel's forms post to `/sign-in` like the page's, and before it shows them it asks `/sign-in/options` whether codes can be sent. Without scripts, and on the sign-in pages, the button is a link to `/sign-in`. "Co-author sign-in" in the footer goes to the page. The design follows the lead author's Grimbinder project (`worker/account/` there).

1. **A code by email.** At `/sign-in` the person types their email address. The site emails a six-digit code and a link through Cloudflare Email Service (`src/lib/server/sign-in-email.ts`). Typing the code, or opening the link and pressing "Sign in", signs them in. The first time, this also makes their account (`src/lib/server/accounts.ts`). A code:
   - works once, for 15 minutes, and only the newest one for an address works;
   - stops working after 5 wrong tries;
   - is kept in the database only as a SHA-256 hash, like the link.
2. **A password, if they chose one.** Anyone signed in can choose a password at `/profile/password`; it is optional. The rules follow NIST SP 800-63B-4, section 3.1.1.2, for a password that is the only factor:
   - at least 15 characters and at most 256, counted as Unicode code points after NFC normalization, with any characters and no forced mixing of character types;
   - the whole password is refused if it is the person's email address, the name part of it, or a name of this site, compared without spaces, punctuation or capitals; one or two characters repeated are refused too (`src/lib/server/password-checks.ts`);
   - passwords seen in data breaches are refused. The check uses Have I Been Pwned's Pwned Passwords range service. Only the first five characters of the password's SHA-1 hash leave the Worker, and the answer is padded, so the service never learns the password or whether it was found (Have I Been Pwned, ["API v3: Searching by range"](https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange)). If the service cannot be reached in 4 seconds the password is allowed and the miss is logged.

   Passwords are stored as salted PBKDF2-SHA256 hashes with 600,000 iterations, the number OWASP recommends (OWASP, ["Password Storage Cheat Sheet"](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). Workers allow at most 100,000 iterations in one call (Cloudflare, ["Web Crypto"](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)), so the hash is six calls chained, each fed the last one's output. Argon2id, OWASP's first choice, would need WebAssembly compiled at build time, which this project does not have. When the `PASSWORD_KEY` secret is set, the hash then goes through HMAC-SHA256 with that key, so a copy of the database alone is not enough to start guessing (NIST SP 800-63B-4, section 3.1.1.2). Older hashes (100,000 iterations, no key) still work and are upgraded the next time their owner signs in (`password_keyed` in `accounts`).

   A wrong password gets the same answer whether or not the address has an account, so the form cannot be used to find out who has signed up. Wrong passwords are counted for each address, whether or not it has an account (`password_failures`, migration `20261123T0445_harden_password_sign_in.sql`). After 10 in a row, password sign-in for the address pauses for 15 minutes, then twice as long each time, up to a day. After 100 in a row it stays off until the owner signs in with a code or a link and chooses a new password (NIST SP 800-63B-4, section 3.2.2). Codes and links keep working during a pause. A right password, or a new one, clears the count. Wrong current passwords on `/profile/password` count toward the same limit.

   Changing or removing a password needs the current one, except within 10 minutes of signing in with a code or a link, which already proves who the person is. That is how a forgotten password is replaced: "Forgot your password?" (`/sign-in/forgot`) sends a code and then opens the password page. Changing a password signs out every other browser.
3. **Create an account.** "New here? Create an account" (`/sign-in?create`, or in the panel) asks for an email address and a password, checked by the same rules. Nothing is made yet: the code and link go to the address, with an email that says they are for a new account, and the password waits beside them, already hashed (`new_password_*` in `sign_in_codes`, migration `20261123T1950_add_account_creation.sql`). Typing the code or using the link makes the account with that password and signs the person in, so every account still starts with a confirmed address (Trevor, Nov. 23, 2026: "must confirm email before they can use account features"). The waiting password goes when the code is used, replaced or expires, and it never replaces the password of an account that already has one. The answer is the same whether or not the address has an account, so the form cannot be used to find out who has signed up. Create an account shows only when the site can send email; until then new people need a link from the lead author.
4. **A link from the lead author.** On the People page the lead author gets a one-time sign-in link for each person they invite, to send them personally. It works once, for 7 days, only for someone who has never signed in, and making one is recorded in the activity log. After using it, the person goes straight to the password page, where they can choose one or skip to the workspace.
5. **Limits.** Each email address may try each step 5 times a minute, and each network address 30 times (`wrangler.jsonc`, `signInLimit` and `signInNetworkLimit`).
6. **Matching to a person.** After sign-in the site matches the account to a person (`src/lib/server/people.ts`):
   - someone who has signed in before, by their account;
   - someone signing in for the first time, by their email address. Every account has proved it receives mail at its address, so nobody can claim an invitation by typing someone else's address;
   - the very first lead author, by the `LEAD_AUTHOR_EMAIL` setting.

   Anyone else stays signed in and goes to their contributor profile (`/profile`), where they can register to help. The workspace stays closed to them. Someone whose access was removed is not signed in.
7. **The session** is a random 256-bit token in an HTTP-only, SameSite=Lax, Secure cookie named `__Host-session`, which browsers refuse to accept from a subdomain or over plain HTTP (NIST SP 800-63B-4, section 5.1). The database keeps only its hash (`sessions` table). It lasts at most 12 hours and ends after 4 hours without use. Someone without workspace access may tick "Keep me signed in for 30 days" when they sign in. Their session then lasts 30 days, unused or not, the longest NIST SP 800-63B-4 allows between sign-ins at its first level. Workspace sessions never get this, and a 30-day session from before someone was given workspace access ends at the 12-hour and 4-hour limits. "Sign out" deletes it.
8. On every workspace page the site checks the database again, so removing someone's access takes effect at once, even if they are signed in.
9. The masthead's link reads "Workspace" instead of "Sign in" while a `signed-in-hint` cookie is present (`src/lib/signed-in-hint.ts`). It holds only "1", is readable by the page's script because public pages are built ahead of time and cannot ask the Worker, and grants nothing: it is set at a successful sign-in and on each workspace page while the session is valid, and cleared at sign-out or once the session has ended.

Workspace pages, sign-in and the request form are never cached, by the browser or by the offline copy (`src/service-worker/index.ts`), and cannot be shown inside another site's frame.

On a copy of the site running on your own computer (`npm run preview`, `localhost`), no email is sent: the code and link are shown on the sign-in page instead.


## Two-step sign-in

Anyone may turn on two-step sign-in at Account > Sign-in and security > Two-step sign-in (`/account/security/two-step`). The lead author, editors, advisors and nation reviewers must: until they set it up the workspace sends them to that page and stays closed (`rolesNeedingTwoStep` in `src/lib/permissions.ts`; `requirePerson` in `src/lib/server/workspace.ts`). Co-authors and contributors may choose it.

1. **The authenticator app.** Setting up shows a QR code and the same key as text. Any authenticator app that reads the usual "otpauth" QR code works, such as Google Authenticator, Microsoft Authenticator or a password manager. The app makes a six-digit code every 30 seconds (RFC 6238 with SHA-1; `src/lib/server/two-step.ts`). Typing one code confirms the app works; the site then turns two-step sign-in on and signs out every other browser.
2. **Signing in.** After the password, or the code or link from an email, the site asks "Confirm it is you" (`/sign-in/two-step`). Until a right code is typed, the session reaches nothing else. A code works for the 30 seconds before and after its own, so a phone clock a little off still works, and never twice (NIST SP 800-63B-4, section 3.1.4.1). After 5 wrong codes that sign-in ends and the person starts again; each account may also try 5 times a minute (`signInLimit`).
3. **Backup codes.** Turning it on gives 10 backup codes, shown once, kept only as SHA-256 hashes. Each works once in place of an app code. Someone who signs in with a backup code and has 3 or fewer left is sent to make new ones. Making new ones stops the old ones working.
4. **The app's secret** has to be kept, not hashed, because the site makes the same codes as the app. It is encrypted with AES-GCM under a key derived (HKDF) from `PASSWORD_KEY`. Until `PASSWORD_KEY` is set, the app's secret is kept as it is, and encrypted the next time it is used after the key is set.
5. **Changes need a fresh sign-in.** Turning it on, making new backup codes, moving to a new phone and turning it off all need a sign-in from the last 10 minutes. That way someone who finds a browser left signed in cannot add their own app or take the owner's away. Those whose role needs it cannot turn it off, only move it to a new app.

**Lost phone and backup codes.** The lead author turns two-step sign-in off for that account from the database, which leaves its password and email sign-in as they were. The person then sets it up again at their next sign-in. For the lead author's own account, someone with access to the Cloudflare account runs the same command:

```sql
UPDATE accounts SET authenticator_secret = NULL, authenticator_new_secret = NULL, authenticator_added_at = NULL, authenticator_last_step = NULL WHERE email = 'person@example.org';
DELETE FROM backup_codes WHERE account_identifier = (SELECT identifier FROM accounts WHERE email = 'person@example.org');
```

Passkeys, which resist phishing better than any code (NIST SP 800-63B-4, section 3.2.5), come once the site has its own domain, because a passkey is tied to the domain it was made on.

## Setting up sign-in

Three settings. The site works without the first and the third.

### 1. The address codes come from

Cloudflare Email Service sends only from a domain onboarded in Email Service on the same Cloudflare account (Cloudflare, ["Send emails"](https://developers.cloudflare.com/email-service/get-started/send-emails/)). The workers.dev address cannot send email.

1. Cloudflare dashboard > **Compute > Email Service > Email Sending** > **Onboard Domain**, and choose the domain. Cloudflare adds the DNS records it needs (SPF, DKIM, DMARC and bounce handling).
2. In `site/wrangler.jsonc`, set `SIGN_IN_EMAIL_FROM` under `vars` to an address on that domain, such as `sign-in@example.org`, and merge the change. The address is not secret.

Until this is done, the site sends no email. People sign in with a password, or with a link from the lead author, and `/sign-in` says so.

### 2. The first lead author

Worker `model-tribal-adr-code` > **Settings > Variables and Secrets** > **Add**, type **Secret**: `LEAD_AUTHOR_EMAIL`, the lead author's email address. It is set in the dashboard rather than in `wrangler.jsonc` only because that file is public. It must be the **Secret** type even though an email address is not really secret: each deploy replaces plain-text variables set in the dashboard with the ones in `wrangler.jsonc`, but never deletes secrets (Cloudflare, ["Wrangler configuration: source of truth"](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)).

### 3. The password key

Worker `model-tribal-adr-code` > **Settings > Variables and Secrets** > **Add**, type **Secret**: `PASSWORD_KEY`, a random value of at least 32 characters, such as the output of `openssl rand -base64 48`. Keep no copy outside Cloudflare. Once set, never change or remove it: every password hashed with it, and every authenticator app set up after it, would stop working, and their owners would have to sign in with a code or a link and choose a new one. Until it is set, passwords are hashed without a key, and the site upgrades them the next time each person signs in after it is set.

### Database

The tables are created by the files in `migrations/`. Workers Builds does not run them, because its automatically created API token does not include D1 permission (Cloudflare, ["Workers Builds configuration: API token"](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)). Apply them once per new migration, from `site/` (migration 0002 adds access levels and the sealed activity log; apply it before deploying the code that uses it):

```sh
npm run database:migrate:remote   # wrangler d1 migrations apply database --remote
```

Wrangler records which migrations ran, so running it again is safe. For the copy used by `npm run preview`, use `npm run database:migrate:local`. To write a new migration, run `npm run database:new-migration -- "what it does"`; new files are named for the UTC time and what they do, such as `20261123T0430_add_file_scans.sql` ([migrations/README.md](migrations/README.md)).

### First sign-in

Open `/sign-in`, enter the `LEAD_AUTHOR_EMAIL` address and ask for a code. If the site cannot send email yet, someone with access to the Cloudflare account can make a one-time link from `site/`:

```sh
npm run sign-in-link -- lead@example.org   # works once, for one hour
```

The same command helps anyone who has lost both their password and access to their email.

The Workspace group in the left sidebar has a People page, where co-authors, advisors, editors, contributors and nation reviewers are added by email address, and an Access page, where their level on each document is raised or lowered. Each person signs in at `/sign-in` with that address, or with the link the People page gives you for them. Their access starts at their first sign-in.

## Database

The tables are created by the files in `migrations/`. Workers Builds does not run them, because its automatically created API token does not include D1 permission (Cloudflare, ["Workers Builds configuration: API token"](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)). Apply them once per new migration, from `site/` (migration 0002 adds access levels and the sealed activity log; apply it before deploying the code that uses it):

```sh
npm run database:migrate:remote   # wrangler d1 migrations apply database --remote
```

Wrangler records which migrations ran, so running it again is safe. For the copy used by `npm run preview`, use `npm run database:migrate:local`. To write a new migration, run `npm run database:new-migration -- "what it does"`; new files are named for the UTC time and what they do, such as `20261123T0430_add_file_scans.sql` ([migrations/README.md](migrations/README.md)).

### First sign-in

Open `/sign-in` and sign in with the `LEAD_AUTHOR_EMAIL` address. The Workspace group in the left sidebar has a People page, where co-authors, advisors, editors, contributors and nation reviewers are added by email address, and an Access page, where their level on each document is raised or lowered. Tell each person to sign in at `/sign-in` with that address; their access starts at their first sign-in.

## Database

`migrations/0001_sign_in_and_collaboration.sql`:

| Table | Holds |
| --- | --- |
| `people` | Who may sign in, their role, and for a nation reviewer the nation. Rows are never deleted, so earlier reviews keep their author. |
| `access_grants` | Each person's level on a document or a kind of document, with who granted it, when, until when, and when it ended (`migrations/0002_permission_tiers.sql`). |
| `reviews` | Sign-offs and comments, with the content version. |
| `requests` | Requests from the form, their status, outcome and targets. |
| `request_sources` | Proof for adding a nation, and other uploaded files. |
| `form_submissions` | Forms sent from the Forms pages: which form and version, how it was signed, the answers and the filing number (`migrations/0007_form_submissions.sql`). |
| `events` | The activity log: who did what and when, numbered in order. Cannot be changed or deleted. |
| `event_seals` | The seal of each activity log entry, chained to the one before. |
| `follows`, `page_updates`, `page_fingerprints`, `following_checks`, `follow_settings` | Pages each account follows, when each followed page changed, the last fingerprint of every page that can be followed, which build was compared last, and each account's email choice (`migrations/0011_following.sql`; see Following pages). |
| `account_settings` | The copy of a person's display settings and theme, kept only while they chose "Use these settings on every device I sign in on" (`migrations/0019_account_settings.sql`; see Account pages). The same migration adds `sessions.device`, a few words such as "Firefox on Windows" for the list of places a person is signed in. |
| `page_changes`, `page_states`, `page_history_checks`, `hidden_changes` | Each change to a page built with the site, the last version seen of each such page, which build was compared last, and the parts of changes the lead author hid (`migrations/0017_page_changes.sql`; see Recent changes). |

`migrations/0003_contributor_profiles.sql` adds contributor profiles, their nations, interests and confirmed versions; see [docs/contributor-profiles.md](../docs/contributor-profiles.md).

Status and outcome values are the words docs/requests.md uses (`hidden-pending-review`, `declined` and so on), so the documentation and the database match.

## Following pages

Anyone signed in can follow a nation's page, the model code or one of its sections, or an essay, and is told when it changes (decision record 0035; Trevor asked for it on 2026-11-23). The rules shared by the browser and the Worker are in `src/lib/following.ts`; the database side is `src/lib/server/following.ts`.

- **Following.** The Follow button (a bell, after Star in the masthead, `src/lib/components/FollowButton.svelte`) asks `/following/state` whether the reader follows the page, and posts there to follow or stop. Pages are built ahead of time, so it asks only when the signed-in hint says someone is signed in. A signed-out reader gets a dialog that offers sign-in and comes back to the page. One account can follow up to 1,000 pages, and following counts against the same per-minute limit as workspace changes.
- **Finding updates.** When the site is built, `src/lib/server/followable-build.ts` fingerprints each nation page from its published record (as its JSON download gives it; only the name and status for a page withdrawn at the nation's request) and its documents' version histories, and bundles the list into the Worker as `virtual:followable-pages`. An essay's fingerprint is the text of its newest listed publication. `checkForUpdates` compares both with `page_fingerprints` and adds a row to `page_updates` for each changed page that someone follows. The first comparison, and one after `fingerprintVersion` is raised, only records fingerprints. A newer build is claimed with a random token in `following_checks`, and only statements carrying that token write, so two copies of the Worker never record an update twice, and an older build still answering during a deploy is ignored.
- **When the checks run.** Every hour at 17 minutes past (`triggers` in `wrangler.jsonc`), on the first signed-in request a new build answers, and right after an essay is published or held back in the workspace. The SvelteKit adapter makes only a fetch handler, so `tools/add-scheduled-run.mjs` (the last step of `npm run build`) adds a `scheduled` handler that passes the run to `/following/scheduled` inside the same copy of the Worker, with a token only that copy holds (`src/lib/server/scheduled-run.ts`). The address refuses every other request.
- **Notices.** The Following page (`/following`, under Your account in the left sidebar, which shows the number of new updates) lists updates newest first and the pages followed, and links to the email choice, which is on the Account pages under Email and notifications (`/account/email`). A notice names the page by its title on the live site and says only that it was updated, and when. The database stores no text or title, so a notice can never show words a nation asked to have removed or restricted. Essays and, once built, the model code also link to "What changed"; nation pages have no public version history.
- **Email.** Each account chooses no email, a daily summary (the default) or a weekly one. The hourly run sends what is due through the `updateEmail` binding from `UPDATE_EMAIL_FROM`, with links built from `SITE_ADDRESS` (`src/lib/server/following-email.ts`). While `UPDATE_EMAIL_FROM` is empty nothing is sent, and the Following page says so. An email lists each changed page's title, kind, day and link, and ends with "Stop these emails", a link to `/following/email-off` with the account's own random token (kept as it is, since it can only turn emails off and must keep working in older emails). The page asks for a button press, so a mail program that opens links to scan them cannot turn emails off. The link is also in the `List-Unsubscribe` header.

### Turning on the emails

Once the domain is onboarded in Email Service (see "Setting up sign-in"), set `UPDATE_EMAIL_FROM` in `site/wrangler.jsonc` to an address on it, such as `updates@` the domain, and `SITE_ADDRESS` to the site's address on the domain, and merge the change. Nothing else changes: summaries go out at the next hourly run to everyone whose choice is daily or weekly. Readers who followed pages before then were told on the Following page that emails would start once the site could send them.

## Events

The project lists talks, panels, workshops and gatherings at `/events`, and people sign in to register (decision record 0048; Trevor chose this first phase on 2026-11-23). The page lists what is happening now under "Current events", with the public video rooms open now, above "Upcoming events", where public rooms planned for later are listed too (Trevor, 2026-11-23); past events are a second view. Continuing legal education credit and paid tickets come later. The rules shared by the pages and the emails are in `src/lib/event-calendar.ts`; the database side is `src/lib/server/event-calendar.ts`, and the tables are in `migrations/20261123T0450_add_event_calendar.sql` (named `calendar_*`, because `events` is the activity log).

- **Running events.** The lead author and editors hold the `manage-events` permission and see Events in the workspace (`/workspace/events`). A new event is a draft that only they can see, at its own address as a preview. On the event's workspace page they add kinds of seat (such as "In person" with a limit of 40 and "Online" with no limit), add speakers, publish, and see who is coming, with a CSV download for the list at the door. An event with no kinds of seat takes no registration, and its online link is shown to everyone. An event someone registered for can only be cancelled, not deleted or turned back into a draft, so the people registered are told. Each change in the workspace is in the activity log like any other.
- **Times.** An event is held in one time zone, chosen from every zone in the United States, and its times are shown in that zone, such as "9:00 AM to 12:15 PM Pacific time". The form takes the date and clock time where the event is held; the database keeps UTC.
- **Registering.** A signed-in reader picks a kind of seat, gives the name for the list, may say what they need to take part, and chooses whether to get reminders. The seat count and the new row are one database statement, so two people cannot take the last seat. When the seats are taken, people join that seat's waitlist. A freed seat (someone cancels, or the limit is raised) is offered to the person waiting longest and held for 48 hours, or until the event starts if sooner; a newcomer cannot take it while the offer stands. An offer that runs out lapses and passes to the next person.
- **The online link** is shown on the event page only to people registered for an online seat, and is never in the calendar files, which anyone can download.
- **Calendar files.** `/events/<address>/calendar.ics` holds one event and `/events/calendar.ics` every event from the last 90 days on, for calendar programs to subscribe to. A change of time or place raises the event's sequence number, so calendars replace their copy, and a cancelled event stays in the feed marked cancelled.
- **Emails.** A confirmation or waitlist notice, an offer when a seat opens, a reminder a day before (for people who registered at least a day ahead) and one about two hours before, and word of a change of time or place or a cancellation. They use the same switch as summaries of followed pages: nothing is sent while `UPDATE_EMAIL_FROM` is empty, and the event page always shows where each person stands. Each email is recorded in `calendar_messages` before it is sent and the record removed if sending fails, so it goes once. Confirmations are sent only for registrations from the last two days, so turning email on later does not send old ones (`src/lib/server/event-calendar-email.ts`).
- **The 15-minute run.** Every 15 minutes (`triggers` in `wrangler.jsonc`), the run at `/events/scheduled` lets lapsed offers go, offers free seats, sends what is due and empties access needs 30 days after each event. It is passed inside the Worker the same way as the hourly following run.
- **Privacy.** Access needs are seen only by the lead author and editors and are emptied 30 days after the event. A person's registrations are in their "Download my data" file and are deleted with their account.

### The video room

The website's own video rooms, with recording (decision record 0048, "The video room" and "Rooms of their own"; Trevor chose Cloudflare RealtimeKit on 2026-11-23, asked that it record, and asked for several rooms at once, public and private rooms for interviews, and instant rooms). A room belongs to an event, turned on under "Video room" on the event's workspace page, or stands alone, made under Video rooms in the workspace (`/workspace/rooms`). Each room is its own RealtimeKit meeting, so any number run at once. The rules shared by the pages are in `src/lib/video-rooms.ts`, the database side, invite links and the recording run in `src/lib/server/video-rooms.ts`, the calls to RealtimeKit in `src/lib/server/realtime-kit.ts`, and the tables in `migrations/20261123T1750_add_standalone_video_rooms.sql`.

- **Switching it on.** The room stays off until one Secret, `VIDEO_ROOM_TOKEN`, is added in the Cloudflare dashboard (Workers and Pages, the site's Worker, Settings, Variables and Secrets): an API token with the Realtime Admin permission. RealtimeKit has no Worker binding, so a token is needed. The token may reach only RealtimeKit, so it cannot list the account; the account and app are therefore named in `wrangler.jsonc` as `VIDEO_ROOM_ACCOUNT` and `VIDEO_ROOM_APPLICATION` (neither is a secret), and the site makes no lookup. Before that, make one RealtimeKit app in the dashboard under Realtime, RealtimeKit: an app made there comes with the default presets the room uses (`webinar_presenter` and `webinar_viewer` for a stage with an audience, `group_call_host` and `group_call_participant` for a discussion), and one made through the API does not. If either is left empty, the site tries to find it with the token, once per Worker instance. If the app is ever made again, change `VIDEO_ROOM_APPLICATION` to its id. Until the token is there, hosts can still set rooms up and make links, and the room pages say it is not switched on.
- **Event rooms.** People registered for an online seat, or anyone signed in when the event has no seats, from 30 minutes before the start until two hours after the end, at `/events/<address>/room`. The lead author and editors host every room and can open it any time before it closes.
- **Rooms of their own.** A public room is listed at `/rooms` and lets in anyone signed in, from 30 minutes before it starts until it closes. A private room lets in only its hosts and people with one of its invite links (`/rooms/<room>/invite/<secret>`), who need no account and type the name shown in the room. Only a hash of a link's secret is kept, so the link is shown once; hosts can make more and turn any off. Each browser that uses a link is a separate person in the room (a random key in the `__Host-room-guest` cookie), so one link can be passed around. "Start a room now" makes a private room open for four hours with a guest link; hosts can keep a room open an hour longer or close it, which also ends the live call. The people who manage events host every room; co-authors and advisors (`host-video-rooms`) start rooms and host the ones they started.
- **Joining.** Each person is added to the room's RealtimeKit meeting once, under their account identifier or `invite-<link>-<browser>` (never an email address), and each visit gets a fresh token that stops working when the room closes.
- **The call page.** A room's page (`/rooms/<room>`, an invite link, or `/events/<address>/room`) has the whole window, with no site header, sidebar or footer, only a thin bar with the room's name; links to it open in a new tab (Trevor, 2026-11-23).
- **The recording notice.** Nobody decides about recording before a room of its own starts (Trevor, 2026-11-23): everyone is told in one line that the room may be recorded and who may watch, and ticks that they agree. An event still says beforehand whether it is recorded (its "Recording" setting, "May be recorded" unless changed), because registrants read that before they sign up. What each person was told, and when, is kept in `video_room_people` and listed for hosts under "Who was told about recording". People join with camera and microphone off.
- **While recording.** Hosts start and stop recording in the call, with a button above the room; only an event announced as not recorded has none. Whenever a recording runs, the page shows "This room is being recorded" and screen readers are told. As in Magna Carta's meetings, a short rising tone plays when it starts and a falling one when it stops. RealtimeKit's own recording mark shows in the room too.
- **Keeping recordings.** RealtimeKit keeps a recording for seven days. The 15-minute events run asks it for each recent room's recordings, notes them in `video_room_recordings`, and copies one finished recording per run into the private bucket at `room-recordings/<room>/<recording>.mp4`, then puts it in line for the virus check with purpose `room-recording` (`SCANNING.md`). A copy that fails is tried again on later runs, up to five times, and the problem is shown to hosts.
- **Watching.** Each room says who may watch its recordings: only the hosts (the default), the people registered for the event (event rooms), the people who joined while signed in (rooms of their own), or anyone signed in. A recording is served from `/events/<address>/recordings/<recording>` or `/rooms/<room>/recordings/<recording>` only to them, and only once the virus check passes, with byte ranges so the player can seek. Hosts can hide a recording, which keeps it but shows it to nobody else. A room with recordings cannot be deleted, so a recording is never lost that way.

## Account pages

Account settings are separate from display settings (decision record 0045; site/DESIGN.md, section 6, "Settings and Account"). Settings, under the cog, change how the site looks on one screen and are kept on the device. The Account pages hold who someone is to the project and what it keeps about them, on the server, for signed-in people only. The left sidebar lists them, with Following, under "Your account" on every page for someone signed in (`src/lib/account-menu.ts`); the group starts open on those pages and shut elsewhere. The profile button in the masthead holds only who is signed in and Sign out (Trevor, Nov. 23, 2026). There is no overview page: Trevor had it removed on Nov. 23, 2026, and `/account` sends people on to Sign-in and security so old links keep working. The server side is `src/lib/server/account-pages.ts`.

- **Profile and credit** (`/profile`): the contributor profile, picture and credit, as before (docs/contributor-profiles.md).
- **Your uploads** (`/uploads`): files and links the person sent the project (docs/uploads.md).
- **Nation team** (`/profile/nation-team`): asking for and holding a place on a nation's team (decision record 0041).
- **Sign-in and security** (`/account/security`): the password (`/profile/password`) and every browser signed in to the account, named by `sessions.device`, with "Sign out" for each other one and "Sign out everywhere else". A session is named only by the first 16 characters of its stored hash; the token is never shown. Two-step sign-in and backup codes go here when they are built.
- **Email and notifications** (`/account/email`): how often to email about followed pages, moved from the Following page.
- **Your data** (`/account/data`): "Download my data" (`/account/data/download`, one JSON file with the account, workspace role, profile and every confirmed version, files and links sent (their details, not the files), followed pages, email choice, the settings copy and the signed-in browsers; never the password or its hash) and the link to delete the account (`/profile/delete-account`). Requests are not tied to accounts, so they are not in the file.
- **Settings on every device** (`/account/settings`): GET, PUT and DELETE of the `account_settings` copy, for the site's own script (`src/lib/settings-everywhere.ts`) only. It answers 401 instead of sending people to sign in. The profile button's script asks for the copy at most every ten minutes and applies it when it is newer than the one this device last saw, and sends each change made in Settings or with the theme button.

A new account choice goes on these pages when other people see it or the project keeps it or acts on it; a choice that only changes what one screen shows goes in Settings. Settings for a workspace tool, such as the inbox, stay beside the tool.

## Source library

The workspace's Source library page (`/workspace/library`) searches the words of every document the project keeps in the private bucket: constitutions, codes and ordinances, gaming compacts, tribal court opinions, Federal Register notices, saved web pages, articles and Westlaw prints ([decision record 0051](../docs/decisions/0051-search-the-source-documents-through-a-private-full-text-library.md)). Trevor asked for it on 2026-11-23 alongside the version Claude uses (`scripts/library/library.py`). The lead author, editors, co-authors and advisors can open it (the `search-source-library` permission), since the library holds private copies.

- **Searching.** All the words must appear; "quotation marks" find a phrase, OR gives alternatives, a star matches word endings (mediat*), NEAR(a b, 10) finds words close together, and words match their other forms (SQLite FTS5 with Porter stemming). Text that is not valid in that language is searched as plain words. Results list each document once, best first, with up to three passages and the page each is on: the PDF page, the printed page where the PDF has labels, and the reporter's star page for tribal court opinions. Filters: kind of source (the bucket folder), a nation's identifier, and only copies the website shows. "Titles and citations" finds a document by name.
- **Reading.** A document's page shows its details (nations, where it was published, the records that cite it, rights) and its text passage by passage, opening at the passage or page asked for, with the search's words marked. Passages read from scans by OCR say so. "Open the original" gives the file from the bucket: a PDF opens in the browser, anything else is downloaded, and only a key the library lists for that document is ever served.
- **Where it lives.** The library's own D1 database, `model-tribal-adr-code-library` (binding `sourceLibrary`), separate from the site's database. `scripts/library/build_library.py` builds the library and, with each build, writes the changes since the last one as SQL files under `_library/d1/` in the bucket. The scheduled run at minute 29 of each hour applies them in order for up to eight minutes (`src/lib/server/source-library.ts`), keeping its place in the database's `meta` table, so the first load of the whole library takes a few runs and later builds take one. A nightly scheduled task runs `build_library.py update --ocr`, which reads only new files.

## Recent changes

Every change to the site's pages is listed at `/changes`, newest first, the way a wiki's Recent changes page lists them (MediaWiki, "Help:Recent changes", https://www.mediawiki.org/wiki/Help:Recent_changes), with a history for each page and a page comparing any two versions. Trevor asked for it on 2026-11-23 and chose that nation pages show who changed them, when and which parts, never their earlier wording. The rules shared by the browser and the Worker are in `src/lib/page-history.ts`; the database side is `src/lib/server/page-history.ts`.

- **Where changes come from.** Essays: every publication in `essay_publications`, read as it is, with the version's note as its summary and the person who published it. Pages built with the site (nation pages, stories, glossary entries, the acknowledgments, the charter and the licenses, and the model code once it is drafted): `src/lib/server/page-history-build.ts` lists each with a fingerprint of what it shows readers, and the merged pull requests that last touched its files (from `git log`), and bundles the list into the Worker as `virtual:page-history`. `recordBuildChanges` compares it with `page_states` and adds a row to `page_changes` for each page that is new, changed or gone, with the merged pull requests' titles as the summary and "Site release" as who made it. It runs every hour from the scheduled run and the first time a copy of the Worker opens Recent changes. The first comparison only records the pages; changes are listed from then on. A newer build is claimed with a random token, as for Following pages.
- **What is kept.** For pages whose earlier wording may be shown, each version's text is written once to the private bucket as `page-versions/<address>/<fingerprint>.txt`, so any two versions can be compared. Nation pages and stories keep no text: their rows name the parts of the page that changed (such as "Contacts" or "Courts"), worked out from a hash of each part, and no title, which is looked up from the live site when the change is shown. A nation can ask for something to be taken off its page, and an older version would put it back in view.
- **Filters.** Page (`?page=` shows one page's history), kind of page, who, dates, size of change in bytes, kinds of change (edits, new pages, published versions, removed pages), whether changes are grouped by page, and how many to show. A change that came with an update to more than 25 pages at once is a bulk update, hidden unless the reader asks for it, the way a wiki hides bots. The same filters give an Atom feed at `/changes/feed.xml`.
- **Changes to this page.** Every page whose changes are recorded has a "Changes to this page" link in the sidebar, below Recent changes (`followedPageAddress` in `src/lib/page-history.ts` decides which pages; listings, search and the workspace have none), and nation pages also have one beside who keeps the page. It opens `/changes?page=<address>`, which says "Showing changes to <page> only" with a link to show all changes. A page that has not changed since the first comparison shows one row, the version readers see now, dated when it was recorded (`page_states.seen_at`), so a page's history is never empty. Trevor asked for this on 2026-11-23.
- **Nations' own changes.** What a nation's team publishes on its page comes from `nation_page_changes`, listed as "nation-<identifier>" with the part changed and the name the team gave ("Editing the nation's page", above).
- **Hiding.** The lead author can hide the text, the summary or the name on any change from `/workspace/changes/<change>`, with a reason readers see, the way a wiki hides a revision (MediaWiki, "Help:RevisionDelete", https://www.mediawiki.org/wiki/Help:RevisionDelete). The change stays listed with a line through what is hidden. Hidden text cannot be read or compared, including as the earlier side of the next change, and its size is not shown or filtered on. An essay publication held back in the workspace is hidden the same way. Each hiding and showing again is recorded in the activity log. Hidden changes are listed at `/workspace/changes`.

## Nonprofit

`/workspace/nonprofit` (lead author only, permission `manage-nonprofit`) keeps the facts, filings and to-dos of the project's Nevada nonprofit corporation, which the lead author chose to form and take to the IRS with Form 1023-EZ (Nov. 23, 2026). It is a planning aid, not legal or tax advice, and says so on the page.

- **Tables** (`migrations/20261123T0440_add_nonprofit_records.sql`): `nonprofit_facts` holds one row per fact, such as the date of incorporation or the fiscal year's last month. `nonprofit_completions` records a filing or setup step marked done, with the day, a confirmation number and who recorded it. `nonprofit_tasks` holds the lead author's own to-dos, once or every year.
- **Due dates are worked out, not stored** (`src/lib/nonprofit.ts`), from the facts and today's date in Nevada. They cover the annual list and the charitable registration filed with it, due the last day of the month the articles were filed in each year (Nev. Rev. Stat. §§ 82.193, 78.150, 82A.100); Form 990-N, due the 15th day of the fifth month after the fiscal year ends (26 U.S.C. § 6033(i); Treas. Reg. § 1.6033-2(e)); Form 1023-EZ, due 27 months after the end of the month of incorporation for exemption back to that date, and done once its filing date is entered as a fact; and the directors' yearly conflict-of-interest statements. Each shows its fee and its source. A missed filing stays on the list as overdue next to the next one, and anything due within 60 days is due soon.
- **Setting up** lists the one-time steps in the order of the brief on becoming a 501(c)(3); the articles and the application are marked done by the facts.
- **To-dos.** Marking a yearly to-do done records it and moves its due date on a year.
- **Calendar.** `/workspace/nonprofit/calendar.ics` is a calendar file (RFC 5545) with each open due date as an all-day event and reminders 30 and 7 days before. It is downloaded, not subscribed to, so it is downloaded again after the dates change.
- **Overview.** The workspace overview shows the lead author anything overdue or due soon. Until the migration is applied to the live database, the overview leaves this out and the Nonprofit page says how to apply it: `npx wrangler d1 migrations apply database --remote` from the site folder.

## Service checks

`/workspace/service-checks` (lead author only, permission `check-services`) checks each service the site depends on whenever the page is opened (`src/lib/server/service-checks.ts`). For each it says whether it is working, needs a look, has a problem, or is not set up yet, and what to do about it. The checks only read and sign in: nothing is sent, charged, ordered or changed. Each check stops after ten seconds, and one that fails shows as a problem without stopping the others. Passwords and keys are never shown.

- **Database:** answers, and every migration file in this build is in `d1_migrations`; the missing ones are named.
- **File storage:** the private bucket can be listed.
- **Live editing, rate limits, site address and lead author:** the binding or setting is there; a workers.dev address is flagged, since email waits on the project domain.
- **Sign-in email and update emails:** the sender is set and the email binding is there.
- **Project inbox:** the mail domain, the sending binding and the signing key are set.
- **Outreach mailbox (Zoho):** signs in to the SMTP server with the saved password (EHLO, STARTTLS on port 587, AUTH, QUIT) and leaves without sending anything.
- **Book ordering, Lulu and Stripe:** ordering's settings must agree, so a test-mode site with a live Stripe key is a problem. The Lulu check signs in with the client key and looks for the print status webhook. The Stripe check reads the balance to prove the key and looks for the payment webhook with both checkout events.
- **Virus scanner:** files waiting more than 30 minutes are a problem and failed scans need a look.

A new service gets a check here when it is added: a function in `serviceChecks` that returns its state, a summary and the details.

## Testing

`npm test` runs the unit tests in `tests/` with Vitest, including the database code against the real migrations in an in-memory SQLite database. That includes codes, links, passwords and sessions (`tests/sign-in.test.ts`). Sending real email is tried by hand once `SIGN_IN_EMAIL_FROM` is set.

## Sources

- Cloudflare, *Email Sending Workers API*, Cloudflare Email Service Docs, https://developers.cloudflare.com/email-service/api/send-emails/workers-api/.
- Cloudflare, *Web Crypto*, Cloudflare Workers Docs, https://developers.cloudflare.com/workers/runtime-apis/web-crypto/.
- Paul A. Grassi et al., Nat'l Inst. of Standards & Tech., *Digital Identity Guidelines: Authentication and Lifecycle Management*, NIST SP 800-63B (2017), https://pages.nist.gov/800-63-3/sp800-63b.html.
- OWASP Foundation, *Authentication Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html.
- OWASP Foundation, *Password Storage Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html.
- Cloudflare, *Rate Limiting*, Cloudflare Workers Docs, https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.
- Cloudflare, *Time Travel and backups*, Cloudflare D1 Docs, https://developers.cloudflare.com/d1/reference/time-travel/.
- OWASP Foundation, *A01:2021 – Broken Access Control*, https://top10.owasp.org/2021/A01_2021-Broken_Access_Control/index.html.
- OWASP Foundation, *Authorization Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html.
- OWASP Foundation, *Cross-Site Request Forgery Prevention Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html.
- OWASP Foundation, *Logging Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html.
- Karen Kent & Murugiah Souppaya, Nat'l Inst. of Standards & Tech., *Guide to Computer Security Log Management*, NIST SP 800-92 (2006), https://csrc.nist.gov/pubs/sp/800/92/final.
- Bruce Schneier & John Kelsey, *Secure Audit Logs to Support Computer Forensics*, 2 ACM Transactions on Information & System Security 159 (1999).
- Svelte, *Configuration: csrf*, SvelteKit Docs, https://svelte.dev/docs/kit/configuration#csrf.

## Not built yet

- Email to the maintainer when a request arrives (docs/requests.md, "Notification"). Until then, check `/workspace/requests`; the overview shows anything past a target.
- The public "Requests log" page (docs/requests.md, "Public log").
- A filings list in the workspace, and emailing a signer their copy of a form (waits on a domain).
- Hiding material from the website directly from the workspace, before a pull request; for now hiding is a pull request.
- Editing records other than essays from the website. Those changes stay pull requests, which keeps history orderly. Nation teams (above) are the exception for their own nation's page.
- Emails to a nation's office when someone joins or leaves its team, and the weekly summary of changes (waits on a domain).
- For events (decision record 0048): continuing legal education (credit applications, attendance codes, certificates) and paid tickets. A transcript of each recording, and a recorded replay for credit through an accredited provider, also come later.
- Using the virus scan for email attachments. The scanner is built (SCANNING.md); the inbox starts using it in its own change. Files people send already use it (docs/uploads.md, "The virus check").
- Joining the live editing room from the essay editor, comments on drafts, and figures (docs/editing.md, "Built so far and still to build").
