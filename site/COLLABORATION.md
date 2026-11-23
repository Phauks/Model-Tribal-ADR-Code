# Sign-in and co-author collaboration

How co-authors sign in, who can do what, how sign-offs are recorded, and how
requests from Native nations are handled once they arrive. The public side of
requests is specified in [docs/requests.md](../docs/requests.md); this page
covers how the website builds it. Everything here is project design unless a
source is cited.

## In short

- **Sign-in is the site's own**
  ([decision record 0024](../docs/decisions/0024-own-sign-in.md)). People sign
  in with a code sent to their email address, or with a password they chose.
  No outside sign-in service is used and nobody needs an account anywhere
  else. The account only proves who someone is. The site's database decides
  what they may do.
- **Nobody reaches the workspace until the lead author adds them.** There is
  no open access to the workspace. Anyone with a verified email address may
  sign in to register as a contributor and keep a profile
  ([docs/contributor-profiles.md](../docs/contributor-profiles.md),
  [decision record 0022](../docs/decisions/0022-open-registration-for-contributors.md)).
- **The lead author is the administrator**: full access to everything, and
  the only person who adds people, changes roles, grants and restricts
  access to documents, and reads the activity log
  ([decision record 0023](../docs/decisions/0023-permission-levels-per-document.md)).
- **Readers and requesters never need an account.** The request form at
  `/requests` works without signing in and without JavaScript
  (docs/requests.md, principle 5).
