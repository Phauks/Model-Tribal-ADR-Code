# 0024. Sign people in with the site's own email codes and passwords, not Auth0

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Decision record 0013 chose Auth0 for sign-in. Before it was set up, the lead
author decided not to open an Auth0 account (2026-11-21). They then looked at
Cloudflare Access and turned it down because of its cost: the free plan covers
50 users, and the paid plan is $7 per user per month (Cloudflare, "SASE /
Zero Trust pricing"). The lead author also did not want to make everyone use
Google or passkeys. They asked for accounts kept in the site's own D1
database, as in two of their other projects:

- **Grimbinder** signs people in with a code or link sent by email through
  Cloudflare Email Service, plus an optional password hashed with PBKDF2
  (`worker/account/` there).
- **Magna Carta** uses email and password, stored in its own database.

Nobody had signed in with Auth0 when this changed, so there was nothing to
move.

## Decision

- **Codes by email.** People sign in with a six-digit code, or the matching
  link, sent through Cloudflare Email Service. The first sign-in makes the
  account, so there is no separate sign-up. A code:
  - works once, for 15 minutes;
  - stops after 5 wrong tries;
  - is stored only as a hash.
- **An optional password.** Anyone signed in may choose one. It is stored as
  a salted PBKDF2-SHA256 hash with 100,000 iterations, the most Workers
  allow. The rules follow NIST SP 800-63B: at least 12 characters, and no
  forced mixing of character types.
- **Invitation links.** The lead author can make a one-time sign-in link for
  someone they invited who has never signed in. It works for 7 days, and
  making one is recorded. Someone with access to the Cloudflare account can
  make a one-hour link from the command line (`npm run sign-in-link`). This
  is how the first lead author signs in before email is set up.
- **Sessions in the database.** Each session is a random 256-bit token in an
  HTTP-only, SameSite=Lax cookie. The database keeps only its hash. A session
  lasts at most 12 hours and ends after 4 hours without use, as before.
- **Limits.** Sign-in tries are limited per email address and per network
  address with the Workers rate limiting binding.
- **What stays from 0013.** Roles stay in the `people` table and are checked
  on every request. Nobody reaches the workspace until the lead author adds
  them. Open registration for contributor profiles (decision record 0022) is
  unchanged: every account has proved it receives mail at its address, which
  is what 0022 relied on Auth0 for.

## Consequences

- No outside sign-in service, no per-user cost, and no secret keys to keep.
  The only dashboard setting is `LEAD_AUTHOR_EMAIL`, kept out of the public
  repository.
- Codes can only be emailed from a domain onboarded in Email Service on the
  same Cloudflare account. Until `SIGN_IN_EMAIL_FROM` is set, people sign in
  with a password or an invitation link.
- The project now maintains its own sign-in code. It is kept small, uses only
  Web Crypto, and is covered by unit tests (`site/tests/sign-in.test.ts`).
- Email Sending is in public beta and needs the Workers paid plan, which the
  project already has.
- Single sign-on for an institution, or passkeys, could be added later as
  more ways to prove the same email address, without changing roles.

## Sources

- Cloudflare, "SASE / Zero Trust pricing", <https://www.cloudflare.com/plans/sase-zero-trust/>.
- Cloudflare, "Email Sending Workers API",
  <https://developers.cloudflare.com/email-service/api/send-emails/workers-api/>.
- Cloudflare, "Email Sending now in public beta" (2026-04-16),
  <https://developers.cloudflare.com/changelog/post/2026-04-16-email-sending-public-beta/>.
- Cloudflare, "Web Crypto",
  <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>.
- Paul A. Grassi et al., Nat'l Inst. of Standards & Tech., *Digital Identity
  Guidelines: Authentication and Lifecycle Management*, NIST SP 800-63B
  (2017), <https://pages.nist.gov/800-63-3/sp800-63b.html>.
- OWASP Foundation, "Password Storage Cheat Sheet",
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>.
- Phauks/Grimbinder, `worker/account/crypto.ts` and `worker/account/email.ts`.
- Phauks/magna-carta, `apps/api-worker/src/auth.ts`.
