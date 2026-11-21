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
- **Nobody can sign in until the lead author adds them.** There is no open
  sign-up.
- **Readers and requesters never need an account.** The request form at
  `/requests` works without signing in and without JavaScript
  (docs/requests.md, principle 5).
- **Content still changes only by pull request.** The workspace records who
  approved which version of a record, handles requests, and manages access;
  it does not edit the content files.
- **Secrets live only in Cloudflare**
  ([decision record 0006](../docs/decisions/0006-secrets-only-in-cloudflare.md)).

## Who can do what

Roles are stored in the database and changed by the lead author on the
People page (`/workspace/people`). Every change is recorded with who made it
and when. The rules are in `src/lib/permissions.ts` and are checked on the
server for every page and every form; the page only hides buttons a person
cannot use.

| Role | Can do |
| --- | --- |
| Lead author | Everything below, and adds, changes and removes people. The project always keeps at least one. |
| Editor | Reads requests and their uploaded files, changes their status, decides them; signs off on content or asks for changes. |
| Advisor | Signs off on content or asks for changes, as a project advisor; comments. Does not see requests. |
| Co-author | Reads the review list and comments. Does not see requests. |
| Nation reviewer | Sees and reviews one nation's record only, for that nation: approves it, asks for changes, or comments. Sees nothing else. |

Requests are limited to editors and the lead author because they hold
requesters' contact details and may describe restricted material (charter,
commitment 6).

A nation reviewer is how a nation's own office can approve its record
(charter, commitment 4: "sent to nation", "reviewed by nation", "approved by
nation"). The approval is recorded in the workspace; the record's
`review.status` is then changed by pull request, citing the approval.

## Reviews and sign-offs

`/workspace/reviews` lists every nation record that is not restricted
(including records held back until the nation approves them) and every
glossary term. Provisions and essays join the list when their records exist.
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

   Anyone else is signed out of Auth0 again and told why.
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
Apply them once per new migration, from `site/`:

```sh
npm run database:migrate:remote   # wrangler d1 migrations apply database --remote
```

Wrangler records which migrations ran, so running it again is safe. For the
copy used by `npm run preview`, use `npm run database:migrate:local`.

### First sign-in

Open `/sign-in` and sign in with the `LEAD_AUTHOR_EMAIL` address. The
workspace menu has a People page, where co-authors, advisors, editors and
nation reviewers are added by email address. Tell each person to sign in at
`/sign-in` with that address; their access starts at their first sign-in.

## Database

`migrations/0001_sign_in_and_collaboration.sql`:

| Table | Holds |
| --- | --- |
| `people` | Who may sign in, their role, and for a nation reviewer the nation. Rows are never deleted, so earlier reviews keep their author. |
| `reviews` | Sign-offs and comments, with the content version. |
| `requests` | Requests from the form, their status, outcome and targets. |
| `request_sources` | Proof for adding a nation, and other uploaded files. |
| `events` | Who did what and when: invitations, role changes, removals, status changes, notes. |

Status and outcome values are the words docs/requests.md uses
(`hidden-pending-review`, `declined` and so on), so the documentation and the
database match.

## Testing

`npm test` runs the unit tests in `tests/` with Vitest, including the database
code against the real migrations in an in-memory SQLite database. Sign-in
itself needs a real Auth0 application, so it is tried by hand after the
secrets are set.

## Not built yet

- Email to the maintainer when a request arrives (docs/requests.md,
  "Notification"). Until then, check `/workspace/requests`; the overview shows
  anything past a target.
- The public "Requests log" page (docs/requests.md, "Public log").
- Hiding material from the website directly from the workspace, before a pull
  request; for now hiding is a pull request.
- Editing content from the website. Content changes stay pull requests, which
  keeps history orderly.
