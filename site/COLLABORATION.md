# Sign-in and co-author collaboration

How co-authors sign in, who can do what, how sign-offs are recorded, and how
requests from Native nations are handled once they arrive. The public side of
requests is specified in [docs/requests.md](../docs/requests.md); this page
covers how the website builds it. Everything here is project design unless a
source is cited.

## In short

- **Sign-in** uses Auth0
  ([decision record 0013](../docs/decisions/0013-sign-in-with-auth0.md)).
  Auth0 proves who someone is. The site's own database decides what they may
  do.
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
- **Content still changes only by pull request.** The workspace records who
  approved which version of a record, handles requests, and manages access;
  it does not edit the content files.
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

## How sign-in works

The "Sign in" link in the masthead of every page, and "Co-author sign-in" in
the footer, start here.

1. `/sign-in` sends the person to Auth0's sign-in page, using the Auth0
   server SDK (`@auth0/auth0-server-js`) with PKCE.
2. Auth0 sends them back to `/sign-in/callback`. The site matches the sign-in
   to a person (`src/lib/server/people.ts`):
   - someone who has signed in before, by their Auth0 identifier;
   - someone signing in for the first time, by their email address, **only
     if Auth0 says the address is verified**, so nobody can claim an
     invitation by typing someone else's address;
   - the very first lead author, by the `LEAD_AUTHOR_EMAIL` secret.

   Anyone else with a verified email address stays signed in and goes to
   their contributor profile (`/profile`), where they can register to help;
   the workspace stays closed to them. Everyone else is signed out of Auth0
   again and told why.
3. The session is an encrypted, HTTP-only cookie. It lasts at most 12 hours,
   and ends after 4 hours without use.
4. On every workspace page the site checks the database again, so removing
   someone's access takes effect at once, even if they are signed in.
5. "Sign out" ends the session here and at Auth0.
6. The masthead's link reads "Workspace" instead of "Sign in" while a
   `signed-in-hint` cookie is present (`src/lib/signed-in-hint.ts`). It holds
   only "1", is readable by the page's script because public pages are built
   ahead of time and cannot ask the Worker, and grants nothing: it is set at a
   successful sign-in and on each workspace page while the session is valid,
   and cleared at sign-out or once the session has ended.

Workspace pages, sign-in and the request form are never cached, by the
browser or by the offline copy (`src/service-worker/index.ts`), and cannot be
shown inside another site's frame.

## Setting up sign-in

These steps need Trevor's Auth0 and Cloudflare accounts. Until they are done,
the public site works as before, `/requests` saves requests (once the
database is migrated, below), and `/sign-in` explains which settings are
missing.

### 1. In Auth0

1. Create a tenant if there is none (Auth0 dashboard, top-left menu).
2. **Applications > Applications > Create Application**: name it
   "Model Tribal ADR Code website", type **Regular Web Applications**.
3. In its **Settings**:
   - **Allowed Callback URLs**:
     `https://model-tribal-adr-code.trevordgoldsmith.workers.dev/sign-in/callback`
   - **Allowed Logout URLs**:
     `https://model-tribal-adr-code.trevordgoldsmith.workers.dev/, https://model-tribal-adr-code.trevordgoldsmith.workers.dev/sign-in/refused`
   - **Allowed Web Origins**: leave empty.
   - Add the same addresses with `http://localhost:8787` to try sign-in on a
     computer, and the custom domain once there is one.
4. **Authentication**: choose how people sign in (for example Google, and
   email with password). Turning off public sign-ups for the database
   connection is optional, because the site refuses anyone not on its list,
   but it keeps stray accounts out of the tenant.
5. Keep the application's **Domain**, **Client ID** and **Client Secret** for
   the next step. Do not paste them into GitHub, an issue or a chat.

### 2. In Cloudflare

Worker `model-tribal-adr-code` > **Settings > Variables and Secrets** > **Add**,
type **Secret** for each:

| Name | Value |
| --- | --- |
| `AUTH0_DOMAIN` | The application's Domain, such as `example.us.auth0.com` |
| `AUTH0_CLIENT_ID` | The application's Client ID |
| `AUTH0_CLIENT_SECRET` | The application's Client Secret |
| `SESSION_SECRET` | At least 32 random characters, used to encrypt the session cookie. For example, the output of `openssl rand -base64 48`. |
| `LEAD_AUTHOR_EMAIL` | The email address the lead author signs in with |

Secrets are kept when the Worker is deployed again (Cloudflare, ["Wrangler
configuration: source of
truth"](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)).
To rotate `SESSION_SECRET`, replace it; everyone is signed out.

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

Open `/sign-in` and sign in with the `LEAD_AUTHOR_EMAIL` address. The
workspace menu has a People page, where co-authors, advisors, editors,
contributors and nation reviewers are added by email address, and an Access
page, where their level on each document is raised or lowered. Tell each person to sign in at
`/sign-in` with that address; their access starts at their first sign-in.

## Database

`migrations/0001_sign_in_and_collaboration.sql`:

| Table | Holds |
| --- | --- |
| `people` | Who may sign in, their role, and for a nation reviewer the nation. Rows are never deleted, so earlier reviews keep their author. |
| `access_grants` | Each person's level on a document or a kind of document, with who granted it, when, until when, and when it ended (`migrations/0002_permission_tiers.sql`). |
| `reviews` | Sign-offs and comments, with the content version. |
| `requests` | Requests from the form, their status, outcome and targets. |
| `request_sources` | Proof for adding a nation, and other uploaded files. |
| `events` | The activity log: who did what and when, numbered in order. Cannot be changed or deleted. |
| `event_seals` | The seal of each activity log entry, chained to the one before. |

`migrations/0003_contributor_profiles.sql` adds contributor profiles, their
nations, interests and confirmed versions; see
[docs/contributor-profiles.md](../docs/contributor-profiles.md).

Status and outcome values are the words docs/requests.md uses
(`hidden-pending-review`, `declined` and so on), so the documentation and the
database match.

## Testing

`npm test` runs the unit tests in `tests/` with Vitest, including the database
code against the real migrations in an in-memory SQLite database. Sign-in
itself needs a real Auth0 application, so it is tried by hand after the
secrets are set.

## Sources

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
- Hiding material from the website directly from the workspace, before a pull
  request; for now hiding is a pull request.
- Editing content from the website. Content changes stay pull requests, which
  keeps history orderly.
