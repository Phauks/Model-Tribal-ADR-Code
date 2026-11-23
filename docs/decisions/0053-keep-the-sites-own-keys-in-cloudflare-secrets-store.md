# 0053. Keep the site's own keys in Cloudflare Secrets Store, reached through bindings

- **Status:** Accepted
- **Date:** 2026-11-23
- **Extends:** decision record [0006](0006-secrets-only-in-cloudflare.md)

## Context

Decision record 0006 keeps every secret in Cloudflare, as Worker secrets typed into the dashboard. By 2026-11-23 the website's Worker read three keys of its own that no outside service hands out: `PASSWORD_KEY`, which every password hash also goes through and which encrypts authenticator app secrets; `MAIL_SIGNING_KEY`, which signs unsubscribe and acknowledgment links; and `BOOK_FILE_LINK_SECRET`, which signs the links Lulu downloads print files from. None of them had been set, so each waited on Trevor Goldsmith to make a random value and paste it into the dashboard. Trevor's rule (2026-11-23) is to "always prefer bindings to secrets".

Cloudflare Secrets Store keeps account-level secrets that a Worker reads through a binding declared in its Wrangler file, with `await env.<binding>.get()` (Cloudflare, "Secrets Store: Workers"). The binding names the store and the secret, so the Wrangler file, which is public, says which secret each binding reads without holding its value. Deploying a Worker with such a binding needs an API token with the "Account Secrets Store Edit" permission (Cloudflare, "Secrets Store: Access control"), which the token Workers Builds makes on its own does not include (Cloudflare, "Workers Builds: Configuration").

## Decision

- The site's own keys are secrets in the account's default Secrets Store, each with the Workers scope, reached through bindings in `site/wrangler.jsonc`: `passwordKey` (secret `MODEL_TRIBAL_CODE_PASSWORD_KEY`), `mailSigningKey` (`MODEL_TRIBAL_CODE_MAIL_SIGNING_KEY`) and `bookFileLinkKey` (`MODEL_TRIBAL_CODE_BOOK_FILE_LINK_KEY`). The `MODEL_TRIBAL_CODE_` prefix keeps them apart from other projects' secrets in the same account store.
- Each value is random, made once when the secret is created, and never typed, copied or shown to anyone. The code reads them through `src/lib/server/stored-secrets.ts`; a secret that cannot be read counts as not set, so the feature it guards stays off.
- The Worker secrets `PASSWORD_KEY`, `MAIL_SIGNING_KEY` and `BOOK_FILE_LINK_SECRET` are no longer read.
- Keys that outside services hand out stay Worker secrets, because no binding replaces them: Stripe's and Lulu's keys, the outreach mailbox's SMTP password, and the scanner's optional `SCAN_HTTP_TOKEN` and `SCAN_REBUILD_HOOK_URL`. Outreach keeps its own mailbox because Cloudflare Email Sending is for transactional mail (Cloudflare, "Email Service"; decision record 0040). `LEAD_AUTHOR_EMAIL` stays a Worker secret only to keep the address out of the public Wrangler file.
- The Workers Builds token for the three Workers carries the "Account Secrets Store Edit" permission.

## Consequences

- Trevor no longer makes or pastes these three keys. The password key works from the first deploy, so passwords and authenticator secrets are keyed from then on.
- The password key must never be deleted or changed once used, as before: every password hashed with it and every authenticator app set up with it would stop working. Its comment in Secrets Store says so.
- A deploy fails, rather than running without a key, if a bound secret is missing or the build token lacks the Secrets Store permission.
- The Service checks page has a "Site keys (Secrets Store)" check that reads each binding without showing its value.

## Sources

- Cloudflare, [Secrets Store: Workers](https://developers.cloudflare.com/secrets-store/integrations/workers/).
- Cloudflare, [Secrets Store: Access control](https://developers.cloudflare.com/secrets-store/access-control/).
- Cloudflare, [Workers Builds: Configuration, API token](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token).
- Cloudflare, [Email Service](https://developers.cloudflare.com/email-service/).