- **Essays are edited here; other content changes by pull request.** Essays live in the private bucket and are written, saved and published in the workspace (see [Essays](#essays) and [docs/editing.md](../docs/editing.md)). Every other record still changes only by pull request; for those the workspace records who approved which version, handles requests, and manages access.
- **Secrets live only in Cloudflare**
  ([decision record 0006](../docs/decisions/0006-secrets-only-in-cloudflare.md)).

## Who can do what

Two layers decide it
([decision record 0023](../docs/decisions/0023-permission-levels-per-document.md)):
a **role** for workspace-wide tasks, and a **level on each document**. Both
are stored in the database and changed by the lead author, on the People
page (`/workspace/people`) and the Access page (`/workspace/access`). Every
change is recorded with who made it and when. The rules are in
`src/lib/permissions.ts` and `src/lib/server/access.ts` and are checked on
the server for every page and every form, reading the database each time;
the page only hides buttons a person cannot use.

| Role | Can do | Starts at, on every document |
| --- | --- | --- |
| Lead author | The administrator. Everything below, and adds, changes and removes people, grants and restricts access, reads the activity log, and welcomes or declines contributor registrations. The project always keeps at least one. | Full, always; cannot be restricted |
| Editor | Reads requests and their uploaded files, changes their status, decides them; reads contributor registrations; signs off on content or asks for changes. | Contribute |
| Advisor | Signs off on content or asks for changes, as a project advisor; comments. Does not see requests. | Comment |
| Co-author | Comments. Does not see requests. | Comment |
| Contributor | Works only on what the lead author grants, for example writing one assigned essay. Cannot sign off or publish. | No access |
| Nation reviewer | Reviews one nation's record, for that nation: approves it, asks for changes, or comments. | No access, except comment and approve on their own nation's record |

### Access to each document

Each person has one of four levels on each document (a nation record, a
glossary term, a provision or an essay):

| Level | Allows |
| --- | --- |
| No access | Cannot open the document or see that it is being worked on. |
| Comment | Reads the document and its drafts, and comments. |
| Contribute | Comment, and edits the draft and saves versions of it. |
| Full | Contribute, and restores an earlier version, resolves or hides others' comments, and submits the draft for publishing. |

There is no view-only level: anyone who can open a document can comment on
it, because the project wants their feedback. Contribute and full take effect
in the website editor (decision record 0021); until it exists, content still
changes by pull request.

A person's level on a document is, most specific first:

1. full, for the lead author, always;
2. a grant for that document;
3. a grant for every document of that kind, which also covers drafts that
   have no file yet;
4. their role's default (table above).

A grant of "No access" is how the lead author keeps someone out of a
document their role would open. A grant can have an end date. Changing a
grant ends the old one and adds a new one, so the history of who had what
stays in the database. Only the lead author grants access; full access to a
document does not let a person grant it to others.

The Access page shows an overview (people by role and status, grants in
force and about to end, refused attempts in the last 30 days, and whether the
activity log is intact), each person's level on each kind of document, and
every grant, with a form to grant, restrict or end access.

Code that shows or changes a document calls `requireDocumentLevel(event,
database, subject, minimum)` from `src/lib/server/access.ts`, which reads the
person's grants fresh and refuses with 403 below the minimum. The website
editor's rooms call it before connecting someone and re-check on every saved
version, and `onAccessChanged` lets a room disconnect someone whose access
was lowered.

Requests are limited to editors and the lead author because they hold
requesters' contact details and may describe restricted material (charter,
commitment 6).

A nation reviewer is how a nation's own office can approve its record
(charter, commitment 4: "sent to nation", "reviewed by nation", "approved by
nation"). The approval is recorded in the workspace; the record's
`review.status` is then changed by pull request, citing the approval.

## Essays

Essays are kept in the private `sourceDocuments` bucket and edited at `/workspace/essays` ([decision record 0021](../docs/decisions/0021-edit-drafts-in-the-browser-keep-essays-in-the-bucket.md), [docs/editing.md](../docs/editing.md)).

- **Levels.** Comment access lets a person read every saved version and compare them. Contribute access lets them edit and save versions. Full access also lets them publish a version, restore an earlier one as a new version, hold a publication back from readers, save the git text over edits made here, and start a new essay (full access to every essay). Each page and action checks the level on that essay with `requireDocumentLevel`, as every workspace page does.
- **Versions never change.** Each save writes a new file, `essays/<id>/versions/<number>-<first 12 characters of the SHA-256>.md`, refused if the name is taken (`If-None-Match: *`), and adds a row to `essay_versions` and an entry to the activity log. Database triggers refuse any change to a saved version or deletion of one. A save names the version the writer started from; if someone saved after that, the save is refused and the editor shows both, so nobody's text is lost.
- **Publishing** makes a saved version the essay's page. Before publishing, the site renders the version and refuses it if a citation key or glossary link points to nothing. A publication can be held back from readers (with a reason, for the log), for example while a nation's request is reviewed; it is never deleted.
- **Pages.** The Worker renders essay pages on request from the newest listed publication (`/foundations/<id>` for Part I, `/essays/<id>` for the rest) and caches the result for each file and site build. Earlier publications stay readable from the page's version list.
- **Git copy.** `/published-essays.json` lists every listed publication with its SHA-256, and `/published-essays/<id>/<number>.md` serves each one. The hourly workflow `.github/workflows/copy-published-essays.yml` copies new ones to the `published-essays` branch.
- **Text from git.** Essay text merged in `content/essays/` is saved here by itself after each build, as a new draft version, merged paragraph by paragraph with edits made here since (docs/editing.md, "Text from git comes in by itself"). Only a paragraph changed both here and in git waits for a person, on the Essays page.

## Reviews and sign-offs

`/workspace/reviews` lists the documents the person can open: nation records
that are not restricted (including records held back until the nation
approves them), glossary terms and essays. Provisions join the list when
their records exist. Anyone who can open a document can comment on it; only
the lead author, editors and advisors sign off for the project, and only a
nation reviewer, on their own nation's record, approves for the nation.
The list is built with the site, so it always matches the deployed content.

A review is one of **Approved**, **Changes requested** or **Comment**, with a
note. It records:

- the person and the capacity they reviewed in (lead author, editor,
  advisor, co-author, or "for the nation"), kept even if their role changes
  later;
- the version it applies to: the content version and, when Workers Builds
  built the site, the commit (for example `content 0.0.3, commit 1a2b3c4d5e6f`).

So when the text changes later, it is clear which approvals came before the
change.

## Protection against unauthorized changes

Every request that changes something in the workspace passes these checks,
in order (`src/hooks.server.ts`):

1. **From this site's own pages.** A change sent from another site is
   refused, using the browser's `Sec-Fetch-Site` header, or `Origin` where
   that is missing (`src/lib/server/request-guard.ts`). This is a second,
   independent check beside SvelteKit's own check on form submissions, and
   the session cookie is `SameSite=Lax`. (OWASP, *Cross-Site Request Forgery
   Prevention Cheat Sheet*; Svelte, *SvelteKit configuration: csrf*.)
2. **Not too many.** Each signed-in person may make 30 changes a minute
   (the `workspaceChangeLimit` binding in `wrangler.jsonc`, keyed by the
   person rather than the address, as Cloudflare recommends). Refused page
   views count too, so they cannot flood the log. (Cloudflare, *Rate
   Limiting*.)
3. **Allowed.** The page or form checks the person's role or document level
   from the database. A refusal is answered with 403 and recorded in the
   activity log with what was tried. (OWASP, *Authorization Cheat Sheet*;
   OWASP Top 10, *A01:2021 Broken Access Control*.)

Content on the public site changes only by pull request, so any change can
be reverted with git; drafts in the website editor keep named versions that
someone with full access can restore.

## Activity log

`/workspace/activity` (lead author only) lists everything done in the
workspace, newest first, filtered by kind or person: invitations, role and
access changes, reviews, requests, saved document versions, contributor
profile changes, and refused attempts.

- **Entries cannot be changed or deleted.** The database refuses (triggers
  in `migrations/0002_permission_tiers.sql`).
- **Entries are sealed.** Each entry's seal is the SHA-256 hash of the entry
  and the seal before it, so changing, removing or reordering an entry
  breaks every seal after it (`src/lib/server/activity-seals.ts`; Schneier &
  Kelsey 1999). New entries are sealed after each change, and the whole
  chain is checked each time the Access or Activity page opens. The result
  shows on both pages and on the Overview.
- **What it cannot do.** Someone with full control of the Cloudflare
  account could remove the rules and write a new, consistent chain. To catch
  that, the Activity page shows the latest seal and offers the whole log
  with its seals as a download; keep a copy now and then somewhere outside
  Cloudflare. D1 Time Travel can restore the database to an earlier minute
  (Cloudflare, *Time Travel and backups*).
- **Personal details.** Because entries cannot be edited, do not put a
  requester's contact details in request notes: the 12-month deletion of
  personal details (docs/requests.md) cannot reach the log.

OWASP recommends logging access-control failures and protecting logs from
tampering (OWASP, *Logging Cheat Sheet*; NIST SP 800-92).

## Requests from nations

The form at `/requests` follows docs/requests.md step by step, with a branch
for adding a nation that is missing. Each request gets a reference such as
`20261121-K7QX3M` (the date, then six characters from Crockford's base 32,
which leaves out I, L, O and U so a reference read aloud is hard to get
wrong).

In the workspace, `/workspace/requests` lists requests with the project's own
targets from docs/requests.md: acknowledge within 7 days, hide material named
in a restrict or remove request within 7 days, decide within 30 days of
acknowledging. A request's page shows its details, its proof and uploaded
files, and its history, and lets an editor change its status, add notes,
resolve it (a declined request needs the reasons given to the requester) or
reopen it.

**Hiding material is still done by pull request.** Setting a request to
"Hidden, pending review" records when that was done; the change itself is a
pull request that sets `sensitivity.tribal_review_required: true` or
`sensitivity.restricted: true`, with a commit message that does not repeat the
material.

**Uploads** are kept in the private `sourceDocuments` bucket under
`requests/`. The form accepts PDF, PNG, JPEG and WebP files up to 10 MB,
checked by their first bytes rather than their names, and the workspace only
ever offers them as downloads, so an uploaded file cannot run as a page of the
site.

**Personal details** (name, role and contact) are deleted 12 months after a
request is resolved, unless the person asked to be credited
(docs/requests.md). This runs whenever an editor opens the request list, so
no scheduled job is needed.

**Spam.** The form has a hidden field that people never see and bots tend to
fill in, and Cloudflare limits each connection to five submissions a minute
(the `requestFormLimit` binding in `wrangler.jsonc`). Neither asks the
requester to make an account or solve a puzzle.

## Forms

The Forms page (`/forms`) lists the contributor forms in `docs/contributor-forms/` and the model forms in `content/forms/` (docs/contributions.md, "On the website"). At build time `src/lib/server/form-catalog.ts` turns each Markdown file into a template: the form as HTML with a token where each field goes, the same Markdown with the tokens, the list of fields with their labels, and the file's SHA-256. The templates reach the Worker as the `virtual:forms` module, because the form pages answer forms sent to them. `src/lib/forms.ts` fills a template in three ways: fields to fill in online, lines to fill in by hand (`/forms/<form>/print`, built ahead of time), and the answers as text.

A contributor form sent from `/forms/<form>` opens a request (kind `contribute`, or `restrict` for a change or withdrawal) with a row in `form_submissions`: the form, version, checksum, how it was signed, the typed name and the answers. Signed online, it also gets a filled copy in the bucket at `forms/<request>/<submission>.md`. Uploaded, the photos or scans are files of the request in `request_sources`, checked like any upload. Both ways use the hidden field and the `requestFormLimit` rate limit. A request with a form keeps its personal details after it is resolved.

On the request's page in the workspace, editors see each form, open the filled form (while the site still has that exact version), download the stored copy, and file the forms under a filing number, which is logged.

## How sign-in works

The "Sign in" link in the masthead of every page, and "Co-author sign-in" in
the footer, start here. The design follows the lead author's Grimbinder
project (`worker/account/` there).

1. **A code by email.** At `/sign-in` the person types their email address.
   The site emails a six-digit code and a link through Cloudflare Email
   Service (`src/lib/server/sign-in-email.ts`). Typing the code, or opening
   the link and pressing "Sign in", signs them in. The first time, this also
   makes their account (`src/lib/server/accounts.ts`), so there is no separate
   sign-up. A code:
   - works once, for 15 minutes, and only the newest one for an address works;
   - stops working after 5 wrong tries;
   - is kept in the database only as a SHA-256 hash, like the link.
2. **A password, if they chose one.** Anyone signed in can choose a password
   at `/profile/password`; it is optional. Passwords are stored only as salted
   PBKDF2-SHA256 hashes with 100,000 iterations, the most Workers allow
   (Cloudflare, ["Web
   Crypto"](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)).
   The rules follow NIST SP 800-63B: at least 12 characters, any characters,
   no forced mixing of character types. A wrong password gets the same answer
   whether or not the address has an account, so the form cannot be used to
   find out who has signed up. Changing a password signs out every other
   browser.
3. **A link from the lead author.** On the People page the lead author gets a
   one-time sign-in link for each person they invite, to send them
   personally. It works once, for 7 days, only for someone who has never
   signed in, and making one is recorded in the activity log. After using it,
   the person is offered a password.
4. **Limits.** Each email address may try each step 5 times a minute, and
   each network address 30 times (`wrangler.jsonc`, `signInLimit` and
   `signInNetworkLimit`).
5. **Matching to a person.** After sign-in the site matches the account to a
   person (`src/lib/server/people.ts`):
   - someone who has signed in before, by their account;
   - someone signing in for the first time, by their email address. Every
     account has proved it receives mail at its address, so nobody can claim
     an invitation by typing someone else's address;
   - the very first lead author, by the `LEAD_AUTHOR_EMAIL` setting.

   Anyone else stays signed in and goes to their contributor profile
   (`/profile`), where they can register to help. The workspace stays closed
   to them. Someone whose access was removed is not signed in.
6. **The session** is a random 256-bit token in an HTTP-only, SameSite=Lax,
   Secure cookie. The database keeps only its hash (`sessions` table). It
   lasts at most 12 hours and ends after 4 hours without use. "Sign out"
   deletes it.
7. On every workspace page the site checks the database again, so removing
   someone's access takes effect at once, even if they are signed in.
8. The masthead's link reads "Workspace" instead of "Sign in" while a
   `signed-in-hint` cookie is present (`src/lib/signed-in-hint.ts`). It holds
   only "1", is readable by the page's script because public pages are built
   ahead of time and cannot ask the Worker, and grants nothing: it is set at a
   successful sign-in and on each workspace page while the session is valid,
   and cleared at sign-out or once the session has ended.

Workspace pages, sign-in and the request form are never cached, by the
browser or by the offline copy (`src/service-worker/index.ts`), and cannot be
shown inside another site's frame.

On a copy of the site running on your own computer (`npm run preview`,
`localhost`), no email is sent: the code and link are shown on the sign-in
page instead.

## Setting up sign-in

Nothing secret has to be set. There are two settings, and the site works
without the first.

### 1. The address codes come from

Cloudflare Email Service sends only from a domain onboarded in Email Service
on the same Cloudflare account (Cloudflare, ["Send
emails"](https://developers.cloudflare.com/email-service/get-started/send-emails/)).
The workers.dev address cannot send email.

1. Cloudflare dashboard > **Compute > Email Service > Email Sending** >
   **Onboard Domain**, and choose the domain. Cloudflare adds the DNS records
   it needs (SPF, DKIM, DMARC and bounce handling).
2. In `site/wrangler.jsonc`, set `SIGN_IN_EMAIL_FROM` under `vars` to an
   address on that domain, such as `sign-in@example.org`, and merge the
   change. The address is not secret.

Until this is done, the site sends no email. People sign in with a password,
or with a link from the lead author, and `/sign-in` says so.

### 2. The first lead author

Worker `model-tribal-adr-code` > **Settings > Variables and Secrets** > **Add**,
type **Secret**: `LEAD_AUTHOR_EMAIL`, the lead author's email address. It is
set in the dashboard rather than in `wrangler.jsonc` only because that file
is public. It must be the **Secret** type even though an email address is not
really secret: each deploy replaces plain-text variables set in the dashboard
with the ones in `wrangler.jsonc`, but never deletes secrets (Cloudflare,
["Wrangler configuration: source of
truth"](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)).

### Database

The tables are created by the files in `migrations/`. Workers Builds does not
run them, because its automatically created API token does not include D1
permission (Cloudflare, ["Workers Builds configuration: API
token"](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)).
Apply them once per new migration, from `site/` (migration 0002 adds access
levels and the sealed activity log; apply it before deploying the code that
uses it):

```sh
npm run database:migrate:remote   # wrangler d1 migrations apply database --remote
```

Wrangler records which migrations ran, so running it again is safe. For the
copy used by `npm run preview`, use `npm run database:migrate:local`.

### First sign-in

Open `/sign-in`, enter the `LEAD_AUTHOR_EMAIL` address and ask for a code.
If the site cannot send email yet, someone with access to the Cloudflare
account can make a one-time link from `site/`:

```sh
npm run sign-in-link -- lead@example.org   # works once, for one hour
```

The same command helps anyone who has lost both their password and access to
their email.

The Workspace group in the left sidebar has a People page, where co-authors, advisors, editors, contributors and nation reviewers are added by email address, and an Access page, where their level on each document is raised or lowered. Each person signs in at `/sign-in` with that address, or with the link the People page gives you for them. Their access starts at their first sign-in.

## Database

The tables are created by the files in `migrations/`. Workers Builds does not
run them, because its automatically created API token does not include D1
permission (Cloudflare, ["Workers Builds configuration: API
token"](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)).
Apply them once per new migration, from `site/` (migration 0002 adds access
levels and the sealed activity log; apply it before deploying the code that
uses it):

```sh
npm run database:migrate:remote   # wrangler d1 migrations apply database --remote
```

Wrangler records which migrations ran, so running it again is safe. For the
copy used by `npm run preview`, use `npm run database:migrate:local`.

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

`migrations/0003_contributor_profiles.sql` adds contributor profiles, their
nations, interests and confirmed versions; see
[docs/contributor-profiles.md](../docs/contributor-profiles.md).

Status and outcome values are the words docs/requests.md uses
(`hidden-pending-review`, `declined` and so on), so the documentation and the
database match.

## Following pages

Anyone signed in can follow a nation's page, the model code or one of its sections, or an essay, and is told when it changes (decision record 0035; Trevor asked for it on 2026-11-23). The rules shared by the browser and the Worker are in `src/lib/following.ts`; the database side is `src/lib/server/following.ts`.

- **Following.** The Follow button (a bell, after Star in the masthead, `src/lib/components/FollowButton.svelte`) asks `/following/state` whether the reader follows the page, and posts there to follow or stop. Pages are built ahead of time, so it asks only when the signed-in hint says someone is signed in. A signed-out reader gets a dialog that offers sign-in and comes back to the page. One account can follow up to 1,000 pages, and following counts against the same per-minute limit as workspace changes.
- **Finding updates.** When the site is built, `src/lib/server/followable-build.ts` fingerprints each nation page from its published record (as its JSON download gives it; only the name and status for a page withdrawn at the nation's request) and its documents' version histories, and bundles the list into the Worker as `virtual:followable-pages`. An essay's fingerprint is the text of its newest listed publication. `checkForUpdates` compares both with `page_fingerprints` and adds a row to `page_updates` for each changed page that someone follows. The first comparison, and one after `fingerprintVersion` is raised, only records fingerprints. A newer build is claimed with a random token in `following_checks`, and only statements carrying that token write, so two copies of the Worker never record an update twice, and an older build still answering during a deploy is ignored.
- **When the checks run.** Every hour at 17 minutes past (`triggers` in `wrangler.jsonc`), on the first signed-in request a new build answers, and right after an essay is published or held back in the workspace. The SvelteKit adapter makes only a fetch handler, so `tools/add-scheduled-run.mjs` (the last step of `npm run build`) adds a `scheduled` handler that passes the run to `/following/scheduled` inside the same copy of the Worker, with a token only that copy holds (`src/lib/server/scheduled-run.ts`). The address refuses every other request.
- **Notices.** The Following page (`/following`, in the account menu, which shows the number of new updates) lists updates newest first, the pages followed, and the email choice. A notice names the page by its title on the live site and says only that it was updated, and when. The database stores no text or title, so a notice can never show words a nation asked to have removed or restricted. Essays and, once built, the model code also link to "What changed"; nation pages have no public version history.
- **Email.** Each account chooses no email, a daily summary (the default) or a weekly one. The hourly run sends what is due through the `updateEmail` binding from `UPDATE_EMAIL_FROM`, with links built from `SITE_ADDRESS` (`src/lib/server/following-email.ts`). While `UPDATE_EMAIL_FROM` is empty nothing is sent, and the Following page says so. An email lists each changed page's title, kind, day and link, and ends with "Stop these emails", a link to `/following/email-off` with the account's own random token (kept as it is, since it can only turn emails off and must keep working in older emails). The page asks for a button press, so a mail program that opens links to scan them cannot turn emails off. The link is also in the `List-Unsubscribe` header.

### Turning on the emails

Once the domain is onboarded in Email Service (see "Setting up sign-in"), set `UPDATE_EMAIL_FROM` in `site/wrangler.jsonc` to an address on it, such as `updates@` the domain, and `SITE_ADDRESS` to the site's address on the domain, and merge the change. Nothing else changes: summaries go out at the next hourly run to everyone whose choice is daily or weekly. Readers who followed pages before then were told on the Following page that emails would start once the site could send them.

## Testing

`npm test` runs the unit tests in `tests/` with Vitest, including the database
code against the real migrations in an in-memory SQLite database. That
includes codes, links, passwords and sessions (`tests/sign-in.test.ts`).
Sending real email is tried by hand once `SIGN_IN_EMAIL_FROM` is set.

## Sources

- Cloudflare, *Email Sending Workers API*, Cloudflare Email Service Docs,
  https://developers.cloudflare.com/email-service/api/send-emails/workers-api/.
- Cloudflare, *Web Crypto*, Cloudflare Workers Docs,
  https://developers.cloudflare.com/workers/runtime-apis/web-crypto/.
- Paul A. Grassi et al., Nat'l Inst. of Standards & Tech., *Digital Identity
  Guidelines: Authentication and Lifecycle Management*, NIST SP 800-63B
  (2017), https://pages.nist.gov/800-63-3/sp800-63b.html.
- OWASP Foundation, *Authentication Cheat Sheet*,
  https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html.
- OWASP Foundation, *Password Storage Cheat Sheet*,
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html.
- Cloudflare, *Rate Limiting*, Cloudflare Workers Docs,
  https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.
- Cloudflare, *Time Travel and backups*, Cloudflare D1 Docs,
  https://developers.cloudflare.com/d1/reference/time-travel/.
- OWASP Foundation, *A01:2021 – Broken Access Control*,
  https://top10.owasp.org/2021/A01_2021-Broken_Access_Control/index.html.
- OWASP Foundation, *Authorization Cheat Sheet*,
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html.
- OWASP Foundation, *Cross-Site Request Forgery Prevention Cheat Sheet*,
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html.
- OWASP Foundation, *Logging Cheat Sheet*,
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html.
- Karen Kent & Murugiah Souppaya, Nat'l Inst. of Standards & Tech., *Guide to
  Computer Security Log Management*, NIST SP 800-92 (2006),
  https://csrc.nist.gov/pubs/sp/800/92/final.
- Bruce Schneier & John Kelsey, *Secure Audit Logs to Support Computer
  Forensics*, 2 ACM Transactions on Information & System Security 159 (1999).
- Svelte, *Configuration: csrf*, SvelteKit Docs,
  https://svelte.dev/docs/kit/configuration#csrf.

## Not built yet

- Email to the maintainer when a request arrives (docs/requests.md,
  "Notification"). Until then, check `/workspace/requests`; the overview shows
  anything past a target.
- The public "Requests log" page (docs/requests.md, "Public log").
- A filings list in the workspace, and emailing a signer their copy of a form (waits on a domain).
- Hiding material from the website directly from the workspace, before a pull
  request; for now hiding is a pull request.
- Editing records other than essays from the website. Those changes stay pull requests, which keeps history orderly.
- Live co-editing of an essay by several people at once, comments on drafts, and figures (docs/editing.md, "Built so far and still to build").
