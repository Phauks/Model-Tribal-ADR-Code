# 0013. Sign in co-authors with Auth0; keep roles in the site's database

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Co-authors, advisors, editors and reviewers for each Native nation need to
sign in to the website to handle requests from nations and to record who
approved which version of the content. docs/requests.md first placed the
maintainer's request view "behind Cloudflare's access control". The lead
author chose Auth0 for sign-in instead (2026-11-21). Nation reviewers and
advisors are outside any one organization and sign in with accounts they
already have, which Auth0's social and email sign-in supports without the
project managing passwords (project analysis).

## Decision

- Sign-in uses Auth0, through its server SDK for JavaScript
  (`@auth0/auth0-server-js`), as a regular web application. The session is
  an encrypted, HTTP-only cookie; the Worker keeps no session table.
- Auth0 only proves who someone is. Roles (lead author, editor, advisor,
  co-author, nation reviewer for one nation) are kept in the site's own D1
  database, changed on the website by the lead author, and checked on every
  request, so removing access takes effect at once and every change is
  recorded.
- Nobody can sign in until the lead author adds their email address. A first
  sign-in is matched to that address only when Auth0 has verified it.
- Readers and people sending a request never need an account
  (docs/requests.md, principle 5).
- The Auth0 settings and the session key are Worker secrets in Cloudflare
  (decision record 0006).
- Content still changes only by pull request (decision records 0004 and
  0008). The website records reviews and decisions; it does not edit content
  files.

## Consequences

- Setting up needs an Auth0 tenant and application, five Worker secrets, and
  the database migrations applied once (site/COLLABORATION.md, "Setting up
  sign-in").
- Workers Builds' automatic token cannot apply D1 migrations, so they are run
  by hand with Wrangler until the token is given D1 permission.
- Cloudflare Access is not used. If the project later needs single sign-on
  for an institution, it can be added as an Auth0 connection without changing
  the site.

## Sources

- Auth0, "auth0-server-js" (README and examples),
  <https://github.com/auth0/auth0-auth-js/tree/main/packages/auth0-server-js>.
- Cloudflare, "Workers Builds configuration: API token",
  <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token>.
